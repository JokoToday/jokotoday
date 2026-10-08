-- JOKO TODAY payment rail v1
-- Direct PromptPay + EasySlip automated verification foundation.
-- Customer-facing activation remains disabled by default in payment_settings.

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
