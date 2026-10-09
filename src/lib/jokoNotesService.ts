import { supabase } from './supabase';

export const JOKO_NOTES_SITE_KEY = 'joko-today';

export type JokoNoteFontPreset = 'handwritten' | 'display' | 'body';
export type JokoNoteImageLayout = 'stacked' | 'portrait' | 'tiny-sketch';

export interface JokoNote {
  id: string;
  site_key: string;
  page_key: string;
  placement_key: string;
  title_en: string | null;
  title_th: string | null;
  title_zh: string | null;
  body_en: string | null;
  body_th: string | null;
  body_zh: string | null;
  image_url: string | null;
  image_alt_en: string | null;
  image_alt_th: string | null;
  image_alt_zh: string | null;
  link_url: string | null;
  font_preset: JokoNoteFontPreset;
  heading_size: number;
  body_size: number;
  rotation: number;
  image_layout: JokoNoteImageLayout;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export type JokoNoteDraft = Omit<JokoNote, 'id' | 'created_at' | 'updated_at'>;

export interface JokoNotePlacementDefinition {
  pageKey: string;
  placementKey: string;
  label: string;
  description: string;
}

/**
 * JOKO Notes intentionally use code-owned placement slots.
 * Editorial content is flexible; page layout is not.
 */
export const JOKO_NOTE_PLACEMENTS: readonly JokoNotePlacementDefinition[] = [
  {
    pageKey: 'how-it-works',
    placementKey: 'intro',
    label: 'How It Works · Intro',
    description: 'A single editorial note beside the How It Works introduction.',
  },
] as const;

function pickLocalized(
  language: 'en' | 'th' | 'zh',
  en: string | null,
  th: string | null,
  zh: string | null,
): string {
  if (language === 'th') return th || en || '';
  if (language === 'zh') return zh || en || '';
  return en || '';
}

export function localizeJokoNote(
  note: JokoNote,
  language: 'en' | 'th' | 'zh',
): { title: string; body: string; imageAlt: string } {
  return {
    title: pickLocalized(language, note.title_en, note.title_th, note.title_zh),
    body: pickLocalized(language, note.body_en, note.body_th, note.body_zh),
    imageAlt: pickLocalized(language, note.image_alt_en, note.image_alt_th, note.image_alt_zh),
  };
}

export async function getPublishedJokoNote(
  pageKey: string,
  placementKey: string,
  siteKey = JOKO_NOTES_SITE_KEY,
): Promise<JokoNote | null> {
  const { data, error } = await supabase
    .from('site_joko_notes')
    .select('*')
    .eq('site_key', siteKey)
    .eq('page_key', pageKey)
    .eq('placement_key', placementKey)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw error;
  return (data as JokoNote | null) ?? null;
}

export async function adminListJokoNotes(siteKey = JOKO_NOTES_SITE_KEY): Promise<JokoNote[]> {
  const { data, error } = await supabase
    .from('site_joko_notes')
    .select('*')
    .eq('site_key', siteKey)
    .order('page_key', { ascending: true })
    .order('placement_key', { ascending: true });

  if (error) throw error;
  return (data || []) as JokoNote[];
}

export async function adminSaveJokoNote(
  draft: JokoNoteDraft,
  id?: string,
): Promise<JokoNote> {
  if (id) {
    const { data, error } = await supabase
      .from('site_joko_notes')
      .update(draft)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data as JokoNote;
  }

  const { data, error } = await supabase
    .from('site_joko_notes')
    .insert(draft)
    .select('*')
    .single();

  if (error) throw error;
  return data as JokoNote;
}

export async function adminDeleteJokoNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('site_joko_notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
