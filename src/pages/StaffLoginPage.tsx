import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, Loader2, Lock, LogOut, Package, Store } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

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
    resend: 'Resend code',
    changeEmail: 'Use a different email',
    invalidCode: 'Please enter the 6-digit verification code from your email.',
    expiredCode: 'That code is invalid or has expired. Please request a new code and try again.',
    unauthorized: 'This account does not have staff access.',
    unknownEmail: 'This email is not registered for staff access.',
    accessTitle: 'Staff Operations',
    accessSubtitle: 'Choose the desk you want to open.',
    pickupDesk: 'Pickup Desk',
    pickupDescription: 'Scan customer QR codes and manage scheduled pickups.',
    walkInDesk: 'Walk-In Desk',
    walkInDescription: 'Create and manage walk-in purchases.',
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
    resend: 'ส่งรหัสอีกครั้ง',
    changeEmail: 'ใช้อีเมลอื่น',
    invalidCode: 'กรุณากรอกรหัสยืนยัน 6 หลักจากอีเมลของคุณ',
    expiredCode: 'รหัสไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรหัสใหม่แล้วลองอีกครั้ง',
    unauthorized: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบพนักงาน',
    unknownEmail: 'อีเมลนี้ไม่ได้ลงทะเบียนสำหรับการเข้าถึงของพนักงาน',
    accessTitle: 'ระบบปฏิบัติงานพนักงาน',
    accessSubtitle: 'เลือกจุดปฏิบัติงานที่ต้องการเปิด',
    pickupDesk: 'จุดรับสินค้า',
    pickupDescription: 'สแกน QR ลูกค้าและจัดการการรับสินค้าตามกำหนด',
    walkInDesk: 'เคาน์เตอร์ Walk-In',
    walkInDescription: 'สร้างและจัดการรายการซื้อแบบ Walk-In',
    backHome: 'กลับหน้าแรก',
    signOut: 'ออกจากระบบ',
    useDifferentAccount: 'ใช้บัญชีอื่น',
  },
  zh: {
    title: '员工登录',
    subtitle: 'JOKO TODAY 运营访问',
    emailLabel: '员工邮箱',
    emailPlaceholder: 'name@example.com',
    sendCode: '发送验证码',
    sending: '正在发送验证码…',
    codeTitle: '输入验证码',
    codeInstruction: '我们已将 6 位验证码发送至',
    codeLabel: '验证码',
    verify: '验证并继续',
    verifying: '正在验证…',
    resend: '重新发送验证码',
    changeEmail: '使用其他邮箱',
    invalidCode: '请输入邮件中的 6 位验证码。',
    expiredCode: '验证码无效或已过期。请重新获取验证码后再试。',
    unauthorized: '此账户没有员工访问权限。',
    unknownEmail: '此邮箱未注册员工访问权限。',
    accessTitle: '员工运营',
    accessSubtitle: '请选择要打开的工作台。',
    pickupDesk: '取货工作台',
    pickupDescription: '扫描客户二维码并管理预约取货。',
    walkInDesk: '现场购买工作台',
    walkInDescription: '创建和管理现场购买。',
    backHome: '返回首页',
    signOut: '退出登录',
    useDifferentAccount: '使用其他账户',
  },
} as const;

export function StaffLoginPage({ onNavigate }: StaffLoginPageProps) {
  const { language } = useLanguage();
  const { user, userRole, profileLoading, sendEmailOtp, verifyEmailOtp, signOut } = useAuth();
  const text = copy[language];
  const hasStaffAccess = Boolean(user) && (userRole === 'staff' || userRole === 'admin');

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
  }, [user, email]);

  const handleSendCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await sendEmailOtp(email.trim(), language, false);
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

      if (profile.role !== 'staff' && profile.role !== 'admin') {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
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
                onNavigate('home');
              }}
              className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
            >
              <LogOut className="w-4 h-4" />
              {text.signOut}
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-8 py-8 text-center">
              <Lock className="w-12 h-12 text-white mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-white mb-2">{text.accessTitle}</h1>
              <p className="text-slate-300">{text.accessSubtitle}</p>
            </div>

            <div className="p-8 grid gap-4 md:grid-cols-2">
              <button
                onClick={() => onNavigate('pickup')}
                className="text-left border border-slate-200 rounded-xl p-6 hover:border-slate-400 hover:shadow-md transition-all"
              >
                <Package className="w-8 h-8 text-slate-700 mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">{text.pickupDesk}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{text.pickupDescription}</p>
              </button>

              <button
                onClick={() => onNavigate('walk-in')}
                className="text-left border border-slate-200 rounded-xl p-6 hover:border-slate-400 hover:shadow-md transition-all"
              >
                <Store className="w-8 h-8 text-slate-700 mb-4" />
                <h2 className="text-xl font-semibold text-slate-900 mb-2">{text.walkInDesk}</h2>
                <p className="text-sm text-slate-600 leading-relaxed">{text.walkInDescription}</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <button
        onClick={() => onNavigate('home')}
        className="absolute top-4 left-4 inline-flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        {text.backHome}
      </button>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-8 py-8 text-center">
          <Lock className="w-12 h-12 text-white mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">{text.title}</h1>
          <p className="text-slate-300">{text.subtitle}</p>
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
                className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900 transition-colors"
              >
                {text.useDifferentAccount}
              </button>
            </div>
          ) : !otpSent ? (
            <form onSubmit={handleSendCode} className="space-y-5">
              {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">{text.emailLabel}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={text.emailPlaceholder}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <KeyRound className="w-5 h-5" />}
                {loading ? text.sending : text.sendCode}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              {error && <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}
              <div className="text-center">
                <h2 className="text-xl font-semibold text-slate-900 mb-2">{text.codeTitle}</h2>
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
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-center text-2xl tracking-[0.35em] font-mono focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                      await sendEmailOtp(email.trim(), language, false);
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
