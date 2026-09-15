import {
  ArrowRight,
  BookOpen,
  PlayCircle,
  Coffee,
  Flower2,
  Heart,
  Leaf,
  MapPin,
  ShoppingBasket,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { useNotebookContent } from '../../../hooks/useNotebookContent';
import { Container } from '../../../platform/design-system';
import type { NotebookRouteTarget } from '../../../platform/notebook';
import NotebookExperienceReader from '../notebook/NotebookExperienceReader';
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

const BAKERY_HERO = '/assets/home-experience/joko-bakery-full-v2.webp';

const copy = {
  en: {
    kicker: 'Artisan bakery • Local stories • A kinder day',
    headline1: 'Good bread',
    headline2: 'for a',
    headlineAccent: 'brighter',
    headline3: 'tomorrow.',
    intro: 'Naturally leavened. Thoughtfully baked. Pre-order online and pick up at our locations across town.',
    products: 'Explore the Bakery',
    howItWorks: 'How it works',
    realIngredients: 'Real ingredients',
    preorderPickup: 'Pre-order & pick up',
    strongerCommunity: 'A stronger local community',
    noteLeft: 'More than bread. A kinder everyday.',
    noteTop: 'Good bread. Brighter days.',
    noteRight: 'Same table. New stories.',
    notebookEyebrow: 'Life is worth noticing.',
    notebookTitle1: 'Curiosity',
    notebookTitle2: 'Notebook',
    notebookIntro: 'Questions, people, places and the little things worth wondering about.',
    notebookNote: 'Read. Wonder. Be kinder.',
    notebookOpen: 'Open Curiosity Notebook',
    bakeryAlt: 'Watercolor illustration of JOKO Bakery.',
  },
  th: {
    kicker: 'เบเกอรี่ทำมือ • เรื่องราวใกล้ตัว • วันที่อ่อนโยนกว่า',
    headline1: 'ขนมปังดี ๆ',
    headline2: 'เพื่อวันพรุ่งนี้',
    headlineAccent: 'ที่สดใสกว่า',
    headline3: '',
    intro: 'หมักตามธรรมชาติ อบอย่างตั้งใจ สั่งล่วงหน้าออนไลน์ แล้วมารับของสดใหม่ได้ที่จุดรับของของเรา',
    products: 'สำรวจเบเกอรี่',
    howItWorks: 'วิธีสั่งซื้อ',
    realIngredients: 'วัตถุดิบจริง',
    preorderPickup: 'สั่งล่วงหน้าและรับของ',
    strongerCommunity: 'ชุมชนท้องถิ่นที่แข็งแรงขึ้น',
    noteLeft: 'มากกว่าขนมปัง ทุกวันอ่อนโยนขึ้นอีกนิด',
    noteTop: 'ขนมปังดี ๆ วันที่สดใสกว่า',
    noteRight: 'โต๊ะเดิม เรื่องใหม่',
    notebookEyebrow: 'ชีวิตมีเรื่องให้สังเกตเสมอ',
    notebookTitle1: 'Curiosity',
    notebookTitle2: 'Notebook',
    notebookIntro: 'คำถาม ผู้คน สถานที่ และเรื่องเล็ก ๆ ที่ชวนให้เราอยากรู้มากขึ้น',
    notebookNote: 'อ่าน สงสัย และใจดีกว่าเดิม',
    notebookOpen: 'เปิด Curiosity Notebook',
    bakeryAlt: 'ภาพสีน้ำของ JOKO Bakery',
  },
  zh: {
    kicker: '手作烘焙 • 身边故事 • 更温柔的一天',
    headline1: '好面包',
    headline2: '为了一个',
    headlineAccent: '更明亮的',
    headline3: '明天。',
    intro: '自然发酵，用心烘焙。线上预订，到我们的取货点领取新鲜出炉的面包。',
    products: '探索烘焙坊',
    howItWorks: '如何订购',
    realIngredients: '真实食材',
    preorderPickup: '预订并取货',
    strongerCommunity: '更紧密的本地社区',
    noteLeft: '不只是面包，也让每一天更温柔。',
    noteTop: '好面包，更明亮的日子。',
    noteRight: '同一张桌子，新的故事。',
    notebookEyebrow: '生活值得被留意。',
    notebookTitle1: 'Curiosity',
    notebookTitle2: 'Notebook',
    notebookIntro: '问题、人物、地点，以及那些值得继续好奇的小事。',
    notebookNote: '阅读。好奇。更温柔。',
    notebookOpen: '打开 Curiosity Notebook',
    bakeryAlt: 'JOKO Bakery 的水彩插画',
  },
} as const;

export function HomepageExperiencePage({
  onNavigate,
  notebookTarget = { type: 'notebook.collection', slug: 'today' },
  notebookClosed = false,
  onNotebookNavigate,
  onNotebookBack,
  onNotebookClose,
  onNotebookOpen,
}: HomepageExperiencePageProps) {
  const { language } = useLanguage();
  const lang: LanguageCode = language === 'th' || language === 'zh' ? language : 'en';
  const labels = copy[lang];
  const notebookContent = useNotebookContent();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [notebookOpen, setNotebookOpen] = useState(() => window.location.pathname.startsWith('/notebook/'));

  useEffect(() => {
    const notebookRouteIsOpen = window.location.pathname.startsWith('/notebook/');
    setNotebookOpen(notebookRouteIsOpen && !notebookClosed);
  }, [notebookClosed, notebookTarget]);

  useEffect(() => {
    if (!notebookOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setNotebookOpen(false);
      onNotebookClose?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [notebookOpen, onNotebookClose]);

  const openNotebook = () => {
    setNotebookOpen(true);
    onNotebookOpen?.();
    onNotebookNavigate?.({ type: 'notebook.collection', slug: 'today' });
  };

  const closeNotebook = () => {
    setNotebookOpen(false);
    onNotebookClose?.();
  };

  const showHowItWorks = () => {
    const section = window.document.getElementById('how-it-works');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    onNavigate('how-it-works');
  };

  const heroSerif = lang === 'en' ? { fontFamily: 'var(--joko-font-display)' } : undefined;
  const notebookFont = { fontFamily: 'var(--joko-font-notebook)' };

  const floatingNotebook = notebookOpen && typeof document !== 'undefined'
    ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 lg:p-7">
          <button
            type="button"
            aria-label={labels.notebookOpen}
            onClick={closeNotebook}
            className="absolute inset-0 cursor-default bg-[#294B45]/15 backdrop-blur-[2px]"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={labels.notebookOpen}
            tabIndex={-1}
            className="joko-floating-notebook relative z-10 max-h-[calc(100vh-1rem)] w-full max-w-[78rem] overflow-auto rounded-[2.2rem] outline-none sm:max-h-[calc(100vh-2rem)]"
          >
            <NotebookExperienceReader
              target={notebookTarget}
              closed={false}
              onNavigate={onNotebookNavigate ?? (() => undefined)}
              onBack={onNotebookBack ?? (() => undefined)}
              onClose={closeNotebook}
              onOpen={openNotebook}
              content={notebookContent}
              onCommerceNavigate={onNavigate}
            />
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <section className="joko-mineral-field joko-bakery-hero-field border-b border-[#55766F]/14 pb-8 pt-2 sm:pb-10 sm:pt-3 xl:pb-8">
        <Container width="wide">
          <div className="joko-bakery-hero-stage relative xl:min-h-[39rem] 2xl:min-h-[43rem]">
            <div className="joko-bakery-scene-layer pointer-events-none absolute hidden xl:block" aria-hidden="true">
              <img
                src={BAKERY_HERO}
                alt=""
                className="joko-bakery-hero-image h-full w-full object-cover"
                decoding="async"
                loading="eager"
              />
            </div>

            <div className="relative z-20 grid gap-7 xl:grid-cols-[minmax(18rem,.94fr)_minmax(31rem,1.62fr)_minmax(13.5rem,.48fr)] xl:items-start xl:gap-4">
              <div className="relative max-w-[27rem] xl:pt-7 2xl:pt-9">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#3F665E] sm:text-[11px]">
                  {labels.kicker}
                </p>

                <h1
                  className="mt-4 text-[2.75rem] font-bold leading-[.93] tracking-[-0.04em] text-[#292D2B] sm:text-[3.35rem] lg:text-[3.65rem] xl:text-[3.55rem] 2xl:text-[3.9rem]"
                  style={heroSerif}
                >
                  <span className="block">{labels.headline1}</span>
                  <span className="block">
                    {labels.headline2}{' '}
                    <span className="text-[#C85F22]">{labels.headlineAccent}</span>
                  </span>
                  {labels.headline3 && <span className="block">{labels.headline3}</span>}
                </h1>
                <span className="mt-3 block h-[3px] w-[78%] max-w-[20rem] -rotate-1 rounded-full bg-[#D98242]/75" aria-hidden="true" />

                <p className="mt-5 max-w-[27rem] text-[15px] leading-7 text-[#303532]/78 sm:text-base">
                  {labels.intro}
                </p>

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('products')}
                    className="joko-shell-primary-button inline-flex min-h-12 items-center justify-center rounded-2xl px-6 py-3.5 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#55766F] focus:ring-offset-2 focus:ring-offset-[#D9ECE9]"
                  >
                    <ShoppingBasket className="mr-3 h-5 w-5" strokeWidth={1.7} aria-hidden="true" />
                    {labels.products}
                    <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={showHowItWorks}
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#303532]/70 bg-[#F4EFE5]/72 px-6 py-3 text-base font-semibold text-[#303532] transition hover:bg-[#F4EFE5] focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                  >
                    <PlayCircle className="mr-3 h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
                    {labels.howItWorks}
                  </button>
                </div>

                <div className="mt-7 grid grid-cols-3 gap-1 border-t border-[#55766F]/15 pt-5 text-center text-[10px] leading-4 text-[#304B45]/82 sm:text-xs">
                  <div className="flex flex-col items-center gap-2 border-r border-[#55766F]/14 px-1">
                    <Leaf className="h-6 w-6 text-[#6E9A4F]" strokeWidth={1.45} aria-hidden="true" />
                    <span>{labels.realIngredients}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 border-r border-[#55766F]/14 px-1">
                    <MapPin className="h-6 w-6 text-[#668C4E]" strokeWidth={1.45} aria-hidden="true" />
                    <span>{labels.preorderPickup}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 px-1">
                    <Heart className="h-6 w-6 text-[#C76624]" strokeWidth={1.45} aria-hidden="true" />
                    <span>{labels.strongerCommunity}</span>
                  </div>
                </div>

                <p
                  className="mt-6 hidden max-w-[15rem] -rotate-3 text-sm italic leading-5 text-[#48756D]/72 sm:block"
                  style={{ fontFamily: 'var(--joko-font-notebook)' }}
                >
                  {labels.noteLeft}
                </p>
              </div>

              <div className="relative min-w-0 xl:min-h-[37rem]" aria-hidden="true">
                <div className="relative mx-auto mt-1 max-w-[48rem] xl:hidden">
                  <img
                    src={BAKERY_HERO}
                    alt={labels.bakeryAlt}
                    className="joko-bakery-hero-image-mobile mx-auto w-full object-contain"
                    decoding="async"
                    loading="eager"
                  />
                </div>
              </div>

              <aside className="relative mx-auto w-full max-w-[16.4rem] xl:mt-16 xl:self-start xl:justify-self-end 2xl:mt-[4.6rem]">
                <p
                  className="absolute -top-16 right-0 hidden max-w-32 -rotate-6 text-base italic leading-5 text-[#47736B]/78 2xl:block"
                  style={{ fontFamily: 'var(--joko-font-notebook)' }}
                >
                  {labels.noteTop}
                </p>

                <button
                  type="button"
                  onClick={openNotebook}
                  aria-haspopup="dialog"
                  className="joko-notebook-cover group relative block min-h-[22.5rem] w-full text-left focus:outline-none focus:ring-2 focus:ring-[#55766F] focus:ring-offset-4 focus:ring-offset-[#D9ECE9]"
                >
                  <span className="joko-notebook-page-stack absolute inset-[10px_-9px_-11px_10px]" aria-hidden="true" />
                  <span className="joko-notebook-page-stack joko-notebook-page-stack--middle absolute inset-[5px_-5px_-6px_5px]" aria-hidden="true" />
                  <span className="joko-notebook-paper absolute inset-0" aria-hidden="true" />
                  <span className="joko-notebook-spine absolute bottom-5 left-[.72rem] top-5" aria-hidden="true" />

                  {[13, 26, 39, 52, 65, 78].map((top) => (
                    <span
                      key={top}
                      className="joko-notebook-ring absolute -left-3 z-30"
                      style={{ top: `${top}%` }}
                      aria-hidden="true"
                    />
                  ))}

                  <span className="relative z-20 flex min-h-[22.5rem] flex-col px-6 pb-5 pl-8 pt-7" style={notebookFont}>
                    <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#7A5B3D]">
                      {labels.notebookEyebrow}
                    </span>
                    <span className="mt-4 flex items-start justify-between gap-3 text-[2rem] font-medium leading-[.97] tracking-[-0.015em] text-[#292D2B]">
                      <span>
                        <span className="block">{labels.notebookTitle1}</span>
                        <span className="block">{labels.notebookTitle2}</span>
                      </span>
                      <ArrowRight className="mt-3 h-5 w-5 shrink-0 text-[#7A3D1B] transition group-hover:translate-x-1" aria-hidden="true" />
                    </span>

                    <span className="mt-5 block text-[14px] leading-[1.42] text-[#303532]/72">
                      {labels.notebookIntro}
                    </span>

                    <span className="mt-6 block -rotate-3 text-[15px] leading-5 text-[#4E7770]/80">
                      {labels.notebookNote}
                    </span>

                    <span className="relative mt-auto block h-[5.4rem]" aria-hidden="true">
                      <BookOpen className="absolute bottom-1 right-1 h-12 w-12 rotate-[-8deg] text-[#816B56]/48" strokeWidth={1.05} />
                      <Coffee className="absolute bottom-[1.1rem] right-[2.65rem] h-9 w-9 text-[#76583F]/72" strokeWidth={1.25} />
                      <Flower2 className="absolute bottom-[2.35rem] right-[-.15rem] h-10 w-10 rotate-6 text-[#68856B]/62" strokeWidth={1.1} />
                      <Leaf className="absolute -bottom-4 -right-7 h-14 w-14 rotate-[20deg] text-[#6D896F]/46" strokeWidth={1.0} />
                      <Leaf className="absolute bottom-[2.3rem] -right-9 h-11 w-11 rotate-[-18deg] text-[#6D896F]/38" strokeWidth={1.0} />
                    </span>
                  </span>
                </button>

                <p
                  className="mt-5 hidden max-w-28 -rotate-3 text-right text-sm italic leading-5 text-[#47736B]/72 2xl:ml-auto 2xl:block"
                  style={{ fontFamily: 'var(--joko-font-notebook)' }}
                >
                  {labels.noteRight}
                </p>
              </aside>
            </div>
          </div>
        </Container>
      </section>

      <HomepageLowerSections
        locale={lang}
        onNavigate={onNavigate}
        bundle={notebookContent.bundle}
        featuredProductImageUrl={notebookContent.featuredProductImageUrl}
        onNotebookNavigate={onNotebookNavigate}
      />

      {floatingNotebook}
    </>
  );
}

export default HomepageExperiencePage;
