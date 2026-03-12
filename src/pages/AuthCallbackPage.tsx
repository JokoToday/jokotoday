import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { generateQRToken } from '../lib/qrTokenGenerator';

interface AuthCallbackPageProps {
  onNavigate: (page: string) => void;
}

export function AuthCallbackPage({ onNavigate }: AuthCallbackPageProps) {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');

        let session = null;
        let error = null;

        if (code) {
          const result = await supabase.auth.exchangeCodeForSession(code);
          session = result.data?.session ?? null;
          error = result.error;
        } else {
          const result = await supabase.auth.getSession();
          session = result.data?.session ?? null;
          error = result.error;
        }

        if (error) {
          setErrorMsg('Sign-in failed. Please try again.');
          setTimeout(() => onNavigate('home'), 3000);
          return;
        }

        if (!session?.user) {
          setErrorMsg('Sign-in failed. Please try again.');
          setTimeout(() => onNavigate('home'), 3000);
          return;
        }

        const userId = session.user.id;
        const userEmail = session.user.email ?? null;

        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('id, profile_completed')
          .eq('id', userId)
          .maybeSingle();

        if (!existingProfile) {
          const qrToken = generateQRToken();
          const { data: shortCodeData } = await supabase.rpc('generate_next_short_code');
          await supabase.from('user_profiles').insert({
            id: userId,
            email: userEmail,
            name: session.user.user_metadata?.full_name ?? null,
            phone: '',
            profile_completed: false,
            role: 'customer',
            qr_token: qrToken,
            short_code: shortCodeData ?? null,
          });
        } else if (!existingProfile.profile_completed && userEmail) {
          await supabase
            .from('user_profiles')
            .update({ email: userEmail })
            .eq('id', userId);
        }

        onNavigate('home');
      } catch {
        setErrorMsg('Something went wrong. Redirecting...');
        setTimeout(() => onNavigate('home'), 3000);
      }
    };

    handleCallback();
  }, [onNavigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      {errorMsg ? (
        <p className="text-red-600 text-lg">{errorMsg}</p>
      ) : (
        <p className="text-gray-600 text-lg">Signing you in...</p>
      )}
    </div>
  );
}
