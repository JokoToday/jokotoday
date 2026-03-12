import { Heart, Users } from 'lucide-react';
import { useProductRecommendations } from '../hooks/useProductRecommendations';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { getPublicImageUrl } from '../lib/storage';
import { CMSProduct } from '../lib/cmsService';

interface AlsoLikedSectionProps {
  productId: string | null;
  onProductClick?: (product: CMSProduct) => void;
  selectedDay?: string | null;
}

export default function AlsoLikedSection({ productId, onProductClick, selectedDay }: AlsoLikedSectionProps) {
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();
  const { recommendations, loading } = useProductRecommendations(productId);

  const getProductName = (product: CMSProduct) => {
    if (language === 'th') return product.name_th;
    if (language === 'zh') return product.name_zh || product.name_en;
    return product.name_en;
  };

  const getProductImage = (product: CMSProduct) => {
    if (product.image) {
      if (product.image.startsWith('http')) {
        return product.image;
      }
      return getPublicImageUrl(`products/${product.image}`);
    }
    return 'https://images.pexels.com/photos/821365/pexels-photo-821365.jpeg';
  };

  if (loading) {
    return (
      <section className="mt-16">
        <div className="border-t border-primary-100 pt-12">
          <div className="text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-primary-600 border-r-transparent"></div>
          </div>
        </div>
      </section>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const title = getLabel('alsoLiked.title', language, 'People Who Liked This Also Liked');
  const subtitle = getLabel('alsoLiked.subtitle', language, 'More favorites from our community');

  return (
    <section className="mt-16">
      <div className="border-t border-primary-100 pt-12">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-6 h-6 text-primary-600" />
          <h2 className="text-2xl font-header font-semibold text-primary-900">
            {title}
          </h2>
        </div>
        <p className="text-gray-500 mb-8">
          {subtitle}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {recommendations.map((product) => (
            <div
              key={product.id}
              onClick={() => onProductClick?.(product)}
              className="group bg-white rounded-xl shadow-sm hover:shadow-lg cursor-pointer overflow-hidden transition-all duration-300 hover:-translate-y-1"
            >
              <div className="aspect-square overflow-hidden bg-primary-50 relative">
                <img
                  src={getProductImage(product)}
                  alt={getProductName(product)}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                {product.co_like_count > 0 && (
                  <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                    <Heart className="w-3.5 h-3.5 fill-primary-500 stroke-primary-500" />
                    <span className="text-xs font-semibold text-gray-700">
                      {product.co_like_count}
                    </span>
                    <span className="text-xs text-gray-500">
                      {language === 'th' ? 'คนชอบทั้งคู่' : language === 'zh' ? '人同时喜欢' : 'also liked'}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-primary-900 mb-1 line-clamp-2 group-hover:text-primary-600 transition-colors">
                  {getProductName(product)}
                </h3>
                <p className="text-primary-600 font-bold text-lg">
                  ฿{product.price}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
