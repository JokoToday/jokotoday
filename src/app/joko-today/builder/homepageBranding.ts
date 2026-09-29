import type { CSSProperties } from 'react';

export type JokoDisplayFont = 'noto-sans' | 'inter' | 'playfair-display';
export type JokoBodyFont = 'inter' | 'noto-sans';

export interface JokoHomepageBranding {
  logoScale: number;
  typography: {
    displayFont: JokoDisplayFont;
    bodyFont: JokoBodyFont;
    thaiFont: 'noto-sans-thai-looped';
    chineseFont: 'noto-sans-sc';
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

export const DEFAULT_JOKO_HOMEPAGE_BRANDING: JokoHomepageBranding = {
  logoScale: 120,
  typography: {
    displayFont: 'noto-sans',
    bodyFont: 'inter',
    thaiFont: 'noto-sans-thai-looped',
    chineseFont: 'noto-sans-sc',
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

const DISPLAY_FONT_STACKS: Record<JokoDisplayFont, string> = {
  'noto-sans': "'Noto Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  inter: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  'playfair-display': "'Playfair Display', Georgia, serif",
};

const BODY_FONT_STACKS: Record<JokoBodyFont, string> = {
  inter: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  'noto-sans': "'Noto Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
};

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= min && numeric <= max ? numeric : fallback;
}

function safeHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback;
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
    ? typography.displayFont as JokoDisplayFont
    : DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.displayFont;
  const bodyFont = ['inter', 'noto-sans'].includes(String(typography.bodyFont))
    ? typography.bodyFont as JokoBodyFont
    : DEFAULT_JOKO_HOMEPAGE_BRANDING.typography.bodyFont;

  return {
    logoScale: numberInRange(input.logoScale, DEFAULT_JOKO_HOMEPAGE_BRANDING.logoScale, 70, 150),
    typography: {
      displayFont,
      bodyFont,
      thaiFont: 'noto-sans-thai-looped',
      chineseFont: 'noto-sans-sc',
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

export function jokoBrandingCssVariables(branding: JokoHomepageBranding): CSSProperties {
  return {
    '--joko-logo-scale': String(branding.logoScale / 100),
    '--joko-font-display': DISPLAY_FONT_STACKS[branding.typography.displayFont],
    '--joko-font-shell': BODY_FONT_STACKS[branding.typography.bodyFont],
    '--joko-font-body': BODY_FONT_STACKS[branding.typography.bodyFont],
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
