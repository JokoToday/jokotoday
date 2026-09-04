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
    <Section
      spacing={section.design.spacing}
      className="bg-gradient-to-b from-background to-primary-50"
    >
      <Container width={section.design.width}>
        <div className="bg-primary-600 rounded-2xl p-8 md:p-12 text-center text-white shadow-xl">
          <h2 className="text-3xl md:text-4xl font-header font-bold mb-4">
            {localize(section.props.title, locale, fallbackLocale)}
          </h2>
          <p className="text-lg md:text-xl mb-8 text-primary-50 whitespace-pre-line">
            {localize(section.props.body, locale, fallbackLocale)}
          </p>
          <button
            type="button"
            onClick={() => onAction?.(section.props.action)}
            className="bg-background text-primary-900 px-10 py-4 rounded-lg font-bold text-lg hover:bg-primary-50 transition-colors inline-flex items-center"
          >
            {localize(section.props.actionLabel, locale, fallbackLocale)}
            <ArrowRight className="ml-2 h-6 w-6" />
          </button>
        </div>
      </Container>
    </Section>
  );
}
