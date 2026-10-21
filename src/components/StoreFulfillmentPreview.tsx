import { useEffect, useMemo, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { getStorePaymentPolicy, type StorePaymentPolicy } from '../lib/storePaymentPolicy';
import { createStoreCustomerOrder, type StoreCheckoutResult } from '../lib/storeCheckoutService';
import { OnlineQrPaymentPanel } from './OnlinePromptPayPanel';
import { useAuth } from '../context/AuthContext';

type Plan = 'separate' | 'together';
type StorePaymentChoice = 'kshop_master' | 'stripe_promptpay';
type StoreMethod = 'pickup_today' | 'pickup_future' | 'delivery_today';
type Capability = { product_id: string; pickup_today: boolean; pickup_preorder: boolean; delivery_today: boolean; stock_on_hand: number; stock_reserved: number };

/** A single cart with separate fulfillment groups; payment remains server-gated. */
export function StoreFulfillmentPreview({ onReturn }: { onReturn: () => void }) {
  const { items } = useCart();
  const { language } = useLanguage();
  const { user } = useAuth();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [historicalCheckLoading, setHistoricalCheckLoading] = useState(false);
  const [historicalCheckResult, setHistoricalCheckResult] = useState('');
  const runHistoricalCheck = async () => {
    setHistoricalCheckLoading(true);
    setHistoricalCheckResult('');
    try {
      const { data, error } = await supabase.functions.invoke('store-historical-slip-check', { body: {} });
      if (error) throw error;
      setHistoricalCheckResult(JSON.stringify(data, null, 2));
    } catch (cause) {
      setHistoricalCheckResult(cause instanceof Error ? cause.message : 'Verification check unavailable.');
    } finally {
      setHistoricalCheckLoading(false);
    }
  };

  const [createdOrder, setCreatedOrder] = useState<StoreCheckoutResult | null>(null);
  const [requestKey] = useState(() => crypto.randomUUID());
  const storeItems = useMemo(() => items.filter((row) => row.product.catalog_scope === 'store_only'), [items]);
  const bakeryItems = items.filter((row) => row.product.catalog_scope !== 'store_only');
  const [capabilities, setCapabilities] = useState<Record<string, Capability>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentPolicy, setPaymentPolicy] = useState<StorePaymentPolicy | null>(null);
  const [plan, setPlan] = useState<Plan>('separate');
  const [storeMethod, setStoreMethod] = useState<StoreMethod>('pickup_today');
  const [paymentChoice, setPaymentChoice] = useState<StorePaymentChoice>('kshop_master');
  const [testAccess, setTestAccess] = useState<Record<StorePaymentChoice, boolean>>({ kshop_master: false, stripe_promptpay: false });

  useEffect(() => {
    let alive = true;
    const ids = storeItems.map((row) => row.product.id);
    if (!ids.length) { setLoading(false); return; }
    supabase.from('store_fulfillment_settings')
      .select('product_id,pickup_today,pickup_preorder,delivery_today,stock_on_hand,stock_reserved')
      .in('product_id', ids)
      .then(({ data, error: loadError }) => {
        if (!alive) return;
        if (loadError) setError('Unable to check Store fulfillment settings.');
        else setCapabilities(Object.fromEntries((data || []).map((c) => [c.product_id, c as Capability])));
        setLoading(false);
      });
    return () => { alive = false; };
  }, [storeItems]);

  useEffect(() => {
    let active = true;
    void getStorePaymentPolicy().then((policy) => {
      if (active) setPaymentPolicy(policy);
    }).catch(() => {
      if (active) setPaymentPolicy(null);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) { setTestAccess({ kshop_master: false, stripe_promptpay: false }); return; }
    void Promise.all((['kshop_master', 'stripe_promptpay'] as const).map(async (mode) => {
      const { data, error } = await supabase.rpc('store_checkout_test_allowed_v1', { p_payment_mode: mode });
      return [mode, !error && data === true] as const;
    })).then((results) => {
      if (active) setTestAccess(Object.fromEntries(results) as Record<StorePaymentChoice, boolean>);
    }).catch(() => { if (active) setTestAccess({ kshop_master: false, stripe_promptpay: false }); });
    return () => { active = false; };
  }, [user]);

  const submitStoreOrder = async () => {
    if (!user || !(paymentPolicy?.checkout_enabled || testAccess[paymentChoice]) || checkoutLoading || createdOrder ||
      bakeryItems.length > 0 || storeMethod !== 'pickup_today') return;
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const result = await createStoreCustomerOrder(requestKey,
        storeItems.map(({ product, quantity }) => ({ product_id: product.id, quantity })), paymentChoice);
      setCreatedOrder(result);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Unable to create Store order.');
    } finally {
      setCheckoutLoading(false);
    }
  };
  const subtotal = (rows: typeof items) => rows.reduce((sum, row) => sum + row.product.price * row.quantity, 0);
  const allAllow = (key: 'pickup_today' | 'pickup_preorder' | 'delivery_today') => storeItems.every(({ product, quantity }) => {
    const cap = capabilities[product.id];
    return Boolean(cap?.[key]) && (cap.stock_on_hand - cap.stock_reserved >= quantity);
  });
  const methodAvailable = plan === 'together' ? allAllow('pickup_preorder') : allAllow(storeMethod === 'pickup_future' ? 'pickup_preorder' : storeMethod);
  const copy = {
    en: { title: 'Choose how to receive your order', intro: 'One cart. Choose the pickup or delivery arrangement that works best for you.', separate: 'Receive separately', separateDescription: 'Store products can be collected or delivered as soon as available. Bakery products follow their selected pre-order date.', together: 'Collect everything together', togetherDescription: 'Choose one eligible future pickup date for all products.', store: 'JOKO Store · Ready-stock items', bakery: 'JOKO Bakery · Pre-order items', method: 'Store fulfillment preference', today: 'Same-day pickup', future: 'Future pickup', delivery: 'Same-day delivery (courier quote needed)', notice: 'Preview only. Dates, cutoff times, courier availability and fees still require server validation. Orders and payments are disabled.', unavailable: 'This option is not currently offered for every Store item or has insufficient available stock.', total: 'Product subtotal', back: 'Return to Store', waiting: 'Checking product fulfillment…', date: 'Bakery dates and pickup time will be selected and validated when checkout is enabled.' },
    th: { title: 'เลือกวิธีรับสินค้า', intro: 'ตะกร้าเดียว แต่แยกการรับสินค้าตามความเหมาะสม', separate: 'รับสินค้าแยกกัน', separateDescription: 'รับหรือจัดส่งสินค้า Store ได้เร็วที่สุดตามความพร้อม ส่วนสินค้าเบเกอรี่รับตามวันที่สั่งล่วงหน้าที่เลือก', together: 'รับสินค้าทั้งหมดพร้อมกัน', togetherDescription: 'เลือกวันรับสินค้าในอนาคตที่สามารถรับสินค้าทุกรายการพร้อมกันได้', store: 'JOKO Store · สินค้าพร้อมจำหน่าย', bakery: 'JOKO Bakery · สั่งล่วงหน้า', method: 'วิธีรับสินค้า Store', today: 'รับวันนี้', future: 'รับในอนาคต', delivery: 'จัดส่งวันนี้ (รอค่าส่ง)', notice: 'ดูตัวอย่างเท่านั้น ยังต้องตรวจสอบวันที่ เวลาตัดรอบ และค่าส่งจากระบบ ไม่สามารถสั่งซื้อหรือชำระเงินได้', unavailable: 'ไม่สามารถเลือกวิธีนี้ได้สำหรับสินค้าทั้งหมดหรือสต็อกไม่เพียงพอ', total: 'รวมค่าสินค้า', back: 'กลับไป Store', waiting: 'กำลังตรวจสอบการรับสินค้า…', date: 'วันและเวลารับสินค้าเบเกอรี่จะต้องตรวจสอบก่อนชำระเงิน' },
    zh: { title: '选择收货方式', intro: '一个购物篮，可分组履约', separate: '分别收货', separateDescription: '商店商品可在有货时尽快自取或配送；烘焙商品按照所选预订日期领取。', together: '一起领取全部商品', togetherDescription: '选择所有商品均可供货的未来自取日期。', store: 'JOKO Store · 现货', bakery: 'JOKO Bakery · 预订商品', method: '商店配送偏好', today: '今日自取', future: '未来自取', delivery: '今日配送（需报价）', notice: '仅供预览。日期、截止时间、配送及费用仍需服务器核验，暂不支持下单付款。', unavailable: '此方式不适用于全部商店商品或库存不足。', total: '商品小计', back: '返回商店', waiting: '正在检查可用方式…', date: '烘焙商品的取货日期及时间将在开放结账后验证。' },
  }[language];
  return <main className="joko-mineral-field min-h-[65vh] px-4 py-10"><div className="mx-auto max-w-2xl rounded-3xl bg-[#FFF9EE] p-5 text-[#303532] sm:p-8">
    <h1 className="text-2xl font-semibold">{copy.title}</h1><p className="mt-2 text-sm">{copy.intro}</p>
    {bakeryItems.length > 0 && <fieldset className="mt-6 space-y-3"><legend className="font-semibold">{language === 'th' ? 'ต้องการรับสินค้าอย่างไร?' : language === 'zh' ? '您希望如何收货？' : 'How would you like to receive your items?'}</legend>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#55766F]/25 p-3"><input type="radio" name="store-plan" className="mt-1" checked={plan === 'separate'} onChange={() => setPlan('separate')} /><span><strong className="block">{copy.separate}</strong><span className="mt-1 block text-sm text-[#303532]/75">{copy.separateDescription}</span></span></label>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#55766F]/25 p-3"><input type="radio" name="store-plan" className="mt-1" checked={plan === 'together'} onChange={() => setPlan('together')} /><span><strong className="block">{copy.together}</strong><span className="mt-1 block text-sm text-[#303532]/75">{copy.togetherDescription}</span></span></label>
    </fieldset>}
    <section className="mt-6 rounded-xl border p-4"><h2 className="font-semibold">{copy.store}</h2>{storeItems.map(({ product, quantity }) => <div key={product.id} className="mt-2 flex justify-between gap-3 text-sm"><span>{product.name_en} × {quantity}</span><span>฿{(product.price * quantity).toFixed(2)}</span></div>)}
      {loading ? <p role="status" className="mt-3 text-sm">{copy.waiting}</p> : error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : plan === 'separate' ? <label className="mt-4 block text-sm">{copy.method}<select value={storeMethod} onChange={(e) => setStoreMethod(e.target.value as StoreMethod)} className="mt-1 w-full rounded-lg border p-2"><option value="pickup_today">{copy.today}</option><option value="pickup_future">{copy.future}</option><option value="delivery_today">{copy.delivery}</option></select></label> : <p className="mt-3 text-sm">{copy.future}</p>}
      {!loading && !error && !methodAvailable && <p role="status" className="mt-2 text-sm text-amber-800">{copy.unavailable}</p>}
    </section>
    {bakeryItems.length > 0 && <section className="mt-4 rounded-xl border p-4"><h2 className="font-semibold">{copy.bakery}</h2>{bakeryItems.map(({ product, quantity }) => <div key={product.id} className="mt-2 flex justify-between gap-3 text-sm"><span>{product.name_en} × {quantity}</span><span>฿{(product.price * quantity).toFixed(2)}</span></div>)}<p className="mt-3 text-xs text-gray-600">{copy.date}</p></section>}
    <div className="mt-5 flex justify-between font-semibold"><span>{copy.total}</span><span>฿{subtotal(items).toFixed(2)}</span></div>
    <fieldset className="mt-4 rounded-xl border border-[#55766F]/20 p-3">
      <legend className="px-1 font-semibold">{language === 'th' ? 'เลือกวิธีชำระเงิน' : language === 'zh' ? '选择付款方式' : 'Choose a payment method'}</legend>
      <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-[#55766F]/20 bg-white/50 p-3">
        <input type="radio" name="store-payment-choice" checked={paymentChoice === 'kshop_master'} onChange={() => setPaymentChoice('kshop_master')} className="mt-1" />
        <span><strong className="block">{language === 'th' ? 'โอนเงินผ่านธนาคาร · EasySlip' : language === 'zh' ? '银行转账 · EasySlip' : 'Bank transfer · EasySlip'}</strong>
        <span className="mt-1 block text-sm text-[#303532]/75">{language === 'th' ? 'ชำระเงินแล้วอัปโหลดสลิปจากคอมพิวเตอร์หรือโทรศัพท์เพื่อยืนยัน' : language === 'zh' ? '转账后从电脑或手机上传凭证进行验证' : 'After paying, upload your bank slip from this computer or your phone.'}</span></span>
      </label>
      <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-[#55766F]/20 bg-white/50 p-3">
        <input type="radio" name="store-payment-choice" checked={paymentChoice === 'stripe_promptpay'} onChange={() => setPaymentChoice('stripe_promptpay')} className="mt-1" />
        <span><strong className="block">Stripe PromptPay</strong>
        <span className="mt-1 block text-sm text-[#303532]/75">{language === 'th' ? 'สแกน QR PromptPay ด้วยแอปธนาคาร ยืนยันการชำระเงินอัตโนมัติ ไม่ต้องอัปโหลดสลิป' : language === 'zh' ? '使用银行 App 扫描 PromptPay 二维码，自动确认付款，无需上传凭证' : 'Scan the PromptPay payment QR with your banking app. Confirmation is automatic; no slip upload.'}</span></span>
      </label>
      <p className="mt-3 text-xs text-[#303532]/70" role="status">
        {language === 'th' ? 'ระบบกำลังเตรียมตัวเลือกนี้ ยังไม่สามารถชำระเงินได้' : language === 'zh' ? '正在准备此付款方式，暂不能付款' : 'Selected method is a preview. No payment will be initiated yet.'}
        {paymentChoice === 'stripe_promptpay' && paymentPolicy?.fallback_enabled !== true && (language === 'en' ? ' Stripe is not enabled for Store transactions in staging.' : language === 'th' ? ' ยังไม่ได้เปิดใช้ Stripe สำหรับ Store ใน staging' : '测试环境尚未启用商店 Stripe 支付')}
      </p>
    </fieldset>
    <p role="status" className="mt-4 rounded-lg bg-[#FCEEDA] p-3 text-sm text-[#814A25]">{copy.notice}</p>
    {checkoutError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{checkoutError}</p>}
    {createdOrder ? <section className="mt-5 rounded-xl border border-[#55766F]/30 p-4">
      <p className="mb-3 text-sm font-semibold">{createdOrder.order_number || 'Store order created'} · ฿{Number(createdOrder.amount_due || 0).toFixed(2)}</p>
      <OnlineQrPaymentPanel orderId={createdOrder.order_id} existingStorePaymentId={createdOrder.payment_transaction_id} language={language}
        onExpired={() => setCheckoutError('The payment window expired. Please start a new Store order.')} />
    </section> : <button type="button" onClick={() => void submitStoreOrder()}
      disabled={!(paymentPolicy?.checkout_enabled || testAccess[paymentChoice]) || !user || checkoutLoading || loading || Boolean(error) || !methodAvailable ||
        bakeryItems.length > 0 || storeMethod !== 'pickup_today' ||
        (paymentChoice === 'stripe_promptpay' && !paymentPolicy?.fallback_enabled)}
      className="mt-4 w-full rounded-xl bg-[#55766F] px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600">
      {checkoutLoading ? 'Preparing order…' : (paymentPolicy?.checkout_enabled || testAccess[paymentChoice]) ? 'Place Store test order' : 'Checkout — coming soon'}
    </button>}
    {!user && <p className="mt-2 text-sm">{language === 'th' ? 'กรุณาเข้าสู่ระบบก่อนชำระเงิน' : language === 'zh' ? '请先登录后结账' : 'Please sign in to check out.'}</p>}
    {import.meta.env.VITE_SUPABASE_URL?.includes('szijiljpasxddzgzckra') && user?.email?.toLowerCase() === 'jokotoday@gmail.com' && <section className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-semibold">Staging only: recheck previous ฿10 slip</p>
      <p className="mt-1 text-xs">Checks EasySlip receiver registration using the original uploaded slip. Does not update the expired order or stock. No bank transfer needed.</p>
      <button type="button" disabled={historicalCheckLoading} onClick={() => void runHistoricalCheck()} className="mt-3 rounded-lg bg-[#55766F] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{historicalCheckLoading ? 'Checking EasySlip…' : 'Recheck original slip (no payment)'}</button>
      {historicalCheckResult && <pre role="status" className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs">{historicalCheckResult}</pre>}
    </section>}
    <button type="button" onClick={onReturn} className="mt-3 w-full rounded-xl border px-4 py-3">{copy.back}</button>
  </div></main>;
}
