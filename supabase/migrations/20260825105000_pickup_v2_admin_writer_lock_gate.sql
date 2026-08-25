/*
  Pickup / inventory v2 — Admin writer table-lock gate.

  The final materializer uses SHARE table locks to freeze recurring configuration
  while it builds one concrete-date snapshot. An Admin writer that has already
  locked a schedule row must not subsequently wait for one of those SHARE table
  locks, because the materializer's pickup_dates foreign-key check may need a
  KEY SHARE lock on that same schedule row.

  These replacements therefore acquire the relevant conflicting table-level
  write lock BEFORE taking schedule row locks:
    - schedule Admin: pickup_schedules ROW EXCLUSIVE
    - recurring capacity Admin: product_schedule_capacity ROW EXCLUSIVE
    - recurring availability Admin: product_schedule_capacity ROW EXCLUSIVE

  This creates an early gate: either the Admin writer enters first and the
  materializer waits before snapshot work, or the materializer enters first and
  the Admin writer waits before acquiring a schedule row lock.

  No RLS or customer v2 grants are changed.
*/

BEGIN;

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
    Lock requested/current global locations first. This remains compatible with
    the location-deactivation trigger's location-before-schedule row order.
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

  /*
    Critical ordering gate for the materializer SHARE lock. Acquire this table
    write lock before any schedule row FOR UPDATE / FK-conflicting row lock.
  */
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
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_pickup_schedule_v2(
  uuid, text, text, text, text, smallint, smallint, time, smallint, time, uuid[], boolean, integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_pickup_schedule_v2(
  uuid, text, text, text, text, smallint, smallint, time, smallint, time, uuid[], boolean, integer
) TO authenticated;

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

  /* Enter before schedule row locking if the materializer SHARE lock is active. */
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

  /* Enter before schedule/capacity row locking if materialization is active. */
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

REVOKE ALL ON FUNCTION public.admin_set_product_schedule_availability_v2(uuid, uuid, boolean, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_schedule_availability_v2(uuid, uuid, boolean, boolean)
TO authenticated;

COMMIT;
