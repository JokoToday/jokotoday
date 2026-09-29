import { useEffect, useState } from 'react';
import { ArrowRight, Leaf, MapPin, PlayCircle } from 'lucide-react';
import { Container } from '../../../design-system';
import type {
  BuilderAction,
  BuilderRichTextColor,
  BuilderSiteIdentity,
  HomeHeroSection,
} from '../../contracts';
import type { BuilderHeroMediaProvider, BuilderMedia } from '../../providers';
import { localize } from '../localize';
import { localizeRichText, richTextToPlainText } from '../../richText';

interface HomeHeroSectionRendererProps {
  section: HomeHeroSection;
  locale: string;
  site: BuilderSiteIdentity;
  provider: BuilderHeroMediaProvider;
  onAction?: (action: BuilderAction) => void;
}

export function HomeHeroSectionRenderer({
  section,
  locale,
  site,
  provider,
  onAction,
}: HomeHeroSectionRendererProps) {
  const [media, setMedia] = useState<BuilderMedia | null>(null);

  useEffect(() => {
    let active = true;
    provider.getHeroMedia()
      .then((value) => { if (active) setMedia(value); })
      .catch(() => { if (active) setMedia(null); });
    return () => { active = false; };
  }, [provider]);

  const fallbackLocale = site.defaultLocale;
  const title = localize(section.props.title, locale, fallbackLocale);
  const titleRichText = localizeRichText(section.props.titleRichText, locale, fallbackLocale, title);
  const subtitle = localize(section.props.subtitle, locale, fallbackLocale);
  const logoUrl = section.props.logoUrl || '/assets/brand/joko-today-logo-v0.4.webp';
  const chrome = locale === 'th'
    ? {
        nav: ['หน้าแรก', 'เบเกอรี่', 'วิธีสั่งซื้อ', 'รับสินค้า', 'เกี่ยวกับเรา'],
        eyebrow: 'เบเกอรี่อาร์ติซาน · เชียงใหม่ · อบทีละน้อย',
        smallBatch: 'อบทีละน้อย',
        pickup: 'รับสินค้าในเชียงใหม่',
      }
    : locale === 'zh'
    ? {
        nav: ['首页', '烘焙', '如何订购', '取货', '关于我们'],
        eyebrow: '手作烘焙 · 清迈 · 小批量制作',
        smallBatch: '小批量烘焙',
        pickup: '清迈取货',
      }
    : {
        nav: ['Home', 'Bakery', 'How It Works', 'Pickup', 'About'],
        eyebrow: 'Artisan bakery · Chiang Mai · Small batches',
        smallBatch: 'Small-batch baking',
        pickup: 'Pickup in Chiang Mai',
      };

  return (
    <section
      className="relative overflow-hidden py-3 sm:py-5"
      style={{
        backgroundColor: 'var(--joko-brand-turquoise, #DAEBE8)',
        backgroundImage:
          "radial-gradient(ellipse at 12% 8%, rgba(249,246,237,.25) 0 13%, transparent 33%), radial-gradient(ellipse at 86% 9%, rgba(235,244,245,.24) 0 20%, transparent 42%), url('/assets/backgrounds/joko-shell-connections-v0.21-strong.svg')",
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'auto, auto, max(112%, 1780px) auto',
        backgroundPosition: 'center, center, 50% -40px',
      }}
    >
      <Container width={section.design.width}>
        <div className="mb-3 flex min-h-16 items-center border-b border-[#55766F]/15 py-2">
          <img src={logoUrl} alt={site.name} className="w-auto object-contain mix-blend-multiply" style={{ height: 'calc(3rem * var(--joko-logo-scale, 1.2))' }} />
          <div className="ml-auto hidden gap-7 font-medium text-[#303532]/72 sm:flex" style={{ fontSize: 'var(--joko-size-nav, 16px)' }}>
            {chrome.nav.map((label) => <span key={label}>{label}</span>)}
          </div>
        </div>

        <div className="relative grid min-h-[34rem] gap-7 py-8 lg:grid-cols-[minmax(19rem,.72fr)_minmax(33rem,1.35fr)] lg:items-start">
          <div className="relative z-20 max-w-[31rem] lg:pt-7">
            <p className="font-semibold uppercase tracking-[0.25em] text-[#3F665E]" style={{ fontSize: 'var(--joko-size-label, 11px)' }}>
              {chrome.eyebrow}
            </p>
            <h1
              className="mt-4 whitespace-pre-line font-bold leading-[.93] tracking-[-0.042em]"
              style={{ fontFamily: 'var(--joko-font-display)', fontSize: 'clamp(2.7rem, 5vw, var(--joko-size-hero, 65px))', color: 'var(--joko-brand-text, #292D2B)' }}
              aria-label={richTextToPlainText(titleRichText)}
            >
              {titleRichText.map((run, index) => {
                const color = run.marks?.color as BuilderRichTextColor | undefined;
                const semanticColor = color === 'accent'
                  ? 'var(--joko-brand-accent, #C76624)'
                  : color === 'turquoise'
                    ? 'var(--joko-brand-turquoise, #DAEBE8)'
                    : color === 'text'
                      ? 'var(--joko-brand-text, #292D2B)'
                      : undefined;
                return (
                  <span
                    key={`${index}-${run.text}`}
                    style={{
                      color: semanticColor,
                      fontWeight: run.marks?.bold ? 700 : undefined,
                      fontStyle: run.marks?.italic ? 'italic' : undefined,
                    }}
                  >
                    {run.text}
                  </span>
                );
              })}
            </h1>
            <span className="mt-3 block h-[3px] w-[82%] max-w-[22rem] -rotate-1 rounded-full bg-[#D98242]/75" aria-hidden="true" />
            <p className="mt-5 leading-7 text-[#303532]/78" style={{ fontSize: 'var(--joko-size-body, 16px)' }}>{subtitle}</p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onAction?.(section.props.primaryAction)}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl px-6 py-3.5 font-semibold text-white shadow-[0_8px_20px_rgba(164,79,29,.14)] transition hover:brightness-95" style={{ background: 'var(--joko-brand-accent, #C76624)', fontSize: 'var(--joko-size-button, 16px)' }}
              >
                {localize(section.props.primaryActionLabel, locale, fallbackLocale)}
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onAction?.(section.props.secondaryAction)}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[#303532]/45 bg-[#F4EFE5]/80 px-6 py-3 font-semibold text-[#303532] transition hover:bg-[#F4EFE5]" style={{ fontSize: 'var(--joko-size-button, 16px)' }}
              >
                <PlayCircle className="mr-2 h-5 w-5" strokeWidth={1.6} />
                {localize(section.props.secondaryActionLabel, locale, fallbackLocale)}
              </button>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3 border-t border-[#55766F]/15 pt-5 text-xs text-[#304B45]/78">
              <div className="flex items-center gap-2"><Leaf className="h-5 w-5 text-[#6E9A4F]" />{chrome.smallBatch}</div>
              <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-[#668C4E]" />{chrome.pickup}</div>
            </div>
          </div>

          <div className="relative min-h-[29rem] overflow-hidden lg:min-h-[34rem]">
            {media && (
              <img
                src={media.src}
                alt={localize(section.props.mediaAlt, locale, fallbackLocale)}
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                  WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,.38) 11%, #000 25%, #000 92%, transparent 100%)',
                  maskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,.38) 11%, #000 25%, #000 92%, transparent 100%)',
                }}
              />
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
