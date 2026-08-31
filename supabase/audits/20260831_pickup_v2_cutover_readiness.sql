/*
  READ-ONLY PICKUP V2 CUTOVER READINESS AUDIT
  Phase 3 — customer availability / concrete dates / order cutover

  Purpose
  -------
  The original Pickup v2 foundation audits correctly allowed product capacity
  configuration to remain empty. Customer cutover does not: every active
  product/schedule pair must have an explicit Admin-managed configuration.

  This file contains SELECT statements only. It never seeds capacities, infers
  business rules from legacy stock, or modifies production state.

  No launch weekday, location, product, capacity or cutoff is hard-coded here.
  The audit validates whatever business configuration is active in Admin.
*/

-- A. Compact rollout/readiness summary.
-- Before customer cutover the blocker counts below must all be zero.
WITH active_schedules AS (
  SELECT id
  FROM public.pickup_schedules
  WHERE is_active = true
),
active_products AS (
  SELECT id
  FROM public.cms_products
  WHERE COALESCE(is_active, false) = true
),
expected_product_schedule AS (
  SELECT p.id AS product_id, s.id AS schedule_id
  FROM active_products p
  CROSS JOIN active_schedules s
),
missing_explicit_configuration AS (
  SELECT e.product_id, e.schedule_id
  FROM expected_product_schedule e
  LEFT JOIN public.product_schedule_capacity c
    ON c.product_id = e.product_id
   AND c.schedule_id = e.schedule_id
  WHERE c.product_id IS NULL
),
future_open_dates AS (
  SELECT d.id, d.schedule_id
  FROM public.pickup_dates d
  JOIN public.pickup_schedules s ON s.id = d.schedule_id
  WHERE d.pickup_date >= timezone('Asia/Bangkok', now())::date
    AND d.status = 'open'
    AND s.is_active = true
),
missing_active_inventory AS (
  SELECT d.id AS pickup_date_id, c.product_id
  FROM future_open_dates d
  JOIN public.product_schedule_capacity c
    ON c.schedule_id = d.schedule_id
   AND c.is_active = true
  LEFT JOIN public.product_date_inventory i
    ON i.pickup_date_id = d.id
   AND i.product_id = c.product_id
  WHERE i.product_id IS NULL
),
future_date_safety AS (
  SELECT d.id
  FROM public.pickup_dates d
  JOIN public.pickup_schedules s ON s.id = d.schedule_id
  WHERE d.pickup_date >= timezone('Asia/Bangkok', now())::date
    AND d.status = 'open'
    AND (
      s.is_active = false
      OR timezone('Asia/Bangkok', d.order_cutoff_at)::date > d.pickup_date
      OR timezone('Asia/Bangkok', d.cancellation_cutoff_at)::date > d.pickup_date
      OR NOT EXISTS (
        SELECT 1
        FROM public.pickup_date_locations dl
        JOIN public.cms_pickup_locations l ON l.id = dl.location_id
        WHERE dl.pickup_date_id = d.id
          AND dl.is_active = true
          AND l.is_active = true
      )
    )
),
ledger_mismatch AS (
  SELECT i.pickup_date_id, i.product_id
  FROM public.product_date_inventory i
  LEFT JOIN public.inventory_events e
    ON e.pickup_date_id = i.pickup_date_id
   AND e.product_id = i.product_id
  GROUP BY i.pickup_date_id, i.product_id, i.reserved_quantity
  HAVING i.reserved_quantity <> COALESCE(sum(e.reserved_delta), 0)::integer
)
SELECT
  (SELECT count(*) FROM active_schedules) AS active_schedule_count,
  (SELECT count(*) FROM active_products) AS active_product_count,
  (SELECT count(*) FROM expected_product_schedule) AS expected_explicit_product_schedule_rows,
  (SELECT count(*) FROM missing_explicit_configuration) AS missing_explicit_product_schedule_rows,
  (SELECT count(*) FROM future_open_dates) AS future_open_date_count,
  (SELECT count(*)
   FROM public.product_date_inventory i
   JOIN public.pickup_dates d ON d.id = i.pickup_date_id
   WHERE d.pickup_date >= timezone('Asia/Bangkok', now())::date) AS future_inventory_row_count,
  (SELECT count(*) FROM missing_active_inventory) AS active_offering_missing_future_inventory_rows,
  (SELECT count(*) FROM future_date_safety) AS future_open_date_safety_blockers,
  (SELECT count(*)
   FROM public.product_date_inventory i
   WHERE i.capacity < 0
      OR i.reserved_quantity < 0
      OR i.reserved_quantity > i.capacity) AS inventory_bounds_blockers,
  (SELECT count(*) FROM ledger_mismatch) AS inventory_ledger_blockers,
  (SELECT count(*)
   FROM public.orders o
   WHERE COALESCE(o.purchase_type, 'online') = 'online'
     AND o.pickup_date >= timezone('Asia/Bangkok', now())::date
     AND COALESCE(o.inventory_reserved, false) = true
     AND COALESCE(o.status, 'pending') NOT IN ('cancelled', 'picked_up', 'completed')
     AND o.pickup_date_id IS NULL) AS active_future_legacy_reservations,
  (SELECT count(*) FROM public.orders WHERE pickup_date_id IS NOT NULL) AS v2_order_count;

-- B. HARD STOP: every active product must have an explicit Admin configuration
-- row for every active schedule. A deliberately unavailable product is a real
-- row with is_active=false, not an implicit missing row.
-- Must return ZERO rows before customer cutover.
WITH active_schedules AS (
  SELECT id, schedule_key, label_en, sort_order
  FROM public.pickup_schedules
  WHERE is_active = true
),
active_products AS (
  SELECT id, name_en, sort_order
  FROM public.cms_products
  WHERE COALESCE(is_active, false) = true
)
SELECT
  p.id AS product_id,
  p.name_en,
  s.id AS schedule_id,
  s.schedule_key,
  s.label_en AS schedule_label
FROM active_products p
CROSS JOIN active_schedules s
LEFT JOIN public.product_schedule_capacity c
  ON c.product_id = p.id
 AND c.schedule_id = s.id
WHERE c.product_id IS NULL
ORDER BY p.sort_order, p.name_en, s.sort_order, s.schedule_key;

-- C. Admin-owned recurring product configuration snapshot.
SELECT
  p.id AS product_id,
  p.name_en,
  s.id AS schedule_id,
  s.schedule_key,
  s.label_en AS schedule_label,
  c.capacity,
  c.is_active AS offered,
  c.updated_at
FROM public.product_schedule_capacity c
JOIN public.pickup_schedules s ON s.id = c.schedule_id
JOIN public.cms_products p ON p.id = c.product_id
WHERE s.is_active = true
  AND COALESCE(p.is_active, false) = true
ORDER BY p.sort_order, p.name_en, s.sort_order, s.schedule_key;

-- D. HARD STOP: every active recurring offering must have materialized inventory
-- for every future OPEN date on that schedule. A date override counts as valid
-- inventory and remains independent of the recurring default.
-- Must return ZERO rows before customer cutover.
SELECT
  d.id AS pickup_date_id,
  d.pickup_date,
  s.schedule_key,
  c.product_id,
  p.name_en
FROM public.pickup_dates d
JOIN public.pickup_schedules s
  ON s.id = d.schedule_id
 AND s.is_active = true
JOIN public.product_schedule_capacity c
  ON c.schedule_id = d.schedule_id
 AND c.is_active = true
JOIN public.cms_products p
  ON p.id = c.product_id
 AND COALESCE(p.is_active, false) = true
LEFT JOIN public.product_date_inventory i
  ON i.pickup_date_id = d.id
 AND i.product_id = c.product_id
WHERE d.pickup_date >= timezone('Asia/Bangkok', now())::date
  AND d.status = 'open'
  AND i.product_id IS NULL
ORDER BY d.pickup_date, p.sort_order, p.name_en;

-- E. HARD STOP: recurring-default inventory must have a matching recurring
-- product/schedule configuration row. Must return ZERO rows.
SELECT
  d.pickup_date,
  d.id AS pickup_date_id,
  s.schedule_key,
  i.product_id,
  p.name_en,
  i.capacity,
  i.reserved_quantity
FROM public.product_date_inventory i
JOIN public.pickup_dates d ON d.id = i.pickup_date_id
JOIN public.pickup_schedules s ON s.id = d.schedule_id
LEFT JOIN public.product_schedule_capacity c
  ON c.schedule_id = d.schedule_id
 AND c.product_id = i.product_id
LEFT JOIN public.cms_products p ON p.id = i.product_id
WHERE i.capacity_source = 'recurring_default'
  AND c.product_id IS NULL
ORDER BY d.pickup_date, p.name_en;

-- F. HARD STOP: future OPEN concrete dates must remain structurally valid.
-- Same-day cutoffs are allowed because days_before=0 is a valid Admin setting;
-- only a cutoff whose Bangkok calendar date is AFTER pickup_date is invalid.
-- Must return ZERO rows.
SELECT
  d.id AS pickup_date_id,
  d.pickup_date,
  s.schedule_key,
  s.is_active AS schedule_active,
  d.order_cutoff_at,
  d.cancellation_cutoff_at,
  timezone('Asia/Bangkok', d.order_cutoff_at)::date AS order_cutoff_bangkok_date,
  timezone('Asia/Bangkok', d.cancellation_cutoff_at)::date AS cancellation_cutoff_bangkok_date,
  EXISTS (
    SELECT 1
    FROM public.pickup_date_locations dl
    JOIN public.cms_pickup_locations l ON l.id = dl.location_id
    WHERE dl.pickup_date_id = d.id
      AND dl.is_active = true
      AND l.is_active = true
  ) AS has_active_customer_location
FROM public.pickup_dates d
JOIN public.pickup_schedules s ON s.id = d.schedule_id
WHERE d.pickup_date >= timezone('Asia/Bangkok', now())::date
  AND d.status = 'open'
  AND (
    s.is_active = false
    OR timezone('Asia/Bangkok', d.order_cutoff_at)::date > d.pickup_date
    OR timezone('Asia/Bangkok', d.cancellation_cutoff_at)::date > d.pickup_date
    OR NOT EXISTS (
      SELECT 1
      FROM public.pickup_date_locations dl
      JOIN public.cms_pickup_locations l ON l.id = dl.location_id
      WHERE dl.pickup_date_id = d.id
        AND dl.is_active = true
        AND l.is_active = true
    )
  )
ORDER BY d.pickup_date, s.schedule_key;

-- G1. HARD STOP: shared inventory bounds. Must return ZERO rows.
SELECT
  d.pickup_date,
  s.schedule_key,
  p.name_en,
  i.capacity,
  i.reserved_quantity,
  i.capacity - i.reserved_quantity AS remaining_quantity,
  i.capacity_source
FROM public.product_date_inventory i
JOIN public.pickup_dates d ON d.id = i.pickup_date_id
JOIN public.pickup_schedules s ON s.id = d.schedule_id
JOIN public.cms_products p ON p.id = i.product_id
WHERE i.capacity < 0
   OR i.reserved_quantity < 0
   OR i.reserved_quantity > i.capacity
ORDER BY d.pickup_date, p.name_en;

-- G2. HARD STOP: mutable reserved quantity must match the append-only inventory
-- event ledger. Must return ZERO rows.
SELECT
  d.pickup_date,
  s.schedule_key,
  p.name_en,
  i.pickup_date_id,
  i.product_id,
  i.reserved_quantity,
  COALESCE(sum(e.reserved_delta), 0)::integer AS ledger_reserved_quantity
FROM public.product_date_inventory i
JOIN public.pickup_dates d ON d.id = i.pickup_date_id
JOIN public.pickup_schedules s ON s.id = d.schedule_id
JOIN public.cms_products p ON p.id = i.product_id
LEFT JOIN public.inventory_events e
  ON e.pickup_date_id = i.pickup_date_id
 AND e.product_id = i.product_id
GROUP BY
  d.pickup_date,
  s.schedule_key,
  p.name_en,
  i.pickup_date_id,
  i.product_id,
  i.reserved_quantity
HAVING i.reserved_quantity <> COALESCE(sum(e.reserved_delta), 0)::integer
ORDER BY d.pickup_date, p.name_en;

-- H. HARD STOP: active future legacy reservations live outside the v2 inventory
-- ledger. Cutover requires ZERO rows unless a separately reviewed reconciliation
-- has been performed.
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

-- I. V2 order snapshot. Zero rows is expected before customer cutover.
SELECT
  o.id,
  o.order_number,
  o.pickup_date,
  o.pickup_date_id,
  o.pickup_location_id,
  o.status,
  o.payment_status,
  o.inventory_reserved,
  o.created_at
FROM public.orders o
WHERE o.pickup_date_id IS NOT NULL
ORDER BY o.created_at DESC;

-- J1. Customer v2 order RPC privilege snapshot.
-- Before final cutover:
--   create/cancel v2: anon=false, authenticated=false, PUBLIC=false
-- After the separately approved final cutover grant:
--   create/cancel v2: anon=false, authenticated=true, PUBLIC=false
SELECT
  n.nspname AS schema_name,
  p.oid::regprocedure AS function_signature,
  p.prosecdef AS security_definer,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ) AS public_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_online_order_v2', 'cancel_online_order_v2')
ORDER BY p.proname, p.oid::regprocedure::text;

-- J2. Customer availability API privilege snapshot.
-- Before the Phase 3.3 availability migration, zero rows is expected.
-- After that separately approved migration:
--   public wrapper: SECURITY INVOKER, anon=true, auth=true, PUBLIC=false
--   private helper: SECURITY DEFINER, anon=true, auth=true, PUBLIC=false
SELECT
  n.nspname AS schema_name,
  p.oid::regprocedure AS function_signature,
  p.prosecdef AS security_definer,
  p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ) AS public_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE (n.nspname = 'public' AND p.proname = 'get_customer_pickup_availability_v2')
   OR (n.nspname = 'private' AND p.proname = 'customer_pickup_availability_v2')
ORDER BY n.nspname, p.proname, p.oid::regprocedure::text;

-- K. Invariant-trigger snapshot. These rows should remain present and enabled.
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

-- L. Concrete-date horizon review. The horizon length is materializer/Admin
-- driven; this query reports it rather than imposing a hard-coded duration.
SELECT
  min(d.pickup_date) FILTER (
    WHERE d.pickup_date >= timezone('Asia/Bangkok', now())::date
  ) AS first_future_pickup_date,
  max(d.pickup_date) FILTER (
    WHERE d.pickup_date >= timezone('Asia/Bangkok', now())::date
  ) AS last_future_pickup_date,
  count(*) FILTER (
    WHERE d.pickup_date >= timezone('Asia/Bangkok', now())::date
  ) AS future_pickup_date_count,
  count(*) FILTER (
    WHERE d.pickup_date >= timezone('Asia/Bangkok', now())::date
      AND d.status = 'open'
  ) AS future_open_pickup_date_count
FROM public.pickup_dates d;
