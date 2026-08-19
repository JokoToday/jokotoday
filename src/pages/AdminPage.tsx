import { FormEvent, ReactNode, useState } from 'react';
import { AlertCircle, KeyRound, Loader2, Lock, LogOut, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { resetAdminAuthentication, setAdminAuthenticated } from '../lib/adminConfig';
import { AdminPage as AdminCmsPage } from './AdminCmsPage';

interface AdminPageProps {
  onNavigate: (page: string) => void;
}

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
      setNotice('Verification code sent.');
    } catch (err) {
      console.error('Admin OTP request failed:', err);
      setError('Could not send a verification code. Use an existing JOKO TODAY account and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit verification code from your email.');
      return;
    }

    setSubmitting(true);
    try {
      await verifyEmailOtp(email.trim(), otp);
    } catch (err) {
      console.error('Admin OTP verification failed:', err);
      setError('That verification code is invalid or has expired. Request a fresh code and try again.');
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
      setNotice('A fresh verification code has been sent.');
    } catch (err) {
      console.error('Admin OTP resend failed:', err);
      setError('Could not send a fresh verification code. Please try again.');
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
    return <AdminGateStatus message="Verifying admin session…" />;
  }

  if (user && userRole === 'admin') {
    setAdminAuthenticated();
    return <AdminCmsPage onNavigate={onNavigate} />;
  }

  resetAdminAuthentication();

  if (user) {
    return (
      <AdminGateShell>
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 p-4 rounded-full">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Admin Access Denied</h1>
        <p className="text-center text-gray-600 text-sm mb-3">
          This account is signed in, but it does not have the admin role.
        </p>
        <p className="text-center text-sm font-medium text-gray-800 mb-6 break-all">
          {user.email || 'Signed-in account'}
        </p>
        <button
          type="button"
          onClick={() => void handleUseAnotherAccount()}
          className="w-full bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign out & use another account
        </button>
      </AdminGateShell>
    );
  }

  return (
    <AdminGateShell>
      <div className="flex justify-center mb-6">
        <div className="bg-primary-100 p-4 rounded-full">
          <ShieldCheck className="w-8 h-8 text-primary-600" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">JOKO TODAY Admin</h1>
      <p className="text-center text-gray-600 text-sm mb-6">
        Sign in with an authorized admin email. New accounts cannot be created from this screen.
      </p>

      {!otpSent ? (
        <form onSubmit={handleSendCode} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Admin email</span>
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
            {submitting ? 'Sending…' : 'Send verification code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
            A 6-digit verification code was sent to <strong>{email}</strong>.
          </div>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Verification code</span>
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
            {submitting ? 'Verifying…' : 'Verify & enter admin'}
          </button>
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={submitting}
              className="font-medium text-primary-700 hover:text-primary-800 disabled:text-gray-400"
            >
              Send a fresh code
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
              Change email
            </button>
          </div>
        </form>
      )}
    </AdminGateShell>
  );
}

function AdminGateShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">{children}</div>
      </div>
    </div>
  );
}

function AdminGateStatus({ message }: { message: string }) {
  return (
    <AdminGateShell>
      <div className="flex flex-col items-center gap-3 py-4 text-slate-700">
        <Loader2 className="w-7 h-7 animate-spin text-primary-600" />
        <p className="font-medium">{message}</p>
      </div>
    </AdminGateShell>
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
