import { useLanguage } from '../../../context/LanguageContext';
import { Container, PageCanvas } from '../../../platform/design-system';
import {
  jokoTodayNotebookFixture,
  NotebookReader,
} from '../../../platform/notebook';

export function NotebookReaderProofPage() {
  const { language } = useLanguage();
  const { site, today, entries } = jokoTodayNotebookFixture;

  return (
    <PageCanvas surface="soft" className="py-6 sm:py-10">
      <Container width="wide">
        <div className="mb-6 rounded-2xl border border-primary-200 bg-background p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">
              Notebook Engine v1 · Reader proof
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Temporary unlinked proof route. Assets intentionally fall back to semantic placeholders.
            </p>
          </div>
          <p className="mt-3 text-sm font-medium text-primary-900 sm:mt-0">
            {language.toUpperCase()} · desktop spread / mobile serial
          </p>
        </div>

        <NotebookReader
          document={today}
          entries={entries}
          locale={language}
          defaultLocale={site.defaultLocale}
        />
      </Container>
    </PageCanvas>
  );
}

export default NotebookReaderProofPage;
