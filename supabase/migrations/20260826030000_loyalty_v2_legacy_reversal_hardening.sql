/*
  JOKO TODAY — Loyalty v2 legacy reversal hardening

  Grandfathered orders were credited by the legacy insert-time trigger before
  Loyalty v2 existed. A customer may have spent some or all of those already-
  issued points before cancelling an otherwise eligible unpaid order.

  Cancellation must remain possible without making the cached balance negative.
  For those legacy-only reversals, recover the still-available points and record
  any already-spent shortfall explicitly in immutable event metadata. All
  non-legacy negative deltas remain strict and continue to fail on insufficient
  balance.
*/

ALTER TABLE public.loyalty_point_events
  DROP CONSTRAINT IF EXISTS loyalty_point_events_delta_nonzero;

ALTER TABLE public.loyalty_point_events
  ADD CONSTRAINT loyalty_point_events_delta_nonzero
  CHECK (
    points_delta <> 0
    OR (
      event_type = 'reverse_earn'
      AND metadata ->> 'legacy_grandfathered' = 'true'
      AND metadata ->> 'applied_reversal_points' = '0'
      AND COALESCE(metadata ->> 'legacy_spent_shortfall', '') ~ '^[1-9][0-9]*$'
    )
  );

CREATE OR REPLACE FUNCTION public.apply_loyalty_points_delta_v2(
  p_customer_id uuid,
  p_points_delta integer,
  p_event_type text,
  p_order_id uuid DEFAULT NULL,
  p_redemption_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_new_balance integer;
  v_effective_delta integer;
  v_event_metadata jsonb;
  v_requested_reversal integer;
  v_applied_reversal integer;
  v_shortfall integer;
  v_is_legacy_grandfathered boolean := false;
BEGIN
  IF p_customer_id IS NULL THEN RAISE EXCEPTION 'Customer is required'; END IF;
  IF p_points_delta IS NULL OR p_points_delta = 0 THEN RAISE EXCEPTION 'Points delta must be non-zero'; END IF;
  IF p_event_type NOT IN (
    'migration_opening_balance', 'earn', 'redeem', 'reverse_earn', 'refund_redemption', 'admin_adjustment'
  ) THEN
    RAISE EXCEPTION 'Invalid loyalty event type';
  END IF;
  IF p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'Loyalty event metadata must be an object';
  END IF;

  SELECT COALESCE(c.loyalty_points, 0)
  INTO v_balance
  FROM public.customers c
  WHERE c.id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  v_effective_delta := p_points_delta;
  v_event_metadata := p_metadata;
  v_new_balance := v_balance + v_effective_delta;

  IF v_new_balance < 0 THEN
    IF p_event_type = 'reverse_earn'
       AND p_points_delta < 0
       AND p_order_id IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.orders o
         WHERE o.id = p_order_id
           AND o.customer_id = p_customer_id
           AND o.loyalty_points_awarded_at IS NOT NULL
       )
       AND NOT EXISTS (
         SELECT 1
         FROM public.loyalty_point_events e
         WHERE e.order_id = p_order_id
           AND e.event_type = 'earn'
       ) THEN
      v_is_legacy_grandfathered := true;
      v_requested_reversal := abs(p_points_delta);
      v_applied_reversal := LEAST(v_balance, v_requested_reversal);
      v_shortfall := v_requested_reversal - v_applied_reversal;
      v_effective_delta := -v_applied_reversal;
      v_new_balance := v_balance + v_effective_delta;
      v_event_metadata := v_event_metadata || jsonb_build_object(
        'legacy_grandfathered', true,
        'requested_reversal_points', v_requested_reversal,
        'applied_reversal_points', v_applied_reversal,
        'legacy_spent_shortfall', v_shortfall
      );
    ELSE
      RAISE EXCEPTION 'Insufficient loyalty points';
    END IF;
  END IF;

  IF v_is_legacy_grandfathered AND v_shortfall <= 0 THEN
    RAISE EXCEPTION 'Legacy shortfall handling requires a positive shortfall';
  END IF;

  IF v_effective_delta <> 0 THEN
    UPDATE public.customers
    SET loyalty_points = v_new_balance
    WHERE id = p_customer_id;
  END IF;

  INSERT INTO public.loyalty_point_events (
    customer_id, order_id, redemption_id, event_type,
    points_delta, balance_after, actor_id, reason, metadata
  ) VALUES (
    p_customer_id, p_order_id, p_redemption_id, p_event_type,
    v_effective_delta, v_new_balance, p_actor_id,
    NULLIF(btrim(COALESCE(p_reason, '')), ''), v_event_metadata
  );

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_loyalty_points_delta_v2(uuid, integer, text, uuid, uuid, uuid, text, jsonb)
FROM PUBLIC, anon, authenticated;
