/*
  Pickup / inventory v2 — Admin concrete-date integrity hardening.

  PURPOSE
  -------
  Make the new Admin schedule/date controls safe at the database boundary:
    - serialize concurrent date-location changes;
    - never leave an OPEN date without a globally active pickup location;
    - reject enabling a globally inactive location for a concrete date;
    - prevent global location deactivation while active v2 schedules or future
      open concrete dates still depend on it;
    - materialize recurring location/capacity snapshots only for newly-created
      pickup dates so reruns cannot expand an existing/manual snapshot;
    - make the advertised 366-day materialization cap inclusive.

  ROLLOUT
  -------
  This migration does NOT enable customer v2 checkout and does NOT change RLS.
  It only replaces existing admin-only RPC implementations and adds a defensive
  trigger on cms_pickup_locations.
*/

BEGIN;

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
      Keep recurring configuration internally consistent. Reassign or disable
      the recurring schedule/link first, then deactivate the global location.
    */
    PERFORM s.id
    FROM public.pickup_schedules s
    JOIN public.pickup_schedule_locations sl ON sl.schedule_id = s.id
    WHERE sl.location_id = OLD.id
      AND s.is_active = true
      AND sl.is_active = true
    FOR UPDATE OF s;

    IF FOUND THEN
      RAISE EXCEPTION
        'Pickup location is used by an active v2 recurring schedule; reassign or deactivate that schedule first';
    END IF;

    /*
      A future OPEN concrete date may outlive changes to its recurring template.
      Require Admin to disable/replace this date-location snapshot first.
    */
    PERFORM d.id
    FROM public.pickup_dates d
    JOIN public.pickup_date_locations dl ON dl.pickup_date_id = d.id
    WHERE dl.location_id = OLD.id
      AND dl.is_active = true
      AND d.status = 'open'
      AND d.pickup_date >= timezone('Asia/Bangkok', now())::date
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

  /* Serialize status changes with date-location mutations. */
  SELECT d.* INTO v_existing
  FROM public.pickup_dates d
  WHERE d.id = p_pickup_date_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup date not found'; END IF;

  IF p_status = 'open' THEN
    /*
      Lock at least one usable location while reopening/keeping the date open.
      Global location deactivation takes an UPDATE lock and therefore cannot
      silently race this validation without one transaction being retried.
    */
    PERFORM dl.location_id
    FROM public.pickup_date_locations dl
    JOIN public.cms_pickup_locations l ON l.id = dl.location_id
    WHERE dl.pickup_date_id = p_pickup_date_id
      AND dl.is_active = true
      AND l.is_active = true
    ORDER BY dl.sort_order, dl.location_id
    LIMIT 1
    FOR SHARE OF dl, l;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'An open pickup date requires at least one active pickup location';
    END IF;
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
    Every date-location mutation takes the same date row lock first. Concurrent
    Admin toggles for one date are therefore serialized before the final
    open-date invariant is checked.
  */
  SELECT d.* INTO v_date
  FROM public.pickup_dates d
  WHERE d.id = p_pickup_date_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup date not found'; END IF;

  SELECT l.is_active INTO v_location_active
  FROM public.cms_pickup_locations l
  WHERE l.id = p_location_id
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup location not found'; END IF;

  IF COALESCE(p_is_active, false) = true
     AND COALESCE(v_location_active, false) = false THEN
    RAISE EXCEPTION 'A globally inactive pickup location cannot be enabled for a concrete date';
  END IF;

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

  IF v_date.status = 'open' THEN
    PERFORM dl.location_id
    FROM public.pickup_date_locations dl
    JOIN public.cms_pickup_locations l ON l.id = dl.location_id
    WHERE dl.pickup_date_id = p_pickup_date_id
      AND dl.is_active = true
      AND l.is_active = true
    ORDER BY dl.sort_order, dl.location_id
    LIMIT 1
    FOR SHARE OF dl, l;

    IF NOT FOUND THEN
      /* Raising here rolls back the upsert above in the same RPC transaction. */
      RAISE EXCEPTION 'An open pickup date requires at least one active pickup location';
    END IF;
  END IF;

  RETURN to_jsonb(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_pickup_date_location_v2(uuid, uuid, boolean, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_pickup_date_location_v2(uuid, uuid, boolean, text)
TO authenticated;

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

  /* Fail closed before creating open dates from an unusable recurring schedule. */
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
        WHERE id = v_date.id;
      ELSIF v_override.override_type = 'sold_out' THEN
        UPDATE public.pickup_dates
        SET status = 'sold_out',
            note_en = NULLIF(v_override.note_en, ''),
            note_th = NULLIF(v_override.note_th, ''),
            source = 'legacy_override',
            updated_at = now()
        WHERE id = v_date.id;
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
        WHERE id = v_date.id;
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
