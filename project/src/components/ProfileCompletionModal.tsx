import React, { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { QRCodeDisplay } from './QRCodeDisplay';
import { PostSignupCelebration } from './PostSignupCelebration';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  showCelebration?: boolean;
}

export function ProfileCompletionModal({ isOpen, onClose, onComplete, showCelebration = false }: ProfileCompletionModalProps) {
  const { updateProfile, userProfile } = useAuth();
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
    whatsapp: '',
    wechat_id: '',
  });

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

    if (!formData.line_id.trim() && !formData.whatsapp.trim() && !formData.wechat_id.trim()) {
      setError(getLabel('profile.contact_required_error', language, t.profile.contactRequired));
      return;
    }

    setLoading(true);

    try {
      await updateProfile({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        line_id: formData.line_id.trim() || undefined,
        whatsapp: formData.whatsapp.trim() || undefined,
        wechat_id: formData.wechat_id.trim() || undefined,
      });
      setShowQRCode(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.profile.profileUpdateFailed);
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

  if (!isOpen) return null;

  if (showQRCode && userProfile?.qr_token) {
    if (showCelebrationModal) {
      const shortCode = String(userProfile.short_code || '').trim();
      const qrUrl = shortCode
        ? `https://joko-today-pre-order-yamv.bolt.host/scan/${shortCode}`
        : '';
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
        />
      );
    }

    const sc = String(userProfile.short_code || '').trim();
    const qrUrlForDisplay = sc
      ? `https://joko-today-pre-order-yamv.bolt.host/scan/${sc}`
      : '';
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
              qrValue={qrUrlForDisplay}
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
              {getLabel('profile.phone_hint', language, "We'll text you order updates")}
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-1">
              {getLabel('profile.contact_header', language, t.profile.contactMethod)} <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-gray-500 mb-4">
              {getLabel('profile.contact_subtitle', language, t.profile.contactMethodHint)}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">LINE ID</label>
                <input
                  type="text"
                  name="line_id"
                  value={formData.line_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder={getLabel('profile.line_placeholder', language, t.profile.enterLineId)}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">WhatsApp</label>
                <input
                  type="text"
                  name="whatsapp"
                  value={formData.whatsapp}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder={getLabel('profile.whatsapp_placeholder', language, t.profile.enterWhatsApp)}
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">WeChat ID</label>
                <input
                  type="text"
                  name="wechat_id"
                  value={formData.wechat_id}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  placeholder={getLabel('profile.wechat_placeholder', language, t.profile.enterWeChatId)}
                  disabled={loading}
                />
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
