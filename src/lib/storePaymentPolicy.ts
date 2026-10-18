import { supabase } from './supabase';

export interface StorePaymentPolicy {
  policy_key: 'default';
  primary_provider: 'kshop_master';
  fallback_provider: 'stripe_promptpay';
  fallback_enabled: boolean;
  checkout_enabled: false;
}

/** Read-only Store policy. Does not create payment intents or authorize checkout. */
export async function getStorePaymentPolicy(): Promise<StorePaymentPolicy> {
  const { data, error } = await supabase.from('store_payment_policy')
    .select('policy_key,primary_provider,fallback_provider,fallback_enabled,checkout_enabled')
    .eq('policy_key', 'default').single();
  if (error) throw error;
  return data as StorePaymentPolicy;
}
