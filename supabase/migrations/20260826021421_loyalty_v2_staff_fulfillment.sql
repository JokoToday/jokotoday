/*
  JOKO TODAY — Loyalty / Rewards v2 staff fulfillment

  Depends on the Loyalty v2 foundation and earning lifecycle migrations.

  This migration makes staff redemption operational rather than ledger-only:
  - preserves orders.total_amount as the gross commercial amount;
  - stores loyalty discount and actual amount paid separately;
  - reserves pickup monetary rewards until payment is actually recorded;
  - refunds an unused reserved pickup reward on customer cancellation;
  - applies walk-in rewards atomically with the paid sale;
  - earns points on the actual net amount paid;
  - keeps free_product staff fulfillment dark until inventory-aware fulfillment exists.

  No customer self-service reward redemption is enabled here.
*/

-- -----------------------------------------------------------------------------
-- Order commercial/payment fields and idempotency key
-- -----------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_discount_amount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10, 2),
  ADD COLUMN IF NOT EXISTS staff_request_key uuid;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_loyalty_discount_nonnegative
    CHECK (loyalty_discount_amount >= 0),
  ADD CONSTRAINT orders_loyalty_discount_not_above_gross
    CHECK (loyalty_discount_amount <= total_amount),
  ADD CONSTRAINT orders_amount_paid_nonnegative
    CHECK (amount_paid IS NULL OR amount_paid >= 0),
  ADD CONSTRAINT orders_amount_paid_not_above_gross
    CHECK (amount_paid IS NULL OR amount_paid <= total_amount),
  ADD CONSTRAINT orders_unpaid_has_no_amount_paid
    CHECK (payment_status <> 'unpaid' OR amount_paid IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS orders_staff_request_key_uq
  ON public.orders (staff_request_key)
  WHERE staff_request_key IS NOT NULL;

-- One active monetary reward may affect an order at a time. The immutable reward
-- snapshot makes this race-safe without depending on mutable catalogue rows.
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_redemptions_one_active_monetary_per_order_uq
  ON public.loyalty_redemptions (order_id)
  WHERE order_id IS NOT NULL
    AND status <> 'reversed'
    AND (reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount');

-- Client roles must not be able to write the server-controlled commercial fields
-- directly. SECURITY DEFINER staff RPCs run as their owner and are unaffected.
CREATE OR REPLACE FUNCTION public.guard_order_loyalty_payment_fields_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND (
       NEW.loyalty_discount_amount IS DISTINCT FROM OLD.loyalty_discount_amount
       OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
       OR NEW.staff_request_key IS DISTINCT FROM OLD.staff_request_key
     ) THEN
    RAISE EXCEPTION 'Loyalty discount and paid amount are server-controlled' USING ERRCODE = '42501';
  END IF;

  -- A discounted order cannot be marked paid without persisting the exact net
  -- amount in the same statement. This blocks stale staff clients from silently
  -- charging/recording the gross amount after a reward has been reserved.
  IF NEW.payment_status = 'paid'
     AND OLD.payment_status IS DISTINCT FROM 'paid'
     AND COALESCE(NEW.loyalty_discount_amount, 0) > 0
     AND NEW.amount_paid IS DISTINCT FROM round(NEW.total_amount - NEW.loyalty_discount_amount, 2) THEN
    RAISE EXCEPTION 'Discounted orders must record the net amount paid through the staff payment flow';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_order_loyalty_payment_fields_v2() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_order_loyalty_payment_fields_v2 ON public.orders;
CREATE TRIGGER guard_order_loyalty_payment_fields_v2
BEFORE UPDATE OF loyalty_discount_amount, amount_paid, staff_request_key, payment_status
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.guard_order_loyalty_payment_fields_v2();

-- -----------------------------------------------------------------------------
-- Internal refund helper for an unused pickup monetary reward.
-- Caller must already own the canonical customer -> order locks (the existing
-- cancellation functions do). This helper remains dark to all client roles.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refund_reserved_order_loyalty_reward_v2(
  p_order_id uuid,
  p_actor_id uuid,
  p_reason text DEFAULT 'Order cancelled before reward was consumed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_redemption public.loyalty_redemptions%ROWTYPE;
BEGIN
  IF p_order_id IS NULL THEN RETURN; END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  IF COALESCE(v_order.payment_status, 'unpaid') <> 'unpaid' OR v_order.picked_up_at IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_redemption
  FROM public.loyalty_redemptions r
  WHERE r.order_id = p_order_id
    AND r.status = 'reserved'
    AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
  ORDER BY r.created_at, r.id
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    IF COALESCE(v_order.loyalty_discount_amount, 0) <> 0 THEN
      RAISE EXCEPTION 'Order has a loyalty discount without a reserved monetary redemption';
    END IF;
    RETURN;
  END IF;

  UPDATE public.loyalty_redemptions
  SET
    status = 'reversed',
    reversed_at = now(),
    reversal_reason = COALESCE(NULLIF(btrim(p_reason), ''), 'Order cancelled before reward was consumed')
  WHERE id = v_redemption.id;

  PERFORM public.apply_loyalty_points_delta_v2(
    v_redemption.customer_id,
    v_redemption.points_spent,
    'refund_redemption',
    p_order_id,
    v_redemption.id,
    p_actor_id,
    COALESCE(NULLIF(btrim(p_reason), ''), 'Order cancelled before reward was consumed'),
    jsonb_build_object(
      'reward_id', v_redemption.reward_id,
      'reward_key', v_redemption.reward_snapshot ->> 'reward_key',
      'channel', v_redemption.channel,
      'reason', 'unused_pickup_monetary_reward'
    )
  );

  UPDATE public.orders
  SET
    loyalty_discount_amount = 0,
    amount_paid = NULL,
    updated_at = now()
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_reserved_order_loyalty_reward_v2(uuid, uuid, text)
FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Staff pickup reward application.
-- Monetary rewards become RESERVED until staff records payment. Non-monetary
-- free_item/custom rewards are treated as immediately staff-fulfilled.
-- Walk-in redemption is intentionally rejected here and handled atomically by
-- record_walk_in_purchase_v2 below.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_redeem_loyalty_reward_v2(
  p_customer_id uuid,
  p_reward_id uuid,
  p_channel text,
  p_order_id uuid,
  p_context_amount numeric,
  p_request_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_customer public.customers%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_reward public.loyalty_rewards%ROWTYPE;
  v_existing public.loyalty_redemptions%ROWTYPE;
  v_existing_monetary public.loyalty_redemptions%ROWTYPE;
  v_context_amount numeric(10, 2);
  v_discount_amount numeric(10, 2) := 0;
  v_net_due numeric(10, 2);
  v_rate numeric;
  v_points_earned integer;
  v_customer_redemptions integer;
  v_total_redemptions integer;
  v_redemption_id uuid;
  v_new_balance integer;
  v_snapshot jsonb;
  v_status text;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_customer_id IS NULL OR p_reward_id IS NULL OR p_request_key IS NULL THEN
    RAISE EXCEPTION 'Customer, reward, and request key are required';
  END IF;
  IF p_channel <> 'pickup' THEN
    RAISE EXCEPTION 'Walk-in rewards must be applied atomically when the sale is recorded';
  END IF;

  -- Fast idempotency path.
  SELECT * INTO v_existing
  FROM public.loyalty_redemptions
  WHERE request_key = p_request_key;
  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM p_customer_id
       OR v_existing.reward_id IS DISTINCT FROM p_reward_id
       OR v_existing.channel IS DISTINCT FROM 'pickup'
       OR v_existing.order_id IS DISTINCT FROM p_order_id THEN
      RAISE EXCEPTION 'Redemption request key conflicts with another request';
    END IF;
    IF v_existing.status = 'reversed' THEN
      RAISE EXCEPTION 'This redemption was reversed and cannot be replayed';
    END IF;
    SELECT COALESCE(c.loyalty_points, 0) INTO v_new_balance
    FROM public.customers c WHERE c.id = p_customer_id;
    RETURN jsonb_build_object(
      'redemption_id', v_existing.id,
      'reward_id', v_existing.reward_id,
      'reward_key', v_existing.reward_snapshot ->> 'reward_key',
      'reward_type', v_existing.reward_snapshot ->> 'reward_type',
      'reward_name_en', v_existing.reward_snapshot ->> 'name_en',
      'reward_name_th', v_existing.reward_snapshot ->> 'name_th',
      'points_spent', v_existing.points_spent,
      'new_balance', v_new_balance,
      'channel', v_existing.channel,
      'order_id', v_existing.order_id,
      'context_amount', NULLIF(v_existing.reward_snapshot ->> 'context_amount', '')::numeric,
      'discount_amount', COALESCE(NULLIF(v_existing.reward_snapshot ->> 'discount_amount', '')::numeric, 0),
      'net_due', NULLIF(v_existing.reward_snapshot ->> 'net_due', '')::numeric,
      'redemption_status', v_existing.status,
      'request_key', p_request_key,
      'idempotent_replay', true
    );
  END IF;

  -- Canonical lock order: customer -> order -> reward.
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  -- Re-check request key after waiting for the customer lock.
  SELECT * INTO v_existing
  FROM public.loyalty_redemptions
  WHERE request_key = p_request_key;
  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM p_customer_id
       OR v_existing.reward_id IS DISTINCT FROM p_reward_id
       OR v_existing.channel IS DISTINCT FROM 'pickup'
       OR v_existing.order_id IS DISTINCT FROM p_order_id THEN
      RAISE EXCEPTION 'Redemption request key conflicts with another request';
    END IF;
    IF v_existing.status = 'reversed' THEN
      RAISE EXCEPTION 'This redemption was reversed and cannot be replayed';
    END IF;
    RETURN jsonb_build_object(
      'redemption_id', v_existing.id,
      'reward_id', v_existing.reward_id,
      'reward_key', v_existing.reward_snapshot ->> 'reward_key',
      'reward_type', v_existing.reward_snapshot ->> 'reward_type',
      'reward_name_en', v_existing.reward_snapshot ->> 'name_en',
      'reward_name_th', v_existing.reward_snapshot ->> 'name_th',
      'points_spent', v_existing.points_spent,
      'new_balance', COALESCE(v_customer.loyalty_points, 0),
      'channel', v_existing.channel,
      'order_id', v_existing.order_id,
      'context_amount', NULLIF(v_existing.reward_snapshot ->> 'context_amount', '')::numeric,
      'discount_amount', COALESCE(NULLIF(v_existing.reward_snapshot ->> 'discount_amount', '')::numeric, 0),
      'net_due', NULLIF(v_existing.reward_snapshot ->> 'net_due', '')::numeric,
      'redemption_status', v_existing.status,
      'request_key', p_request_key,
      'idempotent_replay', true
    );
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF v_order.customer_id IS DISTINCT FROM p_customer_id THEN
      RAISE EXCEPTION 'Order does not belong to this customer';
    END IF;
    IF COALESCE(v_order.purchase_type, 'online') <> 'online' THEN
      RAISE EXCEPTION 'Pickup redemption requires an online order';
    END IF;
    IF v_order.status NOT IN ('pending', 'confirmed')
       OR COALESCE(v_order.payment_status, 'unpaid') <> 'unpaid'
       OR v_order.picked_up_at IS NOT NULL THEN
      RAISE EXCEPTION 'Pickup monetary rewards require an unpaid pending or confirmed order';
    END IF;
    v_context_amount := round(v_order.total_amount, 2);
  ELSE
    v_context_amount := NULL;
  END IF;

  SELECT * INTO v_reward
  FROM public.loyalty_rewards
  WHERE id = p_reward_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found'; END IF;

  IF NOT v_reward.is_active
     OR (v_reward.starts_at IS NOT NULL AND v_reward.starts_at > now())
     OR (v_reward.ends_at IS NOT NULL AND v_reward.ends_at <= now()) THEN
    RAISE EXCEPTION 'Reward is not currently available';
  END IF;
  IF NOT ('pickup' = ANY(v_reward.channels)) THEN
    RAISE EXCEPTION 'Reward is not available for pickup';
  END IF;
  IF v_reward.reward_type = 'free_product' THEN
    RAISE EXCEPTION 'Free-product redemption is not available until inventory-aware fulfillment is enabled';
  END IF;

  IF v_reward.reward_type IN ('fixed_discount', 'percentage_discount') OR v_reward.minimum_order_amount > 0 THEN
    IF p_order_id IS NULL THEN
      RAISE EXCEPTION 'This reward requires a persisted pickup order';
    END IF;
  END IF;

  IF v_reward.minimum_order_amount > 0
     AND COALESCE(v_context_amount, 0) < v_reward.minimum_order_amount THEN
    RAISE EXCEPTION 'Minimum order amount for this reward is not met';
  END IF;

  IF v_reward.per_customer_limit IS NOT NULL THEN
    SELECT count(*)::integer INTO v_customer_redemptions
    FROM public.loyalty_redemptions r
    WHERE r.customer_id = p_customer_id
      AND r.reward_id = p_reward_id
      AND r.status <> 'reversed';
    IF v_customer_redemptions >= v_reward.per_customer_limit THEN
      RAISE EXCEPTION 'Customer redemption limit reached for this reward';
    END IF;
  END IF;

  IF v_reward.total_redemption_limit IS NOT NULL THEN
    SELECT count(*)::integer INTO v_total_redemptions
    FROM public.loyalty_redemptions r
    WHERE r.reward_id = p_reward_id
      AND r.status <> 'reversed';
    IF v_total_redemptions >= v_reward.total_redemption_limit THEN
      RAISE EXCEPTION 'Reward redemption limit reached';
    END IF;
  END IF;

  IF COALESCE(v_customer.loyalty_points, 0) < v_reward.points_required THEN
    RAISE EXCEPTION 'Insufficient loyalty points';
  END IF;

  IF v_reward.reward_type IN ('fixed_discount', 'percentage_discount') THEN
    SELECT * INTO v_existing_monetary
    FROM public.loyalty_redemptions r
    WHERE r.order_id = p_order_id
      AND r.status <> 'reversed'
      AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
    LIMIT 1
    FOR UPDATE;
    IF FOUND THEN
      RAISE EXCEPTION 'This order already has a monetary loyalty reward';
    END IF;

    IF v_reward.reward_type = 'fixed_discount' THEN
      v_discount_amount := LEAST(v_context_amount, v_reward.fixed_discount_amount)::numeric(10, 2);
    ELSE
      v_discount_amount := round(v_context_amount * v_reward.percentage_discount / 100.0, 2);
      IF v_reward.max_discount_amount IS NOT NULL THEN
        v_discount_amount := LEAST(v_discount_amount, v_reward.max_discount_amount);
      END IF;
      v_discount_amount := LEAST(v_discount_amount, v_context_amount)::numeric(10, 2);
    END IF;

    v_net_due := round(v_context_amount - v_discount_amount, 2);

    SELECT COALESCE(ls.points_per_baht, round(ls.points_percentage / 100.0, 5), 0)
    INTO v_rate
    FROM public.loyalty_settings ls
    WHERE ls.purchase_type = 'online';
    v_rate := COALESCE(v_rate, 0);
    v_points_earned := round(v_net_due * v_rate);

    UPDATE public.orders
    SET
      loyalty_discount_amount = v_discount_amount,
      loyalty_multiplier = v_rate,
      loyalty_points_earned = v_points_earned,
      updated_at = now()
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    v_status := 'reserved';
  ELSE
    v_discount_amount := 0;
    v_net_due := v_context_amount;
    v_status := 'redeemed';
  END IF;

  v_snapshot := jsonb_build_object(
    'reward_key', v_reward.reward_key,
    'name_en', v_reward.name_en,
    'name_th', v_reward.name_th,
    'name_zh', v_reward.name_zh,
    'description_en', v_reward.description_en,
    'description_th', v_reward.description_th,
    'description_zh', v_reward.description_zh,
    'reward_type', v_reward.reward_type,
    'points_required', v_reward.points_required,
    'fixed_discount_amount', v_reward.fixed_discount_amount,
    'percentage_discount', v_reward.percentage_discount,
    'max_discount_amount', v_reward.max_discount_amount,
    'minimum_order_amount', v_reward.minimum_order_amount,
    'context_amount', v_context_amount,
    'discount_amount', v_discount_amount,
    'net_due', v_net_due,
    'channel', 'pickup',
    'request_key', p_request_key,
    'fulfillment', CASE WHEN v_status = 'reserved' THEN 'payment_pending' ELSE 'staff_manual' END
  );

  INSERT INTO public.loyalty_redemptions (
    customer_id, reward_id, order_id, channel, status,
    points_spent, reward_snapshot, created_by, request_key
  ) VALUES (
    p_customer_id, p_reward_id, p_order_id, 'pickup', v_status,
    v_reward.points_required, v_snapshot, v_actor_id, p_request_key
  )
  RETURNING id INTO v_redemption_id;

  v_new_balance := public.apply_loyalty_points_delta_v2(
    p_customer_id,
    -v_reward.points_required,
    'redeem',
    p_order_id,
    v_redemption_id,
    v_actor_id,
    CASE WHEN v_status = 'reserved' THEN 'Pickup monetary reward reserved' ELSE 'Staff reward redemption' END,
    jsonb_build_object(
      'reward_id', p_reward_id,
      'reward_key', v_reward.reward_key,
      'channel', 'pickup',
      'discount_amount', v_discount_amount,
      'net_due', v_net_due,
      'request_key', p_request_key,
      'redemption_status', v_status
    )
  );

  RETURN jsonb_build_object(
    'redemption_id', v_redemption_id,
    'reward_id', p_reward_id,
    'reward_key', v_reward.reward_key,
    'reward_type', v_reward.reward_type,
    'reward_name_en', v_reward.name_en,
    'reward_name_th', v_reward.name_th,
    'points_spent', v_reward.points_required,
    'previous_balance', COALESCE(v_customer.loyalty_points, 0),
    'new_balance', v_new_balance,
    'channel', 'pickup',
    'order_id', p_order_id,
    'context_amount', v_context_amount,
    'discount_amount', v_discount_amount,
    'net_due', v_net_due,
    'redemption_status', v_status,
    'request_key', p_request_key,
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_redeem_loyalty_reward_v2(uuid, uuid, text, uuid, numeric, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_redeem_loyalty_reward_v2(uuid, uuid, text, uuid, numeric, uuid)
TO authenticated;

-- -----------------------------------------------------------------------------
-- Staff payment capture for pickup orders.
-- This is the point at which a reserved monetary reward becomes consumed.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_record_order_payment_v2(
  p_order_id uuid,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_customer_id uuid;
  v_order public.orders%ROWTYPE;
  v_redemption public.loyalty_redemptions%ROWTYPE;
  v_amount_due numeric(10, 2);
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Order id is required'; END IF;
  IF p_payment_method NOT IN ('cash', 'qr_code') THEN
    RAISE EXCEPTION 'Payment method must be cash or qr_code';
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
    RAISE EXCEPTION 'Order customer changed while recording payment; retry';
  END IF;
  IF COALESCE(v_order.purchase_type, 'online') <> 'online' THEN
    RAISE EXCEPTION 'Pickup payment requires an online order';
  END IF;
  IF v_order.status NOT IN ('pending', 'confirmed', 'ready') OR v_order.picked_up_at IS NOT NULL THEN
    RAISE EXCEPTION 'This order can no longer accept pickup payment';
  END IF;

  v_amount_due := round(v_order.total_amount - COALESCE(v_order.loyalty_discount_amount, 0), 2);

  IF v_order.payment_status = 'paid' THEN
    IF v_order.payment_method IS DISTINCT FROM p_payment_method
       OR v_order.amount_paid IS DISTINCT FROM v_amount_due THEN
      RAISE EXCEPTION 'Payment has already been recorded and cannot be changed';
    END IF;
    RETURN to_jsonb(v_order) || jsonb_build_object('amount_due', v_amount_due, 'idempotent_replay', true);
  END IF;

  IF COALESCE(v_order.loyalty_discount_amount, 0) > 0 THEN
    SELECT * INTO v_redemption
    FROM public.loyalty_redemptions r
    WHERE r.order_id = p_order_id
      AND r.status = 'reserved'
      AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
    ORDER BY r.created_at, r.id
    LIMIT 1
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Discounted order is missing its reserved loyalty redemption';
    END IF;
  END IF;

  UPDATE public.orders
  SET
    payment_method = p_payment_method,
    payment_status = 'paid',
    amount_paid = v_amount_due,
    updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  IF v_redemption.id IS NOT NULL THEN
    UPDATE public.loyalty_redemptions
    SET status = 'redeemed'
    WHERE id = v_redemption.id;
  END IF;

  RETURN to_jsonb(v_order) || jsonb_build_object('amount_due', v_amount_due, 'idempotent_replay', false);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_record_order_payment_v2(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_record_order_payment_v2(uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Atomic walk-in sale + optional reward redemption + net-amount earning.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_walk_in_purchase_v2(
  p_customer_id uuid,
  p_amount numeric,
  p_order_number text,
  p_reward_id uuid,
  p_request_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_customer public.customers%ROWTYPE;
  v_existing_order public.orders%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_reward public.loyalty_rewards%ROWTYPE;
  v_existing_redemption public.loyalty_redemptions%ROWTYPE;
  v_gross numeric(10, 2);
  v_discount numeric(10, 2) := 0;
  v_net_paid numeric(10, 2);
  v_rate numeric;
  v_points_earned integer;
  v_points_redeemed integer := 0;
  v_balance integer;
  v_customer_redemptions integer;
  v_total_redemptions integer;
  v_redemption_id uuid;
  v_snapshot jsonb;
  v_manual_fulfillment boolean := false;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_customer_id IS NULL OR p_request_key IS NULL THEN
    RAISE EXCEPTION 'Customer and request key are required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Purchase amount must be greater than zero';
  END IF;
  IF p_order_number IS NULL OR p_order_number !~ '^WI-[A-Za-z0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid walk-in purchase reference';
  END IF;

  v_gross := round(p_amount, 2);

  -- Fast idempotency path by explicit request key or the legacy order reference.
  SELECT * INTO v_existing_order
  FROM public.orders o
  WHERE o.staff_request_key = p_request_key OR o.order_number = p_order_number
  ORDER BY (o.staff_request_key = p_request_key) DESC
  LIMIT 1;

  IF FOUND THEN
    IF v_existing_order.customer_id IS DISTINCT FROM p_customer_id
       OR v_existing_order.purchase_type IS DISTINCT FROM 'walk_in'
       OR round(v_existing_order.total_amount, 2) IS DISTINCT FROM v_gross
       OR v_existing_order.order_number IS DISTINCT FROM p_order_number THEN
      RAISE EXCEPTION 'Walk-in purchase request conflicts with an existing sale';
    END IF;

    SELECT * INTO v_existing_redemption
    FROM public.loyalty_redemptions r
    WHERE r.order_id = v_existing_order.id AND r.status <> 'reversed'
    ORDER BY r.created_at, r.id
    LIMIT 1;

    IF (p_reward_id IS NULL) IS DISTINCT FROM (v_existing_redemption.id IS NULL)
       OR (p_reward_id IS NOT NULL AND v_existing_redemption.reward_id IS DISTINCT FROM p_reward_id) THEN
      RAISE EXCEPTION 'Walk-in purchase retry uses a different reward';
    END IF;

    SELECT COALESCE(c.loyalty_points, 0) INTO v_balance
    FROM public.customers c WHERE c.id = p_customer_id;

    RETURN jsonb_build_object(
      'order_id', v_existing_order.id,
      'order_number', v_existing_order.order_number,
      'gross_amount', v_existing_order.total_amount,
      'discount_amount', COALESCE(v_existing_order.loyalty_discount_amount, 0),
      'amount_paid', COALESCE(v_existing_order.amount_paid, v_existing_order.total_amount),
      'points_redeemed', COALESCE(v_existing_redemption.points_spent, 0),
      'points_earned', COALESCE(v_existing_order.loyalty_points_earned, 0),
      'updated_balance', v_balance,
      'reward_id', v_existing_redemption.reward_id,
      'reward_type', v_existing_redemption.reward_snapshot ->> 'reward_type',
      'reward_name_en', v_existing_redemption.reward_snapshot ->> 'name_en',
      'reward_name_th', v_existing_redemption.reward_snapshot ->> 'name_th',
      'manual_fulfillment_required', COALESCE((v_existing_redemption.reward_snapshot ->> 'manual_fulfillment_required')::boolean, false),
      'idempotent_replay', true
    );
  END IF;

  -- Serialize all point mutations for this customer before locking a reward.
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  -- Re-check after waiting on the customer lock.
  SELECT * INTO v_existing_order
  FROM public.orders o
  WHERE o.staff_request_key = p_request_key OR o.order_number = p_order_number
  ORDER BY (o.staff_request_key = p_request_key) DESC
  LIMIT 1;
  IF FOUND THEN
    IF v_existing_order.customer_id IS DISTINCT FROM p_customer_id
       OR v_existing_order.purchase_type IS DISTINCT FROM 'walk_in'
       OR round(v_existing_order.total_amount, 2) IS DISTINCT FROM v_gross
       OR v_existing_order.order_number IS DISTINCT FROM p_order_number THEN
      RAISE EXCEPTION 'Walk-in purchase request conflicts with an existing sale';
    END IF;
    SELECT * INTO v_existing_redemption
    FROM public.loyalty_redemptions r
    WHERE r.order_id = v_existing_order.id AND r.status <> 'reversed'
    ORDER BY r.created_at, r.id
    LIMIT 1;
    IF (p_reward_id IS NULL) IS DISTINCT FROM (v_existing_redemption.id IS NULL)
       OR (p_reward_id IS NOT NULL AND v_existing_redemption.reward_id IS DISTINCT FROM p_reward_id) THEN
      RAISE EXCEPTION 'Walk-in purchase retry uses a different reward';
    END IF;
    RETURN jsonb_build_object(
      'order_id', v_existing_order.id,
      'order_number', v_existing_order.order_number,
      'gross_amount', v_existing_order.total_amount,
      'discount_amount', COALESCE(v_existing_order.loyalty_discount_amount, 0),
      'amount_paid', COALESCE(v_existing_order.amount_paid, v_existing_order.total_amount),
      'points_redeemed', COALESCE(v_existing_redemption.points_spent, 0),
      'points_earned', COALESCE(v_existing_order.loyalty_points_earned, 0),
      'updated_balance', COALESCE(v_customer.loyalty_points, 0),
      'reward_id', v_existing_redemption.reward_id,
      'reward_type', v_existing_redemption.reward_snapshot ->> 'reward_type',
      'reward_name_en', v_existing_redemption.reward_snapshot ->> 'name_en',
      'reward_name_th', v_existing_redemption.reward_snapshot ->> 'name_th',
      'manual_fulfillment_required', COALESCE((v_existing_redemption.reward_snapshot ->> 'manual_fulfillment_required')::boolean, false),
      'idempotent_replay', true
    );
  END IF;

  IF p_reward_id IS NOT NULL THEN
    SELECT * INTO v_reward
    FROM public.loyalty_rewards
    WHERE id = p_reward_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found'; END IF;

    IF NOT v_reward.is_active
       OR (v_reward.starts_at IS NOT NULL AND v_reward.starts_at > now())
       OR (v_reward.ends_at IS NOT NULL AND v_reward.ends_at <= now()) THEN
      RAISE EXCEPTION 'Reward is not currently available';
    END IF;
    IF NOT ('walk_in' = ANY(v_reward.channels)) THEN
      RAISE EXCEPTION 'Reward is not available for walk-in purchases';
    END IF;
    IF v_reward.reward_type = 'free_product' THEN
      RAISE EXCEPTION 'Free-product redemption is not available until inventory-aware fulfillment is enabled';
    END IF;
    IF v_reward.minimum_order_amount > v_gross THEN
      RAISE EXCEPTION 'Minimum order amount for this reward is not met';
    END IF;

    IF v_reward.per_customer_limit IS NOT NULL THEN
      SELECT count(*)::integer INTO v_customer_redemptions
      FROM public.loyalty_redemptions r
      WHERE r.customer_id = p_customer_id
        AND r.reward_id = p_reward_id
        AND r.status <> 'reversed';
      IF v_customer_redemptions >= v_reward.per_customer_limit THEN
        RAISE EXCEPTION 'Customer redemption limit reached for this reward';
      END IF;
    END IF;

    IF v_reward.total_redemption_limit IS NOT NULL THEN
      SELECT count(*)::integer INTO v_total_redemptions
      FROM public.loyalty_redemptions r
      WHERE r.reward_id = p_reward_id
        AND r.status <> 'reversed';
      IF v_total_redemptions >= v_reward.total_redemption_limit THEN
        RAISE EXCEPTION 'Reward redemption limit reached';
      END IF;
    END IF;

    IF COALESCE(v_customer.loyalty_points, 0) < v_reward.points_required THEN
      RAISE EXCEPTION 'Insufficient loyalty points';
    END IF;

    IF v_reward.reward_type = 'fixed_discount' THEN
      v_discount := LEAST(v_gross, v_reward.fixed_discount_amount)::numeric(10, 2);
    ELSIF v_reward.reward_type = 'percentage_discount' THEN
      v_discount := round(v_gross * v_reward.percentage_discount / 100.0, 2);
      IF v_reward.max_discount_amount IS NOT NULL THEN
        v_discount := LEAST(v_discount, v_reward.max_discount_amount);
      END IF;
      v_discount := LEAST(v_discount, v_gross)::numeric(10, 2);
    ELSE
      v_discount := 0;
      v_manual_fulfillment := true;
    END IF;
    v_points_redeemed := v_reward.points_required;
  END IF;

  v_net_paid := round(v_gross - v_discount, 2);

  SELECT COALESCE(ls.points_per_baht, round(ls.points_percentage / 100.0, 5), 0)
  INTO v_rate
  FROM public.loyalty_settings ls
  WHERE ls.purchase_type = 'walk_in';
  v_rate := COALESCE(v_rate, 0);
  v_points_earned := round(v_net_paid * v_rate);

  INSERT INTO public.orders (
    customer_id, purchase_type, walk_in_amount, staff_id,
    order_number, order_items, total_amount,
    loyalty_discount_amount, amount_paid, staff_request_key,
    status, payment_status,
    customer_name, customer_phone, customer_email,
    loyalty_multiplier, loyalty_points_earned,
    created_at, updated_at
  ) VALUES (
    v_customer.id, 'walk_in', v_gross, v_actor_id,
    p_order_number, '[]'::jsonb, v_gross,
    v_discount, v_net_paid, p_request_key,
    'completed', 'paid',
    v_customer.name, v_customer.phone, v_customer.email,
    v_rate, v_points_earned,
    now(), now()
  )
  RETURNING * INTO v_order;

  v_balance := COALESCE(v_customer.loyalty_points, 0);

  IF p_reward_id IS NOT NULL THEN
    v_snapshot := jsonb_build_object(
      'reward_key', v_reward.reward_key,
      'name_en', v_reward.name_en,
      'name_th', v_reward.name_th,
      'name_zh', v_reward.name_zh,
      'description_en', v_reward.description_en,
      'description_th', v_reward.description_th,
      'description_zh', v_reward.description_zh,
      'reward_type', v_reward.reward_type,
      'points_required', v_reward.points_required,
      'fixed_discount_amount', v_reward.fixed_discount_amount,
      'percentage_discount', v_reward.percentage_discount,
      'max_discount_amount', v_reward.max_discount_amount,
      'minimum_order_amount', v_reward.minimum_order_amount,
      'context_amount', v_gross,
      'discount_amount', v_discount,
      'net_due', v_net_paid,
      'channel', 'walk_in',
      'request_key', p_request_key,
      'manual_fulfillment_required', v_manual_fulfillment,
      'fulfillment', CASE WHEN v_manual_fulfillment THEN 'staff_manual' ELSE 'payment_applied' END
    );

    INSERT INTO public.loyalty_redemptions (
      customer_id, reward_id, order_id, channel, status,
      points_spent, reward_snapshot, created_by, request_key
    ) VALUES (
      p_customer_id, p_reward_id, v_order.id, 'walk_in', 'redeemed',
      v_reward.points_required, v_snapshot, v_actor_id, p_request_key
    )
    RETURNING id INTO v_redemption_id;

    v_balance := public.apply_loyalty_points_delta_v2(
      p_customer_id,
      -v_reward.points_required,
      'redeem',
      v_order.id,
      v_redemption_id,
      v_actor_id,
      'Walk-in reward redeemed with sale',
      jsonb_build_object(
        'reward_id', p_reward_id,
        'reward_key', v_reward.reward_key,
        'channel', 'walk_in',
        'gross_amount', v_gross,
        'discount_amount', v_discount,
        'amount_paid', v_net_paid,
        'request_key', p_request_key
      )
    );
  END IF;

  IF v_points_earned > 0 THEN
    v_balance := public.apply_loyalty_points_delta_v2(
      p_customer_id,
      v_points_earned,
      'earn',
      v_order.id,
      NULL,
      v_actor_id,
      'Points awarded for completed walk-in purchase',
      jsonb_build_object(
        'purchase_type', 'walk_in',
        'loyalty_rate', v_rate,
        'gross_amount', v_gross,
        'discount_amount', v_discount,
        'amount_paid', v_net_paid
      )
    );

    UPDATE public.orders
    SET loyalty_points_awarded_at = now()
    WHERE id = v_order.id
    RETURNING * INTO v_order;
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'gross_amount', v_gross,
    'discount_amount', v_discount,
    'amount_paid', v_net_paid,
    'points_redeemed', v_points_redeemed,
    'points_earned', v_points_earned,
    'updated_balance', v_balance,
    'reward_id', p_reward_id,
    'reward_type', CASE WHEN p_reward_id IS NULL THEN NULL ELSE v_reward.reward_type END,
    'reward_name_en', CASE WHEN p_reward_id IS NULL THEN NULL ELSE v_reward.name_en END,
    'reward_name_th', CASE WHEN p_reward_id IS NULL THEN NULL ELSE v_reward.name_th END,
    'manual_fulfillment_required', v_manual_fulfillment,
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_walk_in_purchase_v2(uuid, numeric, text, uuid, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_walk_in_purchase_v2(uuid, numeric, text, uuid, uuid)
TO authenticated;

-- Backward-compatible staff path: old clients create the same atomic v2 sale
-- without selecting a reward. Idempotency still uses the existing WI reference.
CREATE OR REPLACE FUNCTION public.record_walk_in_purchase(
  p_customer_id uuid,
  p_amount numeric,
  p_order_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.record_walk_in_purchase_v2(
    p_customer_id,
    p_amount,
    p_order_number,
    NULL,
    gen_random_uuid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Cancellation wrappers: existing cancellation implementations keep their stock,
-- cutoff, inventory, and lock semantics. Their locks remain held until the outer
-- transaction commits, so refunding immediately after the internal cancellation
-- preserves the canonical customer -> order ordering.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_online_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pickup_date_id uuid;
  v_result jsonb;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT o.pickup_date_id
    INTO v_pickup_date_id
    FROM public.orders o
    WHERE o.id = p_order_id;

    IF FOUND AND v_pickup_date_id IS NOT NULL THEN
      RAISE EXCEPTION
        'This order uses the v2 pickup inventory system; refresh the application before cancelling'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_result := public.cancel_online_order_legacy_v1(p_order_id);
  PERFORM public.refund_reserved_order_loyalty_reward_v2(
    p_order_id,
    auth.uid(),
    'Customer cancelled before pickup payment'
  );

  SELECT to_jsonb(o) INTO v_result
  FROM public.orders o
  WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_online_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_online_order(uuid) TO authenticated;

-- Preserve the existing v2 inventory cancellation implementation as a dark
-- internal function, then recreate the public-name function as a dark wrapper.
ALTER FUNCTION public.cancel_online_order_v2(uuid)
  RENAME TO cancel_online_order_v2_inventory_v1;

REVOKE ALL ON FUNCTION public.cancel_online_order_v2_inventory_v1(uuid)
FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancel_online_order_v2(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.cancel_online_order_v2_inventory_v1(p_order_id);
  PERFORM public.refund_reserved_order_loyalty_reward_v2(
    p_order_id,
    auth.uid(),
    'Customer cancelled Pickup v2 order before payment'
  );

  SELECT to_jsonb(o) INTO v_result
  FROM public.orders o
  WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;

-- Keep Pickup v2 customer create/cancel dark exactly as before.
REVOKE ALL ON FUNCTION public.cancel_online_order_v2(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_online_order_v2(text, uuid, uuid, jsonb, text)
FROM PUBLIC, anon, authenticated;

-- Customer/self-service reward redemption remains intentionally absent.
