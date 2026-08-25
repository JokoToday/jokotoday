/*
  READ-ONLY PRODUCTION CONFIGURATION SNAPSHOT
  Pickup date + shared inventory v2

  Purpose:
    Re-run before any Phase A3 production configuration write.

  This file contains SELECT statements only.
*/

-- A. Rollout state. Expected before Phase A3 configuration:
-- latest migration = 20260824175100
-- pickup_date_count = 0
-- recurring_capacity_count = 0
-- date_inventory_count = 0
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

-- B. Recurring schedules, locations and materialized cutoff policy.
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

-- C. Current product x recurring-schedule offering matrix inherited from the
-- legacy frontend semantics. Empty available_days means offered on every pickup
-- day. This query is informational only; it does NOT infer capacity.
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
  END AS currently_offered
FROM active_products p
CROSS JOIN active_schedules s
ORDER BY p.sort_order, p.name_en, s.sort_order, s.schedule_key;

-- D. Existing configured recurring capacities. Before first Phase A3 capacity
-- configuration this should return zero rows.
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

-- E. Recent observed demand reference only. Do NOT use this as automatic
-- production capacity. It reports non-cancelled online order quantities over
-- the previous 120 days.
WITH items AS (
  SELECT
    o.pickup_date,
    (element ->> 'product_id')::uuid AS product_id,
    (element ->> 'quantity')::integer AS quantity
  FROM public.orders o
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(o.order_items) = 'array' THEN o.order_items
      ELSE '[]'::jsonb
    END
  ) element
  WHERE COALESCE(o.purchase_type, 'online') = 'online'
    AND o.pickup_date >= timezone('Asia/Bangkok', now())::date - 120
    AND o.status <> 'cancelled'
    AND COALESCE(element ->> 'product_id', '')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND COALESCE(element ->> 'quantity', '') ~ '^[1-9][0-9]*$'
),
daily AS (
  SELECT pickup_date, product_id, sum(quantity)::integer AS units
  FROM items
  GROUP BY pickup_date, product_id
)
SELECT
  p.id AS product_id,
  p.name_en,
  count(d.pickup_date) AS pickup_dates_with_orders,
  sum(d.units)::integer AS units_ordered,
  max(d.units)::integer AS max_units_on_one_date
FROM daily d
JOIN public.cms_products p ON p.id = d.product_id
GROUP BY p.id, p.name_en
ORDER BY units_ordered DESC, p.name_en;

-- F. Active future legacy reservations outside the v2 ledger. Frontend cutover
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

-- G. Customer v2 rollout gate. Both rows must remain false/false until the
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
