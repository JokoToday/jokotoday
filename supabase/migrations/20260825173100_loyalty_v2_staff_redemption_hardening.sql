/*
  JOKO TODAY — Loyalty / Rewards v2 staff redemption hardening

  Adds caller-supplied idempotency and authoritative monetary reward valuation.
  Customer/self-service redemption remains dark.
*/

ALTER TABLE public.loyalty_redemptions
  ADD COLUMN IF NOT EXISTS request_key uuid;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_redemptions_request_key_uq
  ON public.loyalty_redemptions (request_key)
  WHERE request_key IS NOT NULL;

-- Remove the earlier non-idempotent staff signature before replacing it.
DROP FUNCTION IF EXISTS public.staff_redeem_loyalty_reward_v2(uuid, uuid, text, uuid, numeric);

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
  v_reward public.loyalty_rewards%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_existing_redemption public.loyalty_redemptions%ROWTYPE;
  v_context_amount numeric := p_context_amount;
  v_discount_amount numeric(10, 2);
  v_customer_redemptions integer;
  v_total_redemptions integer;
  v_redemption_id uuid;
  v_new_balance integer;
  v_snapshot jsonb;
  v_product_name_en text;
  v_product_name_th text;
  v_product_name_zh text;
  v_product_price numeric;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;

  IF p_customer_id IS NULL OR p_reward_id IS NULL OR p_request_key IS NULL THEN
    RAISE EXCEPTION 'Customer, reward, and request key are required';
  END IF;
  IF p_channel NOT IN ('pickup', 'walk_in') THEN
    RAISE EXCEPTION 'Staff redemption channel must be pickup or walk_in';
  END IF;

  -- Fast idempotency path. A completed request returns its original authoritative
  -- balance/result instead of spending the same points again.
  SELECT * INTO v_existing_redemption
  FROM public.loyalty_redemptions
  WHERE request_key = p_request_key;

  IF FOUND THEN
    IF v_existing_redemption.customer_id IS DISTINCT FROM p_customer_id
       OR v_existing_redemption.reward_id IS DISTINCT FROM p_reward_id
       OR v_existing_redemption.channel IS DISTINCT FROM p_channel
       OR v_existing_redemption.order_id IS DISTINCT FROM p_order_id THEN
      RAISE EXCEPTION 'Redemption request key conflicts with another request';
    END IF;

    SELECT e.balance_after
    INTO v_new_balance
    FROM public.loyalty_point_events e
    WHERE e.redemption_id = v_existing_redemption.id
      AND e.event_type = 'redeem';

    IF v_new_balance IS NULL THEN
      RAISE EXCEPTION 'Existing redemption is missing its point ledger event';
    END IF;

    RETURN jsonb_build_object(
      'redemption_id', v_existing_redemption.id,
      'reward_id', v_existing_redemption.reward_id,
      'reward_key', v_existing_redemption.reward_snapshot ->> 'reward_key',
      'reward_type', v_existing_redemption.reward_snapshot ->> 'reward_type',
      'reward_name_en', v_existing_redemption.reward_snapshot ->> 'name_en',
      'reward_name_th', v_existing_redemption.reward_snapshot ->> 'name_th',
      'points_spent', v_existing_redemption.points_spent,
      'previous_balance', v_new_balance + v_existing_redemption.points_spent,
      'new_balance', v_new_balance,
      'channel', v_existing_redemption.channel,
      'order_id', v_existing_redemption.order_id,
      'context_amount', v_existing_redemption.reward_snapshot -> 'context_amount',
      'discount_amount', v_existing_redemption.reward_snapshot -> 'discount_amount',
      'request_key', p_request_key,
      'idempotent_replay', true
    );
  END IF;

  -- Customer lock serializes all earn/redeem/adjustment balance changes for this
  -- customer and also serializes retries using the same customer/request key.
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  -- Re-check after waiting for the customer lock: a concurrent retry may have
  -- completed while this transaction was blocked.
  SELECT * INTO v_existing_redemption
  FROM public.loyalty_redemptions
  WHERE request_key = p_request_key;

  IF FOUND THEN
    IF v_existing_redemption.customer_id IS DISTINCT FROM p_customer_id
       OR v_existing_redemption.reward_id IS DISTINCT FROM p_reward_id
       OR v_existing_redemption.channel IS DISTINCT FROM p_channel
       OR v_existing_redemption.order_id IS DISTINCT FROM p_order_id THEN
      RAISE EXCEPTION 'Redemption request key conflicts with another request';
    END IF;

    SELECT e.balance_after
    INTO v_new_balance
    FROM public.loyalty_point_events e
    WHERE e.redemption_id = v_existing_redemption.id
      AND e.event_type = 'redeem';

    IF v_new_balance IS NULL THEN
      RAISE EXCEPTION 'Existing redemption is missing its point ledger event';
    END IF;

    RETURN jsonb_build_object(
      'redemption_id', v_existing_redemption.id,
      'reward_id', v_existing_redemption.reward_id,
      'reward_key', v_existing_redemption.reward_snapshot ->> 'reward_key',
      'reward_type', v_existing_redemption.reward_snapshot ->> 'reward_type',
      'reward_name_en', v_existing_redemption.reward_snapshot ->> 'name_en',
      'reward_name_th', v_existing_redemption.reward_snapshot ->> 'name_th',
      'points_spent', v_existing_redemption.points_spent,
      'previous_balance', v_new_balance + v_existing_redemption.points_spent,
      'new_balance', v_new_balance,
      'channel', v_existing_redemption.channel,
      'order_id', v_existing_redemption.order_id,
      'context_amount', v_existing_redemption.reward_snapshot -> 'context_amount',
      'discount_amount', v_existing_redemption.reward_snapshot -> 'discount_amount',
      'request_key', p_request_key,
      'idempotent_replay', true
    );
  END IF;

  -- Customer is already locked. Lock an attached order next so all customer/order
  -- operations follow the same customer -> order sequence as cancellation/pickup.
  IF p_channel = 'walk_in' AND p_order_id IS NULL THEN
    RAISE EXCEPTION 'Walk-in redemption requires a persisted sale';
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF v_order.customer_id IS DISTINCT FROM p_customer_id THEN
      RAISE EXCEPTION 'Order does not belong to this customer';
    END IF;
    IF v_order.status = 'cancelled' THEN
      RAISE EXCEPTION 'Cannot redeem against a cancelled order';
    END IF;
    IF p_channel = 'pickup' AND COALESCE(v_order.purchase_type, 'online') <> 'online' THEN
      RAISE EXCEPTION 'Pickup redemption requires an online/pickup order';
    END IF;
    IF p_channel = 'walk_in' THEN
      IF v_order.purchase_type IS DISTINCT FROM 'walk_in'
         OR v_order.status IS DISTINCT FROM 'completed'
         OR v_order.payment_status IS DISTINCT FROM 'paid' THEN
        RAISE EXCEPTION 'Walk-in redemption requires a completed paid walk-in sale';
      END IF;
    END IF;
    -- Authoritative reward context always comes from the persisted order.
    -- p_context_amount is retained only for signature compatibility and is never
    -- trusted for eligibility or monetary valuation.
    v_context_amount := COALESCE(v_order.total_amount, 0);
  END IF;

  -- Exclusive reward lock protects the global redemption limit against
  -- concurrent redemptions by different customers.
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
  IF NOT (p_channel = ANY(v_reward.channels)) THEN
    RAISE EXCEPTION 'Reward is not available for this channel';
  END IF;

  IF v_context_amount IS NOT NULL AND v_context_amount < 0 THEN
    RAISE EXCEPTION 'Context amount cannot be negative';
  END IF;

  -- Money-off rewards need a real order/sale amount. This prevents spending
  -- points on an undefined percentage/fixed discount.
  IF v_reward.reward_type IN ('fixed_discount', 'percentage_discount')
     AND COALESCE(v_context_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'A positive order or sale amount is required for this reward';
  END IF;

  IF v_reward.minimum_order_amount > 0
     AND COALESCE(v_context_amount, 0) < v_reward.minimum_order_amount THEN
    RAISE EXCEPTION 'Minimum order amount for this reward is not met';
  END IF;

  IF v_reward.reward_type = 'fixed_discount' THEN
    v_discount_amount := LEAST(v_context_amount, v_reward.fixed_discount_amount)::numeric(10, 2);
  ELSIF v_reward.reward_type = 'percentage_discount' THEN
    v_discount_amount := round(v_context_amount * v_reward.percentage_discount / 100.0, 2);
    IF v_reward.max_discount_amount IS NOT NULL THEN
      v_discount_amount := LEAST(v_discount_amount, v_reward.max_discount_amount);
    END IF;
    v_discount_amount := LEAST(v_discount_amount, v_context_amount)::numeric(10, 2);
  ELSE
    v_discount_amount := NULL;
  END IF;

  IF v_reward.reward_type = 'free_product' AND v_reward.product_id IS NOT NULL THEN
    SELECT p.name_en, p.name_th, p.name_zh, p.price
    INTO v_product_name_en, v_product_name_th, v_product_name_zh, v_product_price
    FROM public.cms_products p
    WHERE p.id = v_reward.product_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reward product no longer exists';
    END IF;
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
    'discount_amount', v_discount_amount,
    'product_id', v_reward.product_id,
    'product_name_en', v_product_name_en,
    'product_name_th', v_product_name_th,
    'product_name_zh', v_product_name_zh,
    'product_price_at_redemption', v_product_price,
    'minimum_order_amount', v_reward.minimum_order_amount,
    'context_amount', v_context_amount,
    'channel', p_channel,
    'request_key', p_request_key
  );

  INSERT INTO public.loyalty_redemptions (
    customer_id,
    reward_id,
    order_id,
    channel,
    status,
    points_spent,
    reward_snapshot,
    created_by,
    request_key
  ) VALUES (
    p_customer_id,
    p_reward_id,
    p_order_id,
    p_channel,
    'redeemed',
    v_reward.points_required,
    v_snapshot,
    v_actor_id,
    p_request_key
  )
  RETURNING id INTO v_redemption_id;

  v_new_balance := public.apply_loyalty_points_delta_v2(
    p_customer_id,
    -v_reward.points_required,
    'redeem',
    p_order_id,
    v_redemption_id,
    v_actor_id,
    'Staff reward redemption',
    jsonb_build_object(
      'reward_id', p_reward_id,
      'reward_key', v_reward.reward_key,
      'channel', p_channel,
      'context_amount', v_context_amount,
      'discount_amount', v_discount_amount,
      'request_key', p_request_key
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
    'channel', p_channel,
    'order_id', p_order_id,
    'context_amount', v_context_amount,
    'discount_amount', v_discount_amount,
    'request_key', p_request_key,
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_redeem_loyalty_reward_v2(uuid, uuid, text, uuid, numeric, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_redeem_loyalty_reward_v2(uuid, uuid, text, uuid, numeric, uuid)
TO authenticated;

-- Customer/self-service redemption remains intentionally absent.
