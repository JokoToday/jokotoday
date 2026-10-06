import { useState, useEffect } from 'react';
import { MapPin, Calendar, CheckCircle, Sparkles, ChevronDown, ChevronUp, AlertTriangle, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { supabase } from '../lib/supabase';
import { needsLINEEmailForCheckout } from '../lib/lineProfile';
import { AuthRequiredModal } from '../components/AuthRequiredModal';
import { ProfileCompletionModal } from '../components/ProfileCompletionModal';
import { NonBakeryCheckoutSuggestions } from '../components/NonBakeryCheckoutSuggestions';
import { OrderPrintButtonById } from '../components/orders/OrderPrintButtonById';
import { getPickupDayLabel, getPickupDays, getNextPickupDate, isDayOpenForOrdering, PickupDay } from '../lib/availabilityService';

type CheckoutPageProps = {
  onNavigate: (page: string) => void;
};

type SecureOrderItem = {
  product_id: string;
  product_name: string;
  product_name_th?: string | null;
  product_name_zh?: string | null;
  quantity: number;
  price_at_order: number | string;
};

type SecureOrderResult = {
  id: string;
  order_number: string;
  created_at: string;
  pickup_day: string | null;
  pickup_date: string | null;
  pickup_location_id: string | null;
  total_amount: number | string;
  loyalty_points_earned?: number | null;
  order_items: SecureOrderItem[] | null;
};

function pickupDayMatches(values: string[], day: PickupDay): boolean {
  const candidates = [day.day_key, day.label, day.label_en, day.label_th, day.label_zh]
    .filter((value): value is string => Boolean(value));
  return candidates.some((candidate) => values.includes(candidate));
}

export default function CheckoutPage({ onNavigate }: CheckoutPageProps) {
  const { items, totalPrice, clearCart, selectedPickupDay, setSelectedPickupDay } = useCart();
  const { t, language } = useLanguage();
  const { getLabel } = useCMSLabels();
  const { user, userProfile, profileLoading } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showCelebrationOnProfile, setShowCelebrationOnProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderAttemptReference, setOrderAttemptReference] = useState('');
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [orderCreatedAt, setOrderCreatedAt] = useState('');
  const [orderLocationName, setOrderLocationName] = useState('');
  const [orderLocationMapsUrl, setOrderLocationMapsUrl] = useState('');
  const [completedItems, setCompletedItems] = useState<{ name: string; name_th: string; name_zh: string; qty: number; price: number }[]>([]);
  const [completedTotal, setCompletedTotal] = useState(0);
  const [completedPickupDay, setCompletedPickupDay] = useState('');
  const [completedPickupDate, setCompletedPickupDate] = useState('');
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

  const [formData] = useState({ notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isDayCompatibleWithCart = (pickupDay: PickupDay) => {
    return items.every((item) => {
      const availableDays = item.product.available_days as string[] | null | undefined;
      return !availableDays || availableDays.length === 0 || pickupDayMatches(availableDays, pickupDay);
    });
  };

  const findSelectedDay = () => pickupDays.find((day) =>
    day.label === selectedPickupDay || day.day_key === selectedPickupDay,
  );

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const selectedDay = findSelectedDay();

    if (
      !selectedPickupDay ||
      !selectedDay ||
      !isDayOpenForOrdering(selectedDay) ||
      !isDayCompatibleWithCart(selectedDay)
    ) {
      newErrors.pickupDay = t.checkout.required;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePickupDayChange = (pickupDayLabel: string) => {
    setSelectedPickupDay(pickupDayLabel);
    setErrors((currentErrors) => {
      if (!currentErrors.pickupDay) return currentErrors;
      const nextErrors = { ...currentErrors };
      delete nextErrors.pickupDay;
      return nextErrors;
    });
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

    // A fresh network Auth check prevents stale client/session metadata from
    // bypassing the LINE email-verification requirement.
    const { data: verifiedAuth, error: verifiedError } = await supabase.auth.getUser();
    if (verifiedError || !verifiedAuth.user || verifiedAuth.user.id !== user.id
      || needsLINEEmailForCheckout(verifiedAuth.user)) {
      alert('Please verify your email in My Profile before placing an order.');
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedDay = findSelectedDay();
      if (!selectedDay) throw new Error('Selected pickup day could not be scheduled');

      const orderReference = orderAttemptReference
        || `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      if (!orderAttemptReference) setOrderAttemptReference(orderReference);

      const rpcItems = items.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      }));

      const { data: orderData, error: orderError } = await supabase.rpc('create_online_order', {
        p_order_number: orderReference,
        p_pickup_day_key: selectedDay.day_key,
        p_items: rpcItems,
        p_notes: formData.notes || null,
      });

      if (orderError) {
        console.error('SECURE ORDER RPC ERROR:', orderError);
        alert(orderError.message);
        return;
      }

      const order = orderData as SecureOrderResult | null;
      if (!order?.id || !order.order_number) throw new Error('Secure order creation returned an invalid order');

      const serverItems = Array.isArray(order.order_items) ? order.order_items : [];
      const pickupLocationId = order.pickup_location_id;

      setOrderId(order.id);
      setOrderNumber(order.order_number);
      setOrderCreatedAt(order.created_at || '');
      setCompletedTotal(Number(order.total_amount) || 0);
      setCompletedPickupDay(order.pickup_day || selectedPickupDay || '');
      setCompletedPickupDate(order.pickup_date || '');
      setCompletedLoyaltyPoints(Number(order.loyalty_points_earned) || 0);
      setCompletedItems(serverItems.map((item) => ({
        name: item.product_name || '',
        name_th: item.product_name_th || '',
        name_zh: item.product_name_zh || '',
        qty: Number(item.quantity) || 0,
        price: Number(item.price_at_order) || 0,
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
      }

      setOrderAttemptReference('');
      setOrderComplete(true);
      clearCart();

      supabase.functions.invoke('send-order-confirmation', {
        body: { order_id: order.id, language },
      }).catch((emailErr) => console.error('Failed to send order confirmation email:', emailErr));

      supabase.functions.invoke('send-admin-order-notification', {
        body: { order_id: order.id },
      }).catch((notifErr) => console.error('Failed to send admin order notification:', notifErr));
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
      const { data, error } = await supabase.rpc('cancel_online_order', { p_order_id: orderId });
      if (error) {
        console.error('Cancel order RPC error:', error);
        alert(error.message || 'Failed to cancel order. Please try again.');
        return;
      }

      const cancelledOrder = data as { id?: string; status?: string } | null;
      if (!cancelledOrder?.id || cancelledOrder.status !== 'cancelled') {
        throw new Error('Cancellation returned an invalid order result');
      }

      setCancelled(true);
      setShowCancelModal(false);
    } catch (err) {
      console.error('Cancel order error:', err);
      alert(err instanceof Error ? err.message : 'Failed to cancel order. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  const getItemName = (item: { name: string; name_th: string; name_zh: string }) => {
    if (language === 'th') return item.name_th || item.name;
    if (language === 'zh') return item.name_zh || item.name;
    return item.name;
  };

  const getDateLocale = () => language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(getDateLocale(), { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatPickupDate = (date: Date) => date.toLocaleDateString(getDateLocale(), {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

  const formatStoredPickupDate = (isoDate: string) => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-').map(Number);
    if (!year || !month || !day) return isoDate;
    return formatPickupDate(new Date(Date.UTC(year, month - 1, day, 12)));
  };

  if (orderComplete) {
    if (cancelled) {
      return (
        <div className="joko-mineral-field flex min-h-[70vh] items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-[2rem] border border-[#55766F]/[.14] bg-[#FFF9EE]/95 p-8 text-center shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-12 w-12 text-gray-400" />
            </div>
            <p className="text-gray-700 mb-8 text-lg">{t.confirmation.cancelSuccess}</p>
            <button onClick={() => onNavigate('home')} className="w-full rounded-xl bg-[#C76624] py-3 font-semibold text-white transition hover:bg-[#A95120]">
              {t.confirmation.backToHome}
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="joko-mineral-field flex min-h-screen items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-lg">
          <div className="overflow-hidden rounded-[2.25rem] border border-[#55766F]/[.14] bg-[#FFF9EE]/[.96] shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
            <div className="border-b border-[#55766F]/[.12] bg-[#CFE3DF]/55 px-8 pb-6 pt-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-9 w-9 text-green-600" />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.confirmation.title}</h2>
              <p className="mt-2 text-sm text-[#303532]/65">{t.confirmation.thankYou}</p>
            </div>

            <div className="px-8 py-5 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <p className="mb-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-[#55766F]">{t.confirmation.orderNumber}</p>
                  <p className="font-mono text-sm font-bold text-gray-900">{orderNumber || orderId}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#55766F]/[.16] bg-[#CFE3DF]/45 px-3 py-1.5 text-xs font-semibold text-[#3F665E]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#55766F]" />
                  {t.confirmation.pending}
                </span>
              </div>
            </div>

            <div className="px-8 py-5 border-b border-gray-100 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.confirmation.pickupDay}</p>
                <p className="text-sm font-medium text-gray-800 flex items-start gap-1.5">
                  <Calendar className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#C76624]" />
                  <span>
                    {completedPickupDay}
                    {completedPickupDate && (
                      <span className="mt-0.5 block text-xs font-semibold text-[#C76624]">
                        {formatStoredPickupDate(completedPickupDate)}
                      </span>
                    )}
                  </span>
                </p>
              </div>
              {orderLocationName && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{t.confirmation.pickupLocation}</p>
                  {orderLocationMapsUrl ? (
                    <a href={orderLocationMapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm font-medium text-[#3F665E] underline underline-offset-2 transition-colors hover:text-[#304B45]">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      {orderLocationName}
                    </a>
                  ) : (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-[#3F665E]">
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
                <span className="inline-block rounded-full bg-[#CFE3DF]/55 px-2 py-0.5 text-xs font-semibold text-[#304B45]">{t.confirmation.payAtPickup}</span>
              </div>
            </div>

            <div className="px-8 py-4 border-b border-gray-100">
              <button onClick={() => setShowDetails((v) => !v)} className="flex items-center gap-2 text-sm font-semibold text-[#3F665E] transition-colors hover:text-[#304B45]">
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
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#CFE3DF]/55"><ShoppingBag className="h-4 w-4 text-[#C76624]" /></div>
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
                    <p className="text-lg font-bold text-[#C76624]">฿{completedTotal.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>

            {completedLoyaltyPoints > 0 && (
              <div className="mx-8 mb-0 -mt-px py-4 border-b border-gray-100">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fde68a' }}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#55766F] text-sm font-bold text-white">★</div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#3F665E]">
                      {language === 'zh' ? '本单获得积分' : language === 'th' ? 'แต้มที่ได้รับจากออเดอร์นี้' : 'Points Earned This Order'}
                    </p>
                  </div>
                  <span className="text-xl font-extrabold" style={{ color: '#92400e' }}>+{completedLoyaltyPoints}</span>
                </div>
              </div>
            )}

            <div className="px-8 py-5 space-y-3">
              <p className="text-xs text-gray-500 text-center leading-relaxed">{t.confirmation.paymentReminder}</p>
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
        </div>
        </div>

        {showCancelModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-7 h-7 text-red-500" /></div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{t.confirmation.cancelConfirmTitle}</h3>
              <p className="text-gray-600 text-sm mb-8 leading-relaxed">{t.confirmation.cancelConfirmMessage}</p>
              <div className="flex flex-col gap-3">
                <button onClick={handleCancelOrder} disabled={isCancelling} className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                  {isCancelling ? '...' : t.confirmation.cancelYes}
                </button>
                <button onClick={() => setShowCancelModal(false)} className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors">{t.confirmation.cancelNo}</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!user) {
    return (
      <>
        <div className="joko-mineral-field flex min-h-[70vh] items-center justify-center px-4 py-12">
          <div className="w-full max-w-md text-center">
            <div className="rounded-[2rem] border border-[#55766F]/[.14] bg-[#FFF9EE]/95 p-8 shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
              <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#CFE3DF]/65"><Sparkles className="h-8 w-8 text-[#C76624]" /></div>
              <h2 className="mb-4 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.nav.products}</h2>
              <p className="text-gray-600 mb-8">{t.checkout.authRequired}</p>
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="w-full rounded-xl bg-[#C76624] py-3.5 font-semibold text-white transition hover:bg-[#A95120]"
                >
                  {t.checkout.logIn}
                </button>
              </div>
              <button onClick={() => onNavigate('products')} className="w-full rounded-xl border border-[#55766F]/[.18] bg-white/65 py-3 font-medium text-[#3F665E] transition hover:bg-[#CFE3DF]/35">{t.nav.products}</button>
            </div>
          </div>
        </div>
        <AuthRequiredModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} actionType="checkout" />
      </>
    );
  }

  if (user && (!userProfile || !userProfile.profile_completed) && !profileLoading) {
    return (
      <>
        <div className="joko-mineral-field flex min-h-[70vh] items-center justify-center px-4 py-12">
          <div className="w-full max-w-md rounded-[2rem] border border-[#55766F]/[.14] bg-[#FFF9EE]/95 p-8 text-center shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
            <h2 className="mb-3 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.profile.completeProfile}</h2>
            <p className="mb-6 text-[#303532]/[.68]">{t.profile.completeProfileMessage}</p>
          </div>
        </div>
        <ProfileCompletionModal
          isOpen={isProfileModalOpen}
          onClose={() => onNavigate('home')}
          onComplete={() => setIsProfileModalOpen(false)}
          showCelebration={showCelebrationOnProfile}
          onNavigate={onNavigate}
        />
      </>
    );
  }

  if (items.length === 0) {
    return (
      <div className="joko-mineral-field flex min-h-[70vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[2rem] border border-[#55766F]/[.14] bg-[#FFF9EE]/95 p-8 text-center shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
          <h2 className="mb-4 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.cart.empty}</h2>
          <button onClick={() => onNavigate('products')} className="rounded-xl bg-[#C76624] px-8 py-3 font-semibold text-white transition hover:bg-[#A95120]">{t.nav.products}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="joko-mineral-field min-h-screen py-8 sm:py-12 lg:py-14">
      <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.035em] text-[#292D2B] sm:text-5xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.checkout.title}</h1>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="rounded-[2rem] border border-[#55766F]/[.14] bg-[#FFF9EE]/95 p-6 shadow-[0_18px_50px_rgba(59,74,69,0.07)]">
              <h2 className="mb-4 text-2xl font-semibold tracking-[-0.02em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.checkout.orderSummary}</h2>
              <div className="space-y-3">
                {items.map((item) => {
                  const productName = language === 'th' ? item.product.name_th : item.product.name_en;
                  return (
                    <div key={item.product.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{productName} × {item.quantity}</span>
                      <span className="font-semibold text-[#303532]">฿{(item.product.price * item.quantity).toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="pt-3 border-t border-gray-200 flex justify-between text-lg font-bold">
                  <span className="text-gray-900">{t.cart.total}</span>
                  <span className="text-[#C76624]">฿{totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[#55766F]/[.14] bg-[#CFE3DF]/[.42] p-6">
              <h3 className="mb-3 text-lg font-semibold text-[#304B45]" style={{ fontFamily: 'var(--joko-font-display)' }}>{t.checkout.paymentInfo}</h3>
              <p className="text-sm leading-6 text-[#303532]/[.72]">{t.checkout.paymentInfoText}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 rounded-[2rem] border border-[#55766F]/[.14] bg-[#FFF9EE]/95 p-6 shadow-[0_18px_50px_rgba(59,74,69,0.07)]">
            <div className="rounded-xl border border-[#55766F]/[.14] bg-[#CFE3DF]/45 p-4">
              <p className="text-sm text-[#304B45]">{t.checkout.loggedInAs.replace('{{name}}', userProfile?.name || user?.email || '')}</p>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-4">
                <Calendar className="h-4 w-4 mr-2" />
                {t.checkout.pickupDetails}
              </label>
              <div className="space-y-2">
                {pickupDays.map((day) => {
                  const displayLabel = getPickupDayLabel(day, language);
                  const concretePickupDate = getNextPickupDate(day);
                  const isSelected = selectedPickupDay === day.label || selectedPickupDay === day.day_key;
                  const isOpen = isDayOpenForOrdering(day);
                  const isCompatible = isDayCompatibleWithCart(day);
                  const isSelectable = isOpen && isCompatible;

                  return (
                    <label
                      key={day.id}
                      className={`flex items-center p-4 border-2 rounded-lg transition-colors ${
                        isSelected
                          ? 'border-[#55766F] bg-[#CFE3DF]/55'
                          : isSelectable
                            ? 'cursor-pointer border-[#55766F]/[.16] bg-white/65 hover:border-[#55766F]/45 hover:bg-[#CFE3DF]/30'
                            : 'cursor-not-allowed border-[#55766F]/10 bg-white/40 opacity-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pickupDay"
                        value={day.label}
                        checked={isSelected}
                        disabled={!isSelectable}
                        onChange={() => handlePickupDayChange(day.label)}
                        className="mr-3"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{displayLabel}</div>
                        {concretePickupDate && (
                          <p className={`mt-0.5 text-xs font-semibold ${isSelectable ? 'text-[#3F665E]' : 'text-[#303532]/50'}`}>
                            {formatPickupDate(concretePickupDate)}
                          </p>
                        )}
                        {isSelected && isOpen && isCompatible && <p className="mt-1 text-xs text-[#3F665E]">{t.checkout.pickupDayFromCatalog}</p>}
                        {!isOpen && (
                          <p className="text-xs text-red-600 mt-1">
                            {day.cutoff_day && day.cutoff_time ? `Cutoff passed (${day.cutoff_day} ${day.cutoff_time})` : 'Pickup schedule is not fully configured'}
                          </p>
                        )}
                        {isOpen && !isCompatible && <p className="text-xs text-gray-500 mt-1">Not available for all items in your cart</p>}
                      </div>
                    </label>
                  );
                })}
              </div>
              {errors.pickupDay && <p className="text-red-500 text-xs mt-2">{errors.pickupDay}</p>}
            </div>

            {findSelectedDay() && isDayOpenForOrdering(findSelectedDay()!) && isDayCompatibleWithCart(findSelectedDay()!) && (
              <NonBakeryCheckoutSuggestions
                legacyPickupDay={findSelectedDay()}
                onProductClick={(product) => onNavigate(`product/${product.slug}`)}
              />
            )}

            <button
              type="submit"
              disabled={isSubmitting}
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
