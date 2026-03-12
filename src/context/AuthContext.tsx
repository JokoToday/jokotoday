import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserRole } from '../lib/rolePermissions';

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
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  profileLoading: boolean;
  signInWithMagicLink: (email: string) => Promise<void>;
  signInWithQR: (qrToken: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithLINE: () => Promise<void>;
  completeProfile: (data: { name: string; phone: string; line_id?: string; whatsapp?: string; wechat_id?: string }) => Promise<void>;
  updateProfileDetails: (data: { name: string; phone: string; line_id?: string; whatsapp?: string; wechat_id?: string }) => Promise<void>;
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
          setUserRole(null);
        }
      })();
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
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
    if (error) {
      console.error('Logout error:', error);
    }
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
        signInWithMagicLink,
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
