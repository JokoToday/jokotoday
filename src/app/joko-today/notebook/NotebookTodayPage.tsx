import { useLanguage } from '../../../context/LanguageContext';
import {
  jokoTodayNotebookFixture,
  NotebookReader,
} from '../../../platform/notebook';
import { NotebookShell, type NotebookTopLevelTarget } from './NotebookShell';

interface NotebookTodayPageProps {
  onNavigate: (target: NotebookTopLevelTarget) => void;
}

const todayIntro = {
  en: {
    eyebrow: 'Today in the notebook',
    statement: 'A bakery. Curious people. One notebook that keeps growing.',
    note: 'Today starts with Emma at Sunday Walking Street — one small observation leading to another.',
  },
  th: {
    eyebrow: 'วันนี้ในสมุดบันทึก',
    statement: 'ร้านเบเกอรี่ ผู้คนช่างสงสัย และสมุดเล่มหนึ่งที่ค่อย ๆ เติบโตขึ้นทุกวัน',
    note: 'วันนี้เริ่มจาก Emma ที่ถนนคนเดินวันอาทิตย์ — การสังเกตเล็ก ๆ ที่พาไปสู่อีกเรื่องหนึ่ง',
  },
  zh: {
    eyebrow: '今天的笔记',
    statement: '一家烘焙坊。一群好奇的人。一本不断长大的笔记本。',
    note: '今天从星期日步行街的 Emma 开始——一个小小的发现，又带出下一个发现。',
  },
} as const;

export function NotebookTodayPage({ onNavigate }: NotebookTodayPageProps) {
  const { language } = useLanguage();
  const { site, today, entries } = jokoTodayNotebookFixture;
  const intro = todayIntro[language];

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
          className="min-w-0"
        />
      </section>
    </NotebookShell>
  );
}

export default NotebookTodayPage;
