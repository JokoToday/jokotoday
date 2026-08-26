/*
  Read-only post-apply audit for Loyalty / Rewards v2 staff fulfillment.

  Expected result: every issue_count is 0 and every gate boolean matches the
  comment beside it. This file never mutates production data.
*/

-- Commercial field invariants.
SELECT 'invalid_order_money_fields' AS check_name, count(*)::bigint AS issue_count
FROM public.orders o
WHERE COALESCE(o.loyalty_discount_amount, 0) < 0
   OR COALESCE(o.loyalty_discount_amount, 0) > o.total_amount
   OR (o.amount_paid IS NOT NULL AND (o.amount_paid < 0 OR o.amount_paid > o.total_amount))
   OR (COALESCE(o.payment_status, 'unpaid') = 'unpaid' AND o.amount_paid IS NOT NULL);

-- Any paid discounted order created after this rollout must record exact net paid.
SELECT 'paid_discount_amount_mismatch' AS check_name, count(*)::bigint AS issue_count
FROM public.orders o
WHERE COALESCE(o.loyalty_discount_amount, 0) > 0
  AND o.payment_status = 'paid'
  AND o.amount_paid IS DISTINCT FROM round(o.total_amount - o.loyalty_discount_amount, 2);

-- At most one active monetary redemption may affect an order.
SELECT 'duplicate_active_monetary_redemptions' AS check_name, count(*)::bigint AS issue_count
FROM (
  SELECT r.order_id
  FROM public.loyalty_redemptions r
  WHERE r.order_id IS NOT NULL
    AND r.status <> 'reversed'
    AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
  GROUP BY r.order_id
  HAVING count(*) > 1
) duplicates;

-- Monetary redemptions must have a persisted order and authoritative amount context.
SELECT 'invalid_monetary_redemption_context' AS check_name, count(*)::bigint AS issue_count
FROM public.loyalty_redemptions r
LEFT JOIN public.orders o ON o.id = r.order_id
WHERE (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
  AND (
    r.order_id IS NULL
    OR o.id IS NULL
    OR NULLIF(r.reward_snapshot ->> 'context_amount', '')::numeric IS DISTINCT FROM o.total_amount
    OR COALESCE(NULLIF(r.reward_snapshot ->> 'discount_amount', '')::numeric, 0) < 0
    OR COALESCE(NULLIF(r.reward_snapshot ->> 'discount_amount', '')::numeric, 0) > o.total_amount
  );

-- Unawarded/post-cutover discounted orders must use the actual net amount for
-- their prospective earning snapshot. Legacy-awarded rows are intentionally
-- grandfathered and are checked separately below.
SELECT 'unawarded_discount_points_mismatch' AS check_name, count(*)::bigint AS issue_count
FROM public.orders o
WHERE COALESCE(o.loyalty_discount_amount, 0) > 0
  AND o.loyalty_points_awarded_at IS NULL
  AND COALESCE(o.loyalty_points_earned, 0) IS DISTINCT FROM round(
    round(o.total_amount - o.loyalty_discount_amount, 2) * COALESCE(o.loyalty_multiplier, 0)
  );

-- Any discounted order that was already credited under the legacy model must
-- preserve that issued award explicitly in its immutable reward snapshot.
SELECT 'legacy_awarded_discount_missing_grandfather_marker' AS check_name, count(*)::bigint AS issue_count
FROM public.orders o
JOIN public.loyalty_redemptions r ON r.order_id = o.id
WHERE o.loyalty_points_awarded_at IS NOT NULL
  AND COALESCE(o.loyalty_discount_amount, 0) > 0
  AND r.status <> 'reversed'
  AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
  AND COALESCE((r.reward_snapshot ->> 'loyalty_earning_grandfathered')::boolean, false) IS NOT TRUE;

-- A reserved pickup discount is unconsumed and therefore must still be unpaid.
SELECT 'reserved_reward_on_consumed_order' AS check_name, count(*)::bigint AS issue_count
FROM public.loyalty_redemptions r
JOIN public.orders o ON o.id = r.order_id
WHERE r.status = 'reserved'
  AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
  AND (o.payment_status <> 'unpaid' OR o.amount_paid IS NOT NULL OR o.picked_up_at IS NOT NULL);

-- A paid discounted order should have the corresponding consumed redemption.
SELECT 'paid_discount_without_redeemed_reward' AS check_name, count(*)::bigint AS issue_count
FROM public.orders o
WHERE COALESCE(o.loyalty_discount_amount, 0) > 0
  AND o.payment_status = 'paid'
  AND NOT EXISTS (
    SELECT 1
    FROM public.loyalty_redemptions r
    WHERE r.order_id = o.id
      AND r.status = 'redeemed'
      AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
  );

-- Inventory-backed free products must remain unfulfilled through the staff path.
SELECT 'staff_free_product_redemptions' AS check_name, count(*)::bigint AS issue_count
FROM public.loyalty_redemptions r
WHERE r.status <> 'reversed'
  AND (r.reward_snapshot ->> 'reward_type') = 'free_product';

-- Cached balance must match the latest ledger balance when a customer has events.
WITH latest AS (
  SELECT DISTINCT ON (e.customer_id)
    e.customer_id,
    e.balance_after
  FROM public.loyalty_point_events e
  ORDER BY e.customer_id, e.created_at DESC, e.id DESC
)
SELECT 'cached_balance_mismatch' AS check_name, count(*)::bigint AS issue_count
FROM latest l
JOIN public.customers c ON c.id = l.customer_id
WHERE COALESCE(c.loyalty_points, 0) IS DISTINCT FROM l.balance_after;

-- Unique-event semantics should make all of these impossible.
SELECT 'duplicate_order_point_events' AS check_name, count(*)::bigint AS issue_count
FROM (
  SELECT e.order_id, e.event_type
  FROM public.loyalty_point_events e
  WHERE e.order_id IS NOT NULL AND e.event_type IN ('earn', 'reverse_earn')
  GROUP BY e.order_id, e.event_type
  HAVING count(*) > 1
) duplicates;

SELECT 'duplicate_redemption_point_events' AS check_name, count(*)::bigint AS issue_count
FROM (
  SELECT e.redemption_id, e.event_type
  FROM public.loyalty_point_events e
  WHERE e.redemption_id IS NOT NULL AND e.event_type IN ('redeem', 'refund_redemption')
  GROUP BY e.redemption_id, e.event_type
  HAVING count(*) > 1
) duplicates;

-- Permission gates. Expected: staff RPCs true for authenticated; customer reward
-- self-service absent; Pickup v2 create/cancel remain false for authenticated.
SELECT
  has_function_privilege('authenticated', 'public.staff_redeem_loyalty_reward_v2(uuid,uuid,text,uuid,numeric,uuid)', 'EXECUTE') AS authenticated_staff_redeem_execute_expected_true,
  has_function_privilege('authenticated', 'public.staff_record_order_payment_v2(uuid,text)', 'EXECUTE') AS authenticated_staff_payment_execute_expected_true,
  has_function_privilege('authenticated', 'public.record_walk_in_purchase_v2(uuid,numeric,text,uuid,uuid)', 'EXECUTE') AS authenticated_walkin_v2_execute_expected_true,
  has_function_privilege('authenticated', 'public.cancel_online_order_v2(uuid)', 'EXECUTE') AS authenticated_pickup_v2_cancel_execute_expected_false,
  has_function_privilege('authenticated', 'public.create_online_order_v2(text,uuid,uuid,jsonb,text)', 'EXECUTE') AS authenticated_pickup_v2_create_execute_expected_false,
  has_function_privilege('anon', 'public.staff_redeem_loyalty_reward_v2(uuid,uuid,text,uuid,numeric,uuid)', 'EXECUTE') AS anon_staff_redeem_execute_expected_false,
  has_function_privilege('anon', 'public.staff_record_order_payment_v2(uuid,text)', 'EXECUTE') AS anon_staff_payment_execute_expected_false;
