import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mail, Loader2, KeyRound, ShoppingBag, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';

interface AuthRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType?: 'cart' | 'checkout';
  defaultLanguage?: 'en' | 'th' | 'zh';
}

type ModalView = 'landing' | 'email-form' | 'otp';
type AuthMode = 'signin' | 'signup';
type ModalLanguage = 'en' | 'th' | 'zh';

const langOptions: { key: ModalLanguage; label: string }[] = [
  { key: 'en', label: 'EN' },
  { key: 'th', label: 'TH' },
  { key: 'zh', label: '中文' },
];

const otpText: Record<ModalLanguage, {
  sendCode: string;
  sending: string;
  footer: string;
  title: string;
  instruction: string;
  codeLabel: string;
  verify: string;
  verifying: string;
  invalidCode: string;
  expiredCode: string;
  resend: string;
  resent: string;
  changeEmail: string;
  genericError: string;
}> = {
  en: {
    sendCode: 'Send verification code',
    sending: 'Sending code…',
    footer: 'You will receive a secure 6-digit verification code via email.',
    title: 'Enter verification code',
    instruction: 'We sent a 6-digit code to',
    codeLabel: 'Verification code',
    verify: 'Verify & Sign In',
    verifying: 'Verifying…',
    invalidCode: 'Please enter the 6-digit verification code from your email.',
    expiredCode: 'Oops — that code has had its moment. Grab a fresh one and try again.',
    resend: 'Send me a fresh code',
    resent: 'A new verification code has been sent.',
    changeEmail: 'Use a different email',
    genericError: 'Something went wrong. Please try again.',
  },
  th: {
    sendCode: 'ส่งรหัสยืนยัน',
    sending: 'กำลังส่งรหัส…',
    footer: 'คุณจะได้รับรหัสยืนยัน 6 หลักที่ปลอดภัยทางอีเมล',
    title: 'กรอกรหัสยืนยัน',
    instruction: 'เราได้ส่งรหัส 6 หลักไปที่',
    codeLabel: 'รหัสยืนยัน',
    verify: 'ยืนยันและเข้าสู่ระบบ',
    verifying: 'กำลังตรวจสอบ…',
    invalidCode: 'กรุณากรอกรหัสยืนยัน 6 หลักจากอีเมลของคุณ',
    expiredCode: 'อุ๊ปส์ — รหัสนี้หมดเวลาของมันแล้ว ขอรหัสใหม่แล้วลองอีกครั้งนะ',
    resend: 'ส่งรหัสใหม่ให้หน่อย',
    resent: 'ส่งรหัสยืนยันใหม่แล้ว',
    changeEmail: 'ใช้อีเมลอื่น',
    genericError: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง',
  },
  zh: {
    sendCode: '发送验证码',
    sending: '正在发送验证码…',
    footer: '您将通过电子邮件收到安全的 6 位验证码。',
    title: '输入验证码',
    instruction: '我们已将 6 位验证码发送至',
    codeLabel: '验证码',
    verify: '验证并登录',
    verifying: '正在验证…',
    invalidCode: '请输入邮件中的 6 位验证码。',
    expiredCode: '哎呀，这个验证码已经过了有效时间。重新获取一个新的，再试一次吧。',
    resend: '给我发一个新验证码',
    resent: '新的验证码已发送。',
    changeEmail: '使用其他邮箱',
    genericError: '出现问题，请重试。',
  },
};

export function AuthRequiredModal({
  isOpen,
  onClose,
  actionType = 'cart',
  defaultLanguage,
}: AuthRequiredModalProps) {
  const { sendEmailOtp, verifyEmailOtp } = useAuth();
  const { language: globalLanguage, setLanguage: setGlobalLanguage } = useLanguage();
  const { getLabel } = useCMSLabels();

  const [localLanguage, setLocalLanguage] = useState<ModalLanguage>(
    defaultLanguage ?? globalLanguage
  );
  const [view, setView] = useState<ModalView>('landing');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const backdropRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const lang = localLanguage;
  const otpCopy = otpText[lang];
  const displayedError = Object.values(otpText).some((copy) => error === copy.expiredCode)
    ? otpCopy.expiredCode
    : Object.values(otpText).some((copy) => error === copy.invalidCode)
      ? otpCopy.invalidCode
      : error;

  const g = useCallback(
    (key: string, fallback: string) => getLabel(`auth_required_modal.${key}`, lang, fallback),
    [getLabel, lang]
  );

  useEffect(() => {
    if (!isOpen) return;
    setLocalLanguage(defaultLanguage ?? globalLanguage);
    setView('landing');
    setEmail('');
    setOtp('');
    setError('');
    setNotice('');
    setLoading(false);
  }, [isOpen, defaultLanguage]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (view === 'email-form') {
      setTimeout(() => emailInputRef.current?.focus(), 80);
    }
  }, [view]);

  const handleClose = () => {
    onClose();
  };

  const handleLanguageChange = (l: ModalLanguage) => {
    setLocalLanguage(l);
    setGlobalLanguage(l);
    setNotice('');
  };

  const handleOpenEmailForm = (mode: AuthMode) => {
    setAuthMode(mode);
    setError('');
    setNotice('');
    setView('email-form');
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await sendEmailOtp(email.trim(), localLanguage);
      setOtp('');
      setView('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : otpCopy.genericError);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (!/^\d{6}$/.test(otp)) {
      setError(otpCopy.invalidCode);
      return;
    }

    setLoading(true);
    try {
      await verifyEmailOtp(email.trim(), otp);
      handleClose();
    } catch (err) {
      console.error('OTP verification failed:', err);
      setError(otpCopy.expiredCode);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await sendEmailOtp(email.trim(), localLanguage);
      setOtp('');
      setNotice(otpCopy.resent);
    } catch (err) {
      setError(err instanceof Error ? err.message : otpCopy.genericError);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) handleClose();
  };

  if (!isOpen) return null;

  const benefits = [
    g('benefit_1', 'Track your orders'),
    g('benefit_2', 'Access your member QR code'),
    g('benefit_3', 'Enjoy a seamless boutique experience'),
  ];

  const havingAccountTitle = g('having_account_title', 'Having an account allows you to:');

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,6,2,0.62)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full bg-white overflow-hidden"
        style={{
          maxWidth: 480,
          borderRadius: 20,
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          animation: 'authModalIn 0.26s cubic-bezier(0.34,1.4,0.64,1) both',
        }}
      >
        <div style={{ height: 4, background: 'linear-gradient(90deg,#c6a75e 0%,#e8c97a 50%,#c6a75e 100%)' }} />

        <div className="flex items-start justify-between px-8 pt-7 pb-0">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ width: 42, height: 42, background: 'linear-gradient(135deg,#c6a75e,#e8c97a)', flexShrink: 0 }}
            >
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-widest uppercase" style={{ color: '#c6a75e', letterSpacing: '0.12em' }}>
                JOKO TODAY
              </div>
              <h2
                className="font-bold leading-tight"
                style={{ fontSize: 19, color: '#1a1208', marginTop: 1 }}
              >
                {view === 'otp' ? otpCopy.title : g('title', 'Sign In to Continue')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0" style={{ marginTop: 2 }}>
            <div
              className="flex items-center"
              style={{ background: '#f5f0e8', borderRadius: 8, padding: '3px 3px' }}
            >
              {langOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleLanguageChange(opt.key)}
                  className="text-xs font-semibold transition-all"
                  style={{
                    padding: '4px 9px',
                    borderRadius: 6,
                    background: lang === opt.key ? '#c6a75e' : 'transparent',
                    color: lang === opt.key ? '#fff' : '#7a6340',
                    border: 'none',
                    cursor: 'pointer',
                    lineHeight: 1.4,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleClose}
              className="transition-colors rounded-full flex items-center justify-center"
              style={{ width: 32, height: 32, background: '#f5f0e8', border: 'none', cursor: 'pointer' }}
              aria-label="Close"
              disabled={loading}
            >
              <X className="w-4 h-4" style={{ color: '#9c8460' }} />
            </button>
          </div>
        </div>

        <div className="px-8 pt-5 pb-8">
          {error && (
            <div
              className="rounded-xl text-sm mb-4"
              style={{ background: '#fff1f0', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 14px' }}
            >
              {displayedError}
            </div>
          )}

          {notice && (
            <div
              className="rounded-xl text-sm mb-4"
              style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857', padding: '12px 14px' }}
            >
              {notice}
            </div>
          )}

          {view === 'landing' && (
            <>
              <p className="text-sm leading-relaxed" style={{ color: '#4a3d28', marginBottom: 20 }}>
                {g('body', 'To place an order at JOKO TODAY, please sign in or create an account.')}
              </p>

              <div
                className="rounded-xl"
                style={{ background: '#fffbf0', border: '1px solid #f0e4bc', padding: '14px 18px', marginBottom: 24 }}
              >
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#c6a75e', marginBottom: 10, letterSpacing: '0.1em' }}>
                  {havingAccountTitle}
                </p>
                <ul className="space-y-2">
                  {benefits.map((b, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm" style={{ color: '#3d2e12' }}>
                      <Star className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#c6a75e', fill: '#c6a75e' }} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => handleOpenEmailForm('signin')}
                className="w-full font-bold text-sm transition-all"
                style={{
                  background: 'linear-gradient(135deg,#c6a75e 0%,#d4b96a 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px 0',
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                  boxShadow: '0 4px 16px rgba(198,167,94,0.35)',
                  marginBottom: 10,
                }}
              >
                {g('sign_in_button', 'Sign In')}
              </button>

              <button
                onClick={() => handleOpenEmailForm('signup')}
                className="w-full font-bold text-sm transition-all"
                style={{
                  background: 'transparent',
                  color: '#c6a75e',
                  border: '1.5px solid #c6a75e',
                  borderRadius: 12,
                  padding: '13px 0',
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                }}
              >
                {g('create_account_button', 'Create Account')}
              </button>

              <p className="text-center text-xs mt-5" style={{ color: '#b0a080' }}>
                {otpCopy.footer}
              </p>
            </>
          )}

          {view === 'email-form' && (
            <>
              <button
                onClick={() => { setView('landing'); setError(''); setNotice(''); }}
                className="flex items-center gap-1 text-xs font-semibold mb-5 transition-colors"
                style={{ color: '#c6a75e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                disabled={loading}
              >
                ← {g('back_button', 'Back')}
              </button>

              <p className="text-sm leading-relaxed mb-5" style={{ color: '#4a3d28' }}>
                {authMode === 'signup'
                  ? g('body', 'To place an order at JOKO TODAY, please sign in or create an account.')
                  : g('body', 'To place an order at JOKO TODAY, please sign in or create an account.')}
              </p>

              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-semibold mb-2"
                    style={{ color: '#6b5730', letterSpacing: '0.05em' }}
                  >
                    {g('email_label', 'Email Address')}
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute top-1/2 -translate-y-1/2 left-4 w-4 h-4"
                      style={{ color: '#c6a75e', pointerEvents: 'none' }}
                    />
                    <input
                      id="auth-email"
                      ref={emailInputRef}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={g('email_placeholder', 'you@example.com')}
                      required
                      disabled={loading}
                      className="w-full text-sm"
                      style={{
                        padding: '13px 14px 13px 40px',
                        borderRadius: 12,
                        border: '1.5px solid #e8dcc4',
                        background: '#fffdf8',
                        color: '#1a1208',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => (e.target.style.borderColor = '#c6a75e')}
                      onBlur={(e) => (e.target.style.borderColor = '#e8dcc4')}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full font-bold text-sm flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: 'linear-gradient(135deg,#c6a75e 0%,#d4b96a 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '14px 0',
                    cursor: loading || !email ? 'not-allowed' : 'pointer',
                    opacity: loading || !email ? 0.65 : 1,
                    boxShadow: '0 4px 16px rgba(198,167,94,0.35)',
                    letterSpacing: '0.03em',
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {otpCopy.sending}
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      {otpCopy.sendCode}
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-xs mt-5" style={{ color: '#b0a080' }}>
                {otpCopy.footer}
              </p>
            </>
          )}

          {view === 'otp' && (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div className="text-center">
                <div
                  className="flex items-center justify-center mx-auto mb-4 rounded-full"
                  style={{ width: 64, height: 64, background: '#fffbf0', border: '1px solid #f0e4bc' }}
                >
                  <KeyRound className="w-8 h-8" style={{ color: '#c6a75e' }} />
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#4a3d28' }}>
                  {otpCopy.instruction}
                </p>
                <p className="text-sm font-semibold mt-1 break-all" style={{ color: '#1a1208' }}>{email}</p>
              </div>

              <div>
                <label
                  htmlFor="auth-otp"
                  className="block text-xs font-semibold mb-2 text-center"
                  style={{ color: '#6b5730', letterSpacing: '0.05em' }}
                >
                  {otpCopy.codeLabel}
                </label>
                <input
                  id="auth-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  disabled={loading}
                  autoFocus
                  className="w-full"
                  style={{
                    padding: '14px 12px',
                    borderRadius: 12,
                    border: '1.5px solid #e8dcc4',
                    background: '#fffdf8',
                    color: '#1a1208',
                    outline: 'none',
                    textAlign: 'center',
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: '0.35em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#c6a75e')}
                  onBlur={(e) => (e.target.style.borderColor = '#e8dcc4')}
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full font-bold text-sm flex items-center justify-center gap-2 transition-all"
                style={{
                  background: 'linear-gradient(135deg,#c6a75e 0%,#d4b96a 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px 0',
                  cursor: loading || otp.length !== 6 ? 'not-allowed' : 'pointer',
                  opacity: loading || otp.length !== 6 ? 0.65 : 1,
                  boxShadow: '0 4px 16px rgba(198,167,94,0.35)',
                  letterSpacing: '0.03em',
                }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {otpCopy.verifying}
                  </>
                ) : (
                  otpCopy.verify
                )}
              </button>

              <div className="text-center space-y-3">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-sm font-semibold"
                  style={{ color: '#c6a75e', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  {otpCopy.resend}
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setView('email-form');
                      setOtp('');
                      setError('');
                      setNotice('');
                    }}
                    disabled={loading}
                    className="text-sm font-semibold"
                    style={{ color: '#7a6340', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
                  >
                    {otpCopy.changeEmail}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes authModalIn {
          from { opacity: 0; transform: scale(0.93) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}