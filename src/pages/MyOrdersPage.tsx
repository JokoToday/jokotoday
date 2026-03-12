import React, { useState, useEffect } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { supabase } from '../lib/supabase';
import { CMSProduct } from '../lib/cmsService';
import { Order, PickupDay, PickupLocation } from '../components/orders/OrderTypes';
import { MyOrdersList } from '../components/orders/MyOrdersList';

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
  const [cancelTooLate, setCancelTooLate] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const loadAll = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const [ordersRes, pickupRes, locationsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, order_items, total_amount, pickup_day, pickup_date, pickup_location_id, status, payment_status, created_at, purchase_type, walk_in_amount, loyalty_points_earned')
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

  const isWithin24h = (order: Order): boolean => {
    const dateStr = order.pickup_date;
    if (!dateStr) return false;
    const pickupDate = new Date(dateStr);
    pickupDate.setHours(0, 0, 0, 0);
    const cutoff = new Date(pickupDate.getTime() - 24 * 60 * 60 * 1000);
    return new Date() >= cutoff;
  };

  const openCancelModal = (order: Order) => {
    setCancelTooLate(isWithin24h(order));
    setCancelTarget(order);
  };

  const handleCancelOrder = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      await supabase.from('orders').delete().eq('id', cancelTarget.id);
      setOrders(prev => prev.filter(o => o.id !== cancelTarget.id));
      setCancelTarget(null);
    } catch (err) {
      console.error('Cancel error:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f6f1e7' }}>
        <div className="text-center">
          <p className="text-stone-600 mb-4">
            {language === 'zh' ? '请登录查看您的订单' : language === 'th' ? 'กรุณาเข้าสู่ระบบเพื่อดูคำสั่งซื้อ' : 'Please sign in to view your orders.'}
          </p>
          <button
            onClick={() => onNavigate('home')}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
            style={{ background: '#c6a75e' }}
          >
            {language === 'zh' ? '返回首页' : language === 'th' ? 'กลับหน้าหลัก' : 'Go to Home'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen py-8 px-4" style={{ background: '#f6f1e7' }}>
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-800 mb-6 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'th' ? 'กลับ' : language === 'zh' ? '返回' : 'Back'}
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-stone-900">
              {getLabel('my_orders_page.my_orders_title', language, 'My Orders')}
            </h1>
            <div className="mt-1.5 h-0.5 w-12 rounded-full" style={{ background: '#c6a75e' }} />
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <div
                className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#c6a75e', borderTopColor: 'transparent' }}
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
            />
          )}
        </div>
      </div>

      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
            {cancelTooLate ? (
              <>
                <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-orange-500" />
                </div>
                <p className="text-stone-800 font-semibold text-base mb-6 leading-relaxed">
                  {t.confirmation.cancelTooLate}
                </p>
                <button
                  onClick={() => setCancelTarget(null)}
                  className="w-full bg-stone-100 text-stone-700 py-3 rounded-xl font-medium hover:bg-stone-200 transition-colors"
                >
                  {t.confirmation.cancelNo}
                </button>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-500" />
                </div>
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
