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
    <PageCanvas surface="soft" className="min-h-screen py-0">
      <Container width="wide">
        <header className="mb-8 border-b border-primary-900/10 py-5 sm:mb-10 sm:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <a
              href="/"
              className="group inline-flex w-fit flex-col focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              <span className="font-serif text-xl font-semibold tracking-tight text-primary-950 group-hover:text-primary-700 sm:text-2xl">
                JOKO TODAY
              </span>
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-700/90">
                {copy.notebook}
              </span>
            </a>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <nav aria-label={copy.notebook}>
                <ul className="flex gap-5">
                  {navItems.map((item) => {
                    const isActive = active === item.key;

                    return (
                      <li key={item.key}>
                        <a
                          href={getNotebookPath(item.target)}
                          onClick={(event) => handleRouteClick(event, item.target)}
                          aria-current={isActive ? 'page' : undefined}
                          className={[
                            'inline-flex min-h-9 items-center border-b pb-1 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                            isActive
                              ? 'border-primary-800 text-primary-950'
                              : 'border-transparent text-gray-600 hover:border-primary-300 hover:text-primary-900',
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
                className="flex items-center gap-2 text-xs font-semibold text-gray-500"
                role="group"
                aria-label={copy.language}
              >
                {languageOptions.map((option, index) => {
                  const isActive = language === option.code;

                  return (
                    <span key={option.code} className="inline-flex items-center gap-2">
                      {index > 0 && <span className="text-primary-900/20" aria-hidden="true">/</span>}
                      <button
                        type="button"
                        onClick={() => setLanguage(option.code)}
                        aria-pressed={isActive}
                        className={[
                          'rounded px-1 py-1 transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
                          isActive
                            ? 'text-primary-950'
                            : 'text-gray-500 hover:text-primary-800',
                        ].join(' ')}
                      >
                        {option.label}
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </header>

        <div className="pb-12 sm:pb-16">{children}</div>
      </Container>
    </PageCanvas>
  );
}
