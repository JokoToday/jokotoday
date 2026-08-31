-- ===========================================================================
-- JOKO TODAY canonical production baseline
-- Baseline cut: 2026-08-26 / production migration head 20260826030000
--
-- This replaces the legacy replay chain for fresh environments.
-- Original migrations remain preserved separately for historical audit.
-- ===========================================================================




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'staff',
    'customer'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_adjust_loyalty_points_v2"("p_customer_id" "uuid", "p_points_delta" integer, "p_reason" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."admin_adjust_loyalty_points_v2"("p_customer_id" "uuid", "p_points_delta" integer, "p_reason" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."loyalty_rewards" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reward_key" "text" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_th" "text" NOT NULL,
    "name_zh" "text" NOT NULL,
    "description_en" "text",
    "description_th" "text",
    "description_zh" "text",
    "reward_type" "text" NOT NULL,
    "points_required" integer NOT NULL,
    "fixed_discount_amount" numeric(10,2),
    "percentage_discount" numeric(5,2),
    "max_discount_amount" numeric(10,2),
    "product_id" "uuid",
    "channels" "text"[] DEFAULT ARRAY['online'::"text", 'pickup'::"text", 'walk_in'::"text"] NOT NULL,
    "minimum_order_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "per_customer_limit" integer,
    "total_redemption_limit" integer,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loyalty_rewards_channels_nonempty" CHECK (("cardinality"("channels") > 0)),
    CONSTRAINT "loyalty_rewards_channels_valid" CHECK (("channels" <@ ARRAY['online'::"text", 'pickup'::"text", 'walk_in'::"text"])),
    CONSTRAINT "loyalty_rewards_key_format" CHECK (("reward_key" ~ '^[a-z0-9][a-z0-9_-]{0,63}$'::"text")),
    CONSTRAINT "loyalty_rewards_minimum_order_nonnegative" CHECK (("minimum_order_amount" >= (0)::numeric)),
    CONSTRAINT "loyalty_rewards_per_customer_limit_positive" CHECK ((("per_customer_limit" IS NULL) OR ("per_customer_limit" > 0))),
    CONSTRAINT "loyalty_rewards_points_positive" CHECK (("points_required" > 0)),
    CONSTRAINT "loyalty_rewards_total_limit_positive" CHECK ((("total_redemption_limit" IS NULL) OR ("total_redemption_limit" > 0))),
    CONSTRAINT "loyalty_rewards_type" CHECK (("reward_type" = ANY (ARRAY['fixed_discount'::"text", 'percentage_discount'::"text", 'free_product'::"text", 'free_item'::"text", 'custom'::"text"]))),
    CONSTRAINT "loyalty_rewards_type_payload" CHECK (((("reward_type" = 'fixed_discount'::"text") AND ("fixed_discount_amount" IS NOT NULL) AND ("fixed_discount_amount" > (0)::numeric) AND ("percentage_discount" IS NULL) AND ("max_discount_amount" IS NULL) AND ("product_id" IS NULL)) OR (("reward_type" = 'percentage_discount'::"text") AND ("percentage_discount" IS NOT NULL) AND ("percentage_discount" > (0)::numeric) AND ("percentage_discount" <= (100)::numeric) AND ("fixed_discount_amount" IS NULL) AND ("product_id" IS NULL) AND (("max_discount_amount" IS NULL) OR ("max_discount_amount" > (0)::numeric))) OR (("reward_type" = 'free_product'::"text") AND ("product_id" IS NOT NULL) AND ("fixed_discount_amount" IS NULL) AND ("percentage_discount" IS NULL) AND ("max_discount_amount" IS NULL)) OR (("reward_type" = ANY (ARRAY['free_item'::"text", 'custom'::"text"])) AND ("fixed_discount_amount" IS NULL) AND ("percentage_discount" IS NULL) AND ("max_discount_amount" IS NULL) AND ("product_id" IS NULL)))),
    CONSTRAINT "loyalty_rewards_valid_window" CHECK ((("starts_at" IS NULL) OR ("ends_at" IS NULL) OR ("ends_at" > "starts_at")))
);


ALTER TABLE "public"."loyalty_rewards" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_list_loyalty_rewards_v2"() RETURNS SETOF "public"."loyalty_rewards"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."admin_list_loyalty_rewards_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_loyalty_reward_active_v2"("p_reward_id" "uuid", "p_is_active" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."admin_set_loyalty_reward_active_v2"("p_reward_id" "uuid", "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_pickup_date_location_v2"("p_pickup_date_id" "uuid", "p_location_id" "uuid", "p_is_active" boolean, "p_note_en" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_date public.pickup_dates%ROWTYPE;
  v_location_active boolean;
  v_result public.pickup_date_locations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = v_user_id AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;

  PERFORM l.id
  FROM public.cms_pickup_locations l
  WHERE l.id = p_location_id
     OR EXISTS (
       SELECT 1
       FROM public.pickup_date_locations dl
       WHERE dl.pickup_date_id = p_pickup_date_id
         AND dl.location_id = l.id
     )
  ORDER BY l.id
  FOR SHARE;

  SELECT l.is_active INTO v_location_active
  FROM public.cms_pickup_locations l
  WHERE l.id = p_location_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup location not found'; END IF;

  IF COALESCE(p_is_active, false) = true
     AND COALESCE(v_location_active, false) = false THEN
    RAISE EXCEPTION 'A globally inactive pickup location cannot be enabled for a concrete date';
  END IF;

  SELECT d.* INTO v_date
  FROM public.pickup_dates d
  WHERE d.id = p_pickup_date_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup date not found'; END IF;

  INSERT INTO public.pickup_date_locations (
    pickup_date_id, location_id, is_active, note_en, updated_at
  ) VALUES (
    p_pickup_date_id, p_location_id, COALESCE(p_is_active, false),
    NULLIF(btrim(COALESCE(p_note_en, '')), ''), now()
  )
  ON CONFLICT (pickup_date_id, location_id)
  DO UPDATE SET is_active = EXCLUDED.is_active,
                note_en = EXCLUDED.note_en,
                updated_at = now()
  RETURNING * INTO v_result;

  IF v_date.status = 'open' AND NOT EXISTS (
    SELECT 1
    FROM public.pickup_date_locations dl
    JOIN public.cms_pickup_locations l ON l.id = dl.location_id
    WHERE dl.pickup_date_id = p_pickup_date_id
      AND dl.is_active = true
      AND l.is_active = true
  ) THEN
    RAISE EXCEPTION 'An open pickup date requires at least one active pickup location';
  END IF;

  RETURN to_jsonb(v_result);
END;
$$;


ALTER FUNCTION "public"."admin_set_pickup_date_location_v2"("p_pickup_date_id" "uuid", "p_location_id" "uuid", "p_is_active" boolean, "p_note_en" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_product_date_capacity_v2"("p_pickup_date_id" "uuid", "p_product_id" "uuid", "p_capacity" integer, "p_note" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_user_id uuid:=auth.uid(); v_existing public.product_date_inventory%ROWTYPE; v_result public.product_date_inventory%ROWTYPE;
BEGIN
 IF v_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.user_profiles p WHERE p.id=v_user_id AND p.role='admin') THEN RAISE EXCEPTION 'Admin authorization required' USING ERRCODE='42501'; END IF;
 IF p_capacity IS NULL OR p_capacity<0 THEN RAISE EXCEPTION 'Capacity must be zero or greater'; END IF; IF NOT EXISTS(SELECT 1 FROM public.pickup_dates WHERE id=p_pickup_date_id) THEN RAISE EXCEPTION 'Pickup date not found'; END IF; IF NOT EXISTS(SELECT 1 FROM public.cms_products WHERE id=p_product_id) THEN RAISE EXCEPTION 'Product not found'; END IF;
 SELECT * INTO v_existing FROM public.product_date_inventory WHERE pickup_date_id=p_pickup_date_id AND product_id=p_product_id FOR UPDATE; IF FOUND AND v_existing.reserved_quantity>p_capacity THEN RAISE EXCEPTION 'Capacity cannot be lower than already reserved quantity'; END IF;
 INSERT INTO public.product_date_inventory(pickup_date_id,product_id,capacity,reserved_quantity,capacity_source,override_note,updated_at) VALUES(p_pickup_date_id,p_product_id,p_capacity,COALESCE(v_existing.reserved_quantity,0),'date_override',NULLIF(btrim(COALESCE(p_note,'')),''),now()) ON CONFLICT(pickup_date_id,product_id) DO UPDATE SET capacity=EXCLUDED.capacity,capacity_source='date_override',override_note=EXCLUDED.override_note,updated_at=now() RETURNING * INTO v_result; RETURN to_jsonb(v_result);
END; $$;


ALTER FUNCTION "public"."admin_set_product_date_capacity_v2"("p_pickup_date_id" "uuid", "p_product_id" "uuid", "p_capacity" integer, "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_product_schedule_availability_v2"("p_schedule_id" "uuid", "p_product_id" "uuid", "p_is_active" boolean, "p_apply_to_future_dates" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := timezone('Asia/Bangkok', now())::date;
  v_capacity public.product_schedule_capacity%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = v_user_id AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_schedule_id IS NULL OR p_product_id IS NULL OR p_is_active IS NULL THEN
    RAISE EXCEPTION 'Schedule, product and active state are required';
  END IF;

  LOCK TABLE public.product_schedule_capacity IN ROW EXCLUSIVE MODE;

  PERFORM 1
  FROM public.pickup_schedules
  WHERE id = p_schedule_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup schedule not found'; END IF;

  SELECT * INTO v_capacity
  FROM public.product_schedule_capacity
  WHERE schedule_id = p_schedule_id
    AND product_id = p_product_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Configure recurring product capacity before changing availability';
  END IF;

  UPDATE public.product_schedule_capacity
  SET is_active = p_is_active,
      updated_at = now()
  WHERE schedule_id = p_schedule_id
    AND product_id = p_product_id
  RETURNING * INTO v_capacity;

  IF COALESCE(p_apply_to_future_dates, true) THEN
    IF p_is_active THEN
      IF EXISTS (
        SELECT 1
        FROM public.product_date_inventory i
        JOIN public.pickup_dates d ON d.id = i.pickup_date_id
        WHERE d.schedule_id = p_schedule_id
          AND d.pickup_date >= v_today
          AND i.product_id = p_product_id
          AND i.capacity_source = 'recurring_default'
          AND i.reserved_quantity > v_capacity.capacity
      ) THEN
        RAISE EXCEPTION 'Recurring capacity is below an existing reservation on a future pickup date';
      END IF;

      INSERT INTO public.product_date_inventory (
        pickup_date_id, product_id, capacity, reserved_quantity, capacity_source
      )
      SELECT d.id, p_product_id, v_capacity.capacity, 0, 'recurring_default'
      FROM public.pickup_dates d
      WHERE d.schedule_id = p_schedule_id
        AND d.pickup_date >= v_today
      ON CONFLICT (pickup_date_id, product_id) DO NOTHING;

      UPDATE public.product_date_inventory i
      SET capacity = v_capacity.capacity,
          updated_at = now()
      FROM public.pickup_dates d
      WHERE d.id = i.pickup_date_id
        AND d.schedule_id = p_schedule_id
        AND d.pickup_date >= v_today
        AND i.product_id = p_product_id
        AND i.capacity_source = 'recurring_default';
    ELSE
      UPDATE public.product_date_inventory i
      SET capacity = i.reserved_quantity,
          updated_at = now()
      FROM public.pickup_dates d
      WHERE d.id = i.pickup_date_id
        AND d.schedule_id = p_schedule_id
        AND d.pickup_date >= v_today
        AND i.product_id = p_product_id
        AND i.capacity_source = 'recurring_default';
    END IF;
  END IF;

  RETURN to_jsonb(v_capacity);
END;
$$;


ALTER FUNCTION "public"."admin_set_product_schedule_availability_v2"("p_schedule_id" "uuid", "p_product_id" "uuid", "p_is_active" boolean, "p_apply_to_future_dates" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_set_product_schedule_capacity_v2"("p_schedule_id" "uuid", "p_product_id" "uuid", "p_capacity" integer, "p_apply_to_future_dates" boolean DEFAULT true) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := timezone('Asia/Bangkok', now())::date;
  v_result public.product_schedule_capacity%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = v_user_id AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_capacity IS NULL OR p_capacity < 0 THEN
    RAISE EXCEPTION 'Capacity must be zero or greater';
  END IF;

  LOCK TABLE public.product_schedule_capacity IN ROW EXCLUSIVE MODE;

  PERFORM 1
  FROM public.pickup_schedules
  WHERE id = p_schedule_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup schedule not found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cms_products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF COALESCE(p_apply_to_future_dates, true) AND EXISTS (
    SELECT 1
    FROM public.product_date_inventory i
    JOIN public.pickup_dates d ON d.id = i.pickup_date_id
    WHERE d.schedule_id = p_schedule_id
      AND d.pickup_date >= v_today
      AND i.product_id = p_product_id
      AND i.capacity_source = 'recurring_default'
      AND i.reserved_quantity > p_capacity
  ) THEN
    RAISE EXCEPTION 'Cannot reduce recurring capacity below already reserved quantity on a future pickup date';
  END IF;

  INSERT INTO public.product_schedule_capacity (schedule_id, product_id, capacity, is_active, updated_at)
  VALUES (p_schedule_id, p_product_id, p_capacity, true, now())
  ON CONFLICT (schedule_id, product_id)
  DO UPDATE SET capacity = EXCLUDED.capacity,
                is_active = true,
                updated_at = now()
  RETURNING * INTO v_result;

  IF COALESCE(p_apply_to_future_dates, true) THEN
    INSERT INTO public.product_date_inventory (
      pickup_date_id, product_id, capacity, reserved_quantity, capacity_source
    )
    SELECT d.id, p_product_id, p_capacity, 0, 'recurring_default'
    FROM public.pickup_dates d
    WHERE d.schedule_id = p_schedule_id
      AND d.pickup_date >= v_today
    ON CONFLICT (pickup_date_id, product_id) DO NOTHING;

    UPDATE public.product_date_inventory i
    SET capacity = p_capacity,
        updated_at = now()
    FROM public.pickup_dates d
    WHERE d.id = i.pickup_date_id
      AND d.schedule_id = p_schedule_id
      AND d.pickup_date >= v_today
      AND i.product_id = p_product_id
      AND i.capacity_source = 'recurring_default';
  END IF;

  RETURN to_jsonb(v_result);
END;
$$;


ALTER FUNCTION "public"."admin_set_product_schedule_capacity_v2"("p_schedule_id" "uuid", "p_product_id" "uuid", "p_capacity" integer, "p_apply_to_future_dates" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_loyalty_earning_rule_v2"("p_purchase_type" "text", "p_points_percentage" numeric) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."admin_update_loyalty_earning_rule_v2"("p_purchase_type" "text", "p_points_percentage" numeric) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_pickup_date_v2"("p_pickup_date_id" "uuid", "p_status" "text", "p_order_cutoff_at" timestamp with time zone, "p_cancellation_cutoff_at" timestamp with time zone, "p_note_en" "text" DEFAULT NULL::"text", "p_note_th" "text" DEFAULT NULL::"text", "p_note_zh" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.pickup_dates%ROWTYPE;
  v_result public.pickup_dates%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = v_user_id AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('open', 'closed', 'sold_out') THEN
    RAISE EXCEPTION 'Invalid pickup date status';
  END IF;
  IF p_order_cutoff_at IS NULL OR p_cancellation_cutoff_at IS NULL THEN
    RAISE EXCEPTION 'Concrete order and cancellation cutoffs are required';
  END IF;

  PERFORM l.id
  FROM public.cms_pickup_locations l
  WHERE EXISTS (
    SELECT 1
    FROM public.pickup_date_locations dl
    WHERE dl.pickup_date_id = p_pickup_date_id
      AND dl.location_id = l.id
  )
  ORDER BY l.id
  FOR SHARE;

  SELECT d.* INTO v_existing
  FROM public.pickup_dates d
  WHERE d.id = p_pickup_date_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup date not found'; END IF;

  IF p_status = 'open' AND NOT EXISTS (
    SELECT 1
    FROM public.pickup_date_locations dl
    JOIN public.cms_pickup_locations l ON l.id = dl.location_id
    WHERE dl.pickup_date_id = p_pickup_date_id
      AND dl.is_active = true
      AND l.is_active = true
  ) THEN
    RAISE EXCEPTION 'An open pickup date requires at least one active pickup location';
  END IF;

  UPDATE public.pickup_dates
  SET status = p_status,
      order_cutoff_at = p_order_cutoff_at,
      cancellation_cutoff_at = p_cancellation_cutoff_at,
      note_en = NULLIF(btrim(COALESCE(p_note_en, '')), ''),
      note_th = NULLIF(btrim(COALESCE(p_note_th, '')), ''),
      note_zh = NULLIF(btrim(COALESCE(p_note_zh, '')), ''),
      source = 'manual',
      updated_at = now()
  WHERE id = p_pickup_date_id
  RETURNING * INTO v_result;

  RETURN to_jsonb(v_result);
END;
$$;


ALTER FUNCTION "public"."admin_update_pickup_date_v2"("p_pickup_date_id" "uuid", "p_status" "text", "p_order_cutoff_at" timestamp with time zone, "p_cancellation_cutoff_at" timestamp with time zone, "p_note_en" "text", "p_note_th" "text", "p_note_zh" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_upsert_loyalty_reward_v2"("p_reward_id" "uuid", "p_reward_key" "text", "p_name_en" "text", "p_name_th" "text", "p_name_zh" "text", "p_description_en" "text", "p_description_th" "text", "p_description_zh" "text", "p_reward_type" "text", "p_points_required" integer, "p_fixed_discount_amount" numeric, "p_percentage_discount" numeric, "p_max_discount_amount" numeric, "p_product_id" "uuid", "p_channels" "text"[], "p_minimum_order_amount" numeric, "p_per_customer_limit" integer, "p_total_redemption_limit" integer, "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_sort_order" integer, "p_is_active" boolean) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
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
$_$;


ALTER FUNCTION "public"."admin_upsert_loyalty_reward_v2"("p_reward_id" "uuid", "p_reward_key" "text", "p_name_en" "text", "p_name_th" "text", "p_name_zh" "text", "p_description_en" "text", "p_description_th" "text", "p_description_zh" "text", "p_reward_type" "text", "p_points_required" integer, "p_fixed_discount_amount" numeric, "p_percentage_discount" numeric, "p_max_discount_amount" numeric, "p_product_id" "uuid", "p_channels" "text"[], "p_minimum_order_amount" numeric, "p_per_customer_limit" integer, "p_total_redemption_limit" integer, "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_sort_order" integer, "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_upsert_pickup_schedule_v2"("p_schedule_id" "uuid", "p_schedule_key" "text", "p_label_en" "text", "p_label_th" "text", "p_label_zh" "text", "p_pickup_weekday" smallint, "p_order_cutoff_days_before" smallint, "p_order_cutoff_time" time without time zone, "p_cancellation_cutoff_days_before" smallint, "p_cancellation_cutoff_time" time without time zone, "p_location_ids" "uuid"[], "p_is_active" boolean, "p_sort_order" integer) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_user_id uuid := auth.uid();
  v_schedule_id uuid;
  v_existing_key text;
  v_location_count integer;
  v_active_location_count integer;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = v_user_id AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;

  IF p_schedule_key IS NULL OR btrim(p_schedule_key) = ''
     OR p_schedule_key !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'A stable lowercase schedule key is required';
  END IF;
  IF p_label_en IS NULL OR btrim(p_label_en) = '' THEN
    RAISE EXCEPTION 'English schedule label is required';
  END IF;
  IF p_pickup_weekday IS NULL OR p_pickup_weekday NOT BETWEEN 0 AND 6
     OR p_order_cutoff_days_before IS NULL OR p_order_cutoff_days_before NOT BETWEEN 0 AND 6
     OR p_cancellation_cutoff_days_before IS NULL OR p_cancellation_cutoff_days_before NOT BETWEEN 0 AND 6
     OR p_order_cutoff_time IS NULL OR p_cancellation_cutoff_time IS NULL THEN
    RAISE EXCEPTION 'Invalid weekday/cutoff configuration';
  END IF;
  IF COALESCE(cardinality(p_location_ids), 0) < 1 THEN
    RAISE EXCEPTION 'At least one pickup location is required';
  END IF;

  SELECT count(DISTINCT u.location_id)
  INTO v_location_count
  FROM unnest(p_location_ids) AS u(location_id);
  IF v_location_count <> cardinality(p_location_ids) THEN
    RAISE EXCEPTION 'Duplicate pickup locations are not allowed';
  END IF;

  PERFORM l.id
  FROM public.cms_pickup_locations l
  WHERE l.id = ANY(p_location_ids)
     OR (
       p_schedule_id IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM public.pickup_schedule_locations sl
         WHERE sl.schedule_id = p_schedule_id
           AND sl.location_id = l.id
       )
     )
  ORDER BY l.id
  FOR SHARE;

  SELECT
    count(*),
    count(*) FILTER (WHERE COALESCE(l.is_active, false) = true)
  INTO v_location_count, v_active_location_count
  FROM public.cms_pickup_locations l
  WHERE l.id = ANY(p_location_ids);

  IF v_location_count <> cardinality(p_location_ids) THEN
    RAISE EXCEPTION 'One or more pickup locations do not exist';
  END IF;
  IF COALESCE(p_is_active, false)
     AND v_active_location_count <> cardinality(p_location_ids) THEN
    RAISE EXCEPTION 'Every location assigned to an active pickup schedule must be globally active';
  END IF;

  LOCK TABLE public.pickup_schedules IN ROW EXCLUSIVE MODE;

  IF p_schedule_id IS NULL THEN
    INSERT INTO public.pickup_schedules (
      schedule_key, legacy_day_key, label_en, label_th, label_zh,
      pickup_weekday, order_cutoff_days_before, order_cutoff_time,
      cancellation_cutoff_days_before, cancellation_cutoff_time,
      is_active, sort_order
    ) VALUES (
      p_schedule_key, NULL, btrim(p_label_en),
      NULLIF(btrim(COALESCE(p_label_th, '')), ''),
      NULLIF(btrim(COALESCE(p_label_zh, '')), ''),
      p_pickup_weekday, p_order_cutoff_days_before, p_order_cutoff_time,
      p_cancellation_cutoff_days_before, p_cancellation_cutoff_time,
      COALESCE(p_is_active, false), COALESCE(p_sort_order, 0)
    ) RETURNING id INTO v_schedule_id;
  ELSE
    SELECT schedule_key INTO v_existing_key
    FROM public.pickup_schedules
    WHERE id = p_schedule_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pickup schedule not found'; END IF;
    IF v_existing_key <> p_schedule_key THEN
      RAISE EXCEPTION 'schedule_key is immutable after creation';
    END IF;

    UPDATE public.pickup_schedules
    SET label_en = btrim(p_label_en),
        label_th = NULLIF(btrim(COALESCE(p_label_th, '')), ''),
        label_zh = NULLIF(btrim(COALESCE(p_label_zh, '')), ''),
        pickup_weekday = p_pickup_weekday,
        order_cutoff_days_before = p_order_cutoff_days_before,
        order_cutoff_time = p_order_cutoff_time,
        cancellation_cutoff_days_before = p_cancellation_cutoff_days_before,
        cancellation_cutoff_time = p_cancellation_cutoff_time,
        is_active = COALESCE(p_is_active, false),
        sort_order = COALESCE(p_sort_order, 0),
        updated_at = now()
    WHERE id = p_schedule_id;
    v_schedule_id := p_schedule_id;
  END IF;

  UPDATE public.pickup_schedule_locations
  SET is_active = false, updated_at = now()
  WHERE schedule_id = v_schedule_id;

  INSERT INTO public.pickup_schedule_locations (schedule_id, location_id, is_active, sort_order)
  SELECT v_schedule_id, u.location_id, true, u.ordinality::integer
  FROM unnest(p_location_ids) WITH ORDINALITY AS u(location_id, ordinality)
  ON CONFLICT (schedule_id, location_id)
  DO UPDATE SET is_active = true,
                sort_order = EXCLUDED.sort_order,
                updated_at = now();

  RETURN v_schedule_id;
END;
$_$;


ALTER FUNCTION "public"."admin_upsert_pickup_schedule_v2"("p_schedule_id" "uuid", "p_schedule_key" "text", "p_label_en" "text", "p_label_th" "text", "p_label_zh" "text", "p_pickup_weekday" smallint, "p_order_cutoff_days_before" smallint, "p_order_cutoff_time" time without time zone, "p_cancellation_cutoff_days_before" smallint, "p_cancellation_cutoff_time" time without time zone, "p_location_ids" "uuid"[], "p_is_active" boolean, "p_sort_order" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_loyalty_points_delta_v2"("p_customer_id" "uuid", "p_points_delta" integer, "p_event_type" "text", "p_order_id" "uuid" DEFAULT NULL::"uuid", "p_redemption_id" "uuid" DEFAULT NULL::"uuid", "p_actor_id" "uuid" DEFAULT NULL::"uuid", "p_reason" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  IF p_event_type NOT IN ('migration_opening_balance','earn','redeem','reverse_earn','refund_redemption','admin_adjustment') THEN RAISE EXCEPTION 'Invalid loyalty event type'; END IF;
  IF p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object' THEN RAISE EXCEPTION 'Loyalty event metadata must be an object'; END IF;

  SELECT COALESCE(c.loyalty_points,0) INTO v_balance
  FROM public.customers c WHERE c.id=p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  v_effective_delta:=p_points_delta;
  v_event_metadata:=p_metadata;
  v_new_balance:=v_balance+v_effective_delta;

  IF v_new_balance<0 THEN
    IF p_event_type='reverse_earn' AND p_points_delta<0 AND p_order_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id=p_order_id AND o.customer_id=p_customer_id AND o.loyalty_points_awarded_at IS NOT NULL)
       AND NOT EXISTS (SELECT 1 FROM public.loyalty_point_events e WHERE e.order_id=p_order_id AND e.event_type='earn') THEN
      v_is_legacy_grandfathered:=true;
      v_requested_reversal:=abs(p_points_delta);
      v_applied_reversal:=LEAST(v_balance,v_requested_reversal);
      v_shortfall:=v_requested_reversal-v_applied_reversal;
      v_effective_delta:=-v_applied_reversal;
      v_new_balance:=v_balance+v_effective_delta;
      v_event_metadata:=v_event_metadata||jsonb_build_object(
        'legacy_grandfathered',true,
        'requested_reversal_points',v_requested_reversal,
        'applied_reversal_points',v_applied_reversal,
        'legacy_spent_shortfall',v_shortfall
      );
    ELSE
      RAISE EXCEPTION 'Insufficient loyalty points';
    END IF;
  END IF;

  IF v_is_legacy_grandfathered AND v_shortfall<=0 THEN RAISE EXCEPTION 'Legacy shortfall handling requires a positive shortfall'; END IF;
  IF v_effective_delta<>0 THEN UPDATE public.customers SET loyalty_points=v_new_balance WHERE id=p_customer_id; END IF;
  INSERT INTO public.loyalty_point_events(customer_id,order_id,redemption_id,event_type,points_delta,balance_after,actor_id,reason,metadata)
  VALUES(p_customer_id,p_order_id,p_redemption_id,p_event_type,v_effective_delta,v_new_balance,p_actor_id,NULLIF(btrim(COALESCE(p_reason,'')),''),v_event_metadata);
  RETURN v_new_balance;
END;
$$;


ALTER FUNCTION "public"."apply_loyalty_points_delta_v2"("p_customer_id" "uuid", "p_points_delta" integer, "p_event_type" "text", "p_order_id" "uuid", "p_redemption_id" "uuid", "p_actor_id" "uuid", "p_reason" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_loyalty_points_on_order"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_rate numeric; v_purchase_type text; v_earning_amount numeric;
BEGIN
  v_purchase_type := COALESCE(NEW.purchase_type, 'online');
  SELECT ls.points_per_baht INTO v_rate FROM public.loyalty_settings ls WHERE ls.purchase_type = v_purchase_type;
  v_rate := COALESCE(v_rate, 0);
  v_earning_amount := CASE WHEN v_purchase_type = 'walk_in' AND NEW.amount_paid IS NOT NULL THEN NEW.amount_paid ELSE NEW.total_amount END;
  NEW.loyalty_points_earned := round(COALESCE(v_earning_amount, 0) * v_rate);
  NEW.loyalty_multiplier := v_rate;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."calculate_loyalty_points_on_order"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_online_order"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_user_id uuid:=auth.uid(); v_customer_id uuid; v_pickup_date_id uuid; v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
  IF p_order_id IS NOT NULL THEN
    SELECT o.customer_id,o.pickup_date_id INTO v_customer_id,v_pickup_date_id FROM public.orders o WHERE o.id=p_order_id;
    IF FOUND THEN
      IF v_customer_id IS DISTINCT FROM v_user_id THEN RAISE EXCEPTION 'You may only cancel your own order' USING ERRCODE='42501'; END IF;
      IF v_pickup_date_id IS NOT NULL THEN RAISE EXCEPTION 'This order uses the v2 pickup inventory system; refresh the application before cancelling' USING ERRCODE='P0001'; END IF;
      IF v_customer_id IS NOT NULL THEN PERFORM 1 FROM public.customers c WHERE c.id=v_customer_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF; END IF;
      PERFORM public.refund_reserved_order_loyalty_reward_v2(p_order_id,v_user_id,'Customer cancelled before pickup payment');
    END IF;
  END IF;
  v_result:=public.cancel_online_order_legacy_v1(p_order_id);
  SELECT to_jsonb(o) INTO v_result FROM public.orders o WHERE o.id=p_order_id;
  RETURN v_result;
END; $$;


ALTER FUNCTION "public"."cancel_online_order"("p_order_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cancel_online_order"("p_order_id" "uuid") IS 'Legacy-order cancellation entrypoint. Rejects orders linked to pickup_date_id so v2 inventory cannot be released through the legacy stock_by_day path.';



CREATE OR REPLACE FUNCTION "public"."cancel_online_order_legacy_v1"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_pickup public.cms_pickup_days%ROWTYPE;
  v_rule public.cancellation_cutoff_rules%ROWTYPE;
  v_product public.cms_products%ROWTYPE;
  v_item record;
  v_now_bangkok timestamp := timezone('Asia/Bangkok', now());
  v_cutoff_date date;
  v_cutoff_at timestamp;
  v_cutoff_weekday integer;
  v_pickup_weekday integer;
  v_stock integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Order id is required'; END IF;

  SELECT * INTO v_customer FROM public.customers WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_user_id THEN RAISE EXCEPTION 'You may only cancel your own order' USING ERRCODE = '42501'; END IF;
  IF COALESCE(v_order.purchase_type, 'online') <> 'online' THEN RAISE EXCEPTION 'Only online orders can be cancelled here'; END IF;
  IF v_order.pickup_date_id IS NOT NULL THEN RAISE EXCEPTION 'Pickup v2 orders cannot use the legacy cancellation helper' USING ERRCODE = 'P0001'; END IF;
  IF v_order.status = 'cancelled' THEN RETURN to_jsonb(v_order); END IF;
  IF v_order.status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'This order can no longer be cancelled'; END IF;
  IF COALESCE(v_order.payment_status, 'unpaid') <> 'unpaid' OR v_order.picked_up_at IS NOT NULL THEN RAISE EXCEPTION 'Paid or picked-up orders require staff assistance to cancel'; END IF;
  IF v_order.pickup_date IS NULL THEN RAISE EXCEPTION 'Order has no scheduled pickup date'; END IF;

  SELECT * INTO v_pickup FROM public.cms_pickup_days
  WHERE (label_en = v_order.pickup_day OR label = v_order.pickup_day)
    AND (v_order.pickup_location_id IS NULL OR location_id = v_order.pickup_location_id)
  ORDER BY sort_order, created_at LIMIT 1;
  IF NOT FOUND OR v_pickup.day_key IS NULL OR btrim(v_pickup.day_key) = '' THEN RAISE EXCEPTION 'Could not resolve the pickup day for this order'; END IF;

  SELECT * INTO v_rule FROM public.cancellation_cutoff_rules
  WHERE is_active = true AND pickup_label_en = COALESCE(v_pickup.label_en, v_order.pickup_day)
  ORDER BY sort_order, updated_at DESC NULLS LAST, created_at DESC NULLS LAST LIMIT 1;

  IF FOUND THEN
    v_cutoff_weekday := CASE v_rule.cutoff_day
      WHEN 'Sunday' THEN 0 WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
      WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6 ELSE NULL END;
    IF v_cutoff_weekday IS NULL THEN RAISE EXCEPTION 'Invalid cancellation cutoff day configuration'; END IF;
    v_pickup_weekday := extract(dow FROM v_order.pickup_date)::integer;
    BEGIN
      v_cutoff_date := v_order.pickup_date - ((v_pickup_weekday - v_cutoff_weekday + 7) % 7);
      v_cutoff_at := v_cutoff_date::timestamp + v_rule.cutoff_time::time;
    EXCEPTION WHEN invalid_datetime_format THEN RAISE EXCEPTION 'Invalid cancellation cutoff time configuration';
    END;
  ELSE
    v_cutoff_at := (v_order.pickup_date - 1)::timestamp;
  END IF;

  IF v_now_bangkok >= v_cutoff_at THEN RAISE EXCEPTION 'Cancellation cutoff has passed for this order'; END IF;
  IF v_order.order_items IS NULL OR jsonb_typeof(v_order.order_items) <> 'array' THEN RAISE EXCEPTION 'Order item snapshot is invalid'; END IF;

  IF v_order.inventory_reserved THEN
    FOR v_item IN
      SELECT item.product_id, item.quantity
      FROM jsonb_to_recordset(v_order.order_items) AS item(product_id uuid, quantity integer)
      WHERE item.product_id IS NOT NULL AND item.quantity IS NOT NULL AND item.quantity > 0
      ORDER BY item.product_id
    LOOP
      SELECT * INTO v_product FROM public.cms_products WHERE id = v_item.product_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'A product from this order no longer exists'; END IF;
      v_stock := COALESCE(
        NULLIF(v_product.stock_by_day ->> v_pickup.day_key, '')::integer,
        NULLIF(v_product.stock_by_day ->> v_order.pickup_day, '')::integer,
        NULLIF(v_product.stock_by_day ->> replace(v_order.pickup_day, ' – ', ' - '), '')::integer,
        NULLIF(v_product.stock_by_day ->> replace(v_order.pickup_day, ' - ', ' – '), '')::integer,
        v_product.stock_remaining, 0
      );
      UPDATE public.cms_products
      SET stock_by_day = jsonb_set(COALESCE(stock_by_day, '{}'::jsonb), ARRAY[v_pickup.day_key], to_jsonb(v_stock + v_item.quantity), true),
          updated_at = now()
      WHERE id = v_product.id;
    END LOOP;
  END IF;

  IF v_order.customer_id IS NOT NULL
     AND v_order.loyalty_points_awarded_at IS NOT NULL
     AND COALESCE(v_order.loyalty_points_earned, 0) > 0
     AND NOT EXISTS (SELECT 1 FROM public.loyalty_point_events e WHERE e.order_id = v_order.id AND e.event_type = 'reverse_earn') THEN
    PERFORM public.apply_loyalty_points_delta_v2(
      v_order.customer_id, -v_order.loyalty_points_earned, 'reverse_earn', v_order.id,
      NULL, v_user_id, 'Points reversed for customer cancellation',
      jsonb_build_object('purchase_type', 'online', 'flow', 'legacy')
    );
  END IF;

  UPDATE public.orders SET status = 'cancelled' WHERE id = v_order.id RETURNING * INTO v_order;
  RETURN to_jsonb(v_order);
END;
$$;


ALTER FUNCTION "public"."cancel_online_order_legacy_v1"("p_order_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cancel_online_order_legacy_v1"("p_order_id" "uuid") IS 'Internal preserved legacy cancellation implementation. Direct client EXECUTE revoked; call through cancel_online_order(uuid).';



CREATE OR REPLACE FUNCTION "public"."cancel_online_order_v2"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_customer_id uuid; v_result jsonb;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT o.customer_id INTO v_customer_id FROM public.orders o WHERE o.id=p_order_id;
    IF FOUND THEN
      IF v_customer_id IS NOT NULL THEN PERFORM 1 FROM public.customers c WHERE c.id=v_customer_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF; END IF;
      PERFORM public.refund_reserved_order_loyalty_reward_v2(p_order_id,auth.uid(),'Customer cancelled Pickup v2 order before payment');
    END IF;
  END IF;
  v_result:=public.cancel_online_order_v2_inventory_v1(p_order_id);
  SELECT to_jsonb(o) INTO v_result FROM public.orders o WHERE o.id=p_order_id;
  RETURN v_result;
END; $$;


ALTER FUNCTION "public"."cancel_online_order_v2"("p_order_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_online_order_v2_inventory_v1"("p_order_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_date public.pickup_dates%ROWTYPE;
  v_inventory public.product_date_inventory%ROWTYPE;
  v_item record;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Order id is required'; END IF;

  SELECT * INTO v_customer FROM public.customers WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_user_id THEN RAISE EXCEPTION 'You may only cancel your own order' USING ERRCODE = '42501'; END IF;
  IF COALESCE(v_order.purchase_type, 'online') <> 'online' THEN RAISE EXCEPTION 'Only online orders can be cancelled here'; END IF;
  IF v_order.pickup_date_id IS NULL THEN RAISE EXCEPTION 'Legacy order must be cancelled through the legacy cancellation flow'; END IF;
  IF v_order.status = 'cancelled' THEN RETURN to_jsonb(v_order); END IF;
  IF v_order.status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'This order can no longer be cancelled'; END IF;
  IF COALESCE(v_order.payment_status, 'unpaid') <> 'unpaid' OR v_order.picked_up_at IS NOT NULL THEN RAISE EXCEPTION 'Paid or picked-up orders require staff assistance to cancel'; END IF;
  IF v_order.order_items IS NULL OR jsonb_typeof(v_order.order_items) <> 'array' THEN RAISE EXCEPTION 'Order item snapshot is invalid'; END IF;

  SELECT * INTO v_date FROM public.pickup_dates WHERE id = v_order.pickup_date_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order pickup date no longer exists'; END IF;
  IF now() >= v_date.cancellation_cutoff_at THEN RAISE EXCEPTION 'Cancellation cutoff has passed for this order'; END IF;

  IF v_order.inventory_reserved THEN
    FOR v_item IN
      SELECT item.product_id, item.quantity
      FROM jsonb_to_recordset(v_order.order_items) AS item(product_id uuid, quantity integer)
      WHERE item.product_id IS NOT NULL AND item.quantity IS NOT NULL AND item.quantity > 0
      ORDER BY item.product_id
    LOOP
      SELECT * INTO v_inventory FROM public.product_date_inventory
      WHERE pickup_date_id = v_order.pickup_date_id AND product_id = v_item.product_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Inventory record is missing for a product in this order'; END IF;
      IF v_inventory.reserved_quantity < v_item.quantity THEN RAISE EXCEPTION 'Inventory reservation ledger is inconsistent for this order'; END IF;

      UPDATE public.product_date_inventory
      SET reserved_quantity = reserved_quantity - v_item.quantity, updated_at = now()
      WHERE pickup_date_id = v_order.pickup_date_id AND product_id = v_item.product_id;

      INSERT INTO public.inventory_events (
        pickup_date_id, product_id, order_id, event_type, reserved_delta, actor_id, reason
      ) VALUES (
        v_order.pickup_date_id, v_item.product_id, v_order.id, 'release',
        -v_item.quantity, v_user_id, 'customer_cancellation'
      );
    END LOOP;
  END IF;

  IF v_order.loyalty_points_awarded_at IS NOT NULL
     AND COALESCE(v_order.loyalty_points_earned, 0) > 0
     AND NOT EXISTS (SELECT 1 FROM public.loyalty_point_events e WHERE e.order_id = v_order.id AND e.event_type = 'reverse_earn') THEN
    PERFORM public.apply_loyalty_points_delta_v2(
      v_order.customer_id, -v_order.loyalty_points_earned, 'reverse_earn', v_order.id,
      NULL, v_user_id, 'Points reversed for customer cancellation',
      jsonb_build_object('purchase_type', 'online', 'flow', 'pickup_v2')
    );
  END IF;

  UPDATE public.orders SET status = 'cancelled'
  WHERE id = v_order.id RETURNING * INTO v_order;
  RETURN to_jsonb(v_order);
END;
$$;


ALTER FUNCTION "public"."cancel_online_order_v2_inventory_v1"("p_order_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."cancel_online_order_v2_inventory_v1"("p_order_id" "uuid") IS 'Prepared v2 customer cancellation RPC. Browser EXECUTE intentionally revoked until a separately approved frontend cutover migration.';



CREATE OR REPLACE FUNCTION "public"."check_vip_magic_link_rate_limit"("p_ip_hash" "text", "p_code_hash" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_window_start timestamptz;
  v_ip_count integer;
  v_code_count integer;
BEGIN
  IF p_ip_hash IS NULL OR p_code_hash IS NULL THEN
    RETURN false;
  END IF;

  v_window_start := date_trunc('hour', now())
    + floor(extract(minute FROM now()) / 15) * interval '15 minutes';

  INSERT INTO public.vip_magic_link_rate_limits (scope, key_hash, window_start)
  VALUES ('ip', p_ip_hash, v_window_start)
  ON CONFLICT (scope, key_hash, window_start)
  DO UPDATE SET request_count = vip_magic_link_rate_limits.request_count + 1
  RETURNING request_count INTO v_ip_count;

  INSERT INTO public.vip_magic_link_rate_limits (scope, key_hash, window_start)
  VALUES ('code', p_code_hash, v_window_start)
  ON CONFLICT (scope, key_hash, window_start)
  DO UPDATE SET request_count = vip_magic_link_rate_limits.request_count + 1
  RETURNING request_count INTO v_code_count;

  DELETE FROM public.vip_magic_link_rate_limits
  WHERE window_start < now() - interval '1 day';

  RETURN v_ip_count <= 20 AND v_code_count <= 5;
END;
$$;


ALTER FUNCTION "public"."check_vip_magic_link_rate_limit"("p_ip_hash" "text", "p_code_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."claim_order_notification"("p_order_id" "uuid", "p_notification_type" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_event public.order_notification_events%rowtype;
begin
  if p_order_id is null or p_notification_type not in ('customer_confirmation', 'admin_new_order') then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  if not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and coalesce(o.purchase_type, 'online') = 'online'
  ) then
    return jsonb_build_object('outcome', 'unavailable');
  end if;

  select * into v_event
  from public.order_notification_events
  where order_id = p_order_id
    and notification_type = p_notification_type
  for update;

  if not found then
    return jsonb_build_object('outcome', 'unavailable');
  end if;

  if v_event.status = 'sent' then
    return jsonb_build_object(
      'outcome', 'already_sent',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  end if;

  if v_event.status = 'uncertain' then
    return jsonb_build_object(
      'outcome', 'uncertain',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  end if;

  if v_event.status = 'processing'
     and v_event.claimed_at is not null
     and v_event.claimed_at > now() - interval '5 minutes' then
    return jsonb_build_object(
      'outcome', 'processing',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  end if;

  -- The provider's idempotency keys are retained for 24 hours. We use a
  -- conservative 23-hour ceiling measured from the immutable first attempt,
  -- not from the most recent claim, so repeated crash recovery cannot extend
  -- automatic retries past the deduplication window.
  if v_event.status = 'processing'
     and v_event.first_attempt_at is not null
     and v_event.first_attempt_at <= now() - interval '23 hours' then
    update public.order_notification_events
    set status = 'uncertain',
        updated_at = now(),
        last_error = coalesce(last_error, 'Processing outcome exceeded provider idempotency window')
    where id = v_event.id
    returning * into v_event;

    return jsonb_build_object(
      'outcome', 'uncertain',
      'event_id', v_event.id,
      'attempt_count', v_event.attempt_count,
      'language', v_event.language
    );
  end if;

  update public.order_notification_events
  set status = 'processing',
      first_attempt_at = coalesce(first_attempt_at, now()),
      claimed_at = now(),
      attempt_count = attempt_count + 1,
      updated_at = now(),
      last_error = null
  where id = v_event.id
  returning * into v_event;

  return jsonb_build_object(
    'outcome', 'claimed',
    'event_id', v_event.id,
    'attempt_count', v_event.attempt_count,
    'language', v_event.language
  );
end;
$$;


ALTER FUNCTION "public"."claim_order_notification"("p_order_id" "uuid", "p_notification_type" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "order_number" "text" NOT NULL,
    "order_items" "jsonb" DEFAULT '[]'::"jsonb",
    "total_amount" numeric(10,2) NOT NULL,
    "pickup_location_id" "uuid",
    "pickup_date" "date",
    "status" "text" DEFAULT 'pending'::"text",
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "line_id" "text",
    "customer_name" "text" NOT NULL,
    "customer_phone" "text" NOT NULL,
    "customer_email" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pickup_day" "text",
    "purchase_type" "text" DEFAULT 'online'::"text",
    "walk_in_amount" numeric(10,2),
    "staff_id" "uuid",
    "loyalty_multiplier" numeric(3,2) DEFAULT 1.0,
    "loyalty_points_earned" integer DEFAULT 0,
    "payment_method" "text",
    "picked_up_at" timestamp with time zone,
    "inventory_reserved" boolean DEFAULT false NOT NULL,
    "pickup_date_id" "uuid",
    "loyalty_points_awarded_at" timestamp with time zone,
    "loyalty_discount_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "amount_paid" numeric(10,2),
    "staff_request_key" "uuid",
    CONSTRAINT "orders_amount_paid_nonnegative" CHECK ((("amount_paid" IS NULL) OR ("amount_paid" >= (0)::numeric))),
    CONSTRAINT "orders_amount_paid_not_above_gross" CHECK ((("amount_paid" IS NULL) OR ("amount_paid" <= "total_amount"))),
    CONSTRAINT "orders_loyalty_discount_nonnegative" CHECK (("loyalty_discount_amount" >= (0)::numeric)),
    CONSTRAINT "orders_loyalty_discount_not_above_gross" CHECK (("loyalty_discount_amount" <= "total_amount")),
    CONSTRAINT "orders_pickup_date_requires_location" CHECK ((("pickup_date_id" IS NULL) OR ("pickup_location_id" IS NOT NULL))),
    CONSTRAINT "orders_unpaid_has_no_amount_paid" CHECK (((COALESCE("payment_status", 'unpaid'::"text") <> 'unpaid'::"text") OR ("amount_paid" IS NULL))),
    CONSTRAINT "valid_payment_status" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'paid'::"text"]))),
    CONSTRAINT "valid_purchase_type" CHECK (("purchase_type" = ANY (ARRAY['online'::"text", 'walk_in'::"text"]))),
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'ready'::"text", 'picked_up'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."orders"."inventory_reserved" IS 'True only when this order is known to have successfully reserved/decremented inventory. Used to decide whether cancellation may restore stock.';



COMMENT ON COLUMN "public"."orders"."pickup_date_id" IS 'Stable concrete pickup occurrence for v2 online orders. Null for legacy orders until separately reconciled.';



CREATE OR REPLACE FUNCTION "public"."confirm_order_pickup"("p_order_id" "uuid") RETURNS SETOF "public"."orders"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  IF v_order.payment_method IS NULL OR v_order.payment_method NOT IN ('cash', 'qr_code', 'qr') THEN RAISE EXCEPTION 'Valid payment method must be recorded before pickup'; END IF;
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


ALTER FUNCTION "public"."confirm_order_pickup"("p_order_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."confirm_order_pickup"("p_order_id" "uuid") IS 'Idempotently marks a non-cancelled order picked_up and records its actual pickup time; staff/admin only.';



CREATE OR REPLACE FUNCTION "public"."create_online_order"("p_order_number" "text", "p_pickup_day_key" "text", "p_items" "jsonb", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_user_id uuid := auth.uid();
  v_customer public.customers%rowtype;
  v_pickup public.cms_pickup_days%rowtype;
  v_cutoff public.pickup_cutoff_rules%rowtype;
  v_override public.pickup_overrides%rowtype;
  v_existing public.orders%rowtype;
  v_product public.cms_products%rowtype;
  v_order public.orders%rowtype;
  v_item record;
  v_now_bangkok timestamp := timezone('Asia/Bangkok', now());
  v_today_bangkok date;
  v_pickup_date date;
  v_cutoff_date date;
  v_cutoff_at timestamp;
  v_cutoff_weekday integer;
  v_cutoff_day text;
  v_cutoff_time text;
  v_item_count integer;
  v_distinct_item_count integer;
  v_invalid_item_count integer;
  v_stock integer;
  v_total numeric := 0;
  v_order_items jsonb := '[]'::jsonb;
  v_available_days jsonb;
  v_language text := 'en';
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_order_number is null or p_order_number !~ '^ORD-[0-9]{10,20}-[A-Z0-9]{4,12}$' then
    raise exception 'Invalid order reference';
  end if;
  if p_pickup_day_key is null or btrim(p_pickup_day_key) = '' then
    raise exception 'Pickup day is required';
  end if;
  if p_notes is not null and length(p_notes) > 2000 then
    raise exception 'Order notes are too long';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Order items must be an array';
  end if;
  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'Order must contain between 1 and 50 items';
  end if;

  select count(distinct item.product_id),
         count(*) filter (where item.product_id is null or item.quantity is null or item.quantity < 1 or item.quantity > 99)
  into v_distinct_item_count, v_invalid_item_count
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer);

  if v_invalid_item_count > 0 then
    raise exception 'Each order item requires a valid product and quantity from 1 to 99';
  end if;
  if v_distinct_item_count <> v_item_count then
    raise exception 'Duplicate products are not allowed in one order request';
  end if;

  select * into v_customer
  from public.customers
  where id = v_user_id
  for update;
  if not found then raise exception 'Completed customer profile required'; end if;
  if coalesce(v_customer.status, 'active') <> 'active' then raise exception 'Customer account is not active'; end if;

  select case lower(coalesce(up.preferred_language, 'en')) when 'th' then 'th' when 'zh' then 'zh' else 'en' end
  into v_language
  from public.user_profiles up
  where up.id = v_user_id;
  v_language := coalesce(v_language, 'en');

  select * into v_existing from public.orders where order_number = p_order_number;
  if found then
    if v_existing.customer_id is distinct from v_user_id or coalesce(v_existing.purchase_type, 'online') <> 'online' then
      raise exception 'Order reference conflict';
    end if;
    return to_jsonb(v_existing);
  end if;

  select * into v_pickup
  from public.cms_pickup_days
  where day_key = p_pickup_day_key and coalesce(is_open, false) = true;
  if not found then raise exception 'Selected pickup day is not available'; end if;
  if v_pickup.location_id is null then raise exception 'Selected pickup day has no pickup location'; end if;

  select * into v_cutoff
  from public.pickup_cutoff_rules
  where day_key = v_pickup.day_key and coalesce(is_active, false) = true;
  if not found then raise exception 'No active cutoff rule exists for the selected pickup day'; end if;

  v_today_bangkok := v_now_bangkok::date;
  v_pickup_date := v_today_bangkok + ((v_pickup.pickup_weekday - extract(dow from v_today_bangkok)::integer + 7) % 7);

  select * into v_override
  from public.pickup_overrides
  where date = v_pickup_date
    and pickup_day = v_cutoff.pickup_day
    and location = v_cutoff.location
    and coalesce(is_active, false) = true
  order by updated_at desc nulls last, created_at desc nulls last
  limit 1;

  if found and v_override.override_type in ('closed', 'sold_out') then
    raise exception 'Selected pickup day is unavailable';
  end if;

  if found and v_override.override_type = 'custom_cutoff' then
    if v_override.custom_cutoff_day is null or v_override.custom_cutoff_time is null then
      raise exception 'Invalid custom cutoff configuration';
    end if;
    v_cutoff_day := v_override.custom_cutoff_day;
    v_cutoff_time := v_override.custom_cutoff_time;
  else
    v_cutoff_day := v_cutoff.cutoff_day;
    v_cutoff_time := v_cutoff.cutoff_time;
  end if;

  v_cutoff_weekday := case v_cutoff_day
    when 'Sunday' then 0 when 'Monday' then 1 when 'Tuesday' then 2 when 'Wednesday' then 3
    when 'Thursday' then 4 when 'Friday' then 5 when 'Saturday' then 6 else null end;
  if v_cutoff_weekday is null then raise exception 'Invalid cutoff day configuration'; end if;

  begin
    v_cutoff_date := v_pickup_date - ((v_pickup.pickup_weekday - v_cutoff_weekday + 7) % 7);
    v_cutoff_at := v_cutoff_date::timestamp + v_cutoff_time::time;
  exception when invalid_datetime_format then
    raise exception 'Invalid cutoff time configuration';
  end;
  if v_now_bangkok >= v_cutoff_at then raise exception 'Ordering cutoff has passed for the selected pickup day'; end if;

  for v_item in
    select item.product_id, item.quantity
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    order by item.product_id
  loop
    select * into v_product from public.cms_products where id = v_item.product_id for update;
    if not found then raise exception 'A selected product no longer exists'; end if;
    if coalesce(v_product.is_active, false) = false or coalesce(v_product.is_sold_out, false) = true then
      raise exception 'Product % is not available', v_product.name_en;
    end if;

    v_available_days := coalesce(v_product.available_days, '[]'::jsonb);
    if jsonb_typeof(v_available_days) <> 'array' then raise exception 'Invalid availability configuration for product %', v_product.name_en; end if;
    if jsonb_array_length(v_available_days) > 0 and not (
      v_available_days ? v_pickup.day_key
      or v_available_days ? v_pickup.label
      or (v_pickup.label_en is not null and v_available_days ? v_pickup.label_en)
      or v_available_days ? (v_cutoff.pickup_day || ' – ' || v_cutoff.location)
      or v_available_days ? (v_cutoff.pickup_day || ' - ' || v_cutoff.location)
    ) then
      raise exception 'Product % is not offered for the selected pickup day', v_product.name_en;
    end if;

    v_stock := coalesce(
      nullif(v_product.stock_by_day ->> v_pickup.day_key, '')::integer,
      nullif(v_product.stock_by_day ->> v_pickup.label, '')::integer,
      nullif(v_product.stock_by_day ->> coalesce(v_pickup.label_en, v_pickup.label), '')::integer,
      nullif(v_product.stock_by_day ->> (v_cutoff.pickup_day || ' – ' || v_cutoff.location), '')::integer,
      nullif(v_product.stock_by_day ->> (v_cutoff.pickup_day || ' - ' || v_cutoff.location), '')::integer,
      v_product.stock_remaining,
      0
    );
    if v_stock < v_item.quantity then raise exception 'Insufficient stock for product %', v_product.name_en; end if;

    v_total := v_total + (v_product.price * v_item.quantity);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name_en,
      'product_name_th', v_product.name_th,
      'product_name_zh', coalesce(v_product.name_zh, ''),
      'quantity', v_item.quantity,
      'price_at_order', v_product.price
    ));

    update public.cms_products
    set stock_by_day = jsonb_set(coalesce(stock_by_day, '{}'::jsonb), array[v_pickup.day_key], to_jsonb(v_stock - v_item.quantity), true),
        updated_at = now()
    where id = v_product.id;
  end loop;

  insert into public.orders (
    customer_id, order_number, order_items, total_amount, pickup_location_id, pickup_date,
    status, payment_status, line_id, customer_name, customer_phone, customer_email, notes,
    pickup_day, purchase_type, inventory_reserved
  ) values (
    v_customer.id, p_order_number, v_order_items, v_total, v_pickup.location_id, v_pickup_date,
    'pending', 'unpaid', v_customer.line_id, v_customer.name, v_customer.phone, v_customer.email,
    nullif(btrim(coalesce(p_notes, '')), ''), coalesce(v_pickup.label_en, v_pickup.label), 'online', true
  ) returning * into v_order;

  insert into public.order_notification_events (order_id, notification_type, language)
  values
    (v_order.id, 'customer_confirmation', v_language),
    (v_order.id, 'admin_new_order', null)
  on conflict (order_id, notification_type) do nothing;

  return to_jsonb(v_order);
end;
$_$;


ALTER FUNCTION "public"."create_online_order"("p_order_number" "text", "p_pickup_day_key" "text", "p_items" "jsonb", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_online_order"("p_order_number" "text", "p_pickup_day_key" "text", "p_items" "jsonb", "p_notes" "text") IS 'Creates an authenticated online order atomically using server-authoritative customer, pickup, price, total, loyalty and stock data.';



CREATE OR REPLACE FUNCTION "public"."create_online_order_v2"("p_order_number" "text", "p_pickup_date_id" "uuid", "p_pickup_location_id" "uuid", "p_items" "jsonb", "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer public.customers%ROWTYPE;
  v_date public.pickup_dates%ROWTYPE;
  v_schedule public.pickup_schedules%ROWTYPE;
  v_existing public.orders%ROWTYPE;
  v_product public.cms_products%ROWTYPE;
  v_inventory public.product_date_inventory%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_item record;
  v_item_count integer;
  v_distinct_item_count integer;
  v_invalid_item_count integer;
  v_total numeric := 0;
  v_order_items jsonb := '[]'::jsonb;
  v_request_items_key jsonb := '[]'::jsonb;
  v_existing_items_key jsonb := '[]'::jsonb;
  v_normalized_notes text;
  v_today_bangkok date := timezone('Asia/Bangkok', now())::date;
  v_language text := 'en';
  v_recurring_active boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_order_number IS NULL OR p_order_number !~ '^ORD-[0-9]{10,20}-[A-Z0-9]{4,12}$' THEN
    RAISE EXCEPTION 'Invalid order reference';
  END IF;
  IF p_pickup_date_id IS NULL OR p_pickup_location_id IS NULL THEN
    RAISE EXCEPTION 'Pickup date and pickup location are required';
  END IF;
  IF p_notes IS NOT NULL AND length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'Order notes are too long';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Order items must be an array';
  END IF;

  v_item_count := jsonb_array_length(p_items);
  IF v_item_count < 1 OR v_item_count > 50 THEN
    RAISE EXCEPTION 'Order must contain between 1 and 50 items';
  END IF;

  SELECT count(DISTINCT item.product_id),
         count(*) FILTER (
           WHERE item.product_id IS NULL OR item.quantity IS NULL
              OR item.quantity < 1 OR item.quantity > 99
         ),
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'product_id', item.product_id::text,
               'quantity', item.quantity
             ) ORDER BY item.product_id
           ),
           '[]'::jsonb
         )
  INTO v_distinct_item_count, v_invalid_item_count, v_request_items_key
  FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer);

  IF v_invalid_item_count > 0 THEN
    RAISE EXCEPTION 'Each order item requires a valid product and quantity from 1 to 99';
  END IF;
  IF v_distinct_item_count <> v_item_count THEN
    RAISE EXCEPTION 'Duplicate products are not allowed in one order request';
  END IF;

  v_normalized_notes := NULLIF(btrim(COALESCE(p_notes, '')), '');

  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Completed customer profile required'; END IF;
  IF COALESCE(v_customer.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Customer account is not active';
  END IF;

  SELECT CASE lower(COALESCE(up.preferred_language, 'en'))
           WHEN 'th' THEN 'th'
           WHEN 'zh' THEN 'zh'
           ELSE 'en'
         END
  INTO v_language
  FROM public.user_profiles up
  WHERE up.id = v_user_id;
  v_language := COALESCE(v_language, 'en');

  SELECT * INTO v_existing
  FROM public.orders
  WHERE order_number = p_order_number;
  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM v_user_id
       OR COALESCE(v_existing.purchase_type, 'online') <> 'online'
       OR v_existing.pickup_date_id IS DISTINCT FROM p_pickup_date_id
       OR v_existing.pickup_location_id IS DISTINCT FROM p_pickup_location_id THEN
      RAISE EXCEPTION 'Order reference conflict';
    END IF;

    IF v_existing.order_items IS NULL OR jsonb_typeof(v_existing.order_items) <> 'array' THEN
      RAISE EXCEPTION 'Existing order snapshot is invalid for idempotent retry';
    END IF;

    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'product_id', item.product_id::text,
          'quantity', item.quantity
        ) ORDER BY item.product_id
      ),
      '[]'::jsonb
    )
    INTO v_existing_items_key
    FROM jsonb_to_recordset(v_existing.order_items)
      AS item(product_id uuid, quantity integer);

    IF v_existing_items_key IS DISTINCT FROM v_request_items_key
       OR COALESCE(NULLIF(btrim(COALESCE(v_existing.notes, '')), ''), '')
          IS DISTINCT FROM COALESCE(v_normalized_notes, '') THEN
      RAISE EXCEPTION 'Order reference conflict: request payload differs from the existing order';
    END IF;

    RETURN to_jsonb(v_existing);
  END IF;

  SELECT * INTO v_date
  FROM public.pickup_dates
  WHERE id = p_pickup_date_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected pickup date does not exist'; END IF;
  IF v_date.status <> 'open' THEN RAISE EXCEPTION 'Selected pickup date is unavailable'; END IF;
  IF v_date.pickup_date < v_today_bangkok THEN RAISE EXCEPTION 'Selected pickup date is in the past'; END IF;
  IF now() >= v_date.order_cutoff_at THEN
    RAISE EXCEPTION 'Ordering cutoff has passed for the selected pickup date';
  END IF;

  SELECT * INTO v_schedule
  FROM public.pickup_schedules
  WHERE id = v_date.schedule_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup schedule is not active'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pickup_date_locations dl
    JOIN public.cms_pickup_locations l ON l.id = dl.location_id
    WHERE dl.pickup_date_id = p_pickup_date_id
      AND dl.location_id = p_pickup_location_id
      AND dl.is_active = true
      AND l.is_active = true
  ) THEN
    RAISE EXCEPTION 'Selected pickup location is not available for this date';
  END IF;

  FOR v_item IN
    SELECT item.product_id, item.quantity
    FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
    ORDER BY item.product_id
  LOOP
    SELECT * INTO v_product
    FROM public.cms_products
    WHERE id = v_item.product_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'A selected product no longer exists'; END IF;
    IF COALESCE(v_product.is_active, false) = false
       OR COALESCE(v_product.is_sold_out, false) = true THEN
      RAISE EXCEPTION 'Product % is not available', v_product.name_en;
    END IF;

    v_recurring_active := NULL;
    SELECT c.is_active INTO v_recurring_active
    FROM public.product_schedule_capacity c
    WHERE c.schedule_id = v_date.schedule_id
      AND c.product_id = v_item.product_id
    FOR SHARE;

    SELECT * INTO v_inventory
    FROM public.product_date_inventory
    WHERE pickup_date_id = p_pickup_date_id
      AND product_id = v_item.product_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % is not offered for the selected pickup date', v_product.name_en;
    END IF;
    IF v_inventory.capacity_source = 'recurring_default'
       AND COALESCE(v_recurring_active, false) = false THEN
      RAISE EXCEPTION 'Product % is not active for this pickup schedule', v_product.name_en;
    END IF;
    IF (v_inventory.capacity - v_inventory.reserved_quantity) < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product.name_en;
    END IF;

    v_total := v_total + (v_product.price * v_item.quantity);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', v_product.name_en,
      'product_name_th', v_product.name_th,
      'product_name_zh', COALESCE(v_product.name_zh, ''),
      'quantity', v_item.quantity,
      'price_at_order', v_product.price
    ));
  END LOOP;

  INSERT INTO public.orders (
    customer_id, order_number, order_items, total_amount,
    pickup_location_id, pickup_date, pickup_date_id,
    status, payment_status, line_id,
    customer_name, customer_phone, customer_email, notes,
    pickup_day, purchase_type, inventory_reserved
  ) VALUES (
    v_customer.id, p_order_number, v_order_items, v_total,
    p_pickup_location_id, v_date.pickup_date, v_date.id,
    'pending', 'unpaid', v_customer.line_id,
    v_customer.name, v_customer.phone, v_customer.email,
    v_normalized_notes,
    v_schedule.label_en, 'online', true
  ) RETURNING * INTO v_order;

  FOR v_item IN
    SELECT item.product_id, item.quantity
    FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer)
    ORDER BY item.product_id
  LOOP
    UPDATE public.product_date_inventory
    SET reserved_quantity = reserved_quantity + v_item.quantity,
        updated_at = now()
    WHERE pickup_date_id = p_pickup_date_id
      AND product_id = v_item.product_id
      AND reserved_quantity + v_item.quantity <= capacity;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory changed while placing the order; please retry';
    END IF;

    INSERT INTO public.inventory_events (
      pickup_date_id, product_id, order_id, event_type,
      reserved_delta, actor_id, reason
    ) VALUES (
      p_pickup_date_id, v_item.product_id, v_order.id,
      'reserve', v_item.quantity, v_user_id, 'online_order'
    );
  END LOOP;

  INSERT INTO public.order_notification_events (
    order_id, notification_type, language
  ) VALUES
    (v_order.id, 'customer_confirmation', v_language),
    (v_order.id, 'admin_new_order', NULL)
  ON CONFLICT (order_id, notification_type) DO NOTHING;

  RETURN to_jsonb(v_order);
END;
$_$;


ALTER FUNCTION "public"."create_online_order_v2"("p_order_number" "text", "p_pickup_date_id" "uuid", "p_pickup_location_id" "uuid", "p_items" "jsonb", "p_notes" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_online_order_v2"("p_order_number" "text", "p_pickup_date_id" "uuid", "p_pickup_location_id" "uuid", "p_items" "jsonb", "p_notes" "text") IS 'Prepared v2 customer checkout RPC. Browser EXECUTE intentionally revoked until a separately approved frontend cutover migration.';



CREATE OR REPLACE FUNCTION "public"."create_user_profile_with_qr"("p_email" "text", "p_name" "text", "p_phone" "text", "p_qr_token" "text", "p_line_id" "text" DEFAULT NULL::"text", "p_whatsapp" "text" DEFAULT NULL::"text", "p_wechat_id" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_user_id uuid;
v_short_code text;
v_result json;
BEGIN
v_user_id := auth.uid();

IF v_user_id IS NULL THEN
RAISE EXCEPTION 'Not authenticated';
END IF;

IF EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id) THEN
RAISE EXCEPTION 'Profile already exists';
END IF;

v_short_code := generate_next_short_code();

INSERT INTO user_profiles (
id,
name,
phone,
line_id,
whatsapp,
wechat_id,
profile_completed,
qr_token,
short_code
) VALUES (
v_user_id,
p_name,
p_phone,
p_line_id,
p_whatsapp,
p_wechat_id,
false,
p_qr_token,
v_short_code
);

INSERT INTO customers (
id,
email,
name,
phone,
line_id,
whatsapp,
wechat_id,
qr_token,
short_code
) VALUES (
v_user_id,
p_email,
p_name,
p_phone,
p_line_id,
p_whatsapp,
p_wechat_id,
p_qr_token,
v_short_code
);

SELECT json_build_object(
'id', v_user_id,
'short_code', v_short_code,
'qr_token', p_qr_token
) INTO v_result;

RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."create_user_profile_with_qr"("p_email" "text", "p_name" "text", "p_phone" "text", "p_qr_token" "text", "p_line_id" "text", "p_whatsapp" "text", "p_wechat_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_order_notification"("p_event_id" "uuid", "p_outcome" "text", "p_provider_message_id" "text" DEFAULT NULL::"text", "p_error" "text" DEFAULT NULL::"text") RETURNS boolean
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_event public.order_notification_events%rowtype;
begin
  if p_event_id is null or p_outcome not in ('sent', 'failed', 'uncertain') then return false; end if;

  select e.* into v_event
  from public.order_notification_events e
  where e.id = p_event_id
  for update;

  if not found or v_event.status <> 'processing' then return false; end if;

  update public.order_notification_events
  set status = p_outcome,
      sent_at = case when p_outcome = 'sent' then now() else sent_at end,
      provider_message_id = case when p_provider_message_id is null then provider_message_id else left(p_provider_message_id, 500) end,
      last_error = case when p_error is null then null else left(p_error, 1000) end,
      updated_at = now()
  where id = v_event.id;

  return true;
end;
$$;


ALTER FUNCTION "public"."finish_order_notification"("p_event_id" "uuid", "p_outcome" "text", "p_provider_message_id" "text", "p_error" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_next_short_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $_$
DECLARE
v_max_number integer;
v_new_code text;
BEGIN
SELECT GREATEST(
COALESCE(
(SELECT MAX(CAST(SUBSTRING(short_code, 4) AS integer))
FROM customers
WHERE short_code ~ '^VIP[0-9]+$'),
100
),
COALESCE(
(SELECT MAX(CAST(SUBSTRING(short_code, 4) AS integer))
FROM user_profiles
WHERE short_code ~ '^VIP[0-9]+$'),
100
)
) INTO v_max_number;

v_new_code := 'VIP' || (v_max_number + 1)::text;

RETURN v_new_code;
END;
$_$;


ALTER FUNCTION "public"."generate_next_short_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_qr_token"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
RETURN upper(
to_hex(floor(random() * 2147483647)::int) ||
to_hex(floor(random() * 2147483647)::int) ||
to_hex(floor(random() * 2147483647)::int)
);
END;
$$;


ALTER FUNCTION "public"."generate_qr_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_cms_pickup_location_deactivation_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.is_active, false) = true
     AND COALESCE(NEW.is_active, false) = false THEN
    PERFORM s.id
    FROM public.pickup_schedules s
    JOIN public.pickup_schedule_locations sl ON sl.schedule_id = s.id
    WHERE sl.location_id = OLD.id
      AND s.is_active = true
      AND sl.is_active = true
    ORDER BY s.id
    FOR UPDATE OF s;

    IF FOUND THEN
      RAISE EXCEPTION
        'Pickup location is used by an active v2 recurring schedule; reassign or deactivate that schedule first';
    END IF;

    PERFORM d.id
    FROM public.pickup_dates d
    JOIN public.pickup_date_locations dl ON dl.pickup_date_id = d.id
    WHERE dl.location_id = OLD.id
      AND dl.is_active = true
      AND d.status = 'open'
      AND d.pickup_date >= timezone('Asia/Bangkok', now())::date
    ORDER BY d.id
    FOR UPDATE OF d;

    IF FOUND THEN
      RAISE EXCEPTION
        'Pickup location is used by a future open v2 pickup date; update that concrete date first';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_cms_pickup_location_deactivation_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_customer_loyalty_balance_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.loyalty_points IS DISTINCT FROM OLD.loyalty_points
     AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'Loyalty balance is server-controlled' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_customer_loyalty_balance_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_order_loyalty_payment_fields_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') AND (
       NEW.loyalty_discount_amount IS DISTINCT FROM OLD.loyalty_discount_amount
       OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
       OR NEW.staff_request_key IS DISTINCT FROM OLD.staff_request_key
     ) THEN
    RAISE EXCEPTION 'Loyalty discount and paid amount are server-controlled' USING ERRCODE = '42501';
  END IF;
  IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid'
     AND COALESCE(NEW.loyalty_discount_amount, 0) > 0
     AND NEW.amount_paid IS DISTINCT FROM round(NEW.total_amount - NEW.loyalty_discount_amount, 2) THEN
    RAISE EXCEPTION 'Discounted orders must record the net amount paid through the staff payment flow';
  END IF;
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."guard_order_loyalty_payment_fields_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_pickup_schedule_lifecycle_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_today date := timezone('Asia/Bangkok', now())::date;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.pickup_weekday IS DISTINCT FROM NEW.pickup_weekday
     AND EXISTS (SELECT 1 FROM public.pickup_dates d WHERE d.schedule_id = OLD.id) THEN
    RAISE EXCEPTION 'Pickup weekday cannot change after concrete dates have been materialized; use concrete-date overrides or a reviewed schedule transition';
  END IF;
  IF COALESCE(NEW.is_active, false) AND EXISTS (
    SELECT 1 FROM public.pickup_dates d
    WHERE d.schedule_id IS DISTINCT FROM NEW.id
      AND d.pickup_date >= v_today
      AND extract(dow FROM d.pickup_date)::integer = NEW.pickup_weekday
  ) THEN
    RAISE EXCEPTION 'Another schedule already owns future concrete dates for this weekday; reconcile those dates before activating this schedule';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_pickup_schedule_lifecycle_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."guard_v2_order_pickup_selection"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_date public.pickup_dates%ROWTYPE;
  v_date_location_active boolean;
  v_location_active boolean;
BEGIN
  IF NEW.pickup_date_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.purchase_type, 'online') <> 'online' THEN RAISE EXCEPTION 'Concrete pickup-date identity is reserved for online v2 orders'; END IF;
  IF NEW.pickup_location_id IS NULL THEN RAISE EXCEPTION 'A v2 order requires a pickup location'; END IF;
  SELECT d.* INTO v_date FROM public.pickup_dates d WHERE d.id = NEW.pickup_date_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected pickup date does not exist'; END IF;
  IF NEW.pickup_date IS DISTINCT FROM v_date.pickup_date THEN RAISE EXCEPTION 'Order pickup-date snapshot does not match pickup_date_id'; END IF;
  IF v_date.status <> 'open' THEN RAISE EXCEPTION 'Selected pickup date is unavailable'; END IF;
  IF v_date.pickup_date < timezone('Asia/Bangkok', now())::date THEN RAISE EXCEPTION 'Selected pickup date is in the past'; END IF;
  IF now() >= v_date.order_cutoff_at THEN RAISE EXCEPTION 'Ordering cutoff has passed for the selected pickup date'; END IF;
  SELECT dl.is_active, l.is_active INTO v_date_location_active, v_location_active
  FROM public.pickup_date_locations dl
  JOIN public.cms_pickup_locations l ON l.id = dl.location_id
  WHERE dl.pickup_date_id = NEW.pickup_date_id AND dl.location_id = NEW.pickup_location_id
  FOR SHARE OF dl, l;
  IF NOT FOUND OR COALESCE(v_date_location_active,false)=false OR COALESCE(v_location_active,false)=false THEN
    RAISE EXCEPTION 'Selected pickup location is not available for this date';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."guard_v2_order_pickup_selection"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_short_code text;
v_qr_token text;
BEGIN
v_short_code := generate_next_short_code();
v_qr_token   := generate_qr_token();

INSERT INTO public.user_profiles (
id,
email,
name,
phone,
role,
profile_completed,
qr_token,
short_code,
created_at,
updated_at
)
VALUES (
NEW.id,
NEW.email,
COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
'',
'customer',
false,
v_qr_token,
v_short_code,
now(),
now()
)
ON CONFLICT (id) DO NOTHING;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_stock_remaining"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.stock_remaining IS NULL THEN
    NEW.stock_remaining := NEW.stock_total;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."initialize_stock_remaining"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_staff_or_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = auth.uid()
      AND role IN ('staff'::user_role, 'admin'::user_role)
  );
$$;


ALTER FUNCTION "public"."is_staff_or_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."materialize_pickup_dates_v2"("p_start_date" "date", "p_end_date" "date") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inserted integer := 0;
  v_inserted_date_ids uuid[] := ARRAY[]::uuid[];
  v_date record;
  v_override public.pickup_overrides%ROWTYPE;
  v_custom_cutoff_weekday integer;
  v_custom_cutoff_date date;
  v_today_bangkok date := timezone('Asia/Bangkok', now())::date;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = v_user_id AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'A valid pickup date range is required';
  END IF;
  IF p_start_date < v_today_bangkok THEN
    RAISE EXCEPTION 'Pickup date materialization cannot start in the past';
  END IF;
  /* Difference 365 means exactly 366 inclusive calendar dates. */
  IF p_end_date - p_start_date >= 366 THEN
    RAISE EXCEPTION 'Pickup date materialization is limited to 366 inclusive days per call';
  END IF;

  /*
    Stabilize both recurring v2 configuration and the transitional legacy
    override bridge. These tables are intentionally small Admin configuration
    tables. SHARE allows SELECT/ROW SHARE readers but blocks DML until this
    transaction finishes, including inserts of rows that row-level locks cannot
    protect against.

    Lock order begins with cms_pickup_locations, matching the v2 Admin lock
    order established by the preceding integrity migration.
  */
  LOCK TABLE public.cms_pickup_locations IN SHARE MODE;
  LOCK TABLE public.pickup_schedules IN SHARE MODE;
  LOCK TABLE public.pickup_schedule_locations IN SHARE MODE;
  LOCK TABLE public.product_schedule_capacity IN SHARE MODE;
  LOCK TABLE public.pickup_cutoff_rules IN SHARE MODE;
  LOCK TABLE public.pickup_overrides IN SHARE MODE;

  /*
    Existing concrete dates are independent snapshots, but legacy-override
    refreshes below can mutate non-manual dates. Serialize those date rows with
    concrete-date Admin writes while leaving recurring configuration protected
    by the table locks above.
  */
  PERFORM d.id
  FROM public.pickup_dates d
  WHERE d.pickup_date BETWEEN p_start_date AND p_end_date
  ORDER BY d.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.pickup_schedules s
    WHERE s.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM public.pickup_schedule_locations sl
        JOIN public.cms_pickup_locations l ON l.id = sl.location_id
        WHERE sl.schedule_id = s.id
          AND sl.is_active = true
          AND l.is_active = true
      )
  ) THEN
    RAISE EXCEPTION 'Every active pickup schedule requires at least one globally active pickup location before materialization';
  END IF;

  /*
    Capture exactly the rows inserted by THIS call. Recurring locations and
    capacities are copied only to those new dates. Re-running materialization
    therefore cannot expand an existing generated/manual date snapshot.
  */
  WITH inserted_dates AS (
    INSERT INTO public.pickup_dates (
      schedule_id, pickup_date, order_cutoff_at, cancellation_cutoff_at, status, source
    )
    SELECT
      s.id,
      gs.day_value::date,
      (((gs.day_value::date - s.order_cutoff_days_before::integer) + s.order_cutoff_time)
        AT TIME ZONE 'Asia/Bangkok'),
      (((gs.day_value::date - s.cancellation_cutoff_days_before::integer) + s.cancellation_cutoff_time)
        AT TIME ZONE 'Asia/Bangkok'),
      'open',
      'generated'
    FROM public.pickup_schedules s
    CROSS JOIN LATERAL generate_series(
      p_start_date::timestamp,
      p_end_date::timestamp,
      interval '1 day'
    ) AS gs(day_value)
    WHERE s.is_active = true
      AND extract(dow FROM gs.day_value)::integer = s.pickup_weekday
    ON CONFLICT (schedule_id, pickup_date) DO NOTHING
    RETURNING id
  )
  SELECT
    COALESCE(array_agg(id), ARRAY[]::uuid[]),
    count(*)::integer
  INTO v_inserted_date_ids, v_inserted
  FROM inserted_dates;

  INSERT INTO public.pickup_date_locations (
    pickup_date_id, location_id, is_active, sort_order
  )
  SELECT d.id, sl.location_id, true, sl.sort_order
  FROM public.pickup_dates d
  JOIN public.pickup_schedule_locations sl ON sl.schedule_id = d.schedule_id
  JOIN public.cms_pickup_locations l ON l.id = sl.location_id
  WHERE d.id = ANY(v_inserted_date_ids)
    AND sl.is_active = true
    AND l.is_active = true
  ON CONFLICT (pickup_date_id, location_id) DO NOTHING;

  INSERT INTO public.product_date_inventory (
    pickup_date_id, product_id, capacity, reserved_quantity, capacity_source
  )
  SELECT d.id, c.product_id, c.capacity, 0, 'recurring_default'
  FROM public.pickup_dates d
  JOIN public.product_schedule_capacity c ON c.schedule_id = d.schedule_id
  WHERE d.id = ANY(v_inserted_date_ids)
    AND c.is_active = true
  ON CONFLICT (pickup_date_id, product_id) DO NOTHING;

  /*
    Transitional legacy overrides may still be refreshed on non-manual dates.
    Explicit Admin concrete-date edits remain protected by source='manual'.
  */
  UPDATE public.pickup_dates d
  SET order_cutoff_at = (((d.pickup_date - s.order_cutoff_days_before::integer) + s.order_cutoff_time)
        AT TIME ZONE 'Asia/Bangkok'),
      cancellation_cutoff_at = (((d.pickup_date - s.cancellation_cutoff_days_before::integer) + s.cancellation_cutoff_time)
        AT TIME ZONE 'Asia/Bangkok'),
      status = 'open',
      note_en = NULL,
      note_th = NULL,
      note_zh = NULL,
      source = 'generated',
      updated_at = now()
  FROM public.pickup_schedules s
  WHERE d.schedule_id = s.id
    AND d.pickup_date BETWEEN p_start_date AND p_end_date
    AND d.source = 'legacy_override';

  FOR v_date IN
    SELECT d.id, d.pickup_date, d.source, s.pickup_weekday, s.legacy_day_key
    FROM public.pickup_dates d
    JOIN public.pickup_schedules s ON s.id = d.schedule_id
    WHERE d.pickup_date BETWEEN p_start_date AND p_end_date
      AND s.legacy_day_key IS NOT NULL
      AND d.source <> 'manual'
    ORDER BY d.id
  LOOP
    SELECT o.* INTO v_override
    FROM public.pickup_overrides o
    JOIN public.pickup_cutoff_rules r
      ON r.day_key = v_date.legacy_day_key
     AND r.pickup_day = o.pickup_day
     AND r.location = o.location
    WHERE o.date = v_date.pickup_date
      AND COALESCE(o.is_active, false) = true
    ORDER BY o.updated_at DESC NULLS LAST, o.created_at DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      IF v_override.override_type = 'closed' THEN
        UPDATE public.pickup_dates
        SET status = 'closed',
            note_en = NULLIF(v_override.note_en, ''),
            note_th = NULLIF(v_override.note_th, ''),
            source = 'legacy_override',
            updated_at = now()
        WHERE id = v_date.id
          AND source <> 'manual';
      ELSIF v_override.override_type = 'sold_out' THEN
        UPDATE public.pickup_dates
        SET status = 'sold_out',
            note_en = NULLIF(v_override.note_en, ''),
            note_th = NULLIF(v_override.note_th, ''),
            source = 'legacy_override',
            updated_at = now()
        WHERE id = v_date.id
          AND source <> 'manual';
      ELSIF v_override.override_type = 'custom_cutoff' THEN
        v_custom_cutoff_weekday := CASE v_override.custom_cutoff_day
          WHEN 'Sunday' THEN 0
          WHEN 'Monday' THEN 1
          WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3
          WHEN 'Thursday' THEN 4
          WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6
          ELSE NULL
        END;
        IF v_custom_cutoff_weekday IS NULL OR v_override.custom_cutoff_time IS NULL THEN
          RAISE EXCEPTION 'Invalid legacy custom cutoff for pickup date %', v_date.pickup_date;
        END IF;
        v_custom_cutoff_date := v_date.pickup_date
          - ((v_date.pickup_weekday - v_custom_cutoff_weekday + 7) % 7);
        UPDATE public.pickup_dates
        SET order_cutoff_at = ((v_custom_cutoff_date + v_override.custom_cutoff_time::time)
              AT TIME ZONE 'Asia/Bangkok'),
            note_en = NULLIF(v_override.note_en, ''),
            note_th = NULLIF(v_override.note_th, ''),
            source = 'legacy_override',
            updated_at = now()
        WHERE id = v_date.id
          AND source <> 'manual';
      END IF;
    END IF;
  END LOOP;

  RETURN v_inserted;
END;
$$;


ALTER FUNCTION "public"."materialize_pickup_dates_v2"("p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_inventory_event_mutation_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RAISE EXCEPTION 'inventory_events is append-only; write a compensating adjustment event instead';
END;
$$;


ALTER FUNCTION "public"."prevent_inventory_event_mutation_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_walk_in_purchase"("p_customer_id" "uuid", "p_amount" numeric, "p_order_number" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff_or_admin() THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;
  RAISE EXCEPTION 'Walk-In payment capture has been upgraded; refresh the staff application before recording a sale' USING ERRCODE='P0001';
END; $$;


ALTER FUNCTION "public"."record_walk_in_purchase"("p_customer_id" "uuid", "p_amount" numeric, "p_order_number" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_walk_in_purchase_v2"("p_customer_id" "uuid", "p_amount" numeric, "p_order_number" "text", "p_reward_id" "uuid", "p_request_key" "uuid", "p_payment_method" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
 v_actor_id uuid:=auth.uid(); v_customer public.customers%ROWTYPE; v_existing_order public.orders%ROWTYPE; v_order public.orders%ROWTYPE; v_reward public.loyalty_rewards%ROWTYPE; v_existing_redemption public.loyalty_redemptions%ROWTYPE;
 v_gross numeric(10,2); v_discount numeric(10,2):=0; v_net_paid numeric(10,2); v_rate numeric; v_points_earned integer; v_points_redeemed integer:=0; v_balance integer; v_customer_redemptions integer; v_total_redemptions integer; v_redemption_id uuid; v_snapshot jsonb; v_manual_fulfillment boolean:=false;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_staff_or_admin() THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;
  IF p_customer_id IS NULL OR p_request_key IS NULL THEN RAISE EXCEPTION 'Customer and request key are required'; END IF;
  IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Purchase amount must be greater than zero'; END IF;
  IF p_order_number IS NULL OR p_order_number !~ '^WI-[A-Za-z0-9-]+$' THEN RAISE EXCEPTION 'Invalid walk-in purchase reference'; END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash','qr_code') THEN RAISE EXCEPTION 'Walk-in payment method must be cash or qr_code'; END IF;
  v_gross:=round(p_amount,2);
  SELECT * INTO v_existing_order FROM public.orders o WHERE o.staff_request_key=p_request_key OR o.order_number=p_order_number ORDER BY (o.staff_request_key=p_request_key) DESC LIMIT 1;
  IF FOUND THEN
    IF v_existing_order.customer_id IS DISTINCT FROM p_customer_id OR v_existing_order.purchase_type IS DISTINCT FROM 'walk_in' OR round(v_existing_order.total_amount,2) IS DISTINCT FROM v_gross OR v_existing_order.order_number IS DISTINCT FROM p_order_number OR v_existing_order.payment_method IS DISTINCT FROM p_payment_method THEN RAISE EXCEPTION 'Walk-in purchase request conflicts with an existing sale'; END IF;
    SELECT * INTO v_existing_redemption FROM public.loyalty_redemptions r WHERE r.order_id=v_existing_order.id AND r.status<>'reversed' ORDER BY r.created_at,r.id LIMIT 1;
    IF (p_reward_id IS NULL) IS DISTINCT FROM (v_existing_redemption.id IS NULL) OR (p_reward_id IS NOT NULL AND v_existing_redemption.reward_id IS DISTINCT FROM p_reward_id) THEN RAISE EXCEPTION 'Walk-in purchase retry uses a different reward'; END IF;
    SELECT COALESCE(c.loyalty_points,0) INTO v_balance FROM public.customers c WHERE c.id=p_customer_id;
    RETURN jsonb_build_object('order_id',v_existing_order.id,'order_number',v_existing_order.order_number,'gross_amount',v_existing_order.total_amount,'discount_amount',COALESCE(v_existing_order.loyalty_discount_amount,0),'amount_paid',COALESCE(v_existing_order.amount_paid,v_existing_order.total_amount),'payment_method',v_existing_order.payment_method,'points_redeemed',COALESCE(v_existing_redemption.points_spent,0),'points_earned',COALESCE(v_existing_order.loyalty_points_earned,0),'updated_balance',v_balance,'reward_id',v_existing_redemption.reward_id,'reward_type',v_existing_redemption.reward_snapshot->>'reward_type','reward_name_en',v_existing_redemption.reward_snapshot->>'name_en','reward_name_th',v_existing_redemption.reward_snapshot->>'name_th','manual_fulfillment_required',COALESCE((v_existing_redemption.reward_snapshot->>'manual_fulfillment_required')::boolean,false),'idempotent_replay',true);
  END IF;
  SELECT * INTO v_customer FROM public.customers WHERE id=p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  SELECT * INTO v_existing_order FROM public.orders o WHERE o.staff_request_key=p_request_key OR o.order_number=p_order_number ORDER BY (o.staff_request_key=p_request_key) DESC LIMIT 1;
  IF FOUND THEN
    IF v_existing_order.customer_id IS DISTINCT FROM p_customer_id OR v_existing_order.purchase_type IS DISTINCT FROM 'walk_in' OR round(v_existing_order.total_amount,2) IS DISTINCT FROM v_gross OR v_existing_order.order_number IS DISTINCT FROM p_order_number OR v_existing_order.payment_method IS DISTINCT FROM p_payment_method THEN RAISE EXCEPTION 'Walk-in purchase request conflicts with an existing sale'; END IF;
    SELECT * INTO v_existing_redemption FROM public.loyalty_redemptions r WHERE r.order_id=v_existing_order.id AND r.status<>'reversed' ORDER BY r.created_at,r.id LIMIT 1;
    IF (p_reward_id IS NULL) IS DISTINCT FROM (v_existing_redemption.id IS NULL) OR (p_reward_id IS NOT NULL AND v_existing_redemption.reward_id IS DISTINCT FROM p_reward_id) THEN RAISE EXCEPTION 'Walk-in purchase retry uses a different reward'; END IF;
    RETURN jsonb_build_object('order_id',v_existing_order.id,'order_number',v_existing_order.order_number,'gross_amount',v_existing_order.total_amount,'discount_amount',COALESCE(v_existing_order.loyalty_discount_amount,0),'amount_paid',COALESCE(v_existing_order.amount_paid,v_existing_order.total_amount),'payment_method',v_existing_order.payment_method,'points_redeemed',COALESCE(v_existing_redemption.points_spent,0),'points_earned',COALESCE(v_existing_order.loyalty_points_earned,0),'updated_balance',COALESCE(v_customer.loyalty_points,0),'reward_id',v_existing_redemption.reward_id,'reward_type',v_existing_redemption.reward_snapshot->>'reward_type','reward_name_en',v_existing_redemption.reward_snapshot->>'name_en','reward_name_th',v_existing_redemption.reward_snapshot->>'name_th','manual_fulfillment_required',COALESCE((v_existing_redemption.reward_snapshot->>'manual_fulfillment_required')::boolean,false),'idempotent_replay',true);
  END IF;
  IF p_reward_id IS NOT NULL THEN
    SELECT * INTO v_reward FROM public.loyalty_rewards WHERE id=p_reward_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found'; END IF;
    IF NOT v_reward.is_active OR (v_reward.starts_at IS NOT NULL AND v_reward.starts_at>now()) OR (v_reward.ends_at IS NOT NULL AND v_reward.ends_at<=now()) THEN RAISE EXCEPTION 'Reward is not currently available'; END IF;
    IF NOT ('walk_in'=ANY(v_reward.channels)) THEN RAISE EXCEPTION 'Reward is not available for walk-in purchases'; END IF;
    IF v_reward.reward_type='free_product' THEN RAISE EXCEPTION 'Free-product redemption is not available until inventory-aware fulfillment is enabled'; END IF;
    IF v_reward.minimum_order_amount>v_gross THEN RAISE EXCEPTION 'Minimum order amount for this reward is not met'; END IF;
    IF v_reward.per_customer_limit IS NOT NULL THEN SELECT count(*)::integer INTO v_customer_redemptions FROM public.loyalty_redemptions r WHERE r.customer_id=p_customer_id AND r.reward_id=p_reward_id AND r.status<>'reversed'; IF v_customer_redemptions>=v_reward.per_customer_limit THEN RAISE EXCEPTION 'Customer redemption limit reached for this reward'; END IF; END IF;
    IF v_reward.total_redemption_limit IS NOT NULL THEN SELECT count(*)::integer INTO v_total_redemptions FROM public.loyalty_redemptions r WHERE r.reward_id=p_reward_id AND r.status<>'reversed'; IF v_total_redemptions>=v_reward.total_redemption_limit THEN RAISE EXCEPTION 'Reward redemption limit reached'; END IF; END IF;
    IF COALESCE(v_customer.loyalty_points,0)<v_reward.points_required THEN RAISE EXCEPTION 'Insufficient loyalty points'; END IF;
    IF v_reward.reward_type='fixed_discount' THEN v_discount:=LEAST(v_gross,v_reward.fixed_discount_amount)::numeric(10,2);
    ELSIF v_reward.reward_type='percentage_discount' THEN v_discount:=round(v_gross*v_reward.percentage_discount/100.0,2); IF v_reward.max_discount_amount IS NOT NULL THEN v_discount:=LEAST(v_discount,v_reward.max_discount_amount); END IF; v_discount:=LEAST(v_discount,v_gross)::numeric(10,2);
    ELSE v_discount:=0; v_manual_fulfillment:=true; END IF;
    v_points_redeemed:=v_reward.points_required;
  END IF;
  v_net_paid:=round(v_gross-v_discount,2);
  SELECT COALESCE(ls.points_per_baht,round(ls.points_percentage/100.0,5),0) INTO v_rate FROM public.loyalty_settings ls WHERE ls.purchase_type='walk_in';
  v_rate:=COALESCE(v_rate,0); v_points_earned:=round(v_net_paid*v_rate);
  INSERT INTO public.orders(customer_id,purchase_type,walk_in_amount,staff_id,order_number,order_items,total_amount,loyalty_discount_amount,amount_paid,staff_request_key,status,payment_status,payment_method,customer_name,customer_phone,customer_email,loyalty_multiplier,loyalty_points_earned,created_at,updated_at)
  VALUES(v_customer.id,'walk_in',v_gross,v_actor_id,p_order_number,'[]'::jsonb,v_gross,v_discount,v_net_paid,p_request_key,'completed','paid',p_payment_method,v_customer.name,v_customer.phone,v_customer.email,v_rate,v_points_earned,now(),now()) RETURNING * INTO v_order;
  v_points_earned:=COALESCE(v_order.loyalty_points_earned,0); v_balance:=COALESCE(v_customer.loyalty_points,0);
  IF p_reward_id IS NOT NULL THEN
    v_snapshot:=jsonb_build_object('reward_key',v_reward.reward_key,'name_en',v_reward.name_en,'name_th',v_reward.name_th,'name_zh',v_reward.name_zh,'description_en',v_reward.description_en,'description_th',v_reward.description_th,'description_zh',v_reward.description_zh,'reward_type',v_reward.reward_type,'points_required',v_reward.points_required,'fixed_discount_amount',v_reward.fixed_discount_amount,'percentage_discount',v_reward.percentage_discount,'max_discount_amount',v_reward.max_discount_amount,'minimum_order_amount',v_reward.minimum_order_amount,'context_amount',v_gross,'discount_amount',v_discount,'net_due',v_net_paid,'channel','walk_in','request_key',p_request_key,'manual_fulfillment_required',v_manual_fulfillment,'fulfillment',CASE WHEN v_manual_fulfillment THEN 'staff_manual' ELSE 'payment_applied' END);
    INSERT INTO public.loyalty_redemptions(customer_id,reward_id,order_id,channel,status,points_spent,reward_snapshot,created_by,request_key)
    VALUES(p_customer_id,p_reward_id,v_order.id,'walk_in','redeemed',v_reward.points_required,v_snapshot,v_actor_id,p_request_key) RETURNING id INTO v_redemption_id;
    v_balance:=public.apply_loyalty_points_delta_v2(p_customer_id,-v_reward.points_required,'redeem',v_order.id,v_redemption_id,v_actor_id,'Walk-in reward redeemed with sale',jsonb_build_object('reward_id',p_reward_id,'reward_key',v_reward.reward_key,'channel','walk_in','gross_amount',v_gross,'discount_amount',v_discount,'amount_paid',v_net_paid,'request_key',p_request_key));
  END IF;
  IF v_points_earned>0 THEN
    v_balance:=public.apply_loyalty_points_delta_v2(p_customer_id,v_points_earned,'earn',v_order.id,NULL,v_actor_id,'Points awarded for completed walk-in purchase',jsonb_build_object('purchase_type','walk_in','loyalty_rate',v_rate,'gross_amount',v_gross,'discount_amount',v_discount,'amount_paid',v_net_paid));
    UPDATE public.orders SET loyalty_points_awarded_at=now() WHERE id=v_order.id RETURNING * INTO v_order;
  END IF;
  RETURN jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,'gross_amount',v_gross,'discount_amount',v_discount,'amount_paid',v_net_paid,'payment_method',p_payment_method,'points_redeemed',v_points_redeemed,'points_earned',v_points_earned,'updated_balance',v_balance,'reward_id',p_reward_id,'reward_type',CASE WHEN p_reward_id IS NULL THEN NULL ELSE v_reward.reward_type END,'reward_name_en',CASE WHEN p_reward_id IS NULL THEN NULL ELSE v_reward.name_en END,'reward_name_th',CASE WHEN p_reward_id IS NULL THEN NULL ELSE v_reward.name_th END,'manual_fulfillment_required',v_manual_fulfillment,'idempotent_replay',false);
END; $_$;


ALTER FUNCTION "public"."record_walk_in_purchase_v2"("p_customer_id" "uuid", "p_amount" numeric, "p_order_number" "text", "p_reward_id" "uuid", "p_request_key" "uuid", "p_payment_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refund_reserved_order_loyalty_reward_v2"("p_order_id" "uuid", "p_actor_id" "uuid", "p_reason" "text" DEFAULT 'Order cancelled before reward was consumed'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_order public.orders%ROWTYPE; v_redemption public.loyalty_redemptions%ROWTYPE;
BEGIN
  IF p_order_id IS NULL THEN RETURN; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF COALESCE(v_order.payment_status, 'unpaid') <> 'unpaid' OR v_order.picked_up_at IS NOT NULL THEN RETURN; END IF;
  SELECT * INTO v_redemption FROM public.loyalty_redemptions r
  WHERE r.order_id = p_order_id AND r.status = 'reserved'
    AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
  ORDER BY r.created_at, r.id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    IF COALESCE(v_order.loyalty_discount_amount, 0) <> 0 THEN RAISE EXCEPTION 'Order has a loyalty discount without a reserved monetary redemption'; END IF;
    RETURN;
  END IF;
  UPDATE public.loyalty_redemptions SET status='reversed', reversed_at=now(),
    reversal_reason=COALESCE(NULLIF(btrim(p_reason), ''), 'Order cancelled before reward was consumed') WHERE id=v_redemption.id;
  PERFORM public.apply_loyalty_points_delta_v2(
    v_redemption.customer_id, v_redemption.points_spent, 'refund_redemption', p_order_id,
    v_redemption.id, p_actor_id,
    COALESCE(NULLIF(btrim(p_reason), ''), 'Order cancelled before reward was consumed'),
    jsonb_build_object('reward_id',v_redemption.reward_id,'reward_key',v_redemption.reward_snapshot ->> 'reward_key','channel',v_redemption.channel,'reason','unused_pickup_monetary_reward')
  );
  UPDATE public.orders SET loyalty_discount_amount=0, amount_paid=NULL, updated_at=now() WHERE id=p_order_id;
END; $$;


ALTER FUNCTION "public"."refund_reserved_order_loyalty_reward_v2"("p_order_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_zero_value_monetary_loyalty_redemption_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_reward_type text := NEW.reward_snapshot ->> 'reward_type';
  v_discount_amount numeric;
BEGIN
  IF v_reward_type IN ('fixed_discount','percentage_discount') THEN
    v_discount_amount:=COALESCE(NULLIF(NEW.reward_snapshot ->> 'discount_amount','')::numeric,0);
    IF v_discount_amount<=0 THEN RAISE EXCEPTION 'Monetary loyalty reward must produce a positive discount'; END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."reject_zero_value_monetary_loyalty_redemption_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."require_online_order_pickup_date"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF COALESCE(NEW.purchase_type, 'online') <> 'walk_in'
     AND NEW.pickup_date IS NULL THEN
    RAISE EXCEPTION 'A scheduled pickup date is required for online orders';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."require_online_order_pickup_date"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_loyalty_reward_updated_at_v2"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_loyalty_reward_updated_at_v2"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_record_order_payment_v2"("p_order_id" "uuid", "p_payment_method" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_actor_id uuid:=auth.uid(); v_customer_id uuid; v_order public.orders%ROWTYPE; v_redemption public.loyalty_redemptions%ROWTYPE; v_amount_due numeric(10,2);
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_staff_or_admin() THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Order id is required'; END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash','qr_code') THEN RAISE EXCEPTION 'Payment method must be cash or qr_code'; END IF;
  SELECT o.customer_id INTO v_customer_id FROM public.orders o WHERE o.id=p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_customer_id IS NOT NULL THEN PERFORM 1 FROM public.customers c WHERE c.id=v_customer_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_customer_id THEN RAISE EXCEPTION 'Order customer changed while recording payment; retry'; END IF;
  IF COALESCE(v_order.purchase_type,'online')<>'online' THEN RAISE EXCEPTION 'Pickup payment requires an online order'; END IF;
  IF v_order.status NOT IN ('pending','confirmed','ready') OR v_order.picked_up_at IS NOT NULL THEN RAISE EXCEPTION 'This order can no longer accept pickup payment'; END IF;
  v_amount_due:=round(v_order.total_amount-COALESCE(v_order.loyalty_discount_amount,0),2);
  IF v_order.payment_status='paid' THEN
    IF v_order.payment_method IS DISTINCT FROM p_payment_method OR v_order.amount_paid IS DISTINCT FROM v_amount_due THEN RAISE EXCEPTION 'Payment has already been recorded and cannot be changed'; END IF;
    RETURN to_jsonb(v_order)||jsonb_build_object('amount_due',v_amount_due,'idempotent_replay',true);
  END IF;
  IF COALESCE(v_order.loyalty_discount_amount,0)>0 THEN
    SELECT * INTO v_redemption FROM public.loyalty_redemptions r WHERE r.order_id=p_order_id AND r.status='reserved' AND (r.reward_snapshot->>'reward_type') IN ('fixed_discount','percentage_discount') ORDER BY r.created_at,r.id LIMIT 1 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Discounted order is missing its reserved loyalty redemption'; END IF;
  END IF;
  UPDATE public.orders SET payment_method=p_payment_method,payment_status='paid',amount_paid=v_amount_due,updated_at=now() WHERE id=p_order_id RETURNING * INTO v_order;
  IF v_redemption.id IS NOT NULL THEN UPDATE public.loyalty_redemptions SET status='redeemed' WHERE id=v_redemption.id; END IF;
  RETURN to_jsonb(v_order)||jsonb_build_object('amount_due',v_amount_due,'idempotent_replay',false);
END; $$;


ALTER FUNCTION "public"."staff_record_order_payment_v2"("p_order_id" "uuid", "p_payment_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_redeem_loyalty_reward_v2"("p_customer_id" "uuid", "p_reward_id" "uuid", "p_channel" "text", "p_order_id" "uuid", "p_context_amount" numeric, "p_request_key" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_actor_id uuid := auth.uid(); v_customer public.customers%ROWTYPE; v_order public.orders%ROWTYPE;
  v_reward public.loyalty_rewards%ROWTYPE; v_existing public.loyalty_redemptions%ROWTYPE;
  v_existing_monetary public.loyalty_redemptions%ROWTYPE; v_context_amount numeric(10,2);
  v_discount_amount numeric(10,2):=0; v_net_due numeric(10,2); v_rate numeric;
  v_points_earned integer; v_customer_redemptions integer; v_total_redemptions integer;
  v_redemption_id uuid; v_new_balance integer; v_snapshot jsonb; v_status text;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_staff_or_admin() THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;
  IF p_customer_id IS NULL OR p_reward_id IS NULL OR p_request_key IS NULL THEN RAISE EXCEPTION 'Customer, reward, and request key are required'; END IF;
  IF p_channel <> 'pickup' THEN RAISE EXCEPTION 'Walk-in rewards must be applied atomically when the sale is recorded'; END IF;

  SELECT * INTO v_existing FROM public.loyalty_redemptions WHERE request_key=p_request_key;
  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM p_customer_id OR v_existing.reward_id IS DISTINCT FROM p_reward_id
       OR v_existing.channel IS DISTINCT FROM 'pickup' OR v_existing.order_id IS DISTINCT FROM p_order_id THEN RAISE EXCEPTION 'Redemption request key conflicts with another request'; END IF;
    IF v_existing.status='reversed' THEN RAISE EXCEPTION 'This redemption was reversed and cannot be replayed'; END IF;
    SELECT COALESCE(c.loyalty_points,0) INTO v_new_balance FROM public.customers c WHERE c.id=p_customer_id;
    RETURN jsonb_build_object('redemption_id',v_existing.id,'reward_id',v_existing.reward_id,'reward_key',v_existing.reward_snapshot->>'reward_key','reward_type',v_existing.reward_snapshot->>'reward_type','reward_name_en',v_existing.reward_snapshot->>'name_en','reward_name_th',v_existing.reward_snapshot->>'name_th','points_spent',v_existing.points_spent,'new_balance',v_new_balance,'channel',v_existing.channel,'order_id',v_existing.order_id,'context_amount',NULLIF(v_existing.reward_snapshot->>'context_amount','')::numeric,'discount_amount',COALESCE(NULLIF(v_existing.reward_snapshot->>'discount_amount','')::numeric,0),'net_due',NULLIF(v_existing.reward_snapshot->>'net_due','')::numeric,'redemption_status',v_existing.status,'request_key',p_request_key,'idempotent_replay',true);
  END IF;

  SELECT * INTO v_customer FROM public.customers WHERE id=p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  SELECT * INTO v_existing FROM public.loyalty_redemptions WHERE request_key=p_request_key;
  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM p_customer_id OR v_existing.reward_id IS DISTINCT FROM p_reward_id
       OR v_existing.channel IS DISTINCT FROM 'pickup' OR v_existing.order_id IS DISTINCT FROM p_order_id THEN RAISE EXCEPTION 'Redemption request key conflicts with another request'; END IF;
    IF v_existing.status='reversed' THEN RAISE EXCEPTION 'This redemption was reversed and cannot be replayed'; END IF;
    RETURN jsonb_build_object('redemption_id',v_existing.id,'reward_id',v_existing.reward_id,'reward_key',v_existing.reward_snapshot->>'reward_key','reward_type',v_existing.reward_snapshot->>'reward_type','reward_name_en',v_existing.reward_snapshot->>'name_en','reward_name_th',v_existing.reward_snapshot->>'name_th','points_spent',v_existing.points_spent,'new_balance',COALESCE(v_customer.loyalty_points,0),'channel',v_existing.channel,'order_id',v_existing.order_id,'context_amount',NULLIF(v_existing.reward_snapshot->>'context_amount','')::numeric,'discount_amount',COALESCE(NULLIF(v_existing.reward_snapshot->>'discount_amount','')::numeric,0),'net_due',NULLIF(v_existing.reward_snapshot->>'net_due','')::numeric,'redemption_status',v_existing.status,'request_key',p_request_key,'idempotent_replay',true);
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    IF v_order.customer_id IS DISTINCT FROM p_customer_id THEN RAISE EXCEPTION 'Order does not belong to this customer'; END IF;
    IF COALESCE(v_order.purchase_type,'online') <> 'online' THEN RAISE EXCEPTION 'Pickup redemption requires an online order'; END IF;
    IF v_order.status NOT IN ('pending','confirmed') OR COALESCE(v_order.payment_status,'unpaid') <> 'unpaid' OR v_order.picked_up_at IS NOT NULL THEN RAISE EXCEPTION 'Pickup monetary rewards require an unpaid pending or confirmed order'; END IF;
    v_context_amount:=round(v_order.total_amount,2);
  ELSE v_context_amount:=NULL; END IF;

  SELECT * INTO v_reward FROM public.loyalty_rewards WHERE id=p_reward_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reward not found'; END IF;
  IF NOT v_reward.is_active OR (v_reward.starts_at IS NOT NULL AND v_reward.starts_at>now()) OR (v_reward.ends_at IS NOT NULL AND v_reward.ends_at<=now()) THEN RAISE EXCEPTION 'Reward is not currently available'; END IF;
  IF NOT ('pickup'=ANY(v_reward.channels)) THEN RAISE EXCEPTION 'Reward is not available for pickup'; END IF;
  IF v_reward.reward_type='free_product' THEN RAISE EXCEPTION 'Free-product redemption is not available until inventory-aware fulfillment is enabled'; END IF;
  IF v_reward.reward_type IN ('fixed_discount','percentage_discount') OR v_reward.minimum_order_amount>0 THEN
    IF p_order_id IS NULL THEN RAISE EXCEPTION 'This reward requires a persisted pickup order'; END IF;
  END IF;
  IF v_reward.minimum_order_amount>0 AND COALESCE(v_context_amount,0)<v_reward.minimum_order_amount THEN RAISE EXCEPTION 'Minimum order amount for this reward is not met'; END IF;

  IF v_reward.per_customer_limit IS NOT NULL THEN
    SELECT count(*)::integer INTO v_customer_redemptions FROM public.loyalty_redemptions r WHERE r.customer_id=p_customer_id AND r.reward_id=p_reward_id AND r.status<>'reversed';
    IF v_customer_redemptions>=v_reward.per_customer_limit THEN RAISE EXCEPTION 'Customer redemption limit reached for this reward'; END IF;
  END IF;
  IF v_reward.total_redemption_limit IS NOT NULL THEN
    SELECT count(*)::integer INTO v_total_redemptions FROM public.loyalty_redemptions r WHERE r.reward_id=p_reward_id AND r.status<>'reversed';
    IF v_total_redemptions>=v_reward.total_redemption_limit THEN RAISE EXCEPTION 'Reward redemption limit reached'; END IF;
  END IF;
  IF COALESCE(v_customer.loyalty_points,0)<v_reward.points_required THEN RAISE EXCEPTION 'Insufficient loyalty points'; END IF;

  IF v_reward.reward_type IN ('fixed_discount','percentage_discount') THEN
    SELECT * INTO v_existing_monetary FROM public.loyalty_redemptions r
    WHERE r.order_id=p_order_id AND r.status<>'reversed' AND (r.reward_snapshot->>'reward_type') IN ('fixed_discount','percentage_discount') LIMIT 1 FOR UPDATE;
    IF FOUND THEN RAISE EXCEPTION 'This order already has a monetary loyalty reward'; END IF;
    IF v_reward.reward_type='fixed_discount' THEN
      v_discount_amount:=LEAST(v_context_amount,v_reward.fixed_discount_amount)::numeric(10,2);
    ELSE
      v_discount_amount:=round(v_context_amount*v_reward.percentage_discount/100.0,2);
      IF v_reward.max_discount_amount IS NOT NULL THEN v_discount_amount:=LEAST(v_discount_amount,v_reward.max_discount_amount); END IF;
      v_discount_amount:=LEAST(v_discount_amount,v_context_amount)::numeric(10,2);
    END IF;
    v_net_due:=round(v_context_amount-v_discount_amount,2);
    SELECT COALESCE(ls.points_per_baht,round(ls.points_percentage/100.0,5),0) INTO v_rate FROM public.loyalty_settings ls WHERE ls.purchase_type='online';
    v_rate:=COALESCE(v_rate,0);
    IF v_order.loyalty_points_awarded_at IS NULL THEN
      v_points_earned:=round(v_net_due*v_rate);
      UPDATE public.orders SET loyalty_discount_amount=v_discount_amount, loyalty_multiplier=v_rate, loyalty_points_earned=v_points_earned, updated_at=now()
      WHERE id=p_order_id RETURNING * INTO v_order;
    ELSE
      v_points_earned:=COALESCE(v_order.loyalty_points_earned,0);
      UPDATE public.orders SET loyalty_discount_amount=v_discount_amount, updated_at=now() WHERE id=p_order_id RETURNING * INTO v_order;
    END IF;
    v_status:='reserved';
  ELSE
    v_discount_amount:=0; v_net_due:=v_context_amount; v_status:='redeemed';
  END IF;

  v_snapshot:=jsonb_build_object('reward_key',v_reward.reward_key,'name_en',v_reward.name_en,'name_th',v_reward.name_th,'name_zh',v_reward.name_zh,'description_en',v_reward.description_en,'description_th',v_reward.description_th,'description_zh',v_reward.description_zh,'reward_type',v_reward.reward_type,'points_required',v_reward.points_required,'fixed_discount_amount',v_reward.fixed_discount_amount,'percentage_discount',v_reward.percentage_discount,'max_discount_amount',v_reward.max_discount_amount,'minimum_order_amount',v_reward.minimum_order_amount,'context_amount',v_context_amount,'discount_amount',v_discount_amount,'net_due',v_net_due,'loyalty_earning_grandfathered',(v_order.loyalty_points_awarded_at IS NOT NULL),'loyalty_points_earned_after_reward',v_points_earned,'channel','pickup','request_key',p_request_key,'fulfillment',CASE WHEN v_status='reserved' THEN 'payment_pending' ELSE 'staff_manual' END);

  INSERT INTO public.loyalty_redemptions(customer_id,reward_id,order_id,channel,status,points_spent,reward_snapshot,created_by,request_key)
  VALUES(p_customer_id,p_reward_id,p_order_id,'pickup',v_status,v_reward.points_required,v_snapshot,v_actor_id,p_request_key) RETURNING id INTO v_redemption_id;
  v_new_balance:=public.apply_loyalty_points_delta_v2(p_customer_id,-v_reward.points_required,'redeem',p_order_id,v_redemption_id,v_actor_id,CASE WHEN v_status='reserved' THEN 'Pickup monetary reward reserved' ELSE 'Staff reward redemption' END,jsonb_build_object('reward_id',p_reward_id,'reward_key',v_reward.reward_key,'channel','pickup','discount_amount',v_discount_amount,'net_due',v_net_due,'loyalty_earning_grandfathered',(v_order.loyalty_points_awarded_at IS NOT NULL),'loyalty_points_earned_after_reward',v_points_earned,'request_key',p_request_key,'redemption_status',v_status));
  RETURN jsonb_build_object('redemption_id',v_redemption_id,'reward_id',p_reward_id,'reward_key',v_reward.reward_key,'reward_type',v_reward.reward_type,'reward_name_en',v_reward.name_en,'reward_name_th',v_reward.name_th,'points_spent',v_reward.points_required,'previous_balance',COALESCE(v_customer.loyalty_points,0),'new_balance',v_new_balance,'channel','pickup','order_id',p_order_id,'context_amount',v_context_amount,'discount_amount',v_discount_amount,'net_due',v_net_due,'redemption_status',v_status,'request_key',p_request_key,'idempotent_replay',false);
END; $$;


ALTER FUNCTION "public"."staff_redeem_loyalty_reward_v2"("p_customer_id" "uuid", "p_reward_id" "uuid", "p_channel" "text", "p_order_id" "uuid", "p_context_amount" numeric, "p_request_key" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."staff_repair_completed_order_payment_method_v2"("p_order_id" "uuid", "p_payment_method" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE v_actor_id uuid:=auth.uid(); v_customer_id uuid; v_order public.orders%ROWTYPE; v_expected_paid numeric(10,2);
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_staff_or_admin() THEN RAISE EXCEPTION 'Staff access required' USING ERRCODE='42501'; END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Order id is required'; END IF;
  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash','qr_code') THEN RAISE EXCEPTION 'Payment method must be cash or qr_code'; END IF;
  SELECT o.customer_id INTO v_customer_id FROM public.orders o WHERE o.id=p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_customer_id IS NOT NULL THEN PERFORM 1 FROM public.customers c WHERE c.id=v_customer_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_customer_id THEN RAISE EXCEPTION 'Order customer changed while repairing payment method; retry'; END IF;
  IF v_order.status NOT IN ('picked_up','completed') OR v_order.payment_status IS DISTINCT FROM 'paid' THEN RAISE EXCEPTION 'Only completed paid orders can use payment-method repair'; END IF;
  v_expected_paid:=round(v_order.total_amount-COALESCE(v_order.loyalty_discount_amount,0),2);
  IF v_order.amount_paid IS NOT NULL AND v_order.amount_paid IS DISTINCT FROM v_expected_paid THEN RAISE EXCEPTION 'Stored amount paid does not match the order net total'; END IF;
  IF v_order.payment_method IN ('cash','qr_code','qr') THEN
    IF (v_order.payment_method='qr' AND p_payment_method='qr_code') OR v_order.payment_method=p_payment_method THEN RETURN to_jsonb(v_order)||jsonb_build_object('idempotent_replay',true); END IF;
    RAISE EXCEPTION 'A valid payment method is already recorded and cannot be changed';
  END IF;
  UPDATE public.orders SET payment_method=p_payment_method,updated_at=now() WHERE id=p_order_id RETURNING * INTO v_order;
  RETURN to_jsonb(v_order)||jsonb_build_object('idempotent_replay',false);
END; $$;


ALTER FUNCTION "public"."staff_repair_completed_order_payment_method_v2"("p_order_id" "uuid", "p_payment_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_completed_user_profile_to_customer"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.role = 'customer'::user_role
     AND COALESCE(NEW.profile_completed, false) = true
     AND btrim(COALESCE(NEW.email, '')) <> ''
     AND btrim(COALESCE(NEW.name, '')) <> ''
     AND btrim(COALESCE(NEW.phone, '')) <> ''
     AND (
       btrim(COALESCE(NEW.line_id, '')) <> ''
       OR btrim(COALESCE(NEW.whatsapp, '')) <> ''
       OR btrim(COALESCE(NEW.wechat_id, '')) <> ''
     ) THEN
    INSERT INTO public.customers (
      id,
      email,
      name,
      phone,
      line_id,
      whatsapp,
      wechat_id,
      qr_token,
      short_code
    )
    VALUES (
      NEW.id,
      NEW.email,
      NEW.name,
      NEW.phone,
      NULLIF(btrim(COALESCE(NEW.line_id, '')), ''),
      NULLIF(btrim(COALESCE(NEW.whatsapp, '')), ''),
      NULLIF(btrim(COALESCE(NEW.wechat_id, '')), ''),
      NEW.qr_token,
      NEW.short_code
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      phone = EXCLUDED.phone,
      line_id = EXCLUDED.line_id,
      whatsapp = EXCLUDED.whatsapp,
      wechat_id = EXCLUDED.wechat_id,
      qr_token = EXCLUDED.qr_token,
      short_code = EXCLUDED.short_code;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_completed_user_profile_to_customer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_loyalty_points_per_baht"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
IF NEW.points_percentage IS DISTINCT FROM OLD.points_percentage THEN
NEW.points_per_baht := ROUND(NEW.points_percentage / 100.0, 5);
NEW.multiplier := NEW.points_per_baht;
END IF;
NEW.updated_at := now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_loyalty_points_per_baht"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_cancellation_cutoff_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_cancellation_cutoff_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_customer_loyalty_balance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
IF NEW.customer_id IS NOT NULL AND COALESCE(NEW.purchase_type, 'online') != 'walk_in' THEN
UPDATE customers
SET loyalty_points = loyalty_points + COALESCE(NEW.loyalty_points_earned, 0)
WHERE id = NEW.customer_id;
END IF;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_customer_loyalty_balance"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_orders_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_orders_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_user_profiles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_user_profiles_updated_at"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."auth_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cancellation_cutoff_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pickup_label_en" "text" DEFAULT ''::"text" NOT NULL,
    "pickup_label_th" "text" DEFAULT ''::"text" NOT NULL,
    "pickup_label_zh" "text",
    "cutoff_day" "text" DEFAULT ''::"text" NOT NULL,
    "cutoff_time" "text" DEFAULT '17:00'::"text" NOT NULL,
    "notice_en" "text" DEFAULT ''::"text" NOT NULL,
    "notice_th" "text" DEFAULT ''::"text" NOT NULL,
    "notice_zh" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cancellation_cutoff_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cms_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_th" "text" NOT NULL,
    "description_en" "text",
    "description_th" "text",
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "title_zh" "text",
    "description_zh" "text"
);


ALTER TABLE "public"."cms_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cms_labels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "text_en" "text" NOT NULL,
    "text_th" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "text_zh" "text"
);


ALTER TABLE "public"."cms_labels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cms_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "page_key" "text" NOT NULL,
    "title_en" "text" NOT NULL,
    "title_th" "text" NOT NULL,
    "body_en" "text" NOT NULL,
    "body_th" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "title_zh" "text",
    "body_zh" "text"
);


ALTER TABLE "public"."cms_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cms_pickup_days" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "day_key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "cutoff_time" "text" DEFAULT '22:00'::"text" NOT NULL,
    "is_open" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "cutoff_day" "text" DEFAULT 'Monday'::"text" NOT NULL,
    "label_en" "text",
    "label_th" "text",
    "label_zh" "text",
    "location_id" "uuid",
    "pickup_weekday" smallint NOT NULL,
    CONSTRAINT "cms_pickup_days_pickup_weekday_check" CHECK ((("pickup_weekday" >= 0) AND ("pickup_weekday" <= 6)))
);


ALTER TABLE "public"."cms_pickup_days" OWNER TO "postgres";


COMMENT ON COLUMN "public"."cms_pickup_days"."cutoff_time" IS 'Deprecated compatibility mirror; pickup_cutoff_rules is authoritative.';



COMMENT ON COLUMN "public"."cms_pickup_days"."cutoff_day" IS 'Deprecated compatibility mirror; pickup_cutoff_rules is authoritative.';



CREATE TABLE IF NOT EXISTS "public"."cms_pickup_locations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name_en" "text" NOT NULL,
    "name_th" "text" NOT NULL,
    "description_en" "text",
    "description_th" "text",
    "maps_url" "text",
    "available_days" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name_zh" "text",
    "description_zh" "text"
);


ALTER TABLE "public"."cms_pickup_locations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cms_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name_en" "text" NOT NULL,
    "name_th" "text" NOT NULL,
    "desc_en" "text" NOT NULL,
    "desc_th" "text" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "image" "text",
    "is_sold_out" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "stock_total" integer,
    "stock_remaining" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "available_days" "jsonb" DEFAULT '[]'::"jsonb",
    "stock_by_day" "jsonb" DEFAULT '{}'::"jsonb",
    "name_zh" "text",
    "desc_zh" "text",
    "qr_code_url" "text"
);


ALTER TABLE "public"."cms_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cms_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "setting_key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cms_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "line_id" "text",
    "whatsapp" "text",
    "wechat_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "qr_token" "text",
    "loyalty_points" integer DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text",
    "short_code" "text",
    CONSTRAINT "at_least_one_contact" CHECK ((("line_id" IS NOT NULL) OR ("whatsapp" IS NOT NULL) OR ("wechat_id" IS NOT NULL)))
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pickup_date_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "event_type" "text" NOT NULL,
    "reserved_delta" integer NOT NULL,
    "actor_id" "uuid",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['reserve'::"text", 'release'::"text", 'adjustment'::"text"]))),
    CONSTRAINT "inventory_events_reserved_delta_check" CHECK (("reserved_delta" <> 0))
);


ALTER TABLE "public"."inventory_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."inventory_events" IS 'Append-only audit ledger for changes to product_date_inventory.reserved_quantity.';



CREATE TABLE IF NOT EXISTS "public"."line_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "line_user_id" "text" NOT NULL,
    "display_name" "text",
    "picture_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."line_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_point_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_sequence" bigint NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "order_id" "uuid",
    "redemption_id" "uuid",
    "event_type" "text" NOT NULL,
    "points_delta" integer NOT NULL,
    "balance_after" integer NOT NULL,
    "actor_id" "uuid",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loyalty_point_events_balance_nonnegative" CHECK (("balance_after" >= 0)),
    CONSTRAINT "loyalty_point_events_delta_nonzero" CHECK ((("points_delta" <> 0) OR (("event_type" = 'reverse_earn'::"text") AND (("metadata" ->> 'legacy_grandfathered'::"text") = 'true'::"text") AND (("metadata" ->> 'applied_reversal_points'::"text") = '0'::"text") AND (COALESCE(("metadata" ->> 'legacy_spent_shortfall'::"text"), ''::"text") ~ '^[1-9][0-9]*$'::"text")))),
    CONSTRAINT "loyalty_point_events_metadata_object" CHECK (("jsonb_typeof"("metadata") = 'object'::"text")),
    CONSTRAINT "loyalty_point_events_type" CHECK (("event_type" = ANY (ARRAY['migration_opening_balance'::"text", 'earn'::"text", 'redeem'::"text", 'reverse_earn'::"text", 'refund_redemption'::"text", 'admin_adjustment'::"text"])))
);


ALTER TABLE "public"."loyalty_point_events" OWNER TO "postgres";


ALTER TABLE "public"."loyalty_point_events" ALTER COLUMN "event_sequence" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."loyalty_point_events_event_sequence_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."loyalty_redemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "reward_id" "uuid",
    "order_id" "uuid",
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'redeemed'::"text" NOT NULL,
    "points_spent" integer NOT NULL,
    "reward_snapshot" "jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reversed_at" timestamp with time zone,
    "reversal_reason" "text",
    "request_key" "uuid",
    CONSTRAINT "loyalty_redemptions_channel" CHECK (("channel" = ANY (ARRAY['online'::"text", 'pickup'::"text", 'walk_in'::"text"]))),
    CONSTRAINT "loyalty_redemptions_points_positive" CHECK (("points_spent" > 0)),
    CONSTRAINT "loyalty_redemptions_reversal_state" CHECK (((("status" <> 'reversed'::"text") AND ("reversed_at" IS NULL)) OR (("status" = 'reversed'::"text") AND ("reversed_at" IS NOT NULL)))),
    CONSTRAINT "loyalty_redemptions_snapshot_object" CHECK (("jsonb_typeof"("reward_snapshot") = 'object'::"text")),
    CONSTRAINT "loyalty_redemptions_status" CHECK (("status" = ANY (ARRAY['reserved'::"text", 'redeemed'::"text", 'reversed'::"text"])))
);


ALTER TABLE "public"."loyalty_redemptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loyalty_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "purchase_type" "text" NOT NULL,
    "multiplier" numeric(3,2) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "points_per_baht" numeric(10,5) DEFAULT 0.10 NOT NULL,
    "label_en" "text" DEFAULT ''::"text" NOT NULL,
    "label_th" "text" DEFAULT ''::"text" NOT NULL,
    "points_percentage" numeric(6,2) DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."loyalty_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_notification_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "notification_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "language" "text",
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "claimed_at" timestamp with time zone,
    "sent_at" timestamp with time zone,
    "provider_message_id" "text",
    "last_error" "text",
    "first_attempt_at" timestamp with time zone,
    CONSTRAINT "order_notification_events_attempt_count_check" CHECK (("attempt_count" >= 0)),
    CONSTRAINT "order_notification_events_language_check" CHECK (("language" = ANY (ARRAY['en'::"text", 'th'::"text", 'zh'::"text"]))),
    CONSTRAINT "order_notification_events_notification_type_check" CHECK (("notification_type" = ANY (ARRAY['customer_confirmation'::"text", 'admin_new_order'::"text"]))),
    CONSTRAINT "order_notification_events_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'sent'::"text", 'failed'::"text", 'uncertain'::"text"])))
);


ALTER TABLE "public"."order_notification_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pickup_cutoff_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pickup_label_en" "text" NOT NULL,
    "pickup_label_th" "text" NOT NULL,
    "pickup_day" "text" NOT NULL,
    "location" "text" NOT NULL,
    "cutoff_day" "text" NOT NULL,
    "cutoff_time" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "pickup_label_zh" "text",
    "cutoff_day_zh" "text",
    "day_key" "text" NOT NULL
);


ALTER TABLE "public"."pickup_cutoff_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pickup_date_locations" (
    "pickup_date_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "note_en" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pickup_date_locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."pickup_date_locations" IS 'Locations available for one concrete pickup date. Inventory is intentionally not stored here.';



CREATE TABLE IF NOT EXISTS "public"."pickup_dates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid" NOT NULL,
    "pickup_date" "date" NOT NULL,
    "order_cutoff_at" timestamp with time zone NOT NULL,
    "cancellation_cutoff_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "note_en" "text",
    "note_th" "text",
    "note_zh" "text",
    "source" "text" DEFAULT 'generated'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pickup_dates_source_check" CHECK (("source" = ANY (ARRAY['generated'::"text", 'manual'::"text", 'legacy_override'::"text"]))),
    CONSTRAINT "pickup_dates_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'closed'::"text", 'sold_out'::"text"])))
);


ALTER TABLE "public"."pickup_dates" OWNER TO "postgres";


COMMENT ON TABLE "public"."pickup_dates" IS 'Concrete customer-selectable pickup occurrences with materialized order and cancellation cutoffs.';



CREATE TABLE IF NOT EXISTS "public"."pickup_overrides" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "pickup_day" "text" NOT NULL,
    "location" "text" NOT NULL,
    "override_type" "text" NOT NULL,
    "custom_cutoff_day" "text",
    "custom_cutoff_time" "text",
    "note_en" "text" DEFAULT ''::"text",
    "note_th" "text" DEFAULT ''::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "note_zh" "text" DEFAULT ''::"text",
    CONSTRAINT "pickup_overrides_override_type_check" CHECK (("override_type" = ANY (ARRAY['closed'::"text", 'custom_cutoff'::"text", 'sold_out'::"text"])))
);


ALTER TABLE "public"."pickup_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pickup_schedule_locations" (
    "schedule_id" "uuid" NOT NULL,
    "location_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pickup_schedule_locations" OWNER TO "postgres";


COMMENT ON TABLE "public"."pickup_schedule_locations" IS 'Default pickup locations offered by a recurring schedule. A schedule may have multiple locations.';



CREATE TABLE IF NOT EXISTS "public"."pickup_schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_key" "text" NOT NULL,
    "legacy_day_key" "text",
    "label_en" "text" NOT NULL,
    "label_th" "text",
    "label_zh" "text",
    "pickup_weekday" smallint NOT NULL,
    "order_cutoff_days_before" smallint NOT NULL,
    "order_cutoff_time" time without time zone NOT NULL,
    "cancellation_cutoff_days_before" smallint DEFAULT 1 NOT NULL,
    "cancellation_cutoff_time" time without time zone DEFAULT '00:00:00'::time without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "pickup_schedules_cancellation_cutoff_days_before_check" CHECK ((("cancellation_cutoff_days_before" >= 0) AND ("cancellation_cutoff_days_before" <= 6))),
    CONSTRAINT "pickup_schedules_order_cutoff_days_before_check" CHECK ((("order_cutoff_days_before" >= 0) AND ("order_cutoff_days_before" <= 6))),
    CONSTRAINT "pickup_schedules_pickup_weekday_check" CHECK ((("pickup_weekday" >= 0) AND ("pickup_weekday" <= 6)))
);


ALTER TABLE "public"."pickup_schedules" OWNER TO "postgres";


COMMENT ON TABLE "public"."pickup_schedules" IS 'Recurring pickup templates. Locations are linked separately; concrete pickup occurrences live in pickup_dates.';



COMMENT ON COLUMN "public"."pickup_schedules"."schedule_key" IS 'Stable recurring schedule identifier. Seeded from legacy cms_pickup_days.day_key during migration.';



CREATE TABLE IF NOT EXISTS "public"."product_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_likes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."product_also_liked" WITH ("security_invoker"='true') AS
 SELECT "pl1"."product_id" AS "base_product_id",
    "pl2"."product_id" AS "recommended_product_id",
    "count"(*) AS "co_like_count"
   FROM ("public"."product_likes" "pl1"
     JOIN "public"."product_likes" "pl2" ON ((("pl1"."user_id" = "pl2"."user_id") AND ("pl1"."product_id" <> "pl2"."product_id"))))
  GROUP BY "pl1"."product_id", "pl2"."product_id";


ALTER VIEW "public"."product_also_liked" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_date_inventory" (
    "pickup_date_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "capacity" integer NOT NULL,
    "reserved_quantity" integer DEFAULT 0 NOT NULL,
    "capacity_source" "text" DEFAULT 'recurring_default'::"text" NOT NULL,
    "override_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_date_inventory_capacity_check" CHECK (("capacity" >= 0)),
    CONSTRAINT "product_date_inventory_capacity_source_check" CHECK (("capacity_source" = ANY (ARRAY['recurring_default'::"text", 'date_override'::"text", 'manual_seed'::"text"]))),
    CONSTRAINT "product_date_inventory_reserved_quantity_check" CHECK (("reserved_quantity" >= 0)),
    CONSTRAINT "product_date_inventory_reserved_within_capacity" CHECK (("reserved_quantity" <= "capacity"))
);


ALTER TABLE "public"."product_date_inventory" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_date_inventory" IS 'Authoritative shared inventory pool for one product on one concrete pickup date. Never scoped by pickup location.';



CREATE OR REPLACE VIEW "public"."product_like_counts" WITH ("security_invoker"='true') AS
 SELECT "product_id",
    ("count"(*))::integer AS "like_count"
   FROM "public"."product_likes"
  GROUP BY "product_id";


ALTER VIEW "public"."product_like_counts" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."product_recommendations" WITH ("security_invoker"='true') AS
 SELECT "base_product_id",
    "recommended_product_id",
    "co_like_count",
    "row_number"() OVER (PARTITION BY "base_product_id" ORDER BY "co_like_count" DESC) AS "rank"
   FROM "public"."product_also_liked";


ALTER VIEW "public"."product_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_schedule_capacity" (
    "schedule_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "capacity" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "product_schedule_capacity_capacity_check" CHECK (("capacity" >= 0))
);


ALTER TABLE "public"."product_schedule_capacity" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_schedule_capacity" IS 'Recurring default capacity for product + schedule. Shared by all pickup locations.';



CREATE TABLE IF NOT EXISTS "public"."site_social_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "label" "text" NOT NULL,
    "url" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."site_social_links" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."top_liked_products" WITH ("security_invoker"='true') AS
 SELECT "p"."id",
    "p"."slug",
    "p"."category_id",
    "p"."name_en",
    "p"."name_th",
    "p"."desc_en",
    "p"."desc_th",
    "p"."price",
    "p"."image",
    "p"."is_sold_out",
    "p"."is_active",
    "p"."sort_order",
    "p"."stock_total",
    "p"."stock_remaining",
    "p"."created_at",
    "p"."updated_at",
    "p"."available_days",
    "p"."stock_by_day",
    "p"."name_zh",
    "p"."desc_zh",
    COALESCE("plc"."like_count", 0) AS "like_count"
   FROM ("public"."cms_products" "p"
     LEFT JOIN "public"."product_like_counts" "plc" ON (("p"."id" = "plc"."product_id")))
  WHERE ("p"."is_active" = true)
  ORDER BY COALESCE("plc"."like_count", 0) DESC, "p"."created_at" DESC
 LIMIT 10;


ALTER VIEW "public"."top_liked_products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "phone" "text" NOT NULL,
    "line_id" "text",
    "whatsapp" "text",
    "wechat_id" "text",
    "profile_completed" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "qr_token" "text",
    "profile_picture_url" "text",
    "role" "public"."user_role" DEFAULT 'customer'::"public"."user_role",
    "short_code" "text",
    "email" "text",
    "preferred_language" "text" DEFAULT 'en'::"text"
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vip_magic_link_rate_limits" (
    "scope" "text" NOT NULL,
    "key_hash" "text" NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "request_count" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "vip_magic_link_rate_limits_scope_check" CHECK (("scope" = ANY (ARRAY['ip'::"text", 'code'::"text"])))
);


ALTER TABLE "public"."vip_magic_link_rate_limits" OWNER TO "postgres";


ALTER TABLE ONLY "public"."auth_users"
    ADD CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cancellation_cutoff_rules"
    ADD CONSTRAINT "cancellation_cutoff_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_categories"
    ADD CONSTRAINT "cms_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_categories"
    ADD CONSTRAINT "cms_categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."cms_labels"
    ADD CONSTRAINT "cms_labels_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."cms_labels"
    ADD CONSTRAINT "cms_labels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_pages"
    ADD CONSTRAINT "cms_pages_page_key_key" UNIQUE ("page_key");



ALTER TABLE ONLY "public"."cms_pages"
    ADD CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_pickup_days"
    ADD CONSTRAINT "cms_pickup_days_day_key_key" UNIQUE ("day_key");



ALTER TABLE ONLY "public"."cms_pickup_days"
    ADD CONSTRAINT "cms_pickup_days_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_pickup_locations"
    ADD CONSTRAINT "cms_pickup_locations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_products"
    ADD CONSTRAINT "cms_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_products"
    ADD CONSTRAINT "cms_products_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."cms_settings"
    ADD CONSTRAINT "cms_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cms_settings"
    ADD CONSTRAINT "cms_settings_setting_key_key" UNIQUE ("setting_key");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_qr_token_key" UNIQUE ("qr_token");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_short_code_key" UNIQUE ("short_code");



ALTER TABLE ONLY "public"."inventory_events"
    ADD CONSTRAINT "inventory_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."line_users"
    ADD CONSTRAINT "line_users_line_user_id_key" UNIQUE ("line_user_id");



ALTER TABLE ONLY "public"."line_users"
    ADD CONSTRAINT "line_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_reward_key_key" UNIQUE ("reward_key");



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loyalty_settings"
    ADD CONSTRAINT "loyalty_settings_purchase_type_key" UNIQUE ("purchase_type");



ALTER TABLE ONLY "public"."order_notification_events"
    ADD CONSTRAINT "order_notification_events_order_id_notification_type_key" UNIQUE ("order_id", "notification_type");



ALTER TABLE ONLY "public"."order_notification_events"
    ADD CONSTRAINT "order_notification_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pickup_cutoff_rules"
    ADD CONSTRAINT "pickup_cutoff_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pickup_date_locations"
    ADD CONSTRAINT "pickup_date_locations_pkey" PRIMARY KEY ("pickup_date_id", "location_id");



ALTER TABLE ONLY "public"."pickup_dates"
    ADD CONSTRAINT "pickup_dates_pickup_date_unique" UNIQUE ("pickup_date");



ALTER TABLE ONLY "public"."pickup_dates"
    ADD CONSTRAINT "pickup_dates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pickup_dates"
    ADD CONSTRAINT "pickup_dates_schedule_id_pickup_date_key" UNIQUE ("schedule_id", "pickup_date");



ALTER TABLE ONLY "public"."pickup_overrides"
    ADD CONSTRAINT "pickup_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pickup_schedule_locations"
    ADD CONSTRAINT "pickup_schedule_locations_pkey" PRIMARY KEY ("schedule_id", "location_id");



ALTER TABLE ONLY "public"."pickup_schedules"
    ADD CONSTRAINT "pickup_schedules_legacy_day_key_key" UNIQUE ("legacy_day_key");



ALTER TABLE ONLY "public"."pickup_schedules"
    ADD CONSTRAINT "pickup_schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pickup_schedules"
    ADD CONSTRAINT "pickup_schedules_schedule_key_key" UNIQUE ("schedule_key");



ALTER TABLE ONLY "public"."product_date_inventory"
    ADD CONSTRAINT "product_date_inventory_pkey" PRIMARY KEY ("pickup_date_id", "product_id");



ALTER TABLE ONLY "public"."product_likes"
    ADD CONSTRAINT "product_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_likes"
    ADD CONSTRAINT "product_likes_user_id_product_id_key" UNIQUE ("user_id", "product_id");



ALTER TABLE ONLY "public"."product_schedule_capacity"
    ADD CONSTRAINT "product_schedule_capacity_pkey" PRIMARY KEY ("schedule_id", "product_id");



ALTER TABLE ONLY "public"."site_social_links"
    ADD CONSTRAINT "site_social_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_qr_token_key" UNIQUE ("qr_token");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_short_code_key" UNIQUE ("short_code");



ALTER TABLE ONLY "public"."vip_magic_link_rate_limits"
    ADD CONSTRAINT "vip_magic_link_rate_limits_pkey" PRIMARY KEY ("scope", "key_hash", "window_start");



CREATE INDEX "customers_email_idx" ON "public"."customers" USING "btree" ("email");



CREATE INDEX "customers_qr_token_idx" ON "public"."customers" USING "btree" ("qr_token");



CREATE INDEX "customers_short_code_idx" ON "public"."customers" USING "btree" ("short_code");



CREATE INDEX "idx_cms_categories_slug" ON "public"."cms_categories" USING "btree" ("slug");



CREATE INDEX "idx_cms_labels_key" ON "public"."cms_labels" USING "btree" ("key");



CREATE INDEX "idx_cms_pages_page_key" ON "public"."cms_pages" USING "btree" ("page_key");



CREATE INDEX "idx_cms_products_category_id" ON "public"."cms_products" USING "btree" ("category_id");



CREATE INDEX "idx_cms_products_slug" ON "public"."cms_products" USING "btree" ("slug");



CREATE INDEX "idx_cms_settings_setting_key" ON "public"."cms_settings" USING "btree" ("setting_key");



CREATE INDEX "idx_pickup_overrides_date" ON "public"."pickup_overrides" USING "btree" ("date");



CREATE INDEX "idx_pickup_overrides_lookup" ON "public"."pickup_overrides" USING "btree" ("date", "pickup_day", "location") WHERE ("is_active" = true);



CREATE INDEX "idx_product_likes_product_id" ON "public"."product_likes" USING "btree" ("product_id");



CREATE INDEX "idx_product_likes_user_id" ON "public"."product_likes" USING "btree" ("user_id");



CREATE INDEX "idx_product_likes_user_product" ON "public"."product_likes" USING "btree" ("user_id", "product_id");



CREATE INDEX "idx_user_profiles_qr_token" ON "public"."user_profiles" USING "btree" ("qr_token");



CREATE INDEX "idx_user_profiles_role" ON "public"."user_profiles" USING "btree" ("role");



CREATE INDEX "inventory_events_inventory_idx" ON "public"."inventory_events" USING "btree" ("pickup_date_id", "product_id", "created_at");



CREATE INDEX "inventory_events_order_idx" ON "public"."inventory_events" USING "btree" ("order_id") WHERE ("order_id" IS NOT NULL);



CREATE INDEX "loyalty_point_events_customer_created_idx" ON "public"."loyalty_point_events" USING "btree" ("customer_id", "created_at" DESC);



CREATE UNIQUE INDEX "loyalty_point_events_event_sequence_uq" ON "public"."loyalty_point_events" USING "btree" ("event_sequence");



CREATE UNIQUE INDEX "loyalty_point_events_opening_balance_uq" ON "public"."loyalty_point_events" USING "btree" ("customer_id") WHERE ("event_type" = 'migration_opening_balance'::"text");



CREATE UNIQUE INDEX "loyalty_point_events_order_event_uq" ON "public"."loyalty_point_events" USING "btree" ("order_id", "event_type") WHERE (("order_id" IS NOT NULL) AND ("event_type" = ANY (ARRAY['earn'::"text", 'reverse_earn'::"text"])));



CREATE INDEX "loyalty_point_events_order_idx" ON "public"."loyalty_point_events" USING "btree" ("order_id") WHERE ("order_id" IS NOT NULL);



CREATE UNIQUE INDEX "loyalty_point_events_redemption_event_uq" ON "public"."loyalty_point_events" USING "btree" ("redemption_id", "event_type") WHERE (("redemption_id" IS NOT NULL) AND ("event_type" = ANY (ARRAY['redeem'::"text", 'refund_redemption'::"text"])));



CREATE INDEX "loyalty_redemptions_customer_created_idx" ON "public"."loyalty_redemptions" USING "btree" ("customer_id", "created_at" DESC);



CREATE UNIQUE INDEX "loyalty_redemptions_one_active_monetary_per_order_uq" ON "public"."loyalty_redemptions" USING "btree" ("order_id") WHERE (("order_id" IS NOT NULL) AND ("status" <> 'reversed'::"text") AND (("reward_snapshot" ->> 'reward_type'::"text") = ANY (ARRAY['fixed_discount'::"text", 'percentage_discount'::"text"])));



CREATE INDEX "loyalty_redemptions_order_idx" ON "public"."loyalty_redemptions" USING "btree" ("order_id") WHERE ("order_id" IS NOT NULL);



CREATE UNIQUE INDEX "loyalty_redemptions_request_key_uq" ON "public"."loyalty_redemptions" USING "btree" ("request_key") WHERE ("request_key" IS NOT NULL);



CREATE INDEX "loyalty_redemptions_reward_idx" ON "public"."loyalty_redemptions" USING "btree" ("reward_id", "status") WHERE ("reward_id" IS NOT NULL);



CREATE INDEX "loyalty_rewards_active_sort_idx" ON "public"."loyalty_rewards" USING "btree" ("is_active", "sort_order", "points_required", "created_at");



CREATE INDEX "loyalty_rewards_product_idx" ON "public"."loyalty_rewards" USING "btree" ("product_id") WHERE ("product_id" IS NOT NULL);



CREATE INDEX "order_notification_events_status_created_idx" ON "public"."order_notification_events" USING "btree" ("status", "created_at");



CREATE INDEX "orders_customer_id_idx" ON "public"."orders" USING "btree" ("customer_id");



CREATE INDEX "orders_order_number_idx" ON "public"."orders" USING "btree" ("order_number");



CREATE INDEX "orders_pickup_date_id_idx" ON "public"."orders" USING "btree" ("pickup_date_id") WHERE ("pickup_date_id" IS NOT NULL);



CREATE INDEX "orders_pickup_date_idx" ON "public"."orders" USING "btree" ("pickup_date");



CREATE INDEX "orders_purchase_type_idx" ON "public"."orders" USING "btree" ("purchase_type");



CREATE INDEX "orders_staff_id_idx" ON "public"."orders" USING "btree" ("staff_id");



CREATE UNIQUE INDEX "orders_staff_request_key_uq" ON "public"."orders" USING "btree" ("staff_request_key") WHERE ("staff_request_key" IS NOT NULL);



CREATE INDEX "orders_status_idx" ON "public"."orders" USING "btree" ("status");



CREATE UNIQUE INDEX "pickup_cutoff_rules_day_key_idx" ON "public"."pickup_cutoff_rules" USING "btree" ("day_key");



CREATE INDEX "pickup_dates_open_calendar_idx" ON "public"."pickup_dates" USING "btree" ("pickup_date", "schedule_id") WHERE ("status" = 'open'::"text");



CREATE INDEX "pickup_dates_pickup_date_idx" ON "public"."pickup_dates" USING "btree" ("pickup_date");



CREATE UNIQUE INDEX "pickup_schedules_one_active_per_weekday_idx" ON "public"."pickup_schedules" USING "btree" ("pickup_weekday") WHERE ("is_active" = true);



CREATE INDEX "product_date_inventory_product_idx" ON "public"."product_date_inventory" USING "btree" ("product_id", "pickup_date_id");



CREATE OR REPLACE TRIGGER "cancellation_cutoff_updated_at" BEFORE UPDATE ON "public"."cancellation_cutoff_rules" FOR EACH ROW EXECUTE FUNCTION "public"."update_cancellation_cutoff_updated_at"();



CREATE OR REPLACE TRIGGER "guard_cms_pickup_location_deactivation_v2" BEFORE UPDATE OF "is_active" ON "public"."cms_pickup_locations" FOR EACH ROW EXECUTE FUNCTION "public"."guard_cms_pickup_location_deactivation_v2"();



CREATE OR REPLACE TRIGGER "guard_customer_loyalty_balance_v2" BEFORE UPDATE OF "loyalty_points" ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."guard_customer_loyalty_balance_v2"();



CREATE OR REPLACE TRIGGER "guard_order_loyalty_payment_fields_v2" BEFORE UPDATE OF "loyalty_discount_amount", "amount_paid", "staff_request_key", "payment_status" ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."guard_order_loyalty_payment_fields_v2"();



CREATE OR REPLACE TRIGGER "guard_pickup_schedule_lifecycle_v2" BEFORE INSERT OR UPDATE OF "pickup_weekday", "is_active" ON "public"."pickup_schedules" FOR EACH ROW EXECUTE FUNCTION "public"."guard_pickup_schedule_lifecycle_v2"();



CREATE OR REPLACE TRIGGER "guard_v2_order_pickup_selection" BEFORE INSERT ON "public"."orders" FOR EACH ROW WHEN (("new"."pickup_date_id" IS NOT NULL)) EXECUTE FUNCTION "public"."guard_v2_order_pickup_selection"();



CREATE OR REPLACE TRIGGER "loyalty_rewards_set_updated_at_v2" BEFORE UPDATE ON "public"."loyalty_rewards" FOR EACH ROW EXECUTE FUNCTION "public"."set_loyalty_reward_updated_at_v2"();



CREATE OR REPLACE TRIGGER "orders_calculate_loyalty" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_loyalty_points_on_order"();



CREATE OR REPLACE TRIGGER "prevent_inventory_event_delete_v2" BEFORE DELETE ON "public"."inventory_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_inventory_event_mutation_v2"();



CREATE OR REPLACE TRIGGER "prevent_inventory_event_update_v2" BEFORE UPDATE ON "public"."inventory_events" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_inventory_event_mutation_v2"();



CREATE OR REPLACE TRIGGER "reject_zero_value_monetary_loyalty_redemption_v2" BEFORE INSERT ON "public"."loyalty_redemptions" FOR EACH ROW EXECUTE FUNCTION "public"."reject_zero_value_monetary_loyalty_redemption_v2"();



CREATE OR REPLACE TRIGGER "require_online_order_pickup_date_on_insert" BEFORE INSERT ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."require_online_order_pickup_date"();



CREATE OR REPLACE TRIGGER "set_initial_stock" BEFORE INSERT ON "public"."cms_products" FOR EACH ROW EXECUTE FUNCTION "public"."initialize_stock_remaining"();



CREATE OR REPLACE TRIGGER "set_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_orders_updated_at"();



CREATE OR REPLACE TRIGGER "sync_completed_user_profile_to_customer_on_write" AFTER INSERT OR UPDATE OF "email", "name", "phone", "line_id", "whatsapp", "wechat_id", "qr_token", "short_code", "role", "profile_completed" ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_completed_user_profile_to_customer"();



CREATE OR REPLACE TRIGGER "sync_loyalty_ppb" BEFORE UPDATE ON "public"."loyalty_settings" FOR EACH ROW EXECUTE FUNCTION "public"."sync_loyalty_points_per_baht"();



CREATE OR REPLACE TRIGGER "user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_user_profiles_updated_at"();



ALTER TABLE ONLY "public"."auth_users"
    ADD CONSTRAINT "auth_users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cms_pickup_days"
    ADD CONSTRAINT "cms_pickup_days_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."cms_pickup_locations"("id");



ALTER TABLE ONLY "public"."cms_products"
    ADD CONSTRAINT "cms_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."cms_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_events"
    ADD CONSTRAINT "inventory_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventory_events"
    ADD CONSTRAINT "inventory_events_pickup_date_id_fkey" FOREIGN KEY ("pickup_date_id") REFERENCES "public"."pickup_dates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."inventory_events"
    ADD CONSTRAINT "inventory_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."cms_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_point_events"
    ADD CONSTRAINT "loyalty_point_events_redemption_id_fkey" FOREIGN KEY ("redemption_id") REFERENCES "public"."loyalty_redemptions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_redemptions"
    ADD CONSTRAINT "loyalty_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_rewards"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loyalty_rewards"
    ADD CONSTRAINT "loyalty_rewards_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."cms_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."order_notification_events"
    ADD CONSTRAINT "order_notification_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pickup_date_id_fkey" FOREIGN KEY ("pickup_date_id") REFERENCES "public"."pickup_dates"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pickup_date_location_fkey" FOREIGN KEY ("pickup_date_id", "pickup_location_id") REFERENCES "public"."pickup_date_locations"("pickup_date_id", "location_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pickup_location_id_fkey" FOREIGN KEY ("pickup_location_id") REFERENCES "public"."cms_pickup_locations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pickup_cutoff_rules"
    ADD CONSTRAINT "pickup_cutoff_rules_day_key_fkey" FOREIGN KEY ("day_key") REFERENCES "public"."cms_pickup_days"("day_key");



ALTER TABLE ONLY "public"."pickup_date_locations"
    ADD CONSTRAINT "pickup_date_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."cms_pickup_locations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pickup_date_locations"
    ADD CONSTRAINT "pickup_date_locations_pickup_date_id_fkey" FOREIGN KEY ("pickup_date_id") REFERENCES "public"."pickup_dates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pickup_dates"
    ADD CONSTRAINT "pickup_dates_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."pickup_schedules"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pickup_schedule_locations"
    ADD CONSTRAINT "pickup_schedule_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "public"."cms_pickup_locations"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pickup_schedule_locations"
    ADD CONSTRAINT "pickup_schedule_locations_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."pickup_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_date_inventory"
    ADD CONSTRAINT "product_date_inventory_pickup_date_id_fkey" FOREIGN KEY ("pickup_date_id") REFERENCES "public"."pickup_dates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_date_inventory"
    ADD CONSTRAINT "product_date_inventory_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."cms_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_likes"
    ADD CONSTRAINT "product_likes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."cms_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_likes"
    ADD CONSTRAINT "product_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_schedule_capacity"
    ADD CONSTRAINT "product_schedule_capacity_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."cms_products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."product_schedule_capacity"
    ADD CONSTRAINT "product_schedule_capacity_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."pickup_schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Active loyalty rewards are publicly readable" ON "public"."loyalty_rewards" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (("starts_at" IS NULL) OR ("starts_at" <= "now"())) AND (("ends_at" IS NULL) OR ("ends_at" > "now"()))));



CREATE POLICY "Admins can delete products" ON "public"."cms_products" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can delete social links" ON "public"."site_social_links" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can insert cancellation cutoff rules" ON "public"."cancellation_cutoff_rules" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can insert categories" ON "public"."cms_categories" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can insert labels" ON "public"."cms_labels" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can insert pages" ON "public"."cms_pages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can insert pickup days" ON "public"."cms_pickup_days" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can insert pickup locations" ON "public"."cms_pickup_locations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can insert products" ON "public"."cms_products" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can insert settings" ON "public"."cms_settings" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can insert social links" ON "public"."site_social_links" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can manage all cutoff rules" ON "public"."pickup_cutoff_rules" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can manage all overrides" ON "public"."pickup_overrides" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read all pickup date locations" ON "public"."pickup_date_locations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read all pickup dates" ON "public"."pickup_dates" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read all pickup schedules" ON "public"."pickup_schedules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read all schedule locations" ON "public"."pickup_schedule_locations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read inventory events" ON "public"."inventory_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read product date inventory" ON "public"."product_date_inventory" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can read product schedule capacity" ON "public"."product_schedule_capacity" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update cancellation cutoff rules" ON "public"."cancellation_cutoff_rules" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update categories" ON "public"."cms_categories" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update labels" ON "public"."cms_labels" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update pages" ON "public"."cms_pages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update pickup days" ON "public"."cms_pickup_days" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update pickup locations" ON "public"."cms_pickup_locations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update products" ON "public"."cms_products" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update settings" ON "public"."cms_settings" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can update social links" ON "public"."site_social_links" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can view all cancellation cutoff rules" ON "public"."cancellation_cutoff_rules" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Admins can view all social links" ON "public"."site_social_links" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_profiles" "p"
  WHERE (("p"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("p"."role" = 'admin'::"public"."user_role")))));



CREATE POLICY "Anyone can read active cutoff rules" ON "public"."pickup_cutoff_rules" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can read active overrides" ON "public"."pickup_overrides" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can read likes" ON "public"."product_likes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can read loyalty settings" ON "public"."loyalty_settings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Categories are viewable by everyone" ON "public"."cms_categories" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Customers can read own loyalty point events" ON "public"."loyalty_point_events" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "customer_id"));



CREATE POLICY "Customers can read own loyalty redemptions" ON "public"."loyalty_redemptions" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "customer_id"));



CREATE POLICY "Customers can read own orders" ON "public"."orders" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "customer_id"));



CREATE POLICY "LINE users are publicly readable" ON "public"."line_users" FOR SELECT USING (true);



CREATE POLICY "Labels are viewable by everyone" ON "public"."cms_labels" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Pages are viewable by everyone" ON "public"."cms_pages" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Pickup days are viewable by everyone" ON "public"."cms_pickup_days" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Pickup locations are viewable by everyone" ON "public"."cms_pickup_locations" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Products are viewable by everyone" ON "public"."cms_products" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can read active cancellation cutoff rules" ON "public"."cancellation_cutoff_rules" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Public can read active pickup date locations" ON "public"."pickup_date_locations" FOR SELECT TO "authenticated", "anon" USING ((("is_active" = true) AND (EXISTS ( SELECT 1
   FROM "public"."pickup_dates" "d"
  WHERE ("d"."id" = "pickup_date_locations"."pickup_date_id")))));



CREATE POLICY "Public can read active pickup schedules" ON "public"."pickup_schedules" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Public can read active schedule locations" ON "public"."pickup_schedule_locations" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Public can read pickup dates" ON "public"."pickup_dates" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."pickup_schedules" "s"
  WHERE (("s"."id" = "pickup_dates"."schedule_id") AND ("s"."is_active" = true)))));



CREATE POLICY "Public can view active social links" ON "public"."site_social_links" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Settings are viewable by everyone" ON "public"."cms_settings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Staff can read orders" ON "public"."orders" FOR SELECT TO "authenticated" USING ("public"."is_staff_or_admin"());



CREATE POLICY "Staff can update orders" ON "public"."orders" FOR UPDATE TO "authenticated" USING ("public"."is_staff_or_admin"()) WITH CHECK ("public"."is_staff_or_admin"());



CREATE POLICY "Staff can view staff directory" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (("public"."is_staff_or_admin"() AND ("role" = ANY (ARRAY['staff'::"public"."user_role", 'admin'::"public"."user_role"]))));



CREATE POLICY "Users can insert own customer profile" ON "public"."user_profiles" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "id") AND ("role" = 'customer'::"public"."user_role")));



CREATE POLICY "Users can insert own customer record" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can like products" ON "public"."product_likes" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own auth profile" ON "public"."auth_users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read own customer record" ON "public"."customers" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can unlike products" ON "public"."product_likes" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own customer record" ON "public"."customers" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."auth_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cancellation_cutoff_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_labels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_pickup_days" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_pickup_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cms_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."line_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_point_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_redemptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_rewards" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loyalty_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_notification_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pickup_cutoff_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pickup_date_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pickup_dates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pickup_overrides" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pickup_schedule_locations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pickup_schedules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_date_inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_schedule_capacity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."site_social_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vip_magic_link_rate_limits" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_adjust_loyalty_points_v2"("p_customer_id" "uuid", "p_points_delta" integer, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_adjust_loyalty_points_v2"("p_customer_id" "uuid", "p_points_delta" integer, "p_reason" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."admin_adjust_loyalty_points_v2"("p_customer_id" "uuid", "p_points_delta" integer, "p_reason" "text") TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_rewards" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_rewards" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_rewards" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."admin_list_loyalty_rewards_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_list_loyalty_rewards_v2"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_list_loyalty_rewards_v2"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_loyalty_reward_active_v2"("p_reward_id" "uuid", "p_is_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_loyalty_reward_active_v2"("p_reward_id" "uuid", "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_loyalty_reward_active_v2"("p_reward_id" "uuid", "p_is_active" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_pickup_date_location_v2"("p_pickup_date_id" "uuid", "p_location_id" "uuid", "p_is_active" boolean, "p_note_en" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_pickup_date_location_v2"("p_pickup_date_id" "uuid", "p_location_id" "uuid", "p_is_active" boolean, "p_note_en" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_pickup_date_location_v2"("p_pickup_date_id" "uuid", "p_location_id" "uuid", "p_is_active" boolean, "p_note_en" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_product_date_capacity_v2"("p_pickup_date_id" "uuid", "p_product_id" "uuid", "p_capacity" integer, "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_product_date_capacity_v2"("p_pickup_date_id" "uuid", "p_product_id" "uuid", "p_capacity" integer, "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_product_date_capacity_v2"("p_pickup_date_id" "uuid", "p_product_id" "uuid", "p_capacity" integer, "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_product_schedule_availability_v2"("p_schedule_id" "uuid", "p_product_id" "uuid", "p_is_active" boolean, "p_apply_to_future_dates" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_product_schedule_availability_v2"("p_schedule_id" "uuid", "p_product_id" "uuid", "p_is_active" boolean, "p_apply_to_future_dates" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_product_schedule_availability_v2"("p_schedule_id" "uuid", "p_product_id" "uuid", "p_is_active" boolean, "p_apply_to_future_dates" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_set_product_schedule_capacity_v2"("p_schedule_id" "uuid", "p_product_id" "uuid", "p_capacity" integer, "p_apply_to_future_dates" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_set_product_schedule_capacity_v2"("p_schedule_id" "uuid", "p_product_id" "uuid", "p_capacity" integer, "p_apply_to_future_dates" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_set_product_schedule_capacity_v2"("p_schedule_id" "uuid", "p_product_id" "uuid", "p_capacity" integer, "p_apply_to_future_dates" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_update_loyalty_earning_rule_v2"("p_purchase_type" "text", "p_points_percentage" numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_update_loyalty_earning_rule_v2"("p_purchase_type" "text", "p_points_percentage" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_loyalty_earning_rule_v2"("p_purchase_type" "text", "p_points_percentage" numeric) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_update_pickup_date_v2"("p_pickup_date_id" "uuid", "p_status" "text", "p_order_cutoff_at" timestamp with time zone, "p_cancellation_cutoff_at" timestamp with time zone, "p_note_en" "text", "p_note_th" "text", "p_note_zh" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_update_pickup_date_v2"("p_pickup_date_id" "uuid", "p_status" "text", "p_order_cutoff_at" timestamp with time zone, "p_cancellation_cutoff_at" timestamp with time zone, "p_note_en" "text", "p_note_th" "text", "p_note_zh" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_update_pickup_date_v2"("p_pickup_date_id" "uuid", "p_status" "text", "p_order_cutoff_at" timestamp with time zone, "p_cancellation_cutoff_at" timestamp with time zone, "p_note_en" "text", "p_note_th" "text", "p_note_zh" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_upsert_loyalty_reward_v2"("p_reward_id" "uuid", "p_reward_key" "text", "p_name_en" "text", "p_name_th" "text", "p_name_zh" "text", "p_description_en" "text", "p_description_th" "text", "p_description_zh" "text", "p_reward_type" "text", "p_points_required" integer, "p_fixed_discount_amount" numeric, "p_percentage_discount" numeric, "p_max_discount_amount" numeric, "p_product_id" "uuid", "p_channels" "text"[], "p_minimum_order_amount" numeric, "p_per_customer_limit" integer, "p_total_redemption_limit" integer, "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_sort_order" integer, "p_is_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_upsert_loyalty_reward_v2"("p_reward_id" "uuid", "p_reward_key" "text", "p_name_en" "text", "p_name_th" "text", "p_name_zh" "text", "p_description_en" "text", "p_description_th" "text", "p_description_zh" "text", "p_reward_type" "text", "p_points_required" integer, "p_fixed_discount_amount" numeric, "p_percentage_discount" numeric, "p_max_discount_amount" numeric, "p_product_id" "uuid", "p_channels" "text"[], "p_minimum_order_amount" numeric, "p_per_customer_limit" integer, "p_total_redemption_limit" integer, "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_sort_order" integer, "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_upsert_loyalty_reward_v2"("p_reward_id" "uuid", "p_reward_key" "text", "p_name_en" "text", "p_name_th" "text", "p_name_zh" "text", "p_description_en" "text", "p_description_th" "text", "p_description_zh" "text", "p_reward_type" "text", "p_points_required" integer, "p_fixed_discount_amount" numeric, "p_percentage_discount" numeric, "p_max_discount_amount" numeric, "p_product_id" "uuid", "p_channels" "text"[], "p_minimum_order_amount" numeric, "p_per_customer_limit" integer, "p_total_redemption_limit" integer, "p_starts_at" timestamp with time zone, "p_ends_at" timestamp with time zone, "p_sort_order" integer, "p_is_active" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_upsert_pickup_schedule_v2"("p_schedule_id" "uuid", "p_schedule_key" "text", "p_label_en" "text", "p_label_th" "text", "p_label_zh" "text", "p_pickup_weekday" smallint, "p_order_cutoff_days_before" smallint, "p_order_cutoff_time" time without time zone, "p_cancellation_cutoff_days_before" smallint, "p_cancellation_cutoff_time" time without time zone, "p_location_ids" "uuid"[], "p_is_active" boolean, "p_sort_order" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_upsert_pickup_schedule_v2"("p_schedule_id" "uuid", "p_schedule_key" "text", "p_label_en" "text", "p_label_th" "text", "p_label_zh" "text", "p_pickup_weekday" smallint, "p_order_cutoff_days_before" smallint, "p_order_cutoff_time" time without time zone, "p_cancellation_cutoff_days_before" smallint, "p_cancellation_cutoff_time" time without time zone, "p_location_ids" "uuid"[], "p_is_active" boolean, "p_sort_order" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."admin_upsert_pickup_schedule_v2"("p_schedule_id" "uuid", "p_schedule_key" "text", "p_label_en" "text", "p_label_th" "text", "p_label_zh" "text", "p_pickup_weekday" smallint, "p_order_cutoff_days_before" smallint, "p_order_cutoff_time" time without time zone, "p_cancellation_cutoff_days_before" smallint, "p_cancellation_cutoff_time" time without time zone, "p_location_ids" "uuid"[], "p_is_active" boolean, "p_sort_order" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_loyalty_points_delta_v2"("p_customer_id" "uuid", "p_points_delta" integer, "p_event_type" "text", "p_order_id" "uuid", "p_redemption_id" "uuid", "p_actor_id" "uuid", "p_reason" "text", "p_metadata" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_loyalty_points_delta_v2"("p_customer_id" "uuid", "p_points_delta" integer, "p_event_type" "text", "p_order_id" "uuid", "p_redemption_id" "uuid", "p_actor_id" "uuid", "p_reason" "text", "p_metadata" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."calculate_loyalty_points_on_order"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."calculate_loyalty_points_on_order"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_online_order"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_online_order"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_online_order"("p_order_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_online_order_legacy_v1"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_online_order_legacy_v1"("p_order_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_online_order_v2"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_online_order_v2"("p_order_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_online_order_v2_inventory_v1"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_online_order_v2_inventory_v1"("p_order_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_vip_magic_link_rate_limit"("p_ip_hash" "text", "p_code_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_vip_magic_link_rate_limit"("p_ip_hash" "text", "p_code_hash" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."claim_order_notification"("p_order_id" "uuid", "p_notification_type" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."claim_order_notification"("p_order_id" "uuid", "p_notification_type" "text") TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT UPDATE("status") ON TABLE "public"."orders" TO "authenticated";



GRANT UPDATE("payment_status") ON TABLE "public"."orders" TO "authenticated";



GRANT UPDATE("payment_method") ON TABLE "public"."orders" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."confirm_order_pickup"("p_order_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_order_pickup"("p_order_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_order_pickup"("p_order_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_online_order"("p_order_number" "text", "p_pickup_day_key" "text", "p_items" "jsonb", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_online_order"("p_order_number" "text", "p_pickup_day_key" "text", "p_items" "jsonb", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_online_order"("p_order_number" "text", "p_pickup_day_key" "text", "p_items" "jsonb", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_online_order_v2"("p_order_number" "text", "p_pickup_date_id" "uuid", "p_pickup_location_id" "uuid", "p_items" "jsonb", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_online_order_v2"("p_order_number" "text", "p_pickup_date_id" "uuid", "p_pickup_location_id" "uuid", "p_items" "jsonb", "p_notes" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_user_profile_with_qr"("p_email" "text", "p_name" "text", "p_phone" "text", "p_qr_token" "text", "p_line_id" "text", "p_whatsapp" "text", "p_wechat_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_user_profile_with_qr"("p_email" "text", "p_name" "text", "p_phone" "text", "p_qr_token" "text", "p_line_id" "text", "p_whatsapp" "text", "p_wechat_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile_with_qr"("p_email" "text", "p_name" "text", "p_phone" "text", "p_qr_token" "text", "p_line_id" "text", "p_whatsapp" "text", "p_wechat_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."finish_order_notification"("p_event_id" "uuid", "p_outcome" "text", "p_provider_message_id" "text", "p_error" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."finish_order_notification"("p_event_id" "uuid", "p_outcome" "text", "p_provider_message_id" "text", "p_error" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_next_short_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_next_short_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_next_short_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_qr_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_qr_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_qr_token"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_cms_pickup_location_deactivation_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_cms_pickup_location_deactivation_v2"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_customer_loyalty_balance_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_customer_loyalty_balance_v2"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_order_loyalty_payment_fields_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_order_loyalty_payment_fields_v2"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_pickup_schedule_lifecycle_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_pickup_schedule_lifecycle_v2"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."guard_v2_order_pickup_selection"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."guard_v2_order_pickup_selection"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user_profile"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_stock_remaining"() TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_stock_remaining"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_stock_remaining"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_staff_or_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_staff_or_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_staff_or_admin"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."materialize_pickup_dates_v2"("p_start_date" "date", "p_end_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."materialize_pickup_dates_v2"("p_start_date" "date", "p_end_date" "date") TO "service_role";
GRANT ALL ON FUNCTION "public"."materialize_pickup_dates_v2"("p_start_date" "date", "p_end_date" "date") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."prevent_inventory_event_mutation_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_inventory_event_mutation_v2"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_walk_in_purchase"("p_customer_id" "uuid", "p_amount" numeric, "p_order_number" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_walk_in_purchase"("p_customer_id" "uuid", "p_amount" numeric, "p_order_number" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_walk_in_purchase"("p_customer_id" "uuid", "p_amount" numeric, "p_order_number" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_walk_in_purchase_v2"("p_customer_id" "uuid", "p_amount" numeric, "p_order_number" "text", "p_reward_id" "uuid", "p_request_key" "uuid", "p_payment_method" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_walk_in_purchase_v2"("p_customer_id" "uuid", "p_amount" numeric, "p_order_number" "text", "p_reward_id" "uuid", "p_request_key" "uuid", "p_payment_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_walk_in_purchase_v2"("p_customer_id" "uuid", "p_amount" numeric, "p_order_number" "text", "p_reward_id" "uuid", "p_request_key" "uuid", "p_payment_method" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."refund_reserved_order_loyalty_reward_v2"("p_order_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."refund_reserved_order_loyalty_reward_v2"("p_order_id" "uuid", "p_actor_id" "uuid", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."reject_zero_value_monetary_loyalty_redemption_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."reject_zero_value_monetary_loyalty_redemption_v2"() TO "service_role";



GRANT ALL ON FUNCTION "public"."require_online_order_pickup_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."require_online_order_pickup_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."require_online_order_pickup_date"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_loyalty_reward_updated_at_v2"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_loyalty_reward_updated_at_v2"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_record_order_payment_v2"("p_order_id" "uuid", "p_payment_method" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_record_order_payment_v2"("p_order_id" "uuid", "p_payment_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_record_order_payment_v2"("p_order_id" "uuid", "p_payment_method" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_redeem_loyalty_reward_v2"("p_customer_id" "uuid", "p_reward_id" "uuid", "p_channel" "text", "p_order_id" "uuid", "p_context_amount" numeric, "p_request_key" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_redeem_loyalty_reward_v2"("p_customer_id" "uuid", "p_reward_id" "uuid", "p_channel" "text", "p_order_id" "uuid", "p_context_amount" numeric, "p_request_key" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_redeem_loyalty_reward_v2"("p_customer_id" "uuid", "p_reward_id" "uuid", "p_channel" "text", "p_order_id" "uuid", "p_context_amount" numeric, "p_request_key" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."staff_repair_completed_order_payment_method_v2"("p_order_id" "uuid", "p_payment_method" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."staff_repair_completed_order_payment_method_v2"("p_order_id" "uuid", "p_payment_method" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."staff_repair_completed_order_payment_method_v2"("p_order_id" "uuid", "p_payment_method" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_completed_user_profile_to_customer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_completed_user_profile_to_customer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_loyalty_points_per_baht"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_loyalty_points_per_baht"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_loyalty_points_per_baht"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_cancellation_cutoff_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_cancellation_cutoff_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_cancellation_cutoff_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_customer_loyalty_balance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_customer_loyalty_balance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_orders_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_orders_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_orders_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_user_profiles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_user_profiles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_user_profiles_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."auth_users" TO "anon";
GRANT ALL ON TABLE "public"."auth_users" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_users" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."cancellation_cutoff_rules" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cancellation_cutoff_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."cancellation_cutoff_rules" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."cms_categories" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."cms_categories" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."cms_labels" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_labels" TO "authenticated";
GRANT ALL ON TABLE "public"."cms_labels" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."cms_pages" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."cms_pages" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."cms_pickup_days" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_pickup_days" TO "authenticated";
GRANT ALL ON TABLE "public"."cms_pickup_days" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."cms_pickup_locations" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_pickup_locations" TO "authenticated";
GRANT ALL ON TABLE "public"."cms_pickup_locations" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."cms_products" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."cms_products" TO "authenticated";
GRANT ALL ON TABLE "public"."cms_products" TO "service_role";



GRANT SELECT,MAINTAIN ON TABLE "public"."cms_settings" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."cms_settings" TO "service_role";



GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT UPDATE("name") ON TABLE "public"."customers" TO "authenticated";



GRANT UPDATE("phone") ON TABLE "public"."customers" TO "authenticated";



GRANT UPDATE("line_id") ON TABLE "public"."customers" TO "authenticated";



GRANT UPDATE("whatsapp") ON TABLE "public"."customers" TO "authenticated";



GRANT UPDATE("wechat_id") ON TABLE "public"."customers" TO "authenticated";



GRANT ALL ON TABLE "public"."inventory_events" TO "service_role";
GRANT SELECT ON TABLE "public"."inventory_events" TO "authenticated";



GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."line_users" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."line_users" TO "authenticated";
GRANT ALL ON TABLE "public"."line_users" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_point_events" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_point_events" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."loyalty_point_events_event_sequence_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."loyalty_point_events_event_sequence_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."loyalty_point_events_event_sequence_seq" TO "service_role";



GRANT ALL ON TABLE "public"."loyalty_redemptions" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_redemptions" TO "authenticated";



GRANT ALL ON TABLE "public"."loyalty_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."loyalty_settings" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_settings" TO "authenticated";



GRANT ALL ON TABLE "public"."order_notification_events" TO "service_role";



GRANT ALL ON TABLE "public"."pickup_cutoff_rules" TO "anon";
GRANT ALL ON TABLE "public"."pickup_cutoff_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."pickup_cutoff_rules" TO "service_role";



GRANT ALL ON TABLE "public"."pickup_date_locations" TO "service_role";
GRANT SELECT ON TABLE "public"."pickup_date_locations" TO "anon";
GRANT SELECT ON TABLE "public"."pickup_date_locations" TO "authenticated";



GRANT ALL ON TABLE "public"."pickup_dates" TO "service_role";
GRANT SELECT ON TABLE "public"."pickup_dates" TO "anon";
GRANT SELECT ON TABLE "public"."pickup_dates" TO "authenticated";



GRANT ALL ON TABLE "public"."pickup_overrides" TO "anon";
GRANT ALL ON TABLE "public"."pickup_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."pickup_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."pickup_schedule_locations" TO "service_role";
GRANT SELECT ON TABLE "public"."pickup_schedule_locations" TO "anon";
GRANT SELECT ON TABLE "public"."pickup_schedule_locations" TO "authenticated";



GRANT ALL ON TABLE "public"."pickup_schedules" TO "service_role";
GRANT SELECT ON TABLE "public"."pickup_schedules" TO "anon";
GRANT SELECT ON TABLE "public"."pickup_schedules" TO "authenticated";



GRANT ALL ON TABLE "public"."product_likes" TO "anon";
GRANT ALL ON TABLE "public"."product_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."product_likes" TO "service_role";



GRANT ALL ON TABLE "public"."product_also_liked" TO "anon";
GRANT ALL ON TABLE "public"."product_also_liked" TO "authenticated";
GRANT ALL ON TABLE "public"."product_also_liked" TO "service_role";



GRANT ALL ON TABLE "public"."product_date_inventory" TO "service_role";
GRANT SELECT ON TABLE "public"."product_date_inventory" TO "authenticated";



GRANT ALL ON TABLE "public"."product_like_counts" TO "anon";
GRANT ALL ON TABLE "public"."product_like_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."product_like_counts" TO "service_role";



GRANT ALL ON TABLE "public"."product_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."product_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."product_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."product_schedule_capacity" TO "service_role";
GRANT SELECT ON TABLE "public"."product_schedule_capacity" TO "authenticated";



GRANT SELECT,MAINTAIN ON TABLE "public"."site_social_links" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."site_social_links" TO "authenticated";
GRANT ALL ON TABLE "public"."site_social_links" TO "service_role";



GRANT ALL ON TABLE "public"."top_liked_products" TO "anon";
GRANT ALL ON TABLE "public"."top_liked_products" TO "authenticated";
GRANT ALL ON TABLE "public"."top_liked_products" TO "service_role";



GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT UPDATE("name") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT UPDATE("phone") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT UPDATE("line_id") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT UPDATE("whatsapp") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT UPDATE("wechat_id") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT UPDATE("profile_completed") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT UPDATE("updated_at") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT UPDATE("qr_token") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT UPDATE("profile_picture_url") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT UPDATE("short_code") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT UPDATE("email") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT UPDATE("preferred_language") ON TABLE "public"."user_profiles" TO "authenticated";



GRANT ALL ON TABLE "public"."vip_magic_link_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."vip_magic_link_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."vip_magic_link_rate_limits" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








-- ===========================================================================
-- Canonical production ACL normalization
-- ===========================================================================

-- JOKO TODAY canonical production ACL normalization
-- Generated from production-public-schema.sql
-- Purpose: neutralize broad Supabase default table ACLs,
-- then restore the exact production grants for anon/authenticated.

BEGIN;

REVOKE ALL PRIVILEGES
ON ALL TABLES IN SCHEMA public
FROM anon, authenticated;

GRANT SELECT ON TABLE "public"."loyalty_rewards" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_rewards" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."orders" TO "authenticated";
GRANT UPDATE("status") ON TABLE "public"."orders" TO "authenticated";
GRANT UPDATE("payment_status") ON TABLE "public"."orders" TO "authenticated";
GRANT UPDATE("payment_method") ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_users" TO "anon";
GRANT ALL ON TABLE "public"."auth_users" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."cancellation_cutoff_rules" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cancellation_cutoff_rules" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."cms_categories" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_categories" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."cms_labels" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_labels" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."cms_pages" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_pages" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."cms_pickup_days" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_pickup_days" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."cms_pickup_locations" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_pickup_locations" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."cms_products" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."cms_products" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."cms_settings" TO "anon";
GRANT SELECT,INSERT,MAINTAIN,UPDATE ON TABLE "public"."cms_settings" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."customers" TO "authenticated";
GRANT UPDATE("name") ON TABLE "public"."customers" TO "authenticated";
GRANT UPDATE("phone") ON TABLE "public"."customers" TO "authenticated";
GRANT UPDATE("line_id") ON TABLE "public"."customers" TO "authenticated";
GRANT UPDATE("whatsapp") ON TABLE "public"."customers" TO "authenticated";
GRANT UPDATE("wechat_id") ON TABLE "public"."customers" TO "authenticated";
GRANT SELECT ON TABLE "public"."inventory_events" TO "authenticated";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."line_users" TO "anon";
GRANT SELECT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."line_users" TO "authenticated";
GRANT SELECT ON TABLE "public"."loyalty_point_events" TO "authenticated";
GRANT SELECT ON TABLE "public"."loyalty_redemptions" TO "authenticated";
GRANT SELECT ON TABLE "public"."loyalty_settings" TO "anon";
GRANT SELECT ON TABLE "public"."loyalty_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."pickup_cutoff_rules" TO "anon";
GRANT ALL ON TABLE "public"."pickup_cutoff_rules" TO "authenticated";
GRANT SELECT ON TABLE "public"."pickup_date_locations" TO "anon";
GRANT SELECT ON TABLE "public"."pickup_date_locations" TO "authenticated";
GRANT SELECT ON TABLE "public"."pickup_dates" TO "anon";
GRANT SELECT ON TABLE "public"."pickup_dates" TO "authenticated";
GRANT ALL ON TABLE "public"."pickup_overrides" TO "anon";
GRANT ALL ON TABLE "public"."pickup_overrides" TO "authenticated";
GRANT SELECT ON TABLE "public"."pickup_schedule_locations" TO "anon";
GRANT SELECT ON TABLE "public"."pickup_schedule_locations" TO "authenticated";
GRANT SELECT ON TABLE "public"."pickup_schedules" TO "anon";
GRANT SELECT ON TABLE "public"."pickup_schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."product_likes" TO "anon";
GRANT ALL ON TABLE "public"."product_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."product_also_liked" TO "anon";
GRANT ALL ON TABLE "public"."product_also_liked" TO "authenticated";
GRANT SELECT ON TABLE "public"."product_date_inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."product_like_counts" TO "anon";
GRANT ALL ON TABLE "public"."product_like_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."product_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."product_recommendations" TO "authenticated";
GRANT SELECT ON TABLE "public"."product_schedule_capacity" TO "authenticated";
GRANT SELECT,MAINTAIN ON TABLE "public"."site_social_links" TO "anon";
GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE "public"."site_social_links" TO "authenticated";
GRANT ALL ON TABLE "public"."top_liked_products" TO "anon";
GRANT ALL ON TABLE "public"."top_liked_products" TO "authenticated";
GRANT SELECT,INSERT,MAINTAIN ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("name") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("phone") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("line_id") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("whatsapp") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("wechat_id") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("profile_completed") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("updated_at") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("qr_token") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("profile_picture_url") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("short_code") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("email") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT UPDATE("preferred_language") ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."vip_magic_link_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."vip_magic_link_rate_limits" TO "authenticated";

COMMIT;

-- ===========================================================================
-- Canonical production Storage configuration
-- ===========================================================================

-- JOKO TODAY canonical production Storage baseline
-- Recreates current production bucket metadata and storage.objects policies.

BEGIN;

-- ---------------------------------------------------------------------------
-- Buckets
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES
(
  'assets',
  'assets',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/svg+xml'
  ]::text[]
),
(
  'product-qr',
  'product-qr',
  true,
  NULL,
  NULL
),
(
  'profile-pictures',
  'profile-pictures',
  true,
  5242880,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Current production storage.objects policies
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anon users can update assets"
  ON storage.objects;

DROP POLICY IF EXISTS "Anon users can upload to assets"
  ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can delete QR codes"
  ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can delete from assets"
  ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can update QR codes"
  ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can update assets"
  ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload QR codes"
  ON storage.objects;

DROP POLICY IF EXISTS "Authenticated users can upload to assets"
  ON storage.objects;

DROP POLICY IF EXISTS "Users can delete their own profile pictures"
  ON storage.objects;

DROP POLICY IF EXISTS "Users can update their own profile pictures"
  ON storage.objects;

DROP POLICY IF EXISTS "Users can upload their own profile pictures"
  ON storage.objects;


CREATE POLICY "Anon users can update assets"
ON storage.objects
FOR UPDATE
TO anon
USING (bucket_id = 'assets')
WITH CHECK (bucket_id = 'assets');


CREATE POLICY "Anon users can upload to assets"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'assets');


CREATE POLICY "Authenticated users can delete QR codes"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-qr');


CREATE POLICY "Authenticated users can delete from assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'assets');


CREATE POLICY "Authenticated users can update QR codes"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-qr');


CREATE POLICY "Authenticated users can update assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'assets')
WITH CHECK (bucket_id = 'assets');


CREATE POLICY "Authenticated users can upload QR codes"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-qr');


CREATE POLICY "Authenticated users can upload to assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'assets');


CREATE POLICY "Users can delete their own profile pictures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


CREATE POLICY "Users can update their own profile pictures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


CREATE POLICY "Users can upload their own profile pictures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

COMMIT;
