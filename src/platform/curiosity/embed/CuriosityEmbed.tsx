import { ArrowRight } from 'lucide-react';
import type { CuriosityEpisode, CuriosityLocalizedText } from '../contracts';

export type CuriosityEmbedVariant = 'full' | 'compact' | 'homepage-explainer';

interface CuriosityEmbedProps {
  episode: CuriosityEpisode;
  locale?: string;
  defaultLocale?: string;
  variant?: CuriosityEmbedVariant;
  className?: string;
}

const uiCopy = {
  en: {
    shared: 'Shared Curiosity',
    local: 'About JOKO',
    how: 'How it works',
    inShort: 'In short',
    stillWondering: 'Still wondering…',
  },
  th: {
    shared: 'ความอยากรู้ร่วมกัน',
    local: 'เกี่ยวกับ JOKO',
    how: 'ทำงานอย่างไร',
    inShort: 'สรุปสั้น ๆ',
    stillWondering: 'ยังสงสัยอยู่…',
  },
  zh: {
    shared: '共享好奇',
    local: '关于 JOKO',
    how: '怎样运作',
    inShort: '简单来说',
    stillWondering: '还在好奇…',
  },
} as const;

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
  const language = locale === 'th' || locale === 'zh' ? locale : 'en';
  const labels = uiCopy[language];
  const question = text(episode.question, locale, defaultLocale);
  const summary = text(episode.summary, locale, defaultLocale);
  const shortAnswer = text(episode.shortAnswer, locale, defaultLocale);
  const guideName = episode.guide ? text(episode.guide.name, locale, defaultLocale) : '';
  const isCompact = variant === 'compact';

  if (variant === 'homepage-explainer') {
    return (
      <article
        className={`rounded-[2rem] border border-[#55766F]/12 bg-white/20 px-5 py-8 sm:px-8 sm:py-10 ${className}`}
        data-curiosity-id={episode.id}
        data-curiosity-variant={variant}
      >
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#466861]/75">
            {episode.scope === 'shared' ? labels.shared : labels.local}
          </p>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-[#303532] sm:text-3xl">
            {question}
          </h2>
          {summary && <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#303532]/70 sm:text-base">{summary}</p>}
        </header>

        {episode.steps?.length ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-3">
            {episode.steps.map((step, index) => (
              <article key={step.id} className="relative px-4 py-3 text-center xl:px-6">
                <div className="mb-3 flex items-center justify-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#304B45] text-sm font-semibold text-[#F4EFE5]">
                    {index + 1}
                  </span>
                  <h3 className="text-xl font-semibold text-[#303532]">{text(step.title, locale, defaultLocale)}</h3>
                </div>
                <p className="mx-auto max-w-[15rem] text-sm leading-5 text-[#303532]/68">
                  {text(step.body, locale, defaultLocale)}
                </p>
                {index < episode.steps!.length - 1 && (
                  <ArrowRight className="absolute -right-2 top-5 hidden h-5 w-5 text-[#55766F]/45 xl:block" aria-hidden="true" />
                )}
              </article>
            ))}
          </div>
        ) : shortAnswer ? (
          <div className="mx-auto mt-7 max-w-2xl rounded-2xl bg-[#F4EFE5]/70 p-5 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#466861]/75">{labels.how}</p>
            <p className="mt-2 leading-7 text-[#303532]/80">{shortAnswer}</p>
          </div>
        ) : (
          <p className="mt-6 text-center italic text-[#303532]/55">{labels.stillWondering}</p>
        )}
      </article>
    );
  }

  return (
    <article
      className={`rounded-[2rem] border border-stone-200 bg-[#fffdf7] shadow-sm ${
        isCompact ? 'p-5' : 'p-7 sm:p-9'
      } ${className}`}
      data-curiosity-id={episode.id}
      data-curiosity-variant={variant}
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">
        <span>{episode.scope === 'shared' ? labels.shared : labels.local}</span>
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">{labels.inShort}</p>
          <p className="mt-2 leading-7 text-stone-800">{shortAnswer}</p>
        </div>
      ) : (
        <p className="mt-5 italic text-stone-500">{labels.stillWondering}</p>
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
