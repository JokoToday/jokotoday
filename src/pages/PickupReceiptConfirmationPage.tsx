import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Loader2, PackageCheck, ShieldCheck } from 'lucide-react';
import { confirmPickupReceipt, getPickupHandoverStatus, type PickupHandoverStatus } from '../lib/pickupHandover';

type Language = 'en' | 'th' | 'zh';

const COPY = {
  en: {
    eyebrow: 'JOKO TODAY pickup',
    title: 'Confirm your pickup',
    intro: 'Please check the order below, then confirm that you received the products from JOKO staff.',
    paid: 'Payment',
    paidValue: 'Paid',
    pickup: 'Pickup',
    order: 'Your order',
    total: 'Paid total',
    confirm: 'Confirm I received my order',
    confirming: 'Confirming…',
    completed: 'Pickup confirmed',
    completedBody: 'Thank you. Your receipt acknowledgement has been recorded and the pickup is complete.',
    expired: 'This pickup QR has expired. Please ask JOKO staff to generate a new one.',
    invalid: 'This pickup confirmation is not available.',
    secure: 'This one-time link only confirms receipt of this specific order.',
  },
  th: {
    eyebrow: 'รับสินค้ากับ JOKO TODAY',
    title: 'ยืนยันการรับสินค้า',
    intro: 'กรุณาตรวจสอบรายการด้านล่าง แล้วกดยืนยันว่าคุณได้รับสินค้าจากพนักงาน JOKO แล้ว',
    paid: 'การชำระเงิน',
    paidValue: 'ชำระแล้ว',
    pickup: 'วันรับสินค้า',
    order: 'รายการของคุณ',
    total: 'ยอดชำระ',
    confirm: 'ยืนยันว่าได้รับสินค้าแล้ว',
    confirming: 'กำลังยืนยัน…',
    completed: 'ยืนยันการรับสินค้าแล้ว',
    completedBody: 'ขอบคุณ ระบบได้บันทึกการยืนยันของคุณแล้ว และการรับสินค้าเสร็จสมบูรณ์',
    expired: 'QR สำหรับรับสินค้านี้หมดอายุแล้ว กรุณาให้พนักงาน JOKO สร้างใหม่',
    invalid: 'ไม่สามารถใช้การยืนยันการรับสินค้านี้ได้',
    secure: 'ลิงก์แบบใช้ครั้งเดียวนี้ใช้สำหรับยืนยันการรับสินค้าของคำสั่งซื้อนี้เท่านั้น',
  },
  zh: {
    eyebrow: 'JOKO TODAY 取货',
    title: '确认已取货',
    intro: '请核对以下订单，然后确认您已从 JOKO 工作人员处收到商品。',
    paid: '付款',
    paidValue: '已付款',
    pickup: '取货日期',
    order: '您的订单',
    total: '实付总额',
    confirm: '确认我已收到商品',
    confirming: '正在确认…',
    completed: '取货已确认',
    completedBody: '谢谢。您的收货确认已记录，本次取货已完成。',
    expired: '此取货二维码已过期。请让 JOKO 工作人员生成新的二维码。',
    invalid: '此取货确认当前不可用。',
    secure: '此一次性链接仅用于确认收到这一笔订单。',
  },
} satisfies Record<Language, Record<string, string>>;

function resolveLanguage(): Language {
  const value = new URLSearchParams(window.location.search).get('lang');
  return value === 'th' || value === 'zh' ? value : 'en';
}

function itemName(item: NonNullable<PickupHandoverStatus['order']>['items'][number], language: Language): string {
  if (language === 'th') return item.product_name_th || item.name_th || item.product_name || item.product_name_en || item.name || '—';
  if (language === 'zh') return item.product_name_zh || item.name_zh || item.product_name || item.product_name_en || item.name || '—';
  return item.product_name || item.product_name_en || item.name || '—';
}

function quantity(item: NonNullable<PickupHandoverStatus['order']>['items'][number]): number {
  return Number(item.quantity ?? item.qty ?? 0);
}

function formatDate(value: string | null | undefined, language: Language): string {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  });
}

export default function PickupReceiptConfirmationPage({ token }: { token: string }) {
  const language = resolveLanguage();
  const copy = COPY[language];
  const [status, setStatus] = useState<PickupHandoverStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  const refresh = async () => {
    const next = await getPickupHandoverStatus(token);
    setStatus(next);
    return next;
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await getPickupHandoverStatus(token);
        if (!cancelled) setStatus(next);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : copy.invalid);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = useMemo(() => {
    if (!status?.expiresAt) return 0;
    return Math.max(0, Math.ceil((new Date(status.expiresAt).getTime() - now) / 1000));
  }, [status?.expiresAt, now]);

  const confirm = async () => {
    try {
      setConfirming(true);
      setError('');
      await confirmPickupReceipt(token);
      await refresh();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : copy.invalid);
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return <main className="joko-mineral-field flex min-h-screen items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#55766F]" /></main>;
  }

  const completed = status?.state === 'completed';
  const expired = status?.state === 'expired' || (!completed && remaining === 0 && Boolean(status?.expiresAt));
  const order = status?.order;

  return (
    <main className="joko-mineral-field min-h-screen px-4 py-7 sm:py-12">
      <section className="mx-auto max-w-lg overflow-hidden rounded-[2.25rem] border border-[#55766F]/15 bg-[#FFF9EE]/95 shadow-[0_18px_55px_rgba(59,74,69,0.09)]">
        <header className="border-b border-[#55766F]/10 bg-[#CFE3DF]/55 px-6 py-7 text-center sm:px-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/75 text-[#3F665E]">
            {completed ? <CheckCircle2 className="h-8 w-8" /> : <PackageCheck className="h-7 w-7" />}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#55766F]">{copy.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>
            {completed ? copy.completed : copy.title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#303532]/65">{completed ? copy.completedBody : copy.intro}</p>
        </header>

        <div className="space-y-5 px-5 py-6 sm:px-8">
          {completed ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <p className="font-semibold">{copy.completed}</p>
                  <p className="mt-1 text-sm leading-6">{copy.completedBody}</p>
                </div>
              </div>
            </div>
          ) : expired ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">{copy.expired}</div>
          ) : order ? (
            <>
              <div className="rounded-2xl border border-[#55766F]/15 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#303532]/45">Order</p>
                    <p className="mt-1 text-lg font-bold text-[#292D2B]">#{order.orderNumber}</p>
                  </div>
                  <div className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{copy.paidValue}</div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#55766F]/10 pt-4 text-sm">
                  <div><p className="text-[#303532]/45">{copy.pickup}</p><p className="mt-1 font-semibold text-[#292D2B]">{formatDate(order.pickupDate, language)}</p></div>
                  <div><p className="text-[#303532]/45">Location</p><p className="mt-1 font-semibold text-[#292D2B]">{order.pickupLocation || '—'}</p></div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#303532]/45">{copy.order}</p>
                <div className="overflow-hidden rounded-2xl border border-[#55766F]/15 bg-white/70">
                  {order.items.map((item, index) => (
                    <div key={`${item.product_id || index}-${index}`} className="flex items-center justify-between gap-4 border-b border-[#55766F]/10 px-4 py-3 last:border-b-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="shrink-0 font-bold text-[#55766F]">{quantity(item)}×</span>
                        <span className="truncate text-sm font-semibold text-[#292D2B]">{itemName(item, language)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-[#C76624]/10 px-4 py-4">
                <span className="text-sm font-semibold text-[#303532]/65">{copy.total}</span>
                <span className="text-2xl font-extrabold text-[#C76624]">฿{Number(order.amountPaid || 0).toFixed(2)}</span>
              </div>

              {status?.expiresAt && (
                <div className="flex items-center justify-between rounded-xl border border-[#55766F]/15 bg-white/60 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2 text-[#303532]/55"><Clock className="h-4 w-4" /> QR expires</span>
                  <span className="font-mono font-bold text-[#292D2B]">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => void confirm()}
                disabled={confirming}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C76624] px-5 py-4 text-base font-bold text-white shadow-sm transition hover:bg-[#A95120] disabled:opacity-50"
              >
                {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                {confirming ? copy.confirming : copy.confirm}
              </button>

              <p className="flex items-start gap-2 text-xs leading-5 text-[#303532]/45"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{copy.secure}</p>
            </>
          ) : null}

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div>}
        </div>
      </section>
    </main>
  );
}
