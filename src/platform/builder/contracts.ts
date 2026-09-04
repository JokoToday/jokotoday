import type { SectionSpacingRole, WidthRole } from '../design-system';

export const BUILDER_SCHEMA_VERSION = 1 as const;
export const BUILDER_REGISTRY_VERSION = 1 as const;

export type LocaleCode = string;
export type LocalizedText = Readonly<Record<LocaleCode, string>>;

export type BuilderSectionWidth = Extract<WidthRole, 'standard' | 'wide'>;
export type BuilderSectionSpacing = 'none' | SectionSpacingRole;

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

export interface HomeHeroProps {
  title: LocalizedText;
  subtitle: LocalizedText;
  primaryActionLabel: LocalizedText;
  primaryAction: BuilderAction;
  secondaryActionLabel: LocalizedText;
  secondaryAction: BuilderAction;
  mediaAlt: LocalizedText;
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
  subtitle: LocalizedText;
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
  sections: BuilderSection[];
}

export interface BuilderSiteIdentity {
  siteId: string;
  siteKey: string;
  name: string;
  supportedLocales: readonly LocaleCode[];
  defaultLocale: LocaleCode;
}
