import React, { useState, useEffect } from 'react';
import { ArrowLeft, ShoppingBag, Calendar, MapPin, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { supabase } from '../lib/supabase';

interface Order {
  id: string;
  order_number: string;
  order_items: any[];
  total_amount: number;
  pickup_date: string;
  status: string;
  payment_status: string;
  created_at: string;
  pickup_location_id: string;
  purchase_type?: 'online' | 'walk_in';
  walk_in_amount?: number;
}

interface MyOrdersPageProps {
  onNavigate: (page: string) => void;
}

export function MyOrdersPage({ onNavigate }: MyOrdersPageProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();

  const [activeTab, setActiveTab] = useState<'online' | 'walk_in'>('online');
  const [onlineOrders, setOnlineOrders] = useState<Order[]>([]);
  const [walkInOrders, setWalkInOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  const loadOrders = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const online = data?.filter(
        order => order.purchase_type === 'online' || !order.purchase_type
      ) || [];
      const walkIn = data?.filter(
        order => order.purchase_type === 'walk_in'
      ) || [];

      setOnlineOrders(online);
      setWalkInOrders(walkIn);
    } catch (err) {
      console.error('Error loading orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: getLabel('orders_page.status_pending', language, 'Pending'),
      confirmed: getLabel('orders_page.status_confirmed', language, 'Confirmed ✓'),
      ready: getLabel('orders_page.status_ready', language, 'Ready for pickup! 🎉'),
      picked_up: getLabel('orders_page.status_picked_up', language, 'Picked up'),
      cancelled: getLabel('orders_page.status_cancelled', language, 'Cancelled'),
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-blue-100 text-blue-800',
      ready: 'bg-green-100 text-green-800',
      picked_up: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colorMap[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const OnlineOrderCard = ({ order }: { order: Order }) => (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm text-gray-500">
            {getLabel('orders_page.order_number', language, 'Order #')}
          </p>
          <p className="text-lg font-bold text-gray-900">{order.order_number}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
          {getStatusLabel(order.status)}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Calendar className="w-4 h-4 text-amber-600" />
          <span className="font-medium">{getLabel('orders_page.pickup_day', language, 'Pickup Day')}:</span>
          <span>{formatDate(order.pickup_date)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <ShoppingBag className="w-4 h-4 text-amber-600" />
          <span className="font-medium">{getLabel('orders_page.items_summary', language, 'Items')}:</span>
          <span>{order.order_items?.length || 0} items</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <DollarSign className="w-4 h-4 text-amber-600" />
          <span className="font-medium">{getLabel('orders_page.total', language, 'Total')}:</span>
          <span className="font-semibold">฿{Number(order.total_amount).toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className={`px-2 py-1 rounded text-xs font-semibold ${
            order.payment_status === 'paid'
              ? 'bg-green-100 text-green-800'
              : 'bg-orange-100 text-orange-800'
          }`}>
            {order.payment_status === 'paid'
              ? getLabel('orders_page.paid', language, 'Paid ✓')
              : getLabel('orders_page.pay_at_pickup', language, 'Pay at pickup')}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <button className="flex-1 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors">
          {getLabel('orders_page.view_details', language, 'View Details')}
        </button>
      </div>
    </div>
  );

  const WalkInOrderCard = ({ order }: { order: Order }) => (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm text-gray-500">
            {getLabel('orders_page.order_number', language, 'Order #')}
          </p>
          <p className="text-lg font-bold text-gray-900">{order.order_number}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          {getLabel('orders_page.in_store_label', language, 'In-Store Purchase')}
        </span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <Calendar className="w-4 h-4 text-green-600" />
          <span className="font-medium">{language === 'en' ? 'Date' : 'วันที่'}:</span>
          <span>{formatDate(order.created_at)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <DollarSign className="w-4 h-4 text-green-600" />
          <span className="font-medium">{getLabel('orders_page.total', language, 'Total')}:</span>
          <span className="font-semibold">฿{Number(order.walk_in_amount || order.total_amount).toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
            {getLabel('orders_page.paid', language, 'Paid ✓')}
          </span>
        </div>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to view your orders.</p>
          <button
            onClick={() => onNavigate('home')}
            className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            {getLabel('orders_page.header', language, 'My Orders 📦')}
          </h1>

          <div className="flex gap-2 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('online')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'online'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {getLabel('orders_page.online_tab', language, '🛍 Online Orders')}
            </button>
            <button
              onClick={() => setActiveTab('walk_in')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'walk_in'
                  ? 'border-amber-600 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {getLabel('orders_page.in_store_tab', language, '🏪 In-Store Purchases')}
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
              <p className="text-gray-600 mt-4">
                {getLabel('general.loading', language, 'Loading...')}
              </p>
            </div>
          ) : activeTab === 'online' ? (
            <div>
              {onlineOrders.length > 0 ? (
                <div>
                  <p className="text-lg font-semibold text-gray-900 mb-4">
                    {getLabel('orders_page.goodies_coming', language, 'Your goodies are on the way 🥐')}
                  </p>
                  <div className="space-y-4">
                    {onlineOrders.map(order => (
                      <OnlineOrderCard key={order.id} order={order} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <ShoppingBag className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {getLabel('orders_page.no_current', language, 'No online orders')}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {getLabel('orders_page.no_current_text', language, 'Ready to order some delicious treats?')}
                  </p>
                  <button
                    onClick={() => onNavigate('products')}
                    className="px-6 py-3 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors"
                  >
                    {getLabel('orders_page.start_shopping', language, 'Start Shopping')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              {walkInOrders.length > 0 ? (
                <div>
                  <p className="text-lg font-semibold text-gray-900 mb-4">
                    {language === 'en' ? 'Your in-store purchases' : 'การซื้อหน้าร้านของคุณ'}
                  </p>
                  <div className="space-y-4">
                    {walkInOrders.map(order => (
                      <WalkInOrderCard key={order.id} order={order} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                    <ShoppingBag className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {getLabel('orders_page.no_in_store', language, 'No in-store purchases yet')}
                  </h3>
                  <p className="text-gray-600">
                    {language === 'en'
                      ? 'Visit the store to make your first in-store purchase.'
                      : 'เยี่ยมชมร้านเพื่อทำการซื้อหน้าร้านครั้งแรกของคุณ'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
