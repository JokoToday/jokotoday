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
    openNotebook: 'Come for more',
    favourite: 'Emma’s favourite is',
    sceneAlt: 'Emma noticing a small flower at Sunday Walking Street.',
    productAlt: 'Reserved space for the approved Almond Croissant photograph.',
  },
  th: {
    today: 'วันนี้',
    history: 'ย้อนหลัง',
    openNotebook: 'เปิดดูต่อ',
    favourite: 'เมนูโปรดของ Emma คือ',
    sceneAlt: 'Emma กำลังสังเกตดอกไม้เล็ก ๆ ที่ถนนคนเดินวันอาทิตย์',
    productAlt: 'พื้นที่สำหรับภาพอัลมอนด์ครัวซองต์ที่ได้รับการอนุมัติ',
  },
  zh: {
    today: '今日',
    history: '往期',
    openNotebook: '继续翻阅',
    favourite: 'Emma 最喜欢的是',
    sceneAlt: 'Emma 在星期日步行街留意一朵小花。',
    productAlt: '为最终确认的杏仁可颂照片预留的位置。',
  },
} as const;

function SceneArtworkPlaceholder({ alt }: { alt: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden" role="img" aria-label={alt}>
      <span className="sr-only">{alt}</span>

      <div className="absolute left-[8%] top-[32%] h-px w-[29%] -rotate-2 bg-primary-900/16" aria-hidden="true" />
      <div className="absolute left-[14%] top-[38%] h-20 w-28 rounded-[50%_50%_8%_8%] border border-b-0 border-primary-900/14" aria-hidden="true" />
      <div className="absolute left-[19%] top-[52%] h-24 w-px bg-primary-900/12" aria-hidden="true" />

      <div className="absolute left-[41%] top-[30%] h-40 w-px -rotate-6 bg-primary-900/10" aria-hidden="true" />
      <div className="absolute left-[43%] top-[34%] h-px w-24 rotate-6 bg-primary-900/13" aria-hidden="true" />
      <div className="absolute left-[47%] top-[40%] h-2 w-2 rounded-full border border-primary-900/18" aria-hidden="true" />

      <div className="absolute right-[12%] top-[23%] h-px w-[23%] rotate-6 bg-primary-900/13" aria-hidden="true" />
      <div className="absolute right-[18%] top-[31%] h-14 w-24 rounded-[50%_50%_8%_8%] border border-b-0 border-primary-900/12" aria-hidden="true" />
      <div className="absolute right-[24%] top-[41%] h-20 w-px bg-primary-900/10" aria-hidden="true" />

      <div className="absolute bottom-[17%] left-[7%] h-px w-[78%] rotate-1 bg-primary-900/10" aria-hidden="true" />
      <div className="absolute bottom-[13%] left-[17%] h-px w-[62%] -rotate-2 bg-primary-900/8" aria-hidden="true" />
    </div>
  );
}

function ProductArtworkPlaceholder({ alt }: { alt: string }) {
  return (
    <div
      className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-background/70 shadow-sm sm:h-24 sm:w-36"
      role="img"
      aria-label={alt}
    >
      <span className="sr-only">{alt}</span>
      <span className="absolute left-4 top-1/2 h-8 w-20 -translate-y-1/2 rotate-6 rounded-[60%_40%_55%_45%] border border-primary-700/24" aria-hidden="true" />
      <span className="absolute left-7 top-1/2 h-px w-14 -translate-y-1/2 rotate-6 bg-primary-700/18" aria-hidden="true" />
      <span className="absolute left-9 top-[39%] h-8 w-px rotate-[24deg] bg-primary-700/16" aria-hidden="true" />
      <span className="absolute left-14 top-[37%] h-9 w-px rotate-[24deg] bg-primary-700/16" aria-hidden="true" />
      <span className="absolute left-[4.75rem] top-[39%] h-8 w-px rotate-[24deg] bg-primary-700/16" aria-hidden="true" />
    </div>
  );
}

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
    <section aria-label={text(today.title)} className="min-w-0 lg:-mr-3 xl:-mr-6">
      <div className="relative mx-auto max-w-[68rem] pb-5">
        <div
          className="absolute bottom-0 left-2 right-2 top-7 rounded-[2.4rem] border border-primary-900/18 bg-primary-700/16 shadow-xl sm:left-4 sm:right-4 lg:-left-1 lg:-right-1"
          aria-hidden="true"
        />
        <div
          className="absolute bottom-1 left-[5%] right-[5%] h-5 rounded-b-[2.25rem] border-b border-primary-900/20 bg-primary-800/15 shadow-lg"
          aria-hidden="true"
        />

        <div className="relative overflow-hidden rounded-[2rem] border border-primary-900/18 bg-background shadow-[0_22px_55px_rgb(var(--joko-color-brand-950)/0.14)] sm:rounded-[2.35rem]">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-primary-900/10 bg-background px-5 py-2.5 text-xs font-semibold text-primary-950 sm:px-8 lg:px-10">
            <div className="flex items-center gap-6 sm:gap-8">
              <span className="border-b-2 border-primary-700 pb-1 text-primary-950" aria-current="page">
                {copy.today}
              </span>
              <button
                type="button"
                onClick={() => onNavigate('notebook-history')}
                className="inline-flex items-center gap-1.5 border-b border-transparent pb-1 text-primary-950/65 transition hover:border-primary-300 hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {copy.history}
                <Clock3 className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('notebook-today')}
              className="border-b border-transparent pb-1 text-primary-950/70 transition hover:border-primary-300 hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              {copy.openNotebook} <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="relative grid lg:grid-cols-2">
            <article className="relative min-h-[29rem] overflow-hidden bg-gradient-to-br from-background-secondary/26 via-background to-background px-7 pb-8 pt-8 sm:min-h-[32rem] sm:px-10 sm:pt-9 lg:min-h-[35rem] lg:rounded-bl-[2.1rem] lg:px-11">
              <div className="relative z-20 max-w-[19rem]">
                {todayEyebrow && (
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-700 sm:text-[11px]">
                    {todayEyebrow}
                  </p>
                )}
                <h2 className="mt-2 font-header text-3xl font-semibold leading-[1.05] tracking-tight text-primary-950 sm:text-4xl">
                  {text(today.title)}
                </h2>
                <p className="mt-1 inline-block border-b border-primary-900/45 pb-1 font-header text-lg text-primary-950/80 sm:text-xl">
                  {text(today.subtitle)}
                </p>
              </div>

              <div className="absolute inset-x-0 bottom-0 top-[7.6rem] sm:top-[8rem]" aria-hidden="true">
                <SceneArtworkPlaceholder alt={copy.sceneAlt} />
              </div>

              <span className="absolute bottom-5 left-7 font-header text-[11px] italic text-primary-950/38 sm:left-10" aria-hidden="true">
                2
              </span>
            </article>

            <article className="relative min-h-[29rem] overflow-hidden bg-gradient-to-bl from-background-secondary/22 via-background to-background px-7 pb-8 pt-8 sm:min-h-[32rem] sm:px-10 sm:pt-9 lg:min-h-[35rem] lg:rounded-br-[2.1rem] lg:px-11">
              <div className="absolute inset-0" aria-hidden="true">
                <div className="absolute left-[12%] top-[16%] h-px w-[36%] rotate-6 bg-primary-900/10" />
                <div className="absolute left-[34%] top-[23%] h-24 w-px -rotate-6 bg-primary-900/10" />
                <div className="absolute right-[10%] top-[27%] h-16 w-28 rounded-[50%_50%_6%_6%] border border-b-0 border-primary-900/10" />
                <div className="absolute right-[23%] top-[38%] h-20 w-px bg-primary-900/10" />
                <div className="absolute left-[18%] top-[42%] h-px w-[62%] -rotate-2 bg-primary-900/8" />
              </div>

              <div className="absolute bottom-14 right-6 z-20 w-[82%] max-w-md rotate-[-1.4deg] border border-primary-900/10 bg-background-secondary px-5 py-5 shadow-lg sm:bottom-16 sm:right-8 sm:px-6 lg:right-9">
                <span
                  className="absolute left-[38%] top-0 h-4 w-24 -translate-y-1/2 rotate-[-2deg] bg-primary-200/80"
                  aria-hidden="true"
                />

                <div className="flex items-end justify-between gap-5">
                  <div className="min-w-0 pb-1">
                    <p className="font-header text-lg font-semibold leading-tight text-primary-950 sm:text-xl">
                      {copy.favourite}
                    </p>
                    {almond && (
                      <p className="mt-1 font-header text-xl font-semibold leading-tight text-primary-950 sm:text-2xl">
                        {text(almond.title)}
                      </p>
                    )}
                    <span className="mt-4 inline-block text-3xl leading-none text-primary-700" aria-hidden="true">→</span>
                  </div>

                  <ProductArtworkPlaceholder alt={copy.productAlt} />
                </div>
              </div>

              <span className="absolute bottom-5 right-7 font-header text-[11px] italic text-primary-950/38 sm:right-10" aria-hidden="true">
                3
              </span>
            </article>

            <div
              className="pointer-events-none absolute bottom-0 left-1/2 top-0 z-30 hidden w-16 -translate-x-1/2 bg-gradient-to-r from-transparent via-primary-950/6 to-transparent lg:block"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute bottom-6 left-1/2 top-6 z-30 hidden w-px -translate-x-1/2 bg-primary-950/12 lg:block"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute bottom-0 left-1/2 top-0 z-20 hidden w-3 -translate-x-1/2 bg-gradient-to-r from-background/30 via-primary-950/4 to-background/30 lg:block"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default NotebookFeatureSpread;
