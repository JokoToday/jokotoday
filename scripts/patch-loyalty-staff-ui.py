from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 exact match, found {count}')
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 regex match, found {count}')
    return updated


# -----------------------------------------------------------------------------
# Walk-In Desk
# -----------------------------------------------------------------------------
path = Path('src/pages/WalkInDeskPage.tsx')
text = path.read_text()

text = replace_once(
    text,
    "import { LoyaltyRewardRedemption } from '../components/staff/LoyaltyRewardRedemption';",
    "import { LoyaltyRewardSelector } from '../components/staff/LoyaltyRewardSelector';",
    'walkin import',
)

text = sub_once(
    text,
    r"interface PurchaseResult \{.*?\n\}",
    """interface PurchaseResult {
  order_id: string;
  order_number: string;
  gross_amount: number;
  discount_amount: number;
  amount_paid: number;
  points_redeemed: number;
  points_earned: number;
  updated_balance: number;
  reward_id: string | null;
  reward_type: string | null;
  reward_name_en: string | null;
  reward_name_th: string | null;
  manual_fulfillment_required: boolean;
  idempotent_replay: boolean;
}""",
    'walkin PurchaseResult',
)

text = replace_once(
    text,
    "  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);\n  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);",
    "  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);\n  const [selectedRewardId, setSelectedRewardId] = useState('');\n  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);",
    'walkin selected reward state',
)

text = replace_once(
    text,
    "  const purchaseReferenceRef = useRef<string | null>(null);",
    "  const purchaseReferenceRef = useRef<string | null>(null);\n  const purchaseRequestKeyRef = useRef<string | null>(null);",
    'walkin request key ref',
)

text = replace_once(
    text,
    "  const projectedPointsEarned = Math.round(calculationAmount * loyaltyMultiplier);\n  const projectedNewBalance = currentBalance + projectedPointsEarned;",
    "  const projectedPointsEarned = Math.round(calculationAmount * loyaltyMultiplier);",
    'walkin projected calculation',
)

text = replace_once(
    text,
    "    setPurchaseResult(null);\n    purchaseReferenceRef.current = null;",
    "    setPurchaseResult(null);\n    setSelectedRewardId('');\n    purchaseReferenceRef.current = null;\n    purchaseRequestKeyRef.current = null;",
    'walkin clear state',
)

text = replace_once(
    text,
    "      setAmount('');\n      setPurchaseResult(null);",
    "      setAmount('');\n      setPurchaseResult(null);\n      setSelectedRewardId('');\n      purchaseReferenceRef.current = null;\n      purchaseRequestKeyRef.current = null;",
    'walkin lookup reset',
)

text = sub_once(
    text,
    r"  const handleSaveWalkIn = async \(event: React\.FormEvent\) => \{.*?\n  \};\n\n  const handleAnotherPurchase",
    """  const handleSaveWalkIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customer || !amount || savingRef.current) return;

    try {
      savingRef.current = true;
      setSaving(true);
      setError(null);
      const amountNum = Number.parseFloat(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        setError(language === 'en' ? 'Please enter a valid purchase total' : 'กรุณากรอกยอดซื้อที่ถูกต้อง');
        return;
      }

      const orderNumber = purchaseReferenceRef.current ?? `WI-${crypto.randomUUID()}`;
      const requestKey = purchaseRequestKeyRef.current ?? crypto.randomUUID();
      purchaseReferenceRef.current = orderNumber;
      purchaseRequestKeyRef.current = requestKey;

      const { data, error: purchaseError } = await supabase.rpc('record_walk_in_purchase_v2', {
        p_customer_id: customer.id,
        p_amount: amountNum,
        p_order_number: orderNumber,
        p_reward_id: selectedRewardId || null,
        p_request_key: requestKey,
      });

      if (purchaseError) throw purchaseError;
      if (
        !data
        || typeof data.order_id !== 'string'
        || data.order_id.length === 0
        || typeof data.gross_amount !== 'number'
        || typeof data.discount_amount !== 'number'
        || typeof data.amount_paid !== 'number'
        || typeof data.points_redeemed !== 'number'
        || typeof data.points_earned !== 'number'
        || typeof data.updated_balance !== 'number'
      ) {
        throw new Error('Purchase was saved but the confirmation response was invalid.');
      }

      setCustomer({ ...customer, loyalty_points: data.updated_balance });
      setPurchaseResult(data as PurchaseResult);
      setHistoryRefreshKey((value) => value + 1);
    } catch (err) {
      console.error('Error saving walk-in purchase:', err);
      setError(err instanceof Error ? err.message : (language === 'en' ? 'Failed to save purchase' : 'เกิดข้อผิดพลาด'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleAnotherPurchase""",
    'walkin save function',
)

text = replace_once(
    text,
    "  const handleAnotherPurchase = () => {\n    setAmount('');\n    setError(null);\n    setPurchaseResult(null);\n    purchaseReferenceRef.current = null;\n  };",
    "  const handleAnotherPurchase = () => {\n    setAmount('');\n    setError(null);\n    setPurchaseResult(null);\n    setSelectedRewardId('');\n    purchaseReferenceRef.current = null;\n    purchaseRequestKeyRef.current = null;\n  };",
    'walkin another purchase reset',
)

text = sub_once(
    text,
    r"                    <div className=\"grid sm:grid-cols-3 gap-3\">.*?                    <LoyaltyRewardRedemption.*?                    />\n",
    """                    <div className=\"grid sm:grid-cols-2 lg:grid-cols-3 gap-3\">
                      <div className=\"bg-slate-50 rounded-lg p-4 text-center\">
                        <p className=\"text-sm text-gray-600\">{language === 'en' ? 'Gross purchase' : 'ยอดซื้อก่อนส่วนลด'}</p>
                        <p className=\"text-xl font-bold text-gray-900 mt-1\">฿{purchaseResult.gross_amount.toFixed(2)}</p>
                      </div>
                      <div className=\"bg-amber-50 rounded-lg p-4 text-center\">
                        <p className=\"text-sm text-gray-600\">{language === 'en' ? 'Loyalty discount' : 'ส่วนลดสะสมแต้ม'}</p>
                        <p className=\"text-xl font-bold text-amber-700 mt-1\">−฿{purchaseResult.discount_amount.toFixed(2)}</p>
                      </div>
                      <div className=\"bg-green-50 rounded-lg p-4 text-center\">
                        <p className=\"text-sm text-gray-600\">{language === 'en' ? 'Amount paid' : 'ยอดชำระจริง'}</p>
                        <p className=\"text-xl font-bold text-green-800 mt-1\">฿{purchaseResult.amount_paid.toFixed(2)}</p>
                      </div>
                      <div className=\"bg-slate-50 rounded-lg p-4 text-center\">
                        <p className=\"text-sm text-gray-600\">{language === 'en' ? 'Points used' : 'แต้มที่ใช้'}</p>
                        <p className=\"text-xl font-bold text-amber-700 mt-1\">{purchaseResult.points_redeemed > 0 ? `−${purchaseResult.points_redeemed}` : '0'}</p>
                      </div>
                      <div className=\"bg-slate-50 rounded-lg p-4 text-center\">
                        <p className=\"text-sm text-gray-600\">{language === 'en' ? 'Points earned' : 'แต้มที่ได้รับ'}</p>
                        <p className=\"text-xl font-bold text-green-700 mt-1\">+{purchaseResult.points_earned}</p>
                      </div>
                      <div className=\"bg-slate-50 rounded-lg p-4 text-center\">
                        <p className=\"text-sm text-gray-600\">{language === 'en' ? 'Updated points balance' : 'ยอดแต้มสะสมล่าสุด'}</p>
                        <p className=\"text-xl font-bold text-green-700 mt-1\">{purchaseResult.updated_balance}</p>
                      </div>
                    </div>
                    {purchaseResult.reward_id && (
                      <div className=\"rounded-xl border border-amber-200 bg-amber-50 p-4\">
                        <p className=\"font-semibold text-amber-900\">
                          {language === 'th' ? purchaseResult.reward_name_th : purchaseResult.reward_name_en}
                        </p>
                        <p className=\"mt-1 text-sm text-amber-800\">
                          {purchaseResult.manual_fulfillment_required
                            ? (language === 'en' ? 'Reward recorded. Give the customer the manual goodie/reward now.' : 'บันทึกรางวัลแล้ว กรุณามอบของแถมหรือรางวัลให้ลูกค้าทันที')
                            : (language === 'en' ? 'Monetary reward was applied to the amount paid.' : 'ส่วนลดรางวัลถูกหักจากยอดชำระแล้ว')}
                        </p>
                      </div>
                    )}
""",
    'walkin result cards',
)

text = replace_once(
    text,
    "{language === 'en' ? 'Enter paid amount (in-store purchase)' : 'กรอกยอดชำระเงิน (ซื้อหน้าร้าน)'}",
    "{language === 'en' ? 'Purchase total before loyalty reward' : 'ยอดซื้อก่อนหักรางวัลสะสมแต้ม'}",
    'walkin amount label',
)

selector_anchor = '                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">'
selector_insert = """                      <LoyaltyRewardSelector
                        currentBalance={currentBalance}
                        language={staffLanguage}
                        contextAmount={calculationAmount}
                        selectedRewardId={selectedRewardId}
                        onChange={(rewardId) => {
                          setSelectedRewardId(rewardId);
                          setError(null);
                          purchaseReferenceRef.current = null;
                          purchaseRequestKeyRef.current = null;
                        }}
                      />

                      <div className=\"bg-green-50 border border-green-200 rounded-lg p-4\">"""
text = replace_once(text, selector_anchor, selector_insert, 'walkin selector insertion')

text = sub_once(
    text,
    r"                      <div className=\"bg-green-50 border border-green-200 rounded-lg p-4\">.*?                      </div>\n\n                      <button",
    """                      <div className=\"bg-green-50 border border-green-200 rounded-lg p-4\">
                        <p className=\"text-sm font-semibold text-gray-700 mb-3\">
                          {language === 'en' ? 'Loyalty earning preview' : 'ตัวอย่างการรับแต้ม'}
                        </p>
                        <div className=\"flex items-baseline justify-between gap-4\">
                          <span className=\"text-sm text-gray-600\">{language === 'en' ? 'Without a monetary reward' : 'กรณีไม่มีส่วนลดเงิน'}</span>
                          <span className=\"font-semibold text-green-700\">+{projectedPointsEarned} {language === 'en' ? 'points' : 'คะแนน'}</span>
                        </div>
                        <p className=\"text-xs text-gray-500 mt-2\">
                          {language === 'en'
                            ? `Final points are calculated on the actual amount paid after any loyalty discount (${loyaltyMultiplier}×).`
                            : `แต้มจริงจะคำนวณจากยอดชำระหลังหักส่วนลดสะสมแต้ม (${loyaltyMultiplier}×)`}
                        </p>
                      </div>

                      <button""",
    'walkin earning preview',
)

text = replace_once(
    text,
    "? (language === 'en' ? 'Saving purchase…' : 'กำลังบันทึกรายการซื้อ…')\n                          : (language === 'en' ? 'Save Walk-In Purchase' : 'บันทึกการซื้อหน้าร้าน')}",
    "? (language === 'en' ? 'Saving purchase…' : 'กำลังบันทึกรายการซื้อ…')\n                          : (language === 'en' ? 'Save Sale & Apply Reward' : 'บันทึกการขายและใช้รางวัล')}",
    'walkin submit label',
)

path.write_text(text)


# -----------------------------------------------------------------------------
# Pickup Desk
# -----------------------------------------------------------------------------
path = Path('src/pages/PickupDeskPage.tsx')
text = path.read_text()

text = replace_once(
    text,
    "  total_amount: number;\n  pickup_date: string | null;",
    "  total_amount: number;\n  loyalty_discount_amount?: number | null;\n  amount_paid?: number | null;\n  pickup_date: string | null;",
    'pickup order money fields',
)

text = replace_once(
    text,
    "const paymentComplete = (order: Order) => (\n  order.payment_status === 'paid' && ['cash', 'qr_code', 'qr'].includes(order.payment_method || '')\n);",
    "const paymentComplete = (order: Order) => (\n  order.payment_status === 'paid' && ['cash', 'qr_code', 'qr'].includes(order.payment_method || '')\n);\n\nconst amountDue = (order: Order) => Math.max(\n  0,\n  Number(order.total_amount || 0) - Number(order.loyalty_discount_amount || 0)\n);",
    'pickup amountDue helper',
)

text = sub_once(
    text,
    r"  const recordPayment = async \(order: Order, method: 'qr_code' \| 'cash'\) => \{.*?\n  \};\n\n  const confirmPickup",
    """  const recordPayment = async (order: Order, method: 'qr_code' | 'cash') => {
    try {
      setUpdatingOrder(order.id);
      setActionError(null);
      setActionSuccess(null);
      setLastReceiptOrder(null);
      const { data, error: updateError } = await supabase.rpc('staff_record_order_payment_v2', {
        p_order_id: order.id,
        p_payment_method: method,
      });
      if (updateError) throw updateError;
      if (!data || typeof data.id !== 'string' || data.payment_status !== 'paid') {
        throw new Error('Payment was recorded but the confirmation response was invalid.');
      }

      const returnedOrder = data as Order;
      const applyPayment = (item: Order) => (
        item.id === order.id ? returnedOrder : item
      );
      setOrders((current) => current.map(applyPayment));
      setUpcomingOrders((current) => current.map(applyPayment));
      setEarlyPickupOrder((current) => current?.id === order.id ? applyPayment(current) : current);
      setActionSuccess(language === 'en'
        ? `${method === 'cash' ? 'Cash' : 'QR'} payment recorded: ฿${amountDue(returnedOrder).toFixed(2)}.`
        : `บันทึกการชำระ${method === 'cash' ? 'เงินสด' : ' QR'} ฿${amountDue(returnedOrder).toFixed(2)} แล้ว`);
    } catch (err) {
      console.error('Error recording payment:', err);
      setActionError(err instanceof Error
        ? err.message
        : (language === 'en' ? 'Could not record payment.' : 'ไม่สามารถบันทึกการชำระเงินได้'));
    } finally {
      setUpdatingOrder(null);
    }
  };

  const confirmPickup""",
    'pickup payment function',
)

text = replace_once(
    text,
    ".filter((order) => order.status !== 'cancelled')",
    ".filter((order) => (\n                      ['pending', 'confirmed'].includes(order.status)\n                      && order.payment_status !== 'paid'\n                      && !order.picked_up_at\n                    ))",
    'pickup eligible reward orders',
)

text = sub_once(
    text,
    r"                  onRedeemed=\{\(result\) => \{.*?                  \}\}\n                />",
    """                  onRedeemed={(result) => {
                    setCustomer((current) => current
                      ? { ...current, loyalty_points: result.new_balance }
                      : current);
                    setHistoryRefreshKey((value) => value + 1);
                    void loadOrders(customer.id);
                    setActionError(null);
                    setActionSuccess(result.redemption_status === 'reserved'
                      ? (language === 'en'
                        ? `${result.points_spent} loyalty points reserved. Discount: ฿${result.discount_amount.toFixed(2)}. Amount due: ฿${Number(result.net_due || 0).toFixed(2)}.`
                        : `สำรอง ${result.points_spent} แต้ม ส่วนลด ฿${result.discount_amount.toFixed(2)} ยอดชำระ ฿${Number(result.net_due || 0).toFixed(2)}`)
                      : (language === 'en'
                        ? `${result.points_spent} loyalty points redeemed. Fulfill the reward now. Balance: ${result.new_balance} points.`
                        : `แลก ${result.points_spent} แต้มแล้ว กรุณามอบรางวัลให้ลูกค้าทันที ยอดคงเหลือ ${result.new_balance} แต้ม`));
                  }}
                />""",
    'pickup redemption callback',
)

order_amount_pattern = re.compile(
    r'(?P<indent>\s*)<p className="(?P<class>[^"]*)">\n'
    r"(?P=indent)  \{order\.order_items\?\.length \|\| 0\} \{language === 'en' \? 'items' : 'รายการ'\} &bull; ฿\{Number\(order\.total_amount \|\| 0\)\.toFixed\(2\)\}\n"
    r'(?P=indent)</p>'
)


def amount_block(match: re.Match[str]) -> str:
    indent = match.group('indent')
    css = match.group('class')
    return f'''{indent}<div className="{css}">
{indent}  <p>{{order.order_items?.length || 0}} {{language === 'en' ? 'items' : 'รายการ'}} · {{Number(order.loyalty_discount_amount || 0) > 0 ? (language === 'en' ? 'Gross' : 'ก่อนส่วนลด') : ''}} ฿{{Number(order.total_amount || 0).toFixed(2)}}</p>
{indent}  {{Number(order.loyalty_discount_amount || 0) > 0 && (
{indent}    <p className="mt-1 font-semibold text-amber-700">
{indent}      {{language === 'en' ? 'Loyalty discount' : 'ส่วนลดสะสมแต้ม'}} −฿{{Number(order.loyalty_discount_amount || 0).toFixed(2)}} · {{language === 'en' ? 'Amount due' : 'ยอดชำระ'}} ฿{{amountDue(order).toFixed(2)}}
{indent}    </p>
{indent}  )}}
{indent}</div>'''


text, amount_count = order_amount_pattern.subn(amount_block, text)
if amount_count < 2:
    raise SystemExit(f'pickup amount summaries: expected at least 2 matches, found {amount_count}')

text = text.replace(
    "disabled={updatingOrder === order.id || order.status === 'picked_up'}",
    "disabled={updatingOrder === order.id || order.status === 'picked_up' || order.payment_status === 'paid'}",
)
text = text.replace(
    "disabled={Boolean(updatingOrder)}",
    "disabled={Boolean(updatingOrder) || order.payment_status === 'paid'}",
)

path.write_text(text)
