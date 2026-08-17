import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserRole } from '../lib/rolePermissions';
import { getPublicAppUrl } from '../lib/appUrl';
import { useLanguage } from './LanguageContext';
import type { Language } from '../translations';

export interface UserProfile {
  id: string;
  email?: string;
  name: string;
  phone: string;
  line_id?: string;
  whatsapp?: string;
  wechat_id?: string;
  profile_picture_url?: string;
  profile_completed: boolean;
  role: UserRole;
  created_at: string;
  updated_at: string;
  qr_token?: string;
  short_code?: string;
  preferred_language?: Language | null;
}

function isSupportedLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'th' || value === 'zh';
}

const AUTH_LANGUAGE_STORAGE_KEY = 'jt_auth_language';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  profileLoading: boolean;
  sendEmailOtp: (email: string, requestedLanguage?: Language) => Promise<void>;
  verifyEmailOtp: (email: string, token: string) => Promise<void>;
  signInWithQR: (qrToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithLINE: () => Promise<void>;
  completeProfile: (data: { name: string; phone: string; line_id?: string; whatsapp?: string; wechat_id?: string }) => Promise<void>;
  updateProfileDetails: (data: { name: string; phone: string; line_id?: string; whatsapp?: string; wechat_id?: string }) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { language, setLanguage } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const fetchUserProfile = async (userId: string) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUserRole(data.role === 'admin' || data.role === 'staff' ? data.role : null);

        const pendingAuthLanguage = sessionStorage.getItem(AUTH_LANGUAGE_STORAGE_KEY);
        if (isSupportedLanguage(pendingAuthLanguage)) {
          setLanguage(pendingAuthLanguage);

          if (data.preferred_language !== pendingAuthLanguage) {
            const { error: languageUpdateError } = await supabase
              .from('user_profiles')
              .update({
                preferred_language: pendingAuthLanguage,
                updated_at: new Date().toISOString(),
              })
              .eq('id', userId);

            if (languageUpdateError) {
              console.error('Error updating preferred language after sign-in:', languageUpdateError);
            } else {
              data.preferred_language = pendingAuthLanguage;
            }
          }

          sessionStorage.removeItem(AUTH_LANGUAGE_STORAGE_KEY);
        } else if (isSupportedLanguage(data.preferred_language)) {
          setLanguage(data.preferred_language);
        }
      }

      setUserProfile(data);
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
      setUserRole(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchUserProfile(session.user.id);
        } else {
          setUserProfile(null);
          setUserRole(null);
        }
      })();
    });

    return () => subscription?.unsubscribe();
  }, []);

  const sendEmailOtp = async (email: string, requestedLanguage?: Language) => {
    const authLanguage = requestedLanguage ?? language;
    const callbackUrl = new URL(`${getPublicAppUrl()}/auth/callback`);
    callbackUrl.searchParams.set('lang', authLanguage);
    sessionStorage.setItem(AUTH_LANGUAGE_STORAGE_KEY, authLanguage);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    });
    if (error) {
      sessionStorage.removeItem(AUTH_LANGUAGE_STORAGE_KEY);
      throw error;
    }
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
  };

  const signInWithQR = async (qrToken: string) => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/qr-login`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ qr_token: qrToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'QR login failed');
    }

    const { access_token, refresh_token } = await response.json();

    const { error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
    }
    sessionStorage.removeItem(AUTH_LANGUAGE_STORAGE_KEY);
    setUser(null);
    setSession(null);
    setUserProfile(null);
    setUserRole(null);
  };

  const signInWithLINE = async () => {
    const lineChannelId = import.meta.env.VITE_LINE_CHANNEL_ID;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!lineChannelId || !supabaseUrl) {
      throw new Error('LINE credentials not configured');
    }

    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('line_oauth_state', state);

    const redirectUri = `${supabaseUrl}/functions/v1/line-callback`;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: lineChannelId,
      redirect_uri: redirectUri,
      state,
      scope: 'openid profile',
    });

    window.location.href = `https://web.line.me/web/login?${params.toString()}`;
  };

  const completeProfile = async (data: { name: string; phone: string; line_id?: string; whatsapp?: string; wechat_id?: string }) => {
    if (!user) throw new Error('No user logged in');

    const qrToken = crypto.randomUUID();

    const { data: shortCodeData } = await supabase.rpc('generate_next_short_code');

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update({
        name: data.name,
        phone: data.phone,
        line_id: data.line_id || null,
        whatsapp: data.whatsapp || null,
        wechat_id: data.wechat_id || null,
        qr_token: qrToken,
        short_code: shortCodeData || null,
        preferred_language: language,
        profile_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    setUserProfile(profile);
  };

  const updateProfileDetails = async (data: { name: string; phone: string; line_id?: string; whatsapp?: string; wechat_id?: string }) => {
    if (!user) throw new Error('No user logged in');

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .update({
        name: data.name,
        phone: data.phone,
        line_id: data.line_id || null,
        whatsapp: data.whatsapp || null,
        wechat_id: data.wechat_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    setUserProfile(profile);
  };

  const refreshProfile = async (): Promise<void> => {
    if (!user) return;
    await fetchUserProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        userProfile,
        userRole,
        profileLoading,
        sendEmailOtp,
        verifyEmailOtp,
        signInWithQR,
        signOut,
        signInWithLINE,
        completeProfile,
        updateProfileDetails,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
