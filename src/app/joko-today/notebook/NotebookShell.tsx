import type { MouseEvent, ReactNode } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { Container } from '../../../platform/design-system';
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
  },
  th: {
    notebook: 'สมุดบันทึกชุมชน',
    today: 'วันนี้',
    history: 'ย้อนหลัง',
  },
  zh: {
    notebook: '社区笔记本',
    today: '今日',
    history: '往期',
  },
} as const;

export function NotebookShell({ active, onNavigate, children }: NotebookShellProps) {
  const { language } = useLanguage();
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
    <Container width="wide">
      <section className="pb-12 pt-6 sm:pb-16 sm:pt-8" aria-label={copy.notebook}>
        <header className="mb-8 flex flex-col gap-3 border-b border-primary-900/10 pb-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700/90">
            {copy.notebook}
          </p>

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
        </header>

        {children}
      </section>
    </Container>
  );
}
