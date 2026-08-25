/*
  Pickup / inventory v2 — Admin configuration integrity hardening.

  PURPOSE
  -------
  Make the Admin-managed pickup schedule/date workflow safe at the database
  boundary under concurrent Admin operations.

  Global lock order used by v2 Admin configuration writes:

    1. cms_pickup_locations
    2. pickup_schedules
    3. pickup_dates
    4. dependent schedule/date rows

  Functions that mutate recurring product capacity also lock their schedule
  before changing capacity. The materializer holds the same recurring
  configuration locks for the whole snapshot operation.

  This migration:
    - prevents active schedules from racing global location deactivation;
    - serializes concrete-date location changes;
    - never leaves an OPEN date without a globally active pickup location;
    - rejects enabling a globally inactive location for a concrete date;
    - prevents global location deactivation while active v2 schedules or future
      open concrete dates still depend on it;
    - materializes recurring location/capacity snapshots only for newly-created
      pickup dates so reruns cannot expand an existing/manual snapshot;
    - keeps recurring schedule/location/capacity configuration stable throughout
      one materialization call;
    - makes the advertised 366-day materialization cap inclusive;
    - blocks normal materialization into the past.

  ROLLOUT
  -------
  This migration does NOT enable customer v2 checkout and does NOT change RLS.
  Customer create/cancel v2 RPC grants remain dark until separately reviewed.
*/

BEGIN;

/* -------------------------------------------------------------------------- */
/* Global pickup-location deactivation guard                                   */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.guard_cms_pickup_location_deactivation_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND COALESCE(OLD.is_active, false) = true
     AND COALESCE(NEW.is_active, false) = false THEN

    /*
      The UPDATE already owns the location row lock. All other v2 Admin writers
      acquire location locks before schedule/date locks, so the trigger follows
      the same location -> schedule -> date order and cannot form the inverse
      date -> location cycle.
    */
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

REVOKE ALL ON FUNCTION public.guard_cms_pickup_location_deactivation_v2()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_cms_pickup_location_deactivation_v2
  ON public.cms_pickup_locations;
CREATE TRIGGER guard_cms_pickup_location_deactivation_v2
BEFORE UPDATE OF is_active
ON public.cms_pickup_locations
FOR EACH ROW
EXECUTE FUNCTION public.guard_cms_pickup_location_deactivation_v2();

/* -------------------------------------------------------------------------- */
/* Recurring pickup schedule Admin                                             */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.admin_upsert_pickup_schedule_v2(
  p_schedule_id uuid,
  p_schedule_key text,
  p_label_en text,
  p_label_th text,
  p_label_zh text,
  p_pickup_weekday smallint,
  p_order_cutoff_days_before smallint,
  p_order_cutoff_time time,
  p_cancellation_cutoff_days_before smallint,
  p_cancellation_cutoff_time time,
  p_location_ids uuid[],
  p_is_active boolean,
  p_sort_order integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  /*
    Location rows are always locked before the schedule row. Include both the
    requested locations and the schedule's currently linked locations so a
    concurrent global location deactivation cannot race schedule activation or
    reconfiguration.
  */
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
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_pickup_schedule_v2(
  uuid, text, text, text, text, smallint, smallint, time, smallint, time, uuid[], boolean, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_pickup_schedule_v2(
  uuid, text, text, text, text, smallint, smallint, time, smallint, time, uuid[], boolean, integer
) TO authenticated;

/* -------------------------------------------------------------------------- */
/* Recurring product capacity / availability Admin                            */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.admin_set_product_schedule_capacity_v2(
  p_schedule_id uuid,
  p_product_id uuid,
  p_capacity integer,
  p_apply_to_future_dates boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  /* Capacity mutations serialize with schedule edits and materialization. */
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

REVOKE ALL ON FUNCTION public.admin_set_product_schedule_capacity_v2(uuid, uuid, integer, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_schedule_capacity_v2(uuid, uuid, integer, boolean)
TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_product_schedule_availability_v2(
  p_schedule_id uuid,
  p_product_id uuid,
  p_is_active boolean,
  p_apply_to_future_dates boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  /* Availability mutations serialize with schedule edits and materialization. */
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

REVOKE ALL ON FUNCTION public.admin_set_product_schedule_availability_v2(uuid, uuid, boolean, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_schedule_availability_v2(uuid, uuid, boolean, boolean)
TO authenticated;

/* -------------------------------------------------------------------------- */
/* Concrete pickup-date Admin                                                  */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.admin_update_pickup_date_v2(
  p_pickup_date_id uuid,
  p_status text,
  p_order_cutoff_at timestamptz,
  p_cancellation_cutoff_at timestamptz,
  p_note_en text DEFAULT NULL,
  p_note_th text DEFAULT NULL,
  p_note_zh text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  /*
    Lock every currently linked global location first, in deterministic order,
    before taking the pickup-date row lock. This matches the deactivation trigger
    and date-location RPC lock order.
  */
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

REVOKE ALL ON FUNCTION public.admin_update_pickup_date_v2(uuid, text, timestamptz, timestamptz, text, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_pickup_date_v2(uuid, text, timestamptz, timestamptz, text, text, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_pickup_date_location_v2(
  p_pickup_date_id uuid,
  p_location_id uuid,
  p_is_active boolean,
  p_note_en text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  /*
    Lock all existing global locations for this date plus the requested location
    before taking the pickup-date lock. Concurrent toggles therefore serialize
    without creating the inverse date -> location order used by the old version.
  */
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
    /* Raising rolls back the upsert in the same RPC transaction. */
    RAISE EXCEPTION 'An open pickup date requires at least one active pickup location';
  END IF;

  RETURN to_jsonb(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_pickup_date_location_v2(uuid, uuid, boolean, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_pickup_date_location_v2(uuid, uuid, boolean, text)
TO authenticated;

/* -------------------------------------------------------------------------- */
/* Concrete-date materializer                                                  */
/* -------------------------------------------------------------------------- */

CREATE OR REPLACE FUNCTION public.materialize_pickup_dates_v2(
  p_start_date date,
  p_end_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  /* Difference 365 means 366 inclusive calendar dates. */
  IF p_end_date - p_start_date >= 366 THEN
    RAISE EXCEPTION 'Pickup date materialization is limited to 366 inclusive days per call';
  END IF;

  /*
    Stabilize the complete recurring configuration for the whole materializer
    transaction. Lock locations first, then schedules, matching every other v2
    Admin configuration writer. Capacity Admin RPCs also lock their schedule, so
    holding all schedule rows prevents capacity/availability changes until this
    snapshot finishes.
  */
  PERFORM l.id
  FROM public.cms_pickup_locations l
  ORDER BY l.id
  FOR SHARE;

  PERFORM s.id
  FROM public.pickup_schedules s
  ORDER BY s.id
  FOR UPDATE;

  PERFORM sl.schedule_id, sl.location_id
  FROM public.pickup_schedule_locations sl
  ORDER BY sl.schedule_id, sl.location_id
  FOR SHARE;

  PERFORM c.schedule_id, c.product_id
  FROM public.product_schedule_capacity c
  ORDER BY c.schedule_id, c.product_id
  FOR SHARE;

  /* Existing dates in the requested range follow the same later lock level. */
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
    recurring capacities are snapshotted only onto these new dates. Existing
    generated/manual dates are stable and are not expanded by rerunning the
    materializer after recurring configuration changes.
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

  INSERT INTO public.pickup_date_locations (pickup_date_id, location_id, is_active, sort_order)
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
          WHEN 'Sunday' THEN 0 WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2
          WHEN 'Wednesday' THEN 3 WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5
          WHEN 'Saturday' THEN 6 ELSE NULL
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

REVOKE ALL ON FUNCTION public.materialize_pickup_dates_v2(date, date)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materialize_pickup_dates_v2(date, date)
TO authenticated;

COMMIT;
