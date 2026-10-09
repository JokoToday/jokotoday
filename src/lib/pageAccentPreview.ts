import type { JokoNoteDraft } from './jokoNotesService';

const PREVIEW_QUERY_KEY = 'jokoAccentPreview';
const PREVIEW_STORAGE_PREFIX = 'joko_page_accent_preview:';
const PREVIEW_MAX_AGE_MS = 30 * 60 * 1000;

interface StoredPageAccentPreview {
  createdAt: number;
  draft: JokoNoteDraft;
}

export interface ActivePageAccentPreview {
  token: string;
  draft: JokoNoteDraft;
}

function storageKey(token: string) {
  return `${PREVIEW_STORAGE_PREFIX}${token}`;
}

export function createPageAccentPreview(draft: JokoNoteDraft): string {
  const token = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const payload: StoredPageAccentPreview = {
    createdAt: Date.now(),
    draft,
  };

  window.localStorage.setItem(storageKey(token), JSON.stringify(payload));
  return token;
}

export function buildPageAccentPreviewUrl(pageKey: string, token: string): string {
  const path = pageKey === 'home'
    ? '/'
    : pageKey === 'how-it-works'
      ? '/how-it-works'
      : pageKey === 'about'
        ? '/about'
        : '/products';

  const url = new URL(path, window.location.origin);
  url.searchParams.set(PREVIEW_QUERY_KEY, token);
  return url.toString();
}

export function getActivePageAccentPreview(pageKey: string): ActivePageAccentPreview | null {
  if (typeof window === 'undefined') return null;

  const token = new URLSearchParams(window.location.search).get(PREVIEW_QUERY_KEY);
  if (!token) return null;

  const raw = window.localStorage.getItem(storageKey(token));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredPageAccentPreview;
    if (!parsed?.draft || parsed.draft.page_key !== pageKey) return null;

    if (!Number.isFinite(parsed.createdAt) || Date.now() - parsed.createdAt > PREVIEW_MAX_AGE_MS) {
      window.localStorage.removeItem(storageKey(token));
      return null;
    }

    return { token, draft: parsed.draft };
  } catch {
    window.localStorage.removeItem(storageKey(token));
    return null;
  }
}

export function removePageAccentPreview(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(token));
}
