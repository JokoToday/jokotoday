import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateQRToken } from '../lib/qrTokenGenerator';

interface AuthCallbackPageProps {
  onNavigate: (page: string) => void;
}

export function AuthCallbackPage({ onNavigate }: AuthCallbackPageProps) {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);

        const code = queryParams.get('code');
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        const type = hashParams.get('type') || queryParams.get('type');

        console.log('Auth callback params:', { code, accessToken, refreshToken, type });

        if (type === 'recovery') {
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) throw error;

            setStatus('success');
            setTimeout(() => {
              window.location.href = '/reset-password';
            }, 1000);
          } else {
            throw new Error('Missing tokens for password recovery');
          }
          return;
        }

        if (code) {
          console.log('Exchanging code for session:', code);
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error('Code exchange error:', error);
            throw error;
          }

          console.log('Code exchange successful:', data);

          const user = data.user;

          if (user) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('profile_completed, short_code, qr_token')
              .eq('id', user.id)
              .maybeSingle();

            if (!profile) {
              console.log('No profile found after code exchange, creating one...');
              const qrToken = generateQRToken();

              try {
                const { data: profileResult, error: profileError } = await supabase
                  .rpc('create_user_profile_with_qr', {
                    p_email: user.email,
                    p_name: user.email?.split('@')[0] || 'User',
                    p_phone: 'pending',
                    p_qr_token: qrToken,
                    p_line_id: user.email,
                    p_whatsapp: null,
                    p_wechat_id: null
                  });

                if (profileError && !profileError.message.includes('Profile already exists')) {
                  throw profileError;
                } else {
                  console.log('Profile created with short_code:', profileResult);
                }

                const { data: newProfile } = await supabase
                  .from('user_profiles')
                  .select('profile_completed')
                  .eq('id', user.id)
                  .maybeSingle();

                setStatus('success');
                setTimeout(() => {
                  if (newProfile && !newProfile.profile_completed) {
                    onNavigate('profile');
                  } else {
                    onNavigate('home');
                  }
                }, 1000);
              } catch (err) {
                console.error('Failed to create profile:', err);
                throw err;
              }
            } else {
              setStatus('success');
              setTimeout(() => {
                if (!profile.profile_completed) {
                  onNavigate('profile');
                } else {
                  onNavigate('home');
                }
              }, 1000);
            }
          } else {
            throw new Error('User not found after code exchange');
          }
        } else if (accessToken && refreshToken) {
          console.log('Using access and refresh tokens');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) throw error;

          const { data: { user } } = await supabase.auth.getUser();

          if (user) {
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('profile_completed, short_code, qr_token')
              .eq('id', user.id)
              .maybeSingle();

            if (!profile) {
              console.log('No profile found, creating one with short_code and QR token...');
              const qrToken = generateQRToken();

              try {
                const { data: profileResult, error: profileError } = await supabase
                  .rpc('create_user_profile_with_qr', {
                    p_email: user.email,
                    p_name: user.email?.split('@')[0] || 'User',
                    p_phone: 'pending',
                    p_qr_token: qrToken,
                    p_line_id: user.email,
                    p_whatsapp: null,
                    p_wechat_id: null
                  });

                if (profileError) {
                  console.error('Error creating profile:', profileError);
                  if (!profileError.message.includes('Profile already exists')) {
                    throw profileError;
                  }
                } else {
                  console.log('Profile created successfully with short_code:', profileResult);
                }

                const { data: newProfile } = await supabase
                  .from('user_profiles')
                  .select('profile_completed')
                  .eq('id', user.id)
                  .maybeSingle();

                setStatus('success');
                setTimeout(() => {
                  if (newProfile && !newProfile.profile_completed) {
                    onNavigate('profile');
                  } else {
                    onNavigate('home');
                  }
                }, 1000);
              } catch (err) {
                console.error('Failed to create profile:', err);
                throw err;
              }
            } else {
              setStatus('success');
              setTimeout(() => {
                if (!profile.profile_completed) {
                  onNavigate('profile');
                } else {
                  onNavigate('home');
                }
              }, 1000);
            }
          } else {
            throw new Error('User not found after authentication');
          }
        } else {
          throw new Error('No authentication parameters found in URL');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Authentication failed');

        setTimeout(() => {
          onNavigate('home');
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [onNavigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="w-16 h-16 text-amber-600 animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Completing sign in...
            </h1>
            <p className="text-gray-600">Please wait a moment</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 bg-green-500 rounded-full"></div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Success!
            </h1>
            <p className="text-gray-600">Redirecting you now...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 bg-red-500 rounded-full"></div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Authentication Error
            </h1>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <p className="text-sm text-gray-500">Redirecting to home...</p>
          </>
        )}
      </div>
    </div>
  );
}
