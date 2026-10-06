import type { User } from '@supabase/supabase-js';
import type { Language } from '../translations';

// Supabase Auth custom OAuth2 provider. Hidden until reviewed and configured.
// Existing customers may link LINE before public LINE sign-in is released.
export const LINE_LOGIN_ENABLED = import.meta.env.VITE_ENABLE_LINE_LOGIN === 'true';
export const LINE_LINKING_ENABLED = import.meta.env.VITE_ENABLE_LINE_LINKING === 'true' || LINE_LOGIN_ENABLED;
export const LINE_PROVIDER = 'custom:line' as const;

export function hasLinkedLINE(user: User | null | undefined): boolean {
  return Boolean(user?.identities?.some((identity) => identity.provider === LINE_PROVIDER));
}

export function lineRedirectTo(destination: 'home' | 'profile', language: Language): string {
  // Do not let an old VITE_APP_URL redirect tokens to the retired Bolt host.
  const callback = new URL('/auth/callback', window.location.origin);
  callback.searchParams.set('lang', language);
  if (destination === 'profile') callback.searchParams.set('next', 'profile');
  return callback.toString();
}
