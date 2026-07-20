import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { generateQRToken } from '../lib/qrTokenGenerator';
import { useLanguage } from '../context/LanguageContext';

type CallbackType = 'pkce' | 'implicit' | 'none';

function logSupabaseError(context: string, error: unknown) {
  if (!error) return;

  const err = error as { message?: string; code?: string; status?: number };
  console.error(`[auth-callback] ${context}`, {
    message: err.message || 'Unknown Supabase error',
    code: err.code,
    status: err.status,
  });
}

function clearCallbackParameters() {
  window.history.replaceState({}, document.title, '/auth/callback');
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
  const callbackStartedRef = useRef(false);
  const navigateRef = useRef(onNavigate);
  const { language } = useLanguage();
  const text = callbackText[language];

  useEffect(() => {
    navigateRef.current = onNavigate;
  }, [onNavigate]);

  useEffect(() => {
    if (callbackStartedRef.current) return;
    callbackStartedRef.current = true;

    const failAndRedirect = (kind: 'failed' | 'unexpected') => {
      setErrorKind(kind);
      window.setTimeout(() => navigateRef.current('home'), 3000);
    };

    const handleCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const code = searchParams.get('code');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const callbackType: CallbackType = code
        ? 'pkce'
        : accessToken || refreshToken
          ? 'implicit'
          : 'none';

      console.info(`[auth-callback] callback type detected: ${callbackType}`);
      clearCallbackParameters();

      try {
        let session: Session | null = null;

        if (callbackType === 'implicit') {
          if (!accessToken || !refreshToken) {
            console.error('[auth-callback] implicit callback is missing a required token');
            failAndRedirect('failed');
            return;
          }

          const result = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          logSupabaseError('implicit setSession failed', result.error);
          if (result.error) {
            failAndRedirect('failed');
            return;
          }
          session = result.data.session;
        } else if (callbackType === 'pkce' && code) {
          // detectSessionInUrl may have completed the exchange during client initialization.
          const existing = await supabase.auth.getSession();
          logSupabaseError('PKCE pre-exchange getSession failed', existing.error);
          session = existing.data.session;

          if (!session && !existing.error) {
            const exchanged = await supabase.auth.exchangeCodeForSession(code);
            logSupabaseError('PKCE code exchange failed', exchanged.error);
            if (exchanged.error) {
              failAndRedirect('failed');
              return;
            }
            session = exchanged.data.session;
          }
        } else {
          const existing = await supabase.auth.getSession();
          logSupabaseError('callback getSession failed', existing.error);
          if (existing.error) {
            failAndRedirect('failed');
            return;
          }
          session = existing.data.session;
        }

        if (!session?.user) {
          console.error('[auth-callback] callback completed without a session');
          failAndRedirect('failed');
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

        // setSession/exchangeCodeForSession has emitted the auth event consumed by AuthContext.
        window.history.replaceState({}, document.title, '/');
        navigateRef.current('home');
      } catch (error) {
        logSupabaseError('unexpected callback failure', error);
        failAndRedirect('unexpected');
      }
    };

    void handleCallback();
  }, []);

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
