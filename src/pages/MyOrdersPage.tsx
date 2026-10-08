import { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { supabase } from '../lib/supabase';
import { CMSProduct } from '../lib/cmsService';
import { cancelOnlineOrderCompatible } from '../lib/orderServiceV2';
import { Order, PickupDay, PickupLocation } from '../components/orders/OrderTypes';
import { MyOrdersList } from '../components/orders/MyOrdersList';
import { OnlinePromptPayPanel } from '../components/OnlinePromptPayPanel';
import { getPaymentSettings } from '../lib/paymentService';

interface MyOrdersPageProps {
  onNavigate: (page: string) => void;
}

export function MyOrdersPage({ onNavigate }: MyOrdersPageProps) {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { getLabel } = useCMSLabels();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [productMap, setProductMap] = useState<Record<string, CMSProduct>>({});
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);
  const [locationMap, setLocationMap] = useState<Record<string, PickupLocation>>({});
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelError, setCancelError] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<Order | null>(null);
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setOnlinePaymentEnabled(false);
      return;
    }

    void getPaymentSettings()
      .then((settings) => {
        if (!cancelled) setOnlinePaymentEnabled(settings.online_promptpay_enabled);
      })
      .catch(() => {
        if (!cancelled) setOnlinePaymentEnabled(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const loadAll = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const [ordersRes, pickupRes, locationsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, customer_name, order_items, total_amount, loyalty_discount_amount, amount_paid, pickup_day, pickup_date, pickup_date_id, pickup_location_id, status, payment_status, payment_method, created_at, picked_up_at, purchase_type, walk_in_amount, loyalty_points_earned')
          .eq('customer_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('cms_pickup_days').select('id, day_key, label, label_en, label_th, label_zh, location_id'),
        supabase.from('cms_pickup_locations').select('id, name_en, name_th, name_zh, maps_url'),
      ]);

      if (ordersRes.error) throw ordersRes.error;

      setOrders(ordersRes.data || []);
      setPickupDays(pickupRes.data || []);

      const locMap: Record<string, PickupLocation> = {};
      (locationsRes.data || []).forEach(l => { locMap[l.id] = l as PickupLocation; });
      setLocationMap(locMap);

      const allProductIds = (ordersRes.data || [])
        .flatMap(o => (o.order_items || []).map((i: { product_id: string }) => i.product_id))
        .filter(Boolean);

      const uniqueIds = [...new Set(allProductIds)];
      if (uniqueIds.length > 0) {
        const { data: products } = await supabase
          .from('cms_products')
          .select('id, slug, name_en, name_th, name_zh, desc_en, desc_th, desc_zh, price, image')
          .in('id', uniqueIds);

        if (products) {
          const map: Record<string, CMSProduct> = {};
          products.forEach(p => { map[p.id] = p as CMSProduct; });
          setProductMap(map);
        }
      }
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCancelModal = (order: Order) => {
    setCancelError('');
    setCancelTarget(order);
  };

  const handleCancelOrder = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    setCancelError('');
    try {
      const cancelledOrder = await cancelOnlineOrderCompatible(cancelTarget);

      setOrders(prev => prev.map(order => (
        order.id === cancelledOrder.id
          ? { ...order, ...cancelledOrder }
          : order
      )));
      setCancelTarget(null);
    } catch (err) {
      console.error('Cancel error:', err);
      setCancelError(err instanceof Error ? err.message : 'Failed to cancel order. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!user) {
    return (
      <div className="joko-mineral-field flex min-h-[70vh] items-center justify-center px-4">
        <div className="rounded-[2rem] border border-[#55766F]/14 bg-[#FFF9EE]/94 p-8 text-center shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
          <p className="text-gray-600 mb-4">
            {language === 'zh' ? '请登录查看您的订单' : language === 'th' ? 'กรุณาเข้าสู่ระบบเพื่อดูคำสั่งซื้อ' : 'Please sign in to view your orders.'}
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="rounded-xl bg-[#C76624] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#A95120]"
          >
            {language === 'zh' ? '返回首页' : language === 'th' ? 'กลับหน้าหลัก' : 'Go to Home'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="joko-mineral-field min-h-screen px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => onNavigate('home-dashboard')}
            className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#FFF9EE]/78 px-4 py-2 text-sm font-semibold text-[#3F665E] transition hover:bg-[#FFF9EE]"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'th' ? 'กลับ' : language === 'zh' ? '返回' : 'Back'}
          </button>

          <div className="mb-6 rounded-[2rem] border border-[#55766F]/14 bg-[#FFF9EE]/94 p-6 shadow-[0_18px_50px_rgba(59,74,69,0.08)] sm:p-8">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B]" style={{ fontFamily: 'var(--joko-font-display)' }}>
              {getLabel('my_orders_page.my_orders_title', language, 'My Orders')}
            </h1>
          </div>

          <div className="rounded-[2rem] border border-[#55766F]/14 bg-[#FFF9EE]/88 p-4 shadow-[0_18px_50px_rgba(59,74,69,0.06)] sm:p-6">
            {loading ? (
              <div className="py-20 text-center">
                <div
                  className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                  style={{ borderColor: '#55766F', borderTopColor: 'transparent' }}
                />
              </div>
            ) : (
              <MyOrdersList
                orders={orders}
                language={language}
                productMap={productMap}
                pickupDays={pickupDays}
                locationMap={locationMap}
                getLabel={getLabel}
                onNavigate={onNavigate}
                onCancelRequest={openCancelModal}
                onPayRequest={onlinePaymentEnabled ? setPaymentTarget : undefined}
              />
            )}
          </div>
        </div>
      </div>

      {paymentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="relative max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-[2rem] bg-[#FFF9EE] p-4 shadow-2xl sm:p-6">
            <button
              type="button"
              onClick={() => setPaymentTarget(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-white/80 p-2 text-[#303532]/65 transition hover:bg-white"
              aria-label="Close payment"
            >
              <X className="h-4 w-4" />
            </button>
            <OnlinePromptPayPanel
              orderId={paymentTarget.id}
              language={language}
              onPaid={() => void loadAll()}
            />
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
            <div className={`w-14 h-14 ${cancelError ? 'bg-orange-100' : 'bg-red-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <AlertTriangle className={`w-7 h-7 ${cancelError ? 'text-orange-500' : 'text-red-500'}`} />
            </div>

            {cancelError ? (
              <>
                <h3 className="text-lg font-bold text-stone-900 mb-2">
                  {language === 'th' ? 'ไม่สามารถยกเลิกได้' : language === 'zh' ? '无法取消订单' : 'Cancellation unavailable'}
                </h3>
                <p className="text-stone-600 text-sm mb-6 leading-relaxed">{cancelError}</p>
                <button
                  onClick={() => { setCancelTarget(null); setCancelError(''); }}
                  className="w-full bg-stone-100 text-stone-700 py-3 rounded-xl font-medium hover:bg-stone-200 transition-colors"
                >
                  {t.confirmation.cancelNo}
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-stone-900 mb-2">{t.confirmation.cancelConfirmTitle}</h3>
                <p className="text-stone-600 text-sm mb-8 leading-relaxed">{t.confirmation.cancelConfirmMessage}</p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleCancelOrder}
                    disabled={isCancelling}
                    className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isCancelling ? '...' : t.confirmation.cancelYes}
                  </button>
                  <button
                    onClick={() => setCancelTarget(null)}
                    className="w-full bg-stone-100 text-stone-700 py-3 rounded-xl font-medium hover:bg-stone-200 transition-colors"
                  >
                    {t.confirmation.cancelNo}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
