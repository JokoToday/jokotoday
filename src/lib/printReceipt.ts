type ReceiptLanguage = 'en' | 'th' | 'zh';

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
  loyalty_discount_amount?: number | string | null;
  amount_paid?: number | string | null;
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
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const money = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
};

const itemName = (item: ReceiptItem, language: ReceiptLanguage) => {
  if (language === 'th') {
    return item.product_name_th || item.name_th || item.product_name || item.product_name_en || item.name || '—';
  }
  return item.product_name || item.product_name_en || item.name || item.product_name_th || item.name_th || '—';
};

const paymentLabel = (method: string | null | undefined, language: ReceiptLanguage) => {
  if (method === 'cash') {
    if (language === 'th') return 'เงินสด';
    if (language === 'zh') return '现金';
    return 'Cash';
  }
  if (method === 'qr_code' || method === 'qr') return 'QR';
  if (language === 'th') return 'ไม่ได้บันทึก';
  if (language === 'zh') return '未记录';
  return 'Not recorded';
};

const formatDate = (value: string | null | undefined, language: ReceiptLanguage) => {
  if (!value) {
    if (language === 'th') return 'ไม่ได้บันทึก';
    if (language === 'zh') return '未记录';
    return 'Not recorded';
  }
  const source = value.length === 10 ? `${value}T00:00:00+07:00` : value;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return value;

  const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
  return date.toLocaleString(locale, {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(value.length === 10 ? {} : { hour: '2-digit', minute: '2-digit' }),
  });
};

const labelsFor = (language: ReceiptLanguage) => {
  if (language === 'th') {
    return {
      title: 'ใบเสร็จรับเงิน',
      disclaimer: 'เอกสารนี้ไม่ใช่ใบกำกับภาษี',
      order: 'เลขที่คำสั่งซื้อ',
      customer: 'ลูกค้า',
      scheduled: 'วันที่รับสินค้าที่กำหนด',
      pickedUp: 'รับสินค้าจริง',
      payment: 'ชำระโดย',
      items: 'รายการ',
      gross: 'ยอดก่อนส่วนลด',
      discount: 'ส่วนลดรางวัลสะสมแต้ม',
      total: 'ยอดชำระจริง',
      thanks: 'ขอบคุณค่ะ/ครับ',
      print: 'พิมพ์',
      language: 'ภาษาใบเสร็จ',
    };
  }

  if (language === 'zh') {
    return {
      title: '订单收据',
      disclaimer: '本文件不是税务发票。',
      order: '订单号',
      customer: '客户',
      scheduled: '计划取货时间',
      pickedUp: '实际取货时间',
      payment: '付款方式',
      items: '商品',
      gross: '折扣前金额',
      discount: '积分奖励折扣',
      total: '实付金额',
      thanks: '谢谢！',
      print: '打印',
      language: '收据语言',
    };
  }

  return {
    title: 'Order Receipt',
    disclaimer: 'This document is not a tax invoice.',
    order: 'Order',
    customer: 'Customer',
    scheduled: 'Scheduled pickup',
    pickedUp: 'Picked up',
    payment: 'Payment',
    items: 'Items',
    gross: 'Gross total',
    discount: 'Loyalty reward discount',
    total: 'Total paid',
    thanks: 'Thank you.',
    print: 'Print',
    language: 'Receipt language',
  };
};

export function printOrderReceipt({ order, customerName, language = 'en' }: PrintReceiptOptions) {
  const printWindow = window.open('', '_blank', 'width=500,height=800');
  if (!printWindow) {
    throw new Error('Print window was blocked');
  }

  const items = (Array.isArray(order.order_items) ? order.order_items : []) as ReceiptItem[];
  const grossTotal = Number(order.purchase_type === 'walk_in'
    ? order.walk_in_amount ?? order.total_amount
    : order.total_amount) || 0;
  const discount = Math.max(0, Number(order.loyalty_discount_amount) || 0);
  const paidValue = Number(order.amount_paid);
  const netTotal = Number.isFinite(paidValue)
    ? paidValue
    : Math.max(0, grossTotal - discount);

  const renderReceipt = (receiptLanguage: ReceiptLanguage) => {
    const labels = labelsFor(receiptLanguage);
    const rows = items.map((item) => {
      const quantity = Number(item.quantity ?? item.qty ?? 0);
      const price = Number(item.price_at_order ?? item.price ?? 0);
      return `
        <tr>
          <td>${escapeHtml(itemName(item, receiptLanguage))}<div class="muted">${quantity} × ฿${money(price)}</div></td>
          <td class="right">฿${money(quantity * price)}</td>
        </tr>`;
    }).join('');

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="${receiptLanguage === 'zh' ? 'zh-CN' : receiptLanguage}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(labels.title)} ${escapeHtml(order.order_number)}</title>
  <style>
    body { font-family: Arial, "Noto Sans Thai", "Noto Sans SC", sans-serif; color: #111; margin: 0; padding: 24px; font-size: 13px; }
    h1 { font-size: 22px; margin: 0; letter-spacing: .04em; }
    h2 { font-size: 16px; margin: 6px 0 18px; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 24px; padding: 12px; background: #f5f5f5; border-radius: 8px; }
    .toolbar-label { font-size: 12px; color: #555; margin-right: 4px; }
    .toolbar button { border: 1px solid #aaa; background: #fff; border-radius: 6px; padding: 7px 10px; font-size: 12px; cursor: pointer; }
    .toolbar button.active { background: #222; color: #fff; border-color: #222; }
    .toolbar .print-button { margin-left: auto; font-weight: 700; }
    .muted { color: #666; font-size: 11px; margin-top: 2px; }
    .meta { margin: 14px 0 18px; line-height: 1.7; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 9px 0; border-bottom: 1px solid #ddd; vertical-align: top; text-align: left; }
    .right { text-align: right; white-space: nowrap; }
    .summary { margin-top: 14px; border-top: 1px solid #ddd; padding-top: 10px; }
    .summary-row { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; }
    .discount { color: #8a4b08; }
    .total { font-size: 16px; font-weight: 700; padding-top: 8px; }
    .footer { margin-top: 28px; text-align: center; }
    @media print { body { padding: 8mm; } .toolbar { display: none; } }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-label">${escapeHtml(labels.language)}:</span>
    <button id="receipt-lang-en" type="button" class="${receiptLanguage === 'en' ? 'active' : ''}">EN</button>
    <button id="receipt-lang-th" type="button" class="${receiptLanguage === 'th' ? 'active' : ''}">ไทย</button>
    <button id="receipt-lang-zh" type="button" class="${receiptLanguage === 'zh' ? 'active' : ''}">中文</button>
    <button id="receipt-print" type="button" class="print-button">${escapeHtml(labels.print)}</button>
  </div>
  <h1>JOKO TODAY</h1>
  <h2>${escapeHtml(labels.title)}</h2>
  <div class="muted">${escapeHtml(labels.disclaimer)}</div>
  <div class="meta">
    <div><strong>${escapeHtml(labels.order)}:</strong> ${escapeHtml(order.order_number)}</div>
    ${customerName ? `<div><strong>${escapeHtml(labels.customer)}:</strong> ${escapeHtml(customerName)}</div>` : ''}
    ${order.pickup_date ? `<div><strong>${escapeHtml(labels.scheduled)}:</strong> ${escapeHtml(formatDate(order.pickup_date, receiptLanguage))}</div>` : ''}
    ${order.picked_up_at ? `<div><strong>${escapeHtml(labels.pickedUp)}:</strong> ${escapeHtml(formatDate(order.picked_up_at, receiptLanguage))}</div>` : ''}
    <div><strong>${escapeHtml(labels.payment)}:</strong> ${escapeHtml(paymentLabel(order.payment_method, receiptLanguage))}</div>
  </div>
  <table>
    <thead><tr><th>${escapeHtml(labels.items)}</th><th class="right"></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="2" class="muted">—</td></tr>`}</tbody>
  </table>
  <div class="summary">
    ${discount > 0 ? `<div class="summary-row"><span>${escapeHtml(labels.gross)}</span><strong>฿${money(grossTotal)}</strong></div>` : ''}
    ${discount > 0 ? `<div class="summary-row discount"><span>${escapeHtml(labels.discount)}</span><strong>−฿${money(discount)}</strong></div>` : ''}
    <div class="summary-row total"><span>${escapeHtml(labels.total)}</span><span>฿${money(netTotal)}</span></div>
  </div>
  <div class="footer">${escapeHtml(labels.thanks)}</div>
</body>
</html>`);
    printWindow.document.close();

    printWindow.document.getElementById('receipt-lang-en')?.addEventListener('click', () => renderReceipt('en'));
    printWindow.document.getElementById('receipt-lang-th')?.addEventListener('click', () => renderReceipt('th'));
    printWindow.document.getElementById('receipt-lang-zh')?.addEventListener('click', () => renderReceipt('zh'));
    printWindow.document.getElementById('receipt-print')?.addEventListener('click', () => {
      printWindow.focus();
      printWindow.print();
    });
  };

  renderReceipt(language);
  printWindow.focus();
}
