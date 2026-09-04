import type { BuilderDocument } from '../../../platform/builder';
import { validateBuilderDocument } from '../../../platform/builder';
import { supabase } from '../../../lib/supabase';
import { jokoTodayBuilderSite } from './site';

const HOMEPAGE_KEY = 'home';

interface BuilderDraftState {
  document: BuilderDocument;
  updatedAt: string;
  updatedBy: string | null;
  sourceRevisionId: string | null;
}

export interface BuilderPublishedState {
  revisionId: string;
  revisionNumber: number;
  publishedAt: string;
  publishedBy: string | null;
}

export interface HomepageBuilderState {
  exists: true;
  pageId: string;
  siteKey: string;
  pageKey: 'home';
  lockVersion: number;
  draft: BuilderDraftState;
  published: BuilderPublishedState | null;
}

export interface HomepageBuilderRevisionSummary {
  revisionId: string;
  revisionNumber: number;
  publishedAt: string;
  publishedBy: string | null;
  restoredFromRevisionId: string | null;
  isCurrent: boolean;
}

export interface PublishedHomepageBuilderDocument {
  exists: true;
  siteKey: string;
  pageKey: 'home';
  revisionId: string;
  revisionNumber: number;
  publishedAt: string;
  document: BuilderDocument;
}

export class BuilderPersistenceConflictError extends Error {
  constructor(message = 'The Homepage draft changed in another Admin session. Reload before saving again.') {
    super(message);
    this.name = 'BuilderPersistenceConflictError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid Builder persistence response: ${field}`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid Builder persistence response: ${field}`);
  }
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseBuilderDocument(value: unknown): BuilderDocument {
  const validation = validateBuilderDocument(value, {
    supportedLocales: jokoTodayBuilderSite.supportedLocales,
  });

  if (!validation.ok) {
    throw new Error(
      `Stored Homepage Builder document is invalid: ${validation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ')}`,
    );
  }

  return validation.value;
}

function parseState(value: unknown): HomepageBuilderState | null {
  if (!isRecord(value)) throw new Error('Invalid Builder persistence response.');
  if (value.exists === false) return null;
  if (value.exists !== true) throw new Error('Invalid Builder persistence response: exists.');

  const draft = value.draft;
  if (!isRecord(draft)) throw new Error('Invalid Builder persistence response: draft.');

  const publishedValue = value.published;
  let published: BuilderPublishedState | null = null;
  if (publishedValue !== null && publishedValue !== undefined) {
    if (!isRecord(publishedValue)) {
      throw new Error('Invalid Builder persistence response: published.');
    }
    published = {
      revisionId: requireString(publishedValue.revisionId, 'published.revisionId'),
      revisionNumber: requireNumber(publishedValue.revisionNumber, 'published.revisionNumber'),
      publishedAt: requireString(publishedValue.publishedAt, 'published.publishedAt'),
      publishedBy: nullableString(publishedValue.publishedBy),
    };
  }

  const pageKey = requireString(value.pageKey, 'pageKey');
  if (pageKey !== HOMEPAGE_KEY) {
    throw new Error(`Unexpected Builder page key: ${pageKey}`);
  }

  return {
    exists: true,
    pageId: requireString(value.pageId, 'pageId'),
    siteKey: requireString(value.siteKey, 'siteKey'),
    pageKey: HOMEPAGE_KEY,
    lockVersion: requireNumber(value.lockVersion, 'lockVersion'),
    draft: {
      document: parseBuilderDocument(draft.document),
      updatedAt: requireString(draft.updatedAt, 'draft.updatedAt'),
      updatedBy: nullableString(draft.updatedBy),
      sourceRevisionId: nullableString(draft.sourceRevisionId),
    },
    published,
  };
}

function parseRevisionList(value: unknown): HomepageBuilderRevisionSummary[] {
  if (!Array.isArray(value)) throw new Error('Invalid Builder revision list response.');

  return value.map((item, index) => {
    if (!isRecord(item)) throw new Error(`Invalid Builder revision at index ${index}.`);
    return {
      revisionId: requireString(item.revisionId, `revisions[${index}].revisionId`),
      revisionNumber: requireNumber(item.revisionNumber, `revisions[${index}].revisionNumber`),
      publishedAt: requireString(item.publishedAt, `revisions[${index}].publishedAt`),
      publishedBy: nullableString(item.publishedBy),
      restoredFromRevisionId: nullableString(item.restoredFromRevisionId),
      isCurrent: item.isCurrent === true,
    };
  });
}

function throwRpcError(error: { code?: string; message: string }): never {
  if (error.code === '40001') {
    throw new BuilderPersistenceConflictError();
  }
  throw new Error(error.message);
}

async function callStateRpc(
  functionName:
    | 'admin_get_builder_page_v1'
    | 'admin_initialize_builder_page_v1'
    | 'admin_save_builder_draft_v1'
    | 'admin_publish_builder_page_v1'
    | 'admin_restore_builder_revision_v1',
  args: Record<string, unknown>,
): Promise<HomepageBuilderState | null> {
  const { data, error } = await supabase.rpc(functionName, args);
  if (error) throwRpcError(error);
  return parseState(data);
}

export async function loadHomepageBuilderState(): Promise<HomepageBuilderState | null> {
  return callStateRpc('admin_get_builder_page_v1', {
    p_site_key: jokoTodayBuilderSite.siteKey,
    p_page_key: HOMEPAGE_KEY,
  });
}

export async function loadOrInitializeHomepageBuilderState(
  seedDocument: BuilderDocument,
): Promise<HomepageBuilderState> {
  const existing = await loadHomepageBuilderState();
  if (existing) return existing;

  const initialized = await callStateRpc('admin_initialize_builder_page_v1', {
    p_site_key: jokoTodayBuilderSite.siteKey,
    p_page_key: HOMEPAGE_KEY,
    p_document: seedDocument,
  });

  if (!initialized) throw new Error('Homepage Builder page could not be initialized.');
  return initialized;
}

export async function saveHomepageBuilderDraft(
  document: BuilderDocument,
  expectedLockVersion: number,
): Promise<HomepageBuilderState> {
  const state = await callStateRpc('admin_save_builder_draft_v1', {
    p_site_key: jokoTodayBuilderSite.siteKey,
    p_page_key: HOMEPAGE_KEY,
    p_document: document,
    p_expected_lock_version: expectedLockVersion,
  });
  if (!state) throw new Error('Homepage Builder page disappeared while saving.');
  return state;
}

export async function publishHomepageBuilderDraft(
  expectedLockVersion: number,
): Promise<HomepageBuilderState> {
  const state = await callStateRpc('admin_publish_builder_page_v1', {
    p_site_key: jokoTodayBuilderSite.siteKey,
    p_page_key: HOMEPAGE_KEY,
    p_expected_lock_version: expectedLockVersion,
  });
  if (!state) throw new Error('Homepage Builder page disappeared while publishing.');
  return state;
}

export async function restoreHomepageBuilderRevision(
  revisionId: string,
  expectedLockVersion: number,
): Promise<HomepageBuilderState> {
  const state = await callStateRpc('admin_restore_builder_revision_v1', {
    p_site_key: jokoTodayBuilderSite.siteKey,
    p_page_key: HOMEPAGE_KEY,
    p_revision_id: revisionId,
    p_expected_lock_version: expectedLockVersion,
  });
  if (!state) throw new Error('Homepage Builder page disappeared while restoring.');
  return state;
}

export async function listHomepageBuilderRevisions(
  limit = 20,
): Promise<HomepageBuilderRevisionSummary[]> {
  const { data, error } = await supabase.rpc('admin_list_builder_revisions_v1', {
    p_site_key: jokoTodayBuilderSite.siteKey,
    p_page_key: HOMEPAGE_KEY,
    p_limit: limit,
  });
  if (error) throwRpcError(error);
  return parseRevisionList(data);
}

export async function loadPublishedHomepageBuilderDocument(): Promise<PublishedHomepageBuilderDocument | null> {
  const { data, error } = await supabase.rpc('get_published_builder_page_v1', {
    p_site_key: jokoTodayBuilderSite.siteKey,
    p_page_key: HOMEPAGE_KEY,
  });
  if (error) throwRpcError(error);
  if (!isRecord(data)) throw new Error('Invalid published Builder response.');
  if (data.exists === false) return null;
  if (data.exists !== true) throw new Error('Invalid published Builder response: exists.');

  const pageKey = requireString(data.pageKey, 'pageKey');
  if (pageKey !== HOMEPAGE_KEY) throw new Error(`Unexpected Builder page key: ${pageKey}`);

  return {
    exists: true,
    siteKey: requireString(data.siteKey, 'siteKey'),
    pageKey: HOMEPAGE_KEY,
    revisionId: requireString(data.revisionId, 'revisionId'),
    revisionNumber: requireNumber(data.revisionNumber, 'revisionNumber'),
    publishedAt: requireString(data.publishedAt, 'publishedAt'),
    document: parseBuilderDocument(data.document),
  };
}
