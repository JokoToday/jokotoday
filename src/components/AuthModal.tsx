import React, { useState, useRef } from 'react';
import { X, Mail, QrCode, Upload, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { QRScanner } from './QRScanner';
import jsQR from 'jsqr';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAction?: 'signin' | 'signup';
}

type AuthAction = 'signin' | 'signup';

export function AuthModal({ isOpen, onClose, initialAction = 'signin' }: AuthModalProps) {
  const { signInWithMagicLink } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [action, setAction] = useState<AuthAction>(initialAction);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    setEmail('');
    setError('');
    setAction('signin');
    setLinkSent(false);
    setLoading(false);
    onClose();
  };

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithMagicLink(email);
      setLinkSent(true);
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
        throw new Error(t.auth.errorGeneric);
      }

      window.location.href = `/scan/${shortCode}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.errorGeneric);
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
            setError(t.auth.errorGeneric);
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
            setError(t.auth.errorGeneric);
            setLoading(false);
          }
        };

        image.src = e.target?.result as string;
      };

      reader.onerror = () => {
        setError(t.auth.errorGeneric);
        setLoading(false);
      };

      reader.readAsDataURL(file);
    } catch {
      setError(t.auth.errorGeneric);
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
            {action === 'signup' ? t.auth.signUpTitle : t.auth.signInTitle}
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
          {linkSent ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="text-gray-800 text-sm leading-relaxed">
                  {t.auth.confirmationMessage}
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-4">{email}</p>
              <button
                onClick={handleClose}
                className="mt-6 text-sm text-amber-600 hover:text-amber-700 font-medium"
              >
                {t.auth.signInTitle === 'Sign In' ? 'Close' : language === 'th' ? 'ปิด' : '关闭'}
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSendLink} className="space-y-4">
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
                      {t.auth.loading}
                    </>
                  ) : (
                    t.auth.sendLink
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
                      className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-semibold hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
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
                      className="w-full border-2 border-gray-200 text-gray-700 py-3.5 rounded-xl font-semibold hover:border-gray-300 hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2.5"
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
          language={language as 'en' | 'th'}
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
