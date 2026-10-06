import type { User } from '@supabase/supabase-js';
import { hasLinkedLINE } from './lineAuth';

// LINE grants a display name and an opaque provider user ID, not the
// customer's searchable LINE ID. Never put provider identifiers into line_id.
export function lineDisplayName(user: User | null | undefined): string {
  if (!user || !hasLinkedLINE(user)) return '';
  const identity = user.identities?.find((item) => item.provider === 'custom:line');
  const identityData = identity?.identity_data;
  const candidates = [
    identityData?.name,
    identityData?.full_name,
    user.user_metadata?.name,
    user.user_metadata?.full_name,
  ];
  return candidates.find((value): value is string =>
    typeof value === 'string' && Boolean(value.trim()))?.trim().slice(0, 160) || '';
}

export function hasVerifiedEmail(user: User | null | undefined): boolean {
  return Boolean(user?.email?.trim() && user?.email_confirmed_at);
}

export function needsLINEEmailForCheckout(user: User | null | undefined): boolean {
  return Boolean(user && hasLinkedLINE(user) && !hasVerifiedEmail(user));
}
