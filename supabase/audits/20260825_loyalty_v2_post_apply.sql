/*
  JOKO TODAY — Loyalty / Rewards v2 post-apply audit

  READ-ONLY. Run only after the Loyalty v2 migrations have been applied.
  This file performs no writes.
*/

-- 1. Balance integrity: the append-only ledger must reconcile exactly to the
-- cached customer balance.
SELECT
  c.id AS customer_id,
  COALESCE(c.loyalty_points, 0) AS cached_balance,
  COALESCE(SUM(e.points_delta), 0) AS ledger_balance,
  COALESCE(c.loyalty_points, 0) - COALESCE(SUM(e.points_delta), 0) AS difference
FROM public.customers c
LEFT JOIN public.loyalty_point_events e ON e.customer_id = c.id
GROUP BY c.id, c.loyalty_points
HAVING COALESCE(c.loyalty_points, 0) <> COALESCE(SUM(e.points_delta), 0)
ORDER BY c.id;

-- Expected: zero rows.

-- 2. Opening-balance baseline. Positive balances present at cutover should have
-- one opening event; zero balances need no opening event.
SELECT
  c.id AS customer_id,
  c.loyalty_points AS current_balance,
  COUNT(*) FILTER (WHERE e.event_type = 'migration_opening_balance') AS opening_event_count,
  MAX(e.points_delta) FILTER (WHERE e.event_type = 'migration_opening_balance') AS opening_points
FROM public.customers c
LEFT JOIN public.loyalty_point_events e ON e.customer_id = c.id
GROUP BY c.id, c.loyalty_points
ORDER BY c.id;

-- 3. Negative balance invariant.
SELECT id, loyalty_points
FROM public.customers
WHERE COALESCE(loyalty_points, 0) < 0;

-- Expected: zero rows.

-- 4. Duplicate order earn/reversal events. Unique indexes should make these
-- impossible; this is a readable verification.
SELECT order_id, event_type, COUNT(*) AS event_count
FROM public.loyalty_point_events
WHERE order_id IS NOT NULL
  AND event_type IN ('earn', 'reverse_earn')
GROUP BY order_id, event_type
HAVING COUNT(*) > 1;

-- Expected: zero rows.

-- 5. Existing legacy positive-point orders were marked as already awarded at
-- cutover, preventing pickup from awarding them again. New post-cutover pending
-- orders are allowed to have NULL awarded_at.
WITH cutover AS (
  SELECT MIN(created_at) AS cutover_at
  FROM public.loyalty_point_events
  WHERE event_type = 'migration_opening_balance'
)
SELECT o.id, o.order_number, o.created_at, o.status,
       o.loyalty_points_earned, o.loyalty_points_awarded_at
FROM public.orders o
CROSS JOIN cutover c
WHERE c.cutover_at IS NOT NULL
  AND o.created_at <= c.cutover_at
  AND COALESCE(o.loyalty_points_earned, 0) > 0
  AND o.loyalty_points_awarded_at IS NULL
ORDER BY o.created_at;

-- Expected: zero rows.

-- 6. Reward structural sanity. Constraints are authoritative; this additionally
-- surfaces reward configuration for human review.
SELECT
  reward_key,
  reward_type,
  points_required,
  fixed_discount_amount,
  percentage_discount,
  max_discount_amount,
  product_id,
  channels,
  minimum_order_amount,
  per_customer_limit,
  total_redemption_limit,
  starts_at,
  ends_at,
  is_active
FROM public.loyalty_rewards
ORDER BY sort_order, points_required, reward_key;

-- 7. RLS posture for Loyalty v2 tables.
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('loyalty_rewards', 'loyalty_redemptions', 'loyalty_point_events')
  AND c.relkind = 'r'
ORDER BY c.relname;

-- 8. Explicit client table grants. Expected:
-- - loyalty_rewards: SELECT for anon/authenticated only
-- - loyalty_redemptions / loyalty_point_events: SELECT for authenticated only
-- - loyalty_settings: SELECT for anon/authenticated only
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('loyalty_rewards', 'loyalty_redemptions', 'loyalty_point_events', 'loyalty_settings')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 9. RLS policies for Loyalty v2 tables.
SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('loyalty_rewards', 'loyalty_redemptions', 'loyalty_point_events')
ORDER BY tablename, policyname;

-- 10. Loyalty v2 function execution posture.
-- Internal balance helper must be dark; Admin RPCs may be executable by
-- authenticated but perform their own DB-derived admin authorization.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') AS public_execute,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'apply_loyalty_points_delta_v2',
    'admin_list_loyalty_rewards_v2',
    'admin_upsert_loyalty_reward_v2',
    'admin_set_loyalty_reward_active_v2',
    'admin_update_loyalty_earning_rule_v2',
    'admin_adjust_loyalty_points_v2'
  )
ORDER BY p.proname, arguments;

-- 11. Customer redemption must remain dark. This intentionally catches any
-- future function with redeem/redemption semantics that has client EXECUTE.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname ILIKE '%redeem%' OR p.proname ILIKE '%redemption%')
  AND (
    has_function_privilege('anon', p.oid, 'EXECUTE')
    OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
ORDER BY p.proname;

-- Expected: zero rows.

-- 12. Pickup v2 customer rollout gates must remain unchanged/dark.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_online_order_v2', 'cancel_online_order_v2')
ORDER BY p.proname;

-- Expected: anon=false and authenticated=false for both.

-- 13. Earning lifecycle: insert-time balance trigger must be gone while the
-- prospective point calculator remains.
SELECT event_object_table, trigger_name, action_timing, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'orders'
  AND trigger_name IN ('orders_calculate_loyalty', 'orders_update_customer_loyalty')
ORDER BY trigger_name;

-- Expected: orders_calculate_loyalty exists; orders_update_customer_loyalty does not.

-- 14. Current earning configuration. `points_per_baht` is canonical for future
-- calculations; multiplier is kept synchronized for legacy compatibility.
SELECT purchase_type, points_percentage, points_per_baht, multiplier, label_en, label_th
FROM public.loyalty_settings
ORDER BY purchase_type;
