from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 exact match, found {count}")
    return text.replace(old, new, 1)


migration_path = Path("supabase/migrations/20260826021421_loyalty_v2_staff_fulfillment.sql")
text = migration_path.read_text()

old_reprice = """    SELECT COALESCE(ls.points_per_baht, round(ls.points_percentage / 100.0, 5), 0)
    INTO v_rate
    FROM public.loyalty_settings ls
    WHERE ls.purchase_type = 'online';
    v_rate := COALESCE(v_rate, 0);
    v_points_earned := round(v_net_due * v_rate);

    UPDATE public.orders
    SET
      loyalty_discount_amount = v_discount_amount,
      loyalty_multiplier = v_rate,
      loyalty_points_earned = v_points_earned,
      updated_at = now()
    WHERE id = p_order_id
    RETURNING * INTO v_order;
"""

new_reprice = """    SELECT COALESCE(ls.points_per_baht, round(ls.points_percentage / 100.0, 5), 0)
    INTO v_rate
    FROM public.loyalty_settings ls
    WHERE ls.purchase_type = 'online';
    v_rate := COALESCE(v_rate, 0);

    -- Orders that already have an award marker were credited under the legacy
    -- insert-time model before the v2 cutover. Grandfather that issued award so
    -- the cached balance, opening ledger, and later cancellation reversal stay
    -- mathematically consistent. Only unawarded/post-cutover orders are repriced
    -- to the actual net amount due after the monetary reward.
    IF v_order.loyalty_points_awarded_at IS NULL THEN
      v_points_earned := round(v_net_due * v_rate);

      UPDATE public.orders
      SET
        loyalty_discount_amount = v_discount_amount,
        loyalty_multiplier = v_rate,
        loyalty_points_earned = v_points_earned,
        updated_at = now()
      WHERE id = p_order_id
      RETURNING * INTO v_order;
    ELSE
      v_points_earned := COALESCE(v_order.loyalty_points_earned, 0);

      UPDATE public.orders
      SET
        loyalty_discount_amount = v_discount_amount,
        updated_at = now()
      WHERE id = p_order_id
      RETURNING * INTO v_order;
    END IF;
"""
text = replace_once(text, old_reprice, new_reprice, "pickup earning repricing")

old_snapshot = """    'discount_amount', v_discount_amount,
    'net_due', v_net_due,
    'channel', 'pickup',
"""
new_snapshot = """    'discount_amount', v_discount_amount,
    'net_due', v_net_due,
    'loyalty_earning_grandfathered', (v_order.loyalty_points_awarded_at IS NOT NULL),
    'loyalty_points_earned_after_reward', v_points_earned,
    'channel', 'pickup',
"""
text = replace_once(text, old_snapshot, new_snapshot, "pickup reward snapshot")

old_event_metadata = """      'discount_amount', v_discount_amount,
      'net_due', v_net_due,
      'request_key', p_request_key,
"""
new_event_metadata = """      'discount_amount', v_discount_amount,
      'net_due', v_net_due,
      'loyalty_earning_grandfathered', (v_order.loyalty_points_awarded_at IS NOT NULL),
      'loyalty_points_earned_after_reward', v_points_earned,
      'request_key', p_request_key,
"""
text = replace_once(text, old_event_metadata, new_event_metadata, "pickup redemption event metadata")

migration_path.write_text(text)


audit_path = Path("supabase/audits/20260826_loyalty_v2_staff_fulfillment.sql")
audit = audit_path.read_text()
anchor = """-- A reserved pickup discount is unconsumed and therefore must still be unpaid.
"""
addition = """-- Unawarded/post-cutover discounted orders must use the actual net amount for
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
"""
audit = replace_once(audit, anchor, addition, "audit grandfather checks")
audit_path.write_text(audit)
