import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Quote } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getPageByKey, type CMSPage } from '../lib/cmsService';
import { Container } from '../platform/design-system';

const OUR_STORY_PAGE_KEY = 'our_story';

const fallbackCopy = {
  en: {
    title: 'Our Story',
    body: 'Our full story is coming soon.\n\nWe’re putting the words together with the same care we bring to the bakery.',
    eyebrow: 'JOKO TODAY',
    back: 'Back to home',
  },
  th: {
    title: 'เรื่องราวของเรา',
    body: 'เรื่องราวฉบับเต็มของเรากำลังจะมาถึงเร็ว ๆ นี้\n\nเรากำลังเรียบเรียงเรื่องราวด้วยความใส่ใจแบบเดียวกับที่เราใส่ลงไปในงานเบเกอรี่ทุกชิ้น',
    eyebrow: 'JOKO TODAY',
    back: 'กลับหน้าแรก',
  },
  zh: {
    title: '我们的故事',
    body: '我们的完整故事即将上线。\n\n我们正在认真整理这些文字，就像认真对待每天出炉的烘焙一样。',
    eyebrow: 'JOKO TODAY',
    back: '返回首页',
  },
} as const;

function localizedPage(page: CMSPage | null, language: 'en' | 'th' | 'zh') {
  const fallback = fallbackCopy[language];
  if (!page) return { title: fallback.title, body: fallback.body };

  if (language === 'th') {
    return {
      title: page.title_th || page.title_en || fallback.title,
      body: page.body_th || page.body_en || fallback.body,
    };
  }

  if (language === 'zh') {
    return {
      title: page.title_zh || page.title_en || fallback.title,
      body: page.body_zh || page.body_en || fallback.body,
    };
  }

  return {
    title: page.title_en || fallback.title,
    body: page.body_en || fallback.body,
  };
}

function StoryBody({ body }: { body: string }) {
  const paragraphs = useMemo(
    () => body
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    [body],
  );

  return (
    <div className="space-y-6 text-base leading-8 text-[#303532]/76 sm:text-lg sm:leading-9">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 18)}`} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

interface OurStoryPageProps {
  onNavigate: (page: string) => void;
}

export default function OurStoryPage({ onNavigate }: OurStoryPageProps) {
  const { language } = useLanguage();
  const locale = language === 'th' || language === 'zh' ? language : 'en';
  const labels = fallbackCopy[locale];
  const [page, setPage] = useState<CMSPage | null>(null);

  useEffect(() => {
    let active = true;

    void getPageByKey(OUR_STORY_PAGE_KEY)
      .then((nextPage) => {
        if (active) setPage(nextPage);
      })
      .catch((error) => {
        console.warn('Our Story CMS content is temporarily unavailable:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  const content = localizedPage(page, locale);

  return (
    <div className="joko-mineral-field min-h-screen">
      <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20">
        <Container width="wide">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#55766F] transition hover:text-[#304B45]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {labels.back}
          </button>

          <div className="mx-auto max-w-4xl">
            <div className="mb-10 sm:mb-12">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#3F665E] sm:text-[11px]">
                {labels.eyebrow}
              </p>
              <h1
                className="mt-3 text-5xl font-semibold tracking-[-0.045em] text-[#292D2B] sm:text-6xl lg:text-7xl"
                style={{ fontFamily: 'var(--joko-font-display)' }}
              >
                {content.title}
              </h1>
              <span className="mt-4 block h-[3px] w-36 -rotate-1 rounded-full bg-[#D98242]/75" aria-hidden="true" />
            </div>

            <article className="relative overflow-hidden rounded-[2rem_2.6rem_2.15rem_2.8rem] border border-[#8B765E]/14 bg-[#FFF9EE]/78 px-6 py-9 shadow-[0_18px_46px_rgba(48,75,69,.08)] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
              <Quote className="absolute right-7 top-7 h-12 w-12 text-[#C76624]/14 sm:right-10 sm:top-9" strokeWidth={1.2} aria-hidden="true" />
              <div className="relative max-w-3xl">
                <StoryBody body={content.body} />
              </div>
            </article>
          </div>
        </Container>
      </section>
    </div>
  );
}
