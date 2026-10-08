-- JOKO TODAY payment-timeout history + safe customer reactivation.
-- Timed-out orders remain as cancelled history but are distinguished from
-- customer/staff cancellations and may be reactivated only after stock/cutoff
-- are revalidated atomically.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancellation_reason_code text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

COMMENT ON COLUMN public.orders.cancellation_reason_code IS
  'Machine-readable cancellation reason. payment_timeout identifies automatic non-payment cancellation.';

-- Preserve the reason for timeout cancellations that happened between payment
-- rail v1 and this migration so they immediately receive the correct My Orders tag.
UPDATE public.orders o
SET cancellation_reason_code = 'payment_timeout',
    cancelled_at = COALESCE(o.cancelled_at, p.updated_at, o.updated_at)
FROM public.payment_transactions p
WHERE p.order_id = o.id
  AND o.status = 'cancelled'
  AND COALESCE(o.payment_status, 'unpaid') = 'unpaid'
  AND p.status = 'expired'
  AND p.last_error_code = 'PAYMENT_EXPIRED'
  AND o.cancellation_reason_code IS NULL;

CREATE OR REPLACE FUNCTION public.expire_payment_transaction_v1(
  p_payment_transaction_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $payment$
DECLARE
  v_payment public.payment_transactions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_inventory public.product_date_inventory%ROWTYPE;
  v_item record;
BEGIN
  SELECT * INTO v_payment
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment transaction not found'; END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_payment.order_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_payment.status = 'verified' OR v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'order', to_jsonb(v_order), 'expired', false);
  END IF;

  IF v_payment.status = 'cancelled' OR v_order.status = 'cancelled' THEN
    UPDATE public.payment_transactions
    SET status = CASE WHEN status = 'verified' THEN status ELSE 'cancelled' END,
        updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
    RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'order', to_jsonb(v_order), 'expired', false);
  END IF;

  IF now() < v_payment.expires_at THEN
    RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'order', to_jsonb(v_order), 'expired', false);
  END IF;

  IF v_order.status NOT IN ('pending','confirmed') OR v_order.picked_up_at IS NOT NULL THEN
    RAISE EXCEPTION 'Order cannot be expired automatically in its current state';
  END IF;

  IF v_order.order_items IS NULL OR jsonb_typeof(v_order.order_items) <> 'array' THEN
    RAISE EXCEPTION 'Order item snapshot is invalid';
  END IF;

  IF v_order.inventory_reserved THEN
    FOR v_item IN
      SELECT item.product_id, item.quantity
      FROM jsonb_to_recordset(v_order.order_items) AS item(product_id uuid, quantity integer)
      WHERE item.product_id IS NOT NULL AND item.quantity IS NOT NULL AND item.quantity > 0
      ORDER BY item.product_id
    LOOP
      SELECT * INTO v_inventory
      FROM public.product_date_inventory
      WHERE pickup_date_id = v_order.pickup_date_id AND product_id = v_item.product_id
      FOR UPDATE;

      IF NOT FOUND THEN RAISE EXCEPTION 'Inventory record is missing for a product in this order'; END IF;
      IF v_inventory.reserved_quantity < v_item.quantity THEN
        RAISE EXCEPTION 'Inventory reservation ledger is inconsistent for this order';
      END IF;

      UPDATE public.product_date_inventory
      SET reserved_quantity = reserved_quantity - v_item.quantity, updated_at = now()
      WHERE pickup_date_id = v_order.pickup_date_id AND product_id = v_item.product_id;

      INSERT INTO public.inventory_events (
        pickup_date_id, product_id, order_id, event_type, reserved_delta, actor_id, reason
      ) VALUES (
        v_order.pickup_date_id, v_item.product_id, v_order.id, 'release', -v_item.quantity, NULL, 'payment_timeout'
      );
    END LOOP;
  END IF;

  PERFORM public.refund_reserved_order_loyalty_reward_v2(
    v_order.id, NULL, 'Online QR payment window expired'
  );

  UPDATE public.orders
  SET status = 'cancelled',
      inventory_reserved = false,
      cancellation_reason_code = 'payment_timeout',
      cancelled_at = now(),
      updated_at = now()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  UPDATE public.payment_transactions
  SET status = 'expired',
      last_error_code = 'PAYMENT_EXPIRED',
      last_error_message = 'Payment was not verified before the payment deadline.',
      updated_at = now()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  UPDATE public.payment_handoff_sessions
  SET status = 'expired', updated_at = now()
  WHERE payment_transaction_id = v_payment.id
    AND status IN ('active','slip_received','verifying');

  RETURN jsonb_build_object('payment', to_jsonb(v_payment), 'order', to_jsonb(v_order), 'expired', true);
END;
$payment$;

REVOKE ALL ON FUNCTION public.expire_payment_transaction_v1(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_payment_transaction_v1(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reactivate_expired_online_order_v1(
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $reactivate$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_payment public.payment_transactions%ROWTYPE;
  v_date public.pickup_dates%ROWTYPE;
  v_inventory public.product_date_inventory%ROWTYPE;
  v_product public.cms_products%ROWTYPE;
  v_item record;
  v_window integer;
  v_new_expiry timestamptz;
  v_today_bangkok date := timezone('Asia/Bangkok', now())::date;
  v_has_reversed_money_reward boolean := false;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND OR v_order.customer_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF COALESCE(v_order.purchase_type, 'online') <> 'online' THEN RAISE EXCEPTION 'Only online orders can be reactivated'; END IF;
  IF v_order.status <> 'cancelled' OR COALESCE(v_order.payment_status, 'unpaid') <> 'unpaid' THEN
    RAISE EXCEPTION 'Only an unpaid cancelled order can be reactivated';
  END IF;
  IF v_order.cancellation_reason_code IS DISTINCT FROM 'payment_timeout' THEN
    RAISE EXCEPTION 'Only orders cancelled automatically for non-payment can be reactivated';
  END IF;
  IF v_order.picked_up_at IS NOT NULL OR v_order.pickup_date_id IS NULL OR v_order.pickup_location_id IS NULL THEN
    RAISE EXCEPTION 'This order cannot be reactivated';
  END IF;
  IF v_order.order_items IS NULL OR jsonb_typeof(v_order.order_items) <> 'array' THEN
    RAISE EXCEPTION 'Order item snapshot is invalid';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.loyalty_redemptions r
    WHERE r.order_id = v_order.id
      AND r.status = 'reversed'
      AND (r.reward_snapshot->>'reward_type') IN ('fixed_discount','percentage_discount')
  ) INTO v_has_reversed_money_reward;
  IF v_has_reversed_money_reward THEN
    RAISE EXCEPTION 'This order used a loyalty reward. Please use Order again so you can choose a reward again.';
  END IF;

  SELECT * INTO v_date
  FROM public.pickup_dates
  WHERE id = v_order.pickup_date_id
  FOR UPDATE;

  IF NOT FOUND OR v_date.status <> 'open' THEN RAISE EXCEPTION 'The original pickup date is no longer available'; END IF;
  IF v_date.pickup_date < v_today_bangkok THEN RAISE EXCEPTION 'The original pickup date has passed'; END IF;
  IF now() >= v_date.order_cutoff_at THEN RAISE EXCEPTION 'The ordering cutoff has passed for the original pickup date'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pickup_date_locations dl
    JOIN public.cms_pickup_locations l ON l.id = dl.location_id
      AND l.is_active = true
    WHERE dl.pickup_date_id = v_order.pickup_date_id
      AND dl.location_id = v_order.pickup_location_id
      AND dl.is_active = true
  ) THEN
    RAISE EXCEPTION 'The original pickup location is no longer available';
  END IF;

  FOR v_item IN
    SELECT item.product_id, item.quantity
    FROM jsonb_to_recordset(v_order.order_items) AS item(product_id uuid, quantity integer)
    WHERE item.product_id IS NOT NULL AND item.quantity IS NOT NULL AND item.quantity > 0
    ORDER BY item.product_id
  LOOP
    SELECT * INTO v_product
    FROM public.cms_products
    WHERE id = v_item.product_id
    FOR UPDATE;
    IF NOT FOUND OR COALESCE(v_product.is_active, false) = false OR COALESCE(v_product.is_sold_out, false) = true THEN
      RAISE EXCEPTION 'An item in this order is no longer available';
    END IF;

    SELECT * INTO v_inventory
    FROM public.product_date_inventory
    WHERE pickup_date_id = v_order.pickup_date_id AND product_id = v_item.product_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'An item is no longer offered for the original pickup date'; END IF;
    IF (v_inventory.capacity - v_inventory.reserved_quantity) < v_item.quantity THEN
      RAISE EXCEPTION 'There is no longer enough stock to reactivate this order';
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT item.product_id, item.quantity
    FROM jsonb_to_recordset(v_order.order_items) AS item(product_id uuid, quantity integer)
    WHERE item.product_id IS NOT NULL AND item.quantity IS NOT NULL AND item.quantity > 0
    ORDER BY item.product_id
  LOOP
    UPDATE public.product_date_inventory
    SET reserved_quantity = reserved_quantity + v_item.quantity, updated_at = now()
    WHERE pickup_date_id = v_order.pickup_date_id
      AND product_id = v_item.product_id
      AND reserved_quantity + v_item.quantity <= capacity;
    IF NOT FOUND THEN RAISE EXCEPTION 'Inventory changed while reactivating this order; please try again'; END IF;

    INSERT INTO public.inventory_events (
      pickup_date_id, product_id, order_id, event_type, reserved_delta, actor_id, reason
    ) VALUES (
      v_order.pickup_date_id, v_item.product_id, v_order.id, 'reserve', v_item.quantity, v_user_id, 'payment_timeout_reactivation'
    );
  END LOOP;

  SELECT payment_window_minutes INTO v_window
  FROM public.payment_settings
  WHERE id = true;
  v_window := COALESCE(v_window, 60);
  v_new_expiry := now() + make_interval(mins => v_window);

  SELECT * INTO v_payment
  FROM public.payment_transactions
  WHERE order_id = v_order.id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment transaction is missing for this order'; END IF;
  IF v_payment.status <> 'expired' THEN RAISE EXCEPTION 'This payment is not eligible for reactivation'; END IF;

  UPDATE public.orders
  SET status = 'pending',
      inventory_reserved = true,
      cancellation_reason_code = NULL,
      cancelled_at = NULL,
      updated_at = now()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  UPDATE public.payment_transactions
  SET status = 'pending',
      expires_at = v_new_expiry,
      verified_at = NULL,
      provider_transaction_ref = NULL,
      last_error_code = NULL,
      last_error_message = NULL,
      updated_at = now()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  UPDATE public.payment_handoff_sessions
  SET status = 'cancelled', updated_at = now()
  WHERE payment_transaction_id = v_payment.id
    AND status <> 'verified';

  RETURN jsonb_build_object(
    'order', to_jsonb(v_order),
    'payment', to_jsonb(v_payment),
    'reactivated', true
  );
END;
$reactivate$;

REVOKE ALL ON FUNCTION public.reactivate_expired_online_order_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reactivate_expired_online_order_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_expired_online_order_v1(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.expire_own_payment_transaction_v1(
  p_payment_transaction_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $expire_own$
DECLARE
  v_user_id uuid := auth.uid();
  v_payment public.payment_transactions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_payment
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id;

  IF NOT FOUND OR v_payment.customer_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Payment transaction not found';
  END IF;

  IF v_payment.status = 'verified' THEN
    RETURN jsonb_build_object('expired', false, 'status', 'verified');
  END IF;

  IF now() < v_payment.expires_at THEN
    RAISE EXCEPTION 'Payment window has not expired';
  END IF;

  RETURN public.expire_payment_transaction_v1(v_payment.id);
END;
$expire_own$;

REVOKE ALL ON FUNCTION public.expire_own_payment_transaction_v1(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.expire_own_payment_transaction_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_own_payment_transaction_v1(uuid) TO service_role;
