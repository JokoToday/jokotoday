import React, { useEffect, useState } from 'react';
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

export function ScanPage() {
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'error'>('loading');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const { language } = useLanguage();
  const { signInWithQR } = useAuth();

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/scan\/([A-Za-z0-9]+)/);
    const shortCode = match ? match[1].trim() : null;

    if (!shortCode) {
      setStatus('not_found');
      setErrorMessage(language === 'th' ? 'ไม่พบรหัส' : 'No code provided');
      return;
    }

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
        setStatus('error');
        setErrorMessage(error.message);
        return;
      }

      if (!data) {
        setStatus('not_found');
        setErrorMessage(language === 'th' ? 'ไม่พบสมาชิก' : 'Member not found');
        return;
      }

      setUserProfile(data);
      setStatus('found');
      await signInWithQR(data.qr_token);
      window.location.href = '/';
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : (language === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred'));
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
            {language === 'th' ? 'กำลังค้นหา...' : 'Looking up...'}
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
            {language === 'th' ? 'ไม่พบข้อมูล' : 'Not Found'}
          </h1>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button
            onClick={() => navigateTo('/')}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {language === 'th' ? 'กลับหน้าแรก' : 'Go Home'}
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
          {language === 'th' ? 'กำลังเข้าสู่ระบบ...' : 'Signing in...'}
        </p>
      </div>
    </div>
  );
}
