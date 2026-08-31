import { supabase } from './supabase';

export const PICKUP_V2_CUSTOMER_ENABLED_KEY = 'pickup_v2_customer_enabled';

export function parseBooleanSetting(value: string | null | undefined): boolean {
  if (!value) return false;
  return ['true', '1', 'yes', 'on', 'enabled'].includes(value.trim().toLowerCase());
}

export async function getPickupV2CustomerEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from('cms_settings')
    .select('value')
    .eq('setting_key', PICKUP_V2_CUSTOMER_ENABLED_KEY)
    .maybeSingle();

  if (error) {
    console.error('Could not read Pickup v2 rollout setting:', error);
    return false;
  }

  return parseBooleanSetting(data?.value);
}

export async function setPickupV2CustomerEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('cms_settings')
    .upsert(
      {
        setting_key: PICKUP_V2_CUSTOMER_ENABLED_KEY,
        value: enabled ? 'true' : 'false',
      },
      { onConflict: 'setting_key' },
    );

  if (error) throw error;
}
