from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 exact match, found {count}")
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# Database: require Walk-In payment method atomically and provide a real
# staff-only repair RPC for historical completed rows with an incomplete method.
# -----------------------------------------------------------------------------
path = Path('supabase/migrations/20260826021421_loyalty_v2_staff_fulfillment.sql')
text = path.read_text()

text = replace_once(
    text,
    """CREATE OR REPLACE FUNCTION public.record_walk_in_purchase_v2(
  p_customer_id uuid,
  p_amount numeric,
  p_order_number text,
  p_reward_id uuid,
  p_request_key uuid
)""",
    """CREATE OR REPLACE FUNCTION public.record_walk_in_purchase_v2(
  p_customer_id uuid,
  p_amount numeric,
  p_order_number text,
  p_reward_id uuid,
  p_request_key uuid,
  p_payment_method text
)""",
    'walkin v2 signature',
)

text = replace_once(
    text,
    """  IF p_order_number IS NULL OR p_order_number !~ '^WI-[A-Za-z0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid walk-in purchase reference';
  END IF;

  v_gross := round(p_amount, 2);""",
    """  IF p_order_number IS NULL OR p_order_number !~ '^WI-[A-Za-z0-9-]+$' THEN
    RAISE EXCEPTION 'Invalid walk-in purchase reference';
  END IF;
  IF p_payment_method NOT IN ('cash', 'qr_code') THEN
    RAISE EXCEPTION 'Walk-in payment method must be cash or qr_code';
  END IF;

  v_gross := round(p_amount, 2);""",
    'walkin payment validation',
)

text = replace_once(
    text,
    """       OR v_existing_order.purchase_type IS DISTINCT FROM 'walk_in'
       OR round(v_existing_order.total_amount, 2) IS DISTINCT FROM v_gross
       OR v_existing_order.order_number IS DISTINCT FROM p_order_number THEN""",
    """       OR v_existing_order.purchase_type IS DISTINCT FROM 'walk_in'
       OR round(v_existing_order.total_amount, 2) IS DISTINCT FROM v_gross
       OR v_existing_order.order_number IS DISTINCT FROM p_order_number
       OR v_existing_order.payment_method IS DISTINCT FROM p_payment_method THEN""",
    'walkin fast idempotency payment method',
)

text = replace_once(
    text,
    """      'amount_paid', COALESCE(v_existing_order.amount_paid, v_existing_order.total_amount),
      'points_redeemed', COALESCE(v_existing_redemption.points_spent, 0),""",
    """      'amount_paid', COALESCE(v_existing_order.amount_paid, v_existing_order.total_amount),
      'payment_method', v_existing_order.payment_method,
      'points_redeemed', COALESCE(v_existing_redemption.points_spent, 0),""",
    'walkin fast replay payment method response',
)

text = replace_once(
    text,
    """       OR v_existing_order.purchase_type IS DISTINCT FROM 'walk_in'
       OR round(v_existing_order.total_amount, 2) IS DISTINCT FROM v_gross
       OR v_existing_order.order_number IS DISTINCT FROM p_order_number THEN""",
    """       OR v_existing_order.purchase_type IS DISTINCT FROM 'walk_in'
       OR round(v_existing_order.total_amount, 2) IS DISTINCT FROM v_gross
       OR v_existing_order.order_number IS DISTINCT FROM p_order_number
       OR v_existing_order.payment_method IS DISTINCT FROM p_payment_method THEN""",
    'walkin locked idempotency payment method',
)

text = replace_once(
    text,
    """      'amount_paid', COALESCE(v_existing_order.amount_paid, v_existing_order.total_amount),
      'points_redeemed', COALESCE(v_existing_redemption.points_spent, 0),""",
    """      'amount_paid', COALESCE(v_existing_order.amount_paid, v_existing_order.total_amount),
      'payment_method', v_existing_order.payment_method,
      'points_redeemed', COALESCE(v_existing_redemption.points_spent, 0),""",
    'walkin locked replay payment method response',
)

text = replace_once(
    text,
    """    status, payment_status,
    customer_name, customer_phone, customer_email,""",
    """    status, payment_status, payment_method,
    customer_name, customer_phone, customer_email,""",
    'walkin insert payment method column',
)

text = replace_once(
    text,
    """    'completed', 'paid',
    v_customer.name, v_customer.phone, v_customer.email,""",
    """    'completed', 'paid', p_payment_method,
    v_customer.name, v_customer.phone, v_customer.email,""",
    'walkin insert payment method value',
)

text = replace_once(
    text,
    """    'amount_paid', v_net_paid,
    'points_redeemed', v_points_redeemed,""",
    """    'amount_paid', v_net_paid,
    'payment_method', p_payment_method,
    'points_redeemed', v_points_redeemed,""",
    'walkin final response payment method',
)

text = replace_once(
    text,
    """REVOKE ALL ON FUNCTION public.record_walk_in_purchase_v2(uuid, numeric, text, uuid, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_walk_in_purchase_v2(uuid, numeric, text, uuid, uuid)
TO authenticated;

-- Backward-compatible staff path: old clients create the same atomic v2 sale
-- without selecting a reward. Idempotency still uses the existing WI reference.
CREATE OR REPLACE FUNCTION public.record_walk_in_purchase(
  p_customer_id uuid,
  p_amount numeric,
  p_order_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.record_walk_in_purchase_v2(
    p_customer_id,
    p_amount,
    p_order_number,
    NULL,
    gen_random_uuid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) TO authenticated;
""",
    """REVOKE ALL ON FUNCTION public.record_walk_in_purchase_v2(uuid, numeric, text, uuid, uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_walk_in_purchase_v2(uuid, numeric, text, uuid, uuid, text)
TO authenticated;

-- Old Walk-In clients cannot provide the now-required payment method. Fail
-- closed with a refresh instruction instead of creating a paid-but-incomplete
-- sale during the staff deployment transition.
CREATE OR REPLACE FUNCTION public.record_walk_in_purchase(
  p_customer_id uuid,
  p_amount numeric,
  p_order_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION
    'Walk-In payment capture has been upgraded; refresh the staff application before recording a sale'
    USING ERRCODE = 'P0001';
END;
$$;

REVOKE ALL ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_walk_in_purchase(uuid, numeric, text) TO authenticated;

-- Repair only the payment METHOD for an already-paid completed/picked-up order.
-- This is a staff recovery path for historical incomplete rows; it never changes
-- the commercial amount, discount, payment status, loyalty balance, or ledger.
CREATE OR REPLACE FUNCTION public.staff_repair_completed_order_payment_method_v2(
  p_order_id uuid,
  p_payment_method text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_customer_id uuid;
  v_order public.orders%ROWTYPE;
  v_expected_paid numeric(10, 2);
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'Order id is required'; END IF;
  IF p_payment_method NOT IN ('cash', 'qr_code') THEN
    RAISE EXCEPTION 'Payment method must be cash or qr_code';
  END IF;

  SELECT o.customer_id INTO v_customer_id
  FROM public.orders o
  WHERE o.id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_customer_id IS NOT NULL THEN
    PERFORM 1 FROM public.customers c WHERE c.id = v_customer_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer record not found'; END IF;
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_customer_id THEN
    RAISE EXCEPTION 'Order customer changed while repairing payment method; retry';
  END IF;
  IF v_order.status NOT IN ('picked_up', 'completed')
     OR v_order.payment_status IS DISTINCT FROM 'paid' THEN
    RAISE EXCEPTION 'Only completed paid orders can use payment-method repair';
  END IF;

  v_expected_paid := round(v_order.total_amount - COALESCE(v_order.loyalty_discount_amount, 0), 2);
  IF v_order.amount_paid IS NOT NULL AND v_order.amount_paid IS DISTINCT FROM v_expected_paid THEN
    RAISE EXCEPTION 'Stored amount paid does not match the order net total';
  END IF;

  IF v_order.payment_method IN ('cash', 'qr_code', 'qr') THEN
    IF (v_order.payment_method = 'qr' AND p_payment_method = 'qr_code')
       OR v_order.payment_method = p_payment_method THEN
      RETURN to_jsonb(v_order) || jsonb_build_object('idempotent_replay', true);
    END IF;
    RAISE EXCEPTION 'A valid payment method is already recorded and cannot be changed';
  END IF;

  UPDATE public.orders
  SET payment_method = p_payment_method,
      updated_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN to_jsonb(v_order) || jsonb_build_object('idempotent_replay', false);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_repair_completed_order_payment_method_v2(uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_repair_completed_order_payment_method_v2(uuid, text)
TO authenticated;
""",
    'walkin grants compatibility and repair rpc',
)

path.write_text(text)


# -----------------------------------------------------------------------------
# Audit: every paid Walk-In must carry a real payment method; repair RPC is
# staff/authenticated callable but not public/anon.
# -----------------------------------------------------------------------------
path = Path('supabase/audits/20260826_loyalty_v2_staff_fulfillment.sql')
audit = path.read_text()
anchor = """-- A paid discounted pickup order must preserve the exact net amount paid.
"""
insert = """-- Completed paid Walk-In sales created by the v2 flow must persist how
-- payment was actually received in the same atomic transaction.
SELECT 'paid_walk_in_missing_payment_method' AS check_name, count(*)::bigint AS issue_count
FROM public.orders o
WHERE o.purchase_type = 'walk_in'
  AND o.payment_status = 'paid'
  AND o.payment_method NOT IN ('cash', 'qr_code', 'qr');

-- A paid discounted pickup order must preserve the exact net amount paid.
"""
audit = replace_once(audit, anchor, insert, 'walkin payment method audit')
path.write_text(audit)


# -----------------------------------------------------------------------------
# Walk-In Desk: choose Cash/QR before save and submit it in the atomic RPC.
# -----------------------------------------------------------------------------
path = Path('src/pages/WalkInDeskPage.tsx')
ui = path.read_text()

ui = replace_once(
    ui,
    """  manual_fulfillment_required: boolean;
  idempotent_replay: boolean;
}""",
    """  manual_fulfillment_required: boolean;
  payment_method: 'cash' | 'qr_code';
  idempotent_replay: boolean;
}""",
    'walkin result payment type',
)

ui = replace_once(
    ui,
    """  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);""",
    """  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr_code' | ''>('');
  const [loading, setLoading] = useState(false);""",
    'walkin payment state',
)

ui = replace_once(
    ui,
    """    setAmount('');
    setShowScanner(false);""",
    """    setAmount('');
    setPaymentMethod('');
    setShowScanner(false);""",
    'walkin clear payment state',
)

ui = replace_once(
    ui,
    """      setCustomer(null);
      setAmount('');
      setPurchaseResult(null);""",
    """      setCustomer(null);
      setAmount('');
      setPaymentMethod('');
      setPurchaseResult(null);""",
    'walkin lookup payment reset',
)

ui = replace_once(
    ui,
    """    if (!customer || !amount || savingRef.current) return;""",
    """    if (!customer || !amount || !paymentMethod || savingRef.current) return;""",
    'walkin save guard',
)

ui = replace_once(
    ui,
    """        p_reward_id: selectedRewardId || null,
        p_request_key: requestKey,
      });""",
    """        p_reward_id: selectedRewardId || null,
        p_request_key: requestKey,
        p_payment_method: paymentMethod,
      });""",
    'walkin rpc payment arg',
)

ui = replace_once(
    ui,
    """        || typeof data.updated_balance !== 'number'
      ) {""",
    """        || typeof data.updated_balance !== 'number'
        || !['cash', 'qr_code'].includes(data.payment_method)
      ) {""",
    'walkin response payment validation',
)

ui = replace_once(
    ui,
    """    setAmount('');
    setError(null);
    setPurchaseResult(null);""",
    """    setAmount('');
    setPaymentMethod('');
    setError(null);
    setPurchaseResult(null);""",
    'walkin another purchase payment reset',
)

reward_anchor = """                      <LoyaltyRewardSelector
"""
payment_block = """                      <div>
                        <label className=\"block text-sm font-medium text-gray-700 mb-3\">
                          {language === 'en' ? 'Payment received by' : 'รับชำระเงินด้วย'}
                        </label>
                        <div className=\"grid grid-cols-2 gap-3\">
                          <button
                            type=\"button\"
                            onClick={() => {
                              setPaymentMethod('qr_code');
                              setError(null);
                              purchaseReferenceRef.current = null;
                              purchaseRequestKeyRef.current = null;
                            }}
                            className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 font-semibold transition-colors ${paymentMethod === 'qr_code'
                              ? 'border-green-700 bg-green-700 text-white'
                              : 'border-green-200 bg-white text-green-800 hover:border-green-500'}`}
                          >
                            <QrCode className=\"w-4 h-4\" />
                            {language === 'en' ? 'QR received' : 'รับชำระ QR'}
                          </button>
                          <button
                            type=\"button\"
                            onClick={() => {
                              setPaymentMethod('cash');
                              setError(null);
                              purchaseReferenceRef.current = null;
                              purchaseRequestKeyRef.current = null;
                            }}
                            className={`flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 font-semibold transition-colors ${paymentMethod === 'cash'
                              ? 'border-green-700 bg-green-700 text-white'
                              : 'border-green-200 bg-white text-green-800 hover:border-green-500'}`}
                          >
                            <Banknote className=\"w-4 h-4\" />
                            {language === 'en' ? 'Cash received' : 'รับเงินสด'}
                          </button>
                        </div>
                      </div>

                      <LoyaltyRewardSelector
"""
ui = replace_once(ui, reward_anchor, payment_block, 'walkin payment selector block')

ui = replace_once(
    ui,
    """                        disabled={saving || !amount}""",
    """                        disabled={saving || !amount || !paymentMethod}""",
    'walkin submit payment disable',
)

path.write_text(ui)


# Ensure required icons exist in WalkIn imports.
path = Path('src/pages/WalkInDeskPage.tsx')
ui = path.read_text()
ui = replace_once(ui, "  Award,\n  Check,", "  Award,\n  Banknote,\n  Check,", 'walkin Banknote import')
ui = replace_once(ui, "  Phone,\n  ShoppingCart,", "  Phone,\n  QrCode,\n  ShoppingCart,", 'walkin QrCode import')
path.write_text(ui)


# -----------------------------------------------------------------------------
# Shared history: replace the impossible direct UPDATE with the staff repair RPC.
# -----------------------------------------------------------------------------
path = Path('src/components/staff/CustomerPurchaseHistory.tsx')
history = path.read_text()

old_repair = """      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_method: method, payment_status: 'paid' })
        .eq('id', order.id);
      if (updateError) throw updateError;
      setOrders((current) => current.map((item) => (
        item.id === order.id ? { ...item, payment_method: method, payment_status: 'paid' } : item
      )));"""
new_repair = """      const { data, error: updateError } = await supabase.rpc('staff_repair_completed_order_payment_method_v2', {
        p_order_id: order.id,
        p_payment_method: method,
      });
      if (updateError) throw updateError;
      if (!data || typeof data.id !== 'string' || !['cash', 'qr_code', 'qr'].includes(data.payment_method)) {
        throw new Error('Payment method repair returned an invalid response.');
      }
      const returnedOrder = data as HistoryOrder;
      setOrders((current) => current.map((item) => (
        item.id === order.id ? returnedOrder : item
      )));"""
history = replace_once(history, old_repair, new_repair, 'history repair rpc')
path.write_text(history)
