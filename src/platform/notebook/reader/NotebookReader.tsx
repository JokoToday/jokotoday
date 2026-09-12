import type { ReactNode } from 'react';
import type {
  NotebookAssetRef,
  NotebookBlock,
  NotebookEntry,
  NotebookEntryRef,
  NotebookReadingSurface,
  NotebookRouteTarget,
  NotebookTodayDocument,
} from '../contracts';
import { getNotebookEntryTarget } from '../routes';
import { getNotebookLocalizedText } from './localization';

export interface NotebookResolvedAsset {
  src: string;
}

export type NotebookAssetResolver = (
  asset: NotebookAssetRef,
) => NotebookResolvedAsset | null | undefined;

export interface NotebookReaderProps {
  document: NotebookTodayDocument;
  entries: readonly NotebookEntry[];
  locale: string;
  defaultLocale: string;
  resolveAsset?: NotebookAssetResolver;
  onNavigate?: (target: NotebookRouteTarget) => void;
  className?: string;
}

function entryRefKey(ref: NotebookEntryRef): string {
  return `${ref.kind}:${ref.id}`;
}

function entryKey(entry: NotebookEntry): string {
  return `${entry.kind}:${entry.id}`;
}

function pairSurfaces(
  surfaces: readonly NotebookReadingSurface[],
): Array<readonly [NotebookReadingSurface, NotebookReadingSurface?]> {
  const spreads: Array<readonly [NotebookReadingSurface, NotebookReadingSurface?]> = [];

  for (let index = 0; index < surfaces.length; index += 2) {
    spreads.push([surfaces[index], surfaces[index + 1]]);
  }

  return spreads;
}

interface NotebookBlockViewProps {
  block: NotebookBlock;
  entries: readonly NotebookEntry[];
  locale: string;
  defaultLocale: string;
  resolveAsset?: NotebookAssetResolver;
  onNavigate?: (target: NotebookRouteTarget) => void;
}

function NotebookBlockView({
  block,
  entries,
  locale,
  defaultLocale,
  resolveAsset,
  onNavigate,
}: NotebookBlockViewProps) {
  const text = (value: Parameters<typeof getNotebookLocalizedText>[0]) =>
    getNotebookLocalizedText(value, locale, defaultLocale);

  switch (block.type) {
    case 'text': {
      return (
        <section className="space-y-3">
          {block.eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-700/90">
              {text(block.eyebrow)}
            </p>
          )}
          {block.heading && (
            <h2 className="max-w-lg font-serif text-4xl font-medium leading-[1.05] tracking-tight text-primary-950 sm:text-5xl">
              {text(block.heading)}
            </h2>
          )}
          {block.body && (
            <p className="max-w-prose whitespace-pre-line font-serif text-lg italic leading-7 text-gray-600">
              {text(block.body)}
            </p>
          )}
        </section>
      );
    }

    case 'asset': {
      const resolvedAsset = resolveAsset?.(block.asset);
      const alt = text(block.alt);
      const caption = text(block.caption);

      return (
        <figure className="space-y-3">
          {resolvedAsset ? (
            <div className="relative mx-auto max-w-xl rotate-[-0.35deg] border border-primary-900/10 bg-background p-2 shadow-md">
              <img
                src={resolvedAsset.src}
                alt={alt}
                loading="lazy"
                className="max-h-[26rem] w-full object-cover"
              />
            </div>
          ) : (
            <div
              className="relative mx-auto flex min-h-72 max-w-xl rotate-[-0.35deg] items-end overflow-hidden border border-primary-900/10 bg-background/60 p-6 shadow-sm"
              role="img"
              aria-label={alt}
            >
              <div className="absolute inset-x-8 top-10 h-px rotate-[-3deg] bg-primary-900/10" aria-hidden="true" />
              <div className="absolute left-10 top-20 h-24 w-24 rounded-full border border-primary-900/10" aria-hidden="true" />
              <div className="absolute bottom-20 right-10 h-px w-40 rotate-[6deg] bg-primary-900/10" aria-hidden="true" />
              <p className="relative max-w-sm font-serif text-sm italic leading-6 text-gray-500">
                {alt}
              </p>
            </div>
          )}
          {caption && (
            <figcaption className="mx-auto max-w-xl -rotate-1 px-3 font-serif text-sm italic text-gray-500">
              {caption}
            </figcaption>
          )}
        </figure>
      );
    }

    case 'callout': {
      const actionLabel = block.action ? text(block.action.label) : '';

      return (
        <aside className="relative ml-auto max-w-md rotate-[0.6deg] border border-primary-900/10 bg-primary-50/80 px-5 pb-5 pt-7 shadow-md sm:px-6">
          <span
            className="absolute left-1/2 top-0 h-4 w-20 -translate-x-1/2 -translate-y-1/2 rotate-[-2deg] bg-primary-200/80"
            aria-hidden="true"
          />
          {block.heading && (
            <p className="font-serif text-2xl font-medium text-primary-950">{text(block.heading)}</p>
          )}
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{text(block.body)}</p>
          {block.action && actionLabel && (
            onNavigate ? (
              <button
                type="button"
                onClick={() => onNavigate(block.action!.target)}
                className="mt-4 inline-flex min-h-10 items-center border-b border-primary-700 pb-1 text-sm font-semibold text-primary-800 transition hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {actionLabel}
                <span className="ml-2" aria-hidden="true">→</span>
              </button>
            ) : (
              <span className="mt-4 inline-block border-b border-primary-700 pb-1 text-sm font-semibold text-primary-800">
                {actionLabel}
              </span>
            )
          )}
        </aside>
      );
    }

    case 'entry-link': {
      const relatedEntry = entries.find((entry) => entryKey(entry) === entryRefKey(block.entryRef));
      const relatedTitle = relatedEntry ? text(relatedEntry.title) : '';
      const content = (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700/90">
            {text(block.label)}
          </p>
          {relatedTitle && <p className="mt-2 font-serif text-3xl text-primary-950">{relatedTitle}</p>}
          {block.note && <p className="mt-3 max-w-md text-sm leading-6 text-gray-600">{text(block.note)}</p>}
          {relatedEntry && onNavigate && (
            <span className="mt-3 inline-block text-sm font-semibold text-primary-800" aria-hidden="true">
              →
            </span>
          )}
        </>
      );

      if (relatedEntry && onNavigate) {
        return (
          <button
            type="button"
            onClick={() => onNavigate(getNotebookEntryTarget(relatedEntry))}
            className="w-full border-t border-primary-900/10 py-6 text-left transition hover:bg-primary-50/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
          >
            {content}
          </button>
        );
      }

      return <div className="border-t border-primary-900/10 py-6">{content}</div>;
    }
  }
}

interface NotebookSurfaceProps extends Omit<NotebookBlockViewProps, 'block'> {
  surface: NotebookReadingSurface;
  pageNumber: number;
  side: 'left' | 'right';
}

function NotebookSurface({
  surface,
  pageNumber,
  side,
  entries,
  locale,
  defaultLocale,
  resolveAsset,
  onNavigate,
}: NotebookSurfaceProps) {
  const desktopPaper = side === 'left'
    ? 'lg:rounded-l-[2.25rem] lg:bg-gradient-to-br lg:from-background-secondary/80 lg:via-background lg:to-primary-50/25'
    : 'lg:rounded-r-[2.25rem] lg:bg-gradient-to-bl lg:from-background-secondary/80 lg:via-background lg:to-primary-50/25';

  return (
    <article
      className={`relative min-h-[34rem] rounded-3xl border border-primary-900/10 bg-gradient-to-br from-background-secondary/80 via-background to-primary-50/25 px-6 py-8 shadow-lg sm:min-h-[38rem] sm:px-8 sm:py-10 lg:min-h-[43rem] lg:rounded-none lg:border-0 lg:px-10 lg:py-12 lg:shadow-none ${desktopPaper}`}
      aria-label={`Notebook surface ${pageNumber}`}
    >
      <div className="space-y-8 sm:space-y-10">
        {surface.blocks.map((block) => (
          <NotebookBlockView
            key={block.id}
            block={block}
            entries={entries}
            locale={locale}
            defaultLocale={defaultLocale}
            resolveAsset={resolveAsset}
            onNavigate={onNavigate}
          />
        ))}
      </div>
      <span className="absolute bottom-5 right-6 font-serif text-xs italic text-gray-400" aria-hidden="true">
        {pageNumber}
      </span>
    </article>
  );
}

function EmptyNotebookSurface(): ReactNode {
  return (
    <div
      className="hidden min-h-[43rem] rounded-r-[2.25rem] bg-gradient-to-bl from-background-secondary/80 via-background to-primary-50/25 lg:block"
      aria-hidden="true"
    />
  );
}

export function NotebookReader({
  document,
  entries,
  locale,
  defaultLocale,
  resolveAsset,
  onNavigate,
  className = '',
}: NotebookReaderProps) {
  const spreads = pairSurfaces(document.surfaces);
  const title = getNotebookLocalizedText(document.title, locale, defaultLocale);

  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between gap-4 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-800/80 sm:px-5">
        <span>{title}</span>
        <time dateTime={document.date}>{document.date}</time>
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="absolute -bottom-3 left-6 right-6 top-3 rounded-[2.5rem] bg-primary-900/10 blur-sm lg:left-10 lg:right-10" aria-hidden="true" />

        <div className="relative z-10 space-y-5 lg:overflow-hidden lg:rounded-[2.25rem] lg:border lg:border-primary-900/10 lg:bg-background lg:shadow-[0_24px_70px_rgb(var(--color-primary-950)/0.14)]">
          {spreads.map(([leftSurface, rightSurface], spreadIndex) => {
            const leftPageNumber = spreadIndex * 2 + 1;
            const rightPageNumber = leftPageNumber + 1;

            return (
              <div
                key={leftSurface.id}
                className="relative grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-0 lg:border-b lg:border-primary-900/10 lg:last:border-b-0"
              >
                <NotebookSurface
                  surface={leftSurface}
                  pageNumber={leftPageNumber}
                  side="left"
                  entries={entries}
                  locale={locale}
                  defaultLocale={defaultLocale}
                  resolveAsset={resolveAsset}
                  onNavigate={onNavigate}
                />
                {rightSurface ? (
                  <NotebookSurface
                    surface={rightSurface}
                    pageNumber={rightPageNumber}
                    side="right"
                    entries={entries}
                    locale={locale}
                    defaultLocale={defaultLocale}
                    resolveAsset={resolveAsset}
                    onNavigate={onNavigate}
                  />
                ) : (
                  <EmptyNotebookSurface />
                )}

                <div
                  className="pointer-events-none absolute bottom-0 left-1/2 top-0 z-20 hidden w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary-950/5 to-transparent lg:block"
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute bottom-8 left-1/2 top-8 z-20 hidden w-px -translate-x-1/2 bg-primary-950/10 lg:block"
                  aria-hidden="true"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
