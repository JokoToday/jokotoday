type ReceiptItem = {
  product_name?: string;
  product_name_en?: string;
  product_name_th?: string;
  name?: string;
  name_th?: string;
  quantity?: number;
  qty?: number;
  price_at_order?: number;
  price?: number;
};

type ReceiptOrder = {
  order_number: string;
  order_items?: unknown[] | null;
  total_amount?: number | string | null;
  walk_in_amount?: number | string | null;
  purchase_type?: string | null;
  pickup_date?: string | null;
  picked_up_at?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
};

type PrintReceiptOptions = {
  order: ReceiptOrder;
  customerName?: string | null;
  language?: 'en' | 'th';
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const money = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
};

const itemName = (item: ReceiptItem, language: 'en' | 'th') => {
  if (language === 'th') {
    return item.product_name_th || item.name_th || item.product_name || item.product_name_en || item.name || '—';
  }
  return item.product_name || item.product_name_en || item.name || item.product_name_th || item.name_th || '—';
};

const paymentLabel = (method: string | null | undefined, language: 'en' | 'th') => {
  if (method === 'cash') return language === 'th' ? 'เงินสด' : 'Cash';
  if (method === 'qr_code' || method === 'qr') return 'QR';
  return language === 'th' ? 'ไม่ได้บันทึก' : 'Not recorded';
};

const formatDate = (value: string | null | undefined, language: 'en' | 'th') => {
  if (!value) return language === 'th' ? 'ไม่ได้บันทึก' : 'Not recorded';
  const source = value.length === 10 ? `${value}T00:00:00+07:00` : value;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(language === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(value.length === 10 ? {} : { hour: '2-digit', minute: '2-digit' }),
  });
};

export function printOrderReceipt({ order, customerName, language = 'en' }: PrintReceiptOptions) {
  const printWindow = window.open('', '_blank', 'width=440,height=760');
  if (!printWindow) {
    throw new Error('Print window was blocked');
  }

  const items = (Array.isArray(order.order_items) ? order.order_items : []) as ReceiptItem[];
  const total = order.purchase_type === 'walk_in'
    ? order.walk_in_amount ?? order.total_amount
    : order.total_amount;

  const rows = items.map((item) => {
    const quantity = Number(item.quantity ?? item.qty ?? 0);
    const price = Number(item.price_at_order ?? item.price ?? 0);
    return `
      <tr>
        <td>${escapeHtml(itemName(item, language))}<div class="muted">${quantity} × ฿${money(price)}</div></td>
        <td class="right">฿${money(quantity * price)}</td>
      </tr>`;
  }).join('');

  const labels = language === 'th'
    ? {
      title: 'ใบเสร็จรับเงิน', disclaimer: 'เอกสารนี้ไม่ใช่ใบกำกับภาษี', order: 'เลขที่คำสั่งซื้อ', customer: 'ลูกค้า',
      scheduled: 'วันที่รับสินค้าที่กำหนด', pickedUp: 'รับสินค้าจริง', payment: 'ชำระโดย', items: 'รายการ', total: 'รวม', thanks: 'ขอบคุณค่ะ/ครับ',
    }
    : {
      title: 'Order Receipt', disclaimer: 'This document is not a tax invoice.', order: 'Order', customer: 'Customer',
      scheduled: 'Scheduled pickup', pickedUp: 'Picked up', payment: 'Payment', items: 'Items', total: 'Total', thanks: 'Thank you.',
    };

  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.title)} ${escapeHtml(order.order_number)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 24px; font-size: 13px; }
    h1 { font-size: 22px; margin: 0; letter-spacing: .04em; }
    h2 { font-size: 16px; margin: 6px 0 18px; }
    .muted { color: #666; font-size: 11px; margin-top: 2px; }
    .meta { margin: 14px 0 18px; line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 9px 0; border-bottom: 1px solid #ddd; vertical-align: top; text-align: left; }
    .right { text-align: right; white-space: nowrap; }
    .total { font-size: 16px; font-weight: 700; padding-top: 14px; }
    .footer { margin-top: 28px; text-align: center; }
    @media print { body { padding: 8mm; } }
  </style>
</head>
<body>
  <h1>JOKO TODAY</h1>
  <h2>${escapeHtml(labels.title)}</h2>
  <div class="muted">${escapeHtml(labels.disclaimer)}</div>
  <div class="meta">
    <div><strong>${escapeHtml(labels.order)}:</strong> ${escapeHtml(order.order_number)}</div>
    ${customerName ? `<div><strong>${escapeHtml(labels.customer)}:</strong> ${escapeHtml(customerName)}</div>` : ''}
    ${order.pickup_date ? `<div><strong>${escapeHtml(labels.scheduled)}:</strong> ${escapeHtml(formatDate(order.pickup_date, language))}</div>` : ''}
    ${order.picked_up_at ? `<div><strong>${escapeHtml(labels.pickedUp)}:</strong> ${escapeHtml(formatDate(order.picked_up_at, language))}</div>` : ''}
    <div><strong>${escapeHtml(labels.payment)}:</strong> ${escapeHtml(paymentLabel(order.payment_method, language))}</div>
  </div>
  <table>
    <thead><tr><th>${escapeHtml(labels.items)}</th><th class="right"></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="2" class="muted">—</td></tr>`}</tbody>
  </table>
  <div class="right total">${escapeHtml(labels.total)}: ฿${money(total)}</div>
  <div class="footer">${escapeHtml(labels.thanks)}</div>
  <script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
  printWindow.document.close();
}
