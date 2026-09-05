import type { BuilderDocument } from '../../../platform/builder';
import { validateBuilderDocument } from '../../../platform/builder';
import { supabase } from '../../../lib/supabase';
import { jokoTodayBuilderSite } from './site';

const HOMEPAGE_KEY = 'home';

export interface PublishedHomepageBuilderDocument {
  exists: true;
  siteKey: string;
  pageKey: 'home';
  revisionId: string;
  revisionNumber: number;
  publishedAt: string;
  document: BuilderDocument;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid published Builder response: ${field}`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid published Builder response: ${field}`);
  }
  return value;
}

function parseBuilderDocument(value: unknown): BuilderDocument {
  const validation = validateBuilderDocument(value, {
    supportedLocales: jokoTodayBuilderSite.supportedLocales,
  });

  if (!validation.ok) {
    throw new Error(
      `Stored published Homepage document is invalid: ${validation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join('; ')}`,
    );
  }

  return validation.value;
}

export async function loadPublishedHomepageBuilderDocument(): Promise<PublishedHomepageBuilderDocument | null> {
  const { data, error } = await supabase.rpc('get_published_builder_page_v1', {
    p_site_key: jokoTodayBuilderSite.siteKey,
    p_page_key: HOMEPAGE_KEY,
  });

  if (error) throw new Error(error.message);
  if (!isRecord(data)) throw new Error('Invalid published Builder response.');
  if (data.exists === false) return null;
  if (data.exists !== true) throw new Error('Invalid published Builder response: exists.');

  const pageKey = requireString(data.pageKey, 'pageKey');
  if (pageKey !== HOMEPAGE_KEY) {
    throw new Error(`Unexpected Builder page key: ${pageKey}`);
  }

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
