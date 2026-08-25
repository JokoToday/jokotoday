/*
  READ-ONLY PRODUCTION CONFIGURATION SNAPSHOT
  Pickup date + shared inventory v2

  Purpose:
    Re-run before and after Phase A3 production schedule/date configuration.

  IMPORTANT:
    Pickup weekdays, locations, activation state and cutoffs are Admin-managed
    business configuration. This audit reports the actual configured state; it
    deliberately does not hard-code Saturday/Sunday/Friday as architecture rules.

  This file contains SELECT statements only.
*/

-- A. Rollout state.
-- Before customer cutover, v2_order_count = 0 and customer v2 RPC EXECUTE must
-- remain false / false. Recurring capacity and date inventory may remain empty
-- until the real product catalog is onboarded.
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

-- B. Actual recurring Admin configuration: schedules, locations and cutoff policy.
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
  l.is_active AS location_is_active,
  sl.is_active AS schedule_location_active,
  sl.sort_order AS location_sort_order
FROM public.pickup_schedules s
LEFT JOIN public.pickup_schedule_locations sl ON sl.schedule_id = s.id
LEFT JOIN public.cms_pickup_locations l ON l.id = sl.location_id
ORDER BY s.sort_order, sl.sort_order, s.schedule_key;

-- B2. Safety diagnostics for recurring schedule configuration.
-- Active schedules should have at least one active linked pickup location.
SELECT
  s.id AS schedule_id,
  s.schedule_key,
  s.label_en,
  s.pickup_weekday,
  s.is_active,
  count(*) FILTER (
    WHERE sl.is_active = true AND l.is_active = true
  ) AS active_location_count,
  CASE
    WHEN s.is_active = false THEN 'inactive_schedule'
    WHEN count(*) FILTER (WHERE sl.is_active = true AND l.is_active = true) > 0 THEN 'ok'
    ELSE 'active_schedule_without_active_location'
  END AS configuration_status
FROM public.pickup_schedules s
LEFT JOIN public.pickup_schedule_locations sl ON sl.schedule_id = s.id
LEFT JOIN public.cms_pickup_locations l ON l.id = sl.location_id
GROUP BY s.id, s.schedule_key, s.label_en, s.pickup_weekday, s.is_active, s.sort_order
ORDER BY s.sort_order, s.schedule_key;

-- C. Current legacy product x ACTIVE recurring-schedule offering matrix.
-- IMPORTANT: current cms_products rows are not authoritative launch-capacity
-- input. This query is transitional diagnostics only. It reflects the legacy
-- frontend rule that empty available_days means semantically offered on every
-- active v2 pickup schedule. It does NOT infer v2 capacity or launch availability.
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

-- E. Concrete dates and locations. These are snapshots generated from whatever
-- recurring schedules were active when materialization was run.
SELECT
  d.id AS pickup_date_id,
  d.pickup_date,
  s.schedule_key,
  s.label_en AS schedule_label,
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

-- E2. Materialized date counts by schedule. This reports actual state without
-- encoding any particular weekday as a permanent requirement.
SELECT
  s.schedule_key,
  s.label_en,
  s.pickup_weekday,
  s.is_active AS recurring_schedule_currently_active,
  count(d.id) AS materialized_date_count,
  min(d.pickup_date) AS first_materialized_date,
  max(d.pickup_date) AS last_materialized_date
FROM public.pickup_schedules s
LEFT JOIN public.pickup_dates d ON d.schedule_id = s.id
GROUP BY s.id, s.schedule_key, s.label_en, s.pickup_weekday, s.is_active, s.sort_order
ORDER BY s.sort_order, s.schedule_key;

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
-- Null status is treated conservatively as active/pending so an unclassified
-- reserved order can never disappear from this cutover blocker check.
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
  AND COALESCE(o.status, 'pending') NOT IN ('cancelled', 'picked_up', 'completed')
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
