import React, { useState, useRef } from 'react';
import { X, Mail, Lock, Sparkles, QrCode, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { QRScanner } from './QRScanner';
import jsQR from 'jsqr';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAction?: 'signin' | 'signup';
}

type AuthMode = 'password' | 'magiclink' | 'qr';
type AuthAction = 'signin' | 'signup';
type ModalView = 'main' | 'reset';

export function AuthModal({ isOpen, onClose, initialAction = 'signin' }: AuthModalProps) {
  const { signIn, signUp, signInWithMagicLink, signInWithQR, userProfile } = useAuth();
  const { t, language } = useLanguage();
  const { getLabel } = useCMSLabels();
  const [mode, setMode] = useState<AuthMode>('password');
  const [action, setAction] = useState<AuthAction>(initialAction);
  const [modalView, setModalView] = useState<ModalView>('main');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setError('');
    setSuccessMessage('');
    setMode('password');
    setAction('signin');
    setModalView('main');
    setResetEmail('');
    onClose();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      await signInWithMagicLink(resetEmail);
      setSuccessMessage(getLabel('auth.reset_link_sent', language, t.auth.resetLinkSent));
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.passwordResetFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleQrResult = async (rawValue: string) => {
    setError('');
    setLoading(true);

    try {
      let shortCode = '';
      const trimmedValue = rawValue.trim();

      if (trimmedValue.includes('/scan/')) {
        const parts = trimmedValue.split('/scan/');
        shortCode = parts[1].split(/[?#]/)[0];
      } else if (trimmedValue.includes('/verify/')) {
        const parts = trimmedValue.split('/verify/');
        shortCode = parts[1].split(/[?#]/)[0];
      } else {
        shortCode = trimmedValue;
      }

      if (!shortCode) {
        throw new Error(
          language === 'th'
            ? 'ไม่พบรหัส QR ที่ถูกต้อง'
            : 'No valid QR code found.'
        );
      }

      console.log('QR Code processed:', { rawValue, shortCode });

      window.location.href = `/scan/${shortCode}`;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : language === 'th'
          ? 'เกิดข้อผิดพลาดในการประมวลผล QR Code'
          : "Hmm, we couldn't recognize that QR code. Please try again."
      );
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
    setLoading(true);

    try {
      const image = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        image.onload = async () => {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) {
            setError(
              language === 'th'
                ? 'ไม่สามารถประมวลผลภาพได้ กรุณาลองอีกครั้ง'
                : 'Unable to process image. Please try again.'
            );
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
            setError(
              language === 'th'
                ? 'ไม่พบ QR Code ในภาพที่เลือก กรุณาเลือกภาพที่มี QR Code ที่ชัดเจน'
                : 'No QR code detected in the image. Please select a clear image with a QR code.'
            );
            setLoading(false);
          }
        };

        image.src = e.target?.result as string;
      };

      reader.onerror = () => {
        setError(
          language === 'th'
            ? 'ไม่สามารถอ่านไฟล์ภาพได้ กรุณาลองอีกครั้ง'
            : 'Unable to read image file. Please try again.'
        );
        setLoading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError(
        language === 'th'
          ? 'เกิดข้อผิดพลาดในการประมวลผล QR Code'
          : 'Error processing QR code. Please try again.'
      );
      setLoading(false);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (mode === 'magiclink') {
        await signInWithMagicLink(email);
        setSuccessMessage(getLabel('auth.magiclink_sent', language, t.auth.magicLinkSent));
        setTimeout(() => {
          handleClose();
        }, 3000);
      } else {
        if (action === 'signin') {
          await signIn(email, password);
          handleClose();
        } else {
          await signUp(email, password);
          setSuccessMessage(
            language === 'th'
              ? '🎉 ยินดีต้อนรับ! บัญชีของคุณพร้อมแล้ว'
              : '🎉 Welcome! Your account is ready'
          );
          setTimeout(() => {
            handleClose();
          }, 2000);
        }
      }
    } catch (err) {
      console.error('Auth error:', err);

      if (err instanceof Error) {
        if (err.message === 'CONFIRMATION_REQUIRED') {
          setSuccessMessage(
            language === 'th'
              ? 'กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยันบัญชี'
              : 'Please check your email to confirm your account.'
          );
          setTimeout(() => {
            handleClose();
          }, 4000);
        } else if (err.message.includes('User already registered')) {
          setError(
            language === 'th'
              ? 'อีเมลนี้มีการลงทะเบียนแล้ว กรุณาเข้าสู่ระบบแทน'
              : 'This email is already registered. Please sign in instead.'
          );
        } else if (err.message.includes('Invalid email')) {
          setError(
            language === 'th'
              ? 'รูปแบบอีเมลไม่ถูกต้อง'
              : 'Invalid email format.'
          );
        } else if (err.message.includes('Password should be at least')) {
          setError(
            language === 'th'
              ? 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'
              : 'Password must be at least 6 characters long.'
          );
        } else if (err.message.includes('Invalid login credentials')) {
          setError(
            language === 'th'
              ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
              : 'Invalid email or password.'
          );
        } else if (err.message.includes('Unable to create account') || err.message.includes('Permission denied')) {
          setError(err.message);
        } else if (err.message.includes('already exists')) {
          setError(
            language === 'th'
              ? 'บัญชีนี้มีอยู่แล้ว กรุณาเข้าสู่ระบบแทน'
              : err.message
          );
        } else {
          setError(err.message);
        }
      } else {
        setError(t.auth.authError);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md sm:w-full max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-2xl">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {modalView === 'reset'
                ? getLabel('auth.reset_password_header', language, t.auth.resetPassword)
                : action === 'signin'
                ? getLabel('auth.signin_header', language, 'Hey there!')
                : getLabel('auth.signup_header', language, "Let's get you started")}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {modalView === 'reset'
                ? getLabel('auth.reset_password_subtitle', language, t.auth.resetPasswordMessage)
                : action === 'signin'
                ? getLabel('auth.signin_subtitle', language, 'Sign in to place your order and earn loyalty rewards')
                : getLabel('auth.signup_subtitle', language, 'Create an account to order your favorite baked goods')}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {successMessage && (
            <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-lg text-sm flex items-start gap-2">
              <Sparkles className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          {modalView === 'reset' ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getLabel('auth.email_label', language, t.auth.email)}
                </label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder={getLabel('auth.email_placeholder', language, 'hello@example.com')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  required
                  disabled={loading}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? getLabel('auth.loading', language, t.auth.loading)
                  : getLabel('auth.send_reset_link_button', language, t.auth.sendResetLink)}
              </button>
              <button
                type="button"
                onClick={() => setModalView('main')}
                className="w-full text-amber-600 hover:text-amber-700 font-medium py-2"
                disabled={loading}
              >
                {getLabel('auth.back_to_signin', language, 'Back to Sign In')}
              </button>
            </form>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                {getLabel('auth.choose_method', language, 'How would you like to sign in?')}
              </p>
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setMode('password')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                    mode === 'password'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={loading}
                >
                  <Lock className="w-4 h-4" />
                  <span className="text-sm">{getLabel('auth.password_method', language, t.auth.password)}</span>
                </button>
                <button
                  onClick={() => setMode('magiclink')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                    mode === 'magiclink'
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  disabled={loading}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm">{getLabel('auth.magiclink_method', language, t.auth.magicLink)}</span>
                </button>
                {action === 'signin' && (
                  <button
                    onClick={() => setMode('qr')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                      mode === 'qr'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    disabled={loading}
                  >
                    <QrCode className="w-4 h-4" />
                    <span className="text-sm">{getLabel('auth.qr_method', language, 'QR Code')}</span>
                  </button>
                )}
              </div>

              {mode === 'qr' ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <QrCode className="w-8 h-8 text-amber-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {getLabel('auth.qr_signin_header', language, 'Sign in with your JOKO QR')}
                    </h3>
                    <p className="text-sm text-gray-700 mb-4">
                      {getLabel('auth.qr_signin_body', language, 'Just point your camera at your personal JOKO QR code. It\'s the fastest way to log in and pick up your goodies.')}
                    </p>
                    <button
                      onClick={() => setShowQRScanner(true)}
                      disabled={loading}
                      className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <QrCode className="w-5 h-5" />
                      {getLabel('auth.qr_open_camera', language, 'Open Camera')}
                    </button>

                    <div className="my-4 flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-300"></div>
                      <span className="text-sm text-gray-500 font-medium">
                        {language === 'th' ? 'หรือ' : 'or'}
                      </span>
                      <div className="flex-1 h-px bg-gray-300"></div>
                    </div>

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
                      className="w-full bg-white border-2 border-amber-600 text-amber-600 py-3 rounded-lg font-medium hover:bg-amber-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      {language === 'th' ? 'เลือกภาพ QR จากแกลเลอรี' : 'Upload QR from Gallery'}
                    </button>

                    <p className="text-xs text-gray-500 mt-4">
                      {getLabel('auth.qr_helper_text', language, 'You\'ll find your QR in your account or saved on your phone.')}
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {getLabel('auth.email_label', language, t.auth.email)}
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={getLabel('auth.email_placeholder', language, 'hello@example.com')}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      required
                      disabled={loading}
                    />
                  </div>

                  {mode === 'password' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {getLabel('auth.password_label', language, t.auth.password)}
                        </label>
                        {action === 'signin' && (
                          <button
                            type="button"
                            onClick={() => setModalView('reset')}
                            className="text-xs text-amber-600 hover:text-amber-700 font-medium"
                            disabled={loading}
                          >
                            {getLabel('auth.forgot_password_link', language, t.auth.forgotPassword)}
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={getLabel('auth.password_placeholder', language, 'At least 6 characters')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        required
                        disabled={loading}
                        minLength={6}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {getLabel('auth.password_hint', language, 'Minimum 6 characters')}
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading
                      ? getLabel('auth.loading', language, t.auth.loading)
                      : mode === 'magiclink'
                      ? getLabel('auth.send_magiclink_button', language, t.auth.sendMagicLink)
                      : action === 'signin'
                      ? getLabel('auth.signin_button', language, t.auth.signIn)
                      : getLabel('auth.signup_button', language, t.auth.createAccount)
                    }
                  </button>
                </form>
              )}

              {mode === 'password' && (
                <p className="mt-6 text-center text-sm text-gray-600">
                  {action === 'signin'
                    ? getLabel('auth.no_account', language, t.auth.noAccount)
                    : getLabel('auth.have_account', language, t.auth.haveAccount)}{' '}
                  <button
                    onClick={() => setAction(action === 'signin' ? 'signup' : 'signin')}
                    className="text-amber-600 hover:text-amber-700 font-medium"
                    disabled={loading}
                  >
                    {action === 'signin'
                      ? getLabel('auth.create_account_link', language, t.auth.signUp)
                      : getLabel('auth.signin_link', language, t.auth.signIn)}
                  </button>
                </p>
              )}

              {mode === 'magiclink' && (
                <p className="mt-4 text-xs text-gray-500 text-center">
                  {getLabel('auth.magiclink_info', language, t.auth.magicLinkInfo)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
          language={language as 'en' | 'th'}
        />
      )}
    </div>
  );
}
