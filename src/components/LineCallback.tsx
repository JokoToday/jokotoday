import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface LineCallbackProps {
  onNavigate?: (page: string) => void;
}

export function LineCallback({ onNavigate }: LineCallbackProps) {
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const lineUserId = params.get('line_user_id');
        const displayName = params.get('display_name');
        const pictureUrl = params.get('picture_url');
        const state = params.get('state');
        const code = params.get('code');

        if (!lineUserId || !code) {
          setError('No authorization code or user ID received');
          return;
        }

        const savedState = sessionStorage.getItem('line_oauth_state');
        if (state !== savedState) {
          setError('State mismatch - possible CSRF attack');
          return;
        }

        const line_user_id = lineUserId;
        const display_name = displayName || 'LINE User';
        const picture_url = pictureUrl;

        const { data: existingUser } = await supabase
          .from('line_users')
          .select('id')
          .eq('line_user_id', line_user_id)
          .maybeSingle();

        if (existingUser) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: `line_${line_user_id}@line.local`,
            password: `line_${line_user_id}`,
          });

          if (signInError) throw signInError;
        } else {
          const { error: signUpError } = await supabase.auth.signUp({
            email: `line_${line_user_id}@line.local`,
            password: `line_${line_user_id}`,
            options: {
              data: {
                line_user_id,
                display_name,
                picture_url,
              },
            },
          });

          if (signUpError) throw signUpError;

          await supabase.from('line_users').insert([
            {
              line_user_id,
              display_name,
              picture_url,
              created_at: new Date().toISOString(),
            },
          ]);
        }

        sessionStorage.removeItem('line_oauth_state');
        if (onNavigate) {
          onNavigate('home');
        } else {
          window.location.href = '/';
        }
      } catch (err) {
        console.error('LINE callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleCallback();
  }, [onNavigate]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-md p-6 max-w-md w-full">
          <h1 className="text-xl font-bold text-gray-900 mb-4">Authentication Error</h1>
          <p className="text-red-600 mb-6">{error}</p>
          <a
            href="/"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors inline-block text-center"
          >
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Authenticating with LINE...</p>
      </div>
    </div>
  );
}
