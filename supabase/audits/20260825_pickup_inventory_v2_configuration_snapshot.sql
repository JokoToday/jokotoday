/*
  READ-ONLY PRODUCTION CONFIGURATION SNAPSHOT
  Pickup date + shared inventory v2

  Purpose:
    Re-run before and after Phase A3a production schedule/date configuration.

  This file contains SELECT statements only.
*/

-- A. Rollout state. Expected before Phase A3 schedule/date configuration:
-- latest migration = 20260824175100
-- recurring_capacity_count may remain 0 until real product onboarding
-- date_inventory_count may remain 0 even after dates are materialized
-- v2_order_count = 0
-- customer v2 RPC EXECUTE = false / false
SELECT
  (SELECT max(version) FROM supabase_migrations.schema_migrations) AS latest_migration,
  (SELECT count(*) FROM public.pickup_schedules) AS schedule_count,
  (SELECT count(*) FROM public.pickup_dates) AS pickup_date_count,
  (SELECT count(*) FROM public.product_schedule_capacity) AS recurring_capacity_count,
  (SELECT count(*) FROM public.product_date_inventory) AS date_inventory_count,
  (SELECT count(*) FROM public.orders WHERE pickup_date_id IS NOT NULL) AS v2_order_count,
  has_function_privilege(
    'authenticated',
    'public.create_online_order_v2(text,uuid,uuid,jsonb,text)',
    'EXECUTE'
  ) AS create_v2_authenticated,
  has_function_privilege(
    'authenticated',
    'public.cancel_online_order_v2(uuid)',
    'EXECUTE'
  ) AS cancel_v2_authenticated;

-- B. Recurring schedules, locations and cutoff policy.
SELECT
  s.id AS schedule_id,
  s.schedule_key,
  s.label_en,
  s.pickup_weekday,
  s.order_cutoff_days_before,
  s.order_cutoff_time,
  s.cancellation_cutoff_days_before,
  s.cancellation_cutoff_time,
  s.is_active,
  l.id AS location_id,
  l.name_en AS location_name,
  sl.is_active AS schedule_location_active
FROM public.pickup_schedules s
JOIN public.pickup_schedule_locations sl ON sl.schedule_id = s.id
JOIN public.cms_pickup_locations l ON l.id = sl.location_id
ORDER BY s.sort_order, sl.sort_order, s.schedule_key;

-- B2. Initial v2 launch scope. After approved A3a configuration this must show:
--   friday_maerim   desired=false actual=false  (retained for future use)
--   saturday_maerim desired=true  actual=true
--   sunday_intown   desired=true  actual=true
SELECT
  s.schedule_key,
  CASE s.schedule_key
    WHEN 'saturday_maerim' THEN true
    WHEN 'sunday_intown' THEN true
    WHEN 'friday_maerim' THEN false
    ELSE NULL
  END AS desired_initial_v2_active,
  s.is_active AS actual_active,
  CASE
    WHEN s.schedule_key IN ('friday_maerim', 'saturday_maerim', 'sunday_intown') THEN
      s.is_active IS NOT DISTINCT FROM CASE s.schedule_key
        WHEN 'saturday_maerim' THEN true
        WHEN 'sunday_intown' THEN true
        WHEN 'friday_maerim' THEN false
      END
    ELSE NULL
  END AS matches_initial_launch_scope
FROM public.pickup_schedules s
ORDER BY s.sort_order, s.schedule_key;

-- C. Current legacy product x recurring-schedule offering matrix.
-- IMPORTANT: current cms_products rows are not authoritative launch-capacity
-- input. This query is transitional diagnostics only. It reflects the legacy
-- frontend rule that empty available_days means semantically offered on every
-- ACTIVE v2 pickup schedule. It does NOT infer v2 capacity or launch availability.
WITH active_schedules AS (
  SELECT id, schedule_key, label_en, sort_order
  FROM public.pickup_schedules
  WHERE is_active = true
),
active_products AS (
  SELECT id, name_en, available_days, sort_order
  FROM public.cms_products
  WHERE COALESCE(is_active, false) = true
)
SELECT
  p.id AS product_id,
  p.name_en,
  s.id AS schedule_id,
  s.schedule_key,
  s.label_en AS schedule_label,
  CASE
    WHEN jsonb_array_length(COALESCE(p.available_days, '[]'::jsonb)) = 0 THEN true
    WHEN p.available_days ? s.schedule_key THEN true
    WHEN p.available_days ? s.label_en THEN true
    WHEN p.available_days ? replace(s.label_en, ' – ', ' - ') THEN true
    ELSE false
  END AS legacy_semantically_offered
FROM active_products p
CROSS JOIN active_schedules s
ORDER BY p.sort_order, p.name_en, s.sort_order, s.schedule_key;

-- D. Existing configured recurring capacities. These are business data managed
-- through Admin once the real product catalog is onboarded. Zero rows is valid
-- during schedule/date preparation.
SELECT
  c.schedule_id,
  s.schedule_key,
  c.product_id,
  p.name_en,
  c.capacity,
  c.is_active,
  c.updated_at
FROM public.product_schedule_capacity c
JOIN public.pickup_schedules s ON s.id = c.schedule_id
JOIN public.cms_products p ON p.id = c.product_id
ORDER BY s.sort_order, p.sort_order, p.name_en;

-- E. Concrete dates and locations. It is valid to materialize pickup dates while
-- recurring capacities are still empty, because customer v2 RPCs remain dark.
SELECT
  d.id AS pickup_date_id,
  d.pickup_date,
  s.schedule_key,
  d.status,
  d.order_cutoff_at,
  d.cancellation_cutoff_at,
  d.source,
  l.name_en AS location_name,
  dl.is_active AS location_active
FROM public.pickup_dates d
JOIN public.pickup_schedules s ON s.id = d.schedule_id
LEFT JOIN public.pickup_date_locations dl ON dl.pickup_date_id = d.id
LEFT JOIN public.cms_pickup_locations l ON l.id = dl.location_id
ORDER BY d.pickup_date, dl.sort_order, l.name_en;

-- E2. Weekend-only launch invariant. After A3a materialization, Friday count must
-- be zero; Saturday/Sunday should contain the materialized horizon.
SELECT
  count(*) FILTER (WHERE s.schedule_key = 'friday_maerim') AS friday_dates,
  count(*) FILTER (WHERE s.schedule_key = 'saturday_maerim') AS saturday_dates,
  count(*) FILTER (WHERE s.schedule_key = 'sunday_intown') AS sunday_dates,
  count(*) FILTER (
    WHERE s.schedule_key NOT IN ('friday_maerim', 'saturday_maerim', 'sunday_intown')
  ) AS other_schedule_dates
FROM public.pickup_dates d
JOIN public.pickup_schedules s ON s.id = d.schedule_id;

-- F. Product date inventory. Zero rows is valid until real products receive
-- recurring capacities or date overrides in Admin.
SELECT
  d.pickup_date,
  s.schedule_key,
  p.name_en,
  i.capacity,
  i.reserved_quantity,
  i.capacity_source,
  i.override_note
FROM public.product_date_inventory i
JOIN public.pickup_dates d ON d.id = i.pickup_date_id
JOIN public.pickup_schedules s ON s.id = d.schedule_id
JOIN public.cms_products p ON p.id = i.product_id
ORDER BY d.pickup_date, p.name_en;

-- G. Active future legacy reservations outside the v2 ledger. Frontend cutover
-- requires zero rows unless a separately reviewed reconciliation is performed.
SELECT
  o.id,
  o.order_number,
  o.pickup_date,
  o.pickup_day,
  o.pickup_location_id,
  l.name_en AS pickup_location,
  o.status,
  o.payment_status,
  o.inventory_reserved,
  o.pickup_date_id,
  o.order_items
FROM public.orders o
LEFT JOIN public.cms_pickup_locations l ON l.id = o.pickup_location_id
WHERE COALESCE(o.purchase_type, 'online') = 'online'
  AND o.pickup_date >= timezone('Asia/Bangkok', now())::date
  AND COALESCE(o.inventory_reserved, false) = true
  AND o.status NOT IN ('cancelled', 'picked_up', 'completed')
  AND o.pickup_date_id IS NULL
ORDER BY o.pickup_date, o.created_at;

-- H. Customer v2 rollout gate. Both rows must remain false/false until the
-- separately reviewed frontend cutover migration.
SELECT
  p.oid::regprocedure AS function_signature,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_online_order_v2', 'cancel_online_order_v2')
ORDER BY p.proname;
