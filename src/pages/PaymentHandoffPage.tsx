import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileImage, Loader2, MessageCircle, ShieldCheck, Upload } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  resolvePaymentHandoff,
  verifyPaymentHandoffSlip,
  type PaymentHandoffState,
} from '../lib/paymentService';
import { LINE_OFFICIAL_ACCOUNT_URL } from '../lib/lineOfficialAccount';

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const COPY = {
  en: {
    eyebrow: 'JOKO TODAY · Mobile payment handoff',
    title: 'Send your payment slip from this phone',
    body: 'Choose the bank slip from your phone. JOKO will attach it to the payment you started on your desktop automatically.',
    order: 'Order',
    amount: 'Amount',
    expires: 'Payment window ends',
    choose: 'Choose bank slip',
    verify: 'Verify payment',
    checking: 'Checking payment…',
    pending: 'Slip received. The bank transaction is still processing. You can keep this page open or return later.',
    verified: 'Payment verified',
    verifiedBody: 'Your order is paid and confirmed. Your desktop will update automatically.',
    expired: 'This payment window has expired.',
    invalid: 'Use a JPEG, PNG, GIF or WebP bank-slip image.',
    tooLarge: 'The bank-slip image must be 4 MB or smaller.',
    line: 'Open JOKO TODAY on LINE',
  },
  th: {
    eyebrow: 'JOKO TODAY · ส่งสลิปจากมือถือ',
    title: 'ส่งสลิปชำระเงินจากโทรศัพท์เครื่องนี้',
    body: 'เลือกสลิปจากโทรศัพท์ ระบบ JOKO จะเชื่อมสลิปกับรายการชำระเงินที่เริ่มบนคอมพิวเตอร์โดยอัตโนมัติ',
    order: 'คำสั่งซื้อ',
    amount: 'ยอดชำระ',
    expires: 'สิ้นสุดเวลาชำระเงิน',
    choose: 'เลือกสลิปธนาคาร',
    verify: 'ตรวจสอบการชำระเงิน',
    checking: 'กำลังตรวจสอบ…',
    pending: 'ได้รับสลิปแล้ว ธนาคารยังประมวลผลธุรกรรม คุณสามารถเปิดหน้านี้ไว้หรือกลับมาใหม่ภายหลัง',
    verified: 'ยืนยันการชำระเงินแล้ว',
    verifiedBody: 'ชำระเงินและยืนยันคำสั่งซื้อแล้ว หน้าคอมพิวเตอร์จะอัปเดตอัตโนมัติ',
    expired: 'หมดเวลาชำระเงินแล้ว',
    invalid: 'กรุณาใช้ไฟล์ JPEG, PNG, GIF หรือ WebP',
    tooLarge: 'รูปสลิปต้องมีขนาดไม่เกิน 4 MB',
    line: 'เปิด JOKO TODAY ใน LINE',
  },
  zh: {
    eyebrow: 'JOKO TODAY · 手机付款接力',
    title: '从这部手机上传付款回执',
    body: '从手机选择银行回执。JOKO 会自动把它关联到您在电脑上开始的付款。',
    order: '订单',
    amount: '金额',
    expires: '付款截止',
    choose: '选择银行回执',
    verify: '验证付款',
    checking: '正在验证…',
    pending: '已收到回执。银行交易仍在处理中。您可以保持此页面打开或稍后返回。',
    verified: '付款已验证',
    verifiedBody: '订单已付款并确认。电脑页面会自动更新。',
    expired: '此付款窗口已过期。',
    invalid: '请使用 JPEG、PNG、GIF 或 WebP 格式的银行回执。',
    tooLarge: '银行回执图片不得超过 4 MB。',
    line: '在 LINE 中打开 JOKO TODAY',
  },
} as const;

function formatExpiry(value: string, language: 'en' | 'th' | 'zh'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(
    language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB',
    { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' },
  );
}

export default function PaymentHandoffPage({ token }: { token: string }) {
  const { language } = useLanguage();
  const t = COPY[language];
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<PaymentHandoffState | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');

  const refresh = useCallback(async () => {
    const next = await resolvePaymentHandoff(token);
    setState(next);
    return next;
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await resolvePaymentHandoff(token);
        if (!cancelled) setState(next);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not open payment handoff.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  const handoffState = state?.state;

  useEffect(() => {
    if (!handoffState || !['pending', 'verifying'].includes(handoffState)) return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [handoffState, refresh]);

  const chooseFile = (nextFile: File | null) => {
    setError('');
    setPendingMessage('');

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!ALLOWED_TYPES.has(nextFile.type)) {
      setFile(null);
      setError(t.invalid);
      return;
    }

    if (nextFile.size <= 0 || nextFile.size > MAX_FILE_BYTES) {
      setFile(null);
      setError(t.tooLarge);
      return;
    }

    setFile(nextFile);
  };

  const verify = async () => {
    if (!file) return;

    try {
      setVerifying(true);
      setError('');
      setPendingMessage('');
      const result = await verifyPaymentHandoffSlip(token, file);

      if (result.state === 'verified') {
        await refresh();
        return;
      }

      if (result.state === 'pending') {
        setPendingMessage(result.message || t.pending);
        await refresh();
        return;
      }

      setError(result.message || result.error || 'Payment could not be verified.');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Payment could not be verified.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F4EFE5] px-4 py-12">
        <div className="mx-auto flex max-w-md items-center justify-center rounded-[2rem] bg-[#FFF9EE] p-10 text-[#55766F] shadow-sm">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="min-h-screen bg-[#F4EFE5] px-4 py-12">
        <div className="mx-auto max-w-md rounded-[2rem] border border-red-200 bg-[#FFF9EE] p-6 text-red-700 shadow-sm">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-6">{error || 'This payment handoff is unavailable.'}</p>
          </div>
        </div>
      </main>
    );
  }

  const finished = state.state === 'verified';
  const unavailable = state.state === 'expired' || state.state === 'cancelled';

  return (
    <main className="min-h-screen bg-[#F4EFE5] px-4 py-8 sm:py-12">
      <section className="mx-auto max-w-md overflow-hidden rounded-[2rem] border border-[#55766F]/15 bg-[#FFF9EE] shadow-[0_18px_60px_rgba(48,53,50,0.10)]">
        <header className="bg-[#DAEBE8] px-6 py-6 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#55766F]">{t.eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#303532]" style={{ fontFamily: 'var(--joko-font-display)' }}>
            {finished ? t.verified : t.title}
          </h1>
        </header>

        <div className="p-6">
          {finished ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <p className="font-semibold">{t.verified}</p>
                  <p className="mt-1 text-sm leading-6">{t.verifiedBody}</p>
                </div>
              </div>
            </div>
          ) : unavailable ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">{t.expired}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm leading-6 text-[#303532]/70">{t.body}</p>

              <div className="mt-5 rounded-2xl border border-[#55766F]/15 bg-white/70 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#303532]/45">{t.order}</span>
                  <span className="font-mono text-sm font-bold text-[#303532]">#{state.orderNumber}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#303532]/45">{t.amount}</span>
                  <span className="text-2xl font-bold text-[#C76624]">฿{Number(state.amount).toFixed(2)}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-4 border-t border-[#55766F]/10 pt-3 text-xs text-[#303532]/55">
                  <span>{t.expires}</span>
                  <span>{formatExpiry(state.expiresAt, language)}</span>
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(event) => chooseFile(event.target.files?.[0] || null)}
              />

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={verifying}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#55766F]/35 bg-white px-4 py-4 text-sm font-semibold text-[#3F665E] disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {t.choose}
              </button>

              {file && (
                <div className="mt-3 rounded-xl border border-[#55766F]/15 bg-white/80 p-3">
                  <div className="flex items-center gap-2">
                    <FileImage className="h-4 w-4 shrink-0 text-[#55766F]" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#303532]">{file.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void verify()}
                    disabled={verifying}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C76624] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                    {verifying ? t.checking : t.verify}
                  </button>
                </div>
              )}

              {pendingMessage && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                  {pendingMessage}
                </div>
              )}

              {error && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
                  {error}
                </div>
              )}
            </>
          )}

          <a
            href={LINE_OFFICIAL_ACCOUNT_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#06C755] px-4 py-3 text-sm font-semibold text-white"
          >
            <MessageCircle className="h-4 w-4" />
            {t.line}
          </a>
        </div>
      </section>
    </main>
  );
}
