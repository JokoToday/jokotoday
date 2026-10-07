import type { SectionSpacingRole, WidthRole } from '../design-system';

export const BUILDER_SCHEMA_VERSION = 1 as const;
export const BUILDER_REGISTRY_VERSION = 1 as const;

export type LocaleCode = string;
export type LocalizedText = Readonly<Record<LocaleCode, string>>;

export type BuilderRichTextColor = 'text' | 'accent' | 'turquoise';
export type HeroFontPreset = 'inherit' | 'display' | 'body' | 'handwritten';
export type HeroTextAlign = 'left' | 'center' | 'right';

/** Controls apply only to fixed, safe design tokens, never arbitrary CSS/HTML. */
export interface HeroTextStyle {
  font?: HeroFontPreset;
  size?: number;
  align?: HeroTextAlign;
  bold?: boolean;
  italic?: boolean;
  /** Unitless multiplier (0.8–2.5); applies to text lines and wraps. */
  lineHeight?: number;
}

export interface HeroTitleLineStyle {
  align?: HeroTextAlign;
  size?: number;
  font?: HeroFontPreset;
}


export interface BuilderRichTextMarks {
  bold?: boolean;
  italic?: boolean;
  color?: BuilderRichTextColor;
  font?: HeroFontPreset;
  size?: number;
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

/** Optional published imagery for the three fixed About JOKO homepage cards. */
export interface HomeAboutCardImage {
  imageUrl?: string;
  imageAlt?: LocalizedText;
}

export type HomeAboutCardKey = 'bakery' | 'people' | 'story';

export type TopMenuKey = 'home' | 'products' | 'other-products' | 'how-it-works' | 'pickup' | 'about';
export interface TopMenuItem {
  key: TopMenuKey;
  visible: boolean;
  labels?: LocalizedText;
}

export interface BuilderHomepageBranding {
  /** Desktop and mobile use one menu model; destinations are fixed and safe. */
  topMenu?: readonly TopMenuItem[];
  /** Images are published with the Homepage Builder, not independent Admin state. */
  aboutCards?: Partial<Record<HomeAboutCardKey, HomeAboutCardImage>>;
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

export type HomeHeroNotebookFontPreset = 'handwritten' | 'display' | 'body';

export interface HomeHeroNotebookNote {
  enabled: boolean;
  title?: LocalizedText;
  body?: LocalizedText;
  imageUrl?: string;
  imageAlt?: LocalizedText;
  linkUrl?: string;
  /** Controlled visual font family; defaults to the JOKO handwritten treatment. */
  fontPreset?: HomeHeroNotebookFontPreset;
  /** Heading size in px. */
  headingSize?: number;
  /** Body size in px. */
  bodySize?: number;
}

export interface HomeHeroProps {
  /** Site-wide logo used by the JOKO shell when this Builder revision is published. */
  logoUrl?: string;
  title: LocalizedText;
  /** Controlled rich text for the Hero title. Plain title remains the fallback/source for legacy revisions. */
  titleRichText?: LocalizedRichText;
  subtitle: LocalizedText;
  /** The visible small tagline above the main title. */
  eyebrow?: LocalizedText;
  eyebrowStyle?: HeroTextStyle;
  /** Per-language headline line alignment, sizing and default font. */
  titleLineStyles?: Readonly<Record<LocaleCode, readonly HeroTitleLineStyle[]>>;
  /** Base headline font/size/weight/alignment. Word overrides live in titleRichText. */
  titleStyle?: HeroTextStyle;
  /** Independent overrides for EN, TH and ZH; old shared styles remain as fallback. */
  titleLocaleStyles?: Readonly<Record<LocaleCode, HeroTextStyle>>;
  subtitleRichText?: LocalizedRichText;
  subtitleStyle?: HeroTextStyle;
  subtitleLocaleStyles?: Readonly<Record<LocaleCode, HeroTextStyle>>;
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
