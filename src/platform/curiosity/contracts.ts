export const CURIOSITY_SCHEMA_VERSION = 1 as const;

export type CuriosityLocaleCode = string;
export type CuriosityLocalizedText = Readonly<Record<CuriosityLocaleCode, string>>;

export type CuriosityScope = 'shared' | 'local';
export type CuriosityStatus = 'draft' | 'researching' | 'review' | 'published' | 'archived';
export type CuriosityAnswerStatus = 'unanswered' | 'partial' | 'answered' | 'still-wondering';
export type CuriositySourceKind = 'web' | 'book' | 'paper' | 'interview' | 'internal' | 'observation';
export type CuriosityMediaKind = 'sketch' | 'illustration' | 'photo' | 'audio' | 'video' | 'animation';
export type CuriosityGuideKind = 'character' | 'person' | 'voice';

export interface CuriositySiteIdentity {
  siteId: string;
  siteKey: string;
  supportedLocales: readonly CuriosityLocaleCode[];
  defaultLocale: CuriosityLocaleCode;
}

export interface CuriosityOrigin {
  type: 'editorial' | 'community' | 'product' | 'place' | 'person' | 'jokomi' | 'system';
  label?: CuriosityLocalizedText;
  externalRef?: string;
}

export interface CuriositySource {
  id: string;
  kind: CuriositySourceKind;
  title: CuriosityLocalizedText;
  publisher?: string;
  url?: string;
  accessedAt?: string;
  note?: CuriosityLocalizedText;
}

export interface CuriosityMediaRef {
  id: string;
  kind: CuriosityMediaKind;
  alt: CuriosityLocalizedText;
  caption?: CuriosityLocalizedText;
}

export interface CuriosityAnswerGuide {
  kind: CuriosityGuideKind;
  id: string;
  name: CuriosityLocalizedText;
}

export interface CuriosityRelationRef {
  curiosityId: string;
  relation: 'related' | 'follow-up' | 'background' | 'contrasts-with';
}

export interface CuriosityHostRef {
  domain: 'product' | 'place' | 'person' | 'character' | 'page' | 'site';
  id: string;
}

export interface CuriosityEpisode {
  schemaVersion: typeof CURIOSITY_SCHEMA_VERSION;
  id: string;
  slug: string;
  status: CuriosityStatus;
  scope: CuriosityScope;
  siteId?: string;

  question: CuriosityLocalizedText;
  summary: CuriosityLocalizedText;
  shortAnswer?: CuriosityLocalizedText;
  fullAnswer?: CuriosityLocalizedText;
  answerStatus: CuriosityAnswerStatus;

  origin: CuriosityOrigin;
  topics: readonly string[];
  tags?: readonly string[];
  hostRefs?: readonly CuriosityHostRef[];

  guide?: CuriosityAnswerGuide;
  heroMedia?: CuriosityMediaRef;
  media?: readonly CuriosityMediaRef[];
  sources?: readonly CuriositySource[];
  related?: readonly CuriosityRelationRef[];

  publishedAt?: string;
  reviewedAt?: string;
  updatedAt?: string;
}

export interface CuriosityFixtureBundle {
  schemaVersion: typeof CURIOSITY_SCHEMA_VERSION;
  site: CuriositySiteIdentity;
  episodes: readonly CuriosityEpisode[];
}
