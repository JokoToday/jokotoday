import { useEffect, useState } from 'react';
import { ArrowRight, Leaf, MapPin, PlayCircle } from 'lucide-react';
import { Container } from '../../../design-system';
import type {
  BuilderAction,
  BuilderSiteIdentity,
  HomeHeroSection,
} from '../../contracts';
import type { BuilderHeroMediaProvider, BuilderMedia } from '../../providers';
import { localize } from '../localize';
import { localizeRichText } from '../../richText';
import { JokoHeroNotebookNote } from '../../../../components/JokoHeroNotebookNote';
import { HeroTypography } from '../../HeroTypography';
import { resolveTopMenu, getTopMenuLabel } from '../../topMenu';
import { resolveJokoHomepageBranding } from '../../branding';
import { HomepageExperiencePage } from '../../../../app/joko-today/home/HomepageExperiencePage';

interface HomeHeroSectionRendererProps {
  section: HomeHeroSection;
  locale: string;
  site: BuilderSiteIdentity;
  provider: BuilderHeroMediaProvider;
  onAction?: (action: BuilderAction) => void;
  interactive?: boolean;
  branding?: ReturnType<typeof resolveJokoHomepageBranding>;
  /** Reuse the production Experience hero for Admin preview (not Builder-only mode). */
  experiencePreview?: boolean;
}

export function HomeHeroSectionRenderer(props: HomeHeroSectionRendererProps) {
  if (props.experiencePreview) {
    // Same composition, layout, image, media queries and typography as public
    // HomepageExperiencePage. Draft content comes only from props.section.
    return <HomepageExperiencePage
      onNavigate={() => { /* No real navigation in Admin preview. */ }}
      previewHero={props.section}
      previewLocale={props.locale === 'th' || props.locale === 'zh' ? props.locale : 'en'}
      heroOnly
    />;
  }
  return <BuilderHeroSectionRenderer {...props} />;
}

function BuilderHeroSectionRenderer({
  section,
  locale,
  site,
  provider,
  onAction,
  interactive = true,
  branding,
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
  const subtitleRuns = localizeRichText(section.props.subtitleRichText, locale, fallbackLocale, subtitle);
  const eyebrow = section.props.eyebrow?.[locale]?.trim() || null;
  const notebookNote = section.props.notebookNote;
  const notebookTitle = notebookNote?.title ? localize(notebookNote.title, locale, fallbackLocale) : '';
  const notebookBody = notebookNote?.body ? localize(notebookNote.body, locale, fallbackLocale) : '';
  const notebookImageAlt = notebookNote?.imageAlt ? localize(notebookNote.imageAlt, locale, fallbackLocale) : '';
  const showNotebookNote = Boolean(
    notebookNote?.enabled && (notebookTitle || notebookBody || notebookNote.imageUrl),
  );
  const logoUrl = section.props.logoUrl || '/assets/brand/joko-today-logo-v0.4.webp';
  const chrome = locale === 'th'
    ? {
        eyebrow: 'เบเกอรี่ทำมือ • เรื่องราวใกล้ตัว • วันที่อ่อนโยนกว่า',
        smallBatch: 'อบทีละน้อย',
        pickup: 'รับสินค้าในเชียงใหม่',
      }
    : locale === 'zh'
    ? {
        eyebrow: '手作烘焙 • 身边故事 • 更温柔的一天',
        smallBatch: '小批量烘焙',
        pickup: '清迈取货',
      }
    : {
        eyebrow: 'Love for Baking. Shared with Everyone.',
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
          <div className="ml-auto hidden gap-4 font-medium text-[#303532]/72 xl:gap-5 lg:flex" style={{ fontSize: 'var(--joko-size-nav, 16px)' }}>
            {resolveTopMenu(branding?.topMenu).filter((item) => item.visible).map((item) => <span key={item.key}>{getTopMenuLabel(item, locale)}</span>)}
          </div>
        </div>

        <div className="relative grid min-h-[34rem] gap-7 py-8 lg:grid-cols-[minmax(19rem,.72fr)_minmax(33rem,1.35fr)] lg:items-start">
          {showNotebookNote && (
            <div className="absolute right-4 top-5 z-30 hidden w-[14.5rem] lg:block xl:right-6 xl:top-6 xl:w-[15.5rem]">
              <JokoHeroNotebookNote
                title={notebookTitle}
                body={notebookBody}
                imageUrl={notebookNote?.imageUrl}
                imageAlt={notebookImageAlt}
                href={notebookNote?.linkUrl}
                fontPreset={notebookNote?.fontPreset}
                headingSize={notebookNote?.headingSize}
                bodySize={notebookNote?.bodySize}
                interactive={interactive}
              />
            </div>
          )}

          <div className="relative z-20 max-w-[31rem] lg:pt-7">
            <HeroTypography as="p" kind="eyebrow" value={[{ text: eyebrow ?? chrome.eyebrow }]}
              style={section.props.eyebrowStyle} className="tracking-[0.15em]" />
            <HeroTypography as="h1" kind="headline" value={titleRichText} style={section.props.titleStyle}
              lineStyles={section.props.titleLineStyles?.[locale]} className="mt-4 leading-[.93] tracking-[-0.042em]" />
            <span className="mt-3 block h-[3px] w-[82%] max-w-[22rem] -rotate-1 rounded-full bg-[#D98242]/75" aria-hidden="true" />
            <HeroTypography as="p" kind="subtitle" value={subtitleRuns}
              style={section.props.subtitleStyle} className="mt-5 leading-7" />

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

            {showNotebookNote && (
              <div className="mt-6 max-w-[18rem] lg:hidden">
                <JokoHeroNotebookNote
                  title={notebookTitle}
                  body={notebookBody}
                  imageUrl={notebookNote?.imageUrl}
                  imageAlt={notebookImageAlt}
                  href={notebookNote?.linkUrl}
                  fontPreset={notebookNote?.fontPreset}
                  headingSize={notebookNote?.headingSize}
                  bodySize={notebookNote?.bodySize}
                  interactive={interactive}
                />
              </div>
            )}

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
