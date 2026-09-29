import type { CSSProperties } from 'react';

export type JokoFontChoice =
  | 'playfair-display'
  | 'noto-sans'
  | 'inter'
  | 'noto-sans-thai-looped'
  | 'noto-sans-thai'
  | 'noto-sans-sc'
  | 'lxgw-wenkai-gb';

export interface BuilderSiteStyle {
  logoScale: number;
  typography: {
    englishDisplayFont: JokoFontChoice;
    englishBodyFont: JokoFontChoice;
    thaiFont: JokoFontChoice;
    chineseFont: JokoFontChoice;
    heroSize: number;
    sectionHeadingSize: number;
    bodySize: number;
    navSize: number;
    buttonSize: number;
    labelSize: number;
  };
  colors: {
    ink: string;
    accent: string;
    mineral: string;
  };
}

export const DEFAULT_BUILDER_SITE_STYLE: BuilderSiteStyle = {
  logoScale: 120,
  typography: {
    englishDisplayFont: 'playfair-display',
    englishBodyFont: 'inter',
    thaiFont: 'noto-sans-thai-looped',
    chineseFont: 'noto-sans-sc',
    heroSize: 71,
    sectionHeadingSize: 36,
    bodySize: 16,
    navSize: 15,
    buttonSize: 16,
    labelSize: 11,
  },
  colors: {
    ink: '#303532',
    accent: '#C76624',
    mineral: '#CFE3DF',
  },
};

export const ENGLISH_DISPLAY_FONT_OPTIONS = [
  { value: 'noto-sans', label: 'Noto Sans' },
  { value: 'playfair-display', label: 'Playfair Display' },
  { value: 'inter', label: 'Inter' },
] as const;

export const ENGLISH_BODY_FONT_OPTIONS = [
  { value: 'noto-sans', label: 'Noto Sans' },
  { value: 'inter', label: 'Inter' },
] as const;

export const THAI_FONT_OPTIONS = [
  { value: 'noto-sans-thai-looped', label: 'Noto Sans Thai Looped' },
  { value: 'noto-sans-thai', label: 'Noto Sans Thai' },
] as const;

export const CHINESE_FONT_OPTIONS = [
  { value: 'noto-sans-sc', label: 'Noto Sans SC' },
  { value: 'lxgw-wenkai-gb', label: 'LXGW WenKai GB' },
] as const;

const FONT_STACKS: Record<JokoFontChoice, string> = {
  'playfair-display': "'Playfair Display', serif",
  'noto-sans': "'Noto Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  inter: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  'noto-sans-thai-looped': "'Noto Sans Thai Looped', 'Noto Sans Thai', system-ui, sans-serif",
  'noto-sans-thai': "'Noto Sans Thai', 'Noto Sans Thai Looped', system-ui, sans-serif",
  'noto-sans-sc': "'Noto Sans SC', 'PingFang SC', system-ui, sans-serif",
  'lxgw-wenkai-gb': "'LXGW WenKai GB', 'Noto Sans SC', 'PingFang SC', cursive",
};

export function normalizeBuilderSiteStyle(
  input?: Partial<BuilderSiteStyle> | null,
): BuilderSiteStyle {
  const typography = input?.typography ?? {};
  const colors = input?.colors ?? {};

  return {
    logoScale: typeof input?.logoScale === 'number'
      ? input.logoScale
      : DEFAULT_BUILDER_SITE_STYLE.logoScale,
    typography: {
      ...DEFAULT_BUILDER_SITE_STYLE.typography,
      ...typography,
    },
    colors: {
      ...DEFAULT_BUILDER_SITE_STYLE.colors,
      ...colors,
    },
  };
}

export function builderSiteStyleToCssVariables(
  style: BuilderSiteStyle,
): CSSProperties {
  const normalized = normalizeBuilderSiteStyle(style);
  return {
    '--joko-logo-scale': String(normalized.logoScale / 100),
    '--joko-font-display-en': FONT_STACKS[normalized.typography.englishDisplayFont],
    '--joko-font-body-en': FONT_STACKS[normalized.typography.englishBodyFont],
    '--joko-font-shell-th': FONT_STACKS[normalized.typography.thaiFont],
    '--joko-font-cjk': FONT_STACKS[normalized.typography.chineseFont],
    '--joko-size-hero': `${normalized.typography.heroSize}px`,
    '--joko-size-section-heading': `${normalized.typography.sectionHeadingSize}px`,
    '--joko-size-body': `${normalized.typography.bodySize}px`,
    '--joko-size-nav': `${normalized.typography.navSize}px`,
    '--joko-size-button': `${normalized.typography.buttonSize}px`,
    '--joko-size-label': `${normalized.typography.labelSize}px`,
    '--joko-shell-ink': hexToRgbTriplet(normalized.colors.ink),
    '--joko-shell-orange': hexToRgbTriplet(normalized.colors.accent),
    '--joko-shell-mineral': hexToRgbTriplet(normalized.colors.mineral),
  } as CSSProperties;
}

function hexToRgbTriplet(hex: string): string {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '48 53 50';
  const value = Number.parseInt(normalized, 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}
