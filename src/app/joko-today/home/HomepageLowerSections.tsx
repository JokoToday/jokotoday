import { MakersSection } from '../../../components/MakersSection';
import { productOrigin } from '../../../lib/makersService';
import {
  ArrowRight,
  ArrowUp,
  Check,
  Clock3,
  Croissant,
  MapPin,
  PackageCheck,
  Play,
  MessageSquareQuote,
  Star,
  ShoppingBasket,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { getPickupDays, type PickupDay } from '../../../lib/availabilityService';
import {
  getPickupLocations,
  getProducts,
  type CMSPickupLocation,
  type CMSProduct,
} from '../../../lib/cmsService';
import { getPublicImageUrl } from '../../../lib/storage';
import {
  getPublishedExternalMentions,
  getPublishedGalleryItems,
  localizedGalleryText,
  type ExternalMention,
  type GalleryItem,
} from '../../../lib/aboutMediaService';
import {
  BuilderRichTextContent,
  localize,
  localizeRichText,
  type HomeTopLikedSection,
} from '../../../platform/builder';
import { Container } from '../../../platform/design-system';
import { usePublishedJokoBranding } from '../builder/usePublishedJokoLogo';
import { JokoBubbleSlot } from '../../../components/JokoBubbleSlot';

interface HomepageLowerSectionsProps {
  locale: string;
  onNavigate: (page: string) => void;
  publishedTopLiked?: HomeTopLikedSection | null;
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
    beyondAction: 'Browse all non-bakery products',
    beyondEmpty: 'We will only put something here when there is a real JOKO-curated find worth sharing.',
    aboutTitle: 'About JOKO',
    aboutIntro: 'A small bakery in Chiang Mai, baking in Mae Rim and selling where our customers are.',
    aboutBakeryTitle: 'Our Bakery',
    aboutBakeryText: 'We bake in our garden in Mae Rim, then bring the good things closer to town on selected pickup days.',
    aboutBakeryProducts: 'Browse the baked goodies',
    aboutBakeryPickup: 'See pickup days & locations',
    aboutPeopleTitle: 'Who’s in Charge?',
    aboutPeopleText: 'Meet Joe & Phuttan. Two people, a lot of baking, and a few unexpected turns along the way.',
    aboutPeopleAction: 'Meet Joe & Phuttan',
    aboutStoryTitle: 'Our Story',
    aboutStoryText: 'JOKO began with chocolate pralines, one slightly reckless “Yes, we can make croissants,” and a second-hand dough sheeter bought before we knew why we needed it.',
    readStory: 'Read our story',
    galleryTitle: 'Around JOKO',
    galleryIntro: 'A few real moments from the bakery, pickup days and the people around us.',
    galleryAction: 'See the Gallery',
    galleryEmpty: 'Add 3–5 published Gallery items in Admin to bring this section to life.',
    peopleSayTitle: 'What Others Say',
    peopleSayIntro: 'Real reviews, videos and posts from outside JOKO.',
    peopleSayAction: 'See what people say',
    peopleSayEmpty: 'Curate a few real Google Maps reviews, TikToks, RedNote posts or other mentions in Admin.',
    originalPost: 'View original',
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
    beyondAction: 'ดูสินค้าที่ไม่ใช่เบเกอรี่ทั้งหมด',
    beyondEmpty: 'เราจะใส่ของไว้ตรงนี้ก็ต่อเมื่อมีสิ่งที่ JOKO คัดเลือกจริงและควรค่าแก่การแบ่งปัน',
    aboutTitle: 'เกี่ยวกับ JOKO',
    aboutIntro: 'ร้านเบเกอรี่เล็ก ๆ ในเชียงใหม่ เราอบที่แม่ริม และไปขายในที่ที่ลูกค้าของเราอยู่',
    aboutBakeryTitle: 'เบเกอรี่ของเรา',
    aboutBakeryText: 'เราอบขนมในสวนที่แม่ริม แล้วนำขนมมาให้รับใกล้เมืองในวันที่กำหนด',
    aboutBakeryProducts: 'ดูขนมอบทั้งหมด',
    aboutBakeryPickup: 'ดูวันและจุดรับสินค้า',
    aboutPeopleTitle: 'ใครอยู่เบื้องหลัง?',
    aboutPeopleText: 'รู้จัก Joe และ Phuttan คนสองคนกับขนมอบมากมายและเรื่องราวที่ไม่ได้วางแผนไว้',
    aboutPeopleAction: 'รู้จัก Joe และ Phuttan',
    aboutStoryTitle: 'เรื่องราวของเรา',
    aboutStoryText: 'JOKO เริ่มจากช็อกโกแลตพราลีน คำตอบ “ได้สิ เราทำครัวซองต์ได้” ที่มั่นใจเกินจริงไปนิด และเครื่องรีดแป้งมือสองที่เราซื้อก่อนจะรู้เสียอีกว่าต้องใช้มันทำอะไร',
    readStory: 'อ่านเรื่องราวของเรา',
    galleryTitle: 'รอบ ๆ JOKO',
    galleryIntro: 'ภาพจริงเล็ก ๆ จากเบเกอรี่ วันรับสินค้า และผู้คนรอบตัวเรา',
    galleryAction: 'ดูแกลเลอรี',
    galleryEmpty: 'เพิ่มภาพแกลเลอรีที่เผยแพร่แล้ว 3–5 รายการใน Admin เพื่อให้ส่วนนี้มีชีวิตขึ้นมา',
    peopleSayTitle: 'คนอื่นพูดถึงเราอย่างไร',
    peopleSayIntro: 'รีวิว วิดีโอ และโพสต์จริงจากโลกภายนอก JOKO',
    peopleSayAction: 'ดูสิ่งที่คนอื่นพูด',
    peopleSayEmpty: 'คัดเลือกรีวิว Google Maps, TikTok, RedNote หรือการพูดถึง JOKO จริง ๆ ใน Admin',
    originalPost: 'ดูต้นฉบับ',
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
    beyondAction: '浏览全部非烘焙商品',
    beyondEmpty: '只有遇到真正值得分享的 JOKO 精选物件，我们才会把它放在这里。',
    aboutTitle: '关于 JOKO',
    aboutIntro: '一家位于清迈的小烘焙坊：我们在湄林烘焙，也去到顾客方便取货的地方。',
    aboutBakeryTitle: '我们的烘焙坊',
    aboutBakeryText: '我们在湄林花园里的烘焙坊制作烘焙食品，再在指定取货日送到离顾客更近的地点。',
    aboutBakeryProducts: '浏览烘焙好物',
    aboutBakeryPickup: '查看取货时间与地点',
    aboutPeopleTitle: '谁在打理 JOKO？',
    aboutPeopleText: '认识 Joe 和 Phuttan。两个人、一间烘焙坊，还有许多计划外的转折。',
    aboutPeopleAction: '认识 Joe 和 Phuttan',
    aboutStoryTitle: '我们的故事',
    aboutStoryText: 'JOKO 从巧克力果仁糖开始，也从一句稍微自信过头的“当然会做可颂”开始，再加上一台买来时还不知道为什么需要的二手压面机。',
    readStory: '阅读我们的故事',
    galleryTitle: 'JOKO 日常',
    galleryIntro: '来自烘焙坊、取货日和身边人们的真实片段。',
    galleryAction: '查看影像集',
    galleryEmpty: '请在 Admin 中添加 3–5 个已发布并勾选首页展示的影像。',
    peopleSayTitle: '大家怎么说',
    peopleSayIntro: '来自 JOKO 之外的真实评价、视频和帖子。',
    peopleSayAction: '看看大家怎么说',
    peopleSayEmpty: '请在 Admin 中精选真实的 Google Maps 评价、TikTok、RedNote 或其他提及。',
    originalPost: '查看原帖',
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

function pickupLocationImageAlt(location: CMSPickupLocation, language: LanguageCode): string {
  if (language === 'th') return location.image_alt_th || location.image_alt_en || location.name_th || location.name_en;
  if (language === 'zh') return location.image_alt_zh || location.image_alt_en || location.name_zh || location.name_en;
  return location.image_alt_en || location.name_en;
}

function SectionTitle({
  title,
  intro,
  action,
  backToTopLabel,
  onBackToTop,
}: {
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  backToTopLabel: string;
  onBackToTop: () => void;
}) {
  return (
    <div className="mb-7 flex flex-col gap-3 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="whitespace-pre-line font-semibold tracking-[-0.03em]" style={{ fontFamily: 'var(--joko-font-display)', fontSize: 'var(--joko-size-section-heading, 36px)', color: 'var(--joko-brand-text, #303532)' }}>
          {title}
        </h2>
        {intro && <p className="mt-2 max-w-2xl whitespace-pre-line leading-6 text-[#303532]/66" style={{ fontSize: 'var(--joko-size-body, 16px)' }}>{intro}</p>}
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

export function HomepageLowerSections({
  locale,
  onNavigate,
  publishedTopLiked,
}: HomepageLowerSectionsProps) {
  const language: LanguageCode = locale === 'th' || locale === 'zh' ? locale : 'en';
  const labels = copy[language];
  const { branding, document: publishedHomepage } = usePublishedJokoBranding();
  const hero = publishedHomepage?.sections.find((section) => section.type === 'home.hero.v1');
  const legacyFounderPortrait = hero?.type === 'home.hero.v1'
    ? hero.props.notebookNote?.imageUrl?.trim() || null
    : null;
  const bakeryImage = branding.aboutCards?.bakery?.imageUrl?.trim() || null;
  const foundersPortrait = branding.aboutCards?.people?.imageUrl?.trim() || legacyFounderPortrait;
  const storyImage = branding.aboutCards?.story?.imageUrl?.trim() || null;
  const aboutImageAlt = (card: 'bakery' | 'people' | 'story', fallback: string) =>
    branding.aboutCards?.[card]?.imageAlt?.[language]?.trim()
    || branding.aboutCards?.[card]?.imageAlt?.en?.trim()
    || fallback;
  const publishedBakingTitle = publishedTopLiked
    ? localize(publishedTopLiked.props.title, language, 'en')
    : labels.bakingTitle;
  const publishedBakingIntro = publishedTopLiked
    ? localize(publishedTopLiked.props.subtitle, language, 'en')
    : labels.bakingIntro;
  const bakingTitle = publishedTopLiked
    ? localizeRichText(
        publishedTopLiked.props.titleRichText,
        language,
        'en',
        publishedBakingTitle,
      )
    : null;
  const bakingIntro = publishedTopLiked
    ? localizeRichText(
        publishedTopLiked.props.subtitleRichText,
        language,
        'en',
        publishedBakingIntro,
      )
    : null;
  const bakingBrowseLabel = publishedTopLiked
    ? localize(publishedTopLiked.props.browseLabel, language, 'en')
    : labels.seeAll;
  const showBaking = publishedTopLiked?.visible ?? true;
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [locations, setLocations] = useState<CMSPickupLocation[]>([]);
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [externalMentions, setExternalMentions] = useState<ExternalMention[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getProducts(),
      getPickupLocations(),
      getPickupDays(),
      getPublishedGalleryItems(undefined, { homepageOnly: true, limit: 5 }),
      getPublishedExternalMentions(undefined, { homepageOnly: true, limit: 3 }),
    ])
      .then(([nextProducts, nextLocations, nextPickupDays, nextGalleryItems, nextExternalMentions]) => {
        if (!active) return;
        setProducts(nextProducts);
        setLocations(nextLocations);
        setPickupDays(nextPickupDays.filter((day) => day.is_open));
        setGalleryItems(nextGalleryItems);
        setExternalMentions(nextExternalMentions);
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

  const weeklyProducts = products
    .filter((product) => productOrigin(product) === 'joko' && Boolean(productImage(product)))
    .slice(0, 6);
  const nonBakeryFeatured = products
    .filter((product) => productOrigin(product) === 'beyond' && product.non_bakery_feature_order != null)
    .sort((a, b) =>
      (a.non_bakery_feature_order ?? 999) - (b.non_bakery_feature_order ?? 999)
      || a.sort_order - b.sort_order
    ).slice(0, 6);

  const genuinelyNew = getEditorialNewProduct();



  return (
    <div>
      <MakersSection />
      {showBaking && <section id="whats-baking" className="joko-paper-band py-12 sm:py-16">
        <Container width="wide">
          <SectionTitle
            title={bakingTitle ? <BuilderRichTextContent value={bakingTitle} /> : labels.bakingTitle}
            intro={bakingIntro ? <BuilderRichTextContent value={bakingIntro} /> : labels.bakingIntro}
            action={(
              <button type="button" onClick={() => onNavigate('products-bakery')} className="inline-flex items-center gap-2 self-start border-b border-[#C76624]/50 pb-1 text-sm font-medium text-[#A44F1D] hover:border-[#C76624]">
                {bakingBrowseLabel}<ArrowRight className="h-4 w-4" />
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
      </section>}

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
                    <div className={`mt-5 grid gap-3 ${days.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1'}`}>
                      {days.map((day) => (
                        <div key={day.id} className="rounded-2xl bg-[#DCE9EC]/50 p-4">
                          <p className="font-semibold text-[#303532]">{pickupLabel(day, language)}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#55766F]">{labels.cutoff}</p>
                          <p className="mt-1 text-sm text-[#303532]/72">{day.cutoff_day} · {day.cutoff_time}</p>
                        </div>
                      ))}
                    </div>
                    {location.image_url && (
                      <div className="mt-4 overflow-hidden rounded-2xl bg-[#E9E0D0]">
                        <img
                          src={location.image_url}
                          alt={pickupLocationImageAlt(location, language)}
                          className="aspect-[16/7] w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    )}
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
          <SectionTitle
            title={labels.beyondTitle}
            intro={labels.beyondIntro}
            action={(
              <button
                type="button"
                onClick={() => onNavigate('products-non-bakery')}
                className="inline-flex items-center gap-2 border-b border-[#C76624]/45 pb-1 text-sm font-medium text-[#A44F1D] hover:border-[#C76624]"
              >
                {labels.beyondAction}<ArrowRight className="h-4 w-4" />
              </button>
            )}
            backToTopLabel={labels.backToTop}
            onBackToTop={backToTop}
          />
          {nonBakeryFeatured.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
              {nonBakeryFeatured.map((product) => {
                const name = language === 'th' ? product.name_th : language === 'zh'
                  ? product.name_zh || product.name_en : product.name_en;
                const image = productImage(product);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => onNavigate(`product/${product.slug}`)}
                    className="group overflow-hidden rounded-2xl border border-[#55766F]/16 bg-[#FFF9EE]/80 text-left shadow-[0_8px_22px_rgba(67,54,39,.05)] transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-[#E9E0D0]">
                      {image ? (
                        <img src={image} alt={name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" loading="lazy" />
                      ) : (
                        <div className="flex h-full items-center justify-center"><ShoppingBasket className="h-9 w-9 text-[#55766F]/35" /></div>
                      )}
                      {(product.is_sold_out || product.stock_remaining <= 0) && (
                        <span className="absolute right-2 top-2 rounded-full bg-[#303532]/85 px-2.5 py-1 text-[10px] font-semibold uppercase text-white">
                          {labels.soldOut}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-[#303532]">{name}</p>
                      <p className="mt-1 text-sm font-semibold text-[#A44F1D]">฿{product.price}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#55766F]/20 bg-[#F7F1E7]/55 p-8 text-center">
              <Check className="mx-auto h-7 w-7 text-[#668B86]" />
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-[#303532]/62">{labels.beyondEmpty}</p>
            </div>
          )}
        </Container>
      </section>


      <section id="about" className="joko-paper-band py-12 sm:py-16 scroll-mt-24">
        <Container width="wide">
          <SectionTitle
            title={labels.aboutTitle}
            intro={labels.aboutIntro}
            action={(
              <JokoBubbleSlot
                pageKey="home"
                placementKey="before-about"
                className="mr-1"
              />
            )}
            backToTopLabel={labels.backToTop}
            onBackToTop={backToTop}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <article className="flex h-full flex-col rounded-3xl border border-[#8B765E]/14 bg-[#FFFDF7]/72 p-6 sm:p-7">
              {bakeryImage && (
                <div className="mb-5 flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-[#F5EBD9]/70">
                  <img src={bakeryImage} alt={aboutImageAlt('bakery', labels.aboutBakeryTitle)} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                </div>
              )}
              <h3 className="text-xl font-semibold text-[#303532]" style={{ fontFamily: 'var(--joko-font-display)' }}>{labels.aboutBakeryTitle}</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-[#303532]/70">{labels.aboutBakeryText}</p>
              <div className="mt-6 flex flex-col items-start gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('products-bakery')}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#A44F1D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
                >{labels.aboutBakeryProducts}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
                <button
                  type="button"
                  onClick={() => {
                    const pickup = window.document.getElementById('pickup');
                    if (pickup) {
                      if (window.location.pathname === '/') window.history.pushState({ jokoHomepageSection: 'pickup' }, '', '/#pickup');
                      pickup.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    } else {
                      onNavigate('home');
                      window.setTimeout(() => window.document.getElementById('pickup')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
                    }
                  }}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#3F665E] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
                >{labels.aboutBakeryPickup}<MapPin className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            </article>

            <article className="flex h-full flex-col rounded-3xl border border-[#8B765E]/14 bg-[#FFFDF7]/72 p-6 sm:p-7">
              <div className="mb-5 flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-[#F5EBD9]/70 px-3 py-2">
                {foundersPortrait ? (
                  <img
                    src={foundersPortrait}
                    alt={aboutImageAlt('people', language === 'th' ? 'Joe และ Phuttan' : language === 'zh' ? 'Joe 和 Phuttan' : 'Joe and Phuttan')}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <span className="text-center text-2xl font-semibold text-[#55766F]" style={{ fontFamily: 'var(--joko-font-display)' }}>Joe &amp; Phuttan</span>
                )}
              </div>
              <h3 className="text-xl font-semibold text-[#303532]" style={{ fontFamily: 'var(--joko-font-display)' }}>{labels.aboutPeopleTitle}</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-[#303532]/70">{labels.aboutPeopleText}</p>
              <button
                type="button"
                onClick={() => onNavigate('meet-founders')}
                className="mt-5 inline-flex items-center gap-2 self-start text-sm font-semibold text-[#A44F1D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
              >{labels.aboutPeopleAction}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
            </article>

            <article className="flex h-full flex-col rounded-3xl border border-[#8B765E]/14 bg-[#FFFDF7]/72 p-6 sm:p-7">
              {storyImage && (
                <div className="mb-5 flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-[#F5EBD9]/70">
                  <img src={storyImage} alt={aboutImageAlt('story', labels.aboutStoryTitle)} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                </div>
              )}
              <h3 className="text-xl font-semibold text-[#303532]" style={{ fontFamily: 'var(--joko-font-display)' }}>{labels.aboutStoryTitle}</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-[#303532]/70">{labels.aboutStoryText}</p>
              <button type="button" onClick={() => onNavigate('our-story')} className="mt-6 inline-flex items-center gap-2 self-start text-sm font-semibold text-[#A44F1D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]">
                {labels.readStory}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </article>
          </div>

          <div className="mt-7 grid items-stretch gap-4 lg:grid-cols-2">
            <article id="gallery-preview" className="joko-about-curation-card min-w-0 rounded-3xl border border-[#55766F]/15 p-5 scroll-mt-24 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-[#303532]" style={{ fontFamily: 'var(--joko-font-display)' }}>{labels.galleryTitle}</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#303532]/67">{labels.galleryIntro}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('gallery')}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#A44F1D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
                >{labels.galleryAction}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
              </div>
              {galleryItems.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {galleryItems.slice(0, 3).map((item) => {
                    const text = localizedGalleryText(item, language);
                    const media = item.thumbnail_url || item.media_url;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onNavigate('gallery')}
                        className="group relative aspect-[4/3] min-w-0 overflow-hidden rounded-xl bg-[#E8E1D5] transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
                      >
                        <img src={media} alt={text.alt} className="h-full w-full object-cover transition group-hover:scale-[1.025]" loading="lazy" />
                        {item.media_type === 'video' && (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                            <Play className="h-7 w-7 text-white drop-shadow" fill="currentColor" aria-hidden="true" />
                          </span>
                        )}
                        {text.title && <span className="sr-only">{text.title}</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-[#55766F]/20 bg-white/40 p-6 text-sm text-[#303532]/65">{labels.galleryEmpty}</p>
              )}
            </article>

            <article id="what-people-say-preview" className="joko-about-curation-card min-w-0 rounded-3xl border border-[#55766F]/15 p-5 scroll-mt-24 sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-[#303532]" style={{ fontFamily: 'var(--joko-font-display)' }}>{labels.peopleSayTitle}</h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-[#303532]/67">{labels.peopleSayIntro}</p>
                </div>
                <button type="button" onClick={() => onNavigate('what-people-say')} className="inline-flex items-center gap-2 text-sm font-semibold text-[#A44F1D] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]">
                  {labels.peopleSayAction}<ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              {externalMentions.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {externalMentions.slice(0, 2).map((item) => (
                    <a key={item.id} href={item.source_url} target="_blank" rel="noopener noreferrer" className="group min-w-0 overflow-hidden rounded-2xl border border-[#8B765E]/12 bg-[#FFFDF7]/85 transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]">
                      {item.thumbnail_url && (
                        <div className="relative aspect-[16/7] overflow-hidden bg-[#E8E1D5]">
                          <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          {item.content_type === 'video' && <Play className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" fill="currentColor" aria-hidden="true" />}
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[.12em] text-[#55766F]">
                          <span>{item.source_type.replace('_', ' ')}</span>
                          {item.rating !== null && <span className="inline-flex items-center gap-1 text-[#A44F1D]"><Star className="h-3 w-3 fill-current" />{item.rating.toFixed(1)}</span>}
                        </div>
                        {item.excerpt ? <blockquote className="mt-2 line-clamp-3 text-xs leading-5 text-[#303532]/75">“{item.excerpt}”</blockquote> : <MessageSquareQuote className="mt-3 h-6 w-6 text-[#55766F]/55" />}
                        {item.author_name && <p className="mt-2 truncate text-xs font-medium text-[#303532]">{item.author_name}</p>}
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#A44F1D]">{labels.originalPost}<ArrowRight className="h-3 w-3" aria-hidden="true" /></span>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-[#55766F]/20 bg-white/40 p-6 text-sm text-[#303532]/65">{labels.peopleSayEmpty}</p>
              )}
            </article>
          </div>
        </Container>
      </section>

    </div>
  );
}

export default HomepageLowerSections;
