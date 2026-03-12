import { useState, useEffect } from 'react';
import { MapPin, Calendar, CheckCircle, Sparkles, ChevronDown, ChevronUp, AlertTriangle, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { supabase } from '../lib/supabase';
import LocationMap from '../components/LocationMap';
import { AuthRequiredModal } from '../components/AuthRequiredModal';
import { ProfileCompletionModal } from '../components/ProfileCompletionModal';
import { pickupLocations } from '../data/locations';
import { getDayKey, getPickupDayLabel, getPickupDays, PickupDay } from '../lib/availabilityService';

type CheckoutPageProps = {
  onNavigate: (page: string) => void;
};

export default function CheckoutPage({ onNavigate }: CheckoutPageProps) {
  const { items, totalPrice, clearCart, selectedPickupDay } = useCart();
  const { t, language } = useLanguage();
  const { getLabel } = useCMSLabels();
  const { user, userProfile, profileLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showCelebrationOnProfile, setShowCelebrationOnProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderCreatedAt, setOrderCreatedAt] = useState('');
  const [orderLocationName, setOrderLocationName] = useState('');
  const [orderLocationMapsUrl, setOrderLocationMapsUrl] = useState('');
  const [completedItems, setCompletedItems] = useState<{ name: string; name_th: string; name_zh: string; qty: number; price: number }[]>([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedPickupDay, setCompletedPickupDay] = useState('');
  const [completedLoyaltyPoints, setCompletedLoyaltyPoints] = useState<number>(0);
  const [showDetails, setShowDetails] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);

  useEffect(() => {
    loadPickupDays();
  }, []);

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

  const loadPickupDays = async () => {
    const days = await getPickupDays();
    setPickupDays(days);
  };

  const [formData, setFormData] = useState({
    pickupDay: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedPickupDay) newErrors.pickupDay = t.checkout.required;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (items.length === 0) {
      alert('Your cart is empty!');
      return;
    }

    if (!user || !userProfile) {
      alert('You must be logged in to place an order.');
      return;
    }

    console.log('Placing order for user:', user.id);

    setIsSubmitting(true);

    try {
      const orderItemsJson = items.map((item) => ({
        product_id: item.product.id,
        product_name: item.product.name_en || '',
        product_name_th: item.product.name_th || '',
        product_name_zh: item.product.name_zh || '',
        quantity: item.quantity,
        price_at_order: item.product.price,
      }));

      const selectedDay = pickupDays.find((d) => d.label === selectedPickupDay);
      const pickupLocationId = (selectedDay as PickupDay & { location_id?: string })?.location_id ?? null;

      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id,
          order_number: orderNumber,
          customer_name: userProfile.name || '',
          customer_email: user.email,
          customer_phone: userProfile.phone || '',
          line_id: userProfile.line_id || '',
          pickup_day: selectedPickupDay || '',
          pickup_location_id: pickupLocationId,
          total_amount: totalPrice,
          status: 'pending',
          notes: formData.notes,
          order_items: orderItemsJson,
        })
        .select()
        .single();

      if (orderError) {
        console.error("ORDER INSERT ERROR:", orderError);
        alert(orderError.message);
        return;
      }

      const dayKey = getDayKey(selectedPickupDay || '');
      for (const item of items) {
        const product = item.product;
        const currentStockByDay = (product.stock_by_day as Record<string, number>) || {};
        const currentStock = currentStockByDay[dayKey] ?? product.stock_remaining ?? 0;
        const newStock = Math.max(0, currentStock - item.quantity);

        const updatedStockByDay = {
          ...currentStockByDay,
          [dayKey]: newStock,
        };

        await supabase
          .from('cms_products')
          .update({ stock_by_day: updatedStockByDay })
          .eq('id', product.id);
      }

      setOrderId(order.id);
      setOrderNumber(order.order_number);
      setOrderCreatedAt(order.created_at);
      setCompletedTotal(totalPrice);
      setCompletedPickupDay(selectedPickupDay || '');
      setCompletedLoyaltyPoints(order.loyalty_points_earned || 0);
      setCompletedItems(items.map((item) => ({
        name: item.product.name_en || '',
        name_th: item.product.name_th || '',
        name_zh: item.product.name_zh || '',
        qty: item.quantity,
        price: item.product.price,
      })));

      if (pickupLocationId) {
        const { data: loc } = await supabase
          .from('cms_pickup_locations')
          .select('name_en, name_th, name_zh, maps_url')
          .eq('id', pickupLocationId)
          .maybeSingle();
        if (loc) {
          const locName = language === 'th' ? loc.name_th : language === 'zh' ? loc.name_zh : loc.name_en;
          setOrderLocationName(locName || loc.name_en || '');
          setOrderLocationMapsUrl(loc.maps_url || '');
        }
      } else if (selectedDay) {
        const { data: loc } = await supabase
          .from('cms_pickup_locations')
          .select('name_en, name_th, name_zh, maps_url')
          .eq('id', (selectedDay as PickupDay & { location_id?: string }).location_id)
          .maybeSingle();
        if (loc) {
          const locName = language === 'th' ? loc.name_th : language === 'zh' ? loc.name_zh : loc.name_en;
          setOrderLocationName(locName || loc.name_en || '');
          setOrderLocationMapsUrl(loc.maps_url || '');
        }
      }

      setOrderComplete(true);
      clearCart();

      supabase.functions.invoke('send-order-confirmation', {
        body: { order_id: order.id, language },
      }).catch((emailErr) => {
        console.error('Failed to send order confirmation email:', emailErr);
      });

      supabase.functions.invoke('send-admin-order-notification', {
        body: { order_id: order.id },
      }).catch((notifErr) => {
        console.error('Failed to send admin order notification:', notifErr);
      });
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    setIsCancelling(true);
    try {
      await supabase.from('orders').delete().eq('id', orderId);
      setCancelled(true);
      setShowCancelModal(false);
    } catch (err) {
      console.error('Cancel order error:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const getItemName = (item: { name: string; name_th: string; name_zh: string }) => {
    if (language === 'th') return item.name_th || item.name;
    if (language === 'zh') return item.name_zh || item.name;
    return item.name;
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  if (orderComplete) {
    if (cancelled) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-background rounded-2xl shadow-xl p-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-gray-400" />
            </div>
            <p className="text-gray-700 mb-8 text-lg">{t.confirmation.cancelSuccess}</p>
            <button
              onClick={() => onNavigate('home')}
              className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              {t.confirmation.backToHome}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background flex items-center justify-center px-4 py-10">
        <div className="max-w-lg w-full">
          <div className="bg-background rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-green-50 px-8 pt-8 pb-6 text-center border-b border-green-100">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-9 w-9 text-green-600" />
              </div>
              <h2 className="text-2xl font-header font-bold text-primary-900 mb-1">{t.confirmation.title}</h2>
              <p className="text-gray-600 text-sm">{t.confirmation.thankYou}</p>
            </div>

            <div className="px-8 py-5 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-0.5">{t.confirmation.orderNumber}</p>
                  <p className="font-mono text-sm font-bold text-gray-900">{orderNumber || orderId}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                  {t.confirmation.pending}
                </span>
              </div>
            </div>

            <div className="px-8 py-5 border-b border-gray-100 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.confirmation.pickupDay}</p>
                <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  {completedPickupDay}
                </p>
              </div>
              {orderLocationName && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.confirmation.pickupLocation}</p>
                  {orderLocationMapsUrl ? (
                    <a
                      href={orderLocationMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-amber-700 flex items-center gap-1.5 hover:text-amber-900 underline underline-offset-2 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      {orderLocationName}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-amber-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      {orderLocationName}
                    </p>
                  )}
                </div>
              )}
              {orderCreatedAt && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.confirmation.orderDate}</p>
                  <p className="text-sm font-medium text-gray-800">{formatDate(orderCreatedAt)}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.confirmation.payment}</p>
                <span className="inline-block text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  {t.confirmation.payAtPickup}
                </span>
              </div>
            </div>

            <div className="px-8 py-4 border-b border-gray-100">
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-900 transition-colors"
              >
                <ShoppingBag className="w-4 h-4" />
                {showDetails ? t.confirmation.hideDetails : t.confirmation.details}
                {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showDetails && (
                <div className="mt-4 space-y-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{t.confirmation.items}</p>
                  {completedItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-3 border-t border-gray-100 first:border-t-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="w-4 h-4 text-amber-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{getItemName(item)}</p>
                          <p className="text-xs text-gray-400">{item.qty} × ฿{item.price.toFixed(2)}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-gray-800">฿{(item.qty * item.price).toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="flex justify-between pt-4 border-t border-gray-200 mt-2">
                    <p className="text-sm font-semibold text-gray-700">{t.confirmation.total}</p>
                    <p className="text-lg font-bold text-amber-600">฿{completedTotal.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>

            {completedLoyaltyPoints > 0 && (
              <div
                className="mx-8 mb-0 -mt-px py-4 border-b border-gray-100"
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{ background: '#c6a75e', color: '#fff' }}
                  >
                    ★
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                      {language === 'zh' ? '本单获得积分' : language === 'th' ? 'แต้มที่ได้รับจากออเดอร์นี้' : 'Points Earned This Order'}
                    </p>
                  </div>
                  <span className="text-xl font-extrabold" style={{ color: '#92400e' }}>
                    +{completedLoyaltyPoints}
                  </span>
                </div>
              </div>
            )}

            <div className="px-8 py-5 space-y-3">
              <p className="text-xs text-gray-500 text-center leading-relaxed">{t.confirmation.paymentReminder}</p>
              <button
                onClick={() => onNavigate('home')}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
              >
                {t.confirmation.backToHome}
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="w-full bg-white border border-red-200 text-red-600 py-2.5 rounded-lg font-medium hover:bg-red-50 transition-colors text-sm"
              >
                {t.confirmation.cancelOrder}
              </button>
            </div>
          </div>
        </div>

        {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t.confirmation.cancelConfirmTitle}</h3>
              <p className="text-gray-600 text-sm mb-8 leading-relaxed">{t.confirmation.cancelConfirmMessage}</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCancelOrder}
                  disabled={isCancelling}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isCancelling ? '...' : t.confirmation.cancelYes}
                </button>
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  {t.confirmation.cancelNo}
                </button>
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
        <div className="text-center max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
              <Sparkles className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-primary-900 mb-4">
              {t.nav.products}
            </h2>
            <p className="text-gray-600 mb-8">
              {t.checkout.authRequired}
            </p>

            <div className="space-y-3 mb-6">
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
                {t.checkout.logIn}
              </button>
            </div>

            <button
              onClick={() => onNavigate('products')}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              {t.nav.products}
            </button>
          </div>
        </div>
        <AuthRequiredModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          actionType="checkout"
        />
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
          <button
            onClick={() => onNavigate('products')}
            className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            {t.nav.products}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-header font-bold text-primary-900 mb-8 text-center">
          {t.checkout.title}
        </h1>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-background rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-primary-900 mb-4">{t.checkout.orderSummary}</h2>
              <div className="space-y-3">
                {items.map((item) => {
                  const productName = language === 'th' ? item.product.name_th : item.product.name_en;
                  return (
                    <div key={item.product.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        {productName} × {item.quantity}
                      </span>
                      <span className="font-semibold text-primary-900">
                        ฿{(item.product.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
                <div className="pt-3 border-t border-gray-200 flex justify-between text-lg font-bold">
                  <span className="text-gray-900">{t.cart.total}</span>
                  <span className="text-primary-900">฿{totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-primary-50 rounded-lg p-6 border border-primary-200">
              <h3 className="font-semibold text-primary-900 mb-3">{t.checkout.paymentInfo}</h3>
              <p className="text-sm text-gray-700">
                {t.checkout.paymentInfoText}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-background rounded-lg shadow-md p-6 space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                {t.checkout.loggedInAs.replace('{{name}}', userProfile?.name || user?.email || '')}
              </p>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-4">
                <Calendar className="h-4 w-4 mr-2" />
                {t.checkout.pickupDetails}
              </label>
              <div className="space-y-2">
                {pickupDays.map((day) => {
                  const displayLabel = getPickupDayLabel(day, language);
                  const isSelected = selectedPickupDay === day.label;
                  const isOpen = day.is_open;

                  return (
                    <div
                      key={day.id}
                      className={`flex items-center p-4 border-2 rounded-lg transition-colors ${
                        isSelected
                          ? 'border-primary-600 bg-primary-50'
                          : isOpen
                            ? 'border-gray-200 hover:border-primary-300 bg-gray-50'
                            : 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pickupDay"
                        value={day.label}
                        checked={isSelected}
                        disabled={!isOpen || !isSelected}
                        onChange={() => {}}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{displayLabel}</div>
                        {isSelected && isOpen && (
                          <p className="text-xs text-primary-600 mt-1">
                            {t.checkout.pickupDayFromCatalog}
                          </p>
                        )}
                        {!isOpen && (
                          <p className="text-xs text-red-600 mt-1">
                            Cutoff passed ({day.cutoff_day} {day.cutoff_time})
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {errors.pickupDay && (
                <p className="text-red-500 text-xs mt-2">{errors.pickupDay}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
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
