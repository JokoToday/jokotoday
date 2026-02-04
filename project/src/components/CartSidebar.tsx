import { X, ShoppingBag, Plus, Minus, Trash2, Mail } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';

type CartSidebarProps = {
  onCheckout: () => void;
};

export default function CartSidebar({ onCheckout }: CartSidebarProps) {
  const { items, removeFromCart, updateQuantity, totalPrice, isCartOpen, setIsCartOpen } = useCart();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalAction, setAuthModalAction] = useState<'signin' | 'signup'>('signin');

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
                const productName = language === 'th' ? item.product.name_th : item.product.name_en;
                return (
                  <div key={item.product.id} className="flex gap-4 bg-primary-50 p-3 rounded-lg">
                    <img
                      src={item.product.image_url}
                      alt={productName}
                      className="w-20 h-20 object-cover rounded"
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
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-900">Sign in to checkout</p>
                <p className="text-xs text-gray-600">
                  Create an account or log in to proceed with your order
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setAuthModalAction('signin');
                      setIsAuthModalOpen(true);
                    }}
                    className="w-full bg-amber-600 text-white py-2.5 rounded-lg font-medium hover:bg-amber-700 transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Log in with Email
                  </button>
                  <button
                    onClick={() => {
                      setAuthModalAction('signup');
                      setIsAuthModalOpen(true);
                    }}
                    className="w-full bg-white border-2 border-amber-600 text-amber-600 py-2.5 rounded-lg font-medium hover:bg-amber-50 transition-colors text-sm"
                  >
                    Create Account
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setIsCartOpen(false)}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              {t.cart.continueShopping}
            </button>
          </div>
        )}

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialAction={authModalAction}
        />
      </div>
    </>
  );
}
