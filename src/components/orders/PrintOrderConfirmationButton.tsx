import { Printer } from 'lucide-react';
import { CMSProduct } from '../../lib/cmsService';
import { supabase } from '../../lib/supabase';
import {
  printOrderDocument,
  type PrintOrderCopy,
  type PrintOrderLanguage,
} from '../../lib/printOrderDocument';
import { usePublishedJokoLogo } from '../../app/joko-today/builder/usePublishedJokoLogo';
import { Order, OrderItem, PickupDay, PickupLocation } from './OrderTypes';

interface PrintOrderConfirmationButtonProps {
  order: Order;
  language: 'en' | 'th' | 'zh';
  productMap: Record<string, CMSProduct>;
  pickupDays: PickupDay[];
  locationMap: Record<string, PickupLocation>;
  getLabel: (key: string, lang: 'en' | 'th' | 'zh', fallback: string) => string;
  className?: string;
}

const FALLBACK = {
  button: { en: 'Print confirmation', th: 'พิมพ์ใบยืนยัน', zh: '打印确认单' },
  title: { en: 'Order confirmation', th: 'ใบยืนยันคำสั่งซื้อ', zh: '订单确认单' },
  customer: { en: 'Customer', th: 'ลูกค้า', zh: '客户' },
  order: { en: 'Order', th: 'คำสั่งซื้อ', zh: '订单' },
  ordered: { en: 'Ordered', th: 'วันที่สั่งซื้อ', zh: '下单日期' },
  pickup: { en: 'Pickup', th: 'รับสินค้า', zh: '取货' },
  location: { en: 'Location', th: 'สถานที่รับสินค้า', zh: '取货地点' },
  status: { en: 'Order status', th: 'สถานะคำสั่งซื้อ', zh: '订单状态' },
  items: { en: 'Items', th: 'รายการสินค้า', zh: '商品' },
  quantity: { en: 'Qty', th: 'จำนวน', zh: '数量' },
  unitPrice: { en: 'Unit price', th: 'ราคาต่อชิ้น', zh: '单价' },
  gross: { en: 'Subtotal', th: 'ยอดก่อนส่วนลด', zh: '优惠前金额' },
  discount: { en: 'Loyalty discount', th: 'ส่วนลดสมาชิก', zh: '会员优惠' },
  total: { en: 'Amount due', th: 'ยอดที่ต้องชำระ', zh: '应付金额' },
  paymentHeading: { en: 'Payment', th: 'การชำระเงิน', zh: '付款' },
  paymentUnpaid: {
    en: 'Pay ฿{{amount}} when you pick up. Cash or Thai QR payment is available.',
    th: 'ชำระ ฿{{amount}} เมื่อรับสินค้า สามารถชำระด้วยเงินสดหรือ Thai QR ได้',
    zh: '取货时支付 ฿{{amount}}。可使用现金或 Thai QR 付款。',
  },
  paymentPaid: {
    en: 'Paid · ฿{{amount}}',
    th: 'ชำระแล้ว · ฿{{amount}}',
    zh: '已付款 · ฿{{amount}}',
  },
  paymentCancelled: {
    en: 'This order was cancelled. No payment is due.',
    th: 'คำสั่งซื้อนี้ถูกยกเลิกแล้ว ไม่มียอดที่ต้องชำระ',
    zh: '此订单已取消，无需付款。',
  },
  paymentReview: {
    en: 'Payment status is unresolved for this closed order. Please contact JOKO TODAY if needed.',
    th: 'สถานะการชำระเงินของคำสั่งซื้อที่ปิดแล้วนี้ยังไม่ชัดเจน โปรดติดต่อ JOKO TODAY หากจำเป็น',
    zh: '此已关闭订单的付款状态尚未明确。如有需要，请联系 JOKO TODAY。',
  },
  footer: {
    en: 'JOKO TODAY · Life is worth noticing.',
    th: 'JOKO TODAY · Life is worth noticing.',
    zh: 'JOKO TODAY · Life is worth noticing.',
  },
} as const;

const STATUS_FALLBACK: Record<string, Record<'en' | 'th' | 'zh', string>> = {
  pending: { en: 'Pending', th: 'รอดำเนินการ', zh: '待处理' },
  confirmed: { en: 'Confirmed', th: 'ยืนยันแล้ว', zh: '已确认' },
  ready: { en: 'Ready for pickup', th: 'พร้อมรับสินค้า', zh: '可取货' },
  picked_up: { en: 'Picked up', th: 'รับสินค้าแล้ว', zh: '已取货' },
  completed: { en: 'Completed', th: 'เสร็จสิ้น', zh: '已完成' },
  cancelled: { en: 'Cancelled', th: 'ยกเลิกแล้ว', zh: '已取消' },
};

function getProductName(item: OrderItem, language: 'en' | 'th' | 'zh', productMap: Record<string, CMSProduct>): string {
  if (language === 'th' && item.product_name_th) return item.product_name_th;
  if (language === 'zh' && item.product_name_zh) return item.product_name_zh;
  if (language === 'en' && item.product_name) return item.product_name;

  const product = productMap[item.product_id];
  if (product) {
    if (language === 'th') return product.name_th || product.name_en;
    if (language === 'zh') return product.name_zh || product.name_en;
    return product.name_en;
  }

  return item.product_name || item.product_name_th || item.product_name_zh || '—';
}

function getPickupLabel(order: Order, language: 'en' | 'th' | 'zh', pickupDays: PickupDay[]): string {
  const day = pickupDays.find((candidate) =>
    candidate.label === order.pickup_day
    || candidate.label_en === order.pickup_day
    || candidate.label_th === order.pickup_day
    || candidate.label_zh === order.pickup_day
  );
  if (!day) return order.pickup_day || '—';
  if (language === 'th') return day.label_th || day.label_en || day.label;
  if (language === 'zh') return day.label_zh || day.label_en || day.label;
  return day.label_en || day.label;
}

function getLocationName(order: Order, language: 'en' | 'th' | 'zh', pickupDays: PickupDay[], locationMap: Record<string, PickupLocation>): string {
  let locationId = order.pickup_location_id;
  if (!locationId) {
    const day = pickupDays.find((candidate) =>
      candidate.label === order.pickup_day
      || candidate.label_en === order.pickup_day
      || candidate.label_th === order.pickup_day
      || candidate.label_zh === order.pickup_day
    );
    locationId = day?.location_id || null;
  }
  if (!locationId) return '—';
  const location = locationMap[locationId];
  if (!location) return '—';
  if (language === 'th') return location.name_th || location.name_en;
  if (language === 'zh') return location.name_zh || location.name_en;
  return location.name_en;
}

export function PrintOrderConfirmationButton({
  order,
  language,
  productMap,
  pickupDays,
  locationMap,
  getLabel,
  className = '',
}: PrintOrderConfirmationButtonProps) {
  const publishedLogoUrl = usePublishedJokoLogo();
  const label = (key: string, fallback: string) => getLabel(`my_orders_page.${key}`, language, fallback);

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank', 'width=760,height=900');
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write('<!doctype html><title>JOKO TODAY</title><p style="font-family:Arial,sans-serif;padding:32px">Loading current order confirmation…</p>');
    printWindow.document.close();

    const { data: orderState, error } = await supabase
      .from('orders')
      .select('order_number, customer_name, order_items, total_amount, loyalty_discount_amount, amount_paid, pickup_day, pickup_date, pickup_date_id, pickup_location_id, status, payment_status, payment_method, created_at, purchase_type, walk_in_amount, loyalty_points_earned')
      .eq('id', order.id)
      .maybeSingle();

    if (error || !orderState) {
      printWindow.document.open();
      printWindow.document.write('<!doctype html><title>JOKO TODAY</title><p style="font-family:Arial,sans-serif;padding:32px">The current order state could not be verified. Please close this window and try again.</p>');
      printWindow.document.close();
      return;
    }

    const liveOrder = { ...order, ...orderState } as Order;
    const currentOrder: Order = {
      ...liveOrder,
      order_items: (liveOrder.order_items || []).map((item) => ({
        ...item,
        product_name: getProductName(item, 'en', productMap),
        product_name_th: getProductName(item, 'th', productMap),
        product_name_zh: getProductName(item, 'zh', productMap),
      })),
    };

    const languages: PrintOrderLanguage[] = ['en', 'th', 'zh'];
    const pickupLabels = Object.fromEntries(
      languages.map((lang) => [lang, getPickupLabel(currentOrder, lang, pickupDays)])
    ) as Record<PrintOrderLanguage, string>;
    const pickupLocationNames = Object.fromEntries(
      languages.map((lang) => [lang, getLocationName(currentOrder, lang, pickupDays, locationMap)])
    ) as Record<PrintOrderLanguage, string>;
    const statusLabels = Object.fromEntries(
      languages.map((lang) => {
        const fallback = STATUS_FALLBACK[currentOrder.status]?.[lang] || currentOrder.status || '—';
        return [lang, getLabel(`my_orders_page.print_status_${currentOrder.status}`, lang, fallback)];
      })
    ) as Record<PrintOrderLanguage, string>;

    const copyByLanguage = Object.fromEntries(
      languages.map((lang) => [lang, {
        title: getLabel('my_orders_page.print_confirmation_title', lang, FALLBACK.title[lang]),
        customer: getLabel('my_orders_page.print_customer', lang, FALLBACK.customer[lang]),
        order: getLabel('my_orders_page.order_number', lang, FALLBACK.order[lang]),
        ordered: getLabel('my_orders_page.print_ordered', lang, FALLBACK.ordered[lang]),
        pickup: getLabel('my_orders_page.pickup_day', lang, FALLBACK.pickup[lang]),
        location: getLabel('my_orders_page.print_location', lang, FALLBACK.location[lang]),
        status: getLabel('my_orders_page.print_status', lang, FALLBACK.status[lang]),
        items: getLabel('my_orders_page.print_items', lang, FALLBACK.items[lang]),
        quantity: getLabel('my_orders_page.quantity', lang, FALLBACK.quantity[lang]),
        unitPrice: getLabel('my_orders_page.unit_price', lang, FALLBACK.unitPrice[lang]),
        gross: getLabel('my_orders_page.print_gross', lang, FALLBACK.gross[lang]),
        discount: getLabel('my_orders_page.print_discount', lang, FALLBACK.discount[lang]),
        amountDue: getLabel('my_orders_page.total', lang, FALLBACK.total[lang]),
        totalPaid: getLabel('my_orders_page.total', lang, FALLBACK.total[lang]),
        payment: getLabel('my_orders_page.print_payment_heading', lang, FALLBACK.paymentHeading[lang]),
        thanks: getLabel('my_orders_page.print_footer', lang, FALLBACK.footer[lang]),
      }])
    ) as Record<PrintOrderLanguage, Partial<PrintOrderCopy>>;

    const gross = Number(currentOrder.total_amount) || 0;
    const discount = Math.max(0, Number(currentOrder.loyalty_discount_amount) || 0);
    const amountDue = Math.max(0, gross - discount);
    const storedPaid = Number(currentOrder.amount_paid);
    const amountPaid = currentOrder.amount_paid != null && Number.isFinite(storedPaid)
      ? storedPaid
      : amountDue;

    const paymentDescriptions = Object.fromEntries(
      languages.map((lang) => {
        let paymentText: string;
        if (currentOrder.status === 'cancelled') {
          paymentText = getLabel('my_orders_page.print_payment_cancelled', lang, FALLBACK.paymentCancelled[lang]);
        } else if (currentOrder.payment_status === 'paid') {
          paymentText = getLabel('my_orders_page.print_payment_paid', lang, FALLBACK.paymentPaid[lang])
            .replace('{{amount}}', amountPaid.toFixed(2));
        } else if (['pending', 'confirmed', 'ready'].includes(currentOrder.status)) {
          paymentText = getLabel('my_orders_page.print_payment_unpaid', lang, FALLBACK.paymentUnpaid[lang])
            .replace('{{amount}}', amountDue.toFixed(2));
        } else {
          paymentText = getLabel('my_orders_page.print_payment_review', lang, FALLBACK.paymentReview[lang]);
        }
        return [lang, paymentText];
      })
    ) as Record<PrintOrderLanguage, string>;

    printOrderDocument({
      order: currentOrder,
      customerName: currentOrder.customer_name?.trim() || null,
      language,
      targetWindow: printWindow,
      logoUrl: publishedLogoUrl,
      documentType: 'confirmation',
      pickupLabels,
      pickupLocationNames,
      statusLabels,
      paymentDescriptions,
      copyByLanguage,
    });
  };

  return (
    <button type="button" onClick={handlePrint} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-white hover:bg-stone-50 transition-colors ${className}`} style={{ borderColor: '#d6c7a8', color: '#6b5b3f' }}>
      <Printer className="w-3.5 h-3.5" />
      {label('print_confirmation', FALLBACK.button[language])}
    </button>
  );
}
