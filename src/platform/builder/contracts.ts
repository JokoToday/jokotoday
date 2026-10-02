import type { SectionSpacingRole, WidthRole } from '../design-system';

export const BUILDER_SCHEMA_VERSION = 1 as const;
export const BUILDER_REGISTRY_VERSION = 1 as const;

export type LocaleCode = string;
export type LocalizedText = Readonly<Record<LocaleCode, string>>;

export type BuilderRichTextColor = 'text' | 'accent' | 'turquoise';

export interface BuilderRichTextMarks {
  bold?: boolean;
  italic?: boolean;
  color?: BuilderRichTextColor;
}

export interface BuilderRichTextRun {
  text: string;
  marks?: BuilderRichTextMarks;
}

export type BuilderRichText = readonly BuilderRichTextRun[];
export type LocalizedRichText = Readonly<Record<LocaleCode, BuilderRichText>>;

export type BuilderSectionWidth = Extract<WidthRole, 'standard' | 'wide'>;
export type BuilderSectionSpacing = 'none' | SectionSpacingRole;

export type BuilderDisplayFont = 'noto-sans' | 'inter' | 'playfair-display';
export type BuilderBodyFont = 'inter' | 'noto-sans';
export type BuilderFontWeight = 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type BuilderThaiDisplayFont =
  | 'noto-sans-thai-looped'
  | 'noto-sans-thai'
  | 'sarabun'
  | 'bai-jamjuree'
  | 'maitree';
export type BuilderThaiBodyFont =
  | 'noto-sans-thai-looped'
  | 'noto-sans-thai'
  | 'sarabun'
  | 'bai-jamjuree';
export type BuilderChineseDisplayFont = 'noto-sans-sc' | 'noto-serif-sc';
export type BuilderChineseBodyFont = 'noto-sans-sc' | 'noto-serif-sc';

export interface BuilderHomepageBranding {
  logoScale: number;
  typography: {
    displayFont: BuilderDisplayFont;
    bodyFont: BuilderBodyFont;
    displayWeight: BuilderFontWeight;
    bodyWeight: BuilderFontWeight;
    thaiDisplayFont: BuilderThaiDisplayFont;
    thaiBodyFont: BuilderThaiBodyFont;
    chineseDisplayFont: BuilderChineseDisplayFont;
    chineseBodyFont: BuilderChineseBodyFont;
    /** @deprecated Read-only compatibility with Homepage Editor v2 documents. */
    thaiFont?: 'noto-sans-thai-looped';
    /** @deprecated Read-only compatibility with Homepage Editor v2 documents. */
    chineseFont?: 'noto-sans-sc';
    heroSize: number;
    sectionHeadingSize: number;
    bodySize: number;
    navSize: number;
    buttonSize: number;
    labelSize: number;
  };
  colors: {
    text: string;
    accent: string;
    turquoise: string;
  };
}

export type BuilderAction =
  | { type: 'commerce.openProducts' }
  | { type: 'site.openHowItWorks' }
  | { type: 'commerce.browseCategory'; categoryId: string };

interface BuilderSectionBase<TType extends string, TProps, TDesign> {
  id: string;
  type: TType;
  version: 1;
  visible: boolean;
  props: TProps;
  design: TDesign;
}

export interface HomeHeroNotebookNote {
  enabled: boolean;
  title?: LocalizedText;
  body?: LocalizedText;
  imageUrl?: string;
  imageAlt?: LocalizedText;
  linkUrl?: string;
}

export interface HomeHeroProps {
  /** Site-wide logo used by the JOKO shell when this Builder revision is published. */
  logoUrl?: string;
  title: LocalizedText;
  /** Controlled rich text for the Hero title. Plain title remains the fallback/source for legacy revisions. */
  titleRichText?: LocalizedRichText;
  subtitle: LocalizedText;
  primaryActionLabel: LocalizedText;
  primaryAction: BuilderAction;
  secondaryActionLabel: LocalizedText;
  secondaryAction: BuilderAction;
  mediaAlt: LocalizedText;
  /** Optional CMS-controlled notebook card overlaid on the Experience hero. */
  notebookNote?: HomeHeroNotebookNote;
}

export interface HomeHeroDesign {
  width: BuilderSectionWidth;
  spacing: BuilderSectionSpacing;
  layout: 'split-media-right';
}

export type HomeHeroSection = BuilderSectionBase<
  'home.hero.v1',
  HomeHeroProps,
  HomeHeroDesign
>;

export interface HomeTopLikedProps {
  title: LocalizedText;
  /** Controlled rich text for the Bakery Showcase heading. Plain title remains the fallback/source for legacy revisions. */
  titleRichText?: LocalizedRichText;
  subtitle: LocalizedText;
  /** Controlled rich text for the Bakery Showcase intro. Plain subtitle remains the fallback/source for legacy revisions. */
  subtitleRichText?: LocalizedRichText;
  browseLabel: LocalizedText;
  browseAction: BuilderAction;
}

export interface HomeTopLikedDesign {
  width: BuilderSectionWidth;
  spacing: BuilderSectionSpacing;
  variant: 'cards';
}

export type HomeTopLikedSection = BuilderSectionBase<
  'home.top-liked.v1',
  HomeTopLikedProps,
  HomeTopLikedDesign
>;

export interface HomeCategoryGridProps {
  title: LocalizedText;
}

export interface HomeCategoryGridDesign {
  width: BuilderSectionWidth;
  spacing: BuilderSectionSpacing;
  layout: 'responsive-catalogue';
}

export type HomeCategoryGridSection = BuilderSectionBase<
  'home.category-grid.v1',
  HomeCategoryGridProps,
  HomeCategoryGridDesign
>;

export interface HomeCtaProps {
  title: LocalizedText;
  body: LocalizedText;
  actionLabel: LocalizedText;
  action: BuilderAction;
}

export interface HomeCtaDesign {
  width: BuilderSectionWidth;
  spacing: BuilderSectionSpacing;
  variant: 'brand-panel';
  alignment: 'center';
}

export type HomeCtaSection = BuilderSectionBase<
  'home.cta.v1',
  HomeCtaProps,
  HomeCtaDesign
>;

export type BuilderSection =
  | HomeHeroSection
  | HomeTopLikedSection
  | HomeCategoryGridSection
  | HomeCtaSection;

export type BuilderSectionType = BuilderSection['type'];

export interface BuilderDocument {
  schemaVersion: typeof BUILDER_SCHEMA_VERSION;
  registryVersion: typeof BUILDER_REGISTRY_VERSION;
  pageKey: 'home';
  branding?: BuilderHomepageBranding;
  sections: BuilderSection[];
}

export interface BuilderSiteIdentity {
  siteId: string;
  siteKey: string;
  name: string;
  supportedLocales: readonly LocaleCode[];
  defaultLocale: LocaleCode;
}
