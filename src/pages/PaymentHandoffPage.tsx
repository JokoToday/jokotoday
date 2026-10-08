import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileImage, Loader2, ShieldCheck, Smartphone, Upload } from 'lucide-react';
import {
  getPaymentHandoffStatus,
  verifyPaymentSlipFromHandoff,
  type PaymentHandoff,
} from '../lib/paymentService';

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

type Language = 'en' | 'th' | 'zh';

type Copy = {
  title: string;
  intro: string;
  pendingPayment: string;
  timeRemaining: string;
  chooseTitle: string;
  chooseHelper: string;
  choose: string;
  verify: string;
  checking: string;
  verified: string;
  verifiedBody: string;
  expired: string;
  expiredBody: string;
  pending: string;
  invalidImage: string;
  tooLarge: string;
  secure: string;
};

const COPY: Record<Language, Copy> = {
  en: {
    title: 'Upload payment slip',
    intro: 'This secure mobile page is already linked to your JOKO payment. Choose the bank slip directly from this phone — no email and no order number.',
    pendingPayment: 'Pending payment',
    timeRemaining: 'Time remaining',
    chooseTitle: 'Upload payment slip',
    chooseHelper: 'Choose the saved slip from Photos, Files, or your banking app.',
    choose: 'Choose bank slip',
    verify: 'Verify payment',
    checking: 'Checking payment…',
    verified: 'Payment verified',
    verifiedBody: 'Your order is paid and confirmed. The payment screen on your computer will update automatically.',
    expired: 'Payment window expired',
    expiredBody: 'This secure upload link is no longer active. Please return to JOKO TODAY and place the order again.',
    pending: 'The bank transaction is still processing. JOKO will keep this payment pending.',
    invalidImage: 'Please choose a JPEG, PNG, GIF or WebP bank-slip image.',
    tooLarge: 'The bank-slip image must be 4 MB or smaller.',
    secure: 'EasySlip checks the receiving account, exact amount and duplicate transaction use. This link expires together with the payment window.',
  },
  th: {
    title: 'อัปโหลดสลิปชำระเงิน',
    intro: 'หน้านี้เชื่อมกับการชำระเงินของ JOKO ของคุณเรียบร้อยแล้ว เลือกสลิปจากโทรศัพท์เครื่องนี้ได้โดยตรง ไม่ต้องส่งอีเมลและไม่ต้องกรอกเลขคำสั่งซื้อ',
    pendingPayment: 'รอการชำระเงิน',
    timeRemaining: 'เวลาที่เหลือ',
    chooseTitle: 'อัปโหลดสลิปชำระเงิน',
    chooseHelper: 'เลือกสลิปที่บันทึกไว้จากรูปภาพ ไฟล์ หรือแอปธนาคารของคุณ',
    choose: 'เลือกสลิปธนาคาร',
    verify: 'ตรวจสอบการชำระเงิน',
    checking: 'กำลังตรวจสอบการชำระเงิน…',
    verified: 'ยืนยันการชำระเงินแล้ว',
    verifiedBody: 'คำสั่งซื้อของคุณชำระเงินและยืนยันแล้ว หน้าชำระเงินบนคอมพิวเตอร์จะอัปเดตโดยอัตโนมัติ',
    expired: 'หมดเวลาชำระเงินแล้ว',
    expiredBody: 'ลิงก์อัปโหลดที่ปลอดภัยนี้หมดอายุแล้ว กรุณากลับไปที่ JOKO TODAY และทำรายการสั่งซื้อใหม่',
    pending: 'ธนาคารยังประมวลผลธุรกรรมอยู่ JOKO จะเก็บการชำระเงินนี้ไว้ในสถานะรอตรวจสอบ',
    invalidImage: 'กรุณาเลือกไฟล์สลิป JPEG, PNG, GIF หรือ WebP',
    tooLarge: 'ไฟล์สลิปต้องมีขนาดไม่เกิน 4 MB',
    secure: 'EasySlip จะตรวจสอบบัญชีผู้รับ ยอดเงินที่ถูกต้อง และการใช้ธุรกรรมซ้ำ ลิงก์นี้จะหมดอายุพร้อมกับเวลาชำระเงิน',
  },
  zh: {
    title: '上传付款回执',
    intro: '此安全手机页面已与您的 JOKO 付款关联。可直接从本手机选择银行回执，无需发送邮件，也无需输入订单号。',
    pendingPayment: '待付款',
    timeRemaining: '剩余时间',
    chooseTitle: '上传付款回执',
    chooseHelper: '从照片、文件或银行 App 中选择已保存的付款回执。',
    choose: '选择银行回执',
    verify: '验证付款',
    checking: '正在验证付款…',
    verified: '付款已验证',
    verifiedBody: '您的订单已付款并确认。电脑上的付款页面会自动更新。',
    expired: '付款时间已结束',
    expiredBody: '此安全上传链接已失效。请返回 JOKO TODAY 重新下单。',
    pending: '银行仍在处理该交易。JOKO 会继续保留此付款并等待验证。',
    invalidImage: '请选择 JPEG、PNG、GIF 或 WebP 格式的银行回执。',
    tooLarge: '银行回执图片不得超过 4 MB。',
    secure: 'EasySlip 会核对收款账户、准确金额及重复交易。此链接会与付款时限同时失效。',
  },
};

function resolveLanguage(): Language {
  const value = new URLSearchParams(window.location.search).get('lang');
  return value === 'th' || value === 'zh' ? value : 'en';
}

export function PaymentHandoffPage({ token }: { token: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const language = resolveLanguage();
  const copy = COPY[language];
  const [handoff, setHandoff] = useState<PaymentHandoff | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refresh = async () => {
    const next = await getPaymentHandoffStatus(token);
    setHandoff(next);
    return next;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const next = await getPaymentHandoffStatus(token);
        if (!cancelled) setHandoff(next);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not open this payment handoff.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!handoff || handoff.state === 'verified' || handoff.state === 'expired') return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [handoff?.state, token]);

  const chooseFile = (nextFile: File | null) => {
    setError('');
    setPendingMessage('');
    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.has(nextFile.type)) {
      setFile(null);
      setError(copy.invalidImage);
      return;
    }
    if (nextFile.size <= 0 || nextFile.size > MAX_FILE_BYTES) {
      setFile(null);
      setError(copy.tooLarge);
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
      const result = await verifyPaymentSlipFromHandoff(token, file);
      if (result.state === 'pending') {
        setPendingMessage(result.message || copy.pending);
        await refresh();
        return;
      }
      if (result.state === 'verified') {
        setHandoff((current) => current ? { ...current, state: 'verified', paymentStatus: 'paid', orderStatus: 'confirmed' } : current);
        return;
      }
      setError(result.message || result.error || 'Payment could not be verified.');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Payment could not be verified.');
    } finally {
      setVerifying(false);
    }
  };

  const expiryMs = handoff?.expiresAt ? new Date(handoff.expiresAt).getTime() : NaN;
  const remainingSeconds = Number.isFinite(expiryMs) ? Math.max(0, Math.ceil((expiryMs - nowMs) / 1000)) : 0;
  const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  if (loading) {
    return <div className="joko-mineral-field flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#55766F]" /></div>;
  }

  return (
    <main className="joko-mineral-field min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-lg overflow-hidden rounded-[2.25rem] border border-[#55766F]/[.14] bg-[#FFF9EE]/[.96] shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
        <div className="border-b border-[#55766F]/[.12] bg-[#CFE3DF]/55 px-6 pb-6 pt-7 text-center sm:px-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/70 text-[#3F665E]">
            {handoff?.state === 'verified' ? <CheckCircle2 className="h-8 w-8" /> : <Smartphone className="h-7 w-7" />}
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>
            {handoff?.state === 'verified' ? copy.verified : copy.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#303532]/65">
            {handoff?.state === 'verified' ? copy.verifiedBody : copy.intro}
          </p>
        </div>

        <div className="space-y-5 px-5 py-6 sm:px-8">
          {handoff?.state === 'expired' ? (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div><p className="font-semibold">{copy.expired}</p><p className="mt-1 text-sm leading-6">{copy.expiredBody}</p></div>
            </div>
          ) : handoff?.state === 'verified' ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
              <div><p className="font-semibold">{copy.verified}</p><p className="mt-1 text-sm leading-6">{copy.verifiedBody}</p></div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-[#55766F]/15 bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#303532]/45">{copy.pendingPayment}</p>
                <div className="mt-1 flex items-end justify-between gap-4">
                  <p className="text-3xl font-bold text-[#C76624]">฿{Number(handoff?.amount || 0).toFixed(2)}</p>
                  {handoff?.orderNumber && <p className="text-xs text-[#303532]/45">#{handoff.orderNumber}</p>}
                </div>
                {handoff?.expiresAt && (
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-[#55766F]/15 bg-[#FFF9EE] px-4 py-3 text-sm">
                    <span className="flex items-center gap-2 text-[#303532]/60"><Clock className="h-4 w-4" /> {copy.timeRemaining}</span>
                    <span className="font-mono font-bold text-[#303532]">{countdown}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-[#55766F]/12 pt-5">
                <p className="text-sm font-semibold text-[#303532]">{copy.chooseTitle}</p>
                <p className="mt-1 text-xs leading-5 text-[#303532]/50">{copy.chooseHelper}</p>
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0] || null)} />
                <button type="button" onClick={() => inputRef.current?.click()} disabled={verifying} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#55766F]/35 bg-white/65 px-4 py-4 text-sm font-semibold text-[#3F665E] transition hover:bg-[#CFE3DF]/25 disabled:opacity-50">
                  <Upload className="h-4 w-4" /> {copy.choose}
                </button>

                {file && (
                  <div className="mt-3 rounded-xl border border-[#55766F]/15 bg-white/70 p-3">
                    <div className="flex items-center gap-2"><FileImage className="h-4 w-4 shrink-0 text-[#55766F]" /><span className="truncate text-sm font-medium text-[#303532]">{file.name}</span></div>
                    <button type="button" onClick={() => void verify()} disabled={verifying} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C76624] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#A95120] disabled:opacity-50">
                      {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} {verifying ? copy.checking : copy.verify}
                    </button>
                  </div>
                )}

                {pendingMessage && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">{pendingMessage}</div>}
                {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div>}
                <p className="mt-4 text-xs leading-5 text-[#303532]/45">{copy.secure}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default PaymentHandoffPage;
