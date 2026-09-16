import {
  ArrowRight,
  Check,
  Clock3,
  Croissant,
  Heart,
  MapPin,
  PackageCheck,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getPickupDays, type PickupDay } from '../../../lib/availabilityService';
import {
  getPickupLocations,
  getProducts,
  type CMSPickupLocation,
  type CMSProduct,
} from '../../../lib/cmsService';
import { getPublicImageUrl } from '../../../lib/storage';
import { jokoTodayCuriosityFixture } from '../../../platform/curiosity';
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
    bakingTitle: "What’s Baking This Week at JOKO",
    bakingIntro: 'Freshly baked. Limited quantities. Pre-order to reserve.',
    seeAll: 'See all bakery products',
    noProducts: 'The current bakery menu will appear here as soon as suitable active products are available.',
    soldOut: 'Sold out',
    howTitle: 'How It Works',
    howIntro: 'Choose → Pre-order → Pick up → Enjoy.',
    howSteps: [
      ['Choose', 'Browse the current bakery menu.'],
      ['Pre-order', 'Place your order before the cutoff.'],
      ['Pick up', 'Collect at your selected location and day.'],
      ['Enjoy', 'Good bread. A kinder day.'],
    ],
    pickupTitle: 'Pickup',
    pickupIntro: 'Where, when and when to order by.',
    cutoff: 'Order cutoff',
    maps: 'View on map',
    pickupEmpty: 'Pickup details are temporarily unavailable.',
    helpTitle: 'Need a Little Help Choosing?',
    helpIntro: 'Real favourites from people around JOKO.',
    favorite: 'likes',
    moreFavorites: 'More genuine favourites will appear as they are added to the Notebook.',
    seePeople: 'See what others love',
    newTitle: "New from the Baker’s Table",
    newIntro: 'Experiments, seasonal bakes and genuinely new things from the bakery.',
    newEmpty: 'When the bakers publish a true new or experimental bake, it will appear here.',
    seeBakery: 'Explore the Bakery',
    beyondTitle: 'Not Bread. Still Good.',
    beyondIntro: 'A small home for carefully selected non-bakery things.',
    beyondEmpty: 'We will only put something here when there is a real JOKO-curated find worth sharing.',
    curiosityEyebrow: 'A Curiosity',
    curiosityTitle: 'A question worth following',
    curiosityCta: 'Read this curiosity',
  },
  th: {
    bakingTitle: 'สัปดาห์นี้ JOKO อบอะไรบ้าง',
    bakingIntro: 'อบสด จำนวนจำกัด สั่งล่วงหน้าเพื่อจองไว้',
    seeAll: 'ดูผลิตภัณฑ์เบเกอรี่ทั้งหมด',
    noProducts: 'เมนูเบเกอรี่ปัจจุบันจะแสดงที่นี่เมื่อมีสินค้าที่เปิดขายและมีรูปจริง',
    soldOut: 'ขายหมด',
    howTitle: 'วิธีสั่งซื้อ',
    howIntro: 'เลือก → สั่งล่วงหน้า → รับของ → อร่อยได้เลย',
    howSteps: [
      ['เลือก', 'ดูเมนูเบเกอรี่ที่เปิดขายอยู่'],
      ['สั่งล่วงหน้า', 'สั่งก่อนเวลาปิดรับออเดอร์'],
      ['รับของ', 'มารับตามจุดและวันที่เลือก'],
      ['เพลิดเพลิน', 'ขนมปังดี ๆ วันที่อ่อนโยนกว่า'],
    ],
    pickupTitle: 'จุดรับสินค้า',
    pickupIntro: 'รับที่ไหน วันไหน และต้องสั่งภายในเมื่อไร',
    cutoff: 'ปิดรับออเดอร์',
    maps: 'เปิดแผนที่',
    pickupEmpty: 'ข้อมูลจุดรับสินค้ายังไม่พร้อมใช้งานชั่วคราว',
    helpTitle: 'อยากได้ตัวช่วยเลือกนิดหน่อยไหม?',
    helpIntro: 'ของโปรดจริง ๆ จากผู้คนรอบ JOKO',
    favorite: 'ชอบ',
    moreFavorites: 'ของโปรดจริงจะค่อย ๆ ปรากฏเมื่อถูกเพิ่มลงใน Notebook',
    seePeople: 'ดูว่าคนอื่นชอบอะไร',
    newTitle: 'ของใหม่จากโต๊ะคนทำขนม',
    newIntro: 'ของทดลอง เมนูตามฤดูกาล และของใหม่จริง ๆ จากเบเกอรี่',
    newEmpty: 'เมื่อทีมเบเกอรี่เผยแพร่ของใหม่หรือของทดลองจริง เมนูนั้นจะปรากฏที่นี่',
    seeBakery: 'สำรวจเบเกอรี่',
    beyondTitle: 'ไม่ใช่ขนมปัง แต่ก็ดี',
    beyondIntro: 'พื้นที่เล็ก ๆ สำหรับสิ่งที่ไม่ใช่เบเกอรี่แต่ JOKO เลือกจริง ๆ',
    beyondEmpty: 'เราจะใส่ของไว้ตรงนี้ก็ต่อเมื่อมีสิ่งที่ JOKO คัดเลือกจริงและควรค่าแก่การแบ่งปัน',
    curiosityEyebrow: 'Curiosity วันนี้',
    curiosityTitle: 'คำถามที่น่าตามต่อ',
    curiosityCta: 'อ่าน Curiosity นี้',
  },
  zh: {
    bakingTitle: 'JOKO 本周在烤什么',
    bakingIntro: '新鲜烘焙，数量有限。提前预订即可保留。',
    seeAll: '查看全部烘焙产品',
    noProducts: '当前烘焙菜单有合适的在售商品时会显示在这里。',
    soldOut: '售罄',
    howTitle: '如何订购',
    howIntro: '挑选 → 预订 → 取货 → 享用',
    howSteps: [
      ['挑选', '浏览当前烘焙菜单。'],
      ['预订', '在截止时间前下单。'],
      ['取货', '按所选地点和日期领取。'],
      ['享用', '好面包，更温柔的一天。'],
    ],
    pickupTitle: '取货',
    pickupIntro: '在哪里、哪一天，以及何时截止下单。',
    cutoff: '预订截止',
    maps: '打开地图',
    pickupEmpty: '取货信息暂时无法显示。',
    helpTitle: '需要一点挑选灵感吗？',
    helpIntro: '来自 JOKO 身边真实人物的偏爱。',
    favorite: '喜欢',
    moreFavorites: '只有真实偏爱被加入 Notebook 后，更多内容才会出现在这里。',
    seePeople: '看看大家喜欢什么',
    newTitle: '烘焙桌上的新东西',
    newIntro: '实验、季节限定，以及真正的新烘焙。',
    newEmpty: '当烘焙师真正发布新品或实验作品时，它会出现在这里。',
    seeBakery: '探索烘焙坊',
    beyondTitle: '不是面包，也很好。',
    beyondIntro: '留给 JOKO 真正精选的非烘焙小物。',
    beyondEmpty: '只有遇到真正值得分享的 JOKO 精选物件，我们才会把它放在这里。',
    curiosityEyebrow: '一则 Curiosity',
    curiosityTitle: '一个值得继续追问的问题',
    curiosityCta: '阅读这个 Curiosity',
  },
} as const;

function productImage(product: CMSProduct): string | null {
  if (!product.image) return null;
  return product.image.startsWith('http') ? product.image : getPublicImageUrl(product.image);
}


function getEditorialNewProduct(): CMSProduct | null {
  // Intentionally empty until the CMS exposes an explicit editorial signal for "new".
  return null;
}

function pickupLabel(day: PickupDay, language: LanguageCode): string {
  if (language === 'th') return day.label_th || day.label_en || day.label;
  if (language === 'zh') return day.label_zh || day.label_en || day.label;
  return day.label_en || day.label;
}

function SectionTitle({ title, intro, action }: { title: string; intro?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#303532] sm:text-4xl" style={{ fontFamily: 'var(--joko-font-display)' }}>
          {title}
        </h2>
        {intro && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#303532]/66 sm:text-base">{intro}</p>}
      </div>
      {action}
    </div>
  );
}

export function HomepageLowerSections({ locale, onNavigate, bundle, featuredProductImageUrl, onNotebookNavigate }: HomepageLowerSectionsProps) {
  const language: LanguageCode = locale === 'th' || locale === 'zh' ? locale : 'en';
  const labels = copy[language];
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [locations, setLocations] = useState<CMSPickupLocation[]>([]);
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([getProducts(), getPickupLocations(), getPickupDays()])
      .then(([nextProducts, nextLocations, nextPickupDays]) => {
        if (!active) return;
        setProducts(nextProducts);
        setLocations(nextLocations);
        setPickupDays(nextPickupDays.filter((day) => day.is_open));
      })
      .catch((error) => console.error('Homepage bakery data failed to load:', error));
    return () => { active = false; };
  }, []);

  const text = (value: Parameters<typeof getNotebookLocalizedText>[0]) =>
    getNotebookLocalizedText(value, language, bundle.site.defaultLocale);

  const people = bundle.entries.filter((entry): entry is NotebookPersonEntry => entry.kind === 'person');
  const notebookProducts = bundle.entries.filter((entry): entry is NotebookProductEntry => entry.kind === 'product');
  const favorites = people.flatMap((person) => {
    const product = person.favoriteProductRef
      ? notebookProducts.find((candidate) => candidate.id === person.favoriteProductRef?.id)
      : undefined;
    return product ? [{ person, product }] : [];
  }).slice(0, 3);

  const weeklyProducts = products.filter((product) => Boolean(productImage(product))).slice(0, 6);

  const genuinelyNew = getEditorialNewProduct();

  const curiosity = jokoTodayCuriosityFixture.episodes.find((episode) => episode.id === 'curiosity-warm-bread-smell')
    ?? jokoTodayCuriosityFixture.episodes.find((episode) => episode.status === 'published');
  const curiosityText = (value: Record<string, string> | undefined) => value?.[language] ?? value?.en ?? '';

  return (
    <div>
      <section id="whats-baking" className="joko-paper-band py-12 sm:py-16">
        <Container width="wide">
          <SectionTitle
            title={labels.bakingTitle}
            intro={labels.bakingIntro}
            action={(
              <button type="button" onClick={() => onNavigate('products')} className="inline-flex items-center gap-2 self-start border-b border-[#C76624]/50 pb-1 text-sm font-medium text-[#A44F1D] hover:border-[#C76624]">
                {labels.seeAll}<ArrowRight className="h-4 w-4" />
              </button>
            )}
          />
          {weeklyProducts.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
              {weeklyProducts.map((product) => {
                const image = productImage(product);
                const name = language === 'th' ? product.name_th : language === 'zh' ? product.name_zh || product.name_en : product.name_en;
                return (
                  <button key={product.id} type="button" onClick={() => onNavigate(`product/${product.slug}`)} className="group overflow-hidden rounded-2xl border border-[#8B765E]/15 bg-[#FFFDF7]/70 text-left shadow-[0_8px_22px_rgba(67,54,39,.05)] transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#E9E0D0]">
                      {image ? <img src={image} alt={name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" /> : (
                        <div className="flex h-full items-center justify-center"><Croissant className="h-10 w-10 text-[#9A7655]/45" strokeWidth={1.2} /></div>
                      )}
                      {(product.is_sold_out || product.stock_remaining <= 0) && (
                        <span className="absolute right-2 top-2 rounded-full bg-[#303532]/82 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white shadow-sm">
                          {labels.soldOut}
                        </span>
                      )}
                      {product.is_sold_out && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-[#303532]/88 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                          {labels.soldOut}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-medium text-[#303532]">{name}</p>
                      <p className="mt-1 text-sm font-semibold text-[#A44F1D]">฿{product.price}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : <p className="rounded-2xl border border-[#8B765E]/12 bg-white/20 p-6 text-sm text-[#303532]/60">{labels.noProducts}</p>}
        </Container>
      </section>

      <section id="how-it-works" className="joko-mineral-field border-y border-[#55766F]/10 py-12 sm:py-16 scroll-mt-24">
        <Container width="wide">
          <SectionTitle title={labels.howTitle} intro={labels.howIntro} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {labels.howSteps.map(([title, body], index) => {
              const icons = [ShoppingBasket, Clock3, MapPin, PackageCheck];
              const Icon = icons[index];
              return (
                <article key={title} className="relative rounded-2xl border border-[#55766F]/12 bg-[#F7F1E7]/76 p-5 shadow-[0_10px_24px_rgba(48,75,69,.05)]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#C76624]/10 text-[#B45620]"><Icon className="h-6 w-6" strokeWidth={1.4} /></div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#55766F]">{index + 1}</p>
                  <h3 className="mt-1 text-xl font-semibold text-[#303532]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#303532]/65">{body}</p>
                  {index < 3 && <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 text-[#55766F]/35 lg:block" aria-hidden="true" />}
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      <section id="pickup" className="joko-paper-band py-12 sm:py-16 scroll-mt-24">
        <Container width="wide">
          <SectionTitle title={labels.pickupTitle} intro={labels.pickupIntro} />
          {locations.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {locations.map((location) => {
                const days = pickupDays.filter((day) => day.location_id === location.id);
                const name = language === 'th' ? location.name_th : language === 'zh' ? location.name_zh || location.name_en : location.name_en;
                return (
                  <article key={location.id} className="rounded-3xl border border-[#8B765E]/16 bg-[#FFFDF7]/55 p-6 sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div><MapPin className="h-6 w-6 text-[#668B86]" strokeWidth={1.4} /><h3 className="mt-3 text-2xl font-semibold text-[#303532]">{name}</h3></div>
                      {location.maps_url && <a href={location.maps_url} target="_blank" rel="noreferrer" className="text-sm text-[#A44F1D] underline decoration-[#C76624]/40 underline-offset-4">{labels.maps}</a>}
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {days.map((day) => (
                        <div key={day.id} className="rounded-2xl bg-[#DCE9EC]/50 p-4">
                          <p className="font-semibold text-[#303532]">{pickupLabel(day, language)}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#55766F]">{labels.cutoff}</p>
                          <p className="mt-1 text-sm text-[#303532]/72">{day.cutoff_day} · {day.cutoff_time}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <p className="rounded-2xl border border-[#8B765E]/12 bg-white/20 p-6 text-sm text-[#303532]/60">{labels.pickupEmpty}</p>}
        </Container>
      </section>

      <section id="help-choosing" className="joko-mineral-field border-y border-[#55766F]/10 py-12 sm:py-16 scroll-mt-24">
        <Container width="wide">
          <SectionTitle title={labels.helpTitle} intro={labels.helpIntro} />
          {favorites.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {favorites.map(({ person, product }) => (
                <button key={`${person.id}-${product.id}`} type="button" onClick={() => onNotebookNavigate?.({ type: 'notebook.person', slug: person.slug })} className="rounded-2xl border border-[#55766F]/13 bg-[#F7F1E7]/75 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#DCE9EC] font-semibold text-[#304B45]">{text(person.title).slice(0, 1)}</span><div><p className="font-semibold text-[#303532]">{text(person.title)}</p><p className="text-sm text-[#303532]/55">{labels.favorite}</p></div></div>
                  <div className="mt-5 flex items-center gap-4">
                    <img src={featuredProductImageUrl} alt={text(product.title)} className="h-20 w-24 rounded-xl object-cover" loading="lazy" />
                    <div><p className="font-semibold text-[#303532]">{text(product.title)}</p><Heart className="mt-2 h-4 w-4 text-[#C76624]" /></div>
                  </div>
                </button>
              ))}
            </div>
          ) : <p className="rounded-2xl border border-[#55766F]/12 bg-[#F7F1E7]/60 p-6 text-sm text-[#303532]/65">{labels.moreFavorites}</p>}
          <button type="button" onClick={() => onNotebookNavigate?.({ type: 'notebook.collection', slug: 'people' })} className="mt-6 inline-flex items-center gap-2 border-b border-[#C76624]/50 pb-1 text-sm font-medium text-[#A44F1D]">{labels.seePeople}<ArrowRight className="h-4 w-4" /></button>
        </Container>
      </section>

      <section id="bakers-table" className="joko-paper-band py-12 sm:py-16 scroll-mt-24">
        <Container width="wide">
          <SectionTitle title={labels.newTitle} intro={labels.newIntro} />
          {genuinelyNew ? (
            <article className="grid overflow-hidden rounded-3xl border border-[#8B765E]/15 bg-[#FFFDF7]/65 md:grid-cols-[.9fr_1.1fr]">
              <div className="min-h-64 bg-[#E9E0D0]">{productImage(genuinelyNew) ? <img src={productImage(genuinelyNew)!} alt={genuinelyNew.name_en} className="h-full w-full object-cover" /> : null}</div>
              <div className="flex flex-col justify-center p-7"><Sparkles className="h-6 w-6 text-[#C76624]" /><h3 className="mt-4 text-2xl font-semibold text-[#303532]">{language === 'th' ? genuinelyNew.name_th : language === 'zh' ? genuinelyNew.name_zh || genuinelyNew.name_en : genuinelyNew.name_en}</h3><p className="mt-3 text-sm leading-6 text-[#303532]/65">{language === 'th' ? genuinelyNew.desc_th : language === 'zh' ? genuinelyNew.desc_zh || genuinelyNew.desc_en : genuinelyNew.desc_en}</p><button type="button" onClick={() => onNavigate(`product/${genuinelyNew.slug}`)} className="joko-shell-primary-button mt-6 inline-flex items-center gap-2 self-start rounded-xl px-5 py-3 text-sm font-semibold">{labels.seeBakery}<ArrowRight className="h-4 w-4" /></button></div>
            </article>
          ) : <div className="rounded-3xl border border-dashed border-[#8B765E]/22 bg-white/15 p-8 text-center"><Sparkles className="mx-auto h-7 w-7 text-[#C76624]/65" /><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#303532]/62">{labels.newEmpty}</p><button type="button" onClick={() => onNavigate('products')} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#A44F1D]">{labels.seeBakery}<ArrowRight className="h-4 w-4" /></button></div>}
        </Container>
      </section>

      <section id="not-bread" className="joko-mineral-field border-y border-[#55766F]/10 py-12 sm:py-16 scroll-mt-24">
        <Container width="wide">
          <SectionTitle title={labels.beyondTitle} intro={labels.beyondIntro} />
          <div className="rounded-3xl border border-dashed border-[#55766F]/20 bg-[#F7F1E7]/55 p-8 text-center"><Check className="mx-auto h-7 w-7 text-[#668B86]" /><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#303532]/62">{labels.beyondEmpty}</p></div>
        </Container>
      </section>

      <section id="curiosity-feature" className="joko-paper-band py-12 sm:py-16 scroll-mt-24">
        <Container width="wide">
          {curiosity && (
            <article className="grid gap-6 rounded-3xl border border-[#8B765E]/15 bg-[#FFFDF7]/55 p-6 sm:p-8 lg:grid-cols-[.7fr_1.3fr] lg:items-center">
              <div className="relative min-h-44 overflow-hidden rounded-2xl bg-[#DCE9EC]/45">
                <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_30%_30%,rgba(244,239,229,.9),transparent_35%),linear-gradient(135deg,transparent_45%,rgba(85,118,111,.13)_46%,transparent_47%)]" />
                <div className="relative flex h-full min-h-44 items-center justify-center"><span className="text-7xl font-semibold text-[#55766F]/25" style={{ fontFamily: 'var(--joko-font-notebook)' }}>?</span></div>
              </div>
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#55766F]">{labels.curiosityEyebrow}</p><h2 className="mt-3 text-3xl font-semibold leading-tight text-[#303532] sm:text-4xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{curiosityText(curiosity.question)}</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-[#303532]/68 sm:text-base">{curiosityText(curiosity.summary)}</p><button type="button" onClick={() => onNotebookNavigate?.({ type: 'notebook.collection', slug: 'bakery-science' })} className="mt-6 inline-flex items-center gap-2 border-b border-[#C76624]/50 pb-1 text-sm font-medium text-[#A44F1D]">{labels.curiosityCta}<ArrowRight className="h-4 w-4" /></button></div>
            </article>
          )}
        </Container>
      </section>
    </div>
  );
}

export default HomepageLowerSections;
