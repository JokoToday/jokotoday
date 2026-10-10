-- JOKO TODAY Pickup Handover v1
-- Paid online orders are handed over by staff, then completed by a short-lived
-- customer receipt-confirmation QR. Only token hashes are persisted.

CREATE TABLE IF NOT EXISTS public.pickup_handover_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','confirmed','bypassed','expired','cancelled')),
  expires_at timestamptz NOT NULL,
  customer_confirmed_at timestamptz,
  completed_at timestamptz,
  bypass_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pickup_handover_sessions_order_idx
  ON public.pickup_handover_sessions(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pickup_handover_sessions_staff_idx
  ON public.pickup_handover_sessions(staff_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS pickup_handover_sessions_one_active_per_order
  ON public.pickup_handover_sessions(order_id)
  WHERE status = 'active';

ALTER TABLE public.pickup_handover_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pickup_handover_sessions FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.pickup_handover_sessions IS
'Short-lived pickup handover sessions. Staff initiates handover; customer receipt confirmation or an audited staff bypass completes pickup. Plain bearer tokens are never stored.';

CREATE OR REPLACE FUNCTION public.finalize_pickup_handover_v1(
  p_handoff_id uuid,
  p_bypass_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $pickup$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_handoff public.pickup_handover_sessions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_customer_id uuid;
  v_existing_earn_at timestamptz;
  v_bypass_reason text := NULLIF(btrim(COALESCE(p_bypass_reason, '')), '');
BEGIN
  IF v_role <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_handoff_id IS NULL THEN
    RAISE EXCEPTION 'Handover id is required';
  END IF;

  SELECT * INTO v_handoff
  FROM public.pickup_handover_sessions
  WHERE id = p_handoff_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pickup handover not found';
  END IF;

  IF v_handoff.status IN ('confirmed','bypassed') THEN
    SELECT * INTO v_order FROM public.orders WHERE id = v_handoff.order_id;
    RETURN jsonb_build_object(
      'handover', to_jsonb(v_handoff),
      'order', to_jsonb(v_order),
      'idempotent_replay', true
    );
  END IF;

  IF v_handoff.status <> 'active' THEN
    RAISE EXCEPTION 'Pickup handover is no longer active';
  END IF;

  IF now() >= v_handoff.expires_at THEN
    UPDATE public.pickup_handover_sessions
    SET status = 'expired', updated_at = now()
    WHERE id = v_handoff.id;
    RAISE EXCEPTION 'Pickup handover has expired';
  END IF;

  SELECT o.customer_id INTO v_customer_id
  FROM public.orders o
  WHERE o.id = v_handoff.order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_customer_id IS NOT NULL THEN
    PERFORM 1
    FROM public.customers c
    WHERE c.id = v_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Customer record not found';
    END IF;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_handoff.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.customer_id IS DISTINCT FROM v_customer_id THEN
    RAISE EXCEPTION 'Order customer changed while confirming pickup; retry';
  END IF;

  IF v_order.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be picked up';
  END IF;

  IF COALESCE(v_order.payment_status, 'unpaid') <> 'paid' THEN
    RAISE EXCEPTION 'Payment must be verified before pickup';
  END IF;

  IF v_order.payment_method IS NULL
     OR v_order.payment_method NOT IN ('cash','qr_code','qr','promptpay_online') THEN
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
        AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount','percentage_discount')
    ) THEN
      RAISE EXCEPTION 'Loyalty reward must be consumed by the payment flow before pickup';
    END IF;
  END IF;

  IF v_order.status NOT IN ('picked_up','completed') THEN
    UPDATE public.orders
    SET status = 'picked_up',
        picked_up_at = COALESCE(picked_up_at, now()),
        staff_id = COALESCE(staff_id, v_handoff.staff_id),
        updated_at = now()
    WHERE id = v_order.id
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
        v_handoff.staff_id,
        'Points awarded at pickup/completion',
        jsonb_build_object(
          'purchase_type', COALESCE(v_order.purchase_type, 'online'),
          'loyalty_rate', v_order.loyalty_multiplier,
          'gross_amount', v_order.total_amount,
          'loyalty_discount_amount', COALESCE(v_order.loyalty_discount_amount, 0),
          'amount_paid', v_order.amount_paid,
          'pickup_handover_id', v_handoff.id,
          'customer_receipt_confirmed', v_bypass_reason IS NULL
        )
      );
      v_existing_earn_at := now();
    END IF;

    UPDATE public.orders
    SET loyalty_points_awarded_at = COALESCE(v_existing_earn_at, now())
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  UPDATE public.pickup_handover_sessions
  SET status = CASE WHEN v_bypass_reason IS NULL THEN 'confirmed' ELSE 'bypassed' END,
      customer_confirmed_at = CASE WHEN v_bypass_reason IS NULL THEN now() ELSE customer_confirmed_at END,
      completed_at = now(),
      bypass_reason = v_bypass_reason,
      updated_at = now()
  WHERE id = v_handoff.id
  RETURNING * INTO v_handoff;

  RETURN jsonb_build_object(
    'handover', to_jsonb(v_handoff),
    'order', to_jsonb(v_order),
    'idempotent_replay', false
  );
END;
$pickup$;

REVOKE ALL ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_pickup_handover_v1(uuid,text) TO service_role;
