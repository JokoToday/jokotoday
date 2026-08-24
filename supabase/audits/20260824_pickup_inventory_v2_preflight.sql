/*
  READ-ONLY PRE-FLIGHT / VALIDATION PACK
  Pickup date + multi-location + shared date inventory v2

  IMPORTANT
  ---------
  This file contains SELECT statements only. Run the PRE-APPLY section against
  production before approving either 20260824 pickup_inventory_v2 migration.

  Do not infer recurring production capacity from cms_products.stock_by_day.
  The legacy secure order RPC decrements stock_by_day, so those values may be
  remaining stock rather than original capacity.
*/

-- ==========================================================================
-- PRE-APPLY: current production configuration
-- ==========================================================================

-- A. Canonical recurring pickup slots, location and order cutoff.
SELECT
  d.id AS legacy_pickup_day_id,
  d.day_key,
  d.label,
  d.label_en,
  d.pickup_weekday,
  d.location_id,
  l.name_en AS location_name,
  l.is_active AS location_is_active,
  d.is_open,
  r.pickup_day,
  r.location AS legacy_override_location_key,
  r.cutoff_day,
  r.cutoff_time,
  r.is_active AS cutoff_is_active,
  d.sort_order
FROM public.cms_pickup_days d
LEFT JOIN public.cms_pickup_locations l ON l.id = d.location_id
LEFT JOIN public.pickup_cutoff_rules r ON r.day_key = d.day_key
ORDER BY d.sort_order, d.day_key;

-- B. HARD STOP: every open slot must have a location, valid weekday and one
-- active canonical cutoff rule. This query must return ZERO rows.
SELECT
  d.day_key,
  d.label_en,
  d.pickup_weekday,
  d.location_id,
  r.day_key AS cutoff_day_key,
  r.cutoff_day,
  r.cutoff_time,
  r.is_active AS cutoff_is_active
FROM public.cms_pickup_days d
LEFT JOIN public.pickup_cutoff_rules r
  ON r.day_key = d.day_key
 AND COALESCE(r.is_active, false) = true
WHERE COALESCE(d.is_open, false) = true
  AND (
    d.day_key IS NULL
    OR d.pickup_weekday IS NULL
    OR d.pickup_weekday NOT BETWEEN 0 AND 6
    OR d.location_id IS NULL
    OR r.day_key IS NULL
    OR r.cutoff_day NOT IN ('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')
    OR r.cutoff_time IS NULL
  );

-- C. HARD STOP: an open pickup slot must point to an active location.
-- Must return ZERO rows.
SELECT d.day_key, d.label_en, d.location_id, l.name_en, l.is_active
FROM public.cms_pickup_days d
LEFT JOIN public.cms_pickup_locations l ON l.id = d.location_id
WHERE COALESCE(d.is_open, false) = true
  AND (l.id IS NULL OR COALESCE(l.is_active, false) = false);

-- D. Cancellation rule resolution currently depends on historical pickup label.
-- Review these rows before migration; zero rows is acceptable because legacy
-- cancellation has a fallback, but duplicates/renames require explicit review.
SELECT
  d.day_key,
  COALESCE(d.label_en, d.label) AS current_pickup_label,
  c.id AS cancellation_rule_id,
  c.cutoff_day,
  c.cutoff_time,
  c.is_active
FROM public.cms_pickup_days d
LEFT JOIN public.cancellation_cutoff_rules c
  ON c.pickup_label_en = COALESCE(d.label_en, d.label)
 AND c.is_active = true
ORDER BY d.sort_order, c.sort_order;

-- E. Active date-specific legacy overrides that the v2 materializer will bridge.
SELECT
  o.id,
  o.date,
  o.pickup_day,
  o.location,
  o.override_type,
  o.custom_cutoff_day,
  o.custom_cutoff_time,
  o.note_en,
  o.is_active
FROM public.pickup_overrides o
WHERE COALESCE(o.is_active, false) = true
  AND o.date >= timezone('Asia/Bangkok', now())::date
ORDER BY o.date, o.pickup_day, o.location, o.updated_at DESC NULLS LAST;

-- F. Product legacy availability and stock. REVIEW ONLY.
-- These values are NOT safe recurring-capacity seeds.
SELECT
  p.id,
  p.slug,
  p.name_en,
  p.available_days,
  p.stock_by_day,
  p.stock_remaining,
  p.is_active,
  p.is_sold_out
FROM public.cms_products p
WHERE COALESCE(p.is_active, false) = true
ORDER BY p.sort_order, p.name_en;

-- G. HARD STOP: malformed / negative legacy stock values.
-- Must return ZERO rows before relying on legacy stock during transition.
SELECT
  p.id AS product_id,
  p.name_en,
  e.key AS stock_key,
  e.value AS stock_value
FROM public.cms_products p
CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.stock_by_day, '{}'::jsonb)) e
WHERE e.value !~ '^[0-9]+$'
   OR (CASE WHEN e.value ~ '^[0-9]+$' THEN e.value::integer ELSE 0 END) < 0
ORDER BY p.name_en, e.key;

-- H. Future online orders. Existing orders are intentionally NOT backfilled by
-- the foundation migration; this is the reconciliation population.
SELECT
  o.id,
  o.order_number,
  timezone('Asia/Bangkok', o.created_at) AS created_at_bangkok,
  o.pickup_date,
  o.pickup_day,
  o.pickup_location_id,
  l.name_en AS pickup_location,
  o.status,
  o.payment_status,
  o.inventory_reserved
FROM public.orders o
LEFT JOIN public.cms_pickup_locations l ON l.id = o.pickup_location_id
WHERE COALESCE(o.purchase_type, 'online') = 'online'
  AND o.pickup_date >= timezone('Asia/Bangkok', now())::date
ORDER BY o.pickup_date, o.created_at;

-- I. HARD STOP: future reserved orders whose snapshot items cannot be used for
-- a deterministic inventory reconciliation. Must return ZERO rows.
SELECT o.id, o.order_number, o.order_items
FROM public.orders o
WHERE COALESCE(o.purchase_type, 'online') = 'online'
  AND o.pickup_date >= timezone('Asia/Bangkok', now())::date
  AND COALESCE(o.inventory_reserved, false) = true
  AND (
    o.order_items IS NULL
    OR jsonb_typeof(o.order_items) <> 'array'
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(o.order_items, '[]'::jsonb)) item
      WHERE NULLIF(item ->> 'product_id', '') IS NULL
         OR COALESCE(item ->> 'quantity', '') !~ '^[1-9][0-9]*$'
    )
  );

-- J. Future known reservations aggregated by concrete date/product.
-- This is useful for reconciliation only; it is NOT recurring capacity.
SELECT
  o.pickup_date,
  item.product_id,
  p.name_en,
  sum(item.quantity)::integer AS known_reserved_quantity
FROM public.orders o
CROSS JOIN LATERAL jsonb_to_recordset(o.order_items)
  AS item(product_id uuid, quantity integer)
LEFT JOIN public.cms_products p ON p.id = item.product_id
WHERE COALESCE(o.purchase_type, 'online') = 'online'
  AND o.pickup_date >= timezone('Asia/Bangkok', now())::date
  AND COALESCE(o.inventory_reserved, false) = true
  AND o.status NOT IN ('cancelled', 'picked_up', 'completed')
  AND item.product_id IS NOT NULL
  AND item.quantity > 0
GROUP BY o.pickup_date, item.product_id, p.name_en
ORDER BY o.pickup_date, p.name_en;

-- K. Schedule-resolution ambiguity for future orders using current metadata.
-- A count other than exactly 1 requires manual reconciliation before any
-- optional order pickup_date_id backfill is designed/applied.
SELECT
  o.id,
  o.order_number,
  o.pickup_date,
  o.pickup_day,
  o.pickup_location_id,
  count(d.id) AS matching_legacy_schedules
FROM public.orders o
LEFT JOIN public.cms_pickup_days d
  ON d.pickup_weekday = extract(dow FROM o.pickup_date)::integer
 AND (o.pickup_location_id IS NULL OR d.location_id = o.pickup_location_id)
 AND (
   o.pickup_day IS NULL
   OR d.label = o.pickup_day
   OR d.label_en = o.pickup_day
 )
WHERE COALESCE(o.purchase_type, 'online') = 'online'
  AND o.pickup_date >= timezone('Asia/Bangkok', now())::date
GROUP BY o.id, o.order_number, o.pickup_date, o.pickup_day, o.pickup_location_id
HAVING count(d.id) <> 1
ORDER BY o.pickup_date, o.order_number;

-- ==========================================================================
-- CAPACITY INITIALIZATION GATE
-- ==========================================================================

-- There is intentionally no automatic INSERT into product_schedule_capacity.
-- Before frontend cutover, establish recurring production defaults explicitly
-- per product + schedule in Admin or through reviewed admin RPC calls.
-- Example business meaning (DO NOT execute as a generic seed):
--   Friday / Plain Croissant / capacity 20
-- means 20 total across every Friday pickup location combined.

-- ==========================================================================
-- POST-APPLY VALIDATION (run only after migrations are explicitly approved)
-- ==========================================================================

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

-- P. Shared inventory invariant: no location dimension exists on the inventory
-- table, and reserved quantity is within capacity.
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

-- R. Security inspection for new tables.
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
    'admin_set_product_date_capacity_v2',
    'admin_update_pickup_date_v2',
    'admin_set_pickup_date_location_v2',
    'create_online_order_v2',
    'cancel_online_order_v2'
  )
ORDER BY p.proname, p.oid::regprocedure::text;
