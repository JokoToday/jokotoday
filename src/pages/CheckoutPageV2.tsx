import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Calendar, CheckCircle, ExternalLink, MapPin, ShoppingBag, Sparkles } from 'lucide-react';
import { AuthRequiredModal } from '../components/AuthRequiredModal';
import { FitsYourPickupV2 } from '../components/FitsYourPickupV2';
import { PickupDateSelectorV2, PickupSelectionV2 } from '../components/PickupDateSelectorV2';
import { ProfileCompletionModal } from '../components/ProfileCompletionModal';
import { OrderPrintButtonById } from '../components/orders/OrderPrintButtonById';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { CMSProduct } from '../lib/cmsService';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import {
  CommonPickupDateAvailability,
  getCommonPickupDates,
  getCustomerPickupAvailabilityV2,
} from '../lib/pickupAvailabilityV2';
import {
  clearPreferredPickupDateV2,
  readPreferredPickupDateV2,
  writePreferredPickupDateV2,
} from '../lib/pickupV2PreferredSelection';
import { cancelOnlineOrderByVersion, createOnlineOrderV2 } from '../lib/orderServiceV2';
import { supabase } from '../lib/supabase';

interface CheckoutPageV2Props {
  onNavigate: (page: string) => void;
}

interface SecureOrderItem {
  product_id: string;
  product_name?: string;
  product_name_th?: string | null;
  product_name_zh?: string | null;
  quantity: number;
  price_at_order: number | string;
}

function formatStoredPickupDate(isoDate: string, language: 'en' | 'th' | 'zh'): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function CheckoutPageV2({ onNavigate }: CheckoutPageV2Props) {
  const { items, totalPrice, clearCart, updateQuantity, removeFromCart, setIsCartOpen } = useCart();
  const { user, userProfile, profileLoading } = useAuth();
  const { language, t } = useLanguage();
  const { getLabel } = useCMSLabels();

  const [selection, setSelection] = useState<PickupSelectionV2 | null>(null);
  const [checkoutDates, setCheckoutDates] = useState<CommonPickupDateAvailability[]>([]);
  const [preferredSelectionResolved, setPreferredSelectionResolved] = useState(false);
  const [showPickupEditor, setShowPickupEditor] = useState(false);
  const pickupEditSessionRef = useRef(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [orderAttemptReference, setOrderAttemptReference] = useState('');
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderPickupDateId, setOrderPickupDateId] = useState<string | null>(null);
  const [completedPickupDate, setCompletedPickupDate] = useState('');
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedItems, setCompletedItems] = useState<SecureOrderItem[]>([]);
  const [completedLoyaltyPoints, setCompletedLoyaltyPoints] = useState(0);
  const [orderLocationName, setOrderLocationName] = useState('');
  const [orderLocationMapsUrl, setOrderLocationMapsUrl] = useState('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showCelebrationOnProfile, setShowCelebrationOnProfile] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  const requirements = useMemo(
    () => items.map((item) => ({
      productId: item.product.id,
      quantity: item.quantity,
      nameEn: item.product.name_en,
      nameTh: item.product.name_th,
      nameZh: item.product.name_zh || null,
    })),
    [items],
  );

  useEffect(() => {
    if (user && !profileLoading && (!userProfile || !userProfile.profile_completed)) {
      setIsProfileModalOpen(true);
      const hasSeenCelebration = sessionStorage.getItem(`celebration_seen_${user.id}`);
      if (!hasSeenCelebration) {
        setShowCelebrationOnProfile(true);
        sessionStorage.setItem(`celebration_seen_${user.id}`, 'true');
      }
    }
  }, [user, userProfile, profileLoading]);

  useEffect(() => {
    let cancelledLoad = false;

    async function resolvePreferredSelection() {
      if (requirements.length === 0) {
        setCheckoutDates([]);
        setPreferredSelectionResolved(true);
        return;
      }

      if (!pickupEditSessionRef.current) setPreferredSelectionResolved(false);
      try {
        const productIds = Array.from(new Set(requirements.map(({ productId }) => productId)));
        const rows = await getCustomerPickupAvailabilityV2(productIds);
        if (cancelledLoad) return;

        const dates = getCommonPickupDates(rows, requirements);
        setCheckoutDates(dates);

        if (pickupEditSessionRef.current) return;

        const preferred = readPreferredPickupDateV2(user?.id ?? null);
        if (!preferred) {
          setSelection(null);
          pickupEditSessionRef.current = true;
          setShowPickupEditor(true);
          return;
        }

        const preferredDate = dates.find((date) => date.pickupDateId === preferred.pickupDateId);
        if (!preferredDate) {
          clearPreferredPickupDateV2(user?.id ?? null);
          setSelection(null);
          pickupEditSessionRef.current = true;
          setShowPickupEditor(true);
          return;
        }

        const preferredLocation = preferred.pickupLocationId
          ? preferredDate.locations.find((location) => location.id === preferred.pickupLocationId) || null
          : null;
        const resolvedLocation = preferredLocation
          || (preferredDate.locations.length === 1 ? preferredDate.locations[0] : null);

        if (!resolvedLocation) {
          setSelection(null);
          pickupEditSessionRef.current = true;
          setShowPickupEditor(true);
          return;
        }

        setSelection({
          pickupDateId: preferredDate.pickupDateId,
          pickupDate: preferredDate.pickupDate,
          pickupLocationId: resolvedLocation.id,
          scheduleId: preferredDate.scheduleId,
          scheduleKey: preferredDate.scheduleKey,
        });
        pickupEditSessionRef.current = false;
        setShowPickupEditor(false);
      } catch (error) {
        if (!cancelledLoad) {
          console.error('Could not resolve preferred Pickup v2 selection:', error);
          setCheckoutDates([]);
          setSelection(null);
          pickupEditSessionRef.current = true;
          setShowPickupEditor(true);
        }
      } finally {
        if (!cancelledLoad) setPreferredSelectionResolved(true);
      }
    }

    void resolvePreferredSelection();
    return () => {
      cancelledLoad = true;
    };
  }, [requirements, user?.id]);

  const selectedCheckoutDate = selection
    ? checkoutDates.find((date) => date.pickupDateId === selection.pickupDateId) || null
    : null;
  const selectedCheckoutLocation = selectedCheckoutDate && selection
    ? selectedCheckoutDate.locations.find((location) => location.id === selection.pickupLocationId) || null
    : null;

  const getPickupLocationName = () => {
    if (!selectedCheckoutLocation) return '';
    if (language === 'th') return selectedCheckoutLocation.name_th || selectedCheckoutLocation.name_en;
    if (language === 'zh') return selectedCheckoutLocation.name_zh || selectedCheckoutLocation.name_en;
    return selectedCheckoutLocation.name_en;
  };

  const beginPickupEdit = () => {
    pickupEditSessionRef.current = true;
    setShowPickupEditor(true);
  };

  const cancelPickupEdit = () => {
    if (!selection) return;
    pickupEditSessionRef.current = false;
    setShowPickupEditor(false);
  };

  const backToCart = () => {
    onNavigate('products');
    window.setTimeout(() => setIsCartOpen(true), 0);
  };

  const continueShopping = () => {
    setIsCartOpen(false);
    onNavigate('products');
  };

  const openRecommendedProduct = (product: CMSProduct) => {
    setIsCartOpen(false);
    if (product.slug) {
      onNavigate(`product/${product.slug}`);
      return;
    }
    onNavigate('products');
  };

  const handlePickupSelectionChange = (next: PickupSelectionV2 | null) => {
    setSelection(next);
    if (!next) {
      pickupEditSessionRef.current = true;
      setShowPickupEditor(true);
      return;
    }

    const date = checkoutDates.find((candidate) => candidate.pickupDateId === next.pickupDateId);
    writePreferredPickupDateV2(user?.id ?? null, {
      pickupDateId: next.pickupDateId,
      pickupDate: next.pickupDate,
      pickupLocationId: next.pickupLocationId,
      scheduleId: next.scheduleId,
      scheduleKey: next.scheduleKey,
      scheduleLabelEn: date?.scheduleLabelEn || next.scheduleKey,
      scheduleLabelTh: date?.scheduleLabelTh || null,
      scheduleLabelZh: date?.scheduleLabelZh || null,
    });
    pickupEditSessionRef.current = false;
    setShowPickupEditor(false);
  };

  const getItemName = (item: SecureOrderItem) => {
    if (language === 'th') return item.product_name_th || item.product_name || '';
    if (language === 'zh') return item.product_name_zh || item.product_name || '';
    return item.product_name || '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError('');

    if (!selection || showPickupEditor) {
      setSubmitError(language === 'th'
        ? 'กรุณายืนยันวันและสถานที่รับสินค้าก่อนสั่งซื้อ'
        : language === 'zh'
          ? '下单前请先确认取货日期和地点。'
          : 'Please confirm your pickup date and location before placing your order.');
      return;
    }
    if (items.length === 0) {
      setSubmitError(t.cart.empty);
      return;
    }
    if (!user || !userProfile) {
      setIsAuthModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const orderReference = orderAttemptReference
        || `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      if (!orderAttemptReference) setOrderAttemptReference(orderReference);

      const order = await createOnlineOrderV2({
        orderNumber: orderReference,
        pickupDateId: selection.pickupDateId,
        pickupLocationId: selection.pickupLocationId,
        items: items.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        notes,
      });

      const serverItems = Array.isArray(order.order_items)
        ? (order.order_items as SecureOrderItem[])
        : [];

      setOrderId(order.id);
      setOrderNumber(order.order_number);
      setOrderPickupDateId(order.pickup_date_id || selection.pickupDateId);
      setCompletedPickupDate(order.pickup_date || selection.pickupDate);
      setCompletedTotal(Number(order.total_amount) || totalPrice);
      setCompletedLoyaltyPoints(Number(order.loyalty_points_earned) || 0);
      setCompletedItems(serverItems.length > 0 ? serverItems : items.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name_en,
        product_name_th: item.product.name_th,
        product_name_zh: item.product.name_zh,
        quantity: item.quantity,
        price_at_order: item.product.price,
      })));

      const locationId = order.pickup_location_id || selection.pickupLocationId;
      if (locationId) {
        const { data: location } = await supabase
          .from('cms_pickup_locations')
          .select('name_en, name_th, name_zh, maps_url')
          .eq('id', locationId)
          .maybeSingle();

        if (location) {
          const localizedName = language === 'th'
            ? location.name_th
            : language === 'zh'
              ? location.name_zh
              : location.name_en;
          setOrderLocationName(localizedName || location.name_en || '');
          setOrderLocationMapsUrl(location.maps_url || '');
        }
      }

      setOrderAttemptReference('');
      setOrderComplete(true);
      clearPreferredPickupDateV2(user.id);
      clearCart();

      void supabase.functions.invoke('send-order-confirmation', {
        body: { order_id: order.id, language },
      }).catch((error) => console.error('Failed to send order confirmation email:', error));

      void supabase.functions.invoke('send-admin-order-notification', {
        body: { order_id: order.id },
      }).catch((error) => console.error('Failed to send admin order notification:', error));
    } catch (error) {
      console.error('Pickup v2 order creation failed:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to create order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderId) return;
    setIsCancelling(true);
    try {
      await cancelOnlineOrderByVersion(orderId, orderPickupDateId);
      setCancelled(true);
      setShowCancelModal(false);
    } catch (error) {
      console.error('Pickup v2 cancellation failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to cancel order. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (orderComplete) {
    if (cancelled) {
      return (
        <div className="joko-mineral-field flex min-h-[70vh] items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-[2rem] border border-[#55766F]/14 bg-[#FFF9EE]/95 p-8 text-center shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
            <CheckCircle className="mx-auto mb-6 h-12 w-12 text-[#55766F]" />
            <p className="mb-8 text-lg text-[#303532]/75">{t.confirmation.cancelSuccess}</p>
            <button onClick={() => onNavigate('home')} className="w-full rounded-xl bg-[#C76624] py-3 font-semibold text-white transition hover:bg-[#A95120]">
              {t.confirmation.backToHome}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="joko-mineral-field flex min-h-screen items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-lg overflow-hidden rounded-[2.25rem] border border-[#55766F]/14 bg-[#FFF9EE]/96 shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
          <div className="border-b border-[#55766F]/12 bg-[#CFE3DF]/55 px-8 pb-6 pt-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/70 text-[#3F665E]">
              <CheckCircle className="h-9 w-9" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.confirmation.title}</h2>
            <p className="mt-2 text-sm text-[#303532]/65">{t.confirmation.thankYou}</p>
          </div>

          <div className="space-y-4 px-6 py-6 sm:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#303532]/45">{t.confirmation.orderNumber}</p>
              <p className="font-mono text-sm font-bold text-[#292D2B]">{orderNumber || orderId}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.confirmation.pickupDay}</p>
                <p className="text-sm font-medium text-gray-800 flex gap-1.5">
                  <Calendar className="h-4 w-4 shrink-0 text-[#C76624]" />
                  {formatStoredPickupDate(completedPickupDate, language)}
                </p>
              </div>
              {orderLocationName && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#303532]/45">{t.confirmation.pickupLocation}</p>
                  {orderLocationMapsUrl ? (
                    <a href={orderLocationMapsUrl} target="_blank" rel="noreferrer" className="flex gap-1.5 text-sm font-medium text-[#3F665E] hover:underline">
                      <MapPin className="w-4 h-4 shrink-0" />
                      {orderLocationName}
                    </a>
                  ) : (
                    <p className="flex gap-1.5 text-sm font-medium text-[#3F665E]"><MapPin className="h-4 w-4 shrink-0" />{orderLocationName}</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-3 border-t border-[#55766F]/12 pt-4">
              {completedItems.map((item) => (
                <div key={`${item.product_id}-${getItemName(item)}`} className="flex items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <ShoppingBag className="h-4 w-4 shrink-0 text-[#C76624]" />
                    <span className="truncate text-sm font-medium text-[#292D2B]">{getItemName(item)}</span>
                    <span className="text-xs text-[#303532]/50">× {Number(item.quantity) || 0}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#303532]">฿{((Number(item.price_at_order) || 0) * (Number(item.quantity) || 0)).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-[#55766F]/16 pt-3 font-bold text-[#292D2B]">
                <span>{t.confirmation.total}</span>
                <span className="text-[#C76624]">฿{completedTotal.toFixed(2)}</span>
              </div>
            </div>

            {completedLoyaltyPoints > 0 && (
              <div className="flex justify-between rounded-xl border border-[#55766F]/14 bg-[#CFE3DF]/45 px-4 py-3">
                <span className="text-sm font-semibold text-[#304B45]">{language === 'th' ? 'แต้มที่ได้รับ' : language === 'zh' ? '本单获得积分' : 'Points earned'}</span>
                <span className="font-bold text-[#304B45]">+{completedLoyaltyPoints}</span>
              </div>
            )}

            <p className="text-center text-xs leading-5 text-[#303532]/58">{t.confirmation.paymentReminder}</p>
            <OrderPrintButtonById
              orderId={orderId}
              language={language}
              getLabel={getLabel}
              className="w-full justify-center py-3 text-sm"
            />
            <button onClick={() => onNavigate('home')} className="w-full rounded-xl bg-[#C76624] py-3 font-semibold text-white transition hover:bg-[#A95120]">{t.confirmation.backToHome}</button>
            <button onClick={() => setShowCancelModal(true)} className="w-full bg-white border border-red-200 text-red-600 py-2.5 rounded-lg font-medium hover:bg-red-50 transition-colors text-sm">{t.confirmation.cancelOrder}</button>
          </div>
        </div>

        {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t.confirmation.cancelConfirmTitle}</h3>
              <p className="text-gray-600 text-sm mb-8">{t.confirmation.cancelConfirmMessage}</p>
              <div className="space-y-3">
                <button onClick={handleCancelOrder} disabled={isCancelling} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50">
                  {isCancelling ? '...' : t.confirmation.cancelYes}
                </button>
                <button onClick={() => setShowCancelModal(false)} className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium">{t.confirmation.cancelNo}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="joko-mineral-field flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[2rem] border border-[#55766F]/14 bg-[#FFF9EE]/95 p-8 text-center shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#CFE3DF]/70 text-[#3F665E]">
            <Sparkles className="h-6 w-6" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
          <h2 className="mb-4 mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.checkout.title}</h2>
          <p className="mb-8 text-[#303532]/68">{t.checkout.authRequired}</p>
          <button onClick={() => setIsAuthModalOpen(true)} className="mb-3 w-full rounded-xl bg-[#C76624] py-3 font-semibold text-white transition hover:bg-[#A95120]">{t.checkout.logIn}</button>
          <button onClick={() => onNavigate('products')} className="w-full rounded-xl border border-[#55766F]/18 bg-white/65 py-3 font-medium text-[#3F665E] transition hover:bg-[#CFE3DF]/35">{t.nav.products}</button>
          <AuthRequiredModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} actionType="checkout" />
        </div>
      </div>
    );
  }

  if (user && (!userProfile || !userProfile.profile_completed) && !profileLoading) {
    return (
      <div className="joko-mineral-field flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[2rem] border border-[#55766F]/14 bg-[#FFF9EE]/95 p-8 text-center shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
          <h2 className="mb-3 mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.profile.completeProfile}</h2>
          <p className="mb-6 text-[#303532]/68">{t.profile.completeProfileMessage}</p>
        </div>
        <ProfileCompletionModal
          isOpen={isProfileModalOpen}
          onClose={() => onNavigate('home')}
          onComplete={() => setIsProfileModalOpen(false)}
          showCelebration={showCelebrationOnProfile}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="joko-mineral-field flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[2rem] border border-[#55766F]/14 bg-[#FFF9EE]/95 p-8 text-center shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
          <h2 className="mb-4 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.cart.empty}</h2>
          <button onClick={() => onNavigate('products')} className="rounded-xl bg-[#C76624] px-8 py-3 font-semibold text-white transition hover:bg-[#A95120]">{t.nav.products}</button>
        </div>
      </div>
    );
  }

  const confirmTitle = language === 'th'
    ? 'ยืนยันการรับสินค้า'
    : language === 'zh'
      ? '确认取货安排'
      : 'Confirm pickup';
  const confirmHelper = language === 'th'
    ? 'นี่คือการรับสินค้าที่คุณเลือกไว้ กรุณาตรวจสอบก่อนยืนยันคำสั่งซื้อ'
    : language === 'zh'
      ? '这是您之前选择的取货安排。下单前请确认日期和地点。'
      : 'This is the pickup choice you selected while shopping. Please confirm it before placing your order.';
  const changeLabel = language === 'th'
    ? 'เปลี่ยนการรับสินค้า'
    : language === 'zh'
      ? '更改取货安排'
      : 'Change pickup';
  const backToCartLabel = language === 'th' ? 'กลับไปที่ตะกร้า' : language === 'zh' ? '返回购物篮' : 'Back to cart';
  const cancelChangeLabel = language === 'th' ? 'ยกเลิกการเปลี่ยนแปลง' : language === 'zh' ? '取消更改' : 'Cancel pickup change';
  const pickupActionRequired = language === 'th'
    ? 'ยืนยันวันและสถานที่รับสินค้าด้านบนเพื่อดำเนินการต่อ'
    : language === 'zh'
      ? '请先在上方确认取货日期和地点，然后继续。'
      : 'Confirm your pickup date and location above to continue.';
  const forgotSomethingLabel = getLabel(
    'checkout.continue_shopping',
    language,
    language === 'th' ? 'ลืมอะไรไหม? เลือกซื้อสินค้าต่อ' : language === 'zh' ? '忘了什么吗？继续选购' : 'Forgot something? Continue shopping',
  );

  return (
    <div className="joko-mineral-field min-h-screen py-8 sm:py-12 lg:py-14">
      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={backToCart}
          className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#FFF9EE]/78 px-4 py-2 text-sm font-semibold text-[#3F665E] transition hover:bg-[#FFF9EE]"
        >
          <ArrowLeft className="w-4 h-4" />
          {backToCartLabel}
        </button>
        <div className="mb-8 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.035em] text-[#292D2B] sm:text-5xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.checkout.title}</h1>
        </div>
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-[#55766F]/14 bg-[#FFF9EE]/95 p-6 shadow-[0_18px_50px_rgba(59,74,69,0.07)]">
              <h2 className="mb-4 text-2xl font-semibold tracking-[-0.02em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.checkout.orderSummary}</h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between gap-4 border-b border-[#55766F]/10 pb-3 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#292D2B]">{language === 'th' ? item.product.name_th : language === 'zh' ? item.product.name_zh || item.product.name_en : item.product.name_en}</p>
                      <p className="text-xs text-[#303532]/50">{item.quantity} × ฿{item.product.price.toFixed(2)}</p>
                    </div>
                    <span className="font-semibold text-[#303532]">฿{(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-2 text-lg font-bold text-[#292D2B]">
                  <span>{t.cart.total}</span>
                  <span className="text-[#C76624]">฿{totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-[1.5rem] border border-[#55766F]/14 bg-[#CFE3DF]/42 p-6">
              <h3 className="mb-2 text-lg font-semibold text-[#304B45]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.checkout.paymentInfo}</h3>
              <p className="text-sm leading-6 text-[#303532]/72">{t.checkout.paymentInfoText}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 rounded-[2rem] border border-[#55766F]/14 bg-[#FFF9EE]/95 p-6 shadow-[0_18px_50px_rgba(59,74,69,0.07)] sm:p-7">
            <div className="rounded-xl border border-[#55766F]/14 bg-[#CFE3DF]/45 p-4">
              <p className="text-sm text-[#304B45]">{t.checkout.loggedInAs.replace('{{name}}', userProfile?.name || user.email || '')}</p>
            </div>

            {!preferredSelectionResolved ? (
              <div className="rounded-[1.5rem] border border-[#55766F]/14 bg-[#CFE3DF]/28 py-10 text-center text-sm text-[#303532]/55">
                {language === 'th' ? 'กำลังตรวจสอบวันที่รับสินค้า…' : language === 'zh' ? '正在确认取货安排…' : 'Confirming your pickup selection…'}
              </div>
            ) : selection && selectedCheckoutDate && selectedCheckoutLocation && !showPickupEditor ? (
              <div className="rounded-[1.5rem] border border-[#55766F]/16 bg-[#CFE3DF]/34 p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-gray-900">{confirmTitle}</h2>
                    <p className="text-sm text-gray-600 mt-1">{confirmHelper}</p>
                  </div>
                  <button
                    type="button"
                    onClick={beginPickupEdit}
                    className="shrink-0 rounded-xl border border-[#55766F]/22 bg-white/70 px-3 py-2 text-sm font-semibold text-[#3F665E] transition hover:bg-[#CFE3DF]/40"
                  >
                    {changeLabel}
                  </button>
                </div>

                <div className="mt-5 grid sm:grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#55766F]/12 bg-white/68 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{t.confirmation.pickupDay}</p>
                    <p className="flex items-start gap-2 font-semibold text-gray-900">
                      <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-[#C76624]" />
                      {formatStoredPickupDate(selection.pickupDate, language)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#55766F]/12 bg-white/68 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{t.confirmation.pickupLocation}</p>
                    {selectedCheckoutLocation.maps_url ? (
                      <a
                        href={selectedCheckoutLocation.maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-2 font-semibold text-[#3F665E] hover:underline"
                      >
                        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#C76624]" />
                        <span>{getPickupLocationName()}</span>
                        <ExternalLink className="w-4 h-4 shrink-0 mt-0.5" />
                      </a>
                    ) : (
                      <p className="flex items-start gap-2 font-semibold text-[#292D2B]">
                        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#C76624]" />
                        {getPickupLocationName()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {selection && (
                  <button
                    type="button"
                    onClick={cancelPickupEdit}
                    className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#3F665E] hover:text-[#304B45]"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {cancelChangeLabel}
                  </button>
                )}
                <PickupDateSelectorV2
                  requirements={requirements}
                  value={selection}
                  onChange={handlePickupSelectionChange}
                  onQuantityChange={updateQuantity}
                  onRemoveProduct={removeFromCart}
                />
              </div>
            )}

            {selection && selectedCheckoutDate && selectedCheckoutLocation && !showPickupEditor && (
              <FitsYourPickupV2
                pickupDateId={selection.pickupDateId}
                placement="checkout"
                onProductClick={openRecommendedProduct}
              />
            )}

            <div>
              <label htmlFor="pickup-notes" className="mb-2 block text-sm font-medium text-[#303532]/72">
                {language === 'th' ? 'หมายเหตุ (ไม่บังคับ)' : language === 'zh' ? '备注（可选）' : 'Notes (optional)'}
              </label>
              <textarea
                id="pickup-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full resize-none rounded-xl border border-[#55766F]/20 bg-white/72 px-3 py-2.5 text-[#303532] outline-none transition focus:border-[#55766F]/45 focus:ring-2 focus:ring-[#55766F]/16"
              />
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{submitError}</div>
            )}

            <button
              type="button"
              onClick={continueShopping}
              className="w-full rounded-xl border border-[#55766F]/20 bg-white/65 py-3 font-semibold text-[#3F665E] transition hover:bg-[#CFE3DF]/35"
            >
              {forgotSomethingLabel}
            </button>

            {(!selection || showPickupEditor) && (
              <div className="rounded-xl border border-[#C76624]/22 bg-[#FFF4DF] px-4 py-3 text-center text-sm font-semibold text-[#8D451C]">
                {pickupActionRequired}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !selection || showPickupEditor}
              className="w-full rounded-xl bg-[#C76624] py-3.5 font-semibold text-white transition hover:bg-[#A95120] disabled:cursor-not-allowed disabled:bg-[#A9ACA9]"
            >
              {isSubmitting ? t.checkout.processing : t.checkout.placeOrder}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
