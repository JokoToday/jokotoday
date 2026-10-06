import type { CSSProperties } from 'react';
import type {
  BuilderBodyFont,
  BuilderChineseBodyFont,
  BuilderChineseDisplayFont,
  BuilderDisplayFont,
  BuilderFontWeight,
  BuilderHomepageBranding,
  HomeAboutCardImage,
  HomeAboutCardKey,
  BuilderThaiBodyFont,
  BuilderThaiDisplayFont,
} from './contracts';
import { resolveTopMenu } from './topMenu';

export type JokoHomepageBranding = BuilderHomepageBranding;

export const DEFAULT_JOKO_HOMEPAGE_BRANDING: JokoHomepageBranding = {
  aboutCards: {},
  topMenu: resolveTopMenu(undefined),
  logoScale: 120,
  typography: {
    displayFont: 'noto-sans',
    bodyFont: 'inter',
    displayWeight: 700,
    bodyWeight: 400,
    thaiDisplayFont: 'maitree',
    thaiBodyFont: 'noto-sans-thai-looped',
    chineseDisplayFont: 'noto-serif-sc',
    chineseBodyFont: 'noto-sans-sc',
    heroSize: 65,
    sectionHeadingSize: 36,
    bodySize: 16,
    navSize: 16,
    buttonSize: 16,
    labelSize: 11,
  },
  colors: {
    text: '#303532',
    accent: '#C76624',
    turquoise: '#DAEBE8',
  },
};

export const DISPLAY_FONT_STACKS: Record<BuilderDisplayFont, string> = {
  'noto-sans': "'Noto Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  inter: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  'playfair-display': "'Playfair Display', Georgia, serif",
};

const BODY_FONT_STACKS: Record<BuilderBodyFont, string> = {
  inter: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  'noto-sans': "'Noto Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

export const THAI_DISPLAY_FONT_STACKS: Record<BuilderThaiDisplayFont, string> = {
  'noto-sans-thai-looped': "'Noto Sans Thai Looped', Tahoma, sans-serif",
  'noto-sans-thai': "'Noto Sans Thai', Tahoma, sans-serif",
  sarabun: "'Sarabun', Tahoma, sans-serif",
  'bai-jamjuree': "'Bai Jamjuree', Tahoma, sans-serif",
  maitree: "'Maitree', Georgia, serif",
};

const THAI_BODY_FONT_STACKS: Record<BuilderThaiBodyFont, string> = {
  'noto-sans-thai-looped': "'Noto Sans Thai Looped', Tahoma, sans-serif",
  'noto-sans-thai': "'Noto Sans Thai', Tahoma, sans-serif",
  sarabun: "'Sarabun', Tahoma, sans-serif",
  'bai-jamjuree': "'Bai Jamjuree', Tahoma, sans-serif",
};

export const CHINESE_DISPLAY_FONT_STACKS: Record<BuilderChineseDisplayFont, string> = {
  'noto-sans-sc': "'Noto Sans SC', 'PingFang SC', system-ui, sans-serif",
  'noto-serif-sc': "'Noto Serif SC', 'Songti SC', serif",
};

const CHINESE_BODY_FONT_STACKS: Record<BuilderChineseBodyFont, string> = {
  'noto-sans-sc': "'Noto Sans SC', 'PingFang SC', system-ui, sans-serif",
  'noto-serif-sc': "'Noto Serif SC', 'Songti SC', serif",
};

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max ? numeric : fallback;
}

function safeHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
}

function safeAboutCardImage(value: unknown): HomeAboutCardImage | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : '';
  const validUrl = imageUrl.startsWith('/') && !imageUrl.startsWith('//')
    || /^https:\/\//i.test(imageUrl);
  const imageAlt = record.imageAlt && typeof record.imageAlt === 'object' && !Array.isArray(record.imageAlt)
    ? Object.fromEntries(Object.entries(record.imageAlt).filter(
      ([key, alt]) => key.trim() && typeof alt === 'string',
    )) as Record<string, string>
    : undefined;
  return {
    ...(validUrl ? { imageUrl } : {}),
    ...(imageAlt ? { imageAlt } : {}),
  };
}

export function resolveJokoHomepageBranding(value: unknown): JokoHomepageBranding {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const typography = input.typography && typeof input.typography === 'object' && !Array.isArray(input.typography)
    ? input.typography as Record<string, unknown>
    : {};
  const colors = input.colors && typeof input.colors === 'object' && !Array.isArray(input.colors)
    ? input.colors as Record<string, unknown>
    : {};

  const displayFont = ['noto-sans', 'inter', 'playfair-display'].includes(String(typography.displayFont))
    ? typography.displayFont as BuilderDisplayFont
    : DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.displayFont;
  const bodyFont = ['inter', 'noto-sans'].includes(String(typography.bodyFont))
    ? typography.bodyFont as BuilderBodyFont
    : DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.bodyFont;
  const allowedWeights: BuilderFontWeight[] = [300, 400, 500, 600, 700, 800, 900];
  const displayWeight = allowedWeights.includes(Number(typography.displayWeight) as BuilderFontWeight)
    ? Number(typography.displayWeight) as BuilderFontWeight
    : DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.displayWeight;
  const bodyWeight = allowedWeights.includes(Number(typography.bodyWeight) as BuilderFontWeight)
    ? Number(typography.bodyWeight) as BuilderFontWeight
    : DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.bodyWeight;
  const legacyThaiFont = typography.thaiFont === 'noto-sans-thai-looped' ? typography.thaiFont : undefined;
  const legacyChineseFont = typography.chineseFont === 'noto-sans-sc' ? typography.chineseFont : undefined;
  const thaiDisplayFont = ['noto-sans-thai-looped', 'noto-sans-thai', 'sarabun', 'bai-jamjuree', 'maitree'].includes(String(typography.thaiDisplayFont))
    ? typography.thaiDisplayFont as BuilderThaiDisplayFont
    : legacyThaiFont ?? DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.thaiDisplayFont;
  const thaiBodyFont = ['noto-sans-thai-looped', 'noto-sans-thai', 'sarabun', 'bai-jamjuree'].includes(String(typography.thaiBodyFont))
    ? typography.thaiBodyFont as BuilderThaiBodyFont
    : legacyThaiFont ?? DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.thaiBodyFont;
  const chineseDisplayFont = ['noto-sans-sc', 'noto-serif-sc'].includes(String(typography.chineseDisplayFont))
    ? typography.chineseDisplayFont as BuilderChineseDisplayFont
    : legacyChineseFont ?? DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.chineseDisplayFont;
  const chineseBodyFont = ['noto-sans-sc', 'noto-serif-sc'].includes(String(typography.chineseBodyFont))
    ? typography.chineseBodyFont as BuilderChineseBodyFont
    : legacyChineseFont ?? DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.chineseBodyFont;

  const aboutCardsInput = input.aboutCards && typeof input.aboutCards === 'object' && !Array.isArray(input.aboutCards)
    ? input.aboutCards as Record<string, unknown>
    : {};
  const aboutCards: Partial<Record<HomeAboutCardKey, HomeAboutCardImage>> = {};
  for (const card of ['bakery', 'people', 'story'] as const) {
    const image = safeAboutCardImage(aboutCardsInput[card]);
    if (image) aboutCards[card] = image;
  }

  return {
    aboutCards,
    topMenu: resolveTopMenu(input.topMenu),
    logoScale: numberInRange(input.logoScale, DEFAULT_JOKO_HOMEPAGE_BRANDING.logoScale, 70, 150),
    typography: {
      displayFont,
      bodyFont,
      displayWeight,
      bodyWeight,
      thaiDisplayFont,
      thaiBodyFont,
      chineseDisplayFont,
      chineseBodyFont,
      heroSize: numberInRange(typography.heroSize, DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.heroSize, 42, 88),
      sectionHeadingSize: numberInRange(typography.sectionHeadingSize, DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.sectionHeadingSize, 24, 56),
      bodySize: numberInRange(typography.bodySize, DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.bodySize, 14, 20),
      navSize: numberInRange(typography.navSize, DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.navSize, 12, 20),
      buttonSize: numberInRange(typography.buttonSize, DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.buttonSize, 13, 20),
      labelSize: numberInRange(typography.labelSize, DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.labelSize, 9, 15),
    },
    colors: {
      text: safeHex(colors.text, DEFAULT_JOKO_HOMEPAGE_BRANDING.colors.text),
      accent: safeHex(colors.accent, DEFAULT_JOKO_HOMEPAGE_BRANDING.colors.accent),
      turquoise: safeHex(colors.turquoise, DEFAULT_JOKO_HOMEPAGE_BRANDING.colors.turquoise),
    },
  };
}

export function jokoDisplayFontStack(font: BuilderDisplayFont): string {
  return DISPLAY_FONT_STACKS[font];
}

export function jokoThaiDisplayFontStack(font: BuilderThaiDisplayFont): string {
  return THAI_DISPLAY_FONT_STACKS[font];
}

export function jokoChineseDisplayFontStack(font: BuilderChineseDisplayFont): string {
  return CHINESE_DISPLAY_FONT_STACKS[font];
}

export function jokoBrandingCssVariables(branding: JokoHomepageBranding, locale = 'en'): CSSProperties {
  const displayStack = locale === 'th'
    ? THAI_DISPLAY_FONT_STACKS[branding.typography.thaiDisplayFont]
    : locale === 'zh'
      ? CHINESE_DISPLAY_FONT_STACKS[branding.typography.chineseDisplayFont]
      : DISPLAY_FONT_STACKS[branding.typography.displayFont];
  const bodyStack = locale === 'th'
    ? THAI_BODY_FONT_STACKS[branding.typography.thaiBodyFont]
    : locale === 'zh'
      ? CHINESE_BODY_FONT_STACKS[branding.typography.chineseBodyFont]
      : BODY_FONT_STACKS[branding.typography.bodyFont];

  return {
    '--joko-logo-scale': String(branding.logoScale / 100),
    '--joko-font-display': displayStack,
    '--joko-font-shell': bodyStack,
    '--joko-font-body': bodyStack,
    '--joko-font-display-weight': String(branding.typography.displayWeight),
    '--joko-font-body-weight': String(branding.typography.bodyWeight),
    '--joko-brand-text': branding.colors.text,
    '--joko-brand-accent': branding.colors.accent,
    '--joko-brand-turquoise': branding.colors.turquoise,
    '--joko-size-hero': `${branding.typography.heroSize}px`,
    '--joko-size-section-heading': `${branding.typography.sectionHeadingSize}px`,
    '--joko-size-body': `${branding.typography.bodySize}px`,
    '--joko-size-nav': `${branding.typography.navSize}px`,
    '--joko-size-button': `${branding.typography.buttonSize}px`,
    '--joko-size-label': `${branding.typography.labelSize}px`,
  } as CSSProperties;
}

export const JOKO_DISPLAY_FONT_OPTIONS = [
  { value: 'noto-sans', label: 'Noto Sans' },
  { value: 'inter', label: 'Inter' },
  { value: 'playfair-display', label: 'Playfair Display' },
] as const;

export const JOKO_BODY_FONT_OPTIONS = [
  { value: 'inter', label: 'Inter' },
  { value: 'noto-sans', label: 'Noto Sans' },
] as const;


export const JOKO_THAI_DISPLAY_FONT_OPTIONS = [
  { value: 'maitree', label: 'Maitree' },
  { value: 'noto-sans-thai-looped', label: 'Noto Sans Thai Looped' },
  { value: 'noto-sans-thai', label: 'Noto Sans Thai' },
  { value: 'sarabun', label: 'Sarabun' },
  { value: 'bai-jamjuree', label: 'Bai Jamjuree' },
] as const;

export const JOKO_THAI_BODY_FONT_OPTIONS = [
  { value: 'noto-sans-thai-looped', label: 'Noto Sans Thai Looped' },
  { value: 'noto-sans-thai', label: 'Noto Sans Thai' },
  { value: 'sarabun', label: 'Sarabun' },
  { value: 'bai-jamjuree', label: 'Bai Jamjuree' },
] as const;

export const JOKO_CHINESE_DISPLAY_FONT_OPTIONS = [
  { value: 'noto-serif-sc', label: 'Noto Serif SC' },
  { value: 'noto-sans-sc', label: 'Noto Sans SC' },
] as const;

export const JOKO_CHINESE_BODY_FONT_OPTIONS = [
  { value: 'noto-sans-sc', label: 'Noto Sans SC' },
  { value: 'noto-serif-sc', label: 'Noto Serif SC' },
] as const;


export const JOKO_FONT_WEIGHT_OPTIONS = [
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'SemiBold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'ExtraBold' },
  { value: 900, label: 'Black' },
] as const;
