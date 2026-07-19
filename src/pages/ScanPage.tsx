import React, { useEffect, useRef, useState } from 'react';
import { XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface UserProfile {
  id: string;
  qr_token: string;
  name: string;
  short_code: string;
  role: string;
  profile_picture_url: string | null;
}

type ScanErrorKind = 'missing' | 'invalid' | 'network';

const scanText = {
  en: {
    validating: 'Validating your QR code…',
    loggingIn: 'Logging you in…',
    errorTitle: 'QR Error',
    missing: 'No QR code or VIP code was provided.',
    invalid: "Hmm, we couldn't recognize that QR code. Please try again or log in with email.",
    network: 'We could not connect to the server. Please check your connection and try again.',
    goHome: 'Go Home',
  },
  th: {
    validating: 'กำลังตรวจสอบคิวอาร์โค้ด…',
    loggingIn: 'กำลังเข้าสู่ระบบ…',
    errorTitle: 'เกิดข้อผิดพลาดเกี่ยวกับคิวอาร์โค้ด',
    missing: 'ไม่ได้ระบุคิวอาร์โค้ดหรือรหัส VIP',
    invalid: 'ขออภัย เราไม่สามารถตรวจสอบคิวอาร์โค้ดนี้ได้ โปรดลองอีกครั้งหรือเข้าสู่ระบบด้วยอีเมล',
    network: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
    goHome: 'กลับหน้าแรก',
  },
  zh: {
    validating: '正在验证二维码…',
    loggingIn: '正在为您登录…',
    errorTitle: '二维码错误',
    missing: '未提供二维码或 VIP 编号。',
    invalid: '抱歉，我们无法识别此二维码。请重试或使用电子邮件登录。',
    network: '无法连接到服务器。请检查网络连接后重试。',
    goHome: '返回首页',
  },
};

export function ScanPage() {
  const loginStartedRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'error'>('loading');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [errorKind, setErrorKind] = useState<ScanErrorKind>('invalid');
  const { language } = useLanguage();
  const { signInWithQR } = useAuth();
  const text = scanText[language];

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/scan\/([A-Za-z0-9]+)/);
    const shortCode = match ? match[1].trim() : null;

    if (!shortCode) {
      setStatus('not_found');
      setErrorKind('missing');
      return;
    }

    if (loginStartedRef.current) return;
    loginStartedRef.current = true;
    lookupUser(shortCode);
  }, [language]);

  const lookupUser = async (shortCode: string) => {
    try {
      // DEBUG: Log scan attempt and Supabase URL
      console.log('🔍 SCAN Lookup - short_code:', shortCode);
      console.log('   Using Supabase URL:', import.meta.env.VITE_SUPABASE_URL);

      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, qr_token, name, short_code, role, profile_picture_url')
        .eq('short_code', shortCode.trim())
        .maybeSingle();

      if (error) {
        console.error('QR lookup failed:', error);
        setStatus('error');
        setErrorKind('network');
        return;
      }

      if (!data) {
        setStatus('not_found');
        setErrorKind('invalid');
        return;
      }

      setUserProfile(data);
      setStatus('found');
      await signInWithQR(data.qr_token);
      window.location.href = '/';
    } catch (err) {
      console.error('QR sign-in failed:', err);
      const diagnostic = err instanceof Error ? err.message.toLowerCase() : '';
      setStatus('error');
      setErrorKind(diagnostic.includes('fetch') || diagnostic.includes('network') ? 'network' : 'invalid');
    }
  };

  const navigateTo = (path: string) => {
    window.location.href = path;
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-amber-800 text-lg font-medium">
            {text.validating}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'not_found' || status === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {text.errorTitle}
          </h1>
          <p className="text-gray-600 mb-6">{text[errorKind]}</p>
          <button
            onClick={() => navigateTo('/')}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {text.goHome}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-16 h-16 text-amber-600 animate-spin mx-auto mb-4" />
        <p className="text-amber-800 text-lg font-medium">
          {text.loggingIn}
        </p>
      </div>
    </div>
  );
}
