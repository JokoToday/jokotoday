/* Read-only audit for the Loyalty v2 pickup payment guard. */

-- No picked-up/completed discounted order may be unpaid or carry an unconsumed
-- reserved monetary reward.
SELECT 'picked_up_discount_without_valid_payment' AS check_name, count(*)::bigint AS issue_count
FROM public.orders o
WHERE o.status IN ('picked_up', 'completed')
  AND COALESCE(o.loyalty_discount_amount, 0) > 0
  AND (
    COALESCE(o.payment_status, 'unpaid') <> 'paid'
    OR o.amount_paid IS DISTINCT FROM round(o.total_amount - o.loyalty_discount_amount, 2)
    OR EXISTS (
      SELECT 1
      FROM public.loyalty_redemptions r
      WHERE r.order_id = o.id
        AND r.status = 'reserved'
        AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
    )
  );

-- The staff confirmation RPC is executable only through authenticated sessions;
-- it performs its own DB-derived staff/admin authorization internally.
SELECT
  has_function_privilege('authenticated', 'public.confirm_order_pickup(uuid)', 'EXECUTE') AS authenticated_confirm_pickup_expected_true,
  has_function_privilege('anon', 'public.confirm_order_pickup(uuid)', 'EXECUTE') AS anon_confirm_pickup_expected_false;
