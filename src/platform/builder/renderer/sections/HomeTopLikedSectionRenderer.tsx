import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Container, Section } from '../../../design-system';
import type {
  BuilderAction,
  BuilderSiteIdentity,
  HomeTopLikedSection,
} from '../../contracts';
import type { BuilderTopLikedProduct, BuilderTopLikedProvider } from '../../providers';
import { localizeRichText } from '../../richText';
import { BuilderRichTextContent } from '../BuilderRichTextContent';
import { localize } from '../localize';

interface HomeTopLikedSectionRendererProps {
  section: HomeTopLikedSection;
  locale: string;
  site: BuilderSiteIdentity;
  provider: BuilderTopLikedProvider;
  onAction?: (action: BuilderAction) => void;
}

function formatMoney(product: BuilderTopLikedProduct, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: product.price.currency,
      maximumFractionDigits: 0,
    }).format(product.price.amount);
  } catch {
    return `${product.price.currency} ${product.price.amount}`;
  }
}

export function HomeTopLikedSectionRenderer({
  section,
  locale,
  site,
  provider,
  onAction,
}: HomeTopLikedSectionRendererProps) {
  const [products, setProducts] = useState<BuilderTopLikedProduct[] | null>(null);

  useEffect(() => {
    let active = true;
    provider.getTopLikedProducts()
      .then((value) => { if (active) setProducts(value); })
      .catch(() => { if (active) setProducts([]); });
    return () => { active = false; };
  }, [provider]);

  const fallbackLocale = site.defaultLocale;
  const plainTitle = localize(section.props.title, locale, fallbackLocale);
  const plainSubtitle = localize(section.props.subtitle, locale, fallbackLocale);
  const title = localizeRichText(
    section.props.titleRichText,
    locale,
    fallbackLocale,
    plainTitle,
  );
  const subtitle = localizeRichText(
    section.props.subtitleRichText,
    locale,
    fallbackLocale,
    plainSubtitle,
  );

  if (products?.length === 0) return null;

  return (
    <Section
      id="popular-right-now"
      spacing={section.design.spacing}
      className="bg-[#F4EFE5]"
    >
      <Container width={section.design.width}>
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-semibold uppercase tracking-[0.2em] text-[#55766F]" style={{ fontSize: 'var(--joko-size-label, 11px)' }}>From the bakery</p>
            <h2 className="mt-2 whitespace-pre-line font-semibold tracking-[-0.03em]" style={{ fontFamily: 'var(--joko-font-display)', fontSize: 'var(--joko-size-section-heading, 36px)', color: 'var(--joko-brand-text, #303532)' }}>
              <BuilderRichTextContent value={title} />
            </h2>
            <p className="mt-2 max-w-2xl whitespace-pre-line leading-6 text-[#303532]/62" style={{ fontSize: 'var(--joko-size-body, 16px)' }}>
              <BuilderRichTextContent value={subtitle} />
            </p>
          </div>
          <button
            type="button"
            onClick={() => onAction?.(section.props.browseAction)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#A44F1D] hover:text-[#7E3C18]"
          >
            {localize(section.props.browseLabel, locale, fallbackLocale)}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {products === null ? (
          <div className="h-36 animate-pulse rounded-[1.7rem] bg-[#55766F]/8" />
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {products.slice(0, 4).map((product, index) => (
              <button
                type="button"
                key={product.id}
                onClick={() => onAction?.(section.props.browseAction)}
                className="group overflow-hidden border border-[#55766F]/14 bg-[#FFF9EE] text-left shadow-[0_12px_30px_rgba(48,75,69,.07)] transition hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(48,75,69,.12)]"
                style={{ borderRadius: index % 2 === 0 ? '1.55rem 1.9rem 1.62rem 1.82rem' : '1.85rem 1.55rem 1.95rem 1.5rem' }}
              >
                <div className="aspect-[4/3] overflow-hidden bg-[#E5E0D0]">
                  <img
                    src={product.imageSrc}
                    alt={localize(product.name, locale, fallbackLocale)}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-[#303532]">{localize(product.name, locale, fallbackLocale)}</h3>
                  <p className="mt-2 font-semibold text-[#A44F1D]" style={{ fontFamily: 'var(--joko-font-display)' }}>
                    {formatMoney(product, locale)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
