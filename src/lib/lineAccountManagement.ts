import type { SupabaseClient, User } from '@supabase/supabase-js';
import { LINE_PROVIDER } from './lineAuth';
import { hasVerifiedEmail } from './lineProfile';

export class LINEAccountActionError extends Error {
  constructor(public code: 'emailRequired' | 'stopNotificationsFirst' | 'profileUnavailable' | 'sessionChanged') {
    super(code);
  }
}

export function hasEmailLogin(user: User | null | undefined): boolean {
  return hasVerifiedEmail(user) && Boolean(user?.identities?.some(identity => identity.provider === 'email'));
}

async function verifiedUser(client: SupabaseClient, expectedUserId: string): Promise<User> {
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user || data.user.id !== expectedUserId) throw new LINEAccountActionError('sessionChanged');
  return data.user;
}

export async function stopLINENotifications(client: SupabaseClient, expectedUserId: string): Promise<void> {
  const user = await verifiedUser(client, expectedUserId);
  if (!hasVerifiedEmail(user)) throw new LINEAccountActionError('emailRequired');
  // Save only these preferences; do not submit or overwrite unrelated form edits.
  const { data, error } = await client.from('user_profiles')
    .update({ notification_email_enabled: true, notification_line_enabled: false })
    .eq('id', user.id).select('notification_email_enabled,notification_line_enabled').maybeSingle();
  if (error) throw error;
  if (!data || !data.notification_email_enabled || data.notification_line_enabled) {
    throw new LINEAccountActionError('profileUnavailable');
  }
}

export async function disconnectLINELogin(client: SupabaseClient, expectedUserId: string): Promise<void> {
  const user = await verifiedUser(client, expectedUserId);
  if (!hasEmailLogin(user)) throw new LINEAccountActionError('emailRequired');
  const identity = user.identities?.find(item => item.provider === LINE_PROVIDER);
  if (!identity) return;
  // Read persisted preferences, not checkbox state or browser storage.
  const { data, error } = await client.from('user_profiles')
    .select('notification_email_enabled,notification_line_enabled').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (!data) throw new LINEAccountActionError('profileUnavailable');
  if (data.notification_line_enabled || !data.notification_email_enabled) {
    throw new LINEAccountActionError('stopNotificationsFirst');
  }
  // Supabase checks ownership and rejects removal of the last identity.
  const { error: unlinkError } = await client.auth.unlinkIdentity(identity);
  if (unlinkError) throw unlinkError;
}
