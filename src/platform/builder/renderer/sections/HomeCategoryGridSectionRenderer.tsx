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
  const className = 'h-7 w-7 text-[#55766F]';
  const iconMap: Record<string, ReactNode> = {
    croissants: <Croissant className={className} />,
    breads: <Wheat className={className} />,
    cakes: <Cookie className={className} />,
    quiche: <Pizza className={className} />,
  };
  return iconMap[iconKey ?? ''] ?? <Croissant className={className} />;
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
    provider.getCategories()
      .then((value) => { if (active) setCategories(value); })
      .catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [provider]);

  if (categories?.length === 0) return null;
  const fallbackLocale = site.defaultLocale;

  return (
    <Section
      spacing={section.design.spacing}
      style={{ background: 'var(--joko-brand-turquoise, #DAEBE8)' }}
    >
      <Container width={section.design.width}>
        <h2 className="font-semibold tracking-[-0.03em]" style={{ fontFamily: 'var(--joko-font-display)', fontSize: 'var(--joko-size-section-heading, 36px)', color: 'var(--joko-brand-text, #303532)' }}>
          {localize(section.props.title, locale, fallbackLocale)}
        </h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(categories ?? []).map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onAction?.({ type: 'commerce.browseCategory', categoryId: item.id })}
              className="border border-[#55766F]/14 bg-[#FFF9EE]/88 p-5 text-left shadow-[0_10px_24px_rgba(48,75,69,.06)] transition hover:-translate-y-0.5"
              style={{ borderRadius: index % 2 === 0 ? '1.45rem 1.75rem 1.5rem 1.8rem' : '1.75rem 1.45rem 1.85rem 1.4rem' }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#D9ECE9]">{getCategoryIcon(item.iconKey)}</span>
              <h3 className="mt-4 font-semibold text-[#303532]">{localize(item.name, locale, fallbackLocale)}</h3>
            </button>
          ))}
        </div>
      </Container>
    </Section>
  );
}
