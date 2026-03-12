import { supabase } from './supabase';

export interface CustomerRecord {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  line_id: string | null;
  whatsapp: string | null;
  wechat_id: string | null;
  qr_token: string;
  short_code: string;
  loyalty_points: number;
}

function extractToken(raw: string): string {
  try {
    const url = new URL(raw);
    const scanMatch = url.pathname.match(/\/scan\/([A-Za-z0-9]+)/);
    if (scanMatch) return scanMatch[1];
    const cMatch = url.pathname.match(/\/c\/([^/]+)/);
    if (cMatch) return cMatch[1];
  } catch {
  }
  if (raw.includes('/scan/')) return raw.split('/scan/')[1].split('/')[0];
  if (raw.includes('/c/')) return raw.split('/c/')[1].split('/')[0];
  return raw.trim();
}

export async function lookupCustomerByQRToken(qrToken: string): Promise<CustomerRecord | null> {
  const token = extractToken(qrToken);

  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('id, name, email, phone, line_id, whatsapp, wechat_id, qr_token, short_code')
    .or(`qr_token.eq.${token},short_code.eq.${token}`)
    .maybeSingle();

  if (profileData) {
    const { data: loyaltyData } = await supabase
      .from('customers')
      .select('loyalty_points')
      .eq('id', profileData.id)
      .maybeSingle();

    return {
      ...profileData,
      loyalty_points: loyaltyData?.loyalty_points ?? 0,
    };
  }

  const { data: legacyData } = await supabase
    .from('customers')
    .select('*')
    .or(`qr_token.eq.${token},short_code.eq.${token}`)
    .maybeSingle();

  if (legacyData) {
    return {
      id: legacyData.id,
      name: legacyData.name,
      email: legacyData.email,
      phone: legacyData.phone,
      line_id: legacyData.line_id,
      whatsapp: legacyData.whatsapp,
      wechat_id: legacyData.wechat_id,
      qr_token: legacyData.qr_token,
      short_code: legacyData.short_code,
      loyalty_points: legacyData.loyalty_points ?? 0,
    };
  }

  return null;
}

export async function lookupCustomerByShortCode(shortCode: string): Promise<CustomerRecord | null> {
  return lookupCustomerByQRToken(shortCode);
}

export async function updateCustomerLoyaltyPoints(customerId: string, newPoints: number): Promise<void> {
  await supabase
    .from('customers')
    .update({ loyalty_points: newPoints })
    .eq('id', customerId);

  await supabase
    .from('user_profiles')
    .update({ updated_at: new Date().toISOString() } as any)
    .eq('id', customerId);
}
