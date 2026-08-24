/*
  Pickup / inventory architecture v2 — transactional RPCs.

  Additive only: legacy create_online_order() and cancel_online_order() remain
  unchanged and authoritative until a separately reviewed frontend cutover.
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
  v_date record;
  v_override public.pickup_overrides%ROWTYPE;
  v_custom_cutoff_weekday integer;
  v_custom_cutoff_date date;
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
  IF p_end_date - p_start_date > 366 THEN
    RAISE EXCEPTION 'Pickup date materialization is limited to 366 days per call';
  END IF;

  INSERT INTO public.pickup_dates (
    schedule_id, pickup_date, order_cutoff_at, cancellation_cutoff_at, status, source
  )
  SELECT
    s.id,
    gs.day_value::date,
    (((gs.day_value::date - s.order_cutoff_days_before::integer)::timestamp + s.order_cutoff_time)
      AT TIME ZONE 'Asia/Bangkok'),
    (((gs.day_value::date - s.cancellation_cutoff_days_before::integer)::timestamp + s.cancellation_cutoff_time)
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
  ON CONFLICT (schedule_id, pickup_date) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  INSERT INTO public.pickup_date_locations (pickup_date_id, location_id, is_active, sort_order)
  SELECT d.id, sl.location_id, sl.is_active, sl.sort_order
  FROM public.pickup_dates d
  JOIN public.pickup_schedule_locations sl ON sl.schedule_id = d.schedule_id
  WHERE d.pickup_date BETWEEN p_start_date AND p_end_date
    AND sl.is_active = true
  ON CONFLICT (pickup_date_id, location_id) DO NOTHING;

  INSERT INTO public.product_date_inventory (
    pickup_date_id, product_id, capacity, reserved_quantity, capacity_source
  )
  SELECT d.id, c.product_id, c.capacity, 0, 'recurring_default'
  FROM public.pickup_dates d
  JOIN public.product_schedule_capacity c ON c.schedule_id = d.schedule_id
  WHERE d.pickup_date BETWEEN p_start_date AND p_end_date
    AND c.is_active = true
  ON CONFLICT (pickup_date_id, product_id) DO NOTHING;

  /* Rebuild only dates previously sourced from the legacy override bridge. */
  UPDATE public.pickup_dates d
  SET order_cutoff_at = (((d.pickup_date - s.order_cutoff_days_before::integer)::timestamp + s.order_cutoff_time)
        AT TIME ZONE 'Asia/Bangkok'),
      cancellation_cutoff_at = (((d.pickup_date - s.cancellation_cutoff_days_before::integer)::timestamp + s.cancellation_cutoff_time)
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

  /* Transitional compatibility with the existing date-specific override table. */
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
        SET order_cutoff_at = ((v_custom_cutoff_date::timestamp + v_override.custom_cutoff_time::time)
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

REVOKE ALL ON FUNCTION public.materialize_pickup_dates_v2(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.materialize_pickup_dates_v2(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.materialize_pickup_dates_v2(date, date) TO authenticated;

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

  SELECT count(*) INTO v_location_count
  FROM public.cms_pickup_locations l
  WHERE l.id = ANY(p_location_ids);
  IF v_location_count <> cardinality(p_location_ids) THEN
    RAISE EXCEPTION 'One or more pickup locations do not exist';
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
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_pickup_schedule_v2(
  uuid, text, text, text, text, smallint, smallint, time, smallint, time, uuid[], boolean, integer
) FROM anon;
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
  IF NOT EXISTS (SELECT 1 FROM public.pickup_schedules WHERE id = p_schedule_id) THEN
    RAISE EXCEPTION 'Pickup schedule not found';
  END IF;
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
  DO UPDATE SET capacity = EXCLUDED.capacity, is_active = true, updated_at = now()
  RETURNING * INTO v_result;

  IF COALESCE(p_apply_to_future_dates, true) THEN
    INSERT INTO public.product_date_inventory (
      pickup_date_id, product_id, capacity, reserved_quantity, capacity_source
    )
    SELECT d.id, p_product_id, p_capacity, 0, 'recurring_default'
    FROM public.pickup_dates d
    WHERE d.schedule_id = p_schedule_id AND d.pickup_date >= v_today
    ON CONFLICT (pickup_date_id, product_id) DO NOTHING;

    UPDATE public.product_date_inventory i
    SET capacity = p_capacity, updated_at = now()
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

REVOKE ALL ON FUNCTION public.admin_set_product_schedule_capacity_v2(uuid, uuid, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_product_schedule_capacity_v2(uuid, uuid, integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_schedule_capacity_v2(uuid, uuid, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_product_date_capacity_v2(
  p_pickup_date_id uuid,
  p_product_id uuid,
  p_capacity integer,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing public.product_date_inventory%ROWTYPE;
  v_result public.product_date_inventory%ROWTYPE;
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
  IF NOT EXISTS (SELECT 1 FROM public.pickup_dates WHERE id = p_pickup_date_id) THEN
    RAISE EXCEPTION 'Pickup date not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cms_products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  SELECT * INTO v_existing
  FROM public.product_date_inventory
  WHERE pickup_date_id = p_pickup_date_id AND product_id = p_product_id
  FOR UPDATE;
  IF FOUND AND v_existing.reserved_quantity > p_capacity THEN
    RAISE EXCEPTION 'Capacity cannot be lower than already reserved quantity';
  END IF;

  INSERT INTO public.product_date_inventory (
    pickup_date_id, product_id, capacity, reserved_quantity,
    capacity_source, override_note, updated_at
  ) VALUES (
    p_pickup_date_id, p_product_id, p_capacity,
    COALESCE(v_existing.reserved_quantity, 0), 'date_override',
    NULLIF(btrim(COALESCE(p_note, '')), ''), now()
  )
  ON CONFLICT (pickup_date_id, product_id)
  DO UPDATE SET capacity = EXCLUDED.capacity,
                capacity_source = 'date_override',
                override_note = EXCLUDED.override_note,
                updated_at = now()
  RETURNING * INTO v_result;

  RETURN to_jsonb(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_product_date_capacity_v2(uuid, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_product_date_capacity_v2(uuid, uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_product_date_capacity_v2(uuid, uuid, integer, text) TO authenticated;

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
  IF NOT FOUND THEN RAISE EXCEPTION 'Pickup date not found'; END IF;
  RETURN to_jsonb(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_pickup_date_v2(uuid, text, timestamptz, timestamptz, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_pickup_date_v2(uuid, text, timestamptz, timestamptz, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_pickup_date_v2(uuid, text, timestamptz, timestamptz, text, text, text) TO authenticated;

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
  v_result public.pickup_date_locations%ROWTYPE;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.user_profiles p
    WHERE p.id = v_user_id AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin authorization required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pickup_dates WHERE id = p_pickup_date_id) THEN
    RAISE EXCEPTION 'Pickup date not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cms_pickup_locations WHERE id = p_location_id) THEN
    RAISE EXCEPTION 'Pickup location not found';
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
  RETURN to_jsonb(v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_pickup_date_location_v2(uuid, uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_set_pickup_date_location_v2(uuid, uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_set_pickup_date_location_v2(uuid, uuid, boolean, text) TO authenticated;

/*
  Atomic v2 order creation.
  Inventory identity is pickup_date_id + product_id only; pickup location is
  validated but never participates in the inventory key.
*/
CREATE OR REPLACE FUNCTION public.create_online_order_v2(
  p_order_number text,
  p_pickup_date_id uuid,
  p_pickup_location_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  v_today_bangkok date := timezone('Asia/Bangkok', now())::date;
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
         )
  INTO v_distinct_item_count, v_invalid_item_count
  FROM jsonb_to_recordset(p_items) AS item(product_id uuid, quantity integer);

  IF v_invalid_item_count > 0 THEN
    RAISE EXCEPTION 'Each order item requires a valid product and quantity from 1 to 99';
  END IF;
  IF v_distinct_item_count <> v_item_count THEN
    RAISE EXCEPTION 'Duplicate products are not allowed in one order request';
  END IF;

  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Completed customer profile required'; END IF;
  IF COALESCE(v_customer.status, 'active') <> 'active' THEN
    RAISE EXCEPTION 'Customer account is not active';
  END IF;

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

  /* Deterministic product order keeps concurrent carts on one lock order. */
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

    SELECT * INTO v_inventory
    FROM public.product_date_inventory
    WHERE pickup_date_id = p_pickup_date_id
      AND product_id = v_item.product_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % is not offered for the selected pickup date', v_product.name_en;
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
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
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

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.create_online_order_v2(text, uuid, uuid, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_online_order_v2(text, uuid, uuid, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_online_order_v2(text, uuid, uuid, jsonb, text) TO authenticated;

/* Legacy orders remain on cancel_online_order(); only v2 orders use this. */
CREATE OR REPLACE FUNCTION public.cancel_online_order_v2(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order public.orders%ROWTYPE;
  v_customer public.customers%ROWTYPE;
  v_date public.pickup_dates%ROWTYPE;
  v_inventory public.product_date_inventory%ROWTYPE;
  v_item record;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Order id is required'; END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'You may only cancel your own order' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(v_order.purchase_type, 'online') <> 'online' THEN
    RAISE EXCEPTION 'Only online orders can be cancelled here';
  END IF;
  IF v_order.pickup_date_id IS NULL THEN
    RAISE EXCEPTION 'Legacy order must be cancelled through the legacy cancellation flow';
  END IF;
  IF v_order.status = 'cancelled' THEN RETURN to_jsonb(v_order); END IF;
  IF v_order.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled';
  END IF;
  IF COALESCE(v_order.payment_status, 'unpaid') <> 'unpaid'
     OR v_order.picked_up_at IS NOT NULL THEN
    RAISE EXCEPTION 'Paid or picked-up orders require staff assistance to cancel';
  END IF;

  SELECT * INTO v_date
  FROM public.pickup_dates
  WHERE id = v_order.pickup_date_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order pickup date no longer exists'; END IF;
  IF now() >= v_date.cancellation_cutoff_at THEN
    RAISE EXCEPTION 'Cancellation cutoff has passed for this order';
  END IF;
  IF v_order.order_items IS NULL OR jsonb_typeof(v_order.order_items) <> 'array' THEN
    RAISE EXCEPTION 'Order item snapshot is invalid';
  END IF;

  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = v_order.customer_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;

  IF v_order.inventory_reserved THEN
    FOR v_item IN
      SELECT item.product_id, item.quantity
      FROM jsonb_to_recordset(v_order.order_items)
        AS item(product_id uuid, quantity integer)
      WHERE item.product_id IS NOT NULL
        AND item.quantity IS NOT NULL
        AND item.quantity > 0
      ORDER BY item.product_id
    LOOP
      SELECT * INTO v_inventory
      FROM public.product_date_inventory
      WHERE pickup_date_id = v_order.pickup_date_id
        AND product_id = v_item.product_id
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record is missing for a product in this order';
      END IF;
      IF v_inventory.reserved_quantity < v_item.quantity THEN
        RAISE EXCEPTION 'Inventory reservation ledger is inconsistent for this order';
      END IF;

      UPDATE public.product_date_inventory
      SET reserved_quantity = reserved_quantity - v_item.quantity,
          updated_at = now()
      WHERE pickup_date_id = v_order.pickup_date_id
        AND product_id = v_item.product_id;

      INSERT INTO public.inventory_events (
        pickup_date_id, product_id, order_id, event_type,
        reserved_delta, actor_id, reason
      ) VALUES (
        v_order.pickup_date_id, v_item.product_id, v_order.id,
        'release', -v_item.quantity, v_user_id, 'customer_cancellation'
      );
    END LOOP;
  END IF;

  IF COALESCE(v_order.loyalty_points_earned, 0) > 0 THEN
    UPDATE public.customers
    SET loyalty_points = GREATEST(
      COALESCE(loyalty_points, 0) - COALESCE(v_order.loyalty_points_earned, 0), 0
    )
    WHERE id = v_order.customer_id;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled'
  WHERE id = v_order.id
  RETURNING * INTO v_order;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_online_order_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_online_order_v2(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_online_order_v2(uuid) TO authenticated;

COMMIT;
