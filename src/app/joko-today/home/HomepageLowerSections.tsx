import {
  ArrowRight,
  CalendarDays,
  Heart,
  NotebookPen,
  Store,
  Sparkles,
} from 'lucide-react';
import { Container } from '../../../platform/design-system';
import {
  getNotebookLocalizedText,
  type NotebookFixtureBundle,
  type NotebookPersonEntry,
  type NotebookProductEntry,
  type NotebookRouteTarget,
} from '../../../platform/notebook';

interface HomepageLowerSectionsProps {
  locale: string;
  onNavigate: (page: string) => void;
  bundle: NotebookFixtureBundle;
  featuredProductImageUrl: string;
  onNotebookNavigate?: (target: NotebookRouteTarget) => void;
}

type LanguageCode = 'en' | 'th' | 'zh';

const copy = {
  en: {
    howTitle: 'How it works',
    steps: [
      ['Choose', 'Browse the week’s menu and find what you love.'],
      ['Pre-Order', 'Place your order before the cut-off for your pickup day.'],
      ['Pick Up', 'Pick up your order at your chosen location on your scheduled day.'],
      ['Enjoy', 'Good bread, good people, good moments.'],
    ],
    helpTitle: 'Need a little help choosing?',
    helpIntro: 'What do people in our community actually like?',
    favoriteLabel: 'A favourite from the notebook',
    moreFavorites: 'More favourites appear when they become real notebook entries — never just to fill the page.',
    seeFavorites: 'See all favourites',
    newTitle: "New from the baker’s table",
    newIntro: 'What have the bakers been experimenting with?',
    openNote: 'See the notebook note',
    bakeryPrompt: 'Curious what else is baking this week?',
    browseBakery: 'Browse the Bakery',
    beyondTitle: 'Not bread. Still good.',
    beyondIntro: 'What unexpected thing have we found this time?',
    finds: [
      ['Everyday things we keep reaching for.', 'Everyday object'],
      ['Small things made by people worth knowing.', 'Made nearby'],
      ['Objects that make ordinary days a little nicer.', 'Quiet find'],
    ],
    seeMore: 'See more finds',
  },
  th: {
    howTitle: 'ทำงานอย่างไร',
    steps: [
      ['เลือก', 'ดูเมนูประจำสัปดาห์แล้วเลือกสิ่งที่คุณชอบ'],
      ['สั่งล่วงหน้า', 'สั่งก่อนเวลาปิดรับออเดอร์ของวันรับสินค้า'],
      ['มารับ', 'รับออเดอร์ที่จุดรับและวันที่คุณเลือกไว้'],
      ['เพลิดเพลิน', 'ขนมปังดี ๆ ผู้คนดี ๆ และช่วงเวลาดี ๆ'],
    ],
    helpTitle: 'อยากได้ตัวช่วยเลือกนิดหน่อยไหม?',
    helpIntro: 'คนในชุมชนของเราชอบอะไรกันจริง ๆ?',
    favoriteLabel: 'ของโปรดจากสมุดบันทึก',
    moreFavorites: 'ของโปรดจะค่อย ๆ เพิ่มเมื่อกลายเป็นบันทึกจริง ไม่เติมเพื่อให้หน้าดูเต็ม',
    seeFavorites: 'ดูของโปรดทั้งหมด',
    newTitle: 'ของใหม่จากโต๊ะคนทำขนม',
    newIntro: 'ช่วงนี้คนทำขนมกำลังลองอะไรอยู่?',
    openNote: 'เปิดบันทึกนี้',
    bakeryPrompt: 'อยากรู้ว่าสัปดาห์นี้มีอะไรอยู่ในเตาอีกไหม?',
    browseBakery: 'ดูเมนูเบเกอรี่',
    beyondTitle: 'ไม่ใช่ขนมปัง แต่ก็ดี',
    beyondIntro: 'ครั้งนี้เราไปเจออะไรที่คาดไม่ถึงมา?',
    finds: [
      ['ของใช้ประจำวันที่เราหยิบใช้ซ้ำแล้วซ้ำอีก', 'ของใช้ประจำวัน'],
      ['ของชิ้นเล็ก ๆ ที่ทำโดยผู้คนซึ่งน่าทำความรู้จัก', 'ทำใกล้ ๆ เรา'],
      ['สิ่งของที่ทำให้วันธรรมดาน่าอยู่ขึ้นอีกนิด', 'ของดีเงียบ ๆ'],
    ],
    seeMore: 'ดูสิ่งที่พบเพิ่มเติม',
  },
  zh: {
    howTitle: '怎样取到面包',
    steps: [
      ['挑选', '看看本周菜单，找到你喜欢的。'],
      ['预订', '在取货日的截止时间前下单。'],
      ['取货', '按约定日期到你选择的地点领取订单。'],
      ['享用', '好面包，好人，好时光。'],
    ],
    helpTitle: '需要一点挑选灵感吗？',
    helpIntro: '社区里的人到底喜欢什么？',
    favoriteLabel: '来自笔记本的偏爱',
    moreFavorites: '只有当它们成为真实笔记内容时，更多偏爱才会出现。',
    seeFavorites: '看看更多偏爱',
    newTitle: '烘焙桌上的新东西',
    newIntro: '最近烘焙师在试什么？',
    openNote: '打开这则笔记',
    bakeryPrompt: '想看看这周还有什么正在烤吗？',
    browseBakery: '看看烘焙坊',
    beyondTitle: '不是面包，也很好。',
    beyondIntro: '这次我们又遇见了什么意外的小东西？',
    finds: [
      ['我们总会一次又一次拿来用的日常物件。', '日常物件'],
      ['由值得认识的人认真做出来的小东西。', '附近制作'],
      ['让普通日子稍微更美好一点的物件。', '安静的小发现'],
    ],
    seeMore: '看看更多发现',
  },
} as const;

const howIcons = [NotebookPen, CalendarDays, Store, Heart] as const;

function SectionHeading({ number, title, intro }: { number: number; title: string; intro?: string }) {
  return (
    <div className="mb-7 text-center sm:mb-9">
      <div className="flex items-center justify-center gap-3">
        <span className="text-lg font-semibold text-[#466861]">{number}.</span>
        <h2 className="text-2xl font-semibold uppercase tracking-[0.05em] text-[#303532] sm:text-3xl">
          {title}
        </h2>
      </div>
      {intro && <p className="mx-auto mt-1 max-w-2xl text-sm leading-6 text-[#303532]/70 sm:text-base">{intro}</p>}
    </div>
  );
}

function QuietObjectSketch({ kind, label }: { kind: number; label: string }) {
  return (
    <div className="relative flex h-24 w-28 shrink-0 items-end justify-center overflow-hidden rounded-xl bg-[#F4EFE5]/75 p-3" role="img" aria-label={label}>
      {kind === 0 && (
        <>
          <span className="absolute left-1/2 top-5 h-12 w-14 -translate-x-1/2 rounded-b-[45%] rounded-t-lg border border-[#55766F]/35" />
          <span className="absolute left-[62%] top-8 h-6 w-4 rounded-r-full border border-l-0 border-[#55766F]/35" />
        </>
      )}
      {kind === 1 && (
        <>
          <span className="absolute left-1/2 top-7 h-9 w-16 -translate-x-1/2 rounded-[45%] border border-[#55766F]/35" />
          <span className="absolute left-[43%] top-9 h-5 w-px bg-[#55766F]/25" />
          <span className="absolute left-[57%] top-9 h-5 w-px bg-[#55766F]/25" />
        </>
      )}
      {kind === 2 && (
        <>
          <span className="absolute left-1/2 top-10 h-9 w-10 -translate-x-1/2 rounded-b-[45%] border border-[#55766F]/35" />
          <span className="absolute left-1/2 top-4 h-9 w-px -translate-x-1/2 bg-[#55766F]/30" />
          <span className="absolute left-[46%] top-6 h-5 w-px -rotate-[28deg] bg-[#C76624]/45" />
          <span className="absolute left-[55%] top-6 h-5 w-px rotate-[28deg] bg-[#C76624]/45" />
        </>
      )}
      <span className="relative text-[9px] italic text-[#303532]/45">{label}</span>
    </div>
  );
}

export function HomepageLowerSections({
  locale,
  onNavigate,
  bundle,
  featuredProductImageUrl,
  onNotebookNavigate,
}: HomepageLowerSectionsProps) {
  const language: LanguageCode = locale === 'th' || locale === 'zh' ? locale : 'en';
  const labels = copy[language];
  const { site, entries } = bundle;
  const text = (value: Parameters<typeof getNotebookLocalizedText>[0]) =>
    getNotebookLocalizedText(value, language, site.defaultLocale);

  const people = entries.filter((entry): entry is NotebookPersonEntry => entry.kind === 'person');
  const products = entries.filter((entry): entry is NotebookProductEntry => entry.kind === 'product');
  const favoritePairs = people
    .map((person) => {
      const product = person.favoriteProductRef
        ? products.find((candidate) => candidate.id === person.favoriteProductRef?.id)
        : undefined;
      return product ? { person, product } : null;
    })
    .filter((pair): pair is { person: NotebookPersonEntry; product: NotebookProductEntry } => Boolean(pair));
  const featuredProduct = products[0];

  return (
    <div>
      <section className="joko-paper-band py-12 sm:py-14">
        <Container width="wide">
          <SectionHeading number={1} title={labels.howTitle} />
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-3">
            {labels.steps.map(([title, body], index) => {
              const Icon = howIcons[index];
              return (
                <article key={title} className="relative px-4 py-3 text-center xl:px-6">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.25rem] border border-[#55766F]/20 bg-white/30 text-[#466861]">
                    <Icon className="h-8 w-8" strokeWidth={1.4} aria-hidden="true" />
                  </div>
                  <div className="mb-2 flex items-center justify-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#304B45] text-sm font-semibold text-[#F4EFE5]">{index + 1}</span>
                    <h3 className="text-xl font-semibold text-[#303532]">{title}</h3>
                  </div>
                  <p className="mx-auto max-w-[15rem] text-sm leading-5 text-[#303532]/68">{body}</p>
                  {index < labels.steps.length - 1 && (
                    <ArrowRight className="absolute -right-2 top-10 hidden h-5 w-5 text-[#55766F]/45 xl:block" aria-hidden="true" />
                  )}
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="joko-mineral-field border-y border-[#55766F]/10 py-12 sm:py-14">
        <Container width="wide">
          <SectionHeading number={2} title={labels.helpTitle} intro={labels.helpIntro} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,.6fr)]">
            <div className="grid gap-4 sm:grid-cols-2">
              {favoritePairs.map(({ person, product }) => (
                <button
                  type="button"
                  key={`${person.id}-${product.id}`}
                  onClick={() => onNotebookNavigate?.({ type: 'notebook.person', slug: person.slug })}
                  className="joko-shell-card group overflow-hidden rounded-2xl p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                >
                  <div className="mb-3 flex items-center gap-3 px-1 pt-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#55766F]/20 bg-[#DCE9EC] text-lg font-semibold text-[#304B45]">
                      {text(person.title).slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.12em] text-[#466861]/70">{labels.favoriteLabel}</p>
                      <p className="font-medium text-[#303532]">{text(person.title)}</p>
                      <p className="text-sm text-[#303532]/65">{text(product.title)}</p>
                    </div>
                    <Heart className="ml-auto h-4 w-4 text-[#C76624]" aria-hidden="true" />
                  </div>
                  <img
                    src={featuredProductImageUrl}
                    alt={text(product.title)}
                    className="h-40 w-full rounded-xl object-cover sm:h-44"
                    loading="lazy"
                  />
                </button>
              ))}

              {favoritePairs.length === 0 && (
                <div className="joko-shell-card rounded-2xl p-6 text-sm leading-6 text-[#303532]/70">
                  {labels.moreFavorites}
                </div>
              )}
            </div>

            <aside className="joko-shell-card flex flex-col justify-between rounded-2xl p-6">
              <div>
                <Sparkles className="h-6 w-6 text-[#C76624]" strokeWidth={1.5} aria-hidden="true" />
                <p className="mt-4 text-base leading-7 text-[#303532]/75">{labels.moreFavorites}</p>
              </div>
              <button
                type="button"
                onClick={() => onNotebookNavigate?.({ type: 'notebook.index', index: 'people' })}
                className="mt-6 inline-flex items-center gap-2 self-start border-b border-[#C76624]/60 pb-0.5 text-sm font-medium text-[#A44F1D] transition hover:border-[#C76624] hover:text-[#7A3D1B] focus:outline-none focus:ring-2 focus:ring-[#55766F]"
              >
                {labels.seeFavorites}<ArrowRight className="h-4 w-4" />
              </button>
            </aside>
          </div>
        </Container>
      </section>

      <section className="joko-paper-band py-12 sm:py-14">
        <Container width="wide">
          <SectionHeading number={3} title={labels.newTitle} intro={labels.newIntro} />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,.65fr)]">
            {featuredProduct ? (
              <article className="grid overflow-hidden rounded-2xl border border-[#55766F]/12 bg-white/25 sm:grid-cols-[minmax(14rem,.95fr)_minmax(0,1.05fr)]">
                <img
                  src={featuredProductImageUrl}
                  alt={text(featuredProduct.title)}
                  className="h-64 w-full object-cover sm:h-full"
                  loading="lazy"
                />
                <div className="flex flex-col justify-center p-6 sm:p-8">
                  <h3 className="text-2xl font-semibold text-[#303532]">{text(featuredProduct.title)}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#303532]/70">{text(featuredProduct.summary)}</p>
                  <button
                    type="button"
                    onClick={() => onNotebookNavigate?.({ type: 'notebook.product', slug: featuredProduct.slug })}
                    className="mt-5 inline-flex items-center gap-2 self-start rounded-lg bg-[#C76624] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#AE5219] focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                  >
                    {labels.openNote}<ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </article>
            ) : (
              <div />
            )}

            <aside className="flex flex-col justify-between rounded-2xl border border-[#55766F]/12 bg-[#DCE9EC]/45 p-6 sm:p-8">
              <div>
                <p className="text-lg font-semibold leading-7 text-[#303532]">{labels.bakeryPrompt}</p>
                <p className="mt-2 text-sm leading-6 text-[#303532]/65">{language === 'en' ? 'The practical side of JOKO is always one click away.' : language === 'th' ? 'ฝั่งที่เป็นเบเกอรี่ของ JOKO อยู่ห่างแค่คลิกเดียว' : 'JOKO 的烘焙坊一直只差一次点击。'}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('products')}
                className="joko-shell-primary-button mt-6 inline-flex items-center gap-2 self-start rounded-lg px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#55766F]"
              >
                {labels.browseBakery}<ArrowRight className="h-4 w-4" />
              </button>
            </aside>
          </div>
        </Container>
      </section>

      <section className="joko-mineral-field border-t border-[#55766F]/10 py-11 sm:py-13">
        <Container width="wide">
          <SectionHeading number={4} title={labels.beyondTitle} intro={labels.beyondIntro} />
          <div className="grid gap-4 lg:grid-cols-3">
            {labels.finds.map(([title, objectLabel], index) => (
              <article key={title} className="joko-shell-card flex items-center gap-4 rounded-2xl p-4">
                <QuietObjectSketch kind={index} label={objectLabel} />
                <div>
                  <h3 className="text-base font-semibold leading-6 text-[#303532]">{title}</h3>
                  <button
                    type="button"
                    onClick={() => onNotebookNavigate?.({ type: 'notebook.today' })}
                    className="mt-3 inline-flex items-center gap-1 border-b border-[#C76624]/45 pb-0.5 text-xs font-medium text-[#A44F1D] transition hover:border-[#C76624] focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                  >
                    {labels.seeMore}<ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}

export default HomepageLowerSections;
