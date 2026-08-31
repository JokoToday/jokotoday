/*
  Pickup / inventory v2 — materializer snapshot guard.

  Follow-up hardening for the Admin concrete-date rollout. The recurring row
  locks introduced in 20260825103000 protect existing rows, but row locks do not
  prevent a brand-new schedule/location/capacity row from being inserted after
  the materializer has started.

  This replacement materializer therefore holds SHARE table locks on the small
  pickup configuration tables for the duration of one materialization call.
  SHARE permits customer/admin reads but blocks INSERT/UPDATE/DELETE until the
  snapshot transaction completes. It also avoids waiting on recurring row locks,
  so an Admin function that reached SELECT ... FOR UPDATE before the SHARE lock
  was acquired cannot create a row-lock/table-lock upgrade deadlock.

  No RLS, customer grants, or checkout behavior are changed.
*/

BEGIN;

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

REVOKE ALL ON FUNCTION public.materialize_pickup_dates_v2(date, date)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.materialize_pickup_dates_v2(date, date)
TO authenticated;

COMMIT;
