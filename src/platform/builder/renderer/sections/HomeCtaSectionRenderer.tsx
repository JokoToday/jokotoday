import { ArrowRight } from 'lucide-react';
import { Container, Section } from '../../../design-system';
import type {
  BuilderAction,
  BuilderSiteIdentity,
  HomeCtaSection,
} from '../../contracts';
import { localize } from '../localize';

interface HomeCtaSectionRendererProps {
  section: HomeCtaSection;
  locale: string;
  site: BuilderSiteIdentity;
  onAction?: (action: BuilderAction) => void;
}

export function HomeCtaSectionRenderer({
  section,
  locale,
  site,
  onAction,
}: HomeCtaSectionRendererProps) {
  const fallbackLocale = site.defaultLocale;

  return (
    <Section spacing={section.design.spacing} className="bg-[#F4EFE5]">
      <Container width={section.design.width}>
        <div className="relative overflow-hidden rounded-[2rem_2.5rem_2.1rem_2.7rem] border border-[#55766F]/15 bg-[#D9ECE9] p-8 shadow-[0_16px_38px_rgba(48,75,69,.08)] md:p-12">
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#F4EFE5]/25 blur-2xl" />
          <div className="relative max-w-3xl">
            <p
              className="font-semibold uppercase tracking-[0.22em] text-[#55766F]"
              style={{ fontSize: 'var(--joko-size-label)' }}
            >
              JOKO TODAY
            </p>
            <h2
              className="mt-3 font-semibold tracking-[-0.03em]"
              style={{
                fontFamily: 'var(--joko-font-display)',
                fontSize: 'var(--joko-size-section-heading)',
                color: 'rgb(var(--joko-shell-ink))',
              }}
            >
              {localize(section.props.title, locale, fallbackLocale)}
            </h2>
            <p
              className="mt-4 whitespace-pre-line leading-7"
              style={{
                fontSize: 'var(--joko-size-body)',
                color: 'rgb(var(--joko-shell-ink) / 0.68)',
              }}
            >
              {localize(section.props.body, locale, fallbackLocale)}
            </p>
            <button
              type="button"
              onClick={() => onAction?.(section.props.action)}
              className="mt-7 inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 font-semibold text-white transition"
              style={{
                backgroundColor: 'rgb(var(--joko-shell-orange))',
                fontSize: 'var(--joko-size-button)',
              }}
            >
              {localize(section.props.actionLabel, locale, fallbackLocale)}
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
