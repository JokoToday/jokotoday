import type { CSSProperties } from 'react';
import {
  ArrowRight,
  PlayCircle,
  MapPin,
  MousePointer2,
  CalendarCheck,
  ShoppingBasket,
} from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { Container } from '../../../platform/design-system';
import { JOKO_BAKERY_HERO_ASSET } from '../../../lib/staticAssetPolicy';
import type { NotebookRouteTarget } from '../../../platform/notebook';
import { localize } from '../../../platform/builder/renderer/localize';
import { localizeRichText } from '../../../platform/builder/richText';
import { HeroTypography } from '../../../platform/builder/HeroTypography';
import { resolveHeroLocaleStyle } from '../../../platform/builder/heroTypographyUtils';
import type { BuilderRichText, HomeHeroSection, HomeTopLikedSection } from '../../../platform/builder/contracts';
import { usePublishedJokoBranding } from '../builder/usePublishedJokoLogo';
import HomepageLowerSections from './HomepageLowerSections';
import { JokoHeroNotebookNote } from '../../../components/JokoHeroNotebookNote';
import { JokoIllustrationSlot } from '../../../components/JokoIllustrationSlot';
import '../shell/jokoNavPencil.css';

interface HomepageExperiencePageProps {
  onNavigate: (page: string) => void;
  /** Use the real public hero layout for Builder drafts; never fetch draft data. */
  previewHero?: HomeHeroSection;
  previewLocale?: 'en' | 'th' | 'zh';
  heroOnly?: boolean;
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
    kicker: 'Love for good things. Shared with everyone.',
    headline1: 'Selected Goods',
    headline2: 'for a',
    headlineAccent: 'Brighter',
    headline3: 'Today',
    intro: 'From our bakery, beyond it, and from makers we believe in.',
    products: 'Explore the Bakery',
    howItWorks: 'Explore JOKO',
    select: 'Select',
    preorder: 'Pre-Order',
    pickup: 'Pickup',
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
    howItWorks: 'สำรวจ JOKO',
    select: 'เลือก',
    preorder: 'สั่งล่วงหน้า',
    pickup: 'รับสินค้า',
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
    howItWorks: '探索 JOKO',
    select: '选择',
    preorder: '预订',
    pickup: '取货',
    bakeryAlt: 'JOKO Bakery 的水彩插画',
  },
} as const;

export function HomepageExperiencePage({
  onNavigate,
  previewHero,
  previewLocale,
  heroOnly = false,
}: HomepageExperiencePageProps) {
  const { language } = useLanguage();
  const { document: publishedHomepage } = usePublishedJokoBranding();
  const selectedLocale = previewLocale || language;
  const lang: LanguageCode = selectedLocale === 'th' || selectedLocale === 'zh' ? selectedLocale : 'en';
  const labels = copy[lang];
  const publishedHero = previewHero ?? publishedHomepage?.sections.find((section) => section.type === 'home.hero.v1');
  // Even unformatted Thai/Chinese headlines must use their saved plain text.
  const publishedTitleRichText = publishedHero?.type === 'home.hero.v1'
    ? localizeRichText(
        publishedHero.props.titleRichText,
        lang,
        'en',
        publishedHero.props.title[lang] ?? publishedHero.props.title.en ?? '',
      )
    : null;
  const heroIntro = publishedHero?.type === 'home.hero.v1'
    ? localize(publishedHero.props.subtitle, lang, 'en')
    : labels.intro;
  const eyebrow = publishedHero?.type === 'home.hero.v1'
    ? publishedHero.props.eyebrow?.[lang]?.trim() || labels.kicker
    : labels.kicker;
  const headlineFallback: BuilderRichText = lang === 'en'
    ? [
        { text: labels.headline1 + '\n' + labels.headline2 + '\n' },
        { text: labels.headlineAccent, marks: { color: 'accent', italic: true } },
        { text: ' ' + labels.headline3 },
      ]
    : [
        { text: labels.headline1 + '\n' + labels.headline2 + ' ' },
        { text: labels.headlineAccent, marks: { color: 'accent' } },
        ...(labels.headline3 ? [{ text: '\n' + labels.headline3 }] : []),
      ];
  // Upgrade only the previously published English default; retain later Admin edits.
  const legacyEnglishTitle = lang === 'en' && /^(Selected Goodness|Selected Goods[.]?)/.test(publishedTitleRichText?.map((run) => run.text).join('') ?? '');
  const previousEnglishTitle = lang === 'en' && publishedTitleRichText?.map((run) => run.text).join('') === 'Selected Goods.\nfor a\nBrighter Today';
  const titleRuns = legacyEnglishTitle || previousEnglishTitle ? headlineFallback : publishedTitleRichText ?? headlineFallback;
  const headlineLineStyles = (legacyEnglishTitle || previousEnglishTitle) ? [{ size: 54 }, { align: 'center' as const, size: 30 }, { size: 55 }] : publishedHero?.type === 'home.hero.v1'
    ? publishedHero.props.titleLineStyles?.[lang]
    : lang === 'en'
      ? [{}, { align: 'center' as const, size: 30 }, {}]
      : undefined;
  const heroJourneyLinks = publishedHero?.type === 'home.hero.v1'
    ? publishedHero.props.journeyLinks
    : undefined;
  const selectUrl = heroJourneyLinks?.selectUrl || '/products';
  const preorderUrl = heroJourneyLinks?.preorderUrl || '/how-it-works';
  const pickupUrl = heroJourneyLinks?.pickupUrl || '/how-it-works';
  const publishedSubtitleRuns = publishedHero?.type === 'home.hero.v1'
    ? localizeRichText(publishedHero.props.subtitleRichText, lang, 'en', heroIntro)
    : [{ text: heroIntro }];
  const subtitleRuns = lang === 'en' && ['We make it - We find it - We find the people who make it', 'Curated by JOKO — bakery favourites, special finds, and products from fellow makers worth knowing. Made for pre-order and easy pickup.'].includes(publishedSubtitleRuns.map((run) => run.text).join('').trim())
    ? [{ text: labels.intro }] : publishedSubtitleRuns;
  const useSplitEnglishSubtitle = lang === 'en' && subtitleRuns.map((run) => run.text).join('').trim() === 'From our bakery, beyond it, and from makers we believe in.';
  const heroPrimaryLabel = publishedHero?.type === 'home.hero.v1'
    ? localize(publishedHero.props.primaryActionLabel, lang, 'en')
    : labels.products;
  const savedSecondary = publishedHero?.type === 'home.hero.v1' ? localize(publishedHero.props.secondaryActionLabel, lang, 'en') : '';
  const heroSecondaryLabel = savedSecondary && !['How It Works', 'How it works', 'วิธีการสั่งซื้อ', '订购指南'].includes(savedSecondary) ? savedSecondary : labels.howItWorks;
  const heroMediaAlt = publishedHero?.type === 'home.hero.v1'
    ? localize(publishedHero.props.mediaAlt, lang, 'en')
    : labels.bakeryAlt;
  const configuredHeroNotebookNote = publishedHero?.type === 'home.hero.v1'
    ? publishedHero.props.notebookNote
    : undefined;
  const isBranchPreview = !previewHero && typeof window !== 'undefined'
    && window.location.hostname.endsWith('.jokotoday-preview.pages.dev');
  const heroNotebookNote = configuredHeroNotebookNote ?? (isBranchPreview
    ? {
        enabled: true,
        title: {
          en: 'Meet Joe & Phuttan',
          th: 'รู้จัก Joe และ Phuttan',
          zh: '认识 Joe 和 Phuttan',
        },
        body: {
          en: 'A little note from the bakery.',
          th: 'โน้ตเล็ก ๆ จากเบเกอรี่',
          zh: '来自烘焙坊的一张小纸条。',
        },
        imageUrl: '/assets/preview/joe-phuttan-faces.svg',
        imageAlt: {
          en: 'Joe and Phuttan',
          th: 'Joe และ Phuttan',
          zh: 'Joe 和 Phuttan',
        },
        linkUrl: '/about',
      }
    : undefined);
  const heroNotebookTitle = heroNotebookNote?.title
    ? localize(heroNotebookNote.title, lang, 'en')
    : '';
  const heroNotebookBody = heroNotebookNote?.body
    ? localize(heroNotebookNote.body, lang, 'en')
    : '';
  const heroNotebookImageAlt = heroNotebookNote?.imageAlt
    ? localize(heroNotebookNote.imageAlt, lang, 'en')
    : '';
  const showHeroNotebookNote = Boolean(
    heroNotebookNote?.enabled
    && (heroNotebookTitle || heroNotebookBody || heroNotebookNote.imageUrl),
  );
  const publishedTopLiked = publishedHomepage?.sections.find(
    (section): section is HomeTopLikedSection => section.type === 'home.top-liked.v1',
  );
  const showServices = () => {
    const section = window.document.getElementById('what-you-can-do');
    if (section) {
      if (window.location.pathname === '/') window.history.replaceState({ jokoHomepageSection: 'what-you-can-do' }, '', '/#what-you-can-do');
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const heroImage = publishedHero?.type === 'home.hero.v1' && publishedHero.props.heroImageUrl?.trim()
    ? publishedHero.props.heroImageUrl : BAKERY_HERO;

  const fullBleedHero = publishedHero?.type === 'home.hero.v1' && publishedHero.props.heroBackgroundMode === 'full-bleed';

  const desktopHeroMask = {
    WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,.08) 4%, rgba(0,0,0,.38) 10%, rgba(0,0,0,.78) 17%, #000 26%, #000 94%, rgba(0,0,0,.84) 97%, transparent 100%)',
    maskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,.08) 4%, rgba(0,0,0,.38) 10%, rgba(0,0,0,.78) 17%, #000 26%, #000 94%, rgba(0,0,0,.84) 97%, transparent 100%)',
  };

  return (
    <>
      <section className={`joko-mineral-field joko-bakery-hero-field pb-8 sm:pb-10 xl:pb-8 ${heroOnly && fullBleedHero ? 'joko-hero-draft-full-bleed' : ''}`}
        style={heroOnly && fullBleedHero ? ({
          '--joko-hero-desktop': `url("${heroImage.replaceAll('"', '%22')}")`,
          '--joko-hero-mobile': `url("${(publishedHero?.type === 'home.hero.v1' ? publishedHero.props.heroMobileImageUrl : undefined) || heroImage}")`,
          '--joko-hero-x': `${publishedHero?.type === 'home.hero.v1' ? publishedHero.props.heroFocusX ?? 65 : 65}%`,
          '--joko-hero-y': `${publishedHero?.type === 'home.hero.v1' ? publishedHero.props.heroFocusY ?? 40 : 40}%`,
          '--joko-hero-mobile-x': `${publishedHero?.type === 'home.hero.v1' ? publishedHero.props.heroMobileFocusX ?? 50 : 50}%`,
          '--joko-hero-mobile-y': `${publishedHero?.type === 'home.hero.v1' ? publishedHero.props.heroMobileFocusY ?? 45 : 45}%`,
          '--joko-hero-text-opacity': (publishedHero?.type === 'home.hero.v1' ? publishedHero.props.heroTextOverlay ?? 85 : 85) / 100,
        } as CSSProperties) : undefined}>
        <Container width="wide">
          <div className="joko-bakery-hero-stage relative xl:min-h-[39rem] 2xl:min-h-[43rem]">
            {showHeroNotebookNote && (
              <div
                className="absolute right-4 top-5 z-30 hidden w-[14.5rem] xl:block 2xl:right-7 2xl:top-7 2xl:w-[15.5rem]"
              >
                <JokoHeroNotebookNote
                  title={heroNotebookTitle}
                  body={heroNotebookBody}
                  imageUrl={heroNotebookNote?.imageUrl}
                  imageAlt={heroNotebookImageAlt}
                  href={heroNotebookNote?.linkUrl}
                  fontPreset={heroNotebookNote?.fontPreset}
                  headingSize={heroNotebookNote?.headingSize}
                  bodySize={heroNotebookNote?.bodySize}
                />
              </div>
            )}

            <div
              className={`joko-bakery-scene-layer pointer-events-none absolute hidden ${fullBleedHero ? '!hidden' : 'xl:block'}`}
              style={{ left: '34%' }}
            >
              <img
                src={heroImage}
                alt={heroMediaAlt}
                className="joko-bakery-hero-image h-full w-full object-cover"
                style={desktopHeroMask}
                decoding="async"
                loading="eager"
              />
            </div>

            <div className="relative z-20 grid gap-7 xl:grid-cols-[minmax(34rem,.95fr)_minmax(34rem,1.05fr)] xl:items-start xl:gap-6">
              <div className="relative max-w-[36rem] xl:pt-10 2xl:pt-12">
                <HeroTypography
                  as="p" kind="eyebrow" value={[{ text: eyebrow }]}
                  style={publishedHero?.type === 'home.hero.v1' ? publishedHero.props.eyebrowStyle : undefined}
                  className="tracking-[0.15em]"
                />

                <HeroTypography
                  as="h1" kind="headline" value={titleRuns}
                  style={publishedHero?.type === 'home.hero.v1'
                    ? resolveHeroLocaleStyle(publishedHero.props.titleStyle, publishedHero.props.titleLocaleStyles, lang)
                    : undefined}
                  lineStyles={headlineLineStyles}
                  fontFamilyOverride={lang === 'en' ? 'Nunito Sans, var(--joko-font-display)' : undefined}
                  fontWeightOverride={lang === 'en' ? 600 : undefined}
                  className={lang === 'en' ? 'mt-4 w-full leading-[.96] tracking-[-0.025em] joko-hero-nunito-headline' : 'mt-4 leading-[.92] tracking-[-0.042em]'}
                />
                <span className="joko-hero-pencil-underline mt-2" aria-hidden="true" />

                {useSplitEnglishSubtitle ? (
                  <p className="mt-5 text-[16px] font-bold tracking-[0.15em] leading-6 text-[#303532]/80 max-w-none" style={{ fontFamily: 'var(--joko-font-body)' }}>
                    <span className="sm:block sm:whitespace-nowrap">From our bakery, beyond it,</span>{' '}
                    <span className="sm:block sm:whitespace-nowrap">and from makers we believe in.</span>
                  </p>
                ) : (
                <HeroTypography as="p" kind="subtitle" value={subtitleRuns}
                  style={publishedHero?.type === 'home.hero.v1'
                    ? resolveHeroLocaleStyle(publishedHero.props.subtitleStyle, publishedHero.props.subtitleLocaleStyles, lang)
                    : undefined}
                  fontFamilyOverride={lang === 'en' ? 'var(--joko-font-body)' : undefined}
                  fontWeightOverride={lang === 'en' ? 700 : undefined}
                  fontSizeOverride={lang === 'en' ? '16px' : undefined}
                  className={lang === 'en' ? 'mt-5 max-w-[29rem] tracking-[0.15em] leading-6' : 'mt-5 max-w-[29rem] leading-7'}
                />
                )}

                <div className="mt-7 xl:mt-8">
                  <div className="flex items-start gap-0">
                    <JokoIllustrationSlot
                      pageKey="home"
                      placementKey="hero-primary-cta"
                      className="z-30 -mr-2 hidden self-start xl:block 2xl:-mr-3"
                    />

                    <div className="relative z-20 mt-10 min-w-0 flex-1 2xl:mt-11">
                      <div className="flex w-full max-w-[18rem] flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => onNavigate('products-bakery')}
                          className="joko-shell-primary-button inline-flex min-h-12 items-center justify-center rounded-2xl px-6 py-3.5 font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#55766F] focus:ring-offset-2 focus:ring-offset-[#D9ECE9]" style={{ fontSize: 'var(--joko-size-button, 16px)' }}
                        >
                          <ShoppingBasket className="mr-3 h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                          {heroPrimaryLabel}
                          <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={showServices}
                          className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#303532]/70 bg-[#F4EFE5]/72 px-6 py-3 font-semibold text-[#303532] transition hover:bg-[#F4EFE5] focus:outline-none focus:ring-2 focus:ring-[#55766F]" style={{ fontSize: 'var(--joko-size-button, 16px)' }}
                        >
                          <PlayCircle className="mr-3 h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
                          {heroSecondaryLabel}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#55766F]/15 pt-4 text-left text-[10px] leading-4 text-[#304B45]/82 sm:text-xs">
                    <a
                      href={selectUrl}
                      className="flex items-center gap-2 rounded-lg border-r border-[#55766F]/14 px-1 py-1 transition hover:bg-white/20 hover:text-[#303532] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
                    >
                      <MousePointer2 className="h-6 w-6 text-[#6E9A4F]" strokeWidth={1.45} aria-hidden="true" />
                      <span>{labels.select}</span>
                    </a>
                    <a
                      href={preorderUrl}
                      className="flex items-center gap-2 rounded-lg border-r border-[#55766F]/14 px-1 py-1 transition hover:bg-white/20 hover:text-[#303532] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
                    >
                      <CalendarCheck className="h-6 w-6 text-[#668C4E]" strokeWidth={1.45} aria-hidden="true" />
                      <span>{labels.preorder}</span>
                    </a>
                    <a
                      href={pickupUrl}
                      className="flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-white/20 hover:text-[#303532] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"
                    >
                      <MapPin className="h-6 w-6 text-[#C76624]" strokeWidth={1.45} aria-hidden="true" />
                      <span>{labels.pickup}</span>
                    </a>
                  </div>
                </div>

                {showHeroNotebookNote && (
                  <div className="mt-7 max-w-[19rem] xl:hidden">
                    <JokoHeroNotebookNote
                      title={heroNotebookTitle}
                      body={heroNotebookBody}
                      imageUrl={heroNotebookNote?.imageUrl}
                      imageAlt={heroNotebookImageAlt}
                      href={heroNotebookNote?.linkUrl}
                      fontPreset={heroNotebookNote?.fontPreset}
                      headingSize={heroNotebookNote?.headingSize}
                      bodySize={heroNotebookNote?.bodySize}
                    />
                  </div>
                )}

              </div>

              <div className="relative min-w-0 xl:min-h-[40rem] 2xl:min-h-[44rem]">
                <div className={`relative mx-auto mt-1 max-w-[52rem] xl:hidden ${fullBleedHero ? '!hidden' : ''}`}>
                  <img
                    src={heroImage}
                    alt={heroMediaAlt}
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
      {!heroOnly && <HomepageLowerSections
        locale={lang}
        onNavigate={onNavigate}
        publishedTopLiked={publishedTopLiked}
      />}
    </>
  );
}

export default HomepageExperiencePage;
