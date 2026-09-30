import type { CSSProperties } from 'react';
import type { BuilderRichText, BuilderRichTextColor } from '../contracts';

function semanticColor(color: BuilderRichTextColor | undefined): string | undefined {
  if (color === 'accent') return 'var(--joko-brand-accent, #C76624)';
  if (color === 'turquoise') return 'var(--joko-brand-turquoise, #DAEBE8)';
  if (color === 'text') return 'var(--joko-brand-text, #303532)';
  return undefined;
}

export function BuilderRichTextContent({ value }: { value: BuilderRichText }) {
  return (
    <>
      {value.map((run, index) => {
        const style: CSSProperties = {
          color: semanticColor(run.marks?.color),
          fontWeight: run.marks?.bold ? 700 : undefined,
          fontStyle: run.marks?.italic ? 'italic' : undefined,
        };

        return (
          <span key={`${index}-${run.text}`} style={style}>
            {run.text}
          </span>
        );
      })}
    </>
  );
}
