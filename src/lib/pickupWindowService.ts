import { supabase } from './supabase';
import { parseBooleanSetting } from './pickupV2Rollout';

export async function getPickupWindowsRequired(): Promise<boolean> {
  const { data, error } = await supabase.from('cms_settings').select('value')
    .eq('setting_key', 'pickup_windows_required').maybeSingle();
  if (error) throw error;
  return parseBooleanSetting(data?.value);
}

export async function setPickupWindowsRequired(required: boolean): Promise<void> {
  const { error } = await supabase.rpc('admin_set_pickup_windows_required_v1', { p_required: required });
  if (error) throw error;
}
