import { Printer } from 'lucide-react';
import { CMSProduct } from '../../lib/cmsService';
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
  button: {
    en: 'Print confirmation',
    th: 'พิมพ์ใบยืนยัน',
    zh: '打印确认单',
  },
  title: {
    en: 'Order confirmation',
    th: 'ใบยืนยันคำสั่งซื้อ',
    zh: '订单确认单',
  },
  customer: {
    en: 'Customer',
    th: 'ลูกค้า',
    zh: '客户',
  },
  order: {
    en: 'Order',
    th: 'คำสั่งซื้อ',
    zh: '订单',
  },
  ordered: {
    en: 'Ordered',
    th: 'วันที่สั่งซื้อ',
    zh: '下单日期',
  },
  pickup: {
    en: 'Pickup',
    th: 'รับสินค้า',
    zh: '取货',
  },
  location: {
    en: 'Location',
    th: 'สถานที่รับสินค้า',
    zh: '取货地点',
  },
  items: {
    en: 'Items',
    th: 'รายการสินค้า',
    zh: '商品',
  },
  quantity: {
    en: 'Qty',
    th: 'จำนวน',
    zh: '数量',
  },
  unitPrice: {
    en: 'Unit price',
    th: 'ราคาต่อชิ้น',
    zh: '单价',
  },
  total: {
    en: 'Total',
    th: 'ยอดรวม',
    zh: '总计',
  },
  payment: {
    en: 'Pay when you pick up. Cash or Thai QR payment is available.',
    th: 'ชำระเงินเมื่อรับสินค้า สามารถชำระด้วยเงินสดหรือ Thai QR ได้',
    zh: '取货时付款。可使用现金或 Thai QR 付款。',
  },
  footer: {
    en: 'JOKO TODAY · Life is worth noticing.',
    th: 'JOKO TODAY · Life is worth noticing.',
    zh: 'JOKO TODAY · Life is worth noticing.',
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value: string, language: 'en' | 'th' | 'zh', includeWeekday = false): string {
  if (!value) return '—';

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12))
    : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(
    language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB',
    {
      ...(includeWeekday ? { weekday: 'long' as const } : {}),
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      ...(dateOnly ? { timeZone: 'UTC' } : {}),
    },
  );
}

function getProductName(
  item: OrderItem,
  language: 'en' | 'th' | 'zh',
  productMap: Record<string, CMSProduct>,
): string {
  if (language === 'th' && item.product_name_th) return item.product_name_th;
  if (language === 'zh' && item.product_name_zh) return item.product_name_zh;

  const product = productMap[item.product_id];
  if (!product) return item.product_name || '—';
  if (language === 'th') return product.name_th || product.name_en;
  if (language === 'zh') return product.name_zh || product.name_en;
  return product.name_en;
}

function getPickupLabel(order: Order, language: 'en' | 'th' | 'zh', pickupDays: PickupDay[]): string {
  const day = pickupDays.find((candidate) =>
    candidate.label === order.pickup_day
    || candidate.label_en === order.pickup_day
    || candidate.label_th === order.pickup_day
    || candidate.label_zh === order.pickup_day
  );

  if (day) {
    if (language === 'th') return day.label_th || day.label_en || day.label;
    if (language === 'zh') return day.label_zh || day.label_en || day.label;
    return day.label_en || day.label;
  }

  return order.pickup_day || '—';
}

function getLocationName(
  order: Order,
  language: 'en' | 'th' | 'zh',
  pickupDays: PickupDay[],
  locationMap: Record<string, PickupLocation>,
): string {
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
  const label = (key: string, fallback: string) => getLabel(`my_orders_page.${key}`, language, fallback);
  const pickupLabel = getPickupLabel(order, language, pickupDays);
  const locationName = getLocationName(order, language, pickupDays, locationMap);
  const customerName = order.customer_name?.trim() || '—';

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=760,height=900');
    if (!printWindow) return;

    const rows = (order.order_items || []).map((item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.price_at_order) || 0;
      const lineTotal = quantity * unitPrice;
      const productName = getProductName(item, language, productMap);

      return `
        <tr>
          <td>${escapeHtml(productName)}</td>
          <td class="num">${quantity}</td>
          <td class="num">฿${unitPrice.toFixed(2)}</td>
          <td class="num strong">฿${lineTotal.toFixed(2)}</td>
        </tr>`;
    }).join('');

    const title = label('print_confirmation_title', FALLBACK.title[language]);
    const customerLabel = label('print_customer', FALLBACK.customer[language]);
    const orderLabel = label('order_number', FALLBACK.order[language]);
    const orderedLabel = label('print_ordered', FALLBACK.ordered[language]);
    const pickupText = label('pickup_day', FALLBACK.pickup[language]);
    const locationText = label('print_location', FALLBACK.location[language]);
    const itemsText = label('print_items', FALLBACK.items[language]);
    const quantityText = label('quantity', FALLBACK.quantity[language]);
    const unitPriceText = label('unit_price', FALLBACK.unitPrice[language]);
    const totalText = label('total', FALLBACK.total[language]);
    const paymentText = label('print_payment_reminder', FALLBACK.payment[language]);
    const footerText = label('print_footer', FALLBACK.footer[language]);

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)} · #${escapeHtml(order.order_number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #24231f; background: #fff9ef; font-family: Arial, Helvetica, sans-serif; }
    .sheet { max-width: 760px; margin: 0 auto; padding: 40px; background: #fff9ef; }
    .brand { padding: 28px 32px; text-align: center; background: #c7c79a; border-radius: 18px 18px 0 0; }
    .brand-name { font-size: 24px; font-weight: 800; letter-spacing: .18em; }
    .brand-sub { margin-top: 8px; color: #c45a00; font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .content { padding: 32px; border: 1px solid #e0cbaa; border-top: 0; border-radius: 0 0 18px 18px; background: #fff; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 0 0 26px; }
    .meta-card { padding: 14px 16px; background: #f7ead7; border-radius: 10px; }
    .meta-card.customer { grid-column: 1 / -1; background: #eef0d9; }
    .label { margin-bottom: 5px; color: #52603b; font-size: 10px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; }
    .value { font-size: 15px; line-height: 1.5; font-weight: 700; }
    .customer .value { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { padding: 10px 8px; text-align: left; color: #8c8477; border-bottom: 1px solid #e0cbaa; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
    td { padding: 13px 8px; border-bottom: 1px solid #eee2cf; font-size: 13px; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .strong { font-weight: 800; }
    .total { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 16px 18px; background: #eef0d9; border-radius: 10px; font-weight: 800; }
    .total strong { font-size: 20px; }
    .payment { margin-top: 20px; padding: 14px 16px; border-left: 4px solid #c45a00; background: #f7ead7; font-size: 12px; line-height: 1.6; }
    .footer { margin-top: 28px; text-align: center; color: #8c8477; font-size: 11px; }
    @media print {
      body { background: #fff; }
      .sheet { max-width: none; padding: 0; }
      .content { border-color: #ddd; }
      @page { margin: 14mm; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="brand">
      <div class="brand-name">JOKO TODAY</div>
      <div class="brand-sub">${escapeHtml(title)}</div>
    </section>
    <section class="content">
      <div class="meta">
        <div class="meta-card customer"><div class="label">${escapeHtml(customerLabel)}</div><div class="value">${escapeHtml(customerName)}</div></div>
        <div class="meta-card"><div class="label">${escapeHtml(orderLabel)}</div><div class="value">#${escapeHtml(order.order_number)}</div></div>
        <div class="meta-card"><div class="label">${escapeHtml(orderedLabel)}</div><div class="value">${escapeHtml(formatDate(order.created_at, language))}</div></div>
        <div class="meta-card"><div class="label">${escapeHtml(pickupText)}</div><div class="value">${escapeHtml(pickupLabel)}${order.pickup_date ? `<br />${escapeHtml(formatDate(order.pickup_date, language, true))}` : ''}</div></div>
        <div class="meta-card"><div class="label">${escapeHtml(locationText)}</div><div class="value">${escapeHtml(locationName)}</div></div>
      </div>
      <div class="label">${escapeHtml(itemsText)}</div>
      <table>
        <thead><tr><th>${escapeHtml(itemsText)}</th><th class="num">${escapeHtml(quantityText)}</th><th class="num">${escapeHtml(unitPriceText)}</th><th class="num">${escapeHtml(totalText)}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total"><span>${escapeHtml(totalText)}</span><strong>฿${Number(order.total_amount).toFixed(2)}</strong></div>
      <div class="payment">${escapeHtml(paymentText)}</div>
      <div class="footer">${escapeHtml(footerText)}</div>
    </section>
  </main>
</body>
</html>`);
    printWindow.document.close();

    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 180);
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-white hover:bg-stone-50 transition-colors ${className}`}
      style={{ borderColor: '#d6c7a8', color: '#6b5b3f' }}
    >
      <Printer className="w-3.5 h-3.5" />
      {label('print_confirmation', FALLBACK.button[language])}
    </button>
  );
}
