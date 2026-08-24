/*
  READ-ONLY POST-APPLY VALIDATION
  Pickup date + multi-location + shared date inventory v2

  IMPORTANT
  ---------
  Run this only AFTER the pickup_inventory_v2 migrations have been explicitly
  approved and applied. It contains SELECT statements only.
*/

-- L. Metadata backfill should map legacy schedules one-to-one.
SELECT
  s.id,
  s.schedule_key,
  s.legacy_day_key,
  s.label_en,
  s.pickup_weekday,
  s.order_cutoff_days_before,
  s.order_cutoff_time,
  s.cancellation_cutoff_days_before,
  s.cancellation_cutoff_time,
  s.is_active
FROM public.pickup_schedules s
ORDER BY s.sort_order, s.schedule_key;

-- M. Every migrated legacy schedule should retain at least one default location.
-- Must return ZERO rows.
SELECT s.id, s.schedule_key, s.label_en
FROM public.pickup_schedules s
LEFT JOIN public.pickup_schedule_locations sl
  ON sl.schedule_id = s.id AND sl.is_active = true
WHERE s.legacy_day_key IS NOT NULL
GROUP BY s.id, s.schedule_key, s.label_en
HAVING count(sl.location_id) = 0;

-- N. Foundation must not silently initialize recurring capacity from legacy
-- remaining stock. Immediately after foundation apply this should be zero unless
-- capacity was explicitly configured in a separately approved step.
SELECT count(*) AS recurring_capacity_rows
FROM public.product_schedule_capacity;

-- O. Existing orders must remain unmodified immediately after foundation apply.
SELECT count(*) AS orders_linked_to_v2_pickup_date
FROM public.orders
WHERE pickup_date_id IS NOT NULL;

-- P. Shared inventory invariant: reserved quantity must stay within capacity.
-- Must return ZERO rows.
SELECT
  i.pickup_date_id,
  d.pickup_date,
  i.product_id,
  p.name_en,
  i.capacity,
  i.reserved_quantity,
  i.capacity - i.reserved_quantity AS remaining_quantity,
  i.capacity_source
FROM public.product_date_inventory i
JOIN public.pickup_dates d ON d.id = i.pickup_date_id
JOIN public.cms_products p ON p.id = i.product_id
WHERE i.reserved_quantity < 0
   OR i.reserved_quantity > i.capacity
ORDER BY d.pickup_date, p.name_en;

-- Q. Inventory event reconciliation. Must return ZERO rows after v2 orders are
-- enabled: mutable reserved_quantity must equal the ledger sum.
SELECT
  i.pickup_date_id,
  i.product_id,
  i.reserved_quantity,
  COALESCE(sum(e.reserved_delta), 0)::integer AS ledger_reserved_quantity
FROM public.product_date_inventory i
LEFT JOIN public.inventory_events e
  ON e.pickup_date_id = i.pickup_date_id
 AND e.product_id = i.product_id
GROUP BY i.pickup_date_id, i.product_id, i.reserved_quantity
HAVING i.reserved_quantity <> COALESCE(sum(e.reserved_delta), 0)::integer;

-- R. Security inspection for new tables. Public-active policies should be
-- separate from authenticated Admin policies; anon policies must not depend on
-- protected user_profiles access.
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'pickup_schedules',
    'pickup_schedule_locations',
    'pickup_dates',
    'pickup_date_locations',
    'product_schedule_capacity',
    'product_date_inventory',
    'inventory_events'
  )
ORDER BY tablename, policyname;

-- S. New v2 function signatures and execution privileges.
SELECT
  p.oid::regprocedure AS function_signature,
  p.prosecdef AS security_definer,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'materialize_pickup_dates_v2',
    'admin_upsert_pickup_schedule_v2',
    'admin_set_product_schedule_capacity_v2',
    'admin_set_product_schedule_availability_v2',
    'admin_set_product_date_capacity_v2',
    'admin_update_pickup_date_v2',
    'admin_set_pickup_date_location_v2',
    'create_online_order_v2',
    'cancel_online_order_v2',
    'guard_pickup_schedule_lifecycle_v2',
    'guard_v2_order_pickup_selection',
    'prevent_inventory_event_mutation_v2'
  )
ORDER BY p.proname, p.oid::regprocedure::text;

-- T. Invariant trigger inspection. All four trigger rows should exist and be enabled.
SELECT
  c.relname AS table_name,
  t.tgname AS trigger_name,
  t.tgenabled,
  p.oid::regprocedure AS trigger_function
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND t.tgname IN (
    'guard_pickup_schedule_lifecycle_v2',
    'guard_v2_order_pickup_selection',
    'prevent_inventory_event_update_v2',
    'prevent_inventory_event_delete_v2'
  )
ORDER BY c.relname, t.tgname;

-- U. Legacy-cancellation compatibility boundary.
-- Expected:
--   cancel_online_order(uuid): anon=false, authenticated=true
--   cancel_online_order_legacy_v1(uuid): anon=false, authenticated=false
SELECT
  p.oid::regprocedure AS function_signature,
  p.prosecdef AS security_definer,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('cancel_online_order', 'cancel_online_order_legacy_v1')
ORDER BY p.proname;
