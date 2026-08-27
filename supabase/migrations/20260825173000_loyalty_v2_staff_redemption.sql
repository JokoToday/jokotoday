/*
  JOKO TODAY — Loyalty / Rewards v2 staff redemption

  Staff-controlled redemption only. Customer self-service redemption remains dark.
  Depends on the Loyalty v2 foundation and earning lifecycle migrations.
*/

CREATE OR REPLACE FUNCTION public.staff_redeem_loyalty_reward_v2(
  p_customer_id uuid,
  p_reward_id uuid,
  p_channel text,
  p_order_id uuid DEFAULT NULL,
  p_context_amount numeric DEFAULT NULL
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
  v_context_amount numeric := p_context_amount;
  v_customer_redemptions integer;
  v_total_redemptions integer;
  v_redemption_id uuid;
  v_new_balance integer;
  v_snapshot jsonb;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;

  IF p_customer_id IS NULL OR p_reward_id IS NULL THEN
    RAISE EXCEPTION 'Customer and reward are required';
  END IF;
  IF p_channel NOT IN ('pickup', 'walk_in') THEN
    RAISE EXCEPTION 'Staff redemption channel must be pickup or walk_in';
  END IF;

  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  -- Lock the reward row exclusively so a total-redemption limit cannot be
  -- exceeded by concurrent redemptions for different customers.
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
    v_context_amount := COALESCE(v_order.total_amount, 0);
  ELSIF p_channel = 'pickup' AND v_reward.minimum_order_amount > 0 THEN
    RAISE EXCEPTION 'Select the pickup order for rewards with a minimum order amount';
  END IF;

  IF v_context_amount IS NOT NULL AND v_context_amount < 0 THEN
    RAISE EXCEPTION 'Context amount cannot be negative';
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
    'product_id', v_reward.product_id,
    'minimum_order_amount', v_reward.minimum_order_amount,
    'context_amount', v_context_amount,
    'channel', p_channel
  );

  INSERT INTO public.loyalty_redemptions (
    customer_id,
    reward_id,
    order_id,
    channel,
    status,
    points_spent,
    reward_snapshot,
    created_by
  ) VALUES (
    p_customer_id,
    p_reward_id,
    p_order_id,
    p_channel,
    'redeemed',
    v_reward.points_required,
    v_snapshot,
    v_actor_id
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
      'context_amount', v_context_amount
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
    'context_amount', v_context_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_redeem_loyalty_reward_v2(uuid, uuid, text, uuid, numeric)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_redeem_loyalty_reward_v2(uuid, uuid, text, uuid, numeric)
TO authenticated;

-- Deliberately no customer/self-service redemption function or grant.
