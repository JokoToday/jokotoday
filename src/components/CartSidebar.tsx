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
import { jokoBrandingCssVariables } from '../platform/builder/branding';
import { usePublishedJokoBranding } from '../app/joko-today/builder/usePublishedJokoLogo';

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
  const { branding } = usePublishedJokoBranding();
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
  const cartBrandingStyle = jokoBrandingCssVariables(branding, language);

  const keepShopping = () => {
    setIsCartOpen(false);
    onStartShopping();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#303532]/35 backdrop-blur-[1px]"
        onClick={() => setIsCartOpen(false)}
      />

      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-[#F4EFE5] shadow-2xl sm:w-96"
        style={{ ...cartBrandingStyle, fontFamily: 'var(--joko-font-shell)' }}
      >
        <div className="flex items-center justify-between border-b border-[#55766F]/15 bg-background p-4 sm:p-5">
          <h2
            className="flex items-center text-2xl font-semibold tracking-[-0.03em] text-[#292D2B]"
            style={{
              fontFamily: 'var(--joko-font-display)',
              fontWeight: 'var(--joko-font-display-weight)',
            }}
          >
            <ShoppingBag className="mr-2 h-5 w-5 text-[#C76624]" />
            {t.cart.title}
          </h2>
          <button
            onClick={() => setIsCartOpen(false)}
            className="rounded-full p-2 text-[#303532]/70 transition-colors hover:bg-white/35 hover:text-[#303532]"
            aria-label={language === 'th' ? 'ปิดตะกร้า' : language === 'zh' ? '关闭购物车' : 'Close cart'}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-6">{t.cart.empty}</p>
              <button
                onClick={keepShopping}
                className="rounded-xl bg-[#C76624] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#A95120]"
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
                  <div key={item.product.id} className="flex gap-4 rounded-2xl border border-[#55766F]/15 bg-[#FFF9EE] p-3 shadow-[0_8px_24px_rgba(48,75,69,0.06)]">
                    <img
                      src={getImageUrl()}
                      alt={productName}
                      className="h-20 w-20 rounded-xl object-cover"
                      loading="lazy"
                    />

                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-[#292D2B]">{productName}</h3>
                      <p className="mt-1 font-bold text-[#C76624]">฿{item.product.price}</p>

                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            className="rounded-lg border border-[#55766F]/15 bg-white/70 p-1 transition-colors hover:bg-[#CFE3DF]/35"
                          >
                            <Minus className="h-3 w-3 text-[#303532]" />
                          </button>
                          <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            className="rounded-lg border border-[#55766F]/15 bg-white/70 p-1 transition-colors hover:bg-[#CFE3DF]/35"
                          >
                            <Plus className="h-3 w-3 text-[#303532]" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="rounded-lg p-1.5 text-[#C76624] transition-colors hover:bg-[#F9E9E5]"
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
          <div className="space-y-3 border-t border-[#55766F]/15 bg-[#FFF9EE] p-4">
            <div className="flex justify-between items-center text-lg font-bold">
              <span className="text-[#303532]/75">{t.cart.total}:</span>
              <span className="text-[#292D2B]">฿{totalPrice.toFixed(2)}</span>
            </div>

            <button
              type="button"
              onClick={keepShopping}
              className="w-full rounded-xl border border-[#C76624]/35 bg-white/65 py-3 font-semibold text-[#7F3F1D] transition-colors hover:bg-[#FFF2E2]"
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
                className="w-full rounded-xl bg-[#C76624] py-3 font-semibold text-white transition-colors hover:bg-[#A95120] disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {pickupFinderState.loading
                  ? (language === 'th' ? 'กำลังตรวจสอบวันรับสินค้า…' : language === 'zh' ? '正在检查取货日期…' : 'Checking pickup dates…')
                  : t.cart.checkout}
              </button>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                aria-haspopup="dialog"
                className="w-full rounded-xl bg-[#C76624] py-3.5 text-sm font-bold tracking-[0.03em] text-white shadow-lg shadow-[#C76624]/20 transition-colors hover:bg-[#A95120] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C76624] focus-visible:ring-offset-2"
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
