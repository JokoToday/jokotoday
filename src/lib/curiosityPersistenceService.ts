import type { CuriosityEpisode } from '../platform/curiosity';
import { supabase } from './supabase';

export const JOKO_CURIOSITY_SITE_KEY = 'joko-today';
const CURIOSITY_READER_TOKEN_KEY = 'jt_curiosity_reader_token';

export interface CuriosityWonderState {
  count: number;
  wondered: boolean;
}

export interface CuriosityAdminPublishedState {
  revisionId: string;
  revisionNumber: number;
  publishedAt: string;
  publishedBy: string | null;
}

export interface CuriosityAdminState {
  exists: true;
  curiosityId: string;
  slug: string;
  lockVersion: number;
  draft: {
    document: CuriosityEpisode;
    updatedAt: string;
    updatedBy: string | null;
  };
  published: CuriosityAdminPublishedState | null;
  wonderCount: number;
}

export class CuriosityPersistenceConflictError extends Error {
  constructor(message = 'This Curiosity changed in another Admin session. Reload it before saving again.') {
    super(message);
    this.name = 'CuriosityPersistenceConflictError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Invalid Curiosity response: ${field}`);
  return value;
}

function requireNumber(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid Curiosity response: ${field}`);
  return parsed;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEpisode(value: unknown): CuriosityEpisode {
  if (!isRecord(value)) throw new Error('Stored Curiosity document is not an object.');
  if (value.schemaVersion !== 1) throw new Error('Stored Curiosity uses an unsupported schema version.');
  requireString(value.id, 'document.id');
  requireString(value.slug, 'document.slug');
  if (!isRecord(value.question) || !isRecord(value.summary)) {
    throw new Error('Stored Curiosity is missing localized question or summary content.');
  }
  if (!Array.isArray(value.topics)) throw new Error('Stored Curiosity topics are invalid.');
  return value as unknown as CuriosityEpisode;
}

function parseAdminState(value: unknown): CuriosityAdminState | null {
  if (!isRecord(value)) throw new Error('Invalid Curiosity Admin response.');
  if (value.exists === false) return null;
  if (value.exists !== true) throw new Error('Invalid Curiosity Admin response: exists.');
  if (!isRecord(value.draft)) throw new Error('Invalid Curiosity Admin response: draft.');

  const publishedValue = value.published;
  let published: CuriosityAdminPublishedState | null = null;
  if (publishedValue !== null && publishedValue !== undefined) {
    if (!isRecord(publishedValue)) throw new Error('Invalid Curiosity Admin response: published.');
    published = {
      revisionId: requireString(publishedValue.revisionId, 'published.revisionId'),
      revisionNumber: requireNumber(publishedValue.revisionNumber, 'published.revisionNumber'),
      publishedAt: requireString(publishedValue.publishedAt, 'published.publishedAt'),
      publishedBy: nullableString(publishedValue.publishedBy),
    };
  }

  return {
    exists: true,
    curiosityId: requireString(value.curiosityId, 'curiosityId'),
    slug: requireString(value.slug, 'slug'),
    lockVersion: requireNumber(value.lockVersion, 'lockVersion'),
    draft: {
      document: parseEpisode(value.draft.document),
      updatedAt: requireString(value.draft.updatedAt, 'draft.updatedAt'),
      updatedBy: nullableString(value.draft.updatedBy),
    },
    published,
    wonderCount: requireNumber(value.wonderCount ?? 0, 'wonderCount'),
  };
}

function getReaderToken(): string {
  const existing = window.localStorage.getItem(CURIOSITY_READER_TOKEN_KEY);
  if (existing) return existing;
  const token = window.crypto.randomUUID();
  window.localStorage.setItem(CURIOSITY_READER_TOKEN_KEY, token);
  return token;
}

function isPersistenceUnavailable(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST202'
    || error.code === '42883'
    || Boolean(error.message?.includes('get_published_curiosity_catalog_v1'));
}

function throwRpcError(error: { code?: string; message: string }): never {
  if (error.code === '40001') throw new CuriosityPersistenceConflictError();
  throw new Error(error.message);
}

export async function loadPublishedCuriosityCatalog(
  siteKey = JOKO_CURIOSITY_SITE_KEY,
): Promise<CuriosityEpisode[] | null> {
  const { data, error } = await supabase.rpc('get_published_curiosity_catalog_v1', {
    p_site_key: siteKey,
  });
  if (error) {
    if (isPersistenceUnavailable(error)) return null;
    throwRpcError(error);
  }
  if (!Array.isArray(data)) throw new Error('Invalid published Curiosity catalog response.');
  return data.map(parseEpisode);
}

export async function loadCuriosityWonderCounts(): Promise<Record<string, number> | null> {
  const { data, error } = await supabase.rpc('curiosity_wonder_counts_v1', {
    p_reader_token: getReaderToken(),
  });
  if (error) {
    if (isPersistenceUnavailable(error)) return null;
    console.error('Could not load Curiosity wonder counts:', error);
    return null;
  }

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ curiosity_id: string; wonder_count: number | string }>) {
    counts[row.curiosity_id] = Number(row.wonder_count) || 0;
  }
  return counts;
}

export async function loadCuriosityWonderState(curiosityId: string): Promise<CuriosityWonderState | null> {
  const { data, error } = await supabase.rpc('curiosity_wonder_state_v1', {
    p_curiosity_id: curiosityId,
    p_reader_token: getReaderToken(),
  });
  if (error) {
    if (isPersistenceUnavailable(error)) return null;
    console.error('Could not load Curiosity wonder state:', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { count: 0, wondered: false };
  return {
    count: Number((row as { wonder_count: number | string }).wonder_count) || 0,
    wondered: Boolean((row as { wondered: boolean }).wondered),
  };
}

export async function toggleCuriosityWonder(curiosityId: string): Promise<CuriosityWonderState | null> {
  const { data, error } = await supabase.rpc('curiosity_toggle_wonder_v1', {
    p_curiosity_id: curiosityId,
    p_reader_token: getReaderToken(),
  });
  if (error) {
    if (isPersistenceUnavailable(error)) return null;
    console.error('Could not toggle Curiosity wonder:', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    count: Number((row as { wonder_count: number | string }).wonder_count) || 0,
    wondered: Boolean((row as { wondered: boolean }).wondered),
  };
}

export async function listAdminCuriosities(): Promise<CuriosityAdminState[]> {
  const { data, error } = await supabase.rpc('admin_list_curiosities_v1', {
    p_site_key: JOKO_CURIOSITY_SITE_KEY,
  });
  if (error) throwRpcError(error);
  if (!Array.isArray(data)) throw new Error('Invalid Curiosity Admin list response.');
  return data.map((item) => {
    const state = parseAdminState(item);
    if (!state) throw new Error('Curiosity Admin list contained a missing record.');
    return state;
  });
}

async function callAdminStateRpc(
  functionName: 'admin_initialize_curiosity_v1' | 'admin_save_curiosity_draft_v1' | 'admin_publish_curiosity_v1',
  args: Record<string, unknown>,
): Promise<CuriosityAdminState> {
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throwRpcError(error);
  const state = parseAdminState(data);
  if (!state) throw new Error('Curiosity disappeared while saving.');
  return state;
}

export async function initializeCuriosity(document: CuriosityEpisode): Promise<CuriosityAdminState> {
  return callAdminStateRpc('admin_initialize_curiosity_v1', {
    p_site_key: JOKO_CURIOSITY_SITE_KEY,
    p_document: document,
  });
}

export async function saveCuriosityDraft(
  document: CuriosityEpisode,
  expectedLockVersion: number,
): Promise<CuriosityAdminState> {
  return callAdminStateRpc('admin_save_curiosity_draft_v1', {
    p_curiosity_id: document.id,
    p_document: document,
    p_expected_lock_version: expectedLockVersion,
  });
}

export async function publishCuriosity(
  curiosityId: string,
  expectedLockVersion: number,
): Promise<CuriosityAdminState> {
  return callAdminStateRpc('admin_publish_curiosity_v1', {
    p_curiosity_id: curiosityId,
    p_expected_lock_version: expectedLockVersion,
  });
}
