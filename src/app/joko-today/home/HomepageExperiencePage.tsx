import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { useNotebookContent } from '../../../hooks/useNotebookContent';
import { getImageUrl } from '../../../lib/cmsService';
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

const copy = {
  en: {
    came: 'Came for the',
    bread: 'bread?',
    stay: 'Stay for the',
    stories: 'stories.',
    bakerTable: "From the baker’s table",
    bakery: 'Go to the Bakery',
    breadPermission: 'Just here for the bread? Perfectly reasonable.',
    browseNotebook: 'Browse the Notebook',
    share: 'Share something',
    notebook: 'Community Notebook',
    notebookLine1: 'Pages from all of us.',
    notebookLine2: 'Read one. Leave one.',
    life: 'Life is worth noticing.',
    jokomi: 'Jokomi looks after it.',
    jokomiAlt: 'Jokomi quietly reading a notebook.',
  },
  th: {
    came: 'มาเพราะ',
    bread: 'ขนมปัง?',
    stay: 'อยู่ต่อเพราะ',
    stories: 'เรื่องราว',
    bakerTable: 'จากโต๊ะของคนทำขนม',
    bakery: 'ไปที่เบเกอรี่',
    breadPermission: 'ถ้ามาเพื่อขนมปังอย่างเดียว ก็สมเหตุสมผลดี',
    browseNotebook: 'เปิดดูสมุดบันทึก',
    share: 'แบ่งปันบางอย่าง',
    notebook: 'สมุดบันทึกชุมชน',
    notebookLine1: 'หน้าต่าง ๆ จากพวกเราทุกคน',
    notebookLine2: 'อ่านหนึ่งหน้า ฝากไว้หนึ่งหน้า',
    life: 'ชีวิตมีเรื่องให้สังเกตเสมอ',
    jokomi: 'Jokomi ช่วยดูแลมันอยู่',
    jokomiAlt: 'Jokomi กำลังอ่านสมุดบันทึกอย่างเงียบ ๆ',
  },
  zh: {
    came: '为了',
    bread: '面包而来？',
    stay: '为了',
    stories: '故事留下。',
    bakerTable: '来自烘焙桌',
    bakery: '去烘焙坊',
    breadPermission: '只是来买面包？完全合理。',
    browseNotebook: '翻翻社区笔记',
    share: '留下一点东西',
    notebook: '社区笔记本',
    notebookLine1: '这些页面来自我们所有人。',
    notebookLine2: '读一页，留一页。',
    life: '生活值得被留意。',
    jokomi: 'Jokomi 静静照看着它。',
    jokomiAlt: 'Jokomi 安静地读着一本笔记。',
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
  const [bakeryHeroImage, setBakeryHeroImage] = useState('/assets/home-experience/almond-croissant-v1.webp');

  useEffect(() => {
    let active = true;
    void getImageUrl('hero_image_url', '/assets/home-experience/almond-croissant-v1.webp')
      .then((url) => { if (active && url) setBakeryHeroImage(url); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const openNotebook = () => {
    onNotebookOpen?.();
    onNotebookNavigate?.({ type: 'notebook.today' });
    window.requestAnimationFrame(() => {
      window.document.getElementById('community-notebook-reader')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const shareSomething = () => {
    window.document.querySelector('footer')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const bakeryImages = [
    { src: bakeryHeroImage, position: '50% 32%' },
    { src: '/assets/home-experience/almond-croissant-v1.webp', position: '50% 50%' },
    { src: bakeryHeroImage, position: '50% 72%' },
  ];

  return (
    <>
      <section className="joko-mineral-field border-b border-[#55766F]/15 pb-10 pt-5 sm:pb-14 sm:pt-7">
        <Container width="wide">
          <div className="grid gap-10 xl:grid-cols-[minmax(16rem,0.34fr)_minmax(0,1fr)] xl:items-start xl:gap-10 2xl:gap-12">
            <div className="relative z-10 max-w-md xl:pt-4">
              <h1 className="text-[2.7rem] font-medium leading-[1.03] tracking-[-0.035em] text-[#303532] sm:text-[3.4rem] xl:text-[3.55rem]">
                <span className="block">
                  {labels.came}{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate('products')}
                    className="font-inherit underline decoration-[#55766F]/35 decoration-1 underline-offset-[7px] transition hover:decoration-[#C76624] focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                  >
                    {labels.bread}
                  </button>
                </span>
                <span className="mt-1 block text-[#C76624]">
                  {labels.stay}{' '}
                  <button
                    type="button"
                    onClick={openNotebook}
                    className="font-inherit underline decoration-[#C76624]/35 decoration-1 underline-offset-[7px] transition hover:decoration-[#C76624] focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                  >
                    {labels.stories}
                  </button>
                </span>
              </h1>

              <div className="mt-10">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#466861]">
                  {labels.bakerTable}
                </p>
                <div className="space-y-2.5">
                  {bakeryImages.map((image, index) => (
                    <div
                      key={`${image.src}-${index}`}
                      className={[
                        'overflow-hidden border border-white/40 bg-[#F4EFE5]/50 shadow-sm',
                        index === 0 ? 'ml-0 mr-3 rounded-[1.25rem_1rem_1.15rem_.75rem]' : '',
                        index === 1 ? 'ml-3 mr-0 rounded-[.8rem_1.2rem_.85rem_1.15rem]' : '',
                        index === 2 ? 'ml-1 mr-4 rounded-[1.15rem_.8rem_1.2rem_1rem]' : '',
                      ].join(' ')}
                    >
                      <img
                        src={image.src}
                        alt=""
                        className="h-24 w-full object-cover sm:h-[6.7rem]"
                        style={{ objectPosition: image.position }}
                        decoding="async"
                        loading={index === 0 ? 'eager' : 'lazy'}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('products')}
                className="joko-shell-primary-button mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 py-3 text-base font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#55766F] focus:ring-offset-2 focus:ring-offset-[#CFE3DF] sm:w-auto sm:min-w-64"
              >
                {labels.bakery}
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>

              <p className="mt-2 text-center text-xs italic text-[#303532]/65 sm:w-64">
                {labels.breadPermission}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-7 gap-y-3">
                <button
                  type="button"
                  onClick={openNotebook}
                  className="inline-flex items-center gap-2 border-b border-[#55766F]/45 pb-0.5 text-sm font-medium text-[#304B45] transition hover:border-[#C76624] hover:text-[#303532] focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                >
                  {labels.browseNotebook}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={shareSomething}
                  className="inline-flex items-center gap-2 border-b border-[#55766F]/25 pb-0.5 text-sm text-[#303532]/70 transition hover:border-[#55766F] hover:text-[#303532] focus:outline-none focus:ring-2 focus:ring-[#55766F]"
                >
                  {labels.share}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative z-10 min-w-0">
              <div className="relative mb-4 min-h-24 px-2 text-center sm:mb-5 sm:min-h-28">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#466861]/80 sm:text-xs">
                  {labels.life}
                </p>
                <h2 className="mt-2 text-xl font-semibold uppercase tracking-[0.2em] text-[#303532] sm:text-2xl">
                  {labels.notebook}
                </h2>
                <p className="mt-1 text-sm leading-5 text-[#303532]/75 sm:text-base">
                  {labels.notebookLine1}<br />
                  <span className="font-medium text-[#303532]">{labels.notebookLine2}</span>
                </p>

                <div className="mx-auto mt-3 flex max-w-sm items-center justify-center gap-3 sm:absolute sm:right-3 sm:top-1/2 sm:mt-0 sm:max-w-[12rem] sm:-translate-y-1/2 sm:justify-end sm:text-left">
                  <img
                    src="/assets/home-experience/jokomi-field-notes-v1.webp"
                    alt={labels.jokomiAlt}
                    width={112}
                    height={116}
                    className="h-16 w-16 shrink-0 object-contain mix-blend-multiply sm:h-20 sm:w-20"
                    decoding="async"
                  />
                  <p className="max-w-24 text-xs italic leading-4 text-[#304B45]/80 sm:text-[11px]">
                    {labels.jokomi}
                  </p>
                </div>
              </div>

              <NotebookExperienceReader
                target={notebookTarget}
                closed={notebookClosed}
                onNavigate={onNotebookNavigate ?? (() => undefined)}
                onBack={onNotebookBack ?? (() => undefined)}
                onClose={onNotebookClose ?? (() => undefined)}
                onOpen={onNotebookOpen ?? (() => undefined)}
                content={notebookContent}
                onCommerceNavigate={onNavigate}
              />
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
    </>
  );
}

export default HomepageExperiencePage;
