from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 exact match, found {count}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# P1: refund a reserved pickup reward before legacy earning reversal.
# The outer transaction rolls the refund back if the nested cancellation fails.
# Acquire the customer lock first so the refund helper's order lock keeps the
# canonical customer -> order lock order.
# -----------------------------------------------------------------------------
path = Path("supabase/migrations/20260826021421_loyalty_v2_staff_fulfillment.sql")
text = path.read_text()

old_comment = """-- Cancellation wrappers: existing cancellation implementations keep their stock,
-- cutoff, inventory, and lock semantics. Their locks remain held until the outer
-- transaction commits, so refunding immediately after the internal cancellation
-- preserves the canonical customer -> order ordering.
"""
new_comment = """-- Cancellation wrappers: refund an unused reserved monetary reward before the
-- nested cancellation reverses any grandfathered legacy earning. The wrapper owns
-- the canonical customer -> order locks first, and the whole function is one
-- transaction, so any later cutoff/inventory/cancellation failure rolls the refund
-- back atomically.
"""
text = replace_once(text, old_comment, new_comment, "cancellation comment")

old_legacy = """CREATE OR REPLACE FUNCTION public.cancel_online_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pickup_date_id uuid;
  v_result jsonb;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT o.pickup_date_id
    INTO v_pickup_date_id
    FROM public.orders o
    WHERE o.id = p_order_id;

    IF FOUND AND v_pickup_date_id IS NOT NULL THEN
      RAISE EXCEPTION
        'This order uses the v2 pickup inventory system; refresh the application before cancelling'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_result := public.cancel_online_order_legacy_v1(p_order_id);
  PERFORM public.refund_reserved_order_loyalty_reward_v2(
    p_order_id,
    auth.uid(),
    'Customer cancelled before pickup payment'
  );

  SELECT to_jsonb(o) INTO v_result
  FROM public.orders o
  WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;
"""
new_legacy = """CREATE OR REPLACE FUNCTION public.cancel_online_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_pickup_date_id uuid;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_order_id IS NOT NULL THEN
    SELECT o.customer_id, o.pickup_date_id
    INTO v_customer_id, v_pickup_date_id
    FROM public.orders o
    WHERE o.id = p_order_id;

    IF FOUND THEN
      IF v_customer_id IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'You may only cancel your own order' USING ERRCODE = '42501';
      END IF;
      IF v_pickup_date_id IS NOT NULL THEN
        RAISE EXCEPTION
          'This order uses the v2 pickup inventory system; refresh the application before cancelling'
          USING ERRCODE = 'P0001';
      END IF;

      IF v_customer_id IS NOT NULL THEN
        PERFORM 1
        FROM public.customers c
        WHERE c.id = v_customer_id
        FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;
      END IF;

      PERFORM public.refund_reserved_order_loyalty_reward_v2(
        p_order_id,
        v_user_id,
        'Customer cancelled before pickup payment'
      );
    END IF;
  END IF;

  v_result := public.cancel_online_order_legacy_v1(p_order_id);

  SELECT to_jsonb(o) INTO v_result
  FROM public.orders o
  WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;
"""
text = replace_once(text, old_legacy, new_legacy, "legacy cancellation wrapper")

old_v2 = """CREATE OR REPLACE FUNCTION public.cancel_online_order_v2(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.cancel_online_order_v2_inventory_v1(p_order_id);
  PERFORM public.refund_reserved_order_loyalty_reward_v2(
    p_order_id,
    auth.uid(),
    'Customer cancelled Pickup v2 order before payment'
  );

  SELECT to_jsonb(o) INTO v_result
  FROM public.orders o
  WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;
"""
new_v2 = """CREATE OR REPLACE FUNCTION public.cancel_online_order_v2(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id uuid;
  v_result jsonb;
BEGIN
  IF p_order_id IS NOT NULL THEN
    SELECT o.customer_id
    INTO v_customer_id
    FROM public.orders o
    WHERE o.id = p_order_id;

    IF FOUND THEN
      IF v_customer_id IS NOT NULL THEN
        PERFORM 1
        FROM public.customers c
        WHERE c.id = v_customer_id
        FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;
      END IF;

      PERFORM public.refund_reserved_order_loyalty_reward_v2(
        p_order_id,
        auth.uid(),
        'Customer cancelled Pickup v2 order before payment'
      );
    END IF;
  END IF;

  v_result := public.cancel_online_order_v2_inventory_v1(p_order_id);

  SELECT to_jsonb(o) INTO v_result
  FROM public.orders o
  WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;
"""
text = replace_once(text, old_v2, new_v2, "v2 cancellation wrapper")
path.write_text(text)


# -----------------------------------------------------------------------------
# P1: history receipt reprints and summaries must load monetary fields.
# -----------------------------------------------------------------------------
path = Path("src/components/staff/CustomerPurchaseHistory.tsx")
text = path.read_text()

text = replace_once(
    text,
    "  total_amount: number;\n  pickup_date: string | null;",
    "  total_amount: number;\n  loyalty_discount_amount?: number | null;\n  amount_paid?: number | null;\n  pickup_date: string | null;",
    "history monetary type fields",
)

text = replace_once(
    text,
    "'id, order_number, order_items, total_amount, pickup_date, pickup_location_id, status, payment_status, payment_method, created_at, loyalty_points_earned, purchase_type, walk_in_amount, picked_up_at, staff_id'",
    "'id, order_number, order_items, total_amount, loyalty_discount_amount, amount_paid, pickup_date, pickup_location_id, status, payment_status, payment_method, created_at, loyalty_points_earned, purchase_type, walk_in_amount, picked_up_at, staff_id'",
    "history select monetary fields",
)

old_amount = """  const orderAmount = (order: HistoryOrder) => (
    order.purchase_type === 'walk_in' ? order.walk_in_amount ?? order.total_amount : order.total_amount
  );
"""
new_amount = """  const orderGrossAmount = (order: HistoryOrder) => (
    order.purchase_type === 'walk_in' ? order.walk_in_amount ?? order.total_amount : order.total_amount
  );

  const orderDiscountAmount = (order: HistoryOrder) => Math.max(0, Number(order.loyalty_discount_amount || 0));

  const orderPaidAmount = (order: HistoryOrder) => {
    if (order.amount_paid !== null && order.amount_paid !== undefined && Number.isFinite(Number(order.amount_paid))) {
      return Number(order.amount_paid);
    }
    return Math.max(0, Number(orderGrossAmount(order) || 0) - orderDiscountAmount(order));
  };
"""
text = replace_once(text, old_amount, new_amount, "history amount helpers")

old_header = """                            <div className=\"flex items-center gap-3\">
                              <p className=\"text-lg font-bold text-slate-800\">฿{money(orderAmount(order))}</p>
                              {expanded ? <ChevronUp className=\"w-5 h-5 text-slate-500\" /> : <ChevronDown className=\"w-5 h-5 text-slate-500\" />}
                            </div>
"""
new_header = """                            <div className=\"flex items-center gap-3\">
                              <div className=\"text-right\">
                                <p className=\"text-lg font-bold text-slate-800\">฿{money(orderPaidAmount(order))}</p>
                                {orderDiscountAmount(order) > 0 && (
                                  <p className=\"text-xs font-medium text-amber-700\">
                                    {language === 'en' ? 'Gross' : 'ก่อนส่วนลด'} ฿{money(orderGrossAmount(order))}
                                  </p>
                                )}
                              </div>
                              {expanded ? <ChevronUp className=\"w-5 h-5 text-slate-500\" /> : <ChevronDown className=\"w-5 h-5 text-slate-500\" />}
                            </div>
"""
text = replace_once(text, old_header, new_header, "history collapsed amount")

old_summary = """                              <div className=\"mt-3 flex items-center justify-between border-t border-slate-200 pt-3\">
                                <span className=\"text-sm font-semibold text-gray-700\">{language === 'en' ? 'Total' : 'รวม'}</span>
                                <span className=\"text-base font-bold text-gray-900\">฿{money(orderAmount(order))}</span>
                              </div>
"""
new_summary = """                              <div className=\"mt-3 space-y-1.5 border-t border-slate-200 pt-3\">
                                {orderDiscountAmount(order) > 0 && (
                                  <>
                                    <div className=\"flex items-center justify-between\">
                                      <span className=\"text-sm text-gray-600\">{language === 'en' ? 'Gross total' : 'ยอดก่อนส่วนลด'}</span>
                                      <span className=\"text-sm font-semibold text-gray-800\">฿{money(orderGrossAmount(order))}</span>
                                    </div>
                                    <div className=\"flex items-center justify-between text-amber-700\">
                                      <span className=\"text-sm\">{language === 'en' ? 'Loyalty reward discount' : 'ส่วนลดรางวัลสะสมแต้ม'}</span>
                                      <span className=\"text-sm font-semibold\">−฿{money(orderDiscountAmount(order))}</span>
                                    </div>
                                  </>
                                )}
                                <div className=\"flex items-center justify-between pt-1\">
                                  <span className=\"text-sm font-semibold text-gray-700\">{language === 'en' ? 'Total paid' : 'ยอดชำระจริง'}</span>
                                  <span className=\"text-base font-bold text-gray-900\">฿{money(orderPaidAmount(order))}</span>
                                </div>
                              </div>
"""
text = replace_once(text, old_summary, new_summary, "history detailed amount summary")

path.write_text(text)
