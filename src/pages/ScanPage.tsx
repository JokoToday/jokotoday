import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Loader2, Mail, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';
import { getPublicAppUrl } from '../lib/appUrl';

const scanText = {
  en: {
    checking: 'Checking your VIP code…',
    confirmationTitle: 'Check your email',
    genericSent: 'If this VIP account exists, a sign-in link has been sent to its registered email address.',
    invalidCode: 'Please enter a valid VIP code.',
    errorTitle: 'Unable to send sign-in link',
    network: 'We could not connect to the server. Please check your connection and try again.',
    goHome: 'Go Home',
  },
  th: {
    checking: 'กำลังตรวจสอบรหัส VIP ของคุณ…',
    confirmationTitle: 'ตรวจสอบอีเมลของคุณ',
    genericSent: 'หากมีบัญชี VIP นี้ ระบบได้ส่งลิงก์เข้าสู่ระบบไปยังอีเมลที่ลงทะเบียนไว้แล้ว',
    invalidCode: 'กรุณากรอกรหัส VIP ที่ถูกต้อง',
    errorTitle: 'ไม่สามารถส่งลิงก์เข้าสู่ระบบได้',
    network: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง',
    goHome: 'กลับหน้าแรก',
  },
  zh: {
    checking: '正在检查您的 VIP 编号…',
    confirmationTitle: '请检查您的电子邮件',
    genericSent: '如果此 VIP 账户存在，登录链接已发送至其注册邮箱。',
    invalidCode: '请输入有效的 VIP 编号。',
    errorTitle: '无法发送登录链接',
    network: '无法连接到服务器。请检查网络连接后重试。',
    goHome: '返回首页',
  },
};

export function ScanPage() {
  const requestStartedRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'sent' | 'invalid' | 'error'>('loading');
  const { language } = useLanguage();
  const text = scanText[language];

  useEffect(() => {
    if (requestStartedRef.current) return;
    requestStartedRef.current = true;

    const path = window.location.pathname;
    const match = path.match(/\/scan\/([A-Za-z0-9]+)/);
    const shortCode = match?.[1]?.trim().toUpperCase() || '';

    const requestMagicLink = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('request-vip-magic-link', {
          method: 'POST',
          body: {
            short_code: shortCode,
            app_url: getPublicAppUrl(),
          },
        });

        if (error) {
          const response = typeof error === 'object' && error !== null && 'context' in error
            ? (error as { context?: Response }).context
            : undefined;
          if (response?.status === 400) {
            setStatus('invalid');
            return;
          }
          throw error;
        }
        if (data?.ok !== true) throw new Error('Unexpected response');
        setStatus('sent');
      } catch (error) {
        const err = error as { message?: string; context?: Response };
        console.error('[vip-magic-link] request failed', {
          message: err?.message || 'Unknown request error',
          status: err?.context?.status,
        });
        setStatus('error');
      }
    };

    requestMagicLink();
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-amber-800 text-lg font-medium">{text.checking}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {status === 'sent' ? (
          <>
            <CheckCircle className="w-20 h-20 text-emerald-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-3">{text.confirmationTitle}</h1>
            <p className="text-gray-600 leading-relaxed">{text.genericSent}</p>
            <Mail className="w-6 h-6 text-amber-600 mx-auto mt-5" />
          </>
        ) : (
          <>
            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-3">{text.errorTitle}</h1>
            <p className="text-gray-600">{status === 'invalid' ? text.invalidCode : text.network}</p>
          </>
        )}

        <button
          type="button"
          onClick={() => { window.location.href = '/' }}
          className="mt-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {text.goHome}
        </button>
      </div>
    </div>
  );
}
