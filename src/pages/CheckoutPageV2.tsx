import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle, MapPin, ShoppingBag, Sparkles } from 'lucide-react';
import { AuthRequiredModal } from '../components/AuthRequiredModal';
import { PickupDateSelectorV2, PickupSelectionV2 } from '../components/PickupDateSelectorV2';
import { ProfileCompletionModal } from '../components/ProfileCompletionModal';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
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
  const { items, totalPrice, clearCart } = useCart();
  const { user, userProfile, profileLoading } = useAuth();
  const { language, t } = useLanguage();

  const [selection, setSelection] = useState<PickupSelectionV2 | null>(null);
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
    () => items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
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

  const getItemName = (item: SecureOrderItem) => {
    if (language === 'th') return item.product_name_th || item.product_name || '';
    if (language === 'zh') return item.product_name_zh || item.product_name || '';
    return item.product_name || '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError('');

    if (!selection) {
      setSubmitError(language === 'th' ? 'กรุณาเลือกวันและสถานที่รับสินค้า' : language === 'zh' ? '请选择取货日期和地点' : 'Please choose a pickup date and location.');
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
        <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-background rounded-2xl shadow-xl p-8 text-center">
            <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-6" />
            <p className="text-gray-700 mb-8 text-lg">{t.confirmation.cancelSuccess}</p>
            <button onClick={() => onNavigate('home')} className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors">
              {t.confirmation.backToHome}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full bg-background rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-green-50 px-8 pt-8 pb-6 text-center border-b border-green-100">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-header font-bold text-primary-900 mb-1">{t.confirmation.title}</h2>
            <p className="text-gray-600 text-sm">{t.confirmation.thankYou}</p>
          </div>

          <div className="px-8 py-5 space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.confirmation.orderNumber}</p>
              <p className="font-mono text-sm font-bold text-gray-900">{orderNumber || orderId}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.confirmation.pickupDay}</p>
                <p className="text-sm font-medium text-gray-800 flex gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                  {formatStoredPickupDate(completedPickupDate, language)}
                </p>
              </div>
              {orderLocationName && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.confirmation.pickupLocation}</p>
                  {orderLocationMapsUrl ? (
                    <a href={orderLocationMapsUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-amber-700 flex gap-1.5 hover:underline">
                      <MapPin className="w-4 h-4 shrink-0" />
                      {orderLocationName}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-amber-700 flex gap-1.5"><MapPin className="w-4 h-4 shrink-0" />{orderLocationName}</p>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
              {completedItems.map((item) => (
                <div key={`${item.product_id}-${getItemName(item)}`} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShoppingBag className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-sm font-medium text-gray-900 truncate">{getItemName(item)}</span>
                    <span className="text-xs text-gray-500">× {Number(item.quantity) || 0}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">฿{((Number(item.price_at_order) || 0) * (Number(item.quantity) || 0)).toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-200 pt-3 font-bold">
                <span>{t.confirmation.total}</span>
                <span className="text-amber-700">฿{completedTotal.toFixed(2)}</span>
              </div>
            </div>

            {completedLoyaltyPoints > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex justify-between">
                <span className="text-sm font-semibold text-amber-900">{language === 'th' ? 'แต้มที่ได้รับ' : language === 'zh' ? '本单获得积分' : 'Points earned'}</span>
                <span className="font-bold text-amber-900">+{completedLoyaltyPoints}</span>
              </div>
            )}

            <p className="text-xs text-gray-500 text-center">{t.confirmation.paymentReminder}</p>
            <button onClick={() => onNavigate('home')} className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors">{t.confirmation.backToHome}</button>
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
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background flex items-center justify-center px-4">
        <div className="text-center max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <Sparkles className="w-10 h-10 text-amber-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-primary-900 mb-4">{t.checkout.title}</h2>
          <p className="text-gray-600 mb-8">{t.checkout.authRequired}</p>
          <button onClick={() => setIsAuthModalOpen(true)} className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold mb-3">{t.checkout.logIn}</button>
          <button onClick={() => onNavigate('products')} className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium">{t.nav.products}</button>
          <AuthRequiredModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} actionType="checkout" />
        </div>
      </div>
    );
  }

  if (user && (!userProfile || !userProfile.profile_completed) && !profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-primary-900 mb-3">{t.profile.completeProfile}</h2>
          <p className="text-gray-700 mb-6">{t.profile.completeProfileMessage}</p>
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
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-primary-900 mb-4">{t.cart.empty}</h2>
          <button onClick={() => onNavigate('products')} className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold">{t.nav.products}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-header font-bold text-primary-900 mb-8 text-center">{t.checkout.title}</h1>
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
          <div className="space-y-6">
            <div className="bg-background rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-primary-900 mb-4">{t.checkout.orderSummary}</h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.product.id} className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{language === 'th' ? item.product.name_th : language === 'zh' ? item.product.name_zh || item.product.name_en : item.product.name_en}</p>
                      <p className="text-xs text-gray-500">{item.quantity} × ฿{item.product.price.toFixed(2)}</p>
                    </div>
                    <span className="font-semibold text-gray-800">฿{(item.product.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-lg font-bold pt-2">
                  <span>{t.cart.total}</span>
                  <span className="text-primary-900">฿{totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="bg-primary-50 rounded-lg p-6 border border-primary-200">
              <h3 className="font-semibold text-primary-900 mb-2">{t.checkout.paymentInfo}</h3>
              <p className="text-sm text-gray-700">{t.checkout.paymentInfoText}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-background rounded-lg shadow-md p-6 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">{t.checkout.loggedInAs.replace('{{name}}', userProfile?.name || user.email || '')}</p>
            </div>

            <PickupDateSelectorV2 requirements={requirements} value={selection} onChange={setSelection} />

            <div>
              <label htmlFor="pickup-v2-notes" className="block text-sm font-medium text-gray-700 mb-2">
                {language === 'th' ? 'หมายเหตุ (ไม่บังคับ)' : language === 'zh' ? '备注（可选）' : 'Notes (optional)'}
              </label>
              <textarea
                id="pickup-v2-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{submitError}</div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !selection}
              className="w-full bg-primary-600 text-white py-3.5 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t.checkout.processing : t.checkout.placeOrder}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
