import { ArrowRight, BookOpen, Leaf, MapPin, PackageCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useNotebookContent } from '../../../hooks/useNotebookContent';
import { getImageUrl } from '../../../lib/cmsService';
import { Container } from '../../../platform/design-system';
import {
  getNotebookLocalizedText,
  type NotebookRouteTarget,
} from '../../../platform/notebook';
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

const DEFAULT_BAKERY_HERO = 'https://xvhualoeboobulwgmkla.supabase.co/storage/v1/object/public/assets/hero/joko-bakery-hero.png';

const copy = {
  en: {
    kicker: 'Slow bread. Brighter days.',
    line1: 'More than',
    line2: 'bread.',
    line3: 'A kinder',
    line4: 'tomorrow.',
    intro: 'Artisan sourdough and homemade bakes, made in small batches for our community. Pre-order online and pick up fresh on weekends at JOKO Bakery.',
    products: 'See products',
    howItWorks: 'How it works',
    smallBatches: 'Small batches',
    naturalIngredients: 'Natural ingredients',
    weekendPickup: 'Weekend pickup',
    noteLeft: 'Real ingredients. Kinder tomorrows.',
    noteCenter: 'A small bakery for a brighter tomorrow.',
    noteRight: 'Same table. New stories.',
    notebookEyebrow: 'Life is worth noticing.',
    notebookTitle1: 'Curiosity',
    notebookTitle2: 'Notebook',
    notebookIntro: 'Questions, people, places and little wonders from all of us. Read a page. Follow a curiosity.',
    jokomi: 'Jokomi looks after it.',
    jokomiAlt: 'Jokomi quietly reading a notebook.',
    todayPage: "Today’s page",
    openNotebook: 'Open notebook',
    bakeryAlt: 'Watercolor illustration of JOKO Bakery.',
  },
  th: {
    kicker: 'ขนมปังช้า ๆ วันที่สดใสกว่า',
    line1: 'มากกว่า',
    line2: 'ขนมปัง',
    line3: 'เพื่อวันพรุ่งนี้',
    line4: 'ที่อ่อนโยนกว่า',
    intro: 'ซาวร์โดว์และขนมโฮมเมด อบเป็นล็อตเล็ก ๆ สำหรับชุมชนของเรา สั่งล่วงหน้าออนไลน์ แล้วมารับของสดใหม่ช่วงสุดสัปดาห์ที่ JOKO Bakery',
    products: 'ดูสินค้า',
    howItWorks: 'วิธีสั่งซื้อ',
    smallBatches: 'อบเป็นล็อตเล็ก',
    naturalIngredients: 'วัตถุดิบธรรมชาติ',
    weekendPickup: 'รับของสุดสัปดาห์',
    noteLeft: 'วัตถุดิบจริง วันพรุ่งนี้ที่อ่อนโยนกว่า',
    noteCenter: 'เบเกอรี่เล็ก ๆ เพื่อวันพรุ่งนี้ที่สดใสกว่า',
    noteRight: 'โต๊ะเดิม เรื่องใหม่',
    notebookEyebrow: 'ชีวิตมีเรื่องให้สังเกตเสมอ',
    notebookTitle1: 'Curiosity',
    notebookTitle2: 'Notebook',
    notebookIntro: 'คำถาม ผู้คน สถานที่ และเรื่องเล็ก ๆ ที่น่าสงสัยจากพวกเราทุกคน เปิดอ่านสักหน้า แล้วตามความสงสัยต่อไป',
    jokomi: 'Jokomi คอยดูแลสมุดเล่มนี้',
    jokomiAlt: 'Jokomi กำลังอ่านสมุดบันทึกอย่างเงียบ ๆ',
    todayPage: 'หน้าวันนี้',
    openNotebook: 'เปิดสมุด',
    bakeryAlt: 'ภาพสีน้ำของ JOKO Bakery',
  },
  zh: {
    kicker: '慢慢做面包，让日子更明亮。',
    line1: '不只是',
    line2: '面包。',
    line3: '也为了',
    line4: '更温柔的明天。',
    intro: '手作酸种与家庭烘焙，小批量为我们的社区制作。线上预订，周末到 JOKO Bakery 新鲜取货。',
    products: '查看产品',
    howItWorks: '如何订购',
    smallBatches: '小批量制作',
    naturalIngredients: '天然食材',
    weekendPickup: '周末取货',
    noteLeft: '真实食材，更温柔的明天。',
    noteCenter: '一家小小的烘焙坊，为了更明亮的明天。',
    noteRight: '同一张桌子，新的故事。',
    notebookEyebrow: '生活值得被留意。',
    notebookTitle1: 'Curiosity',
    notebookTitle2: 'Notebook',
    notebookIntro: '来自大家的问题、人物、地点，以及值得好奇的小事。读一页，再跟着一个好奇心走下去。',
    jokomi: 'Jokomi 静静照看着它。',
    jokomiAlt: 'Jokomi 安静地读着一本笔记。',
    todayPage: '今日一页',
    openNotebook: '打开笔记本',
    bakeryAlt: 'JOKO Bakery 的水彩插画',
  },
} as const;

export function HomepageExperiencePage({
  onNavigate,
  notebookTarget = { type: 'notebook.today' },
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
  const [bakeryHeroImage, setBakeryHeroImage] = useState(DEFAULT_BAKERY_HERO);
  const [notebookOpen, setNotebookOpen] = useState(() => window.location.pathname.startsWith('/notebook/'));

  const { bundle } = notebookContent;
  const localizedNotebookText = (value: Parameters<typeof getNotebookLocalizedText>[0]) =>
    getNotebookLocalizedText(value, lang, bundle.site.defaultLocale);
  const todayTitle = localizedNotebookText(bundle.today.title);
  const todaySubtitle = localizedNotebookText(bundle.today.subtitle);

  useEffect(() => {
    let active = true;
    void getImageUrl('hero_image_url', DEFAULT_BAKERY_HERO)
      .then((url) => { if (active && url) setBakeryHeroImage(url); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const notebookRouteIsOpen = window.location.pathname.startsWith('/notebook/');
    setNotebookOpen(notebookRouteIsOpen && !notebookClosed);
  }, [notebookClosed, notebookTarget]);

  const openNotebook = () => {
    setNotebookOpen(true);
    onNotebookOpen?.();
    onNotebookNavigate?.({ type: 'notebook.today' });
    window.requestAnimationFrame(() => {
      window.document.getElementById('community-notebook-reader')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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
  const notebookSerif = lang === 'en' ? { fontFamily: 'var(--joko-font-display)' } : undefined;

  return (
    <>
      <section className="joko-mineral-field border-b border-[#55766F]/15 pb-10 pt-3 sm:pb-12 sm:pt-5 xl:pb-14">
        <Container width="wide">
          <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center xl:min-h-[39rem] xl:grid-cols-[minmax(17rem,.88fr)_minmax(25rem,1.34fr)_minmax(18rem,.72fr)] xl:gap-5 2xl:gap-8">
            <div className="relative z-10 max-w-xl lg:pr-4 xl:self-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#466861] sm:text-[11px]">
                {labels.kicker}
              </p>

              <h1
                className="mt-5 text-[3.35rem] font-bold leading-[.91] tracking-[-0.045em] text-[#2E312F] sm:text-[4.3rem] lg:text-[4.75rem] xl:text-[4.65rem] 2xl:text-[5.15rem]"
                style={heroSerif}
              >
                <span className="block">{labels.line1}</span>
                <span className="block">{labels.line2}</span>
                <span className="mt-2 block text-[#C76624]">{labels.line3}</span>
                <span className="block text-[#C76624]">{labels.line4}</span>
              </h1>

              <p className="mt-6 max-w-lg text-[15px] leading-7 text-[#303532]/80 sm:text-base sm:leading-7">
                {labels.intro}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => onNavigate('products')}
                  className="joko-shell-primary-button inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#55766F] focus:ring-offset-2 focus:ring-offset-[#CFE3DF] sm:min-w-52"
                >
                  {labels.products}
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={showHowItWorks}
                  className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#C76624]/70 bg-[#F4EFE5]/55 px-6 py-3 text-base font-semibold text-[#7A3D1B] transition hover:bg-[#F4EFE5]/80 focus:outline-none focus:ring-2 focus:ring-[#55766F] sm:min-w-44"
                >
                  {labels.howItWorks}
                </button>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-2 border-t border-[#55766F]/16 pt-5 text-center text-[10px] leading-4 text-[#304B45]/80 sm:text-xs">
                <div className="flex flex-col items-center gap-2 border-r border-[#55766F]/14 px-1">
                  <PackageCheck className="h-6 w-6 text-[#55766F]" strokeWidth={1.4} aria-hidden="true" />
                  <span>{labels.smallBatches}</span>
                </div>
                <div className="flex flex-col items-center gap-2 border-r border-[#55766F]/14 px-1">
                  <Leaf className="h-6 w-6 text-[#55766F]" strokeWidth={1.4} aria-hidden="true" />
                  <span>{labels.naturalIngredients}</span>
                </div>
                <div className="flex flex-col items-center gap-2 px-1">
                  <MapPin className="h-6 w-6 text-[#55766F]" strokeWidth={1.4} aria-hidden="true" />
                  <span>{labels.weekendPickup}</span>
                </div>
              </div>

              <p
                className="mt-6 hidden max-w-xs -rotate-2 text-sm italic leading-5 text-[#466861]/75 sm:block"
                style={{ fontFamily: 'var(--joko-font-notebook)' }}
              >
                {labels.noteLeft}
              </p>
            </div>

            <div className="relative z-10 min-w-0 lg:order-none xl:self-end">
              <div className="relative mx-auto max-w-[42rem] xl:max-w-none">
                <div className="pointer-events-none absolute inset-x-[10%] bottom-[5%] h-[18%] rounded-full bg-[#55766F]/12 blur-3xl" aria-hidden="true" />
                <img
                  src={bakeryHeroImage}
                  alt={labels.bakeryAlt}
                  className="relative z-10 mx-auto w-full max-h-[42rem] object-contain drop-shadow-[0_22px_36px_rgba(48,75,69,0.10)]"
                  decoding="async"
                  loading="eager"
                />
                <p
                  className="absolute left-[5%] top-[7%] z-20 hidden max-w-40 -rotate-6 text-base italic leading-6 text-[#466861]/70 2xl:block"
                  style={{ fontFamily: 'var(--joko-font-notebook)' }}
                >
                  {labels.noteCenter}
                </p>
                <p
                  className="absolute bottom-[5%] right-[1%] z-20 hidden max-w-32 rotate-[-4deg] text-sm italic leading-5 text-[#466861]/70 2xl:block"
                  style={{ fontFamily: 'var(--joko-font-notebook)' }}
                >
                  {labels.noteRight}
                </p>
              </div>
            </div>

            <aside className="relative z-10 mx-auto w-full max-w-md lg:col-span-2 lg:max-w-2xl xl:col-span-1 xl:max-w-none xl:self-center">
              <div className="relative overflow-hidden rounded-[1.8rem] border border-[#55766F]/18 bg-[#F4EFE5]/95 px-5 pb-5 pt-6 shadow-[0_22px_55px_rgba(48,75,69,0.14)] sm:px-6 sm:pb-6 sm:pt-7">
                <div
                  className="pointer-events-none absolute inset-0 opacity-60"
                  aria-hidden="true"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 18% 12%, rgba(255,255,255,.72), transparent 28%), radial-gradient(circle at 78% 82%, rgba(218,201,174,.16), transparent 31%)',
                  }}
                />

                <div className="relative">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#55766F] sm:text-[10px]">
                    {labels.notebookEyebrow}
                  </p>
                  <h2
                    className="mt-3 text-[2.45rem] font-bold leading-[.94] tracking-[-0.035em] text-[#2E312F] sm:text-[2.8rem] xl:text-[2.55rem] 2xl:text-[2.85rem]"
                    style={notebookSerif}
                  >
                    <span className="block">{labels.notebookTitle1}</span>
                    <span className="block">{labels.notebookTitle2}</span>
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-[#303532]/72">
                    {labels.notebookIntro}
                  </p>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <img
                      src="/assets/home-experience/jokomi-field-notes-v1.webp"
                      alt={labels.jokomiAlt}
                      width={112}
                      height={116}
                      className="h-24 w-24 shrink-0 object-contain mix-blend-multiply sm:h-28 sm:w-28 xl:h-24 xl:w-24 2xl:h-28 2xl:w-28"
                      decoding="async"
                    />
                    <p
                      className="mb-3 max-w-28 -rotate-3 text-xs italic leading-5 text-[#466861]/75"
                      style={{ fontFamily: 'var(--joko-font-notebook)' }}
                    >
                      {labels.jokomi}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openNotebook}
                    className="mt-1 w-full rounded-xl border border-[#55766F]/15 bg-white/30 px-4 py-4 text-left transition hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                  >
                    <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-[#C76624] sm:text-[10px]">
                      {labels.todayPage}
                    </span>
                    <span className="mt-2 flex items-center justify-between gap-3 text-base font-semibold text-[#7A3D1B] sm:text-lg">
                      <span>{todayTitle}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </span>
                    {todaySubtitle && <span className="mt-1 block text-sm text-[#303532]/62">{todaySubtitle}</span>}
                  </button>

                  <button
                    type="button"
                    onClick={openNotebook}
                    className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#55766F] px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-[#45645E] focus:outline-none focus:ring-2 focus:ring-[#303532] focus:ring-offset-2 focus:ring-offset-[#F4EFE5]"
                  >
                    <BookOpen className="h-5 w-5" aria-hidden="true" />
                    {labels.openNotebook}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      {notebookOpen && (
        <section className="joko-paper-band border-b border-[#55766F]/12 py-8 sm:py-10">
          <Container width="wide">
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
          </Container>
        </section>
      )}

      <HomepageLowerSections
        locale={lang}
        onNavigate={onNavigate}
        bundle={notebookContent.bundle}
        featuredProductImageUrl={notebookContent.featuredProductImageUrl}
        onNotebookNavigate={onNotebookNavigate}
      />
    </>
  );
}

export default HomepageExperiencePage;
