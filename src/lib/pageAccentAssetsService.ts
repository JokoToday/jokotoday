import { supabase } from './supabase';
import { JOKO_NOTES_SITE_KEY } from './jokoNotesService';

export interface PageAccentAsset {
  id: string;
  site_key: string;
  asset_type: 'bubble';
  name: string;
  image_url: string;
  alt_text: string;
  created_at: string;
  updated_at: string;
}

export interface PageAccentAssetDraft {
  site_key: string;
  asset_type: 'bubble';
  name: string;
  image_url: string;
  alt_text: string;
}

export async function adminListPageAccentAssets(
  siteKey = JOKO_NOTES_SITE_KEY,
): Promise<PageAccentAsset[]> {
  const { data, error } = await supabase
    .from('site_page_accent_assets')
    .select('*')
    .eq('site_key', siteKey)
    .eq('asset_type', 'bubble')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as PageAccentAsset[];
}

export async function adminSavePageAccentAsset(
  draft: PageAccentAssetDraft,
): Promise<PageAccentAsset> {
  const normalized: PageAccentAssetDraft = {
    ...draft,
    name: draft.name.trim(),
    image_url: draft.image_url.trim(),
    alt_text: draft.alt_text.trim(),
  };

  if (!normalized.name) throw new Error('Give this bubble artwork a reusable name.');
  if (!normalized.image_url) throw new Error('Upload or choose bubble artwork first.');
  if (!normalized.alt_text) throw new Error('Add an accessibility label for this bubble artwork.');

  const { data, error } = await supabase
    .from('site_page_accent_assets')
    .upsert(normalized, {
      onConflict: 'site_key,image_url',
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as PageAccentAsset;
}

export async function adminDeletePageAccentAsset(id: string): Promise<void> {
  const { error } = await supabase
    .from('site_page_accent_assets')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
