const fs = require('fs');

function replaceOnce(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${path}: expected exactly one match, found ${count}`);
  }
  fs.writeFileSync(path, source.replace(before, after));
}

const staffAudit = 'supabase/audits/20260826_loyalty_v2_staff_fulfillment.sql';
replaceOnce(
  staffAudit,
  `WHERE o.loyalty_points_awarded_at IS NOT NULL\n  AND COALESCE(o.purchase_type, 'online') = 'online'\n  AND COALESCE(o.loyalty_discount_amount, 0) > 0\n  AND r.status <> 'reversed'\n  AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')\n  AND COALESCE((r.reward_snapshot ->> 'loyalty_earning_grandfathered')::boolean, false) IS NOT TRUE;`,
  `WHERE o.loyalty_points_awarded_at IS NOT NULL\n  AND COALESCE(o.purchase_type, 'online') = 'online'\n  AND NOT EXISTS (\n    SELECT 1\n    FROM public.loyalty_point_events e\n    WHERE e.order_id = o.id\n      AND e.event_type = 'earn'\n  )\n  AND COALESCE(o.loyalty_discount_amount, 0) > 0\n  AND r.status <> 'reversed'\n  AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')\n  AND COALESCE((r.reward_snapshot ->> 'loyalty_earning_grandfathered')::boolean, false) IS NOT TRUE;`
);

replaceOnce(
  staffAudit,
  `-- Cached balance must match the latest ledger balance when a customer has events.`,
  `-- A zero-delta reverse_earn is permitted only for a grandfathered legacy award\n-- whose entire issued award had already been spent before cancellation. The\n-- immutable metadata must make that unrecoverable shortfall explicit.\nSELECT 'invalid_legacy_reversal_shortfall_event' AS check_name, count(*)::bigint AS issue_count\nFROM public.loyalty_point_events e\nWHERE e.event_type = 'reverse_earn'\n  AND e.points_delta = 0\n  AND NOT (\n    e.metadata ->> 'legacy_grandfathered' = 'true'\n    AND e.metadata ->> 'applied_reversal_points' = '0'\n    AND COALESCE(e.metadata ->> 'legacy_spent_shortfall', '') ~ '^[1-9][0-9]*$'\n  );\n\n-- Cached balance must match the latest ledger balance when a customer has events.`
);

const postAudit = 'supabase/audits/20260825_loyalty_v2_post_apply.sql';
replaceOnce(
  postAudit,
  `pg_get_functiondef(p.oid) ILIKE '%Walk-in redemption requires a persisted sale%' AS has_persisted_walk_in_guard,`,
  `pg_get_functiondef(p.oid) ILIKE '%Walk-in rewards must be applied atomically when the sale is recorded%' AS has_persisted_walk_in_guard,`
);

console.log('Final cutover review audit patches applied.');
