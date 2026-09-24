import {
  ArrowRight,
  ArrowUp,
  Check,
  Clock3,
  Croissant,
  MapPin,
  PackageCheck,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { getPickupDays, type PickupDay } from '../../../lib/availabilityService';
import {
  getPickupLocations,
  getProducts,
  type CMSPickupLocation,
  type CMSProduct,
} from '../../../lib/cmsService';
import { getPublicImageUrl } from '../../../lib/storage';
import { Container } from '../../../platform/design-system';

interface HomepageLowerSectionsProps {
  locale: string;
  onNavigate: (page: string) => void;
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
    newTitle: "New from the Baker’s Table",
    newIntro: 'Experiments, seasonal bakes and genuinely new things from the bakery.',
    newEmpty: 'When the bakers publish a true new or experimental bake, it will appear here.',
    seeBakery: 'Explore the Bakery',
    beyondTitle: 'Not Bread. Still Good.',
    beyondIntro: 'A small home for carefully selected non-bakery things.',
    beyondEmpty: 'We will only put something here when there is a real JOKO-curated find worth sharing.',
    backToTop: 'Back to top',
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
    newTitle: 'ของใหม่จากโต๊ะคนทำขนม',
    newIntro: 'ของทดลอง เมนูตามฤดูกาล และของใหม่จริง ๆ จากเบเกอรี่',
    newEmpty: 'เมื่อทีมเบเกอรี่เผยแพร่ของใหม่หรือของทดลองจริง เมนูนั้นจะปรากฏที่นี่',
    seeBakery: 'สำรวจเบเกอรี่',
    beyondTitle: 'ไม่ใช่ขนมปัง แต่ก็ดี',
    beyondIntro: 'พื้นที่เล็ก ๆ สำหรับสิ่งที่ไม่ใช่เบเกอรี่แต่ JOKO เลือกจริง ๆ',
    beyondEmpty: 'เราจะใส่ของไว้ตรงนี้ก็ต่อเมื่อมีสิ่งที่ JOKO คัดเลือกจริงและควรค่าแก่การแบ่งปัน',
    backToTop: 'กลับด้านบน',
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
    newTitle: '烘焙桌上的新东西',
    newIntro: '实验、季节限定，以及真正的新烘焙。',
    newEmpty: '当烘焙师真正发布新品或实验作品时，它会出现在这里。',
    seeBakery: '探索烘焙坊',
    beyondTitle: '不是面包，也很好。',
    beyondIntro: '留给 JOKO 真正精选的非烘焙小物。',
    beyondEmpty: '只有遇到真正值得分享的 JOKO 精选物件，我们才会把它放在这里。',
    backToTop: '返回顶部',
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

function SectionTitle({
  title,
  intro,
  action,
  backToTopLabel,
  onBackToTop,
}: {
  title: string;
  intro?: string;
  action?: React.ReactNode;
  backToTopLabel: string;
  onBackToTop: () => void;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#303532] sm:text-4xl" style={{ fontFamily: 'var(--joko-font-display)' }}>
          {title}
        </h2>
        {intro && <p className="mt-2 max-w-2xl text-sm leading-6 text-[#303532]/66 sm:text-base">{intro}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {action}
        <button
          type="button"
          onClick={onBackToTop}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#55766F]/72 transition hover:text-[#3F665E] focus:outline-none focus:ring-2 focus:ring-[#55766F]/35 focus:ring-offset-2"
        >
          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          {backToTopLabel}
        </button>
      </div>
    </div>
  );
}

export function HomepageLowerSections({ locale, onNavigate }: HomepageLowerSectionsProps) {
  const language: LanguageCode = locale === 'th' || locale === 'zh' ? locale : 'en';
  const labels = copy[language];
  const { t } = useLanguage();
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

  useEffect(() => {
    const syncHomepagePositionFromHistory = () => {
      if (window.location.pathname !== '/') return;
      const targetId = window.location.hash.replace(/^#/, '');
      window.requestAnimationFrame(() => {
        if (!targetId) {
          window.scrollTo({ top: 0, behavior: 'auto' });
          return;
        }
        window.document.getElementById(targetId)?.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    };

    window.addEventListener('popstate', syncHomepagePositionFromHistory);
    syncHomepagePositionFromHistory();
    return () => window.removeEventListener('popstate', syncHomepagePositionFromHistory);
  }, []);

  const backToTop = () => {
    if (window.location.pathname !== '/') {
      onNavigate('home');
      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 80);
      return;
    }
    if (window.location.hash) {
      window.history.pushState({ jokoHomepageSection: null }, '', '/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const weeklyProducts = products.filter((product) => Boolean(productImage(product))).slice(0, 6);

  const genuinelyNew = getEditorialNewProduct();



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
            backToTopLabel={labels.backToTop}
            onBackToTop={backToTop}
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
          <SectionTitle title={labels.howTitle} intro={labels.howIntro} backToTopLabel={labels.backToTop} onBackToTop={backToTop} />
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
          <SectionTitle title={labels.pickupTitle} intro={labels.pickupIntro} backToTopLabel={labels.backToTop} onBackToTop={backToTop} />
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

      <section id="bakers-table" className="joko-paper-band py-12 sm:py-16 scroll-mt-24">
        <Container width="wide">
          <SectionTitle title={labels.newTitle} intro={labels.newIntro} backToTopLabel={labels.backToTop} onBackToTop={backToTop} />
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
          <SectionTitle title={labels.beyondTitle} intro={labels.beyondIntro} backToTopLabel={labels.backToTop} onBackToTop={backToTop} />
          <div className="rounded-3xl border border-dashed border-[#55766F]/20 bg-[#F7F1E7]/55 p-8 text-center"><Check className="mx-auto h-7 w-7 text-[#668B86]" /><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#303532]/62">{labels.beyondEmpty}</p></div>
        </Container>
      </section>

      <section id="about" className="joko-paper-band py-12 sm:py-16 scroll-mt-24">
        <Container width="wide">
          <SectionTitle
            title={t.about.title}
            action={(
              <button
                type="button"
                onClick={() => onNavigate('our-story')}
                className="inline-flex items-center gap-2 border-b border-[#C76624]/45 pb-1 text-sm font-medium text-[#A44F1D] transition hover:border-[#C76624]"
              >
                {t.about.story}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            backToTopLabel={labels.backToTop}
            onBackToTop={backToTop}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-[#8B765E]/14 bg-[#FFFDF7]/58 p-6 sm:p-7">
              <h3 className="text-xl font-semibold text-[#303532]">{t.about.story}</h3>
              <p className="mt-3 text-sm leading-6 text-[#303532]/66">{t.about.storyText}</p>
            </article>
            <article className="rounded-3xl border border-[#8B765E]/14 bg-[#FFFDF7]/58 p-6 sm:p-7">
              <h3 className="text-xl font-semibold text-[#303532]">{t.about.mission}</h3>
              <p className="mt-3 text-sm leading-6 text-[#303532]/66">{t.about.missionText}</p>
            </article>
            <article className="rounded-3xl border border-[#8B765E]/14 bg-[#FFFDF7]/58 p-6 sm:p-7">
              <h3 className="text-xl font-semibold text-[#303532]">{t.about.commitment}</h3>
              <p className="mt-3 text-sm leading-6 text-[#303532]/66">{t.about.commitmentText}</p>
            </article>
          </div>
        </Container>
      </section>

    </div>
  );
}

export default HomepageLowerSections;
