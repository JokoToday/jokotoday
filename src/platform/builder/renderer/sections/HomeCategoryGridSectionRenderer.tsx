import { useEffect, useState, type ReactNode } from 'react';
import { Cookie, Croissant, Pizza, Wheat } from 'lucide-react';
import { Container, Section } from '../../../design-system';
import type {
  BuilderAction,
  BuilderSiteIdentity,
  HomeCategoryGridSection,
} from '../../contracts';
import type { BuilderCategory, BuilderCategoryProvider } from '../../providers';
import { localize } from '../localize';

interface HomeCategoryGridSectionRendererProps {
  section: HomeCategoryGridSection;
  locale: string;
  site: BuilderSiteIdentity;
  provider: BuilderCategoryProvider;
  onAction?: (action: BuilderAction) => void;
}

function getCategoryIcon(iconKey?: string): ReactNode {
  const iconMap: Record<string, ReactNode> = {
    croissants: <Croissant className="h-8 w-8 text-primary-700" />,
    breads: <Wheat className="h-8 w-8 text-primary-700" />,
    cakes: <Cookie className="h-8 w-8 text-primary-700" />,
    quiche: <Pizza className="h-8 w-8 text-primary-700" />,
  };

  return iconMap[iconKey ?? ''] ?? <Croissant className="h-8 w-8 text-primary-700" />;
}

export function HomeCategoryGridSectionRenderer({
  section,
  locale,
  site,
  provider,
  onAction,
}: HomeCategoryGridSectionRendererProps) {
  const [categories, setCategories] = useState<BuilderCategory[] | null>(null);

  useEffect(() => {
    let active = true;
    provider
      .getCategories()
      .then((value) => {
        if (active) setCategories(value);
      })
      .catch(() => {
        if (active) setCategories([]);
      });

    return () => {
      active = false;
    };
  }, [provider]);

  if (categories?.length === 0) return null;

  const fallbackLocale = site.defaultLocale;

  return (
    <Section spacing={section.design.spacing} className="bg-background">
      <Container width={section.design.width}>
        <h2 className="text-3xl md:text-4xl font-header font-bold text-center text-primary-900 mb-12">
          {localize(section.props.title, locale, fallbackLocale)}
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {(categories ?? []).map((category) => (
            <button
              type="button"
              key={category.id}
              onClick={() =>
                onAction?.({
                  type: 'commerce.browseCategory',
                  categoryId: category.id,
                })
              }
              className="text-center space-y-4 p-6 rounded-lg hover:bg-primary-100 transition-all duration-200 cursor-pointer group"
            >
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto group-hover:bg-primary-200 transition-colors duration-200">
                {getCategoryIcon(category.iconKey)}
              </div>
              <h3 className="text-lg font-semibold text-primary-900 group-hover:text-primary-700 transition-colors">
                {localize(category.name, locale, fallbackLocale)}
              </h3>
              <p className="text-gray-600 text-sm">
                {localize(category.description, locale, fallbackLocale)}
              </p>
            </button>
          ))}
        </div>
      </Container>
    </Section>
  );
}
