import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { hasVerifiedEmail } from '../lib/lineProfile';
import { supabase } from '../lib/supabase';

const copy = {
  en: {
    heading: 'Verify your email',
    description: 'LINE does not provide your email address. Add one so we can send order confirmations.',
    checkout: 'A verified email is required before placing your first order. Your cart will be saved.',
    label: 'Email address',
    placeholder: 'you@example.com',
    send: 'Send verification email',
    sending: 'Sending…',
    sent: 'We sent a verification link to your address. Open it, then return here and refresh your status. Check spam if necessary.',
    sendFailed: 'Email verification is temporarily unavailable. Nothing was changed. Please try again later.',
    refresh: 'I verified my email — refresh status',
    checking: 'Checking…',
    notVerified: 'Not verified yet. Please open the email link first.',
    already: 'Your email address is verified.',
  },
  th: {
    heading: 'ยืนยันอีเมลของคุณ',
    description: 'LINE ไม่ส่งอีเมลของคุณให้เรา โปรดเพิ่มอีเมลเพื่อรับการยืนยันคำสั่งซื้อ',
    checkout: 'ต้องยืนยันอีเมลก่อนสั่งซื้อครั้งแรก สินค้าในตะกร้าจะยังอยู่',
    label: 'อีเมล',
    placeholder: 'you@example.com',
    send: 'ส่งอีเมลยืนยัน',
    sending: 'กำลังส่ง…',
    sent: 'ส่งลิงก์ยืนยันแล้ว โปรดเปิดอีเมล จากนั้นกลับมาที่นี่และตรวจสอบสถานะอีกครั้ง',
    sendFailed: 'ไม่สามารถส่งอีเมลยืนยันได้ในขณะนี้ ยังไม่มีการเปลี่ยนแปลง กรุณาลองใหม่ภายหลัง',
    refresh: 'ยืนยันแล้ว — ตรวจสอบสถานะ',
    checking: 'กำลังตรวจสอบ…',
    notVerified: 'ยังไม่ยืนยัน กรุณาเปิดลิงก์ในอีเมลก่อน',
    already: 'ยืนยันอีเมลแล้ว',
  },
  zh: {
    heading: '验证电子邮箱',
    description: 'LINE 不会提供您的邮箱地址。请添加邮箱以接收订单确认。',
    checkout: '首次下单前需要验证邮箱。购物车中的商品会保留。',
    label: '电子邮箱',
    placeholder: 'you@example.com',
    send: '发送验证邮件',
    sending: '正在发送…',
    sent: '验证邮件已发送。请点击邮件中的链接，然后返回此处刷新状态。',
    sendFailed: '暂时无法发送验证邮件。账号没有改变，请稍后重试。',
    refresh: '已验证 — 刷新状态',
    checking: '正在检查…',
    notVerified: '邮箱尚未验证，请先点击邮件中的链接。',
    already: '邮箱已验证',
  },
};

export function EmailVerificationPanel({ forCheckout = false }: { forCheckout?: boolean }) {
  const { user, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const t = copy[language];
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState<'send' | 'refresh' | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setEmail('');
    setError('');
    setNotice('');
    setSent(false);
  }, [user?.id]);

  if (!user || hasVerifiedEmail(user)) {
    return user ? <p className="text-sm text-[#3F665E]">{t.already}</p> : null;
  }

  const sendVerification = async () => {
    const address = email.trim().toLowerCase();
    if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError(language === 'th' ? 'กรุณากรอกอีเมลให้ถูกต้อง'
        : language === 'zh' ? '请输入有效的邮箱地址' : 'Enter a valid email address.');
      return;
    }
    setError('');
    setNotice('');
    setBusy('send');
    try {
      // This updates the signed-in LINE account. Do not call signUp/signInWithOtp:
      // those could create or enter a separate JOKO customer identity.
      const { error: updateError } = await supabase.auth.updateUser(
        { email: address },
        { emailRedirectTo: new URL('/auth/callback', window.location.origin).toString() },
      );
      if (updateError) throw updateError;
      setSent(true);
      setNotice(t.sent);
    } catch (err) {
      const responseError = err as { message?: unknown; code?: string; status?: number } | null;
      const message = responseError && typeof responseError.message === 'string'
        ? responseError.message.trim()
        : '';
      const serviceFailure = (responseError?.status ?? 0) >= 500
        || responseError?.code === 'unexpected_failure'
        || message === '{}' || message === '[object Object]' || !message;
      setError(serviceFailure ? t.sendFailed : message);
    } finally {
      setBusy(null);
    }
  };

  const refreshVerification = async () => {
    setError('');
    setNotice('');
    setBusy('refresh');
    try {
      // getUser() is network-backed, unlike stale user/session metadata.
      await refreshProfile();
      const { data, error: getError } = await supabase.auth.getUser();
      if (getError) throw getError;
      if (!hasVerifiedEmail(data.user)) setNotice(t.notVerified);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not refresh email status.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label={t.heading} className="space-y-3 rounded-2xl border border-[#55766F]/20 bg-white/55 p-4 sm:p-5">
      <h3 className="font-semibold text-[#303532]">{t.heading}</h3>
      <p className="text-sm text-[#303532]/75">{forCheckout ? t.checkout : t.description}</p>
      <label className="block text-sm font-medium text-[#303532]">
        {t.label}
        <input type="email" autoComplete="email" maxLength={254}
          placeholder={t.placeholder} value={email} onChange={(event) => setEmail(event.target.value)}
          className="mt-2 block w-full rounded-xl border border-[#55766F]/20 bg-white px-4 py-3 text-[#303532]"
          disabled={busy !== null} />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void sendVerification()} disabled={busy !== null}
          className="rounded-xl bg-[#3F665E] px-4 py-2.5 font-semibold text-white disabled:opacity-60">
          {busy === 'send' ? t.sending : t.send}
        </button>
        <button type="button" onClick={() => void refreshVerification()} disabled={busy !== null}
          className="rounded-xl border border-[#55766F]/25 px-4 py-2.5 font-semibold text-[#3F665E] disabled:opacity-60">
          {busy === 'refresh' ? t.checking : t.refresh}
        </button>
      </div>
      {sent && !notice && <p className="text-sm text-[#3F665E]">{t.sent}</p>}
      {notice && <p role="status" className="text-sm text-[#3F665E]">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
