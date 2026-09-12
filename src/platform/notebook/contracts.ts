export const NOTEBOOK_SCHEMA_VERSION = 1 as const;

export type NotebookLocaleCode = string;
export type NotebookLocalizedText = Readonly<Record<NotebookLocaleCode, string>>;

export type NotebookEntryKind = 'person' | 'product' | 'question';
export type NotebookIndexKind = 'people' | 'curiosities' | 'places' | 'products';
export type NotebookEntryStatus = 'draft' | 'published' | 'archived';

export interface NotebookSiteIdentity {
  siteId: string;
  siteKey: string;
  supportedLocales: readonly NotebookLocaleCode[];
  defaultLocale: NotebookLocaleCode;
}

export interface NotebookAssetRef {
  id: string;
  intent: 'sketch' | 'illustration' | 'photo';
}

export type NotebookEntryRef =
  | { kind: 'person'; id: string }
  | { kind: 'product'; id: string }
  | { kind: 'question'; id: string };

interface NotebookEntryBase<TKind extends NotebookEntryKind> {
  id: string;
  kind: TKind;
  slug: string;
  status: NotebookEntryStatus;
  title: NotebookLocalizedText;
  summary: NotebookLocalizedText;
}

export interface NotebookPersonEntry extends NotebookEntryBase<'person'> {
  subjectRef: {
    domain: 'character' | 'community-person';
    id: string;
  };
  portraitAsset?: NotebookAssetRef;
  favoriteProductRef?: Extract<NotebookEntryRef, { kind: 'product' }>;
}

export interface NotebookProductEntry extends NotebookEntryBase<'product'> {
  editorialProductRef: string;
  heroAsset?: NotebookAssetRef;
  note?: NotebookLocalizedText;
}

export interface NotebookQuestionEntry extends NotebookEntryBase<'question'> {
  question: NotebookLocalizedText;
  answerTeaser?: NotebookLocalizedText;
  heroAsset?: NotebookAssetRef;
}

export type NotebookEntry =
  | NotebookPersonEntry
  | NotebookProductEntry
  | NotebookQuestionEntry;

export type NotebookRouteTarget =
  | { type: 'notebook.today' }
  | { type: 'notebook.history' }
  | { type: 'notebook.noticed' }
  | { type: 'notebook.index'; index: NotebookIndexKind }
  | { type: 'notebook.person'; slug: string; section?: 'today-story' }
  | { type: 'notebook.product'; slug: string }
  | { type: 'notebook.question'; slug: string };

interface NotebookBlockBase<TType extends string> {
  id: string;
  type: TType;
}

export interface NotebookTextBlock extends NotebookBlockBase<'text'> {
  eyebrow?: NotebookLocalizedText;
  heading?: NotebookLocalizedText;
  body?: NotebookLocalizedText;
}

export interface NotebookAssetBlock extends NotebookBlockBase<'asset'> {
  asset: NotebookAssetRef;
  alt: NotebookLocalizedText;
  caption?: NotebookLocalizedText;
}

export interface NotebookCalloutBlock extends NotebookBlockBase<'callout'> {
  heading?: NotebookLocalizedText;
  body: NotebookLocalizedText;
  relatedEntryRef?: NotebookEntryRef;
  action?: {
    label: NotebookLocalizedText;
    target: NotebookRouteTarget;
  };
}

export interface NotebookEntryLinkBlock extends NotebookBlockBase<'entry-link'> {
  entryRef: NotebookEntryRef;
  label: NotebookLocalizedText;
  note?: NotebookLocalizedText;
}

export type NotebookBlock =
  | NotebookTextBlock
  | NotebookAssetBlock
  | NotebookCalloutBlock
  | NotebookEntryLinkBlock;

export interface NotebookReadingSurface {
  id: string;
  blocks: NotebookBlock[];
}

export interface NotebookTodayDocument {
  schemaVersion: typeof NOTEBOOK_SCHEMA_VERSION;
  id: string;
  siteId: string;
  date: string;
  title: NotebookLocalizedText;
  subtitle?: NotebookLocalizedText;
  surfaces: NotebookReadingSurface[];
  featuredEntryRefs: NotebookEntryRef[];
}

export interface NotebookHistoryItem {
  date: string;
  todayDocumentId: string;
  title: NotebookLocalizedText;
  excerpt?: NotebookLocalizedText;
}

export interface NotebookFixtureBundle {
  schemaVersion: typeof NOTEBOOK_SCHEMA_VERSION;
  site: NotebookSiteIdentity;
  today: NotebookTodayDocument;
  entries: NotebookEntry[];
  history: NotebookHistoryItem[];
}
