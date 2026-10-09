import type { CSSProperties } from 'react';
import type { HomeHeroNotebookFontPreset } from '../platform/builder/contracts';
import type { JokoNoteImageLayout } from '../lib/jokoNotesService';
import './JokoHeroNotebookNote.css';

interface JokoHeroNotebookNoteProps {
  title?: string;
  body?: string;
  imageUrl?: string;
  imageAlt?: string;
  href?: string;
  className?: string;
  interactive?: boolean;
  fontPreset?: HomeHeroNotebookFontPreset;
  headingSize?: number;
  bodySize?: number;
  rotation?: number;
  imageLayout?: JokoNoteImageLayout;
}

const NOTEBOOK_FONT_STACKS: Record<HomeHeroNotebookFontPreset, string> = {
  handwritten: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
  display: 'var(--joko-font-display, "Noto Sans", sans-serif)',
  body: 'var(--joko-font-body, "Inter", sans-serif)',
};

function NotebookPaper({
  title,
  body,
  imageUrl,
  imageAlt,
  fontPreset = 'handwritten',
  headingSize = 22,
  bodySize = 14,
  rotation = 4,
  imageLayout = 'stacked',
}: Pick<
  JokoHeroNotebookNoteProps,
  'title' | 'body' | 'imageUrl' | 'imageAlt' | 'fontPreset' | 'headingSize' | 'bodySize' | 'rotation' | 'imageLayout'
>) {
  const fontFamily = NOTEBOOK_FONT_STACKS[fontPreset];
  const safeRotation = Number.isFinite(rotation) ? Math.max(-6, Math.min(6, rotation)) : 4;
  const noteStyle = { '--joko-note-rotation': `${safeRotation}deg` } as CSSProperties;

  return (
    <div className="joko-hero-note" style={noteStyle}>
      <span aria-hidden="true" className="joko-hero-note__paper" />
      <span aria-hidden="true" className="joko-hero-note__weathering" />
      <span aria-hidden="true" className="joko-hero-note__tape" />
      <span aria-hidden="true" className="joko-hero-note__holes">
        {Array.from({ length: 8 }, (_, hole) => (
          <span key={hole} className="joko-hero-note__hole" />
        ))}
      </span>

      <div className="joko-hero-note__content">
        {title && (
          <p
            className="whitespace-pre-line font-semibold leading-[1.08] text-[#2F302E]"
            style={{ fontFamily, fontSize: `${headingSize}px` }}
          >
            {title}
          </p>
        )}

        {body && (
          <p
            className="mt-2 whitespace-pre-line leading-[1.4] text-[#3D403C]/80"
            style={{ fontFamily, fontSize: `${bodySize}px` }}
          >
            {body}
          </p>
        )}

        {imageUrl && (
          <img
            src={imageUrl}
            alt={imageAlt || ''}
            className={`joko-hero-note__image joko-hero-note__image--${imageLayout}`}
            decoding="async"
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
}

export function JokoHeroNotebookNote({
  title,
  body,
  imageUrl,
  imageAlt,
  href,
  className = '',
  interactive = true,
  fontPreset = 'handwritten',
  headingSize = 22,
  bodySize = 14,
  rotation = 4,
  imageLayout = 'stacked',
}: JokoHeroNotebookNoteProps) {
  const content = (
    <NotebookPaper
      title={title}
      body={body}
      imageUrl={imageUrl}
      imageAlt={imageAlt}
      fontPreset={fontPreset}
      headingSize={headingSize}
      bodySize={bodySize}
      rotation={rotation}
      imageLayout={imageLayout}
    />
  );

  if (href && interactive) {
    return (
      <a
        href={href}
        className={`joko-hero-note__link block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[#55766F] focus-visible:ring-offset-4 ${className}`}
        aria-label={title || body || 'Open notebook note'}
      >
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}

export default JokoHeroNotebookNote;
