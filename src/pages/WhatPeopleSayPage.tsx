import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  MessageSquareQuote,
  Play,
  Star,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  getPublishedExternalMentions,
  type ExternalMention,
  type ExternalSourceType,
} from '../lib/aboutMediaService';
import { Container } from '../platform/design-system';

interface WhatPeopleSayPageProps {
  onNavigate: (page: string) => void;
}

const sourceLabels: Record<ExternalSourceType, string> = {
  google_maps: 'Google Maps',
  tiktok: 'TikTok',
  rednote: 'RedNote',
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  other: 'Others',
};

const copy = {
  en: {
    eyebrow: 'JOKO, according to others',
    title: 'What People Say',
    intro: 'A curated look at real reviews, videos and posts from people who have found JOKO out in the world.',
    all: 'All',
    back: 'Back to home',
    original: 'View original',
    empty: 'We are collecting a few real mentions worth sharing. Check back soon.',
  },
  th: {
    eyebrow: 'JOKO ในมุมของคนอื่น',
    title: 'คนอื่นพูดถึงเราอย่างไร',
    intro: 'รีวิว วิดีโอ และโพสต์จริงจากผู้คนที่ได้รู้จัก JOKO',
    all: 'ทั้งหมด',
    back: 'กลับหน้าแรก',
    original: 'ดูต้นฉบับ',
    empty: 'เรากำลังรวบรวมรีวิวและโพสต์จริงที่อยากแบ่งปัน แล้วแวะกลับมาดูอีกนะ',
  },
  zh: {
    eyebrow: '别人眼中的 JOKO',
    title: '大家怎么说',
    intro: '精选真实评价、视频和帖子，看看大家在外面的世界里如何遇见 JOKO。',
    all: '全部',
    back: '返回首页',
    original: '查看原帖',
    empty: '我们正在整理一些值得分享的真实评价和帖子，欢迎稍后再来看看。',
  },
} as const;

function isEmbeddableUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.includes('youtube.com') ||
      host.includes('youtu.be') ||
      host.includes('tiktok.com') ||
      host.includes('instagram.com')
    );
  } catch {
    return false;
  }
}

export default function WhatPeopleSayPage({ onNavigate }: WhatPeopleSayPageProps) {
  const { language } = useLanguage();
  const lang = language === 'th' || language === 'zh' ? language : 'en';
  const labels = copy[lang];
  const [items, setItems] = useState<ExternalMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'all' | ExternalSourceType>('all');

  useEffect(() => {
    let active = true;
    void getPublishedExternalMentions()
      .then((nextItems) => {
        if (active) setItems(nextItems);
      })
      .catch((error) => console.warn('What People Say unavailable:', error))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const sources = useMemo(
    () => Array.from(new Set(items.map((item) => item.source_type))),
    [items],
  );
  const visible = source === 'all' ? items : items.filter((item) => item.source_type === source);

  return (
    <div className="joko-mineral-field min-h-screen">
      <section className="py-10 sm:py-14 lg:py-16">
        <Container width="wide">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-[#55766F] transition hover:text-[#304B45]"
          >
            <ArrowLeft className="h-4 w-4" /> {labels.back}
          </button>

          <div className="max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#3F665E] sm:text-[11px]">{labels.eyebrow}</p>
            <h1
              className="mt-3 text-5xl font-semibold tracking-[-0.045em] text-[#292D2B] sm:text-6xl lg:text-7xl"
              style={{ fontFamily: 'var(--joko-font-display)' }}
            >
              {labels.title}
            </h1>
            <span className="mt-4 block h-[3px] w-36 -rotate-1 rounded-full bg-[#D98242]/75" aria-hidden="true" />
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#303532]/68 sm:text-lg">{labels.intro}</p>
          </div>

          {sources.length > 1 && (
            <div className="mt-8 flex flex-wrap gap-2" aria-label="Source filters">
              <button type="button" onClick={() => setSource('all')} className={`rounded-full px-4 py-2 text-sm font-medium transition ${source === 'all' ? 'bg-[#55766F] text-white' : 'bg-[#F4EFE5]/75 text-[#303532] hover:bg-[#F4EFE5]'}`}>
                {labels.all}
              </button>
              {sources.map((sourceType) => (
                <button key={sourceType} type="button" onClick={() => setSource(sourceType)} className={`rounded-full px-4 py-2 text-sm font-medium transition ${source === sourceType ? 'bg-[#55766F] text-white' : 'bg-[#F4EFE5]/75 text-[#303532] hover:bg-[#F4EFE5]'}`}>
                  {sourceLabels[sourceType]}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[22rem] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#55766F]" /></div>
          ) : visible.length ? (
            <div className="mt-9 grid gap-5 lg:grid-cols-3">
              {visible.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-[1.7rem] border border-[#8B765E]/14 bg-[#FFF9EE]/78 shadow-[0_12px_30px_rgba(48,75,69,.06)]">
                  {(item.thumbnail_url || (item.embed_url && isEmbeddableUrl(item.embed_url))) && (
                    <div className="relative aspect-video overflow-hidden bg-[#E8E1D5]">
                      {item.embed_url && isEmbeddableUrl(item.embed_url) ? (
                        <iframe
                          src={item.embed_url}
                          title={item.title || `${sourceLabels[item.source_type]} media`}
                          loading="lazy"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="h-full w-full border-0"
                        />
                      ) : item.thumbnail_url ? (
                        <a href={item.source_url} target="_blank" rel="noreferrer" className="relative block h-full w-full">
                          <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                          {item.content_type === 'video' && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF9EE]/92 text-[#303532] shadow-lg"><Play className="ml-1 h-6 w-6" fill="currentColor" /></span>
                            </span>
                          )}
                        </a>
                      ) : null}
                    </div>
                  )}

                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-[#DCE9EC]/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3F665E]">
                        {sourceLabels[item.source_type]}
                      </span>
                      {item.rating !== null && (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#A44F1D]">
                          <Star className="h-4 w-4 fill-current" /> {item.rating.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {item.title && <h2 className="mt-4 text-xl font-semibold text-[#303532]">{item.title}</h2>}
                    {item.excerpt ? (
                      <blockquote className="mt-4 text-base leading-7 text-[#303532]/72">
                        “{item.excerpt}”
                      </blockquote>
                    ) : (
                      <div className="mt-4 flex items-center gap-2 text-[#55766F]/55">
                        <MessageSquareQuote className="h-5 w-5" />
                        <span className="text-sm">{sourceLabels[item.source_type]}</span>
                      </div>
                    )}

                    {item.author_name && <p className="mt-3 text-sm font-medium text-[#303532]">{item.author_name}</p>}
                    <a href={item.source_url} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#A44F1D]">
                      {labels.original} <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-3xl border border-dashed border-[#55766F]/20 bg-[#F4EFE5]/45 p-12 text-center">
              <MessageSquareQuote className="mx-auto h-9 w-9 text-[#55766F]/35" />
              <p className="mt-4 text-sm text-[#303532]/58">{labels.empty}</p>
            </div>
          )}
        </Container>
      </section>
    </div>
  );
}
