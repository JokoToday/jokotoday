-- JOKO TODAY shared PromptPay payment foundation v1
-- Additive backend foundation. Online PromptPay remains disabled until the
-- customer checkout/payment UI and production receiver configuration are ready.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_due_at timestamptz;

CREATE TABLE IF NOT EXISTS public.payment_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  online_promptpay_enabled boolean NOT NULL DEFAULT false,
  allow_pay_at_pickup boolean NOT NULL DEFAULT true,
  payment_grace_minutes integer NOT NULL DEFAULT 15
    CHECK (payment_grace_minutes BETWEEN 0 AND 1440),
  verification_provider text NOT NULL DEFAULT 'easyslip'
    CHECK (verification_provider IN ('easyslip')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

INSERT INTO public.payment_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  context_type text NOT NULL CHECK (context_type IN ('regular_order')),
  context_id uuid NOT NULL,
  payment_method text NOT NULL CHECK (
    payment_method IN ('promptpay_online', 'cash_at_pickup', 'promptpay_at_pickup')
  ),
  status text NOT NULL DEFAULT 'unpaid' CHECK (
    status IN (
      'unpaid',
      'awaiting_slip',
      'slip_uploaded',
      'verifying',
      'paid',
      'failed',
      'exception',
      'expired',
      'refund_pending',
      'refunded'
    )
  ),
  expected_amount numeric(10,2) NOT NULL CHECK (expected_amount >= 0),
  verified_amount numeric(10,2) CHECK (verified_amount >= 0),
  currency text NOT NULL DEFAULT 'THB' CHECK (currency = 'THB'),
  verification_provider text,
  provider_transaction_ref text,
  payment_due_at timestamptz,
  paid_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (context_type, context_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_ref_unique
  ON public.payment_transactions (provider_transaction_ref)
  WHERE provider_transaction_ref IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_transactions_customer_created_idx
  ON public.payment_transactions (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_transactions_status_due_idx
  ON public.payment_transactions (status, payment_due_at)
  WHERE payment_due_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_slip_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id uuid NOT NULL
    REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('easyslip')),
  provider_request_id text,
  provider_transaction_ref text,
  expected_amount numeric(10,2) NOT NULL CHECK (expected_amount >= 0),
  verified_amount numeric(10,2) CHECK (verified_amount >= 0),
  receiver_matched boolean,
  amount_matched boolean,
  duplicate_detected boolean,
  transaction_at timestamptz,
  verification_status text NOT NULL DEFAULT 'uploaded' CHECK (
    verification_status IN (
      'uploaded',
      'verifying',
      'pending',
      'verified',
      'rejected',
      'error',
      'finalized'
    )
  ),
  error_code text,
  error_message text,
  storage_path text,
  provider_data jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_slip_verifications_transaction_idx
  ON public.payment_slip_verifications (payment_transaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_slip_verifications_status_idx
  ON public.payment_slip_verifications (verification_status, created_at DESC);

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_slip_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read payment settings" ON public.payment_settings;
CREATE POLICY "Authenticated users can read payment settings"
  ON public.payment_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Customers can read own payment transactions" ON public.payment_transactions;
CREATE POLICY "Customers can read own payment transactions"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (customer_id = auth.uid());

DROP POLICY IF EXISTS "Staff can read payment transactions" ON public.payment_transactions;
CREATE POLICY "Staff can read payment transactions"
  ON public.payment_transactions
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

DROP POLICY IF EXISTS "Customers can read own payment verifications" ON public.payment_slip_verifications;
CREATE POLICY "Customers can read own payment verifications"
  ON public.payment_slip_verifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.payment_transactions pt
      WHERE pt.id = payment_transaction_id
        AND pt.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff can read payment verifications" ON public.payment_slip_verifications;
CREATE POLICY "Staff can read payment verifications"
  ON public.payment_slip_verifications
  FOR SELECT
  TO authenticated
  USING (public.is_staff_or_admin());

REVOKE INSERT, UPDATE, DELETE ON public.payment_settings FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.payment_slip_verifications FROM anon, authenticated;
GRANT SELECT ON public.payment_settings TO authenticated;
GRANT SELECT ON public.payment_transactions TO authenticated;
GRANT SELECT ON public.payment_slip_verifications TO authenticated;

-- Private bucket. Uploads are performed by the protected Edge Function using
-- the service role; there are intentionally no direct browser object policies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-slips',
  'payment-slips',
  false,
  4194304,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.begin_promptpay_payment_v1(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_date public.pickup_dates%ROWTYPE;
  v_settings public.payment_settings%ROWTYPE;
  v_payment public.payment_transactions%ROWTYPE;
  v_amount_due numeric(10,2);
  v_due_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'Order id is required';
  END IF;

  SELECT * INTO v_settings
  FROM public.payment_settings
  WHERE id = true
  FOR SHARE;

  IF NOT FOUND OR NOT v_settings.online_promptpay_enabled THEN
    RAISE EXCEPTION 'Online PromptPay is not currently available';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'You may only pay for your own order' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(v_order.purchase_type, 'online') <> 'online' THEN
    RAISE EXCEPTION 'Online PromptPay requires an online order';
  END IF;
  IF v_order.status = 'cancelled' OR v_order.picked_up_at IS NOT NULL THEN
    RAISE EXCEPTION 'This order can no longer accept online payment';
  END IF;

  v_amount_due := round(v_order.total_amount - COALESCE(v_order.loyalty_discount_amount, 0), 2);
  IF v_amount_due < 0 THEN
    RAISE EXCEPTION 'Order payment amount is invalid';
  END IF;

  IF COALESCE(v_order.payment_status, 'unpaid') = 'paid' THEN
    SELECT * INTO v_payment
    FROM public.payment_transactions
    WHERE context_type = 'regular_order'
      AND context_id = v_order.id;

    RETURN jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'payment_status', 'paid',
      'amount_due', v_amount_due,
      'payment_transaction', CASE WHEN v_payment.id IS NULL THEN NULL ELSE to_jsonb(v_payment) END
    );
  END IF;

  IF v_order.pickup_date_id IS NULL THEN
    RAISE EXCEPTION 'Online PromptPay requires a Pickup v2 order';
  END IF;

  SELECT * INTO v_date
  FROM public.pickup_dates
  WHERE id = v_order.pickup_date_id
  FOR SHARE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order pickup date not found'; END IF;

  v_due_at := v_date.order_cutoff_at
    + make_interval(mins => v_settings.payment_grace_minutes);

  IF now() >= v_due_at THEN
    RAISE EXCEPTION 'The payment deadline for this order has passed';
  END IF;

  SELECT * INTO v_payment
  FROM public.payment_transactions
  WHERE context_type = 'regular_order'
    AND context_id = v_order.id
  FOR UPDATE;

  IF FOUND THEN
    IF v_payment.customer_id IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION 'Payment ownership conflict' USING ERRCODE = '42501';
    END IF;
    IF v_payment.status IN ('paid', 'refund_pending', 'refunded') THEN
      RETURN jsonb_build_object(
        'order_id', v_order.id,
        'order_number', v_order.order_number,
        'payment_status', v_payment.status,
        'amount_due', v_amount_due,
        'payment_transaction', to_jsonb(v_payment)
      );
    END IF;

    UPDATE public.payment_transactions
    SET payment_method = 'promptpay_online',
        status = CASE
          WHEN status IN ('verifying', 'slip_uploaded') THEN status
          ELSE 'awaiting_slip'
        END,
        expected_amount = v_amount_due,
        verification_provider = v_settings.verification_provider,
        payment_due_at = v_due_at,
        last_error_code = NULL,
        last_error_message = NULL,
        updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
  ELSE
    INSERT INTO public.payment_transactions (
      customer_id,
      context_type,
      context_id,
      payment_method,
      status,
      expected_amount,
      currency,
      verification_provider,
      payment_due_at
    ) VALUES (
      v_user_id,
      'regular_order',
      v_order.id,
      'promptpay_online',
      'awaiting_slip',
      v_amount_due,
      'THB',
      v_settings.verification_provider,
      v_due_at
    )
    RETURNING * INTO v_payment;
  END IF;

  UPDATE public.orders
  SET payment_method = 'promptpay_online',
      payment_due_at = v_due_at,
      updated_at = now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'amount_due', v_amount_due,
    'payment_due_at', v_due_at,
    'payment_transaction', to_jsonb(v_payment)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_promptpay_payment_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_promptpay_payment_v1(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_verified_payment_v1(
  p_payment_transaction_id uuid,
  p_verification_id uuid,
  p_provider_transaction_ref text,
  p_verified_amount numeric,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_payment public.payment_transactions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_verification public.payment_slip_verifications%ROWTYPE;
  v_redemption public.loyalty_redemptions%ROWTYPE;
  v_amount_due numeric(10,2);
  v_ref text := NULLIF(btrim(COALESCE(p_provider_transaction_ref, '')), '');
  v_paid_at timestamptz := COALESCE(p_paid_at, now());
BEGIN
  IF p_payment_transaction_id IS NULL THEN
    RAISE EXCEPTION 'Payment transaction id is required';
  END IF;
  IF v_ref IS NULL THEN
    RAISE EXCEPTION 'Verified banking transaction reference is required';
  END IF;
  IF p_verified_amount IS NULL OR p_verified_amount < 0 THEN
    RAISE EXCEPTION 'Verified amount is invalid';
  END IF;

  SELECT * INTO v_payment
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payment transaction not found'; END IF;

  IF v_payment.status = 'paid' THEN
    IF v_payment.provider_transaction_ref IS DISTINCT FROM v_ref
       OR v_payment.verified_amount IS DISTINCT FROM round(p_verified_amount, 2) THEN
      RAISE EXCEPTION 'Payment is already finalized with different banking data';
    END IF;

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = v_payment.context_id;

    RETURN jsonb_build_object(
      'payment_transaction', to_jsonb(v_payment),
      'order', CASE WHEN v_order.id IS NULL THEN NULL ELSE to_jsonb(v_order) END,
      'idempotent_replay', true
    );
  END IF;

  IF v_payment.status IN ('refund_pending', 'refunded', 'expired') THEN
    RAISE EXCEPTION 'Payment transaction can no longer be finalized';
  END IF;
  IF v_payment.context_type <> 'regular_order' THEN
    RAISE EXCEPTION 'Unsupported payment context';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_payment.context_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_payment.customer_id THEN
    RAISE EXCEPTION 'Payment/order ownership mismatch';
  END IF;
  IF v_order.status = 'cancelled' OR v_order.picked_up_at IS NOT NULL THEN
    RAISE EXCEPTION 'Order can no longer accept payment';
  END IF;
  IF v_payment.payment_due_at IS NOT NULL AND now() > v_payment.payment_due_at THEN
    RAISE EXCEPTION 'Payment deadline has passed';
  END IF;

  v_amount_due := round(v_order.total_amount - COALESCE(v_order.loyalty_discount_amount, 0), 2);

  IF v_payment.expected_amount IS DISTINCT FROM v_amount_due THEN
    RAISE EXCEPTION 'Stored expected amount no longer matches the order';
  END IF;
  IF round(p_verified_amount, 2) IS DISTINCT FROM v_amount_due THEN
    RAISE EXCEPTION 'Verified amount does not match the order amount due';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.payment_transactions pt
    WHERE pt.provider_transaction_ref = v_ref
      AND pt.id <> v_payment.id
  ) THEN
    RAISE EXCEPTION 'This banking transaction has already been used';
  END IF;

  IF p_verification_id IS NOT NULL THEN
    SELECT * INTO v_verification
    FROM public.payment_slip_verifications
    WHERE id = p_verification_id
      AND payment_transaction_id = v_payment.id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Payment verification attempt not found'; END IF;
    IF COALESCE(v_verification.receiver_matched, false) = false
       OR COALESCE(v_verification.amount_matched, false) = false
       OR COALESCE(v_verification.duplicate_detected, false) = true
       OR v_verification.verification_status NOT IN ('verified', 'finalized') THEN
      RAISE EXCEPTION 'Verification attempt is not eligible for payment finalization';
    END IF;
  END IF;

  IF COALESCE(v_order.loyalty_discount_amount, 0) > 0 THEN
    SELECT * INTO v_redemption
    FROM public.loyalty_redemptions r
    WHERE r.order_id = v_order.id
      AND r.status = 'reserved'
      AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
    ORDER BY r.created_at, r.id
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Discounted order is missing its reserved loyalty redemption';
    END IF;
  END IF;

  UPDATE public.payment_transactions
  SET status = 'paid',
      verified_amount = v_amount_due,
      provider_transaction_ref = v_ref,
      paid_at = v_paid_at,
      last_error_code = NULL,
      last_error_message = NULL,
      updated_at = now()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  IF p_verification_id IS NOT NULL THEN
    UPDATE public.payment_slip_verifications
    SET verification_status = 'finalized',
        provider_transaction_ref = v_ref,
        verified_amount = v_amount_due,
        verified_at = COALESCE(verified_at, now()),
        updated_at = now()
    WHERE id = p_verification_id;
  END IF;

  UPDATE public.orders
  SET payment_method = 'promptpay_online',
      payment_status = 'paid',
      amount_paid = v_amount_due,
      status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
      updated_at = now()
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  IF v_redemption.id IS NOT NULL THEN
    UPDATE public.loyalty_redemptions
    SET status = 'redeemed'
    WHERE id = v_redemption.id;
  END IF;

  RETURN jsonb_build_object(
    'payment_transaction', to_jsonb(v_payment),
    'order', to_jsonb(v_order),
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_verified_payment_v1(uuid, uuid, text, numeric, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_verified_payment_v1(uuid, uuid, text, numeric, timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_update_payment_settings_v1(
  p_online_promptpay_enabled boolean,
  p_allow_pay_at_pickup boolean,
  p_payment_grace_minutes integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_settings public.payment_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND up.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF p_payment_grace_minutes IS NULL
     OR p_payment_grace_minutes < 0
     OR p_payment_grace_minutes > 1440 THEN
    RAISE EXCEPTION 'Payment grace must be between 0 and 1440 minutes';
  END IF;

  UPDATE public.payment_settings
  SET online_promptpay_enabled = COALESCE(p_online_promptpay_enabled, false),
      allow_pay_at_pickup = COALESCE(p_allow_pay_at_pickup, true),
      payment_grace_minutes = p_payment_grace_minutes,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = true
  RETURNING * INTO v_settings;

  RETURN to_jsonb(v_settings);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_payment_settings_v1(boolean, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_payment_settings_v1(boolean, boolean, integer) TO authenticated;

-- Paid online PromptPay orders must be valid at the Pickup Desk.
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
  IF NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;

  SELECT o.customer_id INTO v_customer_id
  FROM public.orders o
  WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_customer_id IS NOT NULL THEN
    PERFORM 1 FROM public.customers c WHERE c.id = v_customer_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.customer_id IS DISTINCT FROM v_customer_id THEN
    RAISE EXCEPTION 'Order customer changed while confirming pickup; retry';
  END IF;
  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be picked up';
  END IF;
  IF COALESCE(v_order.payment_status, 'unpaid') <> 'paid' THEN
    RAISE EXCEPTION 'Payment must be recorded before pickup';
  END IF;
  IF v_order.payment_method IS NULL
     OR v_order.payment_method NOT IN ('cash', 'qr_code', 'qr', 'promptpay_online') THEN
    RAISE EXCEPTION 'Valid payment method must be recorded before pickup';
  END IF;

  IF COALESCE(v_order.loyalty_discount_amount, 0) > 0 THEN
    IF v_order.amount_paid IS DISTINCT FROM round(v_order.total_amount - v_order.loyalty_discount_amount, 2) THEN
      RAISE EXCEPTION 'Discounted order payment amount is inconsistent';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM public.loyalty_redemptions r
      WHERE r.order_id = v_order.id
        AND r.status = 'reserved'
        AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
    ) THEN
      RAISE EXCEPTION 'Loyalty reward must be consumed by the payment flow before pickup';
    END IF;
  END IF;

  IF v_order.status NOT IN ('picked_up', 'completed') THEN
    UPDATE public.orders
    SET status = 'picked_up',
        picked_up_at = COALESCE(picked_up_at, now()),
        staff_id = COALESCE(staff_id, auth.uid())
    WHERE id = p_order_id
    RETURNING * INTO v_order;
  END IF;

  IF v_order.customer_id IS NOT NULL
     AND COALESCE(v_order.loyalty_points_earned, 0) > 0
     AND v_order.loyalty_points_awarded_at IS NULL THEN
    SELECT e.created_at INTO v_existing_earn_at
    FROM public.loyalty_point_events e
    WHERE e.order_id = v_order.id
      AND e.event_type = 'earn'
    LIMIT 1;

    IF v_existing_earn_at IS NULL THEN
      PERFORM public.apply_loyalty_points_delta_v2(
        v_order.customer_id,
        v_order.loyalty_points_earned,
        'earn',
        v_order.id,
        NULL,
        auth.uid(),
        'Points awarded at pickup/completion',
        jsonb_build_object(
          'purchase_type', COALESCE(v_order.purchase_type, 'online'),
          'loyalty_rate', v_order.loyalty_multiplier,
          'gross_amount', v_order.total_amount,
          'loyalty_discount_amount', COALESCE(v_order.loyalty_discount_amount, 0),
          'amount_paid', v_order.amount_paid
        )
      );
      v_existing_earn_at := now();
    END IF;

    UPDATE public.orders
    SET loyalty_points_awarded_at = COALESCE(v_existing_earn_at, now())
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  RETURN NEXT v_order;
END;
$$;
