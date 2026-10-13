
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Loader2, PackageCheck, ReceiptText, ShieldCheck } from 'lucide-react';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { useLanguage } from '../context/LanguageContext';
import {
  confirmPickupReceipt,
  getPickupReceiptHandoffStatus,
  type ConfirmedPickupReceipt,
  type PickupReceiptHandoff,
  type PickupReceiptItem,
  type PickupReceiptLanguage,
} from '../lib/pickupReceiptService';

const LANGUAGES: PickupReceiptLanguage[] = ['en', 'th', 'zh'];

function itemName(item: PickupReceiptItem, language: PickupReceiptLanguage): string {
  const product = language === 'th'
    ? item.product_name_th || item.product_name
    : language === 'zh'
      ? item.product_name_zh || item.product_name
      : item.product_name;
  const maker = language === 'th'
    ? item.maker_name_th || item.maker_name_en
    : language === 'zh'
      ? item.maker_name_zh || item.maker_name_en
      : item.maker_name_en;
  return (product || '—') + (maker ? ' (' + maker + ')' : '');
}

function formatDate(value: string | null, language: PickupReceiptLanguage): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(
    language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB',
    { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  );
}

export function PickupReceiptConfirmationPage({ token }: { token: string }) {
  const { language, setLanguage } = useLanguage();
  const { getLabel } = useCMSLabels();
  const [handoff, setHandoff] = useState<PickupReceiptHandoff | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedPickupReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [languageInitialized, setLanguageInitialized] = useState(false);

  useEffect(() => {
    const queryLanguage = new URLSearchParams(window.location.search).get('lang');
    if (queryLanguage === 'en' || queryLanguage === 'th' || queryLanguage === 'zh') {
      setLanguage(queryLanguage);
      setLanguageInitialized(true);
    }
  }, [setLanguage]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const next = await getPickupReceiptHandoffStatus(token);
        if (cancelled) return;
        setHandoff(next);
        if (!languageInitialized && next.preferredLanguage && LANGUAGES.includes(next.preferredLanguage)) {
          setLanguage(next.preferredLanguage);
          setLanguageInitialized(true);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not open pickup confirmation.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [token, setLanguage, languageInitialized]);

  const copy = useMemo(() => ({
    title: getLabel(
      'pickup_receipt.confirm_title',
      language,
      language === 'th' ? 'ยืนยันว่าคุณได้รับสินค้าแล้ว' : language === 'zh' ? '确认您已收到商品' : 'Confirm you received your products',
    ),
    intro: getLabel(
      'pickup_receipt.confirm_intro',
      language,
      language === 'th'
        ? 'กรุณาตรวจสอบคำสั่งซื้อ JOKO ด้านล่าง และยืนยันหลังจากได้รับสินค้าแล้วเท่านั้น'
        : language === 'zh'
          ? '请核对下方的 JOKO 订单，仅在商品已交付给您后确认。'
          : 'Please check your JOKO order below. Confirm only after the products have been handed to you.',
    ),
    items: getLabel('pickup_receipt.items', language, language === 'th' ? 'สินค้าของคุณ' : language === 'zh' ? '您的商品' : 'Your products'),
    total: getLabel('pickup_receipt.total_paid', language, language === 'th' ? 'ยอดชำระแล้ว' : language === 'zh' ? '实付金额' : 'Total paid'),
    handover: getLabel('pickup_receipt.handover', language, language === 'th' ? 'พนักงานส่งมอบ' : language === 'zh' ? '员工交付' : 'Staff handover'),
    confirm: getLabel(
      'pickup_receipt.confirm_button',
      language,
      language === 'th' ? 'ใช่ ฉันได้รับสินค้าครบแล้ว' : language === 'zh' ? '是的，我已全部收到' : 'Yes, I received everything',
    ),
    completeTitle: getLabel(
      'pickup_receipt.complete_title',
      language,
      language === 'th' ? 'เรียบร้อยแล้ว ขอบคุณ!' : language === 'zh' ? '已完成，谢谢！' : 'All done. Thank you!',
    ),
    completeBody: getLabel(
      'pickup_receipt.complete_body',
      language,
      language === 'th'
        ? 'ใบเสร็จของคุณถูกบันทึกไว้กับคำสั่งซื้อนี้ใน My Orders แล้ว'
        : language === 'zh'
          ? '您的收据现已保存到“我的订单”中的此订单。'
          : 'Your receipt is now saved with this order in My Orders.',
    ),
  }), [getLabel, language]);

  const handleConfirm = async () => {
    try {
      setConfirming(true);
      setError('');
      const result = await confirmPickupReceipt(token);
      setConfirmed(result);
      setHandoff((current) => current ? {
        ...current,
        state: 'confirmed',
        receiptNumber: result.receiptNumber,
        customerReceivedAt: result.customerReceivedAt,
      } : current);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Could not confirm product receipt.');
    } finally {
      setConfirming(false);
    }
  };

  const complete = Boolean(confirmed) || handoff?.state === 'confirmed';
  const receiptNumber = confirmed?.receiptNumber || handoff?.receiptNumber;

  return (
    <main className="joko-mineral-field min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-xl overflow-hidden rounded-[2.25rem] border border-[#55766F]/15 bg-[#FFF9EE]/96 shadow-[0_22px_60px_rgba(59,74,69,0.10)]">
        <header className="border-b border-[#55766F]/12 bg-[#CFE3DF]/60 px-6 pb-6 pt-7 text-center sm:px-9">
          <div className="mb-4 flex justify-center gap-1.5">
            {LANGUAGES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => { setLanguage(option); setLanguageInitialized(true); }}
                className={language === option
                  ? 'rounded-full bg-[#3F665E] px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-full bg-white/65 px-3 py-1.5 text-xs font-semibold text-[#3F665E] transition hover:bg-white'}
              >
                {option === 'en' ? 'EN' : option === 'th' ? 'ไทย' : '中文'}
              </button>
            ))}
          </div>

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF9EE]/80 text-[#3F665E]">
            {complete ? <CheckCircle2 className="h-8 w-8" /> : <PackageCheck className="h-7 w-7" />}
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>
            {complete ? copy.completeTitle : copy.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#303532]/65">{complete ? copy.completeBody : copy.intro}</p>
        </header>

        <div className="space-y-5 px-5 py-6 sm:px-8">
          {loading ? (
            <div className="flex min-h-52 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#55766F]" />
            </div>
          ) : error && !handoff ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">{error}</div>
          ) : handoff?.state === 'expired' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
              {language === 'th'
                ? 'ลิงก์ยืนยันนี้หมดอายุแล้ว กรุณาขอ QR ใหม่จากพนักงาน JOKO'
                : language === 'zh'
                  ? '此确认链接已过期。请向 JOKO 员工索取新的二维码。'
                  : 'This confirmation link has expired. Please ask JOKO staff for a new QR.'}
            </div>
          ) : handoff ? (
            <>
              <div className="rounded-2xl border border-[#55766F]/14 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#55766F]">
                      {language === 'th' ? 'คำสั่งซื้อ' : language === 'zh' ? '订单' : 'Order'}
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-[#303532]">#{handoff.orderNumber}</p>
                  </div>
                  {receiptNumber && (
                    <div className="text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#55766F]">
                        {language === 'th' ? 'ใบเสร็จ' : language === 'zh' ? '收据' : 'Receipt'}
                      </p>
                      <p className="mt-1 text-sm font-bold text-[#C76624]">{receiptNumber}</p>
                    </div>
                  )}
                </div>
              </div>

              <section className="rounded-2xl border border-[#55766F]/14 bg-white/70 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-[#55766F]">{copy.items}</p>
                <div className="divide-y divide-[#55766F]/10">
                  {(handoff.items || []).map((item, index) => (
                    <div key={String(item.product_id || 'item') + '-' + index} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="font-semibold leading-5 text-[#303532]">{itemName(item, language)}</p>
                        <p className="mt-1 text-xs text-[#303532]/48">{Number(item.quantity) || 0} × ฿{Number(item.price_at_order || 0).toFixed(2)}</p>
                      </div>
                      <p className="shrink-0 font-bold text-[#303532]">฿{((Number(item.quantity) || 0) * Number(item.price_at_order || 0)).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#55766F]/14 bg-[#CFE3DF]/35 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#55766F]">{copy.total}</p>
                  <p className="mt-1 text-2xl font-extrabold text-[#C76624]">฿{Number(handoff.totalPaid || 0).toFixed(2)}</p>
                </div>
                <div className="rounded-2xl border border-[#55766F]/14 bg-white/70 p-4">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#55766F]">
                    <Clock className="h-3.5 w-3.5" /> {copy.handover}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-[#303532]">{formatDate(handoff.pickedUpAt, language)}</p>
                </div>
              </div>

              {!complete && (
                <div className="rounded-2xl border border-[#C76624]/20 bg-[#FFF3E6] p-4">
                  <div className="flex items-start gap-3 text-[#70401F]">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <p className="text-xs leading-5">
                      {language === 'th'
                        ? 'ปุ่มนี้ยืนยันการรับสินค้าสำหรับคำสั่งซื้อนี้เท่านั้น และไม่สามารถใช้เข้าสู่บัญชีของคุณได้'
                        : language === 'zh'
                          ? '此按钮仅确认本订单已收货，不能用于登录您的账户。'
                          : 'This confirms receipt for this order only. It cannot be used to sign in to your account.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleConfirm()}
                    disabled={confirming}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C76624] px-4 py-3.5 text-sm font-bold text-white transition hover:bg-[#A95120] disabled:opacity-60"
                  >
                    {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                    {copy.confirm}
                  </button>
                </div>
              )}

              {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

              {complete && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
                    <ReceiptText className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">{receiptNumber || copy.completeTitle}</p>
                      <p className="mt-1 text-xs leading-5">{copy.completeBody}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <a href="/my-orders" className="rounded-xl bg-[#3F665E] px-4 py-3 text-center text-sm font-semibold text-white hover:bg-[#304B45]">
                      {language === 'th' ? 'My Orders / ใบเสร็จ' : language === 'zh' ? '我的订单 / 收据' : 'My Orders / Receipt'}
                    </a>
                    <a href="/products?from=receipt" className="rounded-xl border border-[#55766F]/20 bg-white px-4 py-3 text-center text-sm font-semibold text-[#3F665E] hover:bg-[#CFE3DF]/30">
                      {language === 'th' ? 'สั่งครั้งถัดไป' : language === 'zh' ? '再次订购' : 'Your next order'}
                    </a>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default PickupReceiptConfirmationPage;
