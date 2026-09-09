import {
  ArrowRight,
  CalendarDays,
  Heart,
  NotebookPen,
  ShoppingBasket,
  Store,
} from 'lucide-react';
import { Container } from '../../../platform/design-system';

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
    helpIntro: 'Favourites from around the notebook.',
    favourites: [
      ['Emma', 'Almond Croissant'],
      ['Steve', 'Sourdough'],
      ['Grandma Lin', 'Lemon Tart'],
      ['Joe', 'Cinnamon Roll'],
    ],
    seeFavourites: 'See all favourites',
    bakerTitle: "From the baker’s table",
    bakerQuestion: 'What have the bakers been experimenting with?',
    bakerProduct: 'Black Sesame Croissant',
    bakerBody: 'We wondered what would happen if we took the nutty depth of black sesame and tucked it into our croissant. Here’s what we discovered.',
    bakerAction: 'See how it turned out',
    bakerAsset: 'Editorial image space for the Black Sesame Croissant test bake.',
    fieldNote: 'Field note',
    testBake: 'Test bake',
    findTitle: 'Not bread. Still good.',
    findIntro: 'What unexpected thing have we found this time?',
    finds: [
      ['A cup we probably drink from more often than we should.', 'Ceramic cup'],
      ['Natural lip balm made by Lemon Bees, loved by Emma.', 'Small-batch lip balm'],
      ['A tiny vase for small, quiet good things.', 'Tiny flower vase'],
    ],
    moreFinds: 'See more finds',
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
    helpIntro: 'เมนูโปรดจากผู้คนและตัวละครในสมุดบันทึก',
    favourites: [
      ['Emma', 'Almond Croissant'],
      ['Steve', 'Sourdough'],
      ['Grandma Lin', 'Lemon Tart'],
      ['Joe', 'Cinnamon Roll'],
    ],
    seeFavourites: 'ดูเมนูโปรดทั้งหมด',
    bakerTitle: 'จากโต๊ะของคนอบ',
    bakerQuestion: 'ช่วงนี้คนอบกำลังทดลองอะไรอยู่?',
    bakerProduct: 'Black Sesame Croissant',
    bakerBody: 'เราอยากรู้ว่าจะเกิดอะไรขึ้น ถ้านำรสถั่วลึก ๆ ของงาดำมาใส่ไว้ในครัวซองต์ของเรา นี่คือสิ่งที่เราได้ค้นพบ',
    bakerAction: 'ดูว่าออกมาเป็นอย่างไร',
    bakerAsset: 'พื้นที่สำหรับภาพงานทดลอง Black Sesame Croissant',
    fieldNote: 'บันทึกจากโต๊ะอบ',
    testBake: 'ทดลองอบ',
    findTitle: 'ไม่ใช่ขนมปัง แต่ก็ดี',
    findIntro: 'คราวนี้เราไปเจอของดีที่คาดไม่ถึงอะไรมา?',
    finds: [
      ['ถ้วยที่เราน่าจะใช้บ่อยเกินกว่าที่ควรจะเป็น', 'ถ้วยเซรามิก'],
      ['ลิปบาล์มธรรมชาติจาก Lemon Bees ที่ Emma ชอบ', 'ลิปบาล์มทำมือ'],
      ['แจกันจิ๋วสำหรับสิ่งดี ๆ เล็ก ๆ และเงียบสงบ', 'แจกันดอกไม้จิ๋ว'],
    ],
    moreFinds: 'ดูของที่เจอเพิ่ม',
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
    helpIntro: '来自这本笔记里的人物与朋友们的偏爱。',
    favourites: [
      ['Emma', 'Almond Croissant'],
      ['Steve', 'Sourdough'],
      ['Grandma Lin', 'Lemon Tart'],
      ['Joe', 'Cinnamon Roll'],
    ],
    seeFavourites: '看看大家的偏爱',
    bakerTitle: '烘焙师的桌边',
    bakerQuestion: '最近烘焙师们在试验什么？',
    bakerProduct: 'Black Sesame Croissant',
    bakerBody: '我们想知道，把黑芝麻浓郁坚果般的味道藏进可颂里会发生什么。这里是我们发现的结果。',
    bakerAction: '看看最后变成了什么',
    bakerAsset: '为 Black Sesame Croissant 试验烘焙预留的编辑图片位置。',
    fieldNote: '桌边笔记',
    testBake: '试验烘焙',
    findTitle: '不是面包，也很好。',
    findIntro: '这一次，我们又发现了什么意料之外的小东西？',
    finds: [
      ['一个我们大概用得过于频繁的杯子。', '陶瓷杯'],
      ['Lemon Bees 做的天然润唇膏，Emma 很喜欢。', '小批量润唇膏'],
      ['一个装得下安静小美好的迷你花瓶。', '迷你花瓶'],
    ],
    moreFinds: '看看更多发现',
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

function EditorialProductPlaceholder({ label }: { label: string }) {
  return (
    <div
      className="relative flex min-h-36 items-end overflow-hidden rounded-2xl border border-primary-900/10 bg-gradient-to-br from-background-secondary/70 via-background to-background-secondary/35 p-4"
      role="img"
      aria-label={label}
    >
      <span className="absolute left-[14%] top-[30%] h-px w-[58%] -rotate-3 bg-primary-900/[.12]" aria-hidden="true" />
      <span className="absolute left-[24%] top-[39%] h-16 w-[48%] rotate-3 rounded-[55%_45%_52%_48%] border border-primary-900/[.14]" aria-hidden="true" />
      <span className="absolute left-[38%] top-[32%] h-24 w-px rotate-[24deg] bg-primary-900/10" aria-hidden="true" />
      <span className="absolute left-[52%] top-[34%] h-20 w-px rotate-[24deg] bg-primary-900/10" aria-hidden="true" />
      <span className="relative font-header text-xs italic text-primary-950/50">{label}</span>
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

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {labels.favourites.map(([name, product], index) => (
              <article
                key={`${name}-${product}`}
                className="rounded-2xl border border-primary-900/10 bg-background p-3 shadow-sm"
              >
                <div className="flex min-h-16 items-center gap-3 px-1 pb-3">
                  <SketchPortrait name={name} />
                  <div className="min-w-0">
                    <p className="font-header text-lg font-semibold leading-5 text-primary-950">{name}</p>
                    <p className="mt-1 text-sm leading-5 text-gray-600">{product}</p>
                  </div>
                  <Heart className="ml-auto h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
                </div>

                {index === 0 ? (
                  <div className="overflow-hidden rounded-xl bg-background-secondary/45">
                    <img
                      src="/assets/home-experience/almond-croissant-v1.webp"
                      alt={product}
                      width={420}
                      height={240}
                      loading="lazy"
                      decoding="async"
                      className="h-36 w-full object-cover mix-blend-multiply"
                    />
                  </div>
                ) : (
                  <EditorialProductPlaceholder label={product} />
                )}
              </article>
            ))}
          </div>

          <div className="mt-7 text-center">
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="inline-flex items-center gap-2 border-b border-primary-700 pb-1 font-header text-lg font-semibold text-primary-700 transition hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              {labels.seeFavourites}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </Container>
      </section>

      <section className="border-b border-primary-900/10 py-12 sm:py-14">
        <Container width="wide">
          <SectionHeading number={3} title={labels.bakerTitle} intro={labels.bakerQuestion} />

          <div className="grid overflow-hidden rounded-2xl border border-primary-900/10 bg-background-secondary/25 shadow-sm lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative min-h-64 overflow-hidden border-b border-primary-900/10 bg-gradient-to-br from-background-secondary/75 via-background to-background-secondary/30 p-7 lg:min-h-72 lg:border-b-0 lg:border-r">
              <div className="absolute inset-0" role="img" aria-label={labels.bakerAsset}>
                <span className="absolute left-[9%] top-[32%] h-px w-[56%] -rotate-2 bg-primary-900/[.12]" aria-hidden="true" />
                <span className="absolute left-[18%] top-[41%] h-20 w-[58%] rotate-2 rounded-[55%_45%_50%_50%] border border-primary-900/[.14]" aria-hidden="true" />
                <span className="absolute left-[35%] top-[30%] h-32 w-px rotate-[28deg] bg-primary-900/10" aria-hidden="true" />
                <span className="absolute left-[49%] top-[31%] h-[7.5rem] w-px rotate-[28deg] bg-primary-900/10" aria-hidden="true" />
                <span className="absolute left-[63%] top-[34%] h-24 w-px rotate-[28deg] bg-primary-900/10" aria-hidden="true" />
              </div>

              <div className="absolute bottom-5 right-6 rotate-[-2deg] border border-primary-900/10 bg-background px-4 py-3 shadow-md">
                <p className="font-header text-xs font-semibold uppercase tracking-[0.12em] text-primary-700">{labels.testBake}</p>
                <p className="mt-1 font-header text-sm text-primary-950">Black Sesame</p>
                <p className="font-header text-xs italic text-primary-950/55">5.2 ♡</p>
              </div>
            </div>

            <div className="flex flex-col justify-center px-6 py-8 sm:px-8 lg:px-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700">{labels.fieldNote}</p>
              <h3 className="mt-3 font-header text-3xl font-semibold leading-tight text-primary-950 sm:text-4xl">
                {labels.bakerProduct}
              </h3>
              <p className="mt-4 max-w-xl text-sm leading-6 text-gray-700 sm:text-base sm:leading-7">
                {labels.bakerBody}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('notebook-today')}
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg bg-primary-700 px-5 py-3 text-sm font-semibold text-background shadow-sm transition hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                {labels.bakerAction}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-12 sm:py-14">
        <Container width="wide">
          <SectionHeading number={4} title={labels.findTitle} intro={labels.findIntro} />

          <div className="grid gap-4 md:grid-cols-3">
            {labels.finds.map(([body, assetLabel], index) => (
              <article
                key={assetLabel}
                className="grid gap-4 rounded-2xl border border-primary-900/10 bg-background p-4 shadow-sm sm:grid-cols-[9rem_1fr] md:grid-cols-1 xl:grid-cols-[9rem_1fr]"
              >
                <QuietObjectSketch kind={index} label={assetLabel} />
                <div className="flex flex-col justify-center">
                  <p className="font-header text-lg font-semibold leading-6 text-primary-950">{body}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate('notebook-today')}
                    className="mt-4 inline-flex w-fit items-center gap-2 text-sm font-semibold text-primary-700 underline decoration-primary-300 underline-offset-4 transition hover:text-primary-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                  >
                    {labels.moreFinds}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>

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
