import React, { useState, useRef } from 'react';
import { X, Mail, QrCode, Upload, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { QRScanner } from './QRScanner';
import jsQR from 'jsqr';
import { normalizeQrLoginTarget } from '../lib/qrNavigation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAction?: 'signin' | 'signup';
}

type AuthAction = 'signin' | 'signup';

const QR_AUTH_ACTION_BUTTON_CLASS =
  'w-full border-2 border-slate-800 bg-white text-slate-800 py-3.5 rounded-xl font-semibold hover:border-slate-800 hover:bg-slate-800 hover:text-white hover:shadow-md active:bg-slate-900 focus-visible:border-slate-800 focus-visible:bg-slate-800 focus-visible:text-white focus-visible:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-800 focus-visible:ring-offset-2 transition-colors transition-shadow duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-800 disabled:hover:shadow-none flex items-center justify-center gap-2.5';

const qrAuthText = {
  en: {
    validating: 'Validating your QR code…',
    invalid: "Hmm, we couldn't recognize that QR code. Please try again or log in with email.",
    imageInvalid: 'We could not find a valid QR code in that image. Please choose another image.',
  },
  th: {
    validating: 'กำลังตรวจสอบคิวอาร์โค้ด…',
    invalid: 'ขออภัย เราไม่สามารถตรวจสอบคิวอาร์โค้ดนี้ได้ โปรดลองอีกครั้งหรือเข้าสู่ระบบด้วยอีเมล',
    imageInvalid: 'ไม่พบคิวอาร์โค้ดที่ถูกต้องในรูปภาพนี้ กรุณาเลือกรูปภาพอื่น',
  },
  zh: {
    validating: '正在验证二维码…',
    invalid: '抱歉，我们无法识别此二维码。请重试或使用电子邮件登录。',
    imageInvalid: '无法在该图片中找到有效的二维码。请选择其他图片。',
  },
};

const otpAuthText = {
  en: {
    sendCode: 'Send verification code',
    sending: 'Sending code…',
    title: 'Enter verification code',
    instruction: 'We sent a 6-digit code to',
    codeLabel: 'Verification code',
    codePlaceholder: '000000',
    verify: 'Verify & Sign In',
    verifying: 'Verifying…',
    invalidCode: 'Please enter the 6-digit verification code from your email.',
    expiredCode: 'Oops — that code has had its moment. Grab a fresh one and try again.',
    resend: 'Send me a fresh code',
    resent: 'A new verification code has been sent.',
    changeEmail: 'Use a different email',
  },
  th: {
    sendCode: 'ส่งรหัสยืนยัน',
    sending: 'กำลังส่งรหัส…',
    title: 'กรอกรหัสยืนยัน',
    instruction: 'เราได้ส่งรหัส 6 หลักไปที่',
    codeLabel: 'รหัสยืนยัน',
    codePlaceholder: '000000',
    verify: 'ยืนยันและเข้าสู่ระบบ',
    verifying: 'กำลังตรวจสอบ…',
    invalidCode: 'กรุณากรอกรหัสยืนยัน 6 หลักจากอีเมลของคุณ',
    expiredCode: 'อุ๊ปส์ — รหัสนี้หมดเวลาของมันแล้ว ขอรหัสใหม่แล้วลองอีกครั้งนะ',
    resend: 'ส่งรหัสใหม่ให้หน่อย',
    resent: 'ส่งรหัสยืนยันใหม่แล้ว',
    changeEmail: 'ใช้อีเมลอื่น',
  },
  zh: {
    sendCode: '发送验证码',
    sending: '正在发送验证码…',
    title: '输入验证码',
    instruction: '我们已将 6 位验证码发送至',
    codeLabel: '验证码',
    codePlaceholder: '000000',
    verify: '验证并登录',
    verifying: '正在验证…',
    invalidCode: '请输入邮件中的 6 位验证码。',
    expiredCode: '哎呀，这个验证码已经过了有效时间。重新获取一个新的，再试一次吧。',
    resend: '给我发一个新验证码',
    resent: '新的验证码已发送。',
    changeEmail: '使用其他邮箱',
  },
};

export function AuthModal({ isOpen, onClose, initialAction = 'signin' }: AuthModalProps) {
  const { sendEmailOtp, verifyEmailOtp } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [action, setAction] = useState<AuthAction>(initialAction);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrProcessing, setQrProcessing] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const qrCopy = qrAuthText[language];
  const otpCopy = otpAuthText[language];
  const displayedError = Object.values(otpAuthText).some((copy) => error === copy.expiredCode)
    ? otpCopy.expiredCode
    : Object.values(otpAuthText).some((copy) => error === copy.invalidCode)
      ? otpCopy.invalidCode
      : error;

  const handleClose = () => {
    setEmail('');
    setOtp('');
    setError('');
    setNotice('');
    setAction('signin');
    setOtpSent(false);
    setLoading(false);
    setQrProcessing(false);
    onClose();
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setQrProcessing(false);
    setLoading(true);

    try {
      await sendEmailOtp(email.trim());
      setOtp('');
      setOtpSent(true);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Invalid email')) {
          setError(t.auth.errorInvalidEmail);
        } else {
          setError(err.message || t.auth.errorGeneric);
        }
      } else {
        setError(t.auth.errorGeneric);
      }
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
      await sendEmailOtp(email.trim());
      setOtp('');
      setNotice(otpCopy.resent);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message || t.auth.errorGeneric);
      } else {
        setError(t.auth.errorGeneric);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQrResult = async (rawValue: string) => {
    setError('');
    setQrProcessing(true);
    setLoading(true);

    try {
      const target = normalizeQrLoginTarget(
        rawValue,
        window.location.origin
      );
      window.location.href = target;
    } catch (err) {
      console.error('QR result validation failed:', err);
      setError(qrCopy.invalid);
      setQrProcessing(false);
      setLoading(false);
    }
  };

  const handleQRScan = async (decodedText: string) => {
    setShowQRScanner(false);
    await handleQrResult(decodedText);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setQrProcessing(true);
    setLoading(true);

    try {
      const image = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        image.onload = async () => {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) {
            setError(qrCopy.imageInvalid);
            setQrProcessing(false);
            setLoading(false);
            return;
          }

          canvas.width = image.width;
          canvas.height = image.height;
          context.drawImage(image, 0, 0);

          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code && code.data) {
            await handleQrResult(code.data);
          } else {
            setError(qrCopy.imageInvalid);
            setQrProcessing(false);
            setLoading(false);
          }
        };

        image.src = e.target?.result as string;
      };

      reader.onerror = () => {
        setError(qrCopy.imageInvalid);
        setQrProcessing(false);
        setLoading(false);
      };

      reader.readAsDataURL(file);
    } catch {
      setError(qrCopy.imageInvalid);
      setQrProcessing(false);
      setLoading(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const langOptions: { key: 'en' | 'th' | 'zh'; label: string }[] = [
    { key: 'en', label: 'EN' },
    { key: 'th', label: 'TH' },
    { key: 'zh', label: '中文' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md sm:w-full max-h-[90vh] overflow-y-auto"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {otpSent ? otpCopy.title : action === 'signup' ? t.auth.signUpTitle : t.auth.signInTitle}
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
              {langOptions.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setLanguage(opt.key)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    language === opt.key
                      ? 'bg-amber-600 text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              disabled={loading}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {displayedError}
            </div>
          )}

          {notice && (
            <div className="mb-5 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
              {notice}
            </div>
          )}

          {otpSent ? (
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <KeyRound className="w-8 h-8 text-amber-600" />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {otpCopy.instruction}
                </p>
                <p className="text-sm font-semibold text-gray-900 mt-1 break-all">{email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  {otpCopy.codeLabel}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={otpCopy.codePlaceholder}
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900 text-center text-3xl font-semibold tracking-[0.45em] tabular-nums placeholder:text-gray-300 transition-shadow"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  aria-label={otpCopy.codeLabel}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-amber-600 text-white py-3.5 rounded-xl font-semibold hover:bg-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {otpCopy.verifying}
                  </>
                ) : (
                  otpCopy.verify
                )}
              </button>

              <div className="text-center space-y-3 pt-1">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-sm text-amber-600 hover:text-amber-700 font-semibold disabled:opacity-50"
                >
                  {otpCopy.resend}
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp('');
                      setError('');
                      setNotice('');
                    }}
                    disabled={loading}
                    className="text-sm text-gray-500 hover:text-gray-700 font-medium disabled:opacity-50"
                  >
                    {otpCopy.changeEmail}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <>
              <form onSubmit={handleSendCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.auth.email}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t.auth.emailPlaceholder}
                      className="w-full pl-11 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent text-gray-900 placeholder-gray-400 transition-shadow"
                      required
                      disabled={loading}
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-amber-600 text-white py-3.5 rounded-xl font-semibold hover:bg-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {qrProcessing ? qrCopy.validating : otpCopy.sending}
                    </>
                  ) : (
                    otpCopy.sendCode
                  )}
                </button>
              </form>

              {action === 'signin' && (
                <>
                  <div className="my-6 flex items-center gap-3">
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <span className="text-sm text-gray-400 font-medium">
                      {t.auth.orDivider}
                    </span>
                    <div className="flex-1 h-px bg-gray-200"></div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => setShowQRScanner(true)}
                      disabled={loading}
                      className={QR_AUTH_ACTION_BUTTON_CLASS}
                    >
                      <QrCode className="w-5 h-5" />
                      {t.auth.qrLogin}
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={loading}
                      className={QR_AUTH_ACTION_BUTTON_CLASS}
                    >
                      <Upload className="w-5 h-5" />
                      {language === 'en' ? 'Upload QR from Gallery' : language === 'th' ? 'อัพโหลดภาพ QR จากแกลเลอรี' : '从相册上传二维码'}
                    </button>
                  </div>
                </>
              )}

              <div className="mt-6 pt-5 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-500">
                  {action === 'signin' ? t.auth.noAccount : t.auth.haveAccount}{' '}
                  <button
                    onClick={() => {
                      setAction(action === 'signin' ? 'signup' : 'signin');
                      setError('');
                      setNotice('');
                    }}
                    className="text-amber-600 hover:text-amber-700 font-semibold"
                    disabled={loading}
                  >
                    {action === 'signin' ? t.auth.signUp : t.auth.signIn}
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
          onUpload={() => {
            setShowQRScanner(false);
            fileInputRef.current?.click();
          }}
          language={language}
        />
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (min-width: 640px) {
          @keyframes slideUp {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        }
      `}</style>
    </div>
  );
}
