import { ChevronDown, ChevronUp, Minus, Plus, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { AuthRequiredModal } from './AuthRequiredModal';
import { FitsYourPickupV2 } from './FitsYourPickupV2';
import { PickupFinderStateV2, PickupFinderV2 } from './PickupFinderV2';
import { getPublicImageUrl } from '../lib/storage';

type CartSidebarProps = {
  onCheckout: () => void;
  onStartShopping: () => void;
};

const INITIAL_PICKUP_FINDER_STATE: PickupFinderStateV2 = {
  enabled: false,
  loading: false,
  hasCommonDates: null,
  selectedPickupDateId: null,
};

export default function CartSidebar({ onCheckout, onStartShopping }: CartSidebarProps) {
  const { items, removeFromCart, updateQuantity, totalPrice, isCartOpen, setIsCartOpen } = useCart();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { getLabel } = useCMSLabels();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pickupFinderState, setPickupFinderState] = useState<PickupFinderStateV2>(INITIAL_PICKUP_FINDER_STATE);
  const [pickupToolsOpen, setPickupToolsOpen] = useState(false);

  useEffect(() => {
    if (isCartOpen) setPickupToolsOpen(false);
  }, [isCartOpen]);

  useEffect(() => {
    if (pickupFinderState.enabled && pickupFinderState.hasCommonDates === false) {
      setPickupToolsOpen(true);
    }
  }, [pickupFinderState.enabled, pickupFinderState.hasCommonDates]);

  if (!isCartOpen) return null;

  const startShoppingLabel =
    language === 'th'
      ? 'เริ่มเลือกซื้อสินค้า'
      : language === 'zh'
        ? '开始选购'
        : 'Start shopping';
  const pickupToolsLabel = getLabel(
    'pickup_tools.title',
    language,
    language === 'th' ? 'เครื่องมือรับสินค้า' : language === 'zh' ? '智能取货工具' : 'Pickup tools',
  );
  const pickupToolsHelper = getLabel(
    'pickup_tools.helper',
    language,
    language === 'th'
      ? 'ค้นหาวันรับร่วมกันและดูสินค้าที่เพิ่มได้โดยไม่เปลี่ยนวันรับ'
      : language === 'zh'
        ? '查找共同取货日期，并查看不会改变已选日期的可加购商品。'
        : 'Find common pickup dates and compatible add-ons when you need them.',
  );
  const keepShoppingLabel = getLabel(
    'cart.keep_shopping_prompt',
    language,
    language === 'th' ? 'อยากเพิ่มอะไรอีกไหม? เลือกซื้อสินค้าต่อ' : language === 'zh' ? '还需要什么吗？继续选购' : 'Need anything else? Keep shopping',
  );
  const checkoutBlockedByFinder = pickupFinderState.enabled
    && (pickupFinderState.loading || pickupFinderState.hasCommonDates === false);

  const keepShopping = () => {
    setIsCartOpen(false);
    onStartShopping();
  };

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
              <p className="text-gray-500 mb-6">{t.cart.empty}</p>
              <button
                onClick={keepShopping}
                className="bg-primary-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                {startShoppingLabel}
              </button>
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
                  const imageUrl = item.product.image_url ?? item.product.image;
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
                      <h3 className="font-semibold text-primary-900 text-sm">{productName}</h3>
                      <p className="text-primary-700 font-bold mt-1">฿{item.product.price}</p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="p-1 rounded bg-background hover:bg-primary-100 transition-colors"
                          >
                            <Minus className="h-3 w-3 text-primary-900" />
                          </button>
                          <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
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

              {pickupFinderState.enabled && (
                <button
                  type="button"
                  onClick={() => setPickupToolsOpen((open) => !open)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    pickupFinderState.hasCommonDates === false
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className={`w-5 h-5 mt-0.5 shrink-0 ${pickupFinderState.hasCommonDates === false ? 'text-orange-700' : 'text-amber-700'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{pickupToolsLabel}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{pickupToolsHelper}</p>
                    </div>
                    {pickupToolsOpen ? <ChevronUp className="w-4 h-4 text-gray-500 mt-0.5" /> : <ChevronDown className="w-4 h-4 text-gray-500 mt-0.5" />}
                  </div>
                </button>
              )}

              <div className={pickupToolsOpen ? 'space-y-4' : 'hidden'}>
                <PickupFinderV2 onStateChange={setPickupFinderState} />

                {pickupFinderState.enabled
                  && !pickupFinderState.loading
                  && pickupFinderState.hasCommonDates === true
                  && pickupFinderState.selectedPickupDateId && (
                    <FitsYourPickupV2 pickupDateId={pickupFinderState.selectedPickupDateId} placement="cart" />
                  )}
              </div>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-gray-200 p-4 space-y-3">
            <div className="flex justify-between items-center text-lg font-bold">
              <span className="text-gray-700">{t.cart.total}:</span>
              <span className="text-primary-900">฿{totalPrice.toFixed(2)}</span>
            </div>

            <button
              type="button"
              onClick={keepShopping}
              className="w-full bg-white border border-amber-200 text-amber-900 py-3 rounded-lg font-semibold hover:bg-amber-50 transition-colors"
            >
              {keepShoppingLabel}
            </button>

            {user ? (
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  onCheckout();
                }}
                disabled={checkoutBlockedByFinder}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {pickupFinderState.loading
                  ? (language === 'th' ? 'กำลังตรวจสอบวันรับสินค้า…' : language === 'zh' ? '正在检查取货日期…' : 'Checking pickup dates…')
                  : t.cart.checkout}
              </button>
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
