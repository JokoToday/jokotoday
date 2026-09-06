import { useLanguage } from '../../../context/LanguageContext';
import {
  getNotebookLocalizedText,
  jokoTodayNotebookFixture,
} from '../../../platform/notebook';
import { NotebookShell, type NotebookTopLevelTarget } from './NotebookShell';

interface NotebookHistoryPageProps {
  onNavigate: (target: NotebookTopLevelTarget) => void;
}

const labels = {
  en: {
    eyebrow: 'Community Notebook',
    title: 'History',
    introduction: 'Pages the notebook has kept from earlier days.',
    empty: 'No earlier pages have been kept yet.',
  },
  th: {
    eyebrow: 'สมุดบันทึกชุมชน',
    title: 'ย้อนหลัง',
    introduction: 'หน้าที่สมุดบันทึกเก็บไว้จากวันก่อน ๆ',
    empty: 'ยังไม่มีหน้าก่อนหน้านี้ในสมุดบันทึก',
  },
  zh: {
    eyebrow: '社区笔记本',
    title: '往期',
    introduction: '笔记本保存下来的往日页面。',
    empty: '笔记本里还没有保存往期页面。',
  },
} as const;

export function NotebookHistoryPage({ onNavigate }: NotebookHistoryPageProps) {
  const { language } = useLanguage();
  const { site, history } = jokoTodayNotebookFixture;
  const copy = labels[language];

  return (
    <NotebookShell active="history" onNavigate={onNavigate}>
      <section className="rounded-3xl border border-primary-200 bg-background p-6 shadow-sm sm:p-8 lg:p-10" aria-labelledby="notebook-history-title">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
          {copy.eyebrow}
        </p>
        <h1 id="notebook-history-title" className="mt-2 font-serif text-4xl font-semibold text-primary-950 sm:text-5xl">
          {copy.title}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">
          {copy.introduction}
        </p>

        {history.length > 0 ? (
          <ol className="mt-8 space-y-4">
            {history.map((item) => (
              <li key={`${item.date}:${item.todayDocumentId}`} className="rounded-2xl border border-primary-200 bg-primary-50 p-5 sm:p-6">
                <time dateTime={item.date} className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700">
                  {item.date}
                </time>
                <h2 className="mt-2 font-serif text-2xl font-semibold text-primary-950">
                  {getNotebookLocalizedText(item.title, language, site.defaultLocale)}
                </h2>
                {item.excerpt && (
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-700 sm:text-base sm:leading-7">
                    {getNotebookLocalizedText(item.excerpt, language, site.defaultLocale)}
                  </p>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-8 rounded-2xl border border-dashed border-primary-300 bg-primary-50 p-6 text-sm text-gray-700">
            {copy.empty}
          </p>
        )}
      </section>
    </NotebookShell>
  );
}

export default NotebookHistoryPage;
