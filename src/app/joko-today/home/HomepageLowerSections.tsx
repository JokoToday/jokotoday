import {
  ArrowRight,
  CalendarDays,
  Heart,
  NotebookPen,
  ShoppingBasket,
  Store,
} from 'lucide-react';
import { Container } from '../../../platform/design-system';
import {
  getNotebookLocalizedText,
  jokoTodayNotebookFixture,
  type NotebookPersonEntry,
  type NotebookProductEntry,
  type NotebookQuestionEntry,
} from '../../../platform/notebook';

interface HomepageLowerSectionsProps {
  locale: string;
  onNavigate: (page: string) => void;
}

type LanguageCode = 'en' | 'th' | 'zh';

const copy = {
  en: {
    howTitle: 'How it works',
    howIntro: 'Good bread should be the complicated part. Picking it up should not be.',
    steps: [
      ['Choose', 'Browse the week’s menu and find what you love.'],
      ['Pre-Order', 'Place your order before the cut-off for your pickup day.'],
      ['Pick Up', 'Collect your order at your chosen location on the scheduled day.'],
      ['Enjoy', 'Good bread, good people, good moments.'],
    ],
    helpTitle: 'Need a little help choosing?',
    helpIntro: 'One real favourite from today’s notebook — with more to come as the notebook grows.',
    todayNotebook: "In today's notebook",
    openEmmaNote: "Open Emma's note",
    notebookRule: 'Notebook rule',
    moreFavoriteTitle: 'More favourites will arrive naturally.',
    moreFavoriteBody: 'We only add them when they become real notebook entries — never just to fill the page.',
    browseBakery: 'Browse the bakery',
    questionTitle: 'A question worth carrying',
    questionIntro: 'JOKO asks before it answers.',
    questionLabel: 'Question from the notebook',
    questionAction: "Open today's notebook",
    questionSketchAlt: "Notebook sketch for today's croissant-layer question.",
    beyondTitle: 'Not bread. Still good.',
    beyondIntro: 'The notebook will also make room for useful, beautiful things we genuinely come across.',
    finds: [
      ['Everyday things we keep reaching for.', 'Everyday object'],
      ['Small things made by people worth knowing.', 'Made nearby'],
      ['Objects that make ordinary days a little nicer.', 'Quiet find'],
    ],
    beyondNote: 'Nothing gets added just to fill the page.',
    closingBadge: 'Baked & beyond',
  },
  th: {
    howTitle: 'ทำงานอย่างไร',
    howIntro: 'เรื่องที่ซับซ้อนควรเป็นการอบขนมปัง ไม่ใช่การมารับขนม',
    steps: [
      ['เลือก', 'ดูเมนูประจำสัปดาห์แล้วเลือกสิ่งที่คุณชอบ'],
      ['สั่งล่วงหน้า', 'สั่งก่อนเวลาปิดรับออเดอร์ของวันรับสินค้า'],
      ['มารับ', 'รับออเดอร์ที่จุดรับและวันที่คุณเลือกไว้'],
      ['เพลิดเพลิน', 'ขนมปังดี ๆ ผู้คนดี ๆ และช่วงเวลาดี ๆ'],
    ],
    helpTitle: 'อยากได้ตัวช่วยเลือกนิดหน่อยไหม?',
    helpIntro: 'ของโปรดหนึ่งอย่างที่มีอยู่จริงในสมุดบันทึกวันนี้ — และจะมีเพิ่มเมื่อสมุดเล่มนี้เติบโต',
    todayNotebook: 'อยู่ในสมุดบันทึกวันนี้',
    openEmmaNote: 'เปิดบันทึกของ Emma',
    notebookRule: 'กติกาของสมุด',
    moreFavoriteTitle: 'ของโปรดอื่น ๆ จะค่อย ๆ ตามมา',
    moreFavoriteBody: 'เราจะใส่เพิ่มก็ต่อเมื่อกลายเป็นบันทึกจริง ไม่เติมชื่อหรือของเพียงเพื่อให้หน้าดูเต็ม',
    browseBakery: 'ดูเมนูเบเกอรี่',
    questionTitle: 'คำถามที่น่าพกติดตัว',
    questionIntro: 'JOKO ถามก่อน แล้วค่อยตอบ',
    questionLabel: 'คำถามจากสมุดบันทึก',
    questionAction: 'เปิดสมุดบันทึกของวันนี้',
    questionSketchAlt: 'ภาพสเก็ตช์ในสมุดสำหรับคำถามเรื่องชั้นครัวซองต์ของวันนี้',
    beyondTitle: 'ไม่ใช่ขนมปัง แต่ก็ดี',
    beyondIntro: 'สมุดเล่มนี้จะเผื่อที่ไว้ให้สิ่งของที่มีประโยชน์ สวยงาม และเราได้พบเจอจริง',
    finds: [
      ['ของใช้ในชีวิตประจำวันที่เราหยิบใช้ซ้ำแล้วซ้ำอีก', 'ของใช้ประจำวัน'],
      ['ของชิ้นเล็ก ๆ ที่ทำโดยผู้คนซึ่งน่าทำความรู้จัก', 'ทำใกล้ ๆ เรา'],
      ['สิ่งของที่ทำให้วันธรรมดาน่าอยู่ขึ้นอีกนิด', 'ของดีเงียบ ๆ'],
    ],
    beyondNote: 'ไม่มีอะไรถูกใส่ลงไปเพียงเพื่อเติมหน้าให้เต็ม',
    closingBadge: 'อบสด และมากกว่านั้น',
  },
  zh: {
    howTitle: '怎样取到面包',
    howIntro: '复杂的应该是烘焙本身，而不是来取面包。',
    steps: [
      ['挑选', '看看本周菜单，找到你喜欢的。'],
      ['预订', '在取货日的截止时间前下单。'],
      ['取货', '按约定日期到你选择的地点领取订单。'],
      ['享用', '好面包，好人，好时光。'],
    ],
    helpTitle: '需要一点挑选灵感吗？',
    helpIntro: '先从今天笔记里一个真实的偏爱开始；笔记长大后，还会自然出现更多。',
    todayNotebook: '今天的笔记里',
    openEmmaNote: '打开 Emma 的笔记',
    notebookRule: '笔记规则',
    moreFavoriteTitle: '更多偏爱会慢慢出现。',
    moreFavoriteBody: '只有当它们成为真实的笔记内容时，我们才会加入，而不是为了填满页面。',
    browseBakery: '看看烘焙坊',
    questionTitle: '一个值得带走的问题',
    questionIntro: 'JOKO 先提问，再回答。',
    questionLabel: '来自笔记的问题',
    questionAction: '打开今天的笔记',
    questionSketchAlt: '为今天关于可颂层次的问题准备的笔记草图。',
    beyondTitle: '不是面包，也很好。',
    beyondIntro: '这本笔记也会给那些我们真正遇见的、实用又好看的小东西留位置。',
    finds: [
      ['我们总会一次又一次拿来用的日常物件。', '日常物件'],
      ['由值得认识的人认真做出来的小东西。', '附近制作'],
      ['让普通日子稍微更美好一点的物件。', '安静的小发现'],
    ],
    beyondNote: '不会为了把页面填满而硬塞任何东西。',
    closingBadge: '烘焙，以及更多',
  },
} as const;

const howIcons = [NotebookPen, CalendarDays, Store, Heart] as const;

function SectionHeading({
  number,
  title,
  intro,
}: {
  number: number;
  title: string;
  intro?: string;
}) {
  return (
    <div className="mb-6 text-center sm:mb-8">
      <div className="flex items-center justify-center gap-3">
        <span className="font-header text-xl font-semibold text-primary-700">{number}.</span>
        <h2 className="font-header text-2xl font-semibold uppercase tracking-[0.04em] text-primary-950 sm:text-3xl">
          {title}
        </h2>
      </div>
      {intro && (
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-gray-600 sm:text-base">
          {intro}
        </p>
      )}
    </div>
  );
}

function SketchPortrait({ name }: { name: string }) {
  return (
    <div
      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-primary-900/[.18] bg-background-secondary/60 font-header text-lg font-semibold text-primary-950"
      aria-hidden="true"
    >
      <span className="absolute inset-1 rounded-full border border-primary-900/[.08]" />
      {name.slice(0, 1)}
    </div>
  );
}

function QuietObjectSketch({ kind, label }: { kind: number; label: string }) {
  return (
    <div
      className="relative flex h-28 items-end justify-center overflow-hidden rounded-xl bg-background-secondary/45 p-3"
      role="img"
      aria-label={label}
    >
      {kind === 0 && (
        <>
          <span className="absolute left-1/2 top-6 h-14 w-16 -translate-x-1/2 rounded-b-[45%] rounded-t-lg border border-primary-900/[.18]" aria-hidden="true" />
          <span className="absolute left-[61%] top-9 h-7 w-5 rounded-r-full border border-l-0 border-primary-900/[.18]" aria-hidden="true" />
        </>
      )}
      {kind === 1 && (
        <>
          <span className="absolute left-1/2 top-8 h-10 w-20 -translate-x-1/2 rounded-[45%] border border-primary-900/[.18]" aria-hidden="true" />
          <span className="absolute left-[42%] top-10 h-6 w-px bg-primary-900/[.14]" aria-hidden="true" />
          <span className="absolute left-[58%] top-10 h-6 w-px bg-primary-900/[.14]" aria-hidden="true" />
        </>
      )}
      {kind === 2 && (
        <>
          <span className="absolute left-1/2 top-12 h-10 w-11 -translate-x-1/2 rounded-b-[45%] border border-primary-900/[.18]" aria-hidden="true" />
          <span className="absolute left-1/2 top-5 h-10 w-px -translate-x-1/2 bg-primary-900/[.16]" aria-hidden="true" />
          <span className="absolute left-[46%] top-7 h-6 w-px -rotate-[28deg] bg-primary-700/[.34]" aria-hidden="true" />
          <span className="absolute left-[55%] top-7 h-6 w-px rotate-[28deg] bg-primary-700/[.34]" aria-hidden="true" />
        </>
      )}
      <span className="relative text-[10px] italic text-primary-950/45">{label}</span>
    </div>
  );
}

export function HomepageLowerSections({ locale, onNavigate }: HomepageLowerSectionsProps) {
  const language: LanguageCode = locale === 'th' || locale === 'zh' ? locale : 'en';
  const labels = copy[language];
  const { site, entries } = jokoTodayNotebookFixture;
  const text = (value: Parameters<typeof getNotebookLocalizedText>[0]) =>
    getNotebookLocalizedText(value, language, site.defaultLocale);

  const emma = entries.find(
    (entry): entry is NotebookPersonEntry => entry.kind === 'person' && entry.slug === 'emma',
  );
  const almond = entries.find(
    (entry): entry is NotebookProductEntry => entry.kind === 'product' && entry.slug === 'almond-croissant',
  );
  const question = entries.find(
    (entry): entry is NotebookQuestionEntry => entry.kind === 'question' && entry.slug === 'curiosity',
  );

  return (
    <div className="bg-background">
      <section className="border-b border-primary-900/10 py-12 sm:py-14">
        <Container width="wide">
          <SectionHeading number={1} title={labels.howTitle} intro={labels.howIntro} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {labels.steps.map(([title, body], index) => {
              const Icon = howIcons[index];
              return (
                <article
                  key={title}
                  className="relative min-h-48 rounded-2xl border border-primary-900/10 bg-background-secondary/30 px-5 pb-5 pt-6 shadow-sm"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-950 font-header text-lg font-semibold text-background">
                      {index + 1}
                    </span>
                    <Icon className="h-8 w-8 text-primary-700" strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <h3 className="font-header text-2xl font-semibold text-primary-950">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
                  {index < labels.steps.length - 1 && (
                    <ArrowRight
                      className="absolute -right-4 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 text-primary-700 xl:block"
                      aria-hidden="true"
                    />
                  )}
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="border-b border-primary-900/10 py-12 sm:py-14">
        <Container width="wide">
          <SectionHeading number={2} title={labels.helpTitle} intro={labels.helpIntro} />

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="grid overflow-hidden rounded-2xl border border-primary-900/10 bg-background shadow-sm sm:grid-cols-[1fr_15rem]">
              <div className="flex flex-col justify-center p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <SketchPortrait name={emma ? text(emma.title) : 'Emma'} />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700">
                      {labels.todayNotebook}
                    </p>
                    <h3 className="mt-1 font-header text-2xl font-semibold text-primary-950">
                      {emma ? text(emma.title) : 'Emma'}
                    </h3>
                  </div>
                  <Heart className="ml-auto h-5 w-5 shrink-0 text-primary-700" aria-hidden="true" />
                </div>

                <p className="mt-5 font-header text-2xl font-semibold leading-tight text-primary-950 sm:text-3xl">
                  {almond ? text(almond.title) : 'Almond Croissant'}
                </p>
                {emma && (
                  <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600 sm:text-base">
                    {text(emma.summary)}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => onNavigate('notebook-today')}
                  className="mt-5 inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary-700 underline decoration-primary-300 underline-offset-4 transition hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  {labels.openEmmaNote}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="min-h-52 overflow-hidden bg-background-secondary/45 sm:min-h-full">
                <img
                  src="/assets/home-experience/almond-croissant-v1.webp"
                  alt={almond ? text(almond.title) : 'Almond Croissant'}
                  width={420}
                  height={360}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover mix-blend-multiply"
                />
              </div>
            </article>

            <aside className="flex flex-col justify-center rounded-2xl border border-dashed border-primary-900/15 bg-background-secondary/25 p-6 sm:p-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700">
                {labels.notebookRule}
              </p>
              <h3 className="mt-3 font-header text-2xl font-semibold leading-tight text-primary-950 sm:text-3xl">
                {labels.moreFavoriteTitle}
              </h3>
              <p className="mt-3 text-sm leading-6 text-gray-600 sm:text-base">
                {labels.moreFavoriteBody}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('products')}
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg bg-primary-700 px-5 py-3 text-sm font-semibold text-background shadow-sm transition hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {labels.browseBakery}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </aside>
          </div>
        </Container>
      </section>

      <section className="border-b border-primary-900/10 py-12 sm:py-14">
        <Container width="wide">
          <SectionHeading number={3} title={labels.questionTitle} intro={labels.questionIntro} />

          <div className="grid overflow-hidden rounded-2xl border border-primary-900/10 bg-background-secondary/25 shadow-sm lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative min-h-64 overflow-hidden border-b border-primary-900/10 bg-gradient-to-br from-background-secondary/75 via-background to-background-secondary/30 p-7 lg:min-h-72 lg:border-b-0 lg:border-r">
              <div className="absolute inset-0" role="img" aria-label={labels.questionSketchAlt}>
                <span className="absolute left-[13%] top-[31%] h-px w-[62%] -rotate-3 bg-primary-900/[.12]" aria-hidden="true" />
                <span className="absolute left-[20%] top-[41%] h-20 w-[58%] rotate-2 rounded-[60%_40%_55%_45%] border border-primary-900/[.16]" aria-hidden="true" />
                <span className="absolute left-[30%] top-[38%] h-16 w-[48%] rotate-2 rounded-[60%_40%_55%_45%] border border-primary-900/[.12]" aria-hidden="true" />
                <span className="absolute left-[41%] top-[35%] h-12 w-[38%] rotate-2 rounded-[60%_40%_55%_45%] border border-primary-900/[.1]" aria-hidden="true" />
                <span className="absolute right-[13%] top-[19%] font-header text-6xl font-semibold text-primary-700/35" aria-hidden="true">?</span>
              </div>

              <div className="absolute bottom-5 left-6 max-w-[14rem] rotate-[-2deg] border border-primary-900/10 bg-background px-4 py-3 shadow-md">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-700">
                  {labels.questionLabel}
                </p>
                <p className="mt-1 font-header text-sm leading-5 text-primary-950">
                  {question ? text(question.title) : labels.questionTitle}
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-center px-6 py-8 sm:px-8 lg:px-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700">
                {labels.questionLabel}
              </p>
              <h3 className="mt-3 font-header text-3xl font-semibold leading-tight text-primary-950 sm:text-4xl">
                {question ? text(question.question) : labels.questionTitle}
              </h3>
              {question?.answerTeaser && (
                <p className="mt-4 max-w-xl text-sm leading-6 text-gray-700 sm:text-base sm:leading-7">
                  {text(question.answerTeaser)}
                </p>
              )}
              <button
                type="button"
                onClick={() => onNavigate('notebook-today')}
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg bg-primary-700 px-5 py-3 text-sm font-semibold text-background shadow-sm transition hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {labels.questionAction}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-12 sm:py-14">
        <Container width="wide">
          <SectionHeading number={4} title={labels.beyondTitle} intro={labels.beyondIntro} />

          <div className="grid gap-4 md:grid-cols-3">
            {labels.finds.map(([body, assetLabel], index) => (
              <article
                key={assetLabel}
                className="grid gap-4 rounded-2xl border border-primary-900/10 bg-background p-4 shadow-sm sm:grid-cols-[9rem_1fr] md:grid-cols-1 xl:grid-cols-[9rem_1fr]"
              >
                <QuietObjectSketch kind={index} label={assetLabel} />
                <div className="flex flex-col justify-center">
                  <p className="font-header text-lg font-semibold leading-6 text-primary-950">{body}</p>
                </div>
              </article>
            ))}
          </div>

          <p className="mx-auto mt-7 max-w-xl text-center text-sm leading-6 text-gray-600">
            {labels.beyondNote}
          </p>

          <div className="mt-9 flex justify-center">
            <div className="inline-flex items-center gap-3 rounded-full border border-primary-900/10 bg-background-secondary/40 px-5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-950/65">
              <ShoppingBasket className="h-4 w-4 text-primary-700" aria-hidden="true" />
              JOKO TODAY · {labels.closingBadge}
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}

export default HomepageLowerSections;
