import { useEffect, useState } from 'react';
import { ArrowRight, Heart, Sparkles } from 'lucide-react';
import { Container, Section } from '../../../design-system';
import type {
  BuilderAction,
  BuilderSiteIdentity,
  HomeTopLikedSection,
} from '../../contracts';
import type { BuilderTopLikedProduct, BuilderTopLikedProvider } from '../../providers';
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    provider
      .getTopLikedProducts()
      .then((value) => {
        if (active) setProducts(value);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setProducts([]);
        }
      });

    return () => {
      active = false;
    };
  }, [provider]);

  const fallbackLocale = site.defaultLocale;

  if (failed || products?.length === 0) return null;

  if (products === null) {
    return (
      <Section spacing="standard" className="bg-gradient-to-b from-primary-50/50 to-transparent">
        <Container width={section.design.width}>
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent" />
          </div>
        </Container>
      </Section>
    );
  }

  return (
    <Section
      spacing={section.design.spacing}
      className="bg-gradient-to-b from-primary-50/50 to-transparent"
    >
      <Container width={section.design.width}>
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            {localize(section.props.title, locale, fallbackLocale)}
          </div>
          <h2 className="text-3xl md:text-4xl font-header font-bold text-primary-900 mb-3">
            {localize(section.props.title, locale, fallbackLocale)}
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {localize(section.props.subtitle, locale, fallbackLocale)}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {products.map((product) => (
            <button
              type="button"
              key={product.id}
              onClick={() => onAction?.(section.props.browseAction)}
              className="group text-left bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer hover:-translate-y-1"
            >
              <div className="aspect-square overflow-hidden bg-primary-50 relative">
                <img
                  src={product.imageSrc}
                  alt={localize(product.name, locale, fallbackLocale)}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
                {product.likeCount > 0 && (
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                    <Heart className="w-3.5 h-3.5 fill-primary-500 stroke-primary-500" />
                    <span className="text-xs font-semibold text-gray-700">
                      {product.likeCount}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-primary-900 text-sm mb-1 line-clamp-2 group-hover:text-primary-600 transition-colors">
                  {localize(product.name, locale, fallbackLocale)}
                </h3>
                <p className="text-primary-600 font-bold text-base">
                  {formatMoney(product, locale)}
                </p>
              </div>
            </button>
          ))}
        </div>

        <div className="text-center mt-10">
          <button
            type="button"
            onClick={() => onAction?.(section.props.browseAction)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg"
          >
            {localize(section.props.browseLabel, locale, fallbackLocale)}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </Container>
    </Section>
  );
}
