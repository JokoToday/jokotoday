import { supabase } from './supabase';

export const JOKO_NOTES_SITE_KEY = 'joko-today';

export type JokoAccentType = 'note' | 'bubble';
export type JokoBubbleSize = 'small' | 'medium' | 'large';
export type JokoNoteFontPreset = 'handwritten' | 'display' | 'body';
export type JokoNoteImageLayout = 'stacked' | 'portrait' | 'tiny-sketch';

export interface JokoNote {
  id: string;
  site_key: string;
  page_key: string;
  placement_key: string;
  accent_type: JokoAccentType;
  bubble_size: JokoBubbleSize;
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
  placementKey: string;
  label: string;
  description: string;
}

export interface JokoNotePageDefinition {
  pageKey: string;
  label: string;
  description: string;
  placements: readonly JokoNotePlacementDefinition[];
}

/**
 * Page Accents use fixed, code-owned safe zones.
 * Admin chooses one accent per page: either a JOKO Note or a brand bubble.
 * Arbitrary x/y positioning is intentionally not supported because it is fragile
 * across responsive breakpoints.
 */
export const JOKO_NOTE_PAGES: readonly JokoNotePageDefinition[] = [
  {
    pageKey: 'products',
    label: 'Products',
    description: 'Editorial note around the catalogue.',
    placements: [
      {
        placementKey: 'below-browse-controls',
        label: 'Below browse controls',
        description: 'Between the Products/browse area and category filters.',
      },
      {
        placementKey: 'below-categories',
        label: 'Below categories',
        description: 'Between category filters and the product catalogue.',
      },
      {
        placementKey: 'after-catalogue',
        label: 'After catalogue',
        description: 'A closing note after the visible product catalogue.',
      },
    ],
  },
  {
    pageKey: 'how-it-works',
    label: 'How It Works',
    description: 'A contextual note around the ordering journey.',
    placements: [
      {
        placementKey: 'intro',
        label: 'Below introduction',
        description: 'Directly below the page heading and subtitle.',
      },
      {
        placementKey: 'after-steps',
        label: 'After the four steps',
        description: 'Between the four-step overview and ordering details.',
      },
      {
        placementKey: 'before-start-ordering',
        label: 'Before Start Ordering',
        description: 'After ordering details and before the final call to action.',
      },
    ],
  },
  {
    pageKey: 'about',
    label: 'About',
    description: 'A personal editorial note around the JOKO story.',
    placements: [
      {
        placementKey: 'intro',
        label: 'Below page title',
        description: 'Directly below the About heading.',
      },
      {
        placementKey: 'after-story',
        label: 'After story',
        description: 'Between the story/mission card and the three value cards.',
      },
      {
        placementKey: 'before-pickup',
        label: 'Before pickup locations',
        description: 'Between the value cards and pickup-location panel.',
      },
    ],
  },
] as const;

export const JOKO_BUBBLE_PAGES: readonly JokoNotePageDefinition[] = [
  {
    pageKey: 'products',
    label: 'Products',
    description: 'A single-language brand reaction in the Products header.',
    placements: [
      {
        placementKey: 'header-center',
        label: 'Header center',
        description: 'Between the Products heading and browse controls on desktop; below the heading on smaller screens.',
      },
    ],
  },
] as const;

export function getJokoNotePage(pageKey: string): JokoNotePageDefinition | undefined {
  return JOKO_NOTE_PAGES.find((page) => page.pageKey === pageKey);
}

export function getJokoBubblePage(pageKey: string): JokoNotePageDefinition | undefined {
  return JOKO_BUBBLE_PAGES.find((page) => page.pageKey === pageKey);
}

export function getJokoAccentPage(
  pageKey: string,
  accentType: JokoAccentType,
): JokoNotePageDefinition | undefined {
  return accentType === 'bubble' ? getJokoBubblePage(pageKey) : getJokoNotePage(pageKey);
}

export function isRegisteredJokoAccentPlacement(
  pageKey: string,
  placementKey: string,
  accentType: JokoAccentType,
): boolean {
  const page = getJokoAccentPage(pageKey, accentType);
  return Boolean(page?.placements.some((placement) => placement.placementKey === placementKey));
}

export function isRegisteredJokoNotePlacement(pageKey: string, placementKey: string): boolean {
  return isRegisteredJokoAccentPlacement(pageKey, placementKey, 'note');
}

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
    .eq('accent_type', 'note')
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw error;
  return (data as JokoNote | null) ?? null;
}

export async function getPublishedJokoBubble(
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
    .eq('accent_type', 'bubble')
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
  if (!isRegisteredJokoAccentPlacement(draft.page_key, draft.placement_key, draft.accent_type)) {
    throw new Error('Choose one of the registered safe zones for this page and accent type.');
  }
  if (draft.accent_type === 'bubble' && !draft.image_url) {
    throw new Error('Upload a bubble illustration before saving.');
  }

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
