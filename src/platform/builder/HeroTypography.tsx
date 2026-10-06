import type { CSSProperties, ElementType } from 'react';
import type { BuilderRichText, HeroTextStyle, HeroTitleLineStyle } from './contracts';
import { heroFontFamily, heroRichTextStyle, splitHeroLines } from './heroTypographyUtils';

interface HeroTypographyProps {
  as: 'h1' | 'p';
  value: BuilderRichText;
  kind: 'headline' | 'eyebrow' | 'subtitle';
  style?: HeroTextStyle;
  lineStyles?: readonly HeroTitleLineStyle[];
  className?: string;
}

export function HeroTypography({ as, value, kind, style, lineStyles, className = '' }: HeroTypographyProps) {
  const Element: ElementType = as;
  const headline = kind === 'headline';
  const eyebrow = kind === 'eyebrow';
  const defaults: CSSProperties = {
    fontFamily: heroFontFamily(style?.font, headline ? 'var(--joko-font-display)' : 'var(--joko-font-body)'),
    fontWeight: style?.bold !== undefined ? (style.bold ? 700 : 400) : (headline || eyebrow ? 700 : 400),
    fontStyle: style?.italic ? 'italic' : 'normal',
    textAlign: style?.align || 'left',
    color: eyebrow ? '#3F665E' : 'var(--joko-brand-text,#303532)',
    ...(kind === 'subtitle' ? { opacity: 0.8 } : {}),
    fontSize: style?.size !== undefined
      ? `clamp(${eyebrow ? 9 : 12}px, ${eyebrow ? 6 : 12}vw, ${style.size}px)`
      : headline ? 'clamp(2.9rem, 5vw, var(--joko-size-hero, 65px))'
        : eyebrow ? 'var(--joko-size-label,11px)' : 'var(--joko-size-body,16px)',
  };
  const lines = splitHeroLines(value);
  return <Element className={className} style={defaults}>
    {lines.map((line, index) => {
      const lineStyle = lineStyles?.[index];
      return <span key={index} className="block" style={{
        ...(lineStyle?.align ? { textAlign: lineStyle.align } : {}),
        ...(lineStyle?.font ? { fontFamily: heroFontFamily(lineStyle.font) } : {}),
        ...(lineStyle?.size ? { fontSize: `clamp(12px, 12vw, ${lineStyle.size}px)` } : {}),
      }}>
        {line.length ? line.map((run, runIndex) => <span key={runIndex} style={heroRichTextStyle(run.marks)}>{run.text}</span>) : '\u00a0'}
      </span>;
    })}
  </Element>;
}
