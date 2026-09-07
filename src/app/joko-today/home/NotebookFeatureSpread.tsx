import { Clock3 } from 'lucide-react';
import {
  getNotebookLocalizedText,
  jokoTodayNotebookFixture,
} from '../../../platform/notebook';

interface NotebookFeatureSpreadProps {
  locale: string;
  onNavigate: (page: string) => void;
}

const labels = {
  en: {
    today: 'Today',
    history: 'History',
    openNotebook: 'Open notebook',
    favourite: 'Emma’s favourite is',
    sceneAlt: 'Emma noticing a small flower at Sunday Walking Street.',
    productAlt: 'Reserved space for the approved Almond Croissant photograph.',
  },
  th: {
    today: 'วันนี้',
    history: 'ย้อนหลัง',
    openNotebook: 'เปิดสมุดบันทึก',
    favourite: 'เมนูโปรดของ Emma คือ',
    sceneAlt: 'Emma กำลังสังเกตดอกไม้เล็ก ๆ ที่ถนนคนเดินวันอาทิตย์',
    productAlt: 'พื้นที่สำหรับภาพอัลมอนด์ครัวซองต์ที่ได้รับการอนุมัติ',
  },
  zh: {
    today: '今日',
    history: '往期',
    openNotebook: '打开笔记本',
    favourite: 'Emma 最喜欢的是',
    sceneAlt: 'Emma 在星期日步行街留意一朵小花。',
    productAlt: '为最终确认的杏仁可颂照片预留的位置。',
  },
} as const;

export function NotebookFeatureSpread({ locale, onNavigate }: NotebookFeatureSpreadProps) {
  const { site, today, entries } = jokoTodayNotebookFixture;
  const language = locale === 'th' || locale === 'zh' ? locale : 'en';
  const copy = labels[language];
  const text = (value: Parameters<typeof getNotebookLocalizedText>[0]) =>
    getNotebookLocalizedText(value, language, site.defaultLocale);
  const almond = entries.find((entry) => entry.kind === 'product' && entry.slug === 'almond-croissant');
  const firstBlock = today.surfaces[0]?.blocks[0];
  const todayEyebrow = firstBlock?.type === 'text' ? text(firstBlock.eyebrow) : '';

  return (
    <section aria-label={text(today.title)} className="min-w-0">
      <div className="relative mx-auto max-w-5xl">
        <div className="absolute -bottom-3 left-8 right-8 top-4 rounded-[2.5rem] bg-primary-950/10 blur-sm" aria-hidden="true" />

        <div className="relative overflow-hidden rounded-[2rem] border border-primary-900/15 bg-background shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-900/10 bg-background-secondary/70 px-5 py-3 text-xs font-semibold text-primary-950 sm:px-7">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => onNavigate('notebook-today')}
                className="border-b border-primary-700 pb-1 text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {copy.today}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('notebook-history')}
                className="inline-flex items-center gap-1.5 text-primary-950/70 transition hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {copy.history}
                <Clock3 className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('notebook-today')}
              className="text-primary-700 underline decoration-primary-300 underline-offset-4 transition hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              {copy.openNotebook} →
            </button>
          </div>

          <div className="relative grid lg:grid-cols-2">
            <article className="relative min-h-[30rem] bg-gradient-to-br from-background-secondary/45 via-background to-background px-6 py-8 sm:px-9 sm:py-10 lg:min-h-[34rem]">
              {todayEyebrow && (
                <p className="text-[11px] font-semibold uppercase tracking-[0.19em] text-primary-700">
                  {todayEyebrow}
                </p>
              )}
              <h2 className="mt-3 font-header text-4xl font-semibold leading-tight text-primary-950 sm:text-5xl">
                {text(today.title)}
              </h2>
              <p className="mt-1 font-header text-xl text-primary-950/80">
                {text(today.subtitle)}
              </p>

              <figure
                className="relative mt-8 min-h-64 overflow-hidden rounded-[1.75rem] border border-primary-900/10 bg-background-secondary/30"
                role="img"
                aria-label={copy.sceneAlt}
              >
                <div className="absolute left-8 top-12 h-px w-2/3 -rotate-3 bg-primary-900/15" aria-hidden="true" />
                <div className="absolute left-10 top-24 h-24 w-24 rounded-full border border-primary-900/15" aria-hidden="true" />
                <div className="absolute bottom-14 right-10 h-px w-1/2 rotate-6 bg-primary-900/15" aria-hidden="true" />
                <figcaption className="absolute bottom-5 left-6 right-6 font-header text-sm italic leading-6 text-primary-950/55">
                  {copy.sceneAlt}
                </figcaption>
              </figure>
            </article>

            <article className="relative min-h-[24rem] bg-gradient-to-bl from-background-secondary/40 via-background to-background px-6 py-8 sm:px-9 sm:py-10 lg:min-h-[34rem]">
              <div className="relative ml-auto mt-8 max-w-sm rotate-1 border border-primary-900/10 bg-background-secondary px-6 pb-6 pt-8 shadow-md">
                <span className="absolute left-1/2 top-0 h-4 w-24 -translate-x-1/2 -translate-y-1/2 -rotate-2 bg-primary-200/80" aria-hidden="true" />
                <p className="font-header text-2xl font-semibold leading-tight text-primary-950">
                  {copy.favourite}
                </p>
                {almond && (
                  <p className="mt-2 font-header text-3xl font-semibold text-primary-700">
                    {text(almond.title)}
                  </p>
                )}
                <div className="mt-6 flex items-end justify-between gap-4">
                  <span className="text-3xl text-primary-700" aria-hidden="true">→</span>
                  <div
                    className="h-24 w-36 rounded-xl border border-primary-900/10 bg-background/65 shadow-sm"
                    role="img"
                    aria-label={copy.productAlt}
                  />
                </div>
              </div>

              <p className="absolute bottom-6 right-7 font-header text-xs italic text-primary-950/45" aria-hidden="true">
                3
              </p>
            </article>

            <div
              className="pointer-events-none absolute bottom-0 left-1/2 top-0 hidden w-12 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary-950/5 to-transparent lg:block"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute bottom-8 left-1/2 top-8 hidden w-px -translate-x-1/2 bg-primary-950/10 lg:block"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default NotebookFeatureSpread;
