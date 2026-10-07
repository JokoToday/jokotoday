import type { CSSProperties } from 'react';
import type { BuilderRichText, BuilderRichTextMarks, HeroFontPreset, HeroTextStyle } from './contracts';

export const HERO_FONT_OPTIONS = [
  { value: 'inherit', label: 'Use JOKO font' },
  { value: 'display', label: 'JOKO display' },
  { value: 'body', label: 'JOKO body' },
  { value: 'handwritten', label: 'Handwritten (notebook)' },
] as const;

/** Exactly the same handwritten font stack as "Meet Joe & Phuttan". */
export const HERO_NOTEBOOK_FONT = '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive';

export function heroFontFamily(font: HeroFontPreset | undefined, fallback = 'var(--joko-font-display)'): string {
  if (font === 'handwritten') return HERO_NOTEBOOK_FONT;
  if (font === 'display') return 'var(--joko-font-display)';
  if (font === 'body') return 'var(--joko-font-body)';
  return fallback;
}

export function splitHeroLines(value: BuilderRichText): BuilderRichText[] {
  const lines: Array<Array<{ text: string; marks?: BuilderRichTextMarks }>> = [[]];
  for (const run of value) {
    run.text.split('\n').forEach((segment, index) => {
      if (index > 0) lines.push([]);
      if (segment) lines[lines.length - 1].push({ text: segment, ...(run.marks ? { marks: run.marks } : {}) });
    });
  }
  return lines;
}

export function heroRichTextStyle(marks?: BuilderRichTextMarks): CSSProperties {
  const color = marks?.color === 'accent' ? 'var(--joko-brand-accent,#C76624)'
    : marks?.color === 'turquoise' ? 'var(--joko-brand-turquoise,#DAEBE8)'
    : marks?.color === 'text' ? 'var(--joko-brand-text,#303532)' : undefined;
  return {
    ...(color ? { color } : {}),
    ...(marks?.bold !== undefined ? { fontWeight: marks.bold ? 700 : 400 } : {}),
    ...(marks?.italic !== undefined ? { fontStyle: marks.italic ? 'italic' : 'normal' } : {}),
    ...(marks?.font ? { fontFamily: heroFontFamily(marks.font) } : {}),
    ...(marks?.size ? { fontSize: `clamp(12px, 12vw, ${marks.size}px)` } : {}),
  };
}

/** Prefer locale settings, preserving the shared legacy style as fallback. */
export function resolveHeroLocaleStyle(
  shared: HeroTextStyle | undefined,
  styles: Readonly<Record<string, HeroTextStyle>> | undefined,
  locale: string,
): HeroTextStyle | undefined {
  const specific = styles?.[locale];
  return specific ? { ...shared, ...specific } : shared;
}
