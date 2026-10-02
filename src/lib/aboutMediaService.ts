import { supabase } from './supabase';

export const JOKO_SITE_KEY = 'joko-today';

export type GalleryMediaType = 'image' | 'video';

export interface GalleryItem {
  id: string;
  site_key: string;
  media_type: GalleryMediaType;
  media_url: string;
  thumbnail_url: string | null;
  category: string;
  title_en: string | null;
  title_th: string | null;
  title_zh: string | null;
  caption_en: string | null;
  caption_th: string | null;
  caption_zh: string | null;
  alt_en: string | null;
  alt_th: string | null;
  alt_zh: string | null;
  sort_order: number;
  show_on_homepage: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type ExternalSourceType =
  | 'google_maps'
  | 'tiktok'
  | 'rednote'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'other';

export type ExternalContentType = 'review' | 'video' | 'image' | 'post';

export interface ExternalMention {
  id: string;
  site_key: string;
  source_type: ExternalSourceType;
  content_type: ExternalContentType;
  author_name: string | null;
  title: string | null;
  excerpt: string | null;
  source_language: string | null;
  rating: number | null;
  source_url: string;
  embed_url: string | null;
  thumbnail_url: string | null;
  posted_at: string | null;
  sort_order: number;
  show_on_homepage: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type GalleryItemDraft = Omit<GalleryItem, 'id' | 'created_at' | 'updated_at'>;
export type ExternalMentionDraft = Omit<ExternalMention, 'id' | 'created_at' | 'updated_at'>;

function orderGallery(items: GalleryItem[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

function orderMentions(items: ExternalMention[]) {
  return [...items].sort((a, b) => a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at));
}

export async function getPublishedGalleryItems(
  siteKey = JOKO_SITE_KEY,
  options?: { homepageOnly?: boolean; limit?: number },
): Promise<GalleryItem[]> {
  let query = supabase
    .from('site_gallery_items')
    .select('*')
    .eq('site_key', siteKey)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (options?.homepageOnly) query = query.eq('show_on_homepage', true);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return orderGallery((data || []) as GalleryItem[]);
}

export async function getPublishedExternalMentions(
  siteKey = JOKO_SITE_KEY,
  options?: { homepageOnly?: boolean; limit?: number; sourceType?: ExternalSourceType },
): Promise<ExternalMention[]> {
  let query = supabase
    .from('site_external_mentions')
    .select('*')
    .eq('site_key', siteKey)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (options?.homepageOnly) query = query.eq('show_on_homepage', true);
  if (options?.sourceType) query = query.eq('source_type', options.sourceType);
  if (options?.limit) query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return orderMentions((data || []) as ExternalMention[]);
}

export async function adminListGalleryItems(siteKey = JOKO_SITE_KEY): Promise<GalleryItem[]> {
  const { data, error } = await supabase
    .from('site_gallery_items')
    .select('*')
    .eq('site_key', siteKey)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return orderGallery((data || []) as GalleryItem[]);
}

export async function adminSaveGalleryItem(
  draft: GalleryItemDraft,
  id?: string,
): Promise<GalleryItem> {
  if (id) {
    const { data, error } = await supabase
      .from('site_gallery_items')
      .update(draft)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as GalleryItem;
  }

  const { data, error } = await supabase
    .from('site_gallery_items')
    .insert(draft)
    .select('*')
    .single();
  if (error) throw error;
  return data as GalleryItem;
}

export async function adminDeleteGalleryItem(id: string): Promise<void> {
  const { error } = await supabase.from('site_gallery_items').delete().eq('id', id);
  if (error) throw error;
}

export async function adminListExternalMentions(siteKey = JOKO_SITE_KEY): Promise<ExternalMention[]> {
  const { data, error } = await supabase
    .from('site_external_mentions')
    .select('*')
    .eq('site_key', siteKey)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return orderMentions((data || []) as ExternalMention[]);
}

export async function adminSaveExternalMention(
  draft: ExternalMentionDraft,
  id?: string,
): Promise<ExternalMention> {
  if (id) {
    const { data, error } = await supabase
      .from('site_external_mentions')
      .update(draft)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as ExternalMention;
  }

  const { data, error } = await supabase
    .from('site_external_mentions')
    .insert(draft)
    .select('*')
    .single();
  if (error) throw error;
  return data as ExternalMention;
}

export async function adminDeleteExternalMention(id: string): Promise<void> {
  const { error } = await supabase.from('site_external_mentions').delete().eq('id', id);
  if (error) throw error;
}

export function localizedGalleryText(
  item: GalleryItem,
  language: 'en' | 'th' | 'zh',
): { title: string; caption: string; alt: string } {
  const pick = (en: string | null, th: string | null, zh: string | null) => {
    if (language === 'th') return th || en || '';
    if (language === 'zh') return zh || en || '';
    return en || '';
  };

  return {
    title: pick(item.title_en, item.title_th, item.title_zh),
    caption: pick(item.caption_en, item.caption_th, item.caption_zh),
    alt: pick(item.alt_en, item.alt_th, item.alt_zh) || 'JOKO gallery media',
  };
}
