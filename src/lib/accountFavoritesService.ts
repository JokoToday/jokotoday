import { supabase } from './supabase';
export type SavedItemType = 'creator' | 'recipe';
export interface SavedItem { item_type: SavedItemType; item_id: string; created_at: string }
export async function getSavedItems(userId: string): Promise<SavedItem[]> {
  const { data, error } = await supabase.from('account_saved_items').select('item_type,item_id,created_at').eq('user_id',userId).order('created_at',{ascending:false});
  if (error) throw error;
  return (data || []) as SavedItem[];
}
export async function setSavedItem(userId: string, type: SavedItemType, id: string, shouldSave: boolean): Promise<void> {
  const query = shouldSave
    ? supabase.from('account_saved_items').insert({user_id:userId,item_type:type,item_id:id})
    : supabase.from('account_saved_items').delete().eq('user_id',userId).eq('item_type',type).eq('item_id',id);
  const { error } = await query;
  if (error && !(shouldSave && error.code === '23505')) throw error;
}
