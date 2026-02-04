import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { BrandedQRCard } from '../components/BrandedQRCard';

interface MyQRPageProps {
  onNavigate: (page: string) => void;
}

export function MyQRPage({ onNavigate }: MyQRPageProps) {
  const { user, userProfile } = useAuth();
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();

  const qrToken = userProfile?.qr_token || '';
  const shortCode = String(userProfile?.short_code || '').trim();
  const qrValue = shortCode
    ? `https://joko-today-pre-order-yamv.bolt.host/scan/${shortCode}`
    : '';

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to view your QR code.</p>
          <button
            onClick={() => onNavigate('home')}
            className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  if (!shortCode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600">QR code not generated yet.</p>
          <button
            onClick={() => onNavigate('profile')}
            className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Complete Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
            {getLabel('qr_page.header', language,
              language === 'th' ? 'Your JOKO Pass 🎫' : 'Your JOKO Pass 🎫'
            )}
          </h1>
          <p className="text-gray-700 mb-6 text-center">
            {getLabel('qr_page.subtitle', language,
              language === 'th' ? 'แสดง QR นี้เมื่อคุณมาเยี่ยมเรา — มันคือ ID ส่วนตัวของคุณ' : 'Show this QR when you visit us — it\'s your personal JOKO TODAY ID.'
            )}
          </p>

          <BrandedQRCard
            qrToken={qrToken}
            qrValue={qrValue}
            customerName={userProfile?.name || 'JOKO Member'}
            shortCode={shortCode}
          />

          <p className="text-xs text-gray-500 text-center mt-6">
            {getLabel('qr_page.always_here', language,
              language === 'th' ? 'คุณสามารถค้นหา QR นี้ได้ตลอดเวลาในบัญชีของคุณ' : 'You can always find this QR again in your account.'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
