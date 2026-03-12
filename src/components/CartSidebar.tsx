import { X, ShoppingBag, Plus, Minus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AuthRequiredModal } from './AuthRequiredModal';
import { getPublicImageUrl } from '../lib/storage';

type CartSidebarProps = {
  onCheckout: () => void;
};

export default function CartSidebar({ onCheckout }: CartSidebarProps) {
  const { items, removeFromCart, updateQuantity, totalPrice, isCartOpen, setIsCartOpen } = useCart();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  if (!isCartOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-background shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-header font-bold text-primary-900 flex items-center">
            <ShoppingBag className="h-5 w-5 mr-2" />
            {t.cart.title}
          </h2>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t.cart.empty}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const getProductName = () => {
                  if (language === 'th') return item.product.name_th;
                  if (language === 'zh') return item.product.name_zh || item.product.name_en;
                  return item.product.name_en;
                };
                const productName = getProductName();

                const getImageUrl = () => {
                  const imageUrl = item.product.image_url;
                  if (!imageUrl || imageUrl.startsWith('http')) {
                    return imageUrl || 'https://images.pexels.com/photos/821365/pexels-photo-821365.jpeg';
                  }
                  return getPublicImageUrl(`products/${imageUrl}`);
                };

                return (
                  <div key={item.product.id} className="flex gap-4 bg-primary-50 p-3 rounded-lg">
                    <img
                      src={getImageUrl()}
                      alt={productName}
                      className="w-20 h-20 object-cover rounded"
                      loading="lazy"
                    />

                    <div className="flex-1">
                      <h3 className="font-semibold text-primary-900 text-sm">
                        {productName}
                      </h3>
                      <p className="text-primary-700 font-bold mt-1">
                        ฿{item.product.price}
                      </p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="p-1 rounded bg-background hover:bg-primary-100 transition-colors"
                          >
                            <Minus className="h-3 w-3 text-primary-900" />
                          </button>
                          <span className="text-sm font-medium w-8 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="p-1 rounded bg-background hover:bg-primary-100 transition-colors"
                          >
                            <Plus className="h-3 w-3 text-primary-900" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="p-1.5 text-accent hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-gray-200 p-4 space-y-4">
            {user ? (
              <>
                <div className="flex justify-between items-center text-lg font-bold">
                  <span className="text-gray-700">{t.cart.total}:</span>
                  <span className="text-primary-900">฿{totalPrice.toFixed(2)}</span>
                </div>

                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    onCheckout();
                  }}
                  className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  {t.cart.checkout}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="w-full font-bold text-sm transition-all"
                style={{
                  background: 'linear-gradient(135deg,#c6a75e 0%,#d4b96a 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px 0',
                  cursor: 'pointer',
                  letterSpacing: '0.03em',
                  boxShadow: '0 4px 16px rgba(198,167,94,0.32)',
                }}
              >
                {t.auth.signIn}
              </button>
            )}

            <button
              onClick={() => setIsCartOpen(false)}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              {t.cart.continueShopping}
            </button>
          </div>
        )}

        <AuthRequiredModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          actionType="cart"
        />
      </div>
    </>
  );
}
