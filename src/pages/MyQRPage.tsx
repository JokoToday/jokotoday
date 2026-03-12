import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { BrandedQRCard } from '../components/BrandedQRCard';

interface MyQRPageProps {
  onNavigate: (page: string) => void;
}

const pageText = {
  signInPrompt: {
    en: 'Please sign in to view your QR code.',
    th: 'กรุณาเข้าสู่ระบบเพื่อดู QR Code ของคุณ',
    zh: '请登录以查看您的二维码。',
  },
  goHome: {
    en: 'Go to Home',
    th: 'ไปหน้าหลัก',
    zh: '返回首页',
  },
  notGenerated: {
    en: 'QR code not generated yet.',
    th: 'ยังไม่ได้สร้าง QR Code',
    zh: '二维码尚未生成。',
  },
  completeProfile: {
    en: 'Complete Profile',
    th: 'กรอกข้อมูลโปรไฟล์',
    zh: '完善个人资料',
  },
  back: {
    en: 'Back',
    th: 'กลับ',
    zh: '返回',
  },
  header: {
    en: 'Your JOKO Pass',
    th: 'JOKO Pass ของคุณ',
    zh: '您的 JOKO 通行证',
  },
  subtitle: {
    en: "Show this QR when you visit us — it's your personal JOKO TODAY ID.",
    th: 'แสดง QR นี้เมื่อคุณมาเยี่ยมเรา — มันคือ ID ส่วนตัวของคุณ',
    zh: '来访时出示此二维码 — 这是您的专属 JOKO TODAY ID。',
  },
  alwaysHere: {
    en: 'You can always find this QR again in your account.',
    th: 'คุณสามารถค้นหา QR นี้ได้ตลอดเวลาในบัญชีของคุณ',
    zh: '您随时可以在账户中找到此二维码。',
  },
};

export function MyQRPage({ onNavigate }: MyQRPageProps) {
  const { user, userProfile } = useAuth();
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();

  const lang = language as 'en' | 'th' | 'zh';

  const qrToken = userProfile?.qr_token || '';
  const shortCode = String(userProfile?.short_code || '').trim();
  const qrValue = shortCode
    ? `${window.location.origin}/scan/${shortCode}`
    : '';

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600">{pageText.signInPrompt[lang]}</p>
          <button
            onClick={() => onNavigate('home')}
            className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            {pageText.goHome[lang]}
          </button>
        </div>
      </div>
    );
  }

  if (!shortCode) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600">{pageText.notGenerated[lang]}</p>
          <button
            onClick={() => onNavigate('profile')}
            className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            {pageText.completeProfile[lang]}
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
          {pageText.back[lang]}
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
            {getLabel('qr_page.header', language, pageText.header[lang])}
          </h1>
          <p className="text-gray-700 mb-6 text-center">
            {getLabel('qr_page.subtitle', language, pageText.subtitle[lang])}
          </p>

          <BrandedQRCard
            qrToken={qrToken}
            qrValue={qrValue}
            customerName={userProfile?.name || 'JOKO Member'}
            shortCode={shortCode}
          />

          <p className="text-xs text-gray-500 text-center mt-6">
            {getLabel('qr_page.always_here', language, pageText.alwaysHere[lang])}
          </p>
        </div>
      </div>
    </div>
  );
}
