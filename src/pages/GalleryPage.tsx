import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ExternalLink, Image as ImageIcon, Loader2, Play } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  getPublishedGalleryItems,
  localizedGalleryText,
  type GalleryItem,
} from '../lib/aboutMediaService';
import { Container } from '../platform/design-system';

interface GalleryPageProps {
  onNavigate: (page: string) => void;
}

const copy = {
  en: {
    eyebrow: 'Around JOKO',
    title: 'Gallery',
    intro: 'Real moments from the bakery, the people around it, pickup days and the things we make.',
    all: 'All',
    back: 'Back to home',
    empty: 'We are putting the first Gallery together. Check back soon.',
    open: 'Open media',
  },
  th: {
    eyebrow: 'รอบ ๆ JOKO',
    title: 'แกลเลอรี',
    intro: 'ภาพจริงจากเบเกอรี่ ผู้คน วันรับสินค้า และสิ่งที่เราทำในแต่ละสัปดาห์',
    all: 'ทั้งหมด',
    back: 'กลับหน้าแรก',
    empty: 'เรากำลังรวบรวมภาพชุดแรกสำหรับแกลเลอรี แล้วแวะกลับมาดูอีกนะ',
    open: 'เปิดสื่อ',
  },
  zh: {
    eyebrow: 'JOKO 日常',
    title: '影像集',
    intro: '来自烘焙坊、身边的人、取货日和我们每天制作的真实片段。',
    all: '全部',
    back: '返回首页',
    empty: '我们正在整理第一批影像，欢迎稍后再来看看。',
    open: '打开媒体',
  },
} as const;

function isDirectVideo(url: string) {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(url);
}

export default function GalleryPage({ onNavigate }: GalleryPageProps) {
  const { language } = useLanguage();
  const lang = language === 'th' || language === 'zh' ? language : 'en';
  const labels = copy[lang];
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    let active = true;
    void getPublishedGalleryItems()
      .then((nextItems) => {
        if (active) setItems(nextItems);
      })
      .catch((error) => console.warn('Gallery unavailable:', error))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))).filter(Boolean).sort(),
    [items],
  );
  const visible = category === 'all' ? items : items.filter((item) => item.category === category);

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
            <span className="mt-4 block h-[3px] w-32 -rotate-1 rounded-full bg-[#D98242]/75" aria-hidden="true" />
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#303532]/68 sm:text-lg">{labels.intro}</p>
          </div>

          {categories.length > 1 && (
            <div className="mt-8 flex flex-wrap gap-2" aria-label="Gallery categories">
              <button type="button" onClick={() => setCategory('all')} className={`rounded-full px-4 py-2 text-sm font-medium transition ${category === 'all' ? 'bg-[#55766F] text-white' : 'bg-[#F4EFE5]/75 text-[#303532] hover:bg-[#F4EFE5]'}`}>{labels.all}</button>
              {categories.map((itemCategory) => (
                <button key={itemCategory} type="button" onClick={() => setCategory(itemCategory)} className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${category === itemCategory ? 'bg-[#55766F] text-white' : 'bg-[#F4EFE5]/75 text-[#303532] hover:bg-[#F4EFE5]'}`}>
                  {itemCategory.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex min-h-[22rem] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#55766F]" /></div>
          ) : visible.length ? (
            <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((item, index) => {
                const text = localizedGalleryText(item, lang);
                const tall = index % 5 === 1 || index % 5 === 4;
                return (
                  <figure key={item.id} className="group overflow-hidden rounded-[1.7rem] border border-[#8B765E]/14 bg-[#FFF9EE]/72 shadow-[0_12px_30px_rgba(48,75,69,.06)]">
                    <div className={`relative overflow-hidden bg-[#E8E1D5] ${tall ? 'aspect-[4/5]' : 'aspect-[4/3]'}`}>
                      {item.media_type === 'image' ? (
                        <img src={item.media_url} alt={text.alt} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" loading="lazy" />
                      ) : isDirectVideo(item.media_url) ? (
                        <video src={item.media_url} poster={item.thumbnail_url || undefined} controls preload="metadata" className="h-full w-full object-cover" />
                      ) : item.thumbnail_url ? (
                        <a href={item.media_url} target="_blank" rel="noreferrer" className="relative block h-full w-full">
                          <img src={item.thumbnail_url} alt={text.alt} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]" loading="lazy" />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/10"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF9EE]/90 text-[#303532] shadow-lg"><Play className="ml-1 h-6 w-6" fill="currentColor" /></span></span>
                        </a>
                      ) : (
                        <a href={item.media_url} target="_blank" rel="noreferrer" className="flex h-full flex-col items-center justify-center gap-3 text-[#55766F]">
                          <Play className="h-10 w-10" /><span className="text-sm font-medium">{labels.open}</span>
                        </a>
                      )}
                    </div>
                    {(text.title || text.caption) && (
                      <figcaption className="p-5">
                        {text.title && <h2 className="text-lg font-semibold text-[#303532]">{text.title}</h2>}
                        {text.caption && <p className="mt-1 text-sm leading-6 text-[#303532]/62">{text.caption}</p>}
                      </figcaption>
                    )}
                  </figure>
                );
              })}
            </div>
          ) : (
            <div className="mt-10 rounded-3xl border border-dashed border-[#55766F]/20 bg-[#F4EFE5]/45 p-12 text-center">
              <ImageIcon className="mx-auto h-9 w-9 text-[#55766F]/35" />
              <p className="mt-4 text-sm text-[#303532]/58">{labels.empty}</p>
            </div>
          )}

          <div className="mt-10 flex justify-end">
            <a href="/" onClick={(event) => { event.preventDefault(); onNavigate('home'); }} className="inline-flex items-center gap-2 text-sm font-medium text-[#A44F1D]">
              JOKO TODAY <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </Container>
      </section>
    </div>
  );
}
