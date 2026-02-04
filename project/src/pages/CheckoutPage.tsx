import { useState, useEffect } from 'react';
import { MapPin, Calendar, CheckCircle, Sparkles, Mail } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { supabase } from '../lib/supabase';
import LocationMap from '../components/LocationMap';
import { AuthModal } from '../components/AuthModal';
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
  const [authModalAction, setAuthModalAction] = useState<'signin' | 'signup'>('signin');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [showCelebrationOnProfile, setShowCelebrationOnProfile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState('');
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

    if (!user || !userProfile) return;

    setIsSubmitting(true);

    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          customer_name: userProfile.name || '',
          customer_email: user.email,
          customer_phone: userProfile.phone || '',
          line_id: userProfile.line_id || '',
          pickup_location: selectedPickupDay || '',
          pickup_day: selectedPickupDay || '',
          total_amount: totalPrice,
          status: 'pending',
          notes: formData.notes,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map((item) => {
        const productName = language === 'th' ? item.product.name_th : item.product.name_en;
        return {
          order_id: order.id,
          product_id: item.product.id,
          product_name: productName,
          quantity: item.quantity,
          price_at_order: item.product.price,
        };
      });

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) throw itemsError;

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
      setOrderComplete(true);
      clearCart();
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-background flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-background rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          <h2 className="text-3xl font-header font-bold text-primary-900 mb-4">{t.confirmation.title}</h2>
          <p className="text-gray-700 mb-6 leading-relaxed">
            {t.confirmation.thankYou}
          </p>
          <div className="bg-primary-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-1">{t.confirmation.orderNumber}</p>
            <p className="font-mono text-sm font-semibold text-primary-900">{orderId}</p>
          </div>
          <div className="space-y-2 text-sm text-gray-700 mb-8">
            <p>
              <strong>{t.confirmation.pickupDay}:</strong> {selectedPickupDay}
            </p>
            <p>
              <strong>{t.confirmation.total}:</strong> ฿{totalPrice.toFixed(2)}
            </p>
          </div>
          <p className="text-sm text-gray-600 mb-6">{t.confirmation.paymentReminder}</p>
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
                onClick={() => {
                  setAuthModalAction('signin');
                  setIsAuthModalOpen(true);
                }}
                className="w-full bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-5 h-5" />
                {t.checkout.logIn}
              </button>
              <button
                onClick={() => {
                  setAuthModalAction('signup');
                  setIsAuthModalOpen(true);
                }}
                className="w-full bg-white border-2 border-primary-600 text-primary-600 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
              >
                {t.checkout.signUp}
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
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialAction={authModalAction}
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
