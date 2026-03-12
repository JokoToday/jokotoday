import { useState } from 'react';
import { Plus, Minus, Heart } from 'lucide-react';
import { Product } from '../lib/supabase';
import { CMSProduct } from '../lib/cmsService';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useLikes } from '../context/LikesContext';
import { getAvailabilityStatus } from '../lib/availabilityService';
import { getPublicImageUrl } from '../lib/storage';

type ProductCardProps = {
  product: Product | CMSProduct;
  selectedDay?: string | null;
  onLoginRequired?: () => void;
};

export default function ProductCard({ product, selectedDay, onLoginRequired }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const { addToCart } = useCart();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { isLiked, getLikeCount, toggleProductLike } = useLikes();

  const availability = getAvailabilityStatus(product, selectedDay || null);

  const productId = product.id;
  const liked = isLiked(productId);
  const likeCount = getLikeCount(productId);

  const handleLikeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      onLoginRequired?.();
      return;
    }

    setIsLikeAnimating(true);
    await toggleProductLike(productId);
    setTimeout(() => setIsLikeAnimating(false), 300);
  };

  const handleAddToCart = () => {
    const cartItem = {
      ...product,
      name_en: 'name_en' in product ? product.name_en : 'product.name_en',
      name_th: 'name_th' in product ? product.name_th : 'product.name_th',
      name_zh: 'name_zh' in product ? product.name_zh : undefined,
      price: product.price,
    };
    addToCart(cartItem, quantity);
    setQuantity(1);
  };

  const getProductName = () => {
    if (language === 'th') return product.name_th;
    if (language === 'zh') return ('name_zh' in product && product.name_zh) || product.name_en;
    return product.name_en;
  };

  const getProductDescription = () => {
    if (language === 'th') {
      return 'desc_th' in product ? product.desc_th : product.description_th;
    }
    if (language === 'zh') {
      const zhDesc = 'desc_zh' in product ? product.desc_zh : ('description_zh' in product ? product.description_zh : null);
      if (zhDesc) return zhDesc;
      return 'desc_en' in product ? product.desc_en : product.description_en;
    }
    return 'desc_en' in product ? product.desc_en : product.description_en;
  };

  const productName = getProductName();
  const productDescription = getProductDescription();

  const stockRemaining = 'stock_remaining' in product ? product.stock_remaining : null;
  const isSoldOut = ('is_sold_out' in product ? product.is_sold_out : !product.is_available) || stockRemaining === 0;

  const getProductImage = () => {
    if ('image' in product) {
      if (product.image) {
        if (product.image.startsWith('http')) {
          return product.image;
        }
        return getPublicImageUrl(`products/${product.image}`);
      }
      return 'https://images.pexels.com/photos/821365/pexels-photo-821365.jpeg';
    }
    return product.image_url;
  };

  return (
    <div className="bg-background rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
      <div className="aspect-square overflow-hidden bg-primary-50 relative group">
        <img
          src={getProductImage()}
          alt={productName}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <button
          onClick={handleLikeClick}
          className={`
            absolute top-3 right-3 p-2 rounded-full shadow-md
            transition-all duration-200 ease-out
            ${liked
              ? 'bg-primary-100 text-primary-600'
              : 'bg-white/90 text-gray-400 hover:text-primary-500 hover:bg-white'
            }
            ${isLikeAnimating ? 'scale-125' : 'scale-100'}
            opacity-100 md:opacity-0 md:group-hover:opacity-100
          `}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <Heart
            className={`
              h-5 w-5 transition-all duration-200
              ${liked ? 'fill-primary-600 stroke-primary-600' : 'fill-none stroke-current'}
              ${isLikeAnimating ? 'scale-110' : 'scale-100'}
            `}
          />
        </button>
        {likeCount > 0 && (
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1 text-xs font-medium text-gray-700 shadow-sm">
            <Heart className="h-3 w-3 fill-primary-500 stroke-primary-500" />
            {likeCount}
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-primary-900 mb-2">{productName}</h3>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{productDescription}</p>

        {selectedDay && (
          <div className="mb-3">
            {availability.isSoldOut ? (
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2 py-1.5 rounded-full w-fit">
                <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                {t.pickupDay.soldOutFor} {selectedDay}
              </div>
            ) : availability.isNotOfferedToday ? (
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1.5 rounded-full w-fit">
                <span className="w-2 h-2 bg-gray-600 rounded-full"></span>
                {t.pickupDay.notAvailableFor} {selectedDay}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 px-2 py-1.5 rounded-full w-fit">
                <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                {t.pickupDay.availableFor} {selectedDay}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <span className="text-2xl font-bold text-primary-900">฿{product.price}</span>
          {isSoldOut && !selectedDay && (
            <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
              {t.product.soldOut}
            </span>
          )}
        </div>

        {stockRemaining !== null && stockRemaining > 0 && (
          <div className="mb-3">
            <span className={`text-xs font-medium px-2 py-1 rounded ${
              stockRemaining <= 5
                ? 'bg-orange-100 text-orange-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {language === 'th' ? `เหลือ ${stockRemaining} ชิ้น` : language === 'zh' ? `仅剩 ${stockRemaining} 件` : `Only ${stockRemaining} left`}
            </span>
          </div>
        )}

        {!isSoldOut && availability.isAvailable && (
          <div className="space-y-3">
            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-2 rounded-full bg-primary-100 text-primary-900 hover:bg-primary-200 transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="text-lg font-semibold w-12 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(stockRemaining || 999, quantity + 1))}
                className="p-2 rounded-full bg-primary-100 text-primary-900 hover:bg-primary-200 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={handleAddToCart}
              className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              {t.product.addToCart}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
