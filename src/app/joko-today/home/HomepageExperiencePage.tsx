import {
  ArrowRight,
  PlayCircle,
  Heart,
  Leaf,
  MapPin,
  ShoppingBasket,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { Container } from '../../../platform/design-system';
import { JOKO_BAKERY_HERO_ASSET } from '../../../lib/staticAssetPolicy';
import type { NotebookRouteTarget } from '../../../platform/notebook';
import HomepageLowerSections from './HomepageLowerSections';

interface HomepageExperiencePageProps {
  onNavigate: (page: string) => void;
  notebookTarget?: NotebookRouteTarget;
  notebookClosed?: boolean;
  onNotebookNavigate?: (target: NotebookRouteTarget) => void;
  onNotebookBack?: () => void;
  onNotebookClose?: () => void;
  onNotebookOpen?: () => void;
}

type LanguageCode = 'en' | 'th' | 'zh';

const BAKERY_HERO = JOKO_BAKERY_HERO_ASSET;

const copy = {
  en: {
    kicker: 'Artisan bakery • Local stories • A kinder day',
    headline1: 'Good bread',
    headline2: 'for a',
    headlineAccent: 'brighter',
    headline3: 'tomorrow.',
    intro: 'Thoughtfully baked in small batches. Pre-order online and pick up fresh at our JOKO locations.',
    products: 'Explore the Bakery',
    howItWorks: 'How it works',
    realIngredients: 'Real ingredients',
    preorderPickup: 'Small batches',
    strongerCommunity: 'A kinder tomorrow',
    bakeryAlt: 'Watercolor illustration of JOKO Bakery.',
  },
  th: {
    kicker: 'เบเกอรี่ทำมือ • เรื่องราวใกล้ตัว • วันที่อ่อนโยนกว่า',
    headline1: 'ขนมปังดี ๆ',
    headline2: 'เพื่อวันพรุ่งนี้',
    headlineAccent: 'ที่สดใสกว่า',
    headline3: '',
    intro: 'อบอย่างตั้งใจเป็นล็อตเล็ก ๆ สั่งล่วงหน้าออนไลน์ แล้วมารับของสดใหม่ได้ที่จุดรับของ JOKO',
    products: 'สำรวจเบเกอรี่',
    howItWorks: 'วิธีสั่งซื้อ',
    realIngredients: 'วัตถุดิบจริง',
    preorderPickup: 'อบล็อตเล็ก',
    strongerCommunity: 'พรุ่งนี้ที่อ่อนโยนกว่า',
    bakeryAlt: 'ภาพสีน้ำของ JOKO Bakery',
  },
  zh: {
    kicker: '手作烘焙 • 身边故事 • 更温柔的一天',
    headline1: '好面包',
    headline2: '为了一个',
    headlineAccent: '更明亮的',
    headline3: '明天。',
    intro: '小批量用心烘焙。线上预订，到 JOKO 取货点领取新鲜出炉的面包。',
    products: '探索烘焙坊',
    howItWorks: '如何订购',
    realIngredients: '真实食材',
    preorderPickup: '小批量烘焙',
    strongerCommunity: '更温柔的明天',
    bakeryAlt: 'JOKO Bakery 的水彩插画',
  },
} as const;

export function HomepageExperiencePage({ onNavigate }: HomepageExperiencePageProps) {
  const { language } = useLanguage();
  const lang: LanguageCode = language === 'th' || language === 'zh' ? language : 'en';
  const labels = copy[lang];
  const showHowItWorks = () => {
    const section = window.document.getElementById('how-it-works');
    if (section) {
      const targetPath = '/#how-it-works';
      const currentPath = `${window.location.pathname}${window.location.hash}`;
      if (window.location.pathname === '/' && currentPath !== targetPath) {
        window.history.pushState({ jokoHomepageSection: 'how-it-works' }, '', targetPath);
      }
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    onNavigate('how-it-works');
  };

  const heroTitleStyle = {
    fontFamily: lang === 'en' ? 'var(--joko-font-display)' : undefined,
    fontSize: 'clamp(2.9rem, 5vw, var(--joko-size-hero))',
  };
  const desktopHeroMask = {
    WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,.08) 4%, rgba(0,0,0,.38) 10%, rgba(0,0,0,.78) 17%, #000 26%, #000 94%, rgba(0,0,0,.84) 97%, transparent 100%)',
    maskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,.08) 4%, rgba(0,0,0,.38) 10%, rgba(0,0,0,.78) 17%, #000 26%, #000 94%, rgba(0,0,0,.84) 97%, transparent 100%)',
  };

  return (
    <>
      <section className="joko-mineral-field joko-bakery-hero-field pb-8 pt-2 sm:pb-10 sm:pt-3 xl:pb-8">
        <Container width="wide">
          <div className="joko-bakery-hero-stage relative xl:min-h-[39rem] 2xl:min-h-[43rem]">
            <div
              className="joko-bakery-scene-layer pointer-events-none absolute hidden xl:block"
              style={{ left: '22%' }}
            >
              <img
                src={BAKERY_HERO}
                alt={labels.bakeryAlt}
                className="joko-bakery-hero-image h-full w-full object-cover"
                style={desktopHeroMask}
                decoding="async"
                loading="eager"
              />
            </div>

            <div className="relative z-20 grid gap-7 xl:grid-cols-[minmax(21rem,.72fr)_minmax(39rem,1.48fr)] xl:items-start xl:gap-4">
              <div className="relative max-w-[31rem] xl:pt-10 2xl:pt-12">
                <p
                  className="font-semibold uppercase tracking-[0.25em] text-[#3F665E]"
                  style={{ fontSize: 'var(--joko-size-label)' }}
                >
                  {labels.kicker}
                </p>

                <h1
                  className="mt-4 font-bold leading-[.92] tracking-[-0.042em]"
                  style={{
                    ...heroTitleStyle,
                    color: 'rgb(var(--joko-shell-ink))',
                  }}
                >
                  <span className="block">{labels.headline1}</span>
                  <span className="block">
                    {labels.headline2}{' '}
                    <span style={{ color: 'rgb(var(--joko-shell-orange))' }}>{labels.headlineAccent}</span>
                  </span>
                  {labels.headline3 && <span className="block">{labels.headline3}</span>}
                </h1>
                <span className="mt-3 block h-[3px] w-[82%] max-w-[22rem] -rotate-1 rounded-full bg-[#D98242]/75" aria-hidden="true" />

                <p
                  className="mt-5 max-w-[29rem] leading-7"
                  style={{
                    fontSize: 'var(--joko-size-body)',
                    color: 'rgb(var(--joko-shell-ink) / 0.78)',
                  }}
                >
                  {labels.intro}
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('products')}
                    className="joko-shell-primary-button inline-flex min-h-12 items-center justify-center rounded-2xl px-6 py-3.5 font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#55766F] focus:ring-offset-2 focus:ring-offset-[#D9ECE9]"
                    style={{ fontSize: 'var(--joko-size-button)' }}
                  >
                    <ShoppingBasket className="mr-3 h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                    {labels.products}
                    <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={showHowItWorks}
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#303532]/70 bg-[#F4EFE5]/72 px-6 py-3 font-semibold text-[#303532] transition hover:bg-[#F4EFE5] focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                    style={{ fontSize: 'var(--joko-size-button)' }}
                  >
                    <PlayCircle className="mr-3 h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
                    {labels.howItWorks}
                  </button>
                </div>

                <div
                  className="mt-8 grid grid-cols-3 gap-3 border-t border-[#55766F]/15 pt-5 text-left leading-4 text-[#304B45]/82"
                  style={{ fontSize: 'var(--joko-size-label)' }}
                >
                  <div className="flex items-center gap-2 border-r border-[#55766F]/14 px-1">
                    <Leaf className="h-6 w-6 text-[#6E9A4F]" strokeWidth={1.45} aria-hidden="true" />
                    <span>{labels.realIngredients}</span>
                  </div>
                  <div className="flex items-center gap-2 border-r border-[#55766F]/14 px-1">
                    <MapPin className="h-6 w-6 text-[#668C4E]" strokeWidth={1.45} aria-hidden="true" />
                    <span>{labels.preorderPickup}</span>
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <Heart className="h-6 w-6 text-[#C76624]" strokeWidth={1.45} aria-hidden="true" />
                    <span>{labels.strongerCommunity}</span>
                  </div>
                </div>

              </div>

              <div className="relative min-w-0 xl:min-h-[40rem] 2xl:min-h-[44rem]">
                <div className="relative mx-auto mt-1 max-w-[52rem] xl:hidden">
                  <img
                    src={BAKERY_HERO}
                    alt={labels.bakeryAlt}
                    className="joko-bakery-hero-image-mobile mx-auto w-full object-contain"
                    decoding="async"
                    loading="eager"
                  />
                </div>
              </div>

            </div>
          </div>
        </Container>
      </section>
      <HomepageLowerSections
        locale={lang}
        onNavigate={onNavigate}
      />
    </>
  );
}

export default HomepageExperiencePage;
