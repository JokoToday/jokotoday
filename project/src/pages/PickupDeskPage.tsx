import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

interface OrderItem {
  product_name: string;
  quantity: number;
}

interface Order {
  id: string;
  order_number: string;
  pickup_date: string;
  order_items: OrderItem[];
}

export function PickupDeskPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shortCode = params.get('code');

    if (!shortCode) {
      setLoading(false);
      return;
    }

    fetchOrders(shortCode);
  }, []);

  const fetchOrders = async (shortCode: string) => {
    setLoading(true);

    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, pickup_date, order_items')
      .eq('customer_short_code', shortCode)
      .order('pickup_date', { ascending: true });

    if (!error && data) {
      setOrders(data);
    }

    setLoading(false);
  };

  if (loading) return <p className="p-4">Loading orders…</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        {language === 'th' ? 'ออเดอร์สำหรับรับสินค้า' : 'Pickup Orders'}
      </h1>

      {orders.length === 0 && <p>No orders found.</p>}

      <ul className="space-y-4">
        {orders.map(order => (
          <li key={order.id} className="border p-4 rounded-xl">
            <div className="font-semibold">
              #{order.order_number} — {order.pickup_date}
            </div>
            <ul className="ml-4 list-disc">
              {order.order_items.map((item, idx) => (
                <li key={idx}>
                  {item.product_name} × {item.quantity}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
