import { useState, useEffect } from 'react';
import { Heart, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CMSProduct } from '../lib/cmsService';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { getPublicImageUrl } from '../lib/storage';

interface TopLikedProduct extends CMSProduct {
  like_count: number;
}

interface TopLikedSectionProps {
  onNavigate: (page: string) => void;
  onProductClick?: () => void;
}

export default function TopLikedSection({ onNavigate, onProductClick }: TopLikedSectionProps) {
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();
  const [products, setProducts] = useState<TopLikedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopLikedProducts();
  }, []);

  const fetchTopLikedProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('top_liked_products')
        .select('*');

      if (error) throw error;
      setProducts((data as TopLikedProduct[]) || []);
    } catch (error) {
      console.error('Error fetching top liked products:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProductName = (product: TopLikedProduct) => {
    if (language === 'th') return product.name_th;
    if (language === 'zh') return product.name_zh;
    return product.name_en;
  };

  const getProductImage = (product: TopLikedProduct) => {
    if (product.image) {
      if (product.image.startsWith('http')) {
        return product.image;
      }
      return getPublicImageUrl(product.image);
    }
    return 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400';
  };

  if (loading) {
    return (
      <section className="py-12 bg-gradient-to-b from-primary-50/50 to-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-600 border-r-transparent"></div>
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return null;
  }

  const title = getLabel('mostLoved.title', language, 'Most Loved Right Now');
  const subtitle = getLabel('mostLoved.subtitle', language, 'Customer favorites from our community');
  const browseAll = getLabel('mostLoved.browseAll', language, 'Browse All Products');

  return (
    <section className="py-16 bg-gradient-to-b from-primary-50/50 to-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            {title}
          </div>
          <h2 className="text-3xl md:text-4xl font-header font-bold text-primary-900 mb-3">
            {title}
          </h2>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            {subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="group bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden cursor-pointer hover:-translate-y-1"
              onClick={onProductClick}
            >
              <div className="aspect-square overflow-hidden bg-primary-50 relative">
                <img
                  src={getProductImage(product)}
                  alt={getProductName(product)}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                />
                {product.like_count > 0 && (
                  <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md">
                    <Heart className="w-3.5 h-3.5 fill-primary-500 stroke-primary-500" />
                    <span className="text-xs font-semibold text-gray-700">
                      {product.like_count}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-primary-900 text-sm mb-1 line-clamp-2 group-hover:text-primary-600 transition-colors">
                  {getProductName(product)}
                </h3>
                <p className="text-primary-600 font-bold text-base">
                  ฿{product.price}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <button
            onClick={() => onNavigate('products')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg"
          >
            {browseAll}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
