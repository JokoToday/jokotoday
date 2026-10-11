import React, { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { QRCodeDisplay } from './QRCodeDisplay';
import { PostSignupCelebration } from './PostSignupCelebration';
import { EmailVerificationPanel } from './EmailVerificationPanel';
import { hasLinkedLINE } from '../lib/lineAuth';
import { hasVerifiedEmail, lineDisplayName } from '../lib/lineProfile';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  showCelebration?: boolean;
  onNavigate?: (page: string) => void;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
};

export function ProfileCompletionModal({ isOpen, onClose, onComplete, showCelebration = false, onNavigate }: ProfileCompletionModalProps) {
  const { completeProfile, userProfile, user } = useAuth();
  const { t, language } = useLanguage();
  const { getLabel } = useCMSLabels();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQRCode, setShowQRCode] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(showCelebration);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    line_id: '',
  });

  useEffect(() => {
    if (!isOpen) return;

    setFormData({
      name: userProfile?.name || lineDisplayName(user) || '',
      phone: userProfile?.phone || '',
      line_id: userProfile?.line_id || '',
    });
    setError('');
    setShowCelebrationModal(showCelebration);
  }, [isOpen, showCelebration, userProfile, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError(getLabel('profile.name_required_error', language, t.profile.nameRequired));
      return;
    }

    if (!formData.phone.trim()) {
      setError(getLabel('profile.phone_required_error', language, t.profile.phoneRequired));
      return;
    }

    if (!hasVerifiedEmail(user)) {
      setError(getLabel(
        'profile.email_required_error',
        language,
        language === 'th'
          ? 'จำเป็นต้องยืนยันอีเมลก่อนดำเนินการต่อ'
          : language === 'zh'
            ? '继续前必须先验证邮箱。'
            : 'A verified email is required before continuing.',
      ));
      return;
    }

    if (!hasLinkedLINE(user) && !formData.line_id.trim()) {
      setError(getLabel(
        'profile.line_required_error',
        language,
        language === 'th'
          ? 'จำเป็นต้องมี LINE กรุณากรอก LINE ID หรือเชื่อมต่อบัญชี LINE ของคุณ'
          : language === 'zh'
            ? 'LINE 为必填项。请输入 LINE ID 或关联您的 LINE 账号。'
            : 'LINE is required. Enter your LINE ID or connect your LINE account.',
      ));
      return;
    }

    setLoading(true);

    try {
      await completeProfile({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        line_id: formData.line_id.trim() || undefined,
      });
      setShowQRCode(true);
    } catch (err) {
      setError(getErrorMessage(err, t.profile.profileUpdateFailed));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  if (showQRCode && userProfile?.qr_token) {
    const shortCode = String(userProfile.short_code || '').trim();
    const qrUrl = shortCode
      ? `${window.location.origin}/scan/${shortCode}`
      : '';

    if (showCelebrationModal) {
      return (
        <PostSignupCelebration
          qrToken={userProfile.qr_token}
          qrValue={qrUrl}
          shortCode={shortCode}
          onClose={() => {
            setShowQRCode(false);
            setShowCelebrationModal(false);
            onComplete();
          }}
          onGoToProfile={() => {
            setShowQRCode(false);
            setShowCelebrationModal(false);
            onComplete();
          }}
          onNavigate={onNavigate}
        />
      );
    }

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Your Loyalty Card
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            <QRCodeDisplay
              qrToken={userProfile.qr_token}
              qrValue={qrUrl}
              onClose={() => {
                setShowQRCode(false);
                onComplete();
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              {getLabel('profile.welcome_header', language, t.profile.completeProfile)}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {getLabel('profile.completion_subtitle', language, 'This helps us stay in touch about your orders and rewards')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getLabel('profile.name_label', language, t.profile.name)} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder={getLabel('profile.name_placeholder', language, t.profile.enterName)}
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {getLabel('profile.name_hint', language, 'First name or nickname is perfect!')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getLabel('profile.phone_label', language, t.profile.phone)} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              placeholder={getLabel('profile.phone_placeholder', language, t.profile.enterPhone)}
              disabled={loading}
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {getLabel('profile.phone_hint', language, "We'll use this to contact you about your order if needed")}
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-1">
              {getLabel(
                'profile.contact_methods_email_line',
                language,
                language === 'th' ? 'ข้อมูลติดต่อที่จำเป็น'
                  : language === 'zh' ? '必填联系方式' : 'Required Contact Methods',
              )}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              {getLabel(
                'profile.email_line_required_help',
                language,
                language === 'th'
                  ? 'ต้องมีทั้งอีเมลที่ยืนยันแล้วและ LINE เพื่อดำเนินการต่อ'
                  : language === 'zh'
                    ? '继续前必须同时提供已验证邮箱和 LINE。'
                    : 'A verified email and LINE are both required to continue.',
              )}
            </p>

            <div className="space-y-4">
              {hasVerifiedEmail(user) ? (
                <div className="rounded-lg border border-[#06C755]/30 bg-[#E9F8EE] p-3 text-sm text-[#285A39]">
                  <p className="font-semibold">
                    {language === 'th' ? 'อีเมล * · ยืนยันแล้ว'
                      : language === 'zh' ? '邮箱 * · 已验证' : 'Email * · Verified'}
                  </p>
                  <p className="mt-1 break-all">{user?.email}</p>
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-700">
                    {language === 'th' ? 'อีเมล' : language === 'zh' ? '邮箱' : 'Email'} <span className="text-red-500">*</span>
                  </p>
                  <EmailVerificationPanel />
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  LINE <span className="text-red-500">*</span>
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  {getLabel(
                    'profile.line_required_help',
                    language,
                    language === 'th'
                      ? 'กรอก LINE ID หรือใช้บัญชี LINE ที่เชื่อมต่อแล้ว'
                      : language === 'zh'
                        ? '请输入 LINE ID，或使用已关联的 LINE 账号。'
                        : 'Enter your LINE ID, or use a connected LINE account.',
                  )}
                </p>
                <div className="space-y-3">
                  {hasLinkedLINE(user) && (
                    <p className="rounded-lg border border-[#06C755]/30 bg-[#E9F8EE] p-3 text-sm text-[#285A39]">
                      {language === 'th' ? 'เชื่อมต่อบัญชี LINE แล้ว — ครบตามข้อกำหนด ไม่จำเป็นต้องกรอก LINE ID'
                        : language === 'zh' ? 'LINE 账号已关联——已满足要求，无需填写 LINE ID。'
                          : 'LINE account connected — requirement fulfilled. You do not need to enter a LINE ID.'}
                    </p>
                  )}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      LINE ID {!hasLinkedLINE(user) && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="text"
                      name="line_id"
                      value={formData.line_id}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      placeholder={getLabel('profile.line_placeholder', language, t.profile.enterLineId)}
                      disabled={loading}
                      required={!hasLinkedLINE(user)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? getLabel('profile.saving', language, t.profile.saving) : getLabel('profile.save_button', language, t.profile.completeProfile)}
          </button>
        </form>
      </div>
    </div>
  );
}
