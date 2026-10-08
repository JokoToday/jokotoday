-- JOKO TODAY payment rail v1
-- Direct PromptPay + EasySlip automated verification foundation.
-- Customer-facing activation remains disabled by default in payment_settings.

-- Extend the durable notification outbox for automatic payment confirmation.
ALTER TABLE public.order_notification_events
  DROP CONSTRAINT IF EXISTS order_notification_events_notification_type_check;

ALTER TABLE public.order_notification_events
  ADD CONSTRAINT order_notification_events_notification_type_check
  CHECK (notification_type = ANY (ARRAY[
    'customer_confirmation'::text,
    'admin_new_order'::text,
    'customer_cancellation'::text,
    'payment_confirmation'::text
  ]));

CREATE OR REPLACE FUNCTION public.claim_order_notification(
  p_order_id uuid,
  p_notification_type text
) RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $
DECLARE
  v_event public.order_notification_events%ROWTYPE;
BEGIN
  IF p_order_id IS NULL
     OR p_notification_type NOT IN (
       'customer_confirmation',
       'admin_new_order',
       'customer_cancellation',
       'payment_confirmation'
     ) THEN
    RETURN jsonb_build_object('outcome', 'invalid');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND COALESCE(o.purchase_type, 'online') = 'online'
      AND (
        (p_notification_type = 'customer_cancellation' AND o.status = 'cancelled')
        OR (p_notification_type = 'payment_confirmation' AND o.payment_status = 'paid')
        OR p_notification_type IN ('customer_confirmation', 'admin_new_order')
      )
  ) THEN
    RETURN jsonb_build_object('outcome', 'unavailable');
  END IF;

  SELECT * INTO v_event
  FROM public.order_notification_events
  WHERE order_id = p_order_id
    AND notification_type = p_notification_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'unavailable');
  END IF;

  IF v_event.status = 'sent' THEN
    RETURN jsonb_build_object(
      'outcome', 'already_sent',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  END IF;

  IF v_event.status = 'uncertain' THEN
    RETURN jsonb_build_object(
      'outcome', 'uncertain',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  END IF;

  IF v_event.status = 'processing'
     AND v_event.claimed_at IS NOT NULL
     AND v_event.claimed_at > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object(
      'outcome', 'processing',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  END IF;

  IF v_event.status = 'processing'
     AND v_event.first_attempt_at IS NOT NULL
     AND v_event.first_attempt_at <= now() - interval '23 hours' THEN
    UPDATE public.order_notification_events
    SET status = 'uncertain',
        updated_at = now(),
        last_error = COALESCE(
          last_error,
          'Processing outcome exceeded provider idempotency window'
        )
    WHERE id = v_event.id
    RETURNING * INTO v_event;

    RETURN jsonb_build_object(
      'outcome', 'uncertain',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  END IF;

  UPDATE public.order_notification_events
  SET status = 'processing',
      first_attempt_at = COALESCE(first_attempt_at, now()),
      claimed_at = now(),
      attempt_count = attempt_count + 1,
      updated_at = now(),
      last_error = NULL
  WHERE id = v_event.id
  RETURNING * INTO v_event;

  RETURN jsonb_build_object(
    'outcome', 'claimed',
    'event_id', v_event.id,
    'attempt_count', v_event.attempt_count,
    'language', v_event.language
  );
END;
$;

REVOKE EXECUTE ON FUNCTION public.claim_order_notification(uuid,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_order_notification(uuid,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_order_notification(uuid,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_notification(uuid,text) TO service_role;

CREATE TABLE IF NOT EXISTS public.payment_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  online_promptpay_enabled boolean NOT NULL DEFAULT false,
  payment_window_minutes integer NOT NULL DEFAULT 60
    CHECK (payment_window_minutes BETWEEN 5 AND 1440),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.payment_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_settings_authenticated_read ON public.payment_settings;
CREATE POLICY payment_settings_authenticated_read
ON public.payment_settings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS payment_settings_admin_update ON public.payment_settings;
CREATE POLICY payment_settings_admin_update
ON public.payment_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'easyslip',
  rail text NOT NULL DEFAULT 'promptpay',
  currency text NOT NULL DEFAULT 'THB',
  amount_due numeric(10,2) NOT NULL CHECK (amount_due > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','verifying','verified','failed','expired','cancelled')),
  provider_transaction_ref text,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_transactions_order_unique UNIQUE (order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_ref_unique
ON public.payment_transactions(provider, provider_transaction_ref)
WHERE provider_transaction_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_transactions_customer_created_idx
ON public.payment_transactions(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_transactions_expiry_idx
ON public.payment_transactions(status, expires_at)
WHERE status IN ('pending','verifying','failed');

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_transactions_customer_read ON public.payment_transactions;
CREATE POLICY payment_transactions_customer_read
ON public.payment_transactions
FOR SELECT
TO authenticated
USING (customer_id = auth.uid());

DROP POLICY IF EXISTS payment_transactions_admin_read ON public.payment_transactions;
CREATE POLICY payment_transactions_admin_read
ON public.payment_transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

CREATE TABLE IF NOT EXISTS public.payment_slip_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id uuid NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'easyslip',
  status text NOT NULL
    CHECK (status IN ('verifying','pending','verified','rejected','provider_error')),
  storage_path text,
  provider_transaction_ref text,
  amount_in_slip numeric(10,2),
  expected_amount numeric(10,2),
  amount_matched boolean,
  account_matched boolean,
  provider_duplicate boolean,
  receiver_bank_short_code text,
  receiver_name text,
  error_code text,
  provider_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS payment_slip_verifications_transaction_idx
ON public.payment_slip_verifications(payment_transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_slip_verifications_order_idx
ON public.payment_slip_verifications(order_id, created_at DESC);

ALTER TABLE public.payment_slip_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_slip_verifications_admin_read ON public.payment_slip_verifications;
CREATE POLICY payment_slip_verifications_admin_read
ON public.payment_slip_verifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  )
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-slips',
  'payment-slips',
  false,
  4194304,
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.create_or_get_payment_transaction_v1(
  p_order_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_existing public.payment_transactions%ROWTYPE;
  v_setting public.payment_settings%ROWTYPE;
  v_amount_due numeric(10,2);
  v_result public.payment_transactions%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order id is required';
  END IF;

  SELECT * INTO v_setting
  FROM public.payment_settings
  WHERE id = true;

  IF NOT FOUND OR COALESCE(v_setting.online_promptpay_enabled, false) = false THEN
    RAISE EXCEPTION 'Online PromptPay is not enabled';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.customer_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'You may only pay for your own order' USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_order.purchase_type, 'online') <> 'online' THEN
    RAISE EXCEPTION 'Only online orders can use online PromptPay';
  END IF;

  IF v_order.pickup_date_id IS NULL THEN
    RAISE EXCEPTION 'Online PromptPay requires the current pickup inventory flow';
  END IF;

  IF v_order.status NOT IN ('pending','confirmed','ready') OR v_order.picked_up_at IS NOT NULL THEN
    RAISE EXCEPTION 'This order can no longer accept online payment';
  END IF;

  v_amount_due := round(v_order.total_amount - COALESCE(v_order.loyalty_discount_amount, 0), 2);

  IF v_amount_due <= 0 THEN
    RAISE EXCEPTION 'This order has no positive amount due';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'This order is already paid';
  END IF;

  SELECT * INTO v_existing
  FROM public.payment_transactions
  WHERE order_id = p_order_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM v_user_id
       OR v_existing.amount_due IS DISTINCT FROM v_amount_due THEN
      RAISE EXCEPTION 'Existing payment transaction does not match the order';
    END IF;

    IF v_existing.status = 'verified' THEN
      RETURN to_jsonb(v_existing);
    END IF;

    IF v_existing.status IN ('expired','cancelled') THEN
      RAISE EXCEPTION 'This payment request is no longer active';
    END IF;

    RETURN to_jsonb(v_existing);
  END IF;

  INSERT INTO public.payment_transactions (
    order_id,
    customer_id,
    amount_due,
    expires_at
  ) VALUES (
    v_order.id,
    v_user_id,
    v_amount_due,
    now() + make_interval(mins => v_setting.payment_window_minutes)
  )
  RETURNING * INTO v_result;

  RETURN to_jsonb(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_get_payment_transaction_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_get_payment_transaction_v1(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_verified_payment_v1(
  p_payment_transaction_id uuid,
  p_provider_transaction_ref text,
  p_amount_in_slip numeric,
  p_account_matched boolean,
  p_amount_matched boolean,
  p_provider_duplicate boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_payment public.payment_transactions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_redemption public.loyalty_redemptions%ROWTYPE;
  v_language text := 'en';
  v_provider_ref text := NULLIF(btrim(COALESCE(p_provider_transaction_ref, '')), '');
BEGIN
  IF v_role <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_payment_transaction_id IS NULL OR v_provider_ref IS NULL THEN
    RAISE EXCEPTION 'Payment transaction and provider transaction reference are required';
  END IF;

  SELECT * INTO v_payment
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment transaction not found';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_payment.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_payment.status = 'verified' THEN
    IF v_payment.provider_transaction_ref IS DISTINCT FROM v_provider_ref THEN
      RAISE EXCEPTION 'Payment transaction is already verified with another bank transaction';
    END IF;
    RETURN jsonb_build_object(
      'payment', to_jsonb(v_payment),
      'order', to_jsonb(v_order),
      'idempotent_replay', true
    );
  END IF;

  IF v_payment.status IN ('expired','cancelled') OR now() >= v_payment.expires_at THEN
    UPDATE public.payment_transactions
    SET status = 'expired', updated_at = now()
    WHERE id = v_payment.id;
    RAISE EXCEPTION 'Payment request has expired';
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Order is already paid';
  END IF;

  IF COALESCE(p_account_matched, false) = false THEN
    RAISE EXCEPTION 'Receiving account does not match';
  END IF;

  IF COALESCE(p_amount_matched, false) = false THEN
    RAISE EXCEPTION 'Payment amount does not match';
  END IF;

  IF COALESCE(p_provider_duplicate, false) = true THEN
    RAISE EXCEPTION 'Provider reports this bank transaction has already been used';
  END IF;

  IF round(COALESCE(p_amount_in_slip, 0), 2) IS DISTINCT FROM round(v_payment.amount_due, 2) THEN
    RAISE EXCEPTION 'Verified slip amount does not equal the order amount due';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payment_transactions pt
    WHERE pt.provider = v_payment.provider
      AND pt.provider_transaction_ref = v_provider_ref
      AND pt.id <> v_payment.id
  ) THEN
    RAISE EXCEPTION 'Bank transaction reference has already been used';
  END IF;

  IF COALESCE(v_order.loyalty_discount_amount, 0) > 0 THEN
    SELECT * INTO v_redemption
    FROM public.loyalty_redemptions r
    WHERE r.order_id = v_order.id
      AND r.status = 'reserved'
      AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount','percentage_discount')
    ORDER BY r.created_at, r.id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Discounted order is missing its reserved loyalty redemption';
    END IF;
  END IF;

  UPDATE public.orders
  SET payment_method = 'promptpay_online',
      payment_status = 'paid',
      amount_paid = v_payment.amount_due,
      status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
      updated_at = now()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  IF v_redemption.id IS NOT NULL THEN
    UPDATE public.loyalty_redemptions
    SET status = 'redeemed'
    WHERE id = v_redemption.id;
  END IF;

  UPDATE public.payment_transactions
  SET status = 'verified',
      provider_transaction_ref = v_provider_ref,
      verified_at = now(),
      last_error_code = NULL,
      last_error_message = NULL,
      updated_at = now()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  SELECT CASE lower(COALESCE(up.preferred_language, 'en'))
           WHEN 'th' THEN 'th'
           WHEN 'zh' THEN 'zh'
           ELSE 'en'
         END
  INTO v_language
  FROM public.user_profiles up
  WHERE up.id = v_order.customer_id;

  v_language := COALESCE(v_language, 'en');

  INSERT INTO public.order_notification_events (
    order_id,
    notification_type,
    language
  ) VALUES (
    v_order.id,
    'payment_confirmation',
    v_language
  )
  ON CONFLICT (order_id, notification_type) DO NOTHING;

  RETURN jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'order', to_jsonb(v_order),
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_verified_payment_v1(uuid,text,numeric,boolean,boolean,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_verified_payment_v1(uuid,text,numeric,boolean,boolean,boolean) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_verified_payment_v1(uuid,text,numeric,boolean,boolean,boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_verified_payment_v1(uuid,text,numeric,boolean,boolean,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.expire_payment_transaction_v1(
  p_payment_transaction_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment transaction not found';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_payment.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_payment.status = 'verified' OR v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'payment', to_jsonb(v_payment),
      'order', to_jsonb(v_order),
      'expired', false
    );
  END IF;

  IF v_payment.status = 'cancelled' OR v_order.status = 'cancelled' THEN
    UPDATE public.payment_transactions
    SET status = CASE WHEN status = 'verified' THEN status ELSE 'cancelled' END,
        updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    RETURN jsonb_build_object(
      'payment', to_jsonb(v_payment),
      'order', to_jsonb(v_order),
      'expired', false
    );
  END IF;

  IF now() < v_payment.expires_at THEN
    RETURN jsonb_build_object(
      'payment', to_jsonb(v_payment),
      'order', to_jsonb(v_order),
      'expired', false
    );
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
      WHERE item.product_id IS NOT NULL
        AND item.quantity IS NOT NULL
        AND item.quantity > 0
      ORDER BY item.product_id
    LOOP
      SELECT * INTO v_inventory
      FROM public.product_date_inventory
      WHERE pickup_date_id = v_order.pickup_date_id
        AND product_id = v_item.product_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record is missing for a product in this order';
      END IF;

      IF v_inventory.reserved_quantity < v_item.quantity THEN
        RAISE EXCEPTION 'Inventory reservation ledger is inconsistent for this order';
      END IF;

      UPDATE public.product_date_inventory
      SET reserved_quantity = reserved_quantity - v_item.quantity,
          updated_at = now()
      WHERE pickup_date_id = v_order.pickup_date_id
        AND product_id = v_item.product_id;

      INSERT INTO public.inventory_events (
        pickup_date_id,
        product_id,
        order_id,
        event_type,
        reserved_delta,
        actor_id,
        reason
      ) VALUES (
        v_order.pickup_date_id,
        v_item.product_id,
        v_order.id,
        'release',
        -v_item.quantity,
        NULL,
        'payment_timeout'
      );
    END LOOP;
  END IF;

  PERFORM public.refund_reserved_order_loyalty_reward_v2(
    v_order.id,
    NULL,
    'Online PromptPay payment window expired'
  );

  UPDATE public.orders
  SET status = 'cancelled',
      inventory_reserved = false,
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

  RETURN jsonb_build_object(
    'payment', to_jsonb(v_payment),
    'order', to_jsonb(v_order),
    'expired', true
  );
END;
$;

REVOKE ALL ON FUNCTION public.expire_payment_transaction_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_payment_transaction_v1(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.expire_payment_transaction_v1(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_payment_transaction_v1(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.expire_unpaid_payment_transactions_v1()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $
DECLARE
  v_row record;
  v_expired integer := 0;
  v_skipped integer := 0;
BEGIN
  FOR v_row IN
    SELECT id
    FROM public.payment_transactions
    WHERE status IN ('pending','verifying','failed')
      AND expires_at <= now()
    ORDER BY expires_at
    LIMIT 200
  LOOP
    BEGIN
      PERFORM public.expire_payment_transaction_v1(v_row.id);
      v_expired := v_expired + 1;
    EXCEPTION WHEN OTHERS THEN
      v_skipped := v_skipped + 1;
      RAISE WARNING 'Could not expire payment transaction %: %', v_row.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object('expired', v_expired, 'skipped', v_skipped);
END;
$;

REVOKE ALL ON FUNCTION public.expire_unpaid_payment_transactions_v1() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_unpaid_payment_transactions_v1() FROM anon;
REVOKE ALL ON FUNCTION public.expire_unpaid_payment_transactions_v1() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_unpaid_payment_transactions_v1() TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_order_pickup(p_order_id uuid)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_customer_id uuid;
  v_existing_earn_at timestamptz;
BEGIN
  IF NOT public.is_staff_or_admin() THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501'; END IF;
  SELECT o.customer_id INTO v_customer_id FROM public.orders o WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_customer_id IS NOT NULL THEN
    PERFORM 1 FROM public.customers c WHERE c.id = v_customer_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_customer_id THEN RAISE EXCEPTION 'Order customer changed while confirming pickup; retry'; END IF;
  IF v_order.status = 'cancelled' THEN RAISE EXCEPTION 'Cancelled orders cannot be picked up'; END IF;
  IF COALESCE(v_order.payment_status, 'unpaid') <> 'paid' THEN RAISE EXCEPTION 'Payment must be recorded before pickup'; END IF;
  IF v_order.payment_method IS NULL OR v_order.payment_method NOT IN ('cash', 'qr_code', 'qr', 'promptpay_online') THEN
    RAISE EXCEPTION 'Valid payment method must be recorded before pickup';
  END IF;
  IF COALESCE(v_order.loyalty_discount_amount, 0) > 0 THEN
    IF v_order.amount_paid IS DISTINCT FROM round(v_order.total_amount - v_order.loyalty_discount_amount, 2) THEN RAISE EXCEPTION 'Discounted order payment amount is inconsistent'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.loyalty_redemptions r
      WHERE r.order_id = v_order.id AND r.status = 'reserved'
        AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
    ) THEN RAISE EXCEPTION 'Loyalty reward must be consumed by the payment flow before pickup'; END IF;
  END IF;
  IF v_order.status NOT IN ('picked_up', 'completed') THEN
    UPDATE public.orders SET status='picked_up', picked_up_at=COALESCE(picked_up_at,now()), staff_id=COALESCE(staff_id,auth.uid())
    WHERE id=p_order_id RETURNING * INTO v_order;
  END IF;
  IF v_order.customer_id IS NOT NULL AND COALESCE(v_order.loyalty_points_earned,0)>0 AND v_order.loyalty_points_awarded_at IS NULL THEN
    SELECT e.created_at INTO v_existing_earn_at FROM public.loyalty_point_events e
    WHERE e.order_id=v_order.id AND e.event_type='earn' LIMIT 1;
    IF v_existing_earn_at IS NULL THEN
      PERFORM public.apply_loyalty_points_delta_v2(
        v_order.customer_id,v_order.loyalty_points_earned,'earn',v_order.id,NULL,auth.uid(),
        'Points awarded at pickup/completion',
        jsonb_build_object('purchase_type',COALESCE(v_order.purchase_type,'online'),'loyalty_rate',v_order.loyalty_multiplier,'gross_amount',v_order.total_amount,'loyalty_discount_amount',COALESCE(v_order.loyalty_discount_amount,0),'amount_paid',v_order.amount_paid)
      );
      v_existing_earn_at:=now();
    END IF;
    UPDATE public.orders SET loyalty_points_awarded_at=COALESCE(v_existing_earn_at,now()) WHERE id=v_order.id RETURNING * INTO v_order;
  END IF;
  RETURN NEXT v_order;
END;
$$;

COMMENT ON TABLE public.payment_transactions IS
'Server-authoritative online payment state. Browser clients may read their own rows but cannot insert/update/finalize payments directly.';

COMMENT ON TABLE public.payment_slip_verifications IS
'Audit trail of EasySlip verification attempts. Slip images are stored in the private payment-slips bucket.';

COMMENT ON FUNCTION public.finalize_verified_payment_v1(uuid,text,numeric,boolean,boolean,boolean) IS
'Service-role-only atomic payment finalizer. Verifies receiver/amount/duplicate conditions again, enforces bank transaction uniqueness, consumes reserved loyalty discount, and marks the order paid.';
