import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileImage, Loader2, QrCode, ShieldCheck, Upload } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  createOrGetPaymentTransaction,
  getPaymentSettings,
  getPromptPayIntent,
  verifyPaymentSlip,
  type PaymentTransaction,
  type PromptPayIntent,
} from '../lib/paymentService';

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

type Language = 'en' | 'th' | 'zh';

type Copy = {
  title: string;
  intro: string;
  amount: string;
  scan: string;
  upload: string;
  choose: string;
  verify: string;
  checking: string;
  pending: string;
  paid: string;
  paidBody: string;
  expires: string;
  invalidImage: string;
  tooLarge: string;
  secure: string;
  reminder5: string;
  reminder10: string;
  reminder14: string;
  countdown: string;
  overdue: string;
};

const COPY: Record<Language, Copy> = {
  en: {
    title: 'Pay now with PromptPay',
    intro: 'Scan the QR, complete the transfer, then upload the bank slip. JOKO confirms the order automatically after the banking transaction is verified.',
    amount: 'Amount to pay',
    scan: 'Scan with your banking app',
    upload: 'Upload payment slip',
    choose: 'Choose bank slip',
    verify: 'Verify payment',
    checking: 'Checking payment…',
    pending: 'The bank transaction is still processing. Please retry in a few minutes.',
    paid: 'Payment verified',
    paidBody: 'Your order is paid and confirmed.',
    expires: 'Payment request expires',
    invalidImage: 'Use a JPEG, PNG, GIF or WebP bank-slip image.',
    tooLarge: 'The bank-slip image must be 4 MB or smaller.',
    secure: 'The receiving account and exact amount are checked automatically with EasySlip.',
    reminder5: 'Payment reminder: your order is still awaiting payment.',
    reminder10: 'Payment reminder: please complete payment soon to keep this reservation.',
    reminder14: 'Final reminder: payment is still outstanding.',
    countdown: 'Time remaining',
    overdue: 'Payment is still outstanding. This order is not confirmed.',
  },
  th: {
    title: 'ชำระด้วยพร้อมเพย์',
    intro: 'สแกน QR ชำระเงิน แล้วอัปโหลดสลิป ระบบ JOKO จะยืนยันคำสั่งซื้ออัตโนมัติหลังตรวจสอบธุรกรรมธนาคาร',
    amount: 'ยอดชำระ',
    scan: 'สแกนด้วยแอปธนาคาร',
    upload: 'อัปโหลดสลิปชำระเงิน',
    choose: 'เลือกสลิปธนาคาร',
    verify: 'ตรวจสอบการชำระเงิน',
    checking: 'กำลังตรวจสอบ…',
    pending: 'ธนาคารยังประมวลผลธุรกรรม กรุณาลองใหม่อีกครั้งในไม่กี่นาที',
    paid: 'ยืนยันการชำระเงินแล้ว',
    paidBody: 'คำสั่งซื้อของคุณชำระเงินและยืนยันแล้ว',
    expires: 'คำขอชำระเงินหมดอายุ',
    invalidImage: 'กรุณาใช้รูปสลิป JPEG, PNG, GIF หรือ WebP',
    tooLarge: 'รูปสลิปต้องมีขนาดไม่เกิน 4 MB',
    secure: 'ระบบตรวจสอบบัญชีผู้รับและยอดเงินที่ถูกต้องโดยอัตโนมัติผ่าน EasySlip',
    reminder5: 'แจ้งเตือนการชำระเงิน: คำสั่งซื้อของคุณยังรอการชำระเงิน',
    reminder10: 'แจ้งเตือนการชำระเงิน: กรุณาชำระเงินเร็ว ๆ นี้เพื่อรักษาการจองนี้',
    reminder14: 'แจ้งเตือนครั้งสุดท้าย: ยังไม่ได้ชำระเงิน',
    countdown: 'เวลาที่เหลือ',
    overdue: 'ยังไม่ได้ชำระเงิน คำสั่งซื้อนี้ยังไม่ได้รับการยืนยัน',
  },
  zh: {
    title: '使用 PromptPay 付款',
    intro: '扫描二维码完成转账，然后上传银行回执。银行交易验证成功后，JOKO 会自动确认订单。',
    amount: '应付金额',
    scan: '使用银行 App 扫描',
    upload: '上传付款回执',
    choose: '选择银行回执',
    verify: '验证付款',
    checking: '正在验证付款…',
    pending: '银行仍在处理该交易。请几分钟后重试。',
    paid: '付款已验证',
    paidBody: '您的订单已付款并确认。',
    expires: '付款请求到期时间',
    invalidImage: '请使用 JPEG、PNG、GIF 或 WebP 格式的银行回执。',
    tooLarge: '银行回执图片不得超过 4 MB。',
    secure: '系统会通过 EasySlip 自动核对收款账户和准确金额。',
    reminder5: '付款提醒：您的订单仍在等待付款。',
    reminder10: '付款提醒：请尽快完成付款以保留本次预订。',
    reminder14: '最后提醒：付款仍未完成。',
    countdown: '剩余时间',
    overdue: '付款仍未完成。此订单尚未确认。',
  },
};

function formatExpiry(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(
    language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB',
    { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' },
  );
}

export function OnlinePromptPayPanel({
  orderId,
  language,
  onPaid,
}: {
  orderId: string;
  language: Language;
  onPaid?: () => void;
}) {
  const copy = COPY[language];
  const inputRef = useRef<HTMLInputElement>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [transaction, setTransaction] = useState<PaymentTransaction | null>(null);
  const [intent, setIntent] = useState<PromptPayIntent | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const [paid, setPaid] = useState(false);
  const [paymentWindowMinutes, setPaymentWindowMinutes] = useState(60);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const settings = await getPaymentSettings();
        if (cancelled) return;
        setEnabled(settings.online_promptpay_enabled);
        setPaymentWindowMinutes(settings.payment_window_minutes);

        if (!settings.online_promptpay_enabled) return;

        const nextTransaction = await createOrGetPaymentTransaction(orderId);
        if (cancelled) return;
        setTransaction(nextTransaction);

        const nextIntent = await getPromptPayIntent(nextTransaction.id);
        if (cancelled) return;
        setIntent(nextIntent);
        if (nextIntent.state === 'verified') setPaid(true);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not prepare payment.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [orderId]);

  useEffect(() => {
    if (!intent?.expiresAt || paid) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [intent?.expiresAt, paid]);

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
    if (!transaction || !file) return;

    try {
      setVerifying(true);
      setError('');
      setPendingMessage('');
      const result = await verifyPaymentSlip(transaction.id, file);

      if (result.state === 'pending') {
        setPendingMessage(result.message || copy.pending);
        return;
      }

      if (result.state === 'verified') {
        setPaid(true);
        onPaid?.();
        return;
      }

      setError(result.message || result.error || 'Payment could not be verified.');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Payment could not be verified.');
    } finally {
      setVerifying(false);
    }
  };

  if (loading || enabled === null) {
    return (
      <div className="flex items-center justify-center py-6 text-[#55766F]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!enabled) return null;

  if (paid || intent?.state === 'verified') {
    return (
      <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3 text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <p className="font-semibold">{copy.paid}</p>
            <p className="mt-1 text-sm">{copy.paidBody}</p>
          </div>
        </div>
      </div>
    );
  }

  const expiryMs = intent?.expiresAt ? new Date(intent.expiresAt).getTime() : NaN;
  const remainingMs = Number.isFinite(expiryMs) ? expiryMs - nowMs : 0;
  const elapsedMinutes = Number.isFinite(expiryMs)
    ? paymentWindowMinutes - Math.max(0, remainingMs) / 60000
    : 0;
  const isOverdue = Number.isFinite(expiryMs) && remainingMs <= 0;
  const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const countdownText = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;
  const reminderText = isOverdue
    ? copy.overdue
    : paymentWindowMinutes === 15 && elapsedMinutes >= 14
      ? copy.reminder14
      : paymentWindowMinutes === 15 && elapsedMinutes >= 10
        ? copy.reminder10
        : paymentWindowMinutes === 15 && elapsedMinutes >= 5
          ? copy.reminder5
          : '';

  if (!transaction || !intent?.promptPayPayload) {
    return error ? (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
    ) : null;
  }

  return (
    <div className="rounded-[2rem] border border-[#55766F]/[.14] bg-[#FFF9EE]/95 p-5 shadow-[0_18px_50px_rgba(59,74,69,0.06)] sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#CFE3DF]/65 p-2.5 text-[#3F665E]">
          <QrCode className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>
            {intent?.qrMode === 'kshop_master' || intent?.qrMode === 'kshop_easyslip'
              ? (language === 'th' ? 'ชำระด้วย K SHOP QR' : language === 'zh' ? '使用 K SHOP QR 付款' : 'Pay now with K SHOP QR')
              : copy.title}
          </h3>
          <p className="mt-1 text-sm leading-6 text-[#303532]/65">
            {intent?.qrMode === 'kshop_master' || intent?.qrMode === 'kshop_easyslip'
              ? (language === 'th'
                  ? 'สแกน QR ร้านค้า ชำระเงิน แล้วอัปโหลดสลิป ระบบ JOKO จะยืนยันคำสั่งซื้อหลังตรวจสอบธุรกรรมสำเร็จ'
                  : language === 'zh'
                    ? '扫描商户二维码完成付款，然后上传银行回执。交易验证成功后，JOKO 才会确认订单。'
                    : 'Scan the merchant QR, complete the transfer, then upload the bank slip. JOKO confirms the order only after the banking transaction is verified.')
              : copy.intro}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
        <div className="rounded-2xl border border-[#55766F]/15 bg-white p-3">
          <QRCodeSVG
            value={intent.promptPayPayload}
            size={154}
            level="M"
            includeMargin
            aria-label="PromptPay QR code"
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#303532]/45">{copy.amount}</p>
          <p className="mt-1 text-3xl font-bold text-[#C76624]">฿{Number(intent.amount).toFixed(2)}</p>
          <p className="mt-2 text-sm font-semibold text-[#3F665E]">{copy.scan}</p>
          <div className="mt-3 flex items-center gap-2 text-xs text-[#303532]/55">
            <Clock className="h-4 w-4" />
            <span>{copy.expires}: {formatExpiry(intent.expiresAt, language)}</span>
          </div>
          {paymentWindowMinutes === 15 && (
            <div className={`mt-3 rounded-xl border p-3 text-sm ${isOverdue ? 'border-red-200 bg-red-50 text-red-700' : remainingSeconds <= 60 ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-[#55766F]/15 bg-white/60 text-[#303532]/70'}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{isOverdue ? copy.overdue : copy.countdown}</span>
                {!isOverdue && <span className="font-mono text-base font-bold">{countdownText}</span>}
              </div>
              {reminderText && !isOverdue && <p className="mt-1 text-xs leading-5">{reminderText}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-[#55766F]/12 pt-5">
        <p className="text-sm font-semibold text-[#303532]">{copy.upload}</p>
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
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#55766F]/35 bg-white/65 px-4 py-4 text-sm font-semibold text-[#3F665E] transition hover:bg-[#CFE3DF]/25 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {copy.choose}
        </button>

        {file && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#55766F]/15 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <FileImage className="h-4 w-4 shrink-0 text-[#55766F]" />
              <span className="truncate text-sm font-medium text-[#303532]">{file.name}</span>
            </div>
            <button
              type="button"
              onClick={() => void verify()}
              disabled={verifying}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C76624] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#A95120] disabled:opacity-50"
            >
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {verifying ? copy.checking : copy.verify}
            </button>
          </div>
        )}

        {pendingMessage && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{pendingMessage}</p>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <p className="mt-3 text-xs leading-5 text-[#303532]/50">
          {intent?.qrMode === 'kshop_master' || intent?.qrMode === 'kshop_easyslip'
            ? (language === 'th'
                ? 'K SHOP QR นี้เชื่อมกับบัญชีร้านค้าที่ลงทะเบียน และ EasySlip จะตรวจสอบบัญชีผู้รับ ยอดเงิน และธุรกรรมซ้ำโดยอัตโนมัติ'
                : language === 'zh'
                  ? '此 K SHOP QR 连接到已登记的商户账户；EasySlip 会自动核对收款账户、金额和重复交易。'
                  : intent?.qrMode === 'kshop_master'
                    ? 'This QR is derived from JOKO’s genuine K SHOP merchant QR; EasySlip still verifies the receiving account, exact amount and duplicate use.'
                    : 'This K SHOP QR is generated through EasySlip; EasySlip also verifies the receiving account, exact amount and duplicate use.')
            : copy.secure}
        </p>
      </div>
    </div>
  );
}
