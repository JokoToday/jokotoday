import { useLanguage } from '../../../context/LanguageContext';
import { useNotebookContent } from '../../../hooks/useNotebookContent';
import { NotebookReader } from '../../../platform/notebook';
import { NotebookShell, type NotebookTopLevelTarget } from './NotebookShell';

interface NotebookTodayPageProps {
  onNavigate: (target: NotebookTopLevelTarget) => void;
}

export function NotebookTodayPage({ onNavigate }: NotebookTodayPageProps) {
  const { language } = useLanguage();
  const content = useNotebookContent();
  const { site, today, entries } = content.bundle;
  const intro = {
    eyebrow: content.config.intro.eyebrow[language],
    statement: content.config.intro.statement[language],
    note: content.config.intro.note[language],
  };

  return (
    <NotebookShell active="today" onNavigate={onNavigate}>
      <section className="grid gap-8 xl:grid-cols-[minmax(13rem,0.28fr)_minmax(0,1fr)] xl:items-start xl:gap-10">
        <aside className="xl:sticky xl:top-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-700/90">
            {intro.eyebrow}
          </p>
          <h1 className="mt-4 max-w-sm font-serif text-4xl font-medium leading-[1.04] tracking-tight text-primary-950 sm:text-5xl xl:text-[3.4rem]">
            {intro.statement}
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-6 text-gray-600 sm:text-base sm:leading-7">
            {intro.note}
          </p>
          <div className="mt-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary-800/70">
            <span className="h-px w-10 bg-primary-800/30" aria-hidden="true" />
            <time dateTime={today.date}>{today.date}</time>
          </div>
        </aside>

        <NotebookReader
          document={today}
          entries={entries}
          locale={language}
          defaultLocale={site.defaultLocale}
          resolveAsset={(asset) => {
            const src = content.assetUrls[asset.id];
            return src ? { src } : null;
          }}
          className="min-w-0"
        />
      </section>
    </NotebookShell>
  );
}

export default NotebookTodayPage;
