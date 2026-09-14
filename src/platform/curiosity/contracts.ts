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

export interface CuriosityAnswerStep {
  id: string;
  title: CuriosityLocalizedText;
  body: CuriosityLocalizedText;
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
  steps?: readonly CuriosityAnswerStep[];
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

export type CuriosityNotebookCollectionKind =
  | 'editorial'
  | 'topic'
  | 'host'
  | 'provenance'
  | 'answer-state'
  | 'ranking';

interface CuriosityNotebookCollectionBase<TKind extends CuriosityNotebookCollectionKind> {
  id: string;
  slug: string;
  kind: TKind;
  label: CuriosityLocalizedText;
  navLabel?: CuriosityLocalizedText;
  description: CuriosityLocalizedText;
  emptyMessage?: CuriosityLocalizedText;
  order: number;
  visible: boolean;
}

export interface CuriosityEditorialCollection extends CuriosityNotebookCollectionBase<'editorial'> {
  episodeIds: readonly string[];
}

export interface CuriosityTopicCollection extends CuriosityNotebookCollectionBase<'topic'> {
  topics: readonly string[];
  match?: 'any' | 'all';
  scopes?: readonly CuriosityScope[];
}

export interface CuriosityHostCollection extends CuriosityNotebookCollectionBase<'host'> {
  hostId: string;
}

export interface CuriosityProvenanceCollection extends CuriosityNotebookCollectionBase<'provenance'> {
  originTypes: readonly CuriosityOrigin['type'][];
}

export interface CuriosityAnswerStateCollection extends CuriosityNotebookCollectionBase<'answer-state'> {
  answerStatuses: readonly CuriosityAnswerStatus[];
}

export interface CuriosityRankingCollection extends CuriosityNotebookCollectionBase<'ranking'> {
  metric: 'wonder-count';
  minimumCount?: number;
  limit?: number;
}

export type CuriosityNotebookCollection =
  | CuriosityEditorialCollection
  | CuriosityTopicCollection
  | CuriosityHostCollection
  | CuriosityProvenanceCollection
  | CuriosityAnswerStateCollection
  | CuriosityRankingCollection;

export interface CuriosityNotebookConfig {
  siteId: string;
  defaultCollectionSlug: string;
  collections: readonly CuriosityNotebookCollection[];
}

export interface CuriosityFixtureBundle {
  schemaVersion: typeof CURIOSITY_SCHEMA_VERSION;
  site: CuriositySiteIdentity;
  episodes: readonly CuriosityEpisode[];
}
