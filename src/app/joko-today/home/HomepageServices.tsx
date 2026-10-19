import { useState } from 'react';
import { ChevronDown, Croissant, PlayCircle, ShoppingBasket, Store, Tag, Users } from 'lucide-react';
import { Container } from '../../../platform/design-system';
import { usePublishedJokoBranding } from '../builder/usePublishedJokoLogo';
import type { HomeServiceCardConfig } from '../../../platform/builder/contracts';

import { heading, introduction, howLabel, services, type Language, type ServiceKey } from './homepageServiceDefaults';

const icons = { bakery: Croissant, store: Store, makers: Users, specials: Tag };

export function HomepageServices({ locale, onNavigate, draftBranding }: { locale: Language; onNavigate: (page: string) => void; draftBranding?: ReturnType<typeof usePublishedJokoBranding>['branding'] }) {
  const [expanded, setExpanded] = useState<ServiceKey | null>(null);
  const { branding } = usePublishedJokoBranding();
  const config = (draftBranding ?? branding).services;
  if (config?.visible !== true) return null;
  const orderedCards: readonly HomeServiceCardConfig[] = config?.cards?.length ? config.cards : services.map((item): HomeServiceCardConfig => ({ key: item.key, visible: true }));
  return <section id="what-you-can-do" className="scroll-mt-24 border-y border-[#55766F]/12 bg-[#FCF8F1] py-14 sm:py-20" aria-labelledby="joko-services-title">
    <Container width="wide">
      <div className="mb-8 text-center sm:mb-10">
        <h2 id="joko-services-title" className="text-3xl font-semibold tracking-tight text-[#303532] sm:text-4xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{config?.title?.[locale] || heading[locale]}</h2>
        <p className="mt-2 text-[#4E5D55]">{config?.subtitle?.[locale] || introduction[locale]}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {orderedCards.filter((card) => card.visible).map((card) => {
          const service = services.find((entry) => entry.key === card.key);
          if (!service) return null;
          const localizedName = card.name?.[locale] || service.name[locale];
          const localizedDescription = card.description?.[locale] || service.description[locale];
          const exploreLabel = card.exploreLabel?.[locale] || service.explore[locale];
          const guideLabel = card.guideLabel?.[locale] || howLabel[locale];
          const guideSteps = card.guideSteps?.[locale]?.filter(Boolean) || service.steps[locale];
          const Icon = icons[service.key];
          const isExpanded = expanded === service.key;
          return <article key={service.key} className="overflow-hidden rounded-2xl border border-[#7D796E]/20 bg-white/75 p-3 shadow-[0_8px_24px_rgba(48,53,50,.045)] sm:p-4">
            <div className="flex items-center gap-4 border-b border-[#7D796E]/15 pb-4">
              <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#7D796E]/15 bg-[#EEE6DE] text-[#755E4B] sm:h-32 sm:w-32">{card.imageUrl ? <img src={card.imageUrl} alt={card.imageAlt?.[locale] || localizedName} className="h-full w-full object-contain" loading="lazy"/> : <Icon aria-hidden="true" size={66} strokeWidth={1.05}/>}</div>
              <div className="min-w-0"><h3 className="text-lg font-semibold text-[#303532]">{localizedName}</h3><p className="mt-1 text-sm leading-6 text-[#303532]/75">{localizedDescription}</p></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => onNavigate(card.destination || service.page)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#E9E9E9] px-2 text-sm font-semibold text-[#262626] transition hover:bg-[#DADADA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"><ShoppingBasket className="h-4 w-4 shrink-0"/>{exploreLabel}</button>
              <button type="button" aria-expanded={isExpanded} aria-controls={`joko-service-guide-${service.key}`} onClick={() => setExpanded(isExpanded ? null : service.key)} className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-[#7D796E]/25 px-2 text-sm font-semibold text-[#262626] transition hover:bg-[#F1ECE4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55766F]"><PlayCircle className="h-4 w-4 shrink-0"/>{guideLabel}<ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}/></button>
            </div>
            {isExpanded && <div id={`joko-service-guide-${service.key}`} className="mt-4 rounded-xl bg-[#F5F0E9] p-4"><ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-[#303532]">{guideSteps.map((step) => <li key={step}>{step}</li>)}</ol>{card.videoUrl && <a href={card.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex text-sm font-semibold text-[#A44F1D] underline">{locale === 'en' ? 'Watch the explainer' : locale === 'th' ? 'ดูวิดีโอแนะนำ' : '观看讲解视频'}</a>}<p className="mt-3 text-xs text-[#56685E]">{locale === 'en' ? 'Illustrated animation coming soon.' : locale === 'th' ? 'วิดีโอภาพประกอบกำลังมาเร็ว ๆ นี้' : '动画讲解即将推出。'}</p></div>}
          </article>;
        })}
      </div>
    </Container>
  </section>;
}
