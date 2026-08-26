/*
  JOKO TODAY — Loyalty v2 pickup payment guard

  Staff pickup/completion must not consume inventory / award loyalty points before
  payment is actually recorded. This becomes especially important once a monetary
  reward may be reserved on an unpaid order.
*/

CREATE OR REPLACE FUNCTION public.confirm_order_pickup(p_order_id uuid)
RETURNS SETOF public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_customer_id uuid;
  v_existing_earn_at timestamptz;
BEGIN
  IF NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;

  -- Canonical lock order: customer -> order. This matches payment,
  -- cancellation and redemption paths.
  SELECT o.customer_id
  INTO v_customer_id
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_customer_id IS NOT NULL THEN
    PERFORM 1
    FROM public.customers c
    WHERE c.id = v_customer_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
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

  -- Server-side payment gate. The staff UI already requires payment, but the RPC
  -- must independently enforce it so stale/direct callers cannot pick up an
  -- unpaid order or consume a reserved monetary reward accidentally.
  IF COALESCE(v_order.payment_status, 'unpaid') <> 'paid' THEN
    RAISE EXCEPTION 'Payment must be recorded before pickup';
  END IF;

  -- A paid flag alone is not sufficient: stale/direct staff clients may still
  -- have column-level UPDATE access to payment fields. Require the same valid
  -- payment methods accepted by the staff UI, including legacy `qr` rows.
  IF v_order.payment_method IS NULL
     OR v_order.payment_method NOT IN ('cash', 'qr_code', 'qr') THEN
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

  -- If a row is already picked_up/completed but lacks an award marker (for
  -- example after an interrupted/manual legacy transition), reconcile the
  -- loyalty award idempotently instead of returning before it can be repaired.
  IF v_order.status NOT IN ('picked_up', 'completed') THEN
    UPDATE public.orders
    SET
      status = 'picked_up',
      picked_up_at = COALESCE(picked_up_at, now()),
      staff_id = COALESCE(staff_id, auth.uid())
    WHERE id = p_order_id
    RETURNING * INTO v_order;
  END IF;

  IF v_order.customer_id IS NOT NULL
     AND COALESCE(v_order.loyalty_points_earned, 0) > 0
     AND v_order.loyalty_points_awarded_at IS NULL THEN

    SELECT e.created_at
    INTO v_existing_earn_at
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

REVOKE ALL ON FUNCTION public.confirm_order_pickup(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_order_pickup(uuid) TO authenticated;