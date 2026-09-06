import { useLanguage } from '../../../context/LanguageContext';
import {
  jokoTodayNotebookFixture,
  NotebookReader,
} from '../../../platform/notebook';
import { NotebookShell, type NotebookTopLevelTarget } from './NotebookShell';

interface NotebookTodayPageProps {
  onNavigate: (target: NotebookTopLevelTarget) => void;
}

export function NotebookTodayPage({ onNavigate }: NotebookTodayPageProps) {
  const { language } = useLanguage();
  const { site, today, entries } = jokoTodayNotebookFixture;

  return (
    <NotebookShell active="today" onNavigate={onNavigate}>
      <NotebookReader
        document={today}
        entries={entries}
        locale={language}
        defaultLocale={site.defaultLocale}
      />
    </NotebookShell>
  );
}

export default NotebookTodayPage;
