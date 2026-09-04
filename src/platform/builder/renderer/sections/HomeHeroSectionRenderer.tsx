import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Container, Section } from '../../../design-system';
import type {
  BuilderAction,
  BuilderSiteIdentity,
  HomeHeroSection,
} from '../../contracts';
import type { BuilderHeroMediaProvider, BuilderMedia } from '../../providers';
import { localize } from '../localize';

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
    provider
      .getHeroMedia()
      .then((value) => {
        if (active) setMedia(value);
      })
      .catch(() => {
        if (active) setMedia(null);
      });

    return () => {
      active = false;
    };
  }, [provider]);

  const fallbackLocale = site.defaultLocale;

  return (
    <Section spacing={section.design.spacing} className="relative overflow-hidden">
      <Container width={section.design.width} className="py-12 md:py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-header font-bold text-primary-900 leading-tight">
              {site.name}
            </h1>
            <p className="text-2xl md:text-3xl text-primary-700 font-medium">
              {localize(section.props.title, locale, fallbackLocale)}
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              {localize(section.props.subtitle, locale, fallbackLocale)}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                type="button"
                onClick={() => onAction?.(section.props.primaryAction)}
                className="bg-primary-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center group"
              >
                {localize(section.props.primaryActionLabel, locale, fallbackLocale)}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                type="button"
                onClick={() => onAction?.(section.props.secondaryAction)}
                className="bg-background text-primary-900 px-8 py-4 rounded-lg font-semibold border-2 border-primary-600 hover:bg-primary-50 transition-colors"
              >
                {localize(section.props.secondaryActionLabel, locale, fallbackLocale)}
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-full overflow-hidden shadow-2xl bg-primary-50 aspect-square flex items-center justify-center">
              {media && (
                <img
                  src={media.src}
                  alt={localize(section.props.mediaAlt, locale, fallbackLocale)}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
