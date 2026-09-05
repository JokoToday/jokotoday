import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { CMSProduct } from '../../lib/cmsService';
import { supabase } from '../../lib/supabase';
import { Order, PickupDay, PickupLocation } from './OrderTypes';
import { PrintOrderConfirmationButton } from './PrintOrderConfirmationButton';

interface OrderPrintButtonByIdProps {
  orderId: string;
  language: 'en' | 'th' | 'zh';
  getLabel: (key: string, lang: 'en' | 'th' | 'zh', fallback: string) => string;
  className?: string;
}

const BUTTON_FALLBACK = {
  en: 'Print confirmation',
  th: 'พิมพ์ใบยืนยัน',
  zh: '打印确认单',
} as const;

export function OrderPrintButtonById({
  orderId,
  language,
  getLabel,
  className = '',
}: OrderPrintButtonByIdProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [productMap, setProductMap] = useState<Record<string, CMSProduct>>({});
  const [pickupDays, setPickupDays] = useState<PickupDay[]>([]);
  const [locationMap, setLocationMap] = useState<Record<string, PickupLocation>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadConfirmation() {
      if (!orderId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('id, order_number, customer_name, order_items, total_amount, pickup_day, pickup_date, pickup_date_id, pickup_location_id, status, payment_status, created_at, purchase_type, loyalty_points_earned')
          .eq('id', orderId)
          .maybeSingle();

        if (orderError) throw orderError;
        if (!orderData) throw new Error('Order confirmation is unavailable.');

        const typedOrder = orderData as Order;
        const [pickupRes, locationsRes] = await Promise.all([
          supabase.from('cms_pickup_days').select('id, day_key, label, label_en, label_th, label_zh, location_id'),
          supabase.from('cms_pickup_locations').select('id, name_en, name_th, name_zh, maps_url'),
        ]);

        if (pickupRes.error) throw pickupRes.error;
        if (locationsRes.error) throw locationsRes.error;

        const nextLocationMap: Record<string, PickupLocation> = {};
        (locationsRes.data || []).forEach((location) => {
          nextLocationMap[location.id] = location as PickupLocation;
        });

        const productIds = Array.from(new Set(
          (typedOrder.order_items || []).map((item) => item.product_id).filter(Boolean),
        ));
        const nextProductMap: Record<string, CMSProduct> = {};

        if (productIds.length > 0) {
          const { data: products, error: productsError } = await supabase
            .from('cms_products')
            .select('id, slug, name_en, name_th, name_zh, desc_en, desc_th, desc_zh, price, image')
            .in('id', productIds);

          if (productsError) throw productsError;
          (products || []).forEach((product) => {
            nextProductMap[product.id] = product as CMSProduct;
          });
        }

        if (!cancelled) {
          setOrder(typedOrder);
          setPickupDays((pickupRes.data || []) as PickupDay[]);
          setLocationMap(nextLocationMap);
          setProductMap(nextProductMap);
        }
      } catch (error) {
        console.error('Could not load printable order confirmation:', error);
        if (!cancelled) setOrder(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadConfirmation();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!order) {
    return (
      <button
        type="button"
        disabled
        aria-busy={loading}
        className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-white opacity-60 cursor-not-allowed ${className}`}
        style={{ borderColor: '#d6c7a8', color: '#6b5b3f' }}
      >
        <Printer className="w-3.5 h-3.5" />
        {getLabel('my_orders_page.print_confirmation', language, BUTTON_FALLBACK[language])}
      </button>
    );
  }

  return (
    <PrintOrderConfirmationButton
      order={order}
      language={language}
      productMap={productMap}
      pickupDays={pickupDays}
      locationMap={locationMap}
      getLabel={getLabel}
      className={className}
    />
  );
}
