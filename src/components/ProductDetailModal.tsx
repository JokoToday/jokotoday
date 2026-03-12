import { useState, useEffect } from 'react';
import { X, Plus, Minus, Heart } from 'lucide-react';
import { CMSProduct } from '../lib/cmsService';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useLikes } from '../context/LikesContext';
import { getAvailabilityStatus } from '../lib/availabilityService';
import { getPublicImageUrl } from '../lib/storage';
import AlsoLikedSection from './AlsoLikedSection';

interface ProductDetailModalProps {
  product: CMSProduct | null;
  isOpen: boolean;
  onClose: () => void;
  selectedDay?: string | null;
  onLoginRequired?: () => void;
}

export default function ProductDetailModal({
  product,
  isOpen,
  onClose,
  selectedDay,
  onLoginRequired,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const { addToCart } = useCart();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { isLiked, getLikeCount, toggleProductLike } = useLikes();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setQuantity(1);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !product) return null;

  const availability = getAvailabilityStatus(product, selectedDay || null);
  const liked = isLiked(product.id);
  const likeCount = getLikeCount(product.id);

  const handleLikeClick = async () => {
    if (!user) {
      onLoginRequired?.();
      return;
    }
    setIsLikeAnimating(true);
    await toggleProductLike(product.id);
    setTimeout(() => setIsLikeAnimating(false), 300);
  };

  const handleAddToCart = () => {
    addToCart(product, quantity);
    setQuantity(1);
    onClose();
  };

  const getProductName = () => {
    if (language === 'th') return product.name_th;
    if (language === 'zh') return product.name_zh || product.name_en;
    return product.name_en;
  };

  const getProductDescription = () => {
    if (language === 'th') return product.desc_th;
    if (language === 'zh') return product.desc_zh || product.desc_en;
    return product.desc_en;
  };

  const getProductImage = () => {
    if (product.image) {
      if (product.image.startsWith('http')) return product.image;
      return getPublicImageUrl(`products/${product.image}`);
    }
    return 'https://images.pexels.com/photos/821365/pexels-photo-821365.jpeg';
  };

  const stockRemaining = product.stock_remaining;
  const isSoldOut = product.is_sold_out || stockRemaining === 0;

  const handleRecommendedProductClick = (recommendedProduct: CMSProduct) => {
    onClose();
    setTimeout(() => {
      const event = new CustomEvent('openProductDetail', { detail: recommendedProduct });
      window.dispatchEvent(event);
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-4xl mx-4 my-8 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-white/90 hover:bg-white rounded-full shadow-md transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="grid md:grid-cols-2 gap-0">
          <div className="relative aspect-square bg-primary-50">
            <img
              src={getProductImage()}
              alt={getProductName()}
              className="w-full h-full object-cover"
            />
            <button
              onClick={handleLikeClick}
              className={`
                absolute top-4 left-4 p-3 rounded-full shadow-lg
                transition-all duration-200 ease-out
                ${liked
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-white/95 text-gray-400 hover:text-primary-500 hover:bg-white'
                }
                ${isLikeAnimating ? 'scale-125' : 'scale-100'}
              `}
            >
              <Heart
                className={`
                  h-6 w-6 transition-all duration-200
                  ${liked ? 'fill-primary-600 stroke-primary-600' : 'fill-none stroke-current'}
                `}
              />
            </button>
            {likeCount > 0 && (
              <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md">
                <Heart className="h-4 w-4 fill-primary-500 stroke-primary-500" />
                <span className="text-sm font-semibold text-gray-700">{likeCount}</span>
                <span className="text-sm text-gray-500">
                  {language === 'th' ? 'ถูกใจ' : language === 'zh' ? '喜欢' : 'likes'}
                </span>
              </div>
            )}
          </div>

          <div className="p-6 md:p-8 flex flex-col">
            <h1 className="text-2xl md:text-3xl font-header font-bold text-primary-900 mb-3">
              {getProductName()}
            </h1>
            <p className="text-gray-600 mb-6 leading-relaxed">
              {getProductDescription()}
            </p>

            {selectedDay && (
              <div className="mb-4">
                {availability.isSoldOut ? (
                  <div className="flex items-center gap-1.5 text-sm font-medium text-red-600 bg-red-50 px-3 py-2 rounded-full w-fit">
                    <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                    {t.pickupDay.soldOutFor} {selectedDay}
                  </div>
                ) : availability.isNotOfferedToday ? (
                  <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 bg-gray-100 px-3 py-2 rounded-full w-fit">
                    <span className="w-2 h-2 bg-gray-600 rounded-full"></span>
                    {t.pickupDay.notAvailableFor} {selectedDay}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-sm font-medium text-green-600 bg-green-50 px-3 py-2 rounded-full w-fit">
                    <span className="w-2 h-2 bg-green-600 rounded-full"></span>
                    {t.pickupDay.availableFor} {selectedDay}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-4 mb-6">
              <span className="text-3xl font-bold text-primary-900">฿{product.price}</span>
              {isSoldOut && !selectedDay && (
                <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-full">
                  {t.product.soldOut}
                </span>
              )}
            </div>

            {stockRemaining !== null && stockRemaining !== undefined && stockRemaining > 0 && (
              <div className="mb-4">
                <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${
                  stockRemaining <= 5
                    ? 'bg-orange-100 text-orange-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {language === 'th' ? `เหลือ ${stockRemaining} ชิ้น` : language === 'zh' ? `仅剩 ${stockRemaining} 件` : `Only ${stockRemaining} left`}
                </span>
              </div>
            )}

            <div className="mt-auto">
              {!isSoldOut && availability.isAvailable && (
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-4 bg-primary-50 rounded-lg p-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="p-2 rounded-full bg-white text-primary-900 hover:bg-primary-100 transition-colors shadow-sm"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <span className="text-xl font-semibold w-16 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(stockRemaining || 999, quantity + 1))}
                      className="p-2 rounded-full bg-white text-primary-900 hover:bg-primary-100 transition-colors shadow-sm"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>

                  <button
                    onClick={handleAddToCart}
                    className="w-full bg-primary-600 text-white py-3.5 rounded-lg font-semibold text-lg hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg"
                  >
                    {t.product.addToCart} - ฿{product.price * quantity}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 md:px-8 pb-8">
          <AlsoLikedSection
            productId={product.id}
            onProductClick={handleRecommendedProductClick}
            selectedDay={selectedDay}
          />
        </div>
      </div>
    </div>
  );
}
