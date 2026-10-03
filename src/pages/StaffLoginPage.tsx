import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Loader2, Lock, LogOut, Package, PackageSearch, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { useInternalJokoBranding } from '../app/joko-today/internal/useInternalJokoBranding';
import '../app/joko-today/admin/jokoAdmin.css';

interface StaffLoginPageProps {
  onNavigate: (page: string) => void;
}

const copy = {
  en: {
    title: 'Staff Login',
    subtitle: 'JOKO TODAY operations access',
    emailLabel: 'Staff email',
    emailPlaceholder: 'name@example.com',
    sendCode: 'Send verification code',
    sending: 'Sending code…',
    codeTitle: 'Enter verification code',
    codeInstruction: 'We sent a 6-digit code to',
    codeLabel: 'Verification code',
    verify: 'Verify & Continue',
    verifying: 'Verifying…',
    resend: 'Send me a fresh code',
    changeEmail: 'Use a different email',
    invalidCode: 'Please enter the 6-digit verification code from your email.',
    expiredCode: 'Oops — that code has had its moment. Grab a fresh one and try again.',
    unauthorized: 'This account does not have staff access.',
    unknownEmail: 'This email is not registered for staff access.',
    accessTitle: 'Staff Operations',
    accessSubtitle: 'Choose the desk you want to open.',
    pickupDesk: 'Pickup Desk',
    pickupDescription: 'Scan customer QR codes and manage scheduled pickups.',
    walkInDesk: 'Walk-In Desk',
    walkInDescription: 'Create and manage walk-in purchases.',
    productStaff: 'Product Staff',
    productStaffDescription: 'Update product content, pricing, images and availability.',
    backHome: 'Back to Home',
    signOut: 'Sign Out',
    useDifferentAccount: 'Use a different account',
  },
  th: {
    title: 'เข้าสู่ระบบพนักงาน',
    subtitle: 'การเข้าถึงระบบปฏิบัติงาน JOKO TODAY',
    emailLabel: 'อีเมลพนักงาน',
    emailPlaceholder: 'name@example.com',
    sendCode: 'ส่งรหัสยืนยัน',
    sending: 'กำลังส่งรหัส…',
    codeTitle: 'กรอกรหัสยืนยัน',
    codeInstruction: 'เราได้ส่งรหัส 6 หลักไปที่',
    codeLabel: 'รหัสยืนยัน',
    verify: 'ยืนยันและดำเนินการต่อ',
    verifying: 'กำลังตรวจสอบ…',
    resend: 'ส่งรหัสใหม่ให้หน่อย',
    changeEmail: 'ใช้อีเมลอื่น',
    invalidCode: 'กรุณากรอกรหัสยืนยัน 6 หลักจากอีเมลของคุณ',
    expiredCode: 'อุ๊ปส์ — รหัสนี้หมดเวลาของมันแล้ว ขอรหัสใหม่แล้วลองอีกครั้งนะ',
    unauthorized: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบพนักงาน',
    unknownEmail: 'อีเมลนี้ไม่ได้ลงทะเบียนสำหรับการเข้าถึงของพนักงาน',
    accessTitle: 'ระบบปฏิบัติงานพนักงาน',
    accessSubtitle: 'เลือกจุดปฏิบัติงานที่ต้องการเปิด',
    pickupDesk: 'จุดรับสินค้า',
    pickupDescription: 'สแกน QR ลูกค้าและจัดการการรับสินค้าตามกำหนด',
    walkInDesk: 'เคาน์เตอร์ Walk-In',
    walkInDescription: 'สร้างและจัดการรายการซื้อแบบ Walk-In',
    productStaff: 'จัดการสินค้า',
    productStaffDescription: 'อัปเดตข้อมูลสินค้า ราคา รูปภาพ และความพร้อมจำหน่าย',
    backHome: 'กลับหน้าแรก',
    signOut: 'ออกจากระบบ',
    useDifferentAccount: 'ใช้บัญชีอื่น',
  },
} as const;

function getSafeReturnPath(): string | null {
  const returnPath = new URLSearchParams(window.location.search).get('return');
  if (!returnPath) return null;
  return /^\/(?:pickup|walk-in)(?:\?member=VIP\d+)?$/i.test(returnPath)
    ? returnPath
    : null;
}

export function StaffLoginPage({ onNavigate }: StaffLoginPageProps) {
  const { language, setLanguage } = useLanguage();
  const { logoUrl, brandingStyle } = useInternalJokoBranding();
  const staffLanguage = language === 'th' ? 'th' : 'en';
  const { user, userRole, profileLoading, sendEmailOtp, verifyEmailOtp, signOut } = useAuth();
  const text = copy[staffLanguage];
  const hasStaffAccess = Boolean(user) && (
    userRole === 'staff' || userRole === 'product_staff' || userRole === 'admin'
  );
  const canUseOperations = userRole === 'staff' || userRole === 'admin';
  const canUseProductStaff = userRole === 'product_staff' || userRole === 'admin';

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const displayedError = error === copy.en.expiredCode || error === copy.th.expiredCode
    ? text.expiredCode
    : error;

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);

  useEffect(() => {
    if (!hasStaffAccess || !canUseOperations) return;
    const returnPath = getSafeReturnPath();
    if (!returnPath) return;
    window.location.replace(returnPath);
  }, [hasStaffAccess, canUseOperations]);

  const languageSwitch = (
    <div className="inline-flex rounded-lg border border-[#55766F]/15 bg-[#FFF9EE]/80 p-1" aria-label="Language">
      {(['en', 'th'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLanguage(option)}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
            staffLanguage === option
              ? 'bg-[#55766F] text-white'
              : 'text-[#3F665E] hover:bg-[#CFE3DF]/50'
          }`}
          aria-pressed={staffLanguage === option}
        >
          {option === 'en' ? 'EN' : 'ไทย'}
        </button>
      ))}
    </div>
  );

  const handleSendCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await sendEmailOtp(email.trim(), staffLanguage, false);
      setOtp('');
      setOtpSent(true);
    } catch (err) {
      console.error('Staff OTP request failed:', err);
      setError(text.unknownEmail);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!/^\d{6}$/.test(otp)) {
      setError(text.invalidCode);
      return;
    }

    setLoading(true);
    try {
      await verifyEmailOtp(email.trim(), otp);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw userError ?? new Error('No authenticated user');

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', userData.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role !== 'staff' && profile.role !== 'product_staff' && profile.role !== 'admin') {
        await signOut();
        setOtp('');
        setOtpSent(false);
        setError(text.unauthorized);
      }
    } catch (err) {
      console.error('Staff OTP verification failed:', err);
      setError(text.expiredCode);
    } finally {
      setLoading(false);
    }
  };

  const handleUseDifferentAccount = async () => {
    if (user) await signOut();
    setEmail('');
    setOtp('');
    setOtpSent(false);
    setError('');
  };

  if (hasStaffAccess) {
    return (
      <div className="joko-admin-shell min-h-screen p-4" style={brandingStyle}>
        <div className="max-w-3xl mx-auto py-10">
          <div className="flex items-center justify-between gap-4 mb-8">
            <button
              onClick={() => onNavigate('home')}
              className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              {text.backHome}
            </button>
            <button
              onClick={async () => {
                await signOut();
                onNavigate('staff');
              }}
              className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
            >
              <LogOut className="w-4 h-4" />
              {text.signOut}
            </button>
          </div>

          <div className="joko-admin-paper-card overflow-hidden">
            <div className="relative border-b border-[#55766F]/15 bg-[#CFE3DF]/70 px-8 py-8 text-center">
              <div className="absolute right-4 top-4">{languageSwitch}</div>
              <img src={logoUrl} alt="JOKO TODAY" className="joko-admin-brand-logo mx-auto mb-5" />
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF9EE]/80 text-[#55766F]">
                <Lock className="h-6 w-6" />
              </div>
              <h1 className="joko-admin-title mb-2 text-3xl font-semibold">{text.accessTitle}</h1>
              <p className="text-[#303532]/65">{text.accessSubtitle}</p>
            </div>

            <div className="p-8 grid gap-4 md:grid-cols-3">
              {canUseOperations && (
                <button
                  onClick={() => onNavigate('pickup')}
                  className="rounded-xl border border-[#55766F]/15 bg-[#FFF9EE]/75 p-6 text-left transition-all hover:border-[#55766F]/35 hover:shadow-md"
                >
                  <Package className="mb-4 h-8 w-8 text-[#55766F]" />
                  <h2 className="joko-admin-title mb-2 text-xl font-semibold">{text.pickupDesk}</h2>
                  <p className="text-sm leading-relaxed text-[#303532]/65">{text.pickupDescription}</p>
                </button>
              )}

              {canUseOperations && (
                <button
                  onClick={() => onNavigate('walk-in')}
                  className="rounded-xl border border-[#55766F]/15 bg-[#FFF9EE]/75 p-6 text-left transition-all hover:border-[#55766F]/35 hover:shadow-md"
                >
                  <Store className="mb-4 h-8 w-8 text-[#55766F]" />
                  <h2 className="joko-admin-title mb-2 text-xl font-semibold">{text.walkInDesk}</h2>
                  <p className="text-sm leading-relaxed text-[#303532]/65">{text.walkInDescription}</p>
                </button>
              )}

              {canUseProductStaff && (
                <button
                  onClick={() => onNavigate('product-staff')}
                  className="rounded-xl border border-[#55766F]/15 bg-[#FFF9EE]/75 p-6 text-left transition-all hover:border-[#55766F]/35 hover:shadow-md"
                >
                  <PackageSearch className="mb-4 h-8 w-8 text-[#55766F]" />
                  <h2 className="joko-admin-title mb-2 text-xl font-semibold">{text.productStaff}</h2>
                  <p className="text-sm leading-relaxed text-[#303532]/65">{text.productStaffDescription}</p>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="joko-admin-shell flex min-h-screen items-center justify-center p-4" style={brandingStyle}>
      <button
        onClick={() => onNavigate('home')}
        className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-[#FFF9EE]/75 px-4 py-2 font-medium text-[#3F665E] transition hover:bg-[#FFF9EE]"
      >
        <ArrowLeft className="w-4 h-4" />
        {text.backHome}
      </button>

      <div className="joko-admin-paper-card w-full max-w-md overflow-hidden">
        <div className="relative border-b border-[#55766F]/15 bg-[#CFE3DF]/70 px-8 py-8 text-center">
          <div className="absolute right-4 top-4">{languageSwitch}</div>
          <img src={logoUrl} alt="JOKO TODAY" className="joko-admin-brand-logo mx-auto mb-5" />
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF9EE]/80 text-[#55766F]">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="joko-admin-title mb-2 text-3xl font-semibold">{text.title}</h1>
          <p className="text-[#303532]/65">{text.subtitle}</p>
        </div>

        <div className="p-8">
          {profileLoading && user ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-7 h-7 animate-spin text-slate-600" />
            </div>
          ) : user && !hasStaffAccess ? (
            <div className="space-y-5">
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {text.unauthorized}
              </div>
              <button
                onClick={handleUseDifferentAccount}
                className="joko-admin-primary-button w-full py-3"
              >
                {text.useDifferentAccount}
              </button>
            </div>
          ) : !otpSent ? (
            <form onSubmit={handleSendCode} className="space-y-5">
              {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{displayedError}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{text.emailLabel}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={text.emailPlaceholder}
                  required
                  autoComplete="email"
                  className="joko-admin-login-field w-full px-4 py-3 outline-none focus:ring-2 focus:ring-[#55766F]/30"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="joko-admin-primary-button flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
                {loading ? text.sending : text.sendCode}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{displayedError}</div>}
              <div className="text-center">
                <h2 className="joko-admin-title mb-2 text-xl font-semibold">{text.codeTitle}</h2>
                <p className="text-sm text-slate-600">{text.codeInstruction}</p>
                <p className="text-sm font-semibold text-slate-900 mt-1">{email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{text.codeLabel}</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  className="joko-admin-login-field w-full px-4 py-3 text-center font-mono text-2xl tracking-[0.35em] outline-none focus:ring-2 focus:ring-[#55766F]/30"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="joko-admin-primary-button flex w-full items-center justify-center gap-2 py-3 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? text.verifying : text.verify}
              </button>
              <div className="flex justify-between gap-4 text-sm">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setOtp('');
                    setOtpSent(false);
                    setError('');
                  }}
                  className="text-slate-600 hover:text-slate-900"
                >
                  {text.changeEmail}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    setError('');
                    setLoading(true);
                    try {
                      await sendEmailOtp(email.trim(), staffLanguage, false);
                      setOtp('');
                    } catch {
                      setError(text.unknownEmail);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="text-slate-600 hover:text-slate-900"
                >
                  {text.resend}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
