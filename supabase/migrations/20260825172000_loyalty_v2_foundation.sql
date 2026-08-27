/*
  JOKO TODAY — Loyalty / Rewards v2 foundation

  This migration is intentionally infrastructure-only:
  - generic point-event ledger
  - Admin-configurable reward catalogue
  - immutable redemption snapshots
  - server-controlled balance mutation helper
  - Admin RPCs for earning rules, rewards, and manual adjustments
  - opening-balance and legacy-award markers for safe cutover

  Customer reward redemption is NOT enabled here.
*/

-- -----------------------------------------------------------------------------
-- Reward catalogue
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_key text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_th text NOT NULL,
  name_zh text NOT NULL,
  description_en text,
  description_th text,
  description_zh text,
  reward_type text NOT NULL,
  points_required integer NOT NULL,
  fixed_discount_amount numeric(10, 2),
  percentage_discount numeric(5, 2),
  max_discount_amount numeric(10, 2),
  product_id uuid REFERENCES public.cms_products(id) ON DELETE RESTRICT,
  channels text[] NOT NULL DEFAULT ARRAY['online', 'pickup', 'walk_in']::text[],
  minimum_order_amount numeric(10, 2) NOT NULL DEFAULT 0,
  per_customer_limit integer,
  total_redemption_limit integer,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT loyalty_rewards_key_format
    CHECK (reward_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  CONSTRAINT loyalty_rewards_type
    CHECK (reward_type IN ('fixed_discount', 'percentage_discount', 'free_product', 'free_item', 'custom')),
  CONSTRAINT loyalty_rewards_points_positive
    CHECK (points_required > 0),
  CONSTRAINT loyalty_rewards_channels_nonempty
    CHECK (cardinality(channels) > 0),
  CONSTRAINT loyalty_rewards_channels_valid
    CHECK (channels <@ ARRAY['online', 'pickup', 'walk_in']::text[]),
  CONSTRAINT loyalty_rewards_minimum_order_nonnegative
    CHECK (minimum_order_amount >= 0),
  CONSTRAINT loyalty_rewards_per_customer_limit_positive
    CHECK (per_customer_limit IS NULL OR per_customer_limit > 0),
  CONSTRAINT loyalty_rewards_total_limit_positive
    CHECK (total_redemption_limit IS NULL OR total_redemption_limit > 0),
  CONSTRAINT loyalty_rewards_valid_window
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT loyalty_rewards_type_payload
    CHECK (
      (reward_type = 'fixed_discount'
        AND fixed_discount_amount IS NOT NULL AND fixed_discount_amount > 0
        AND percentage_discount IS NULL AND max_discount_amount IS NULL AND product_id IS NULL)
      OR
      (reward_type = 'percentage_discount'
        AND percentage_discount IS NOT NULL AND percentage_discount > 0 AND percentage_discount <= 100
        AND fixed_discount_amount IS NULL AND product_id IS NULL
        AND (max_discount_amount IS NULL OR max_discount_amount > 0))
      OR
      (reward_type = 'free_product'
        AND product_id IS NOT NULL
        AND fixed_discount_amount IS NULL AND percentage_discount IS NULL AND max_discount_amount IS NULL)
      OR
      (reward_type IN ('free_item', 'custom')
        AND fixed_discount_amount IS NULL AND percentage_discount IS NULL
        AND max_discount_amount IS NULL AND product_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS loyalty_rewards_active_sort_idx
  ON public.loyalty_rewards (is_active, sort_order, points_required, created_at);

CREATE INDEX IF NOT EXISTS loyalty_rewards_product_idx
  ON public.loyalty_rewards (product_id)
  WHERE product_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_loyalty_reward_updated_at_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_loyalty_reward_updated_at_v2() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS loyalty_rewards_set_updated_at_v2 ON public.loyalty_rewards;
CREATE TRIGGER loyalty_rewards_set_updated_at_v2
BEFORE UPDATE ON public.loyalty_rewards
FOR EACH ROW
EXECUTE FUNCTION public.set_loyalty_reward_updated_at_v2();

-- -----------------------------------------------------------------------------
-- Redemption snapshots
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  reward_id uuid REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'redeemed',
  points_spent integer NOT NULL,
  reward_snapshot jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversal_reason text,

  CONSTRAINT loyalty_redemptions_channel
    CHECK (channel IN ('online', 'pickup', 'walk_in')),
  CONSTRAINT loyalty_redemptions_status
    CHECK (status IN ('reserved', 'redeemed', 'reversed')),
  CONSTRAINT loyalty_redemptions_points_positive
    CHECK (points_spent > 0),
  CONSTRAINT loyalty_redemptions_snapshot_object
    CHECK (jsonb_typeof(reward_snapshot) = 'object'),
  CONSTRAINT loyalty_redemptions_reversal_state
    CHECK (
      (status <> 'reversed' AND reversed_at IS NULL)
      OR
      (status = 'reversed' AND reversed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS loyalty_redemptions_customer_created_idx
  ON public.loyalty_redemptions (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS loyalty_redemptions_reward_idx
  ON public.loyalty_redemptions (reward_id, status)
  WHERE reward_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS loyalty_redemptions_order_idx
  ON public.loyalty_redemptions (order_id)
  WHERE order_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Append-only point-event ledger
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.loyalty_point_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_sequence bigint GENERATED ALWAYS AS IDENTITY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  redemption_id uuid REFERENCES public.loyalty_redemptions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  points_delta integer NOT NULL,
  balance_after integer NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT loyalty_point_events_type
    CHECK (event_type IN (
      'migration_opening_balance',
      'earn',
      'redeem',
      'reverse_earn',
      'refund_redemption',
      'admin_adjustment'
    )),
  CONSTRAINT loyalty_point_events_delta_nonzero
    CHECK (points_delta <> 0),
  CONSTRAINT loyalty_point_events_balance_nonnegative
    CHECK (balance_after >= 0),
  CONSTRAINT loyalty_point_events_metadata_object
    CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_point_events_event_sequence_uq
  ON public.loyalty_point_events (event_sequence);

CREATE INDEX IF NOT EXISTS loyalty_point_events_customer_created_idx
  ON public.loyalty_point_events (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS loyalty_point_events_order_idx
  ON public.loyalty_point_events (order_id)
  WHERE order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_point_events_opening_balance_uq
  ON public.loyalty_point_events (customer_id)
  WHERE event_type = 'migration_opening_balance';

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_point_events_order_event_uq
  ON public.loyalty_point_events (order_id, event_type)
  WHERE order_id IS NOT NULL AND event_type IN ('earn', 'reverse_earn');

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_point_events_redemption_event_uq
  ON public.loyalty_point_events (redemption_id, event_type)
  WHERE redemption_id IS NOT NULL AND event_type IN ('redeem', 'refund_redemption');

-- -----------------------------------------------------------------------------
-- Order award marker for safe transition from legacy insert-time crediting
-- -----------------------------------------------------------------------------

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS loyalty_points_awarded_at timestamptz;

-- Historical award markers and opening-ledger rows are intentionally created only
-- by 20260825172500_loyalty_v2_earning_lifecycle.sql inside one locked atomic
-- cutover. Keeping the foundation schema-only avoids a commit-to-commit window
-- where the legacy insert trigger could credit an order without an award marker.

-- -----------------------------------------------------------------------------
-- RLS and grants
-- -----------------------------------------------------------------------------

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_point_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.loyalty_rewards FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_redemptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_point_events FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.loyalty_rewards TO anon, authenticated;
GRANT SELECT ON TABLE public.loyalty_redemptions TO authenticated;
GRANT SELECT ON TABLE public.loyalty_point_events TO authenticated;
GRANT ALL ON TABLE public.loyalty_rewards TO service_role;
GRANT ALL ON TABLE public.loyalty_redemptions TO service_role;
GRANT ALL ON TABLE public.loyalty_point_events TO service_role;

DROP POLICY IF EXISTS "Active loyalty rewards are publicly readable" ON public.loyalty_rewards;
CREATE POLICY "Active loyalty rewards are publicly readable"
ON public.loyalty_rewards
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now())
);

DROP POLICY IF EXISTS "Customers can read own loyalty redemptions" ON public.loyalty_redemptions;
CREATE POLICY "Customers can read own loyalty redemptions"
ON public.loyalty_redemptions
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = customer_id);

DROP POLICY IF EXISTS "Customers can read own loyalty point events" ON public.loyalty_point_events;
CREATE POLICY "Customers can read own loyalty point events"
ON public.loyalty_point_events
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = customer_id);

-- Existing loyalty_settings should remain publicly readable, but direct client
-- writes are unnecessary and misleading now that Admin writes use RPCs.
REVOKE ALL ON TABLE public.loyalty_settings FROM anon, authenticated;
GRANT SELECT ON TABLE public.loyalty_settings TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- Defense-in-depth guard for the cached customer balance
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_customer_loyalty_balance_v2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.loyalty_points IS DISTINCT FROM OLD.loyalty_points
     AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Loyalty balance is server-controlled' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_customer_loyalty_balance_v2() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_customer_loyalty_balance_v2 ON public.customers;
CREATE TRIGGER guard_customer_loyalty_balance_v2
BEFORE UPDATE OF loyalty_points ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.guard_customer_loyalty_balance_v2();

-- -----------------------------------------------------------------------------
-- Internal atomic balance mutation primitive. No client role gets EXECUTE.
-- -----------------------------------------------------------------------------

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

  v_new_balance := v_balance + p_points_delta;
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient loyalty points';
  END IF;

  UPDATE public.customers
  SET loyalty_points = v_new_balance
  WHERE id = p_customer_id;

  INSERT INTO public.loyalty_point_events (
    customer_id, order_id, redemption_id, event_type,
    points_delta, balance_after, actor_id, reason, metadata
  ) VALUES (
    p_customer_id, p_order_id, p_redemption_id, p_event_type,
    p_points_delta, v_new_balance, p_actor_id, NULLIF(btrim(COALESCE(p_reason, '')), ''), p_metadata
  );

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_loyalty_points_delta_v2(uuid, integer, text, uuid, uuid, uuid, text, jsonb)
FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Admin reward management
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_loyalty_rewards_v2()
RETURNS SETOF public.loyalty_rewards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT r.*
  FROM public.loyalty_rewards r
  ORDER BY r.sort_order, r.points_required, r.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_loyalty_rewards_v2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_loyalty_rewards_v2() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_loyalty_reward_v2(
  p_reward_id uuid,
  p_reward_key text,
  p_name_en text,
  p_name_th text,
  p_name_zh text,
  p_description_en text,
  p_description_th text,
  p_description_zh text,
  p_reward_type text,
  p_points_required integer,
  p_fixed_discount_amount numeric,
  p_percentage_discount numeric,
  p_max_discount_amount numeric,
  p_product_id uuid,
  p_channels text[],
  p_minimum_order_amount numeric,
  p_per_customer_limit integer,
  p_total_redemption_limit integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_sort_order integer,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.loyalty_rewards%ROWTYPE;
  v_reward public.loyalty_rewards%ROWTYPE;
  v_key text := lower(btrim(COALESCE(p_reward_key, '')));
  v_channels text[] := COALESCE(p_channels, ARRAY[]::text[]);
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF v_key = '' OR v_key !~ '^[a-z0-9][a-z0-9_-]{0,63}$' THEN RAISE EXCEPTION 'Invalid reward key'; END IF;
  IF btrim(COALESCE(p_name_en, '')) = '' OR btrim(COALESCE(p_name_th, '')) = '' OR btrim(COALESCE(p_name_zh, '')) = '' THEN
    RAISE EXCEPTION 'Reward names are required in EN, TH, and ZH';
  END IF;
  IF p_reward_type NOT IN ('fixed_discount', 'percentage_discount', 'free_product', 'free_item', 'custom') THEN
    RAISE EXCEPTION 'Invalid reward type';
  END IF;
  IF p_points_required IS NULL OR p_points_required <= 0 THEN RAISE EXCEPTION 'Points required must be positive'; END IF;
  IF cardinality(v_channels) = 0 OR NOT (v_channels <@ ARRAY['online', 'pickup', 'walk_in']::text[]) THEN
    RAISE EXCEPTION 'At least one valid redemption channel is required';
  END IF;
  IF COALESCE(p_minimum_order_amount, 0) < 0 THEN RAISE EXCEPTION 'Minimum order amount cannot be negative'; END IF;
  IF p_per_customer_limit IS NOT NULL AND p_per_customer_limit <= 0 THEN RAISE EXCEPTION 'Per-customer limit must be positive'; END IF;
  IF p_total_redemption_limit IS NOT NULL AND p_total_redemption_limit <= 0 THEN RAISE EXCEPTION 'Total redemption limit must be positive'; END IF;
  IF p_starts_at IS NOT NULL AND p_ends_at IS NOT NULL AND p_ends_at <= p_starts_at THEN RAISE EXCEPTION 'Reward end must be after start'; END IF;

  IF p_reward_type = 'fixed_discount' THEN
    IF p_fixed_discount_amount IS NULL OR p_fixed_discount_amount <= 0
       OR p_percentage_discount IS NOT NULL OR p_max_discount_amount IS NOT NULL OR p_product_id IS NOT NULL THEN
      RAISE EXCEPTION 'Fixed discount reward configuration is invalid';
    END IF;
  ELSIF p_reward_type = 'percentage_discount' THEN
    IF p_percentage_discount IS NULL OR p_percentage_discount <= 0 OR p_percentage_discount > 100
       OR p_fixed_discount_amount IS NOT NULL OR p_product_id IS NOT NULL
       OR (p_max_discount_amount IS NOT NULL AND p_max_discount_amount <= 0) THEN
      RAISE EXCEPTION 'Percentage discount reward configuration is invalid';
    END IF;
  ELSIF p_reward_type = 'free_product' THEN
    IF p_product_id IS NULL OR p_fixed_discount_amount IS NOT NULL OR p_percentage_discount IS NOT NULL OR p_max_discount_amount IS NOT NULL THEN
      RAISE EXCEPTION 'Free product reward configuration is invalid';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.cms_products p WHERE p.id = p_product_id) THEN
      RAISE EXCEPTION 'Reward product does not exist';
    END IF;
  ELSE
    IF p_fixed_discount_amount IS NOT NULL OR p_percentage_discount IS NOT NULL OR p_max_discount_amount IS NOT NULL OR p_product_id IS NOT NULL THEN
      RAISE EXCEPTION 'Free-item/custom reward configuration is invalid';
    END IF;
  END IF;

  IF p_reward_id IS NULL THEN
    INSERT INTO public.loyalty_rewards (
      reward_key, name_en, name_th, name_zh,
      description_en, description_th, description_zh,
      reward_type, points_required,
      fixed_discount_amount, percentage_discount, max_discount_amount, product_id,
      channels, minimum_order_amount, per_customer_limit, total_redemption_limit,
      starts_at, ends_at, sort_order, is_active
    ) VALUES (
      v_key, btrim(p_name_en), btrim(p_name_th), btrim(p_name_zh),
      NULLIF(btrim(COALESCE(p_description_en, '')), ''),
      NULLIF(btrim(COALESCE(p_description_th, '')), ''),
      NULLIF(btrim(COALESCE(p_description_zh, '')), ''),
      p_reward_type, p_points_required,
      p_fixed_discount_amount, p_percentage_discount, p_max_discount_amount, p_product_id,
      v_channels, COALESCE(p_minimum_order_amount, 0), p_per_customer_limit, p_total_redemption_limit,
      p_starts_at, p_ends_at, COALESCE(p_sort_order, 0), COALESCE(p_is_active, true)
    ) RETURNING * INTO v_reward;
  ELSE
    SELECT * INTO v_existing
    FROM public.loyalty_rewards
    WHERE id = p_reward_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found'; END IF;
    IF v_existing.reward_key IS DISTINCT FROM v_key THEN
      RAISE EXCEPTION 'Reward key is immutable';
    END IF;

    UPDATE public.loyalty_rewards
    SET
      name_en = btrim(p_name_en),
      name_th = btrim(p_name_th),
      name_zh = btrim(p_name_zh),
      description_en = NULLIF(btrim(COALESCE(p_description_en, '')), ''),
      description_th = NULLIF(btrim(COALESCE(p_description_th, '')), ''),
      description_zh = NULLIF(btrim(COALESCE(p_description_zh, '')), ''),
      reward_type = p_reward_type,
      points_required = p_points_required,
      fixed_discount_amount = p_fixed_discount_amount,
      percentage_discount = p_percentage_discount,
      max_discount_amount = p_max_discount_amount,
      product_id = p_product_id,
      channels = v_channels,
      minimum_order_amount = COALESCE(p_minimum_order_amount, 0),
      per_customer_limit = p_per_customer_limit,
      total_redemption_limit = p_total_redemption_limit,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      sort_order = COALESCE(p_sort_order, 0),
      is_active = COALESCE(p_is_active, false)
    WHERE id = p_reward_id
    RETURNING * INTO v_reward;
  END IF;

  RETURN to_jsonb(v_reward);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_loyalty_reward_v2(
  uuid, text, text, text, text, text, text, text, text, integer,
  numeric, numeric, numeric, uuid, text[], numeric, integer, integer,
  timestamptz, timestamptz, integer, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_loyalty_reward_v2(
  uuid, text, text, text, text, text, text, text, text, integer,
  numeric, numeric, numeric, uuid, text[], numeric, integer, integer,
  timestamptz, timestamptz, integer, boolean
) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_loyalty_reward_active_v2(
  p_reward_id uuid,
  p_is_active boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward public.loyalty_rewards%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.loyalty_rewards
  SET is_active = COALESCE(p_is_active, false)
  WHERE id = p_reward_id
  RETURNING * INTO v_reward;

  IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found'; END IF;
  RETURN to_jsonb(v_reward);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_loyalty_reward_active_v2(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_loyalty_reward_active_v2(uuid, boolean) TO authenticated;

-- -----------------------------------------------------------------------------
-- Admin earning-rule management
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_update_loyalty_earning_rule_v2(
  p_purchase_type text,
  p_points_percentage numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_setting public.loyalty_settings%ROWTYPE;
  v_type text := lower(btrim(COALESCE(p_purchase_type, '')));
  v_points_per_baht numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  IF v_type NOT IN ('online', 'pickup', 'walk_in') THEN RAISE EXCEPTION 'Invalid purchase type'; END IF;
  IF p_points_percentage IS NULL OR p_points_percentage < 0 OR p_points_percentage > 100 THEN
    RAISE EXCEPTION 'Points percentage must be between 0 and 100';
  END IF;

  v_points_per_baht := round(p_points_percentage / 100.0, 5);

  UPDATE public.loyalty_settings
  SET
    points_percentage = p_points_percentage,
    points_per_baht = v_points_per_baht,
    multiplier = v_points_per_baht,
    updated_at = now()
  WHERE purchase_type = v_type
  RETURNING * INTO v_setting;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Loyalty earning rule is not configured for %', v_type;
  END IF;

  RETURN to_jsonb(v_setting);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_loyalty_earning_rule_v2(text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_loyalty_earning_rule_v2(text, numeric) TO authenticated;

-- -----------------------------------------------------------------------------
-- Admin balance adjustment (ledgered; intentionally not exposed in customer UI)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_adjust_loyalty_points_v2(
  p_customer_id uuid,
  p_points_delta integer,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_customer_id IS NULL THEN RAISE EXCEPTION 'Customer is required'; END IF;
  IF p_points_delta IS NULL OR p_points_delta = 0 THEN RAISE EXCEPTION 'Adjustment must be non-zero'; END IF;
  IF btrim(COALESCE(p_reason, '')) = '' THEN RAISE EXCEPTION 'Adjustment reason is required'; END IF;

  v_balance := public.apply_loyalty_points_delta_v2(
    p_customer_id,
    p_points_delta,
    'admin_adjustment',
    NULL,
    NULL,
    auth.uid(),
    btrim(p_reason),
    jsonb_build_object('source', 'admin')
  );

  RETURN jsonb_build_object('customer_id', p_customer_id, 'balance', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_loyalty_points_v2(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_loyalty_points_v2(uuid, integer, text) TO authenticated;

-- No customer redemption RPC or customer EXECUTE grant is created by this migration.
