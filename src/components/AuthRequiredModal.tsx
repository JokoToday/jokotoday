import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mail, Loader2, CheckCircle, ShoppingBag, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';

interface AuthRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionType?: 'cart' | 'checkout';
  defaultLanguage?: 'en' | 'th' | 'zh';
}

type ModalView = 'landing' | 'email-form' | 'sent';
type AuthMode = 'signin' | 'signup';

const langOptions: { key: 'en' | 'th' | 'zh'; label: string }[] = [
  { key: 'en', label: 'EN' },
  { key: 'th', label: 'TH' },
  { key: 'zh', label: '中文' },
];

export function AuthRequiredModal({
  isOpen,
  onClose,
  actionType = 'cart',
  defaultLanguage,
}: AuthRequiredModalProps) {
  const { signInWithMagicLink } = useAuth();
  const { language: globalLanguage, setLanguage: setGlobalLanguage } = useLanguage();
  const { getLabel, loading: labelsLoading } = useCMSLabels();

  const [localLanguage, setLocalLanguage] = useState<'en' | 'th' | 'zh'>(
    defaultLanguage ?? globalLanguage
  );
  const [view, setView] = useState<ModalView>('landing');
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const backdropRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const lang = localLanguage;

  const g = useCallback(
    (key: string, fallback: string) => getLabel(`auth_required_modal.${key}`, lang, fallback),
    [getLabel, lang]
  );

  useEffect(() => {
    if (!isOpen) return;
    setView('landing');
    setEmail('');
    setError('');
    setLoading(false);
  }, [isOpen]);

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

  const handleLanguageChange = (l: 'en' | 'th' | 'zh') => {
    setLocalLanguage(l);
    setGlobalLanguage(l);
  };

  const handleOpenEmailForm = (mode: AuthMode) => {
    setAuthMode(mode);
    setError('');
    setView('email-form');
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError('');
    setLoading(true);
    try {
      await signInWithMagicLink(email);
      setView('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
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
        {/* Gold top accent bar */}
        <div style={{ height: 4, background: 'linear-gradient(90deg,#c6a75e 0%,#e8c97a 50%,#c6a75e 100%)' }} />

        {/* Header */}
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
                {g('title', 'Sign In to Continue')}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0" style={{ marginTop: 2 }}>
            {/* Language toggle */}
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

            {/* Close button */}
            <button
              onClick={handleClose}
              className="transition-colors rounded-full flex items-center justify-center"
              style={{ width: 32, height: 32, background: '#f5f0e8', border: 'none', cursor: 'pointer' }}
              aria-label="Close"
            >
              <X className="w-4 h-4" style={{ color: '#9c8460' }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 pt-5 pb-8">
          {/* LANDING VIEW */}
          {view === 'landing' && (
            <>
              <p className="text-sm leading-relaxed" style={{ color: '#4a3d28', marginBottom: 20 }}>
                {g('body', 'To place an order at JOKO TODAY, please sign in or create an account.')}
              </p>

              {/* Benefits */}
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

              {/* Primary button */}
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

              {/* Secondary button */}
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
                {g('footer_text', 'You will receive a secure Magic Link via email.')}
              </p>
            </>
          )}

          {/* EMAIL FORM VIEW */}
          {view === 'email-form' && (
            <>
              <button
                onClick={() => { setView('landing'); setError(''); }}
                className="flex items-center gap-1 text-xs font-semibold mb-5 transition-colors"
                style={{ color: '#c6a75e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                ← {g('back_button', 'Back')}
              </button>

              <p className="text-sm leading-relaxed mb-5" style={{ color: '#4a3d28' }}>
                {authMode === 'signup'
                  ? g('body', 'To place an order at JOKO TODAY, please sign in or create an account.')
                  : g('body', 'To place an order at JOKO TODAY, please sign in or create an account.')}
              </p>

              {error && (
                <div
                  className="rounded-xl text-sm mb-4"
                  style={{ background: '#fff1f0', border: '1px solid #fca5a5', color: '#dc2626', padding: '12px 14px' }}
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSendLink} className="space-y-4">
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
                      {g('sending_label', 'Sending…')}
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      {authMode === 'signup'
                        ? g('create_account_button', 'Create Account')
                        : g('send_link_button', 'Send Magic Link')}
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-xs mt-5" style={{ color: '#b0a080' }}>
                {g('footer_text', 'You will receive a secure Magic Link via email.')}
              </p>
            </>
          )}

          {/* EMAIL SENT VIEW */}
          {view === 'sent' && (
            <div className="text-center py-4">
              <div
                className="flex items-center justify-center mx-auto mb-5 rounded-full"
                style={{ width: 64, height: 64, background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)' }}
              >
                <CheckCircle className="w-8 h-8" style={{ color: '#059669' }} />
              </div>
              <h3 className="font-bold text-lg mb-2" style={{ color: '#1a1208' }}>
                {g('email_sent_title', 'Check your inbox')}
              </h3>
              <p className="text-sm leading-relaxed mb-2" style={{ color: '#4a3d28' }}>
                {g('email_sent_body', 'We sent a secure sign-in link to your email address. Click the link to continue.')}
              </p>
              <p className="text-xs font-mono mt-3" style={{ color: '#c6a75e', background: '#fffbf0', borderRadius: 8, padding: '6px 12px', display: 'inline-block' }}>
                {email}
              </p>
              <div className="mt-6">
                <button
                  onClick={handleClose}
                  className="text-sm font-semibold transition-colors"
                  style={{ color: '#c6a75e', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  {lang === 'th' ? 'ปิด' : lang === 'zh' ? '关闭' : 'Close'}
                </button>
              </div>
            </div>
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
