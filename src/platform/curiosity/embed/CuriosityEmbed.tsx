import type { CuriosityEpisode, CuriosityLocalizedText } from '../contracts';

export type CuriosityEmbedVariant = 'full' | 'compact' | 'homepage-explainer';

interface CuriosityEmbedProps {
  episode: CuriosityEpisode;
  locale?: string;
  defaultLocale?: string;
  variant?: CuriosityEmbedVariant;
  className?: string;
}

function text(
  value: CuriosityLocalizedText | undefined,
  locale: string,
  defaultLocale: string,
): string {
  if (!value) return '';
  return value[locale] ?? value[defaultLocale] ?? Object.values(value)[0] ?? '';
}

export function CuriosityEmbed({
  episode,
  locale = 'en',
  defaultLocale = 'en',
  variant = 'full',
  className = '',
}: CuriosityEmbedProps) {
  const question = text(episode.question, locale, defaultLocale);
  const summary = text(episode.summary, locale, defaultLocale);
  const shortAnswer = text(episode.shortAnswer, locale, defaultLocale);
  const guideName = episode.guide ? text(episode.guide.name, locale, defaultLocale) : '';
  const isCompact = variant === 'compact';

  return (
    <article
      className={`rounded-[2rem] border border-stone-200 bg-[#fffdf7] shadow-sm ${
        isCompact ? 'p-5' : 'p-7 sm:p-9'
      } ${className}`}
      data-curiosity-id={episode.id}
      data-curiosity-variant={variant}
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
        <span>{episode.scope === 'shared' ? 'Shared Curiosity' : 'About JOKO'}</span>
        <span aria-hidden="true">·</span>
        <span>{episode.answerStatus.replace('-', ' ')}</span>
      </div>

      <h2 className={`${isCompact ? 'mt-3 text-2xl' : 'mt-4 text-3xl sm:text-4xl'} font-serif leading-tight text-stone-900`}>
        {question}
      </h2>

      {!isCompact && summary && (
        <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">{summary}</p>
      )}

      {shortAnswer ? (
        <div className={`${isCompact ? 'mt-4' : 'mt-6'} rounded-2xl bg-stone-100/80 p-5`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
            {variant === 'homepage-explainer' ? 'How it works' : 'In short'}
          </p>
          <p className="mt-2 leading-7 text-stone-800">{shortAnswer}</p>
        </div>
      ) : (
        <p className="mt-5 italic text-stone-500">Still wondering…</p>
      )}

      {!isCompact && (
        <footer className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-stone-200 pt-4 text-sm text-stone-500">
          <div>{guideName ? `With ${guideName}` : `Origin: ${episode.origin.type}`}</div>
          <div className="flex flex-wrap gap-2">
            {episode.topics.slice(0, 4).map((topic) => (
              <span key={topic} className="rounded-full border border-stone-200 px-3 py-1">
                {topic}
              </span>
            ))}
          </div>
        </footer>
      )}
    </article>
  );
}
