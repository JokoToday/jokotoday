import type { SupabaseClient, User } from '@supabase/supabase-js';
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

// A LINE display name is only a suggestion for an incomplete blank profile.
// Compare the stored name at write time to preserve edits from another tab.
export async function fillMissingLINEProfileName(
  client: SupabaseClient, userId: string,
  profile: { name: string | null; profile_completed: boolean }, suggestedName: string,
): Promise<string | null> {
  if (profile.profile_completed || profile.name?.trim() || !suggestedName.trim()) return null;
  let query = client.from('user_profiles').update({ name: suggestedName.trim() })
    .eq('id', userId).eq('profile_completed', false);
  query = profile.name === null ? query.is('name', null) : query.eq('name', profile.name);
  const { data, error } = await query.select('name').maybeSingle();
  return error ? null : data?.name ?? null;
}
