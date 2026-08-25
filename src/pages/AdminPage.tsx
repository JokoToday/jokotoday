import { FormEvent, ReactNode, useState } from 'react';
import { AlertCircle, KeyRound, Loader2, Lock, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { resetAdminAuthentication, setAdminAuthenticated } from '../lib/adminConfig';
import { AdminWorkspace } from '../components/AdminWorkspace';

interface AdminPageProps {
  onNavigate: (page: string) => void;
}

type AdminLanguage = 'en' | 'th';

const adminCopy = {
  en: {
    title: 'JOKO TODAY Admin',
    intro: 'Sign in with an authorized admin email. New accounts cannot be created from this screen.',
    adminEmail: 'Admin email',
    sendCode: 'Send verification code',
    sending: 'Sending…',
    codeSent: 'Verification code sent.',
    sendFailed: 'Could not send a verification code. Use an existing JOKO TODAY account and try again.',
    otpInstruction: 'A 6-digit verification code was sent to',
    verificationCode: 'Verification code',
    verify: 'Verify & enter admin',
    verifying: 'Verifying…',
    invalidCode: 'Enter the 6-digit verification code from your email.',
    expiredCode: 'That verification code is invalid or has expired. Request a fresh code and try again.',
    resend: 'Send a fresh code',
    resent: 'A fresh verification code has been sent.',
    resendFailed: 'Could not send a fresh verification code. Please try again.',
    changeEmail: 'Change email',
    checkingSession: 'Verifying admin session…',
    accessDenied: 'Admin Access Denied',
    accessDeniedBody: 'This account is signed in, but it does not have the admin role.',
    signedInAccount: 'Signed-in account',
    useAnother: 'Sign out & use another account',
  },
  th: {
    title: 'JOKO TODAY Admin',
    intro: 'เข้าสู่ระบบด้วยอีเมลผู้ดูแลระบบที่ได้รับอนุญาต ไม่สามารถสร้างบัญชีใหม่จากหน้านี้ได้',
    adminEmail: 'อีเมลผู้ดูแลระบบ',
    sendCode: 'ส่งรหัสยืนยัน',
    sending: 'กำลังส่ง…',
    codeSent: 'ส่งรหัสยืนยันแล้ว',
    sendFailed: 'ไม่สามารถส่งรหัสยืนยันได้ กรุณาใช้อีเมลของบัญชี JOKO TODAY ที่มีอยู่แล้วและลองอีกครั้ง',
    otpInstruction: 'เราได้ส่งรหัสยืนยัน 6 หลักไปที่',
    verificationCode: 'รหัสยืนยัน',
    verify: 'ยืนยันและเข้าสู่ระบบผู้ดูแล',
    verifying: 'กำลังตรวจสอบ…',
    invalidCode: 'กรุณากรอกรหัสยืนยัน 6 หลักจากอีเมลของคุณ',
    expiredCode: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรหัสใหม่แล้วลองอีกครั้ง',
    resend: 'ส่งรหัสใหม่',
    resent: 'ส่งรหัสยืนยันใหม่แล้ว',
    resendFailed: 'ไม่สามารถส่งรหัสยืนยันใหม่ได้ กรุณาลองอีกครั้ง',
    changeEmail: 'เปลี่ยนอีเมล',
    checkingSession: 'กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ…',
    accessDenied: 'ไม่อนุญาตให้เข้าถึงระบบผู้ดูแล',
    accessDeniedBody: 'บัญชีนี้เข้าสู่ระบบแล้ว แต่ไม่มีสิทธิ์ผู้ดูแลระบบ',
    signedInAccount: 'บัญชีที่เข้าสู่ระบบ',
    useAnother: 'ออกจากระบบและใช้บัญชีอื่น',
  },
} as const;

export function AdminPage({ onNavigate }: AdminPageProps) {
  const {
    user,
    loading,
    userRole,
    profileLoading,
    sendEmailOtp,
    verifyEmailOtp,
    signOut,
  } = useAuth();
  const { language, setLanguage } = useLanguage();
  const adminLanguage: AdminLanguage = language === 'th' ? 'th' : 'en';
  const copy = adminCopy[adminLanguage];
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSendCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);

    try {
      await sendEmailOtp(email.trim(), undefined, false);
      setOtp('');
      setOtpSent(true);
      setNotice(copy.codeSent);
    } catch (err) {
      console.error('Admin OTP request failed:', err);
      setError(copy.sendFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!/^\d{6}$/.test(otp)) {
      setError(copy.invalidCode);
      return;
    }

    setSubmitting(true);
    try {
      await verifyEmailOtp(email.trim(), otp);
    } catch (err) {
      console.error('Admin OTP verification failed:', err);
      setError(copy.expiredCode);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      await sendEmailOtp(email.trim(), undefined, false);
      setOtp('');
      setNotice(copy.resent);
    } catch (err) {
      console.error('Admin OTP resend failed:', err);
      setError(copy.resendFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseAnotherAccount = async () => {
    resetAdminAuthentication();
    await signOut();
    setEmail('');
    setOtp('');
    setOtpSent(false);
    setError('');
    setNotice('');
  };

  if (loading || (user && profileLoading)) {
    resetAdminAuthentication();
    return (
      <AdminGateShell language={adminLanguage} onLanguageChange={setLanguage}>
        <AdminGateStatus message={copy.checkingSession} />
      </AdminGateShell>
    );
  }

  if (user && userRole === 'admin') {
    setAdminAuthenticated();
    return <AdminWorkspace onNavigate={onNavigate} />;
  }

  resetAdminAuthentication();

  if (user) {
    return (
      <AdminGateShell language={adminLanguage} onLanguageChange={setLanguage}>
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 p-4 rounded-full">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">{copy.accessDenied}</h1>
        <p className="text-center text-gray-600 text-sm mb-3">{copy.accessDeniedBody}</p>
        <p className="text-center text-sm font-medium text-gray-800 mb-6 break-all">
          {user.email || copy.signedInAccount}
        </p>
        <button
          type="button"
          onClick={() => void handleUseAnotherAccount()}
          className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          {copy.useAnother}
        </button>
      </AdminGateShell>
    );
  }

  return (
    <AdminGateShell language={adminLanguage} onLanguageChange={setLanguage}>
      <div className="flex justify-center mb-6">
        <div className="bg-primary-100 p-4 rounded-full">
          <ShieldCheck className="w-8 h-8 text-primary-600" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">{copy.title}</h1>
      <p className="text-center text-gray-600 text-sm mb-6">{copy.intro}</p>

      {!otpSent ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{copy.adminEmail}</span>
            <div className="mt-1 relative">
              <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                placeholder="name@example.com"
                autoComplete="email"
                required
                disabled={submitting}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </label>
          <AdminGateMessages error={error} notice={notice} />
          <button
            type="submit"
            disabled={submitting || !email.trim()}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            {submitting ? copy.sending : copy.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
            {copy.otpInstruction} <strong>{email}</strong>
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">{copy.verificationCode}</span>
            <div className="mt-1 relative">
              <KeyRound className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                placeholder="000000"
                maxLength={6}
                required
                disabled={submitting}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-center tracking-[0.35em] font-semibold focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </label>
          <AdminGateMessages error={error} notice={notice} />
          <button
            type="submit"
            disabled={submitting || otp.length !== 6}
            className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {submitting ? copy.verifying : copy.verify}
          </button>
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={submitting}
              className="font-medium text-primary-700 hover:text-primary-800 disabled:text-gray-400"
            >
              {copy.resend}
            </button>
            <button
              type="button"
              onClick={() => {
                setOtpSent(false);
                setOtp('');
                setError('');
                setNotice('');
              }}
              disabled={submitting}
              className="font-medium text-slate-600 hover:text-slate-800 disabled:text-gray-400"
            >
              {copy.changeEmail}
            </button>
          </div>
        </form>
      )}
    </AdminGateShell>
  );
}

function AdminGateShell({
  children,
  language,
  onLanguageChange,
}: {
  children: ReactNode;
  language: AdminLanguage;
  onLanguageChange: (language: 'en' | 'th') => void;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex justify-end mb-4" aria-label="Admin language">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm font-medium">
              <button
                type="button"
                onClick={() => onLanguageChange('en')}
                aria-pressed={language === 'en'}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  language === 'en' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onLanguageChange('th')}
                aria-pressed={language === 'th'}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  language === 'th' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                ไทย
              </button>
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function AdminGateStatus({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-slate-700">
      <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
      <p className="font-medium">{message}</p>
    </div>
  );
}

function AdminGateMessages({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {notice && !error && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {notice}
        </div>
      )}
    </>
  );
}
