import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { generateQRToken } from '../lib/qrTokenGenerator';
import { UserRole } from '../lib/rolePermissions';

export interface UserProfile {
  id: string;
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
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  profileLoading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInWithQR: (qrToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithPhone: (phone: string) => Promise<void>;
  verifyPhone: (phone: string, token: string) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'facebook' | 'github') => Promise<void>;
  signInWithLINE: () => Promise<void>;
  mockLogin: () => Promise<void>;
  updateProfile: (profile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at' | 'profile_completed' | 'role'>) => Promise<void>;
  checkProfileComplete: () => Promise<boolean>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
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
      setUserProfile(data);
      if (data) {
        setUserRole(data.role || 'staff');
      }
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
        }
      })();
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://joko-today-pre-order-yamv.bolt.host/auth/callback',
      },
    });

    if (error) {
      console.error('SignUp error:', error);
      throw error;
    }

    if (!data.user) {
      throw new Error('Signup failed - no user returned');
    }

    console.log('SignUp response:', {
      user: data.user,
      session: data.session,
      confirmationRequired: !data.session
    });

    if (data.session) {
      const qrToken = generateQRToken();

      try {
        console.log('Creating profile with QR for user:', data.user.id);

        const { data: profileResult, error: profileError } = await supabase
          .rpc('create_user_profile_with_qr', {
            p_email: data.user.email,
            p_name: email.split('@')[0],
            p_phone: 'pending',
            p_qr_token: qrToken,
            p_line_id: email,
            p_whatsapp: null,
            p_wechat_id: null
          });

        if (profileError) {
          console.error('Error creating user profile:', {
            code: profileError.code,
            message: profileError.message,
            details: profileError.details,
            hint: profileError.hint
          });

          if (profileError.message.includes('Profile already exists')) {
            throw new Error('An account with this email already exists. Please sign in instead.');
          } else if (profileError.code === '23505') {
            throw new Error('This account already exists. Please sign in instead.');
          } else if (profileError.code === '42501') {
            throw new Error('Permission denied. Please contact support.');
          } else {
            throw new Error(`Unable to create account: ${profileError.message}`);
          }
        }

        console.log('Profile created successfully:', profileResult);

        await fetchUserProfile(data.user.id);
      } catch (err) {
        console.error('Error in post-signup profile creation:', err);
        throw err;
      }
    } else {
      throw new Error('CONFIRMATION_REQUIRED');
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: 'https://joko-today-pre-order-yamv.bolt.host/auth/callback',
      },
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
    if (error) throw error;
    setUserProfile(null);
    setUserRole(null);
  };

  const signInWithPhone = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      channel: 'sms',
    });
    if (error) throw error;
  };

  const verifyPhone = async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    if (error) throw error;
  };

  const signInWithOAuth = async (provider: 'google' | 'facebook' | 'github') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: 'https://joko-today-pre-order-yamv.bolt.host/auth/callback',
      },
    });
    if (error) throw error;
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

  const mockLogin = async () => {
    const mockLineUserId = 'LINE_MOCK_' + Date.now();

    try {
      const { data: newUser, error: insertError } = await supabase
        .from('line_users')
        .insert([
          {
            line_user_id: mockLineUserId,
            display_name: 'Mock User',
            picture_url: null,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      setUser(newUser as any);
      setSession({ user: newUser as any } as any);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Mock login failed';
      throw new Error(errorMessage);
    }
  };

  const updateProfile = async (profile: Omit<UserProfile, 'id' | 'created_at' | 'updated_at' | 'profile_completed'>) => {
    if (!user) throw new Error('No user logged in');

    const qrToken = generateQRToken();

    const profileData = {
      id: user.id,
      ...profile,
      profile_completed: true,
      qr_token: qrToken,
    };

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert(profileData)
      .select()
      .single();

    if (error) throw error;

    const { data: shortCodeData } = await supabase
      .rpc('generate_next_short_code');

    const { error: updateProfileError } = await supabase
      .from('user_profiles')
      .update({ short_code: shortCodeData })
      .eq('id', user.id);

    if (updateProfileError) throw updateProfileError;

    const customerData = {
      id: user.id,
      email: user.email,
      name: profile.name,
      phone: profile.phone,
      line_id: profile.line_id || null,
      whatsapp: profile.whatsapp || null,
      wechat_id: profile.wechat_id || null,
      qr_token: qrToken,
      short_code: shortCodeData,
    };

    const { error: customerError } = await supabase
      .from('customers')
      .upsert(customerData);

    if (customerError) throw customerError;

    setUserProfile({ ...data, short_code: shortCodeData });
  };

  const checkProfileComplete = async (): Promise<boolean> => {
    if (!user) return false;

    const profile = await fetchUserProfile(user.id);
    return profile?.profile_completed ?? false;
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
        signUp,
        signIn,
        signInWithMagicLink,
        signInWithQR,
        signOut,
        signInWithPhone,
        verifyPhone,
        signInWithOAuth,
        signInWithLINE,
        mockLogin,
        updateProfile,
        checkProfileComplete,
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
