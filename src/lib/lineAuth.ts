import type { User } from '@supabase/supabase-js';

// Supabase Auth custom OAuth2 provider. Hidden until reviewed and configured.
// Existing customers may link LINE before public LINE sign-in is released.
export const LINE_LOGIN_ENABLED = import.meta.env.VITE_ENABLE_LINE_LOGIN === 'true';
export const LINE_LINKING_ENABLED = import.meta.env.VITE_ENABLE_LINE_LINKING === 'true' || LINE_LOGIN_ENABLED;
export const LINE_PROVIDER = 'custom:line' as const;

export function hasLinkedLINE(user: User | null | undefined): boolean {
  return Boolean(user?.identities?.some((identity) => identity.provider === LINE_PROVIDER));
}

export const LINE_OAUTH_DESTINATION_KEY = 'jt_line_oauth_destination';

export function lineRedirectTo(): string {
  // Keep one exact, allowlisted callback for both modes. LINE return
  // navigation and language preference live in sessionStorage, not URL params.
  return new URL('/auth/callback', window.location.origin).toString();
}
