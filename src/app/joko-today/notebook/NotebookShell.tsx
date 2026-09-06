import type { MouseEvent, ReactNode } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { Container, PageCanvas } from '../../../platform/design-system';
import { getNotebookPath } from '../../../platform/notebook';

export type NotebookTopLevelTarget =
  | { type: 'notebook.today' }
  | { type: 'notebook.history' };

interface NotebookShellProps {
  active: 'today' | 'history';
  onNavigate: (target: NotebookTopLevelTarget) => void;
  children: ReactNode;
}

const labels = {
  en: {
    notebook: 'Community Notebook',
    today: 'Today',
    history: 'History',
    language: 'Language',
  },
  th: {
    notebook: 'สมุดบันทึกชุมชน',
    today: 'วันนี้',
    history: 'ย้อนหลัง',
    language: 'ภาษา',
  },
  zh: {
    notebook: '社区笔记本',
    today: '今日',
    history: '往期',
    language: '语言',
  },
} as const;

const languageOptions = [
  { code: 'en', label: 'EN' },
  { code: 'th', label: 'TH' },
  { code: 'zh', label: '中文' },
] as const;

export function NotebookShell({ active, onNavigate, children }: NotebookShellProps) {
  const { language, setLanguage } = useLanguage();
  const copy = labels[language];

  const handleRouteClick = (
    event: MouseEvent<HTMLAnchorElement>,
    target: NotebookTopLevelTarget,
  ) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    onNavigate(target);
  };

  const navItems: Array<{
    key: 'today' | 'history';
    label: string;
    target: NotebookTopLevelTarget;
  }> = [
    { key: 'today', label: copy.today, target: { type: 'notebook.today' } },
    { key: 'history', label: copy.history, target: { type: 'notebook.history' } },
  ];

  return (
    <PageCanvas surface="soft" className="py-5 sm:py-8">
      <Container width="wide">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-primary-200 bg-background px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <a href="/" className="group inline-flex flex-col focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2">
              <span className="font-serif text-xl font-semibold text-primary-950 group-hover:text-primary-700">
                JOKO TODAY
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700">
                {copy.notebook}
              </span>
            </a>

            <div className="flex flex-wrap items-center gap-3">
              <nav aria-label={copy.notebook}>
                <ul className="flex gap-2">
                  {navItems.map((item) => {
                    const isActive = active === item.key;

                    return (
                      <li key={item.key}>
                        <a
                          href={getNotebookPath(item.target)}
                          onClick={(event) => handleRouteClick(event, item.target)}
                          aria-current={isActive ? 'page' : undefined}
                          className={[
                            'inline-flex min-h-10 items-center rounded-full px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                            isActive
                              ? 'bg-primary-700 text-white'
                              : 'text-primary-900 hover:bg-primary-100',
                          ].join(' ')}
                        >
                          {item.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div
                className="flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 p-1"
                role="group"
                aria-label={copy.language}
              >
                {languageOptions.map((option) => {
                  const isActive = language === option.code;

                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => setLanguage(option.code)}
                      aria-pressed={isActive}
                      className={[
                        'inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
                        isActive
                          ? 'bg-primary-700 text-white'
                          : 'text-primary-900 hover:bg-primary-100',
                      ].join(' ')}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        {children}
      </Container>
    </PageCanvas>
  );
}
