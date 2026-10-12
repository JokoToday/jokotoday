-- JOKO TODAY payment safety hardening v1
-- 1) Serialize payment finalization and customer cancellation in a consistent
--    order (orders row first, then payment transaction).
-- 2) Never allow a cancelled order to be resurrected by late verification.
-- 3) Mark an active payment transaction cancelled when the customer cancels,
--    so provider webhooks can refund rather than attach a payment to the order.

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
AS $payment$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_payment public.payment_transactions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_order_id uuid;
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

  -- Read the immutable relationship first, then lock ORDER -> PAYMENT.
  -- Customer cancellation also locks the order first, preventing a lock-order
  -- inversion and making the cancellation/payment race deterministic.
  SELECT pt.order_id INTO v_order_id
  FROM public.payment_transactions pt
  WHERE pt.id = p_payment_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment transaction not found';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  SELECT * INTO v_payment
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND OR v_payment.order_id IS DISTINCT FROM v_order.id THEN
    RAISE EXCEPTION 'Payment transaction no longer matches the order';
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

  -- A cancelled order is terminal for this payment transaction. This is the
  -- key guard against a verification callback resurrecting released inventory.
  IF v_order.status = 'cancelled' THEN
    UPDATE public.payment_transactions
    SET status = 'cancelled',
        last_error_code = 'ORDER_CANCELLED',
        last_error_message = 'Order was cancelled before payment finalization.',
        updated_at = now()
    WHERE id = v_payment.id
      AND status <> 'verified';
    RAISE EXCEPTION 'Order is cancelled';
  END IF;

  IF v_order.status NOT IN ('pending','confirmed','ready') OR v_order.picked_up_at IS NOT NULL THEN
    RAISE EXCEPTION 'Order can no longer accept payment';
  END IF;

  IF v_payment.status IN ('expired','cancelled') OR now() >= v_payment.expires_at THEN
    UPDATE public.payment_transactions
    SET status = CASE WHEN status = 'cancelled' THEN 'cancelled' ELSE 'expired' END,
        updated_at = now()
    WHERE id = v_payment.id;
    RAISE EXCEPTION 'Payment request has expired or been cancelled';
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
    RAISE EXCEPTION 'Verified payment amount does not equal the order amount due';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payment_transactions pt
    WHERE pt.provider = v_payment.provider
      AND pt.provider_transaction_ref = v_provider_ref
      AND pt.id <> v_payment.id
  ) THEN
    RAISE EXCEPTION 'Provider transaction reference has already been used';
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
    AND status <> 'cancelled'
    AND COALESCE(payment_status, 'unpaid') <> 'paid'
  RETURNING * INTO v_order;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order changed state before payment finalization';
  END IF;

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
$payment$;

REVOKE ALL ON FUNCTION public.finalize_verified_payment_v1(uuid,text,numeric,boolean,boolean,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_verified_payment_v1(uuid,text,numeric,boolean,boolean,boolean) FROM anon;
REVOKE ALL ON FUNCTION public.finalize_verified_payment_v1(uuid,text,numeric,boolean,boolean,boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_verified_payment_v1(uuid,text,numeric,boolean,boolean,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_online_order_v2(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $cancel$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_result jsonb;
  v_language text := 'en';
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order id is required';
  END IF;

  SELECT o.customer_id
  INTO v_customer_id
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_customer_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'You may only cancel your own order' USING ERRCODE = '42501';
  END IF;

  -- The inventory function locks the order row FOR UPDATE and performs all
  -- normal cancellation checks/releases before returning.
  v_result := public.cancel_online_order_v2_inventory_v1(p_order_id);

  -- Keep the payment state in the same transaction as cancellation. Because
  -- the order row remains locked until commit, finalization cannot race past
  -- this point and attach a later verification to a cancelled order.
  UPDATE public.payment_transactions
  SET status = 'cancelled',
      last_error_code = 'ORDER_CANCELLED',
      last_error_message = 'Customer cancelled the order before payment was finalized.',
      updated_at = now()
  WHERE order_id = p_order_id
    AND status IN ('pending','verifying','failed');

  UPDATE public.payment_handoff_sessions
  SET status = 'cancelled',
      updated_at = now()
  WHERE payment_transaction_id IN (
    SELECT id FROM public.payment_transactions WHERE order_id = p_order_id
  )
    AND status IN ('active','slip_received','verifying');

  PERFORM public.refund_reserved_order_loyalty_reward_v2(
    p_order_id,
    v_user_id,
    'Customer cancelled Pickup v2 order before payment'
  );

  SELECT to_jsonb(o)
  INTO v_result
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF COALESCE(v_result ->> 'status', '') = 'cancelled' THEN
    SELECT CASE lower(COALESCE(up.preferred_language, 'en'))
      WHEN 'th' THEN 'th'
      WHEN 'zh' THEN 'zh'
      ELSE 'en'
    END
    INTO v_language
    FROM public.user_profiles up
    WHERE up.id = v_user_id;

    v_language := COALESCE(v_language, 'en');

    INSERT INTO public.order_notification_events (
      order_id,
      notification_type,
      language
    ) VALUES (
      p_order_id,
      'customer_cancellation',
      v_language
    )
    ON CONFLICT (order_id, notification_type) DO NOTHING;
  END IF;

  RETURN v_result;
END;
$cancel$;

COMMENT ON FUNCTION public.cancel_online_order_v2(uuid) IS
  'Pickup v2 customer cancellation wrapper. Atomically cancels any active online payment/handoff after inventory release so later provider callbacks cannot resurrect the order.';

REVOKE EXECUTE ON FUNCTION public.cancel_online_order_v2(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_online_order_v2(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_online_order_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_online_order_v2(uuid) TO service_role;
