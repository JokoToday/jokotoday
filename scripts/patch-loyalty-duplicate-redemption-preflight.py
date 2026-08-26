from pathlib import Path

path = Path('supabase/migrations/20260826021421_loyalty_v2_staff_fulfillment.sql')
text = path.read_text()
anchor = """-- One active monetary reward may affect an order at a time. The immutable reward
-- snapshot makes this race-safe without depending on mutable catalogue rows.
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_redemptions_one_active_monetary_per_order_uq
  ON public.loyalty_redemptions (order_id)
  WHERE order_id IS NOT NULL
    AND status <> 'reversed'
    AND (reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount');
"""
replacement = """-- One active monetary reward may affect an order at a time. The immutable reward
-- snapshot makes this race-safe without depending on mutable catalogue rows.
--
-- The foundation RPC predates this unique index. If it was used during a staged
-- rollout and duplicate active monetary rewards already exist for one order, do
-- not let CREATE UNIQUE INDEX fail with an opaque constraint error and do not
-- silently choose which reward to keep. Abort with an actionable diagnostic so
-- production reconciliation can be reviewed explicitly before retrying.
DO $$
DECLARE
  v_duplicate_order_count integer;
  v_duplicate_order_ids text;
BEGIN
  SELECT count(*)::integer
  INTO v_duplicate_order_count
  FROM (
    SELECT r.order_id
    FROM public.loyalty_redemptions r
    WHERE r.order_id IS NOT NULL
      AND r.status <> 'reversed'
      AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
    GROUP BY r.order_id
    HAVING count(*) > 1
  ) duplicate_orders;

  IF v_duplicate_order_count > 0 THEN
    SELECT string_agg(sample.order_id::text, ', ' ORDER BY sample.order_id)
    INTO v_duplicate_order_ids
    FROM (
      SELECT r.order_id
      FROM public.loyalty_redemptions r
      WHERE r.order_id IS NOT NULL
        AND r.status <> 'reversed'
        AND (r.reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount')
      GROUP BY r.order_id
      HAVING count(*) > 1
      ORDER BY r.order_id
      LIMIT 20
    ) sample;

    RAISE EXCEPTION
      'Cannot enforce one active monetary reward per order: % order(s) have duplicate active monetary redemptions. Sample order IDs: %. Reconcile those redemptions explicitly before retrying this migration.',
      v_duplicate_order_count,
      v_duplicate_order_ids;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_redemptions_one_active_monetary_per_order_uq
  ON public.loyalty_redemptions (order_id)
  WHERE order_id IS NOT NULL
    AND status <> 'reversed'
    AND (reward_snapshot ->> 'reward_type') IN ('fixed_discount', 'percentage_discount');
"""
count = text.count(anchor)
if count != 1:
    raise SystemExit(f'expected 1 monetary unique-index anchor, found {count}')
path.write_text(text.replace(anchor, replacement, 1))
