import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateQRToken } from '../lib/qrTokenGenerator';
import { useLanguage } from '../context/LanguageContext';

function logSupabaseError(context: string, error: unknown) {
  if (!error) return;

  const err = error as {
    name?: string;
    message?: string;
    code?: string;
    status?: number;
    details?: string;
    hint?: string;
  };

  const safeDetails = {
    name: err.name,
    code: err.code,
    status: err.status,
  };

  if (import.meta.env.DEV) {
    console.error(`[auth-callback] ${context}`, {
      ...safeDetails,
      message: err.message,
      details: err.details,
      hint: err.hint,
    });
  } else {
    console.error(`[auth-callback] ${context}`, safeDetails);
  }
}

interface AuthCallbackPageProps {
  onNavigate: (page: string) => void;
}

const callbackText = {
  en: {
    signingIn: 'Signing you in…',
    failed: 'Sign-in failed. Please try again.',
    unexpected: 'Something went wrong. Redirecting…',
  },
  th: {
    signingIn: 'กำลังเข้าสู่ระบบ…',
    failed: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง',
    unexpected: 'เกิดข้อผิดพลาด กำลังเปลี่ยนเส้นทาง…',
  },
  zh: {
    signingIn: '正在为您登录…',
    failed: '登录失败，请重试。',
    unexpected: '出现问题，正在跳转…',
  },
};

export function AuthCallbackPage({ onNavigate }: AuthCallbackPageProps) {
  const [errorKind, setErrorKind] = useState<'failed' | 'unexpected' | null>(null);
  const { language } = useLanguage();
  const text = callbackText[language];

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken || refreshToken) {
          window.history.replaceState({}, document.title, '/auth/callback');

          if (!accessToken || !refreshToken) {
            setErrorKind('failed');
            setTimeout(() => onNavigate('home'), 3000);
            return;
          }

          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          logSupabaseError('implicit callback setSession failed', setSessionError);

          if (setSessionError) {
            setErrorKind('failed');
            setTimeout(() => onNavigate('home'), 3000);
            return;
          }
        }

        const sessionResult = await supabase.auth.getSession();
        const session = sessionResult.data?.session ?? null;
        const error = sessionResult.error;
        logSupabaseError('getSession failed', sessionResult.error);

        if (error) {
          setErrorKind('failed');
          setTimeout(() => onNavigate('home'), 3000);
          return;
        }

        if (!session?.user) {
          setErrorKind('failed');
          setTimeout(() => onNavigate('home'), 3000);
          return;
        }

        const userId = session.user.id;
        const userEmail = session.user.email ?? null;

        const { data: existingProfile, error: profileSelectError } = await supabase
          .from('user_profiles')
          .select('id, profile_completed')
          .eq('id', userId)
          .maybeSingle();
        logSupabaseError('user_profiles select failed', profileSelectError);

        if (!existingProfile) {
          const qrToken = generateQRToken();
          const { data: shortCodeData, error: shortCodeError } = await supabase.rpc('generate_next_short_code');
          logSupabaseError('generate_next_short_code failed', shortCodeError);

          const { error: profileInsertError } = await supabase.from('user_profiles').insert({
            id: userId,
            email: userEmail,
            name: session.user.user_metadata?.full_name ?? null,
            phone: '',
            profile_completed: false,
            role: 'customer',
            qr_token: qrToken,
            short_code: shortCodeData ?? null,
          });
          logSupabaseError('profile insert failed', profileInsertError);
        } else if (!existingProfile.profile_completed && userEmail) {
          const { error: profileUpdateError } = await supabase
            .from('user_profiles')
            .update({ email: userEmail })
            .eq('id', userId);
          logSupabaseError('profile update failed', profileUpdateError);
        }

        window.history.replaceState({}, '', '/');
        onNavigate('home');
      } catch (error) {
        logSupabaseError('unexpected callback failure', error);
        setErrorKind('unexpected');
        setTimeout(() => onNavigate('home'), 3000);
      }
    };

    handleCallback();
  }, [onNavigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      {errorKind ? (
        <p className="text-red-600 text-lg">{text[errorKind]}</p>
      ) : (
        <p className="text-gray-600 text-lg">{text.signingIn}</p>
      )}
    </div>
  );
}
