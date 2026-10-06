// Pure, side-effect-free routing for Supabase Send Email Auth Hook events.
// Email-change hashes have counterintuitive names for backwards compatibility:
// token_hash_new belongs to CURRENT email, token_hash belongs to NEW email.
// Reference: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
export interface AuthEmailEvent {
  user: {
    id: string;
    email?: string | null;
    new_email?: string | null;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    email_action_type: string;
    token?: string | null;
    token_hash?: string | null;
    token_new?: string | null;
    token_hash_new?: string | null;
    redirect_to?: string | null;
    site_url?: string | null;
  };
}

export interface AuthEmailRecipient {
  address: string;
  token: string;
  tokenHash: string;
  audience: 'standard' | 'email_change_current' | 'email_change_new';
}

export function recipientsForAuthEmail(payload: AuthEmailEvent): AuthEmailRecipient[] {
  if (!payload?.user || !payload?.email_data) {
    throw new Error('Invalid auth email event structure');
  }

  const user = payload.user;
  const d = payload.email_data;
  const currentEmail = user.email?.trim() || '';
  const newEmail = user.new_email?.trim() || '';
  const tokenHash = d.token_hash?.trim() || '';
  const tokenHashNew = d.token_hash_new?.trim() || '';
  const token = d.token?.trim() || '';
  const tokenNew = d.token_new?.trim() || '';

  if (d.email_action_type === 'email_change') {
    if (!newEmail || !tokenHash) {
      throw new Error('Email change requires a new email address and token hash');
    }

    const recipients: AuthEmailRecipient[] = [];
    // When secure email change is enabled the current address gets
    // token + token_hash_new. Email-less LINE users have no old recipient.
    if (currentEmail && tokenHashNew) {
      recipients.push({
        address: currentEmail,
        token,
        tokenHash: tokenHashNew,
        audience: 'email_change_current',
      });
    }

    // New email always receives token_hash and, if present, token_new.
    // With secure change disabled some Auth versions place the new
    // address's OTP in token instead; only the link/hash matters here.
    recipients.push({
      address: newEmail,
      token: tokenNew || token,
      tokenHash,
      audience: 'email_change_new',
    });
    return recipients;
  }

  if (!currentEmail || !tokenHash) {
    throw new Error('Missing current email or token hash');
  }
  if ((d.email_action_type === 'magiclink' || d.email_action_type === 'signup') && !token) {
    throw new Error('OTP flow missing verification code');
  }

  return [{
    address: currentEmail,
    token,
    tokenHash,
    audience: 'standard',
  }];
}
