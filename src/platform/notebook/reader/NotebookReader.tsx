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
        <section className="space-y-2">
          {block.eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
              {text(block.eyebrow)}
            </p>
          )}
          {block.heading && (
            <h2 className="font-serif text-3xl font-semibold leading-tight text-primary-950 sm:text-4xl">
              {text(block.heading)}
            </h2>
          )}
          {block.body && (
            <p className="max-w-prose whitespace-pre-line text-base leading-7 text-gray-700">
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
            <img
              src={resolvedAsset.src}
              alt={alt}
              loading="lazy"
              className="max-h-80 w-full rounded-2xl object-cover"
            />
          ) : (
            <div
              className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-primary-300 bg-primary-50 p-6 text-center"
              role="img"
              aria-label={alt}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">
                {block.asset.intent}
              </span>
              <p className="mt-3 max-w-sm text-sm leading-6 text-gray-700">{alt}</p>
              <code className="mt-4 rounded bg-background px-2 py-1 text-xs text-gray-500">
                {block.asset.id}
              </code>
            </div>
          )}
          {caption && <figcaption className="text-sm italic text-gray-600">{caption}</figcaption>}
        </figure>
      );
    }

    case 'callout': {
      const actionLabel = block.action ? text(block.action.label) : '';

      return (
        <aside className="rounded-2xl border border-primary-200 bg-primary-50 p-5 shadow-sm">
          {block.heading && (
            <p className="font-serif text-xl font-semibold text-primary-950">{text(block.heading)}</p>
          )}
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-700">{text(block.body)}</p>
          {block.action && actionLabel && (
            onNavigate ? (
              <button
                type="button"
                onClick={() => onNavigate(block.action!.target)}
                className="mt-4 inline-flex min-h-10 items-center rounded-full bg-primary-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {actionLabel}
              </button>
            ) : (
              <span className="mt-4 inline-block text-sm font-semibold text-primary-700">
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
          <p className="text-sm font-semibold text-primary-800">{text(block.label)}</p>
          {relatedTitle && <p className="mt-1 font-serif text-2xl text-primary-950">{relatedTitle}</p>}
          {block.note && <p className="mt-2 text-sm leading-6 text-gray-700">{text(block.note)}</p>}
        </>
      );

      if (relatedEntry && onNavigate) {
        return (
          <button
            type="button"
            onClick={() => onNavigate(getNotebookEntryTarget(relatedEntry))}
            className="w-full border-y border-primary-200 py-4 text-left transition hover:bg-primary-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
          >
            {content}
          </button>
        );
      }

      return <div className="border-y border-primary-200 py-4">{content}</div>;
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
  const borderClass = side === 'right'
    ? 'border-t border-primary-200 lg:border-l lg:border-t-0'
    : '';

  return (
    <article
      className={`relative min-h-[34rem] bg-background p-6 sm:p-8 lg:min-h-[38rem] lg:p-10 ${borderClass}`}
      aria-label={`Notebook surface ${pageNumber}`}
    >
      <div className="space-y-7">
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
      <span className="absolute bottom-4 right-5 text-xs text-gray-400" aria-hidden="true">
        {pageNumber}
      </span>
    </article>
  );
}

function EmptyNotebookSurface(): ReactNode {
  return <div className="hidden min-h-[38rem] border-l border-primary-200 bg-background lg:block" aria-hidden="true" />;
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

  return (
    <div className={className}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">Notebook</p>
          <p className="mt-1 text-sm text-gray-600">
            {getNotebookLocalizedText(document.title, locale, defaultLocale)}
          </p>
        </div>
        <time dateTime={document.date} className="text-sm text-gray-500">
          {document.date}
        </time>
      </div>

      <div className="overflow-hidden rounded-3xl border border-primary-200 bg-background shadow-xl">
        {spreads.map(([leftSurface, rightSurface], spreadIndex) => {
          const leftPageNumber = spreadIndex * 2 + 1;
          const rightPageNumber = leftPageNumber + 1;

          return (
            <div
              key={leftSurface.id}
              className="grid grid-cols-1 border-b border-primary-200 last:border-b-0 lg:grid-cols-2"
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
