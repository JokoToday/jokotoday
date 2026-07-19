import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, Loader2, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { BrandedQRCard } from '../components/BrandedQRCard';
import { supabase } from '../lib/supabase';

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
  regenerate: {
    en: 'Regenerate My QR',
    th: 'สร้าง QR ของฉันใหม่',
    zh: '重新生成我的二维码',
  },
  regenerateTitle: {
    en: 'Regenerate your QR code?',
    th: 'สร้างรหัส QR ของคุณใหม่หรือไม่?',
    zh: '重新生成您的二维码？',
  },
  regenerateBody: {
    en: 'Your current QR code will stop working immediately. Any previously downloaded or printed cards must be replaced.',
    th: 'รหัส QR ปัจจุบันของคุณจะหยุดใช้งานทันที บัตรที่เคยดาวน์โหลดหรือพิมพ์ไว้ทั้งหมดจะต้องเปลี่ยนใหม่',
    zh: '您当前的二维码将立即失效。之前下载或打印的所有卡片都必须更换。',
  },
  cancel: {
    en: 'Cancel',
    th: 'ยกเลิก',
    zh: '取消',
  },
  regenerateConfirm: {
    en: 'Regenerate QR',
    th: 'สร้าง QR ใหม่',
    zh: '重新生成二维码',
  },
  regenerateSuccess: {
    en: 'QR code regenerated successfully. Please download or print the new card.',
    th: 'สร้างคิวอาร์โค้ดใหม่สำเร็จ กรุณาดาวน์โหลดหรือพิมพ์บัตรใหม่',
    zh: '二维码已成功重新生成。请下载或打印新卡片。',
  },
  regenerating: {
    en: 'Regenerating your QR code…',
    th: 'กำลังสร้างคิวอาร์โค้ดใหม่…',
    zh: '正在重新生成您的二维码…',
  },
  regenerateError: {
    en: 'We could not regenerate your QR code. Please try again.',
    th: 'ไม่สามารถสร้างรหัส QR ใหม่ได้ กรุณาลองอีกครั้ง',
    zh: '无法重新生成您的二维码，请重试。',
  },
  sessionExpired: {
    en: 'Your session has expired. Please sign in again before regenerating your QR code.',
    th: 'เซสชันของคุณหมดอายุแล้ว กรุณาเข้าสู่ระบบอีกครั้งก่อนสร้างรหัส QR ใหม่',
    zh: '您的会话已过期。请重新登录后再生成新的二维码。',
  },
};

export function MyQRPage({ onNavigate }: MyQRPageProps) {
  const { user, userProfile, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();

  const lang = language as 'en' | 'th' | 'zh';
  const [activeQrToken, setActiveQrToken] = useState(userProfile?.qr_token || '');
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateSucceeded, setRegenerateSucceeded] = useState(false);
  const [regenerateFailure, setRegenerateFailure] = useState<{
    kind: 'session' | 'generic';
    diagnostic: string;
  } | null>(null);

  useEffect(() => {
    setActiveQrToken(userProfile?.qr_token || '');
  }, [userProfile?.qr_token]);

  const qrToken = activeQrToken;
  const shortCode = String(userProfile?.short_code || '').trim();
  const qrValue = qrToken
    ? `${window.location.origin}/q/${encodeURIComponent(qrToken)}`
    : '';
  const regenerateErrorMessage = regenerateFailure
    ? `${regenerateFailure.kind === 'session' ? pageText.sessionExpired[lang] : pageText.regenerateError[lang]}${
      import.meta.env.DEV ? ` (${regenerateFailure.diagnostic})` : ''
    }`
    : '';

  const handleRegenerateQr = async () => {
    if (regenerating) return;

    setRegenerating(true);
    setRegenerateFailure(null);
    setRegenerateSucceeded(false);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        const error = new Error(sessionError?.message || 'No active session');
        error.name = 'SessionExpiredError';
        throw error;
      }

      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
      const refreshedSession = refreshedData.session;
      if (refreshError || !refreshedSession?.access_token) {
        const error = new Error(refreshError?.message || 'Session refresh returned no session');
        error.name = 'SessionExpiredError';
        throw error;
      }

      const { data, error } = await supabase.functions.invoke('regenerate-qr', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${refreshedSession.access_token}`,
        },
      });
      const newToken = typeof data?.qr_token === 'string' ? data.qr_token : '';

      if (error || !newToken) throw error ?? new Error('Missing QR token');

      setActiveQrToken(newToken);
      setShowRegenerateConfirm(false);
      setRegenerateSucceeded(true);
      await refreshProfile();
    } catch (error) {
      let diagnostic = error instanceof Error ? error.message : 'Unknown error';
      const response = typeof error === 'object' && error !== null && 'context' in error
        ? (error as { context?: Response }).context
        : undefined;

      if (response) {
        try {
          const payload = await response.clone().json() as { code?: string; message?: string };
          diagnostic = [payload.code, payload.message].filter(Boolean).join(': ') || diagnostic;
        } catch {
          diagnostic = `${diagnostic} (HTTP ${response.status})`;
        }
      }

      console.error('[MyQRPage] QR regeneration failed:', diagnostic);
      setRegenerateFailure({
        kind: error instanceof Error && error.name === 'SessionExpiredError' ? 'session' : 'generic',
        diagnostic,
      });
    } finally {
      setRegenerating(false);
    }
  };

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

  if (!qrToken) {
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
            secondaryAction={
              <>
                <button
                  type="button"
                  onClick={() => {
                    setRegenerateFailure(null);
                    setShowRegenerateConfirm(true);
                  }}
                  disabled={regenerating}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-3 font-semibold text-slate-700 transition-colors duration-200 hover:border-red-600 hover:bg-red-600 hover:text-white active:border-red-700 active:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-slate-300 disabled:hover:bg-white disabled:hover:text-slate-700"
                >
                  <RefreshCw className="h-5 w-5" />
                  {pageText.regenerate[lang]}
                </button>

                {regenerateSucceeded && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{pageText.regenerateSuccess[lang]}</span>
                  </div>
                )}

                {regenerateFailure && !showRegenerateConfirm && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700" role="alert">
                    {regenerateErrorMessage}
                  </div>
                )}
              </>
            }
          />

          <p className="text-xs text-gray-500 text-center mt-6">
            {getLabel('qr_page.always_here', language, pageText.alwaysHere[lang])}
          </p>
        </div>
      </div>

      {showRegenerateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="regenerate-qr-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id="regenerate-qr-title" className="text-xl font-bold text-slate-900">
                {pageText.regenerateTitle[lang]}
              </h2>
              <button
                type="button"
                onClick={() => setShowRegenerateConfirm(false)}
                disabled={regenerating}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label={pageText.cancel[lang]}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 leading-relaxed text-slate-600">
              {pageText.regenerateBody[lang]}
            </p>

            {regenerateFailure && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {regenerateErrorMessage}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowRegenerateConfirm(false)}
                disabled={regenerating}
                className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pageText.cancel[lang]}
              </button>
              <button
                type="button"
                onClick={handleRegenerateQr}
                disabled={regenerating}
                className="flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {regenerating && <Loader2 className="h-4 w-4 animate-spin" />}
                {regenerating ? pageText.regenerating[lang] : pageText.regenerateConfirm[lang]}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
