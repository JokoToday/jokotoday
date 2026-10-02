export type PrintOrderLanguage = 'en' | 'th' | 'zh';
export type PrintOrderProfile = 'standard' | '80mm' | '58mm';
export type PrintOrderDocumentType = 'receipt' | 'confirmation' | 'prep_ticket';

export type PrintableOrderItem = {
  product_id?: string;
  product_name?: string;
  product_name_en?: string;
  product_name_th?: string | null;
  product_name_zh?: string | null;
  name?: string;
  name_th?: string | null;
  name_zh?: string | null;
  quantity?: number;
  qty?: number;
  price_at_order?: number;
  price?: number;
};

export type PrintableOrder = {
  order_number: string;
  customer_name?: string | null;
  order_items?: PrintableOrderItem[] | null;
  total_amount?: number | string | null;
  walk_in_amount?: number | string | null;
  loyalty_discount_amount?: number | string | null;
  amount_paid?: number | string | null;
  purchase_type?: string | null;
  pickup_date?: string | null;
  picked_up_at?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  created_at?: string | null;
  loyalty_points_earned?: number | string | null;
  status?: string | null;
};

export type PrintOrderCopy = {
  title: string;
  disclaimer: string;
  order: string;
  ordered: string;
  date: string;
  customer: string;
  scheduled: string;
  pickup: string;
  location: string;
  status: string;
  payment: string;
  items: string;
  quantity: string;
  unitPrice: string;
  gross: string;
  discount: string;
  totalPaid: string;
  amountDue: string;
  pointsEarned: string;
  thanks: string;
  print: string;
  language: string;
  profile: string;
  standard: string;
  thermal80: string;
  thermal58: string;
  paid: string;
  payAtPickup: string;
  cancelled: string;
  paymentReview: string;
  prepTitle: string;
  itemCount: string;
  readyForPickup: string;
};

export type PrintOrderDocumentOptions = {
  order: PrintableOrder;
  customerName?: string | null;
  language?: PrintOrderLanguage;
  targetWindow?: Window | null;
  logoUrl?: string | null;
  documentType?: PrintOrderDocumentType;
  profile?: PrintOrderProfile;
  pickupLabel?: string | null;
  pickupLabels?: Partial<Record<PrintOrderLanguage, string>>;
  pickupLocationName?: string | null;
  pickupLocationNames?: Partial<Record<PrintOrderLanguage, string>>;
  statusLabel?: string | null;
  statusLabels?: Partial<Record<PrintOrderLanguage, string>>;
  copy?: Partial<PrintOrderCopy>;
  copyByLanguage?: Partial<Record<PrintOrderLanguage, Partial<PrintOrderCopy>>>;
};

const PROFILE_STORAGE_KEY = 'jt_print_profile';

const COPY: Record<PrintOrderLanguage, PrintOrderCopy> = {
  en: {
    title: 'Order Receipt',
    disclaimer: 'This document is not a tax invoice.',
    order: 'Order',
    ordered: 'Ordered',
    date: 'Date',
    customer: 'Customer',
    scheduled: 'Scheduled pickup',
    pickup: 'Pickup',
    location: 'Location',
    status: 'Order status',
    payment: 'Payment',
    items: 'Items',
    quantity: 'Qty',
    unitPrice: 'Unit price',
    gross: 'Gross total',
    discount: 'Loyalty reward discount',
    totalPaid: 'Total paid',
    amountDue: 'Amount due',
    pointsEarned: 'Points earned',
    thanks: 'Thank you.',
    print: 'Print',
    language: 'Language',
    profile: 'Paper',
    standard: 'Standard',
    thermal80: '80 mm',
    thermal58: '58 mm',
    paid: 'PAID',
    payAtPickup: 'PAY AT PICKUP',
    cancelled: 'CANCELLED',
    paymentReview: 'PAYMENT STATUS REVIEW',
    prepTitle: 'Prep / Pickup Ticket',
    itemCount: 'Total items',
    readyForPickup: 'READY FOR PICKUP',
  },
  th: {
    title: 'ใบเสร็จรับเงิน',
    disclaimer: 'เอกสารนี้ไม่ใช่ใบกำกับภาษี',
    order: 'เลขที่คำสั่งซื้อ',
    ordered: 'วันที่สั่งซื้อ',
    date: 'วันที่และเวลา',
    customer: 'ลูกค้า',
    scheduled: 'วันที่รับสินค้าที่กำหนด',
    pickup: 'รับสินค้า',
    location: 'สถานที่รับสินค้า',
    status: 'สถานะคำสั่งซื้อ',
    payment: 'การชำระเงิน',
    items: 'รายการสินค้า',
    quantity: 'จำนวน',
    unitPrice: 'ราคาต่อชิ้น',
    gross: 'ยอดก่อนส่วนลด',
    discount: 'ส่วนลดรางวัลสะสมแต้ม',
    totalPaid: 'ยอดชำระจริง',
    amountDue: 'ยอดที่ต้องชำระ',
    pointsEarned: 'แต้มที่ได้รับ',
    thanks: 'ขอบคุณค่ะ/ครับ',
    print: 'พิมพ์',
    language: 'ภาษา',
    profile: 'ขนาดกระดาษ',
    standard: 'มาตรฐาน',
    thermal80: '80 มม.',
    thermal58: '58 มม.',
    paid: 'ชำระแล้ว',
    payAtPickup: 'ชำระเมื่อรับสินค้า',
    cancelled: 'ยกเลิกแล้ว',
    paymentReview: 'ตรวจสอบสถานะการชำระเงิน',
    prepTitle: 'ใบเตรียม / รับสินค้า',
    itemCount: 'รวมจำนวนสินค้า',
    readyForPickup: 'พร้อมรับสินค้า',
  },
  zh: {
    title: '订单收据',
    disclaimer: '本文件不是税务发票。',
    order: '订单号',
    ordered: '下单日期',
    date: '日期和时间',
    customer: '客户',
    scheduled: '计划取货时间',
    pickup: '取货',
    location: '取货地点',
    status: '订单状态',
    payment: '付款',
    items: '商品',
    quantity: '数量',
    unitPrice: '单价',
    gross: '折扣前金额',
    discount: '积分奖励折扣',
    totalPaid: '实付金额',
    amountDue: '应付金额',
    pointsEarned: '获得积分',
    thanks: '谢谢！',
    print: '打印',
    language: '语言',
    profile: '纸张',
    standard: '标准',
    thermal80: '80 毫米',
    thermal58: '58 毫米',
    paid: '已付款',
    payAtPickup: '取货时付款',
    cancelled: '已取消',
    paymentReview: '请核对付款状态',
    prepTitle: '备货 / 取货单',
    itemCount: '商品总数',
    readyForPickup: '可取货',
  },
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

const itemName = (item: PrintableOrderItem, language: PrintOrderLanguage) => {
  if (language === 'th') {
    return item.product_name_th || item.name_th || item.product_name || item.product_name_en || item.name || '—';
  }
  if (language === 'zh') {
    return item.product_name_zh || item.name_zh || item.product_name || item.product_name_en || item.name || '—';
  }
  return item.product_name || item.product_name_en || item.name || item.product_name_th || item.name_th || '—';
};

const paymentMethodLabel = (method: string | null | undefined, language: PrintOrderLanguage) => {
  if (method === 'cash') {
    if (language === 'th') return 'เงินสด';
    if (language === 'zh') return '现金';
    return 'Cash';
  }
  if (method === 'qr_code' || method === 'qr') return 'Thai QR';
  if (language === 'th') return 'ไม่ได้บันทึก';
  if (language === 'zh') return '未记录';
  return 'Not recorded';
};

const formatDate = (
  value: string | null | undefined,
  language: PrintOrderLanguage,
  includeWeekday = false,
  includeTime = true,
) => {
  if (!value) return '—';

  const isDateOnly = value.length === 10;
  const source = isDateOnly ? `${value}T00:00:00+07:00` : value;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return value;

  const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
  return date.toLocaleString(locale, {
    timeZone: 'Asia/Bangkok',
    ...(includeWeekday ? { weekday: 'short' as const } : {}),
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(!isDateOnly && includeTime ? { hour: '2-digit' as const, minute: '2-digit' as const } : {}),
  });
};

const resolveInitialProfile = (
  documentType: PrintOrderDocumentType,
  requested?: PrintOrderProfile,
): PrintOrderProfile => {
  if (requested) return requested;
  try {
    const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    if (stored === 'standard' || stored === '80mm' || stored === '58mm') {
      if (documentType === 'prep_ticket' && stored === 'standard') return '80mm';
      return stored;
    }
  } catch {
    // Printing remains functional when storage is unavailable.
  }
  return documentType === 'prep_ticket' ? '80mm' : 'standard';
};

const rememberProfile = (profile: PrintOrderProfile) => {
  try {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, profile);
  } catch {
    // Do not block printing when storage is unavailable.
  }
};

const paymentStateLabel = (order: PrintableOrder, labels: PrintOrderCopy) => {
  if (order.status === 'cancelled') return labels.cancelled;
  if (order.payment_status === 'paid') return labels.paid;
  if (['pending', 'confirmed', 'ready'].includes(order.status || '')) return labels.payAtPickup;
  return labels.paymentReview;
};

const profileWidth = (profile: PrintOrderProfile) => (
  profile === '80mm' ? '80mm' : profile === '58mm' ? '58mm' : '760px'
);

export function printOrderDocument({
  order,
  customerName,
  language = 'en',
  targetWindow,
  logoUrl,
  documentType = 'receipt',
  profile,
  pickupLabel,
  pickupLabels,
  pickupLocationName,
  pickupLocationNames,
  statusLabel,
  statusLabels,
  copy,
  copyByLanguage,
}: PrintOrderDocumentOptions) {
  const printWindow = targetWindow ?? window.open('', '_blank', 'width=760,height=900');
  if (!printWindow) {
    throw new Error('Print window was blocked');
  }

  const initialProfile = resolveInitialProfile(documentType, profile);
  const receiptLogoUrl = new URL(
    logoUrl?.trim() || '/assets/brand/joko-today-logo-v0.4.webp',
    window.location.origin,
  ).href;
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const resolvedCustomerName = customerName ?? order.customer_name ?? null;
  const grossTotal = Number(order.purchase_type === 'walk_in'
    ? order.walk_in_amount ?? order.total_amount
    : order.total_amount) || 0;
  const discount = Math.max(0, Number(order.loyalty_discount_amount) || 0);
  const hasStoredAmountPaid = order.amount_paid !== null
    && order.amount_paid !== undefined
    && order.amount_paid !== '';
  const paidValue = Number(order.amount_paid);
  const netTotal = hasStoredAmountPaid && Number.isFinite(paidValue)
    ? paidValue
    : Math.max(0, grossTotal - discount);
  const pointsEarned = Math.max(0, Number(order.loyalty_points_earned) || 0);
  const totalQuantity = items.reduce(
    (sum, item) => sum + Math.max(0, Number(item.quantity ?? item.qty ?? 0)),
    0,
  );

  const render = (nextLanguage: PrintOrderLanguage, nextProfile: PrintOrderProfile) => {
    const localizedCopy = copyByLanguage?.[nextLanguage] || copy || {};
    const labels: PrintOrderCopy = { ...COPY[nextLanguage], ...localizedCopy };
    const resolvedPickupLabel = pickupLabels?.[nextLanguage] ?? pickupLabel ?? null;
    const resolvedPickupLocationName = pickupLocationNames?.[nextLanguage] ?? pickupLocationName ?? null;
    const resolvedStatusLabel = statusLabels?.[nextLanguage] ?? statusLabel ?? null;
    const isThermal = nextProfile !== 'standard';
    const isPrep = documentType === 'prep_ticket';
    const documentTitle = isPrep
      ? labels.prepTitle
      : documentType === 'confirmation'
        ? (localizedCopy.title || (nextLanguage === 'th'
          ? 'ใบยืนยันคำสั่งซื้อ'
          : nextLanguage === 'zh'
            ? '订单确认单'
            : 'Order Confirmation'))
        : labels.title;

    const itemRows = items.map((item) => {
      const quantity = Math.max(0, Number(item.quantity ?? item.qty ?? 0));
      const price = Number(item.price_at_order ?? item.price ?? 0);
      const name = escapeHtml(itemName(item, nextLanguage));

      if (isPrep) {
        return `<div class="prep-item"><strong>${escapeHtml(quantity)} ×</strong><span>${name}</span></div>`;
      }

      if (isThermal) {
        return `<div class="thermal-item"><div>${name}<div class="muted">${escapeHtml(quantity)} × ฿${money(price)}</div></div><strong>฿${money(quantity * price)}</strong></div>`;
      }

      return `<tr><td>${name}</td><td class="num">${escapeHtml(quantity)}</td><td class="num">฿${money(price)}</td><td class="num strong">฿${money(quantity * price)}</td></tr>`;
    }).join('');

    const paymentState = paymentStateLabel(order, labels);
    const paymentDescription = order.payment_status === 'paid'
      ? `${paymentState}${order.payment_method ? ` · ${paymentMethodLabel(order.payment_method, nextLanguage)}` : ''}`
      : paymentState;

    const profileButtons = (isPrep ? ['80mm', '58mm'] : ['standard', '80mm', '58mm']).map((candidate) => {
      const typedProfile = candidate as PrintOrderProfile;
      const profileLabel = typedProfile === 'standard'
        ? labels.standard
        : typedProfile === '80mm'
          ? labels.thermal80
          : labels.thermal58;
      return `<button type="button" data-profile="${typedProfile}" class="${typedProfile === nextProfile ? 'active' : ''}">${escapeHtml(profileLabel)}</button>`;
    }).join('');

    const languageButtons = (['en', 'th', 'zh'] as PrintOrderLanguage[]).map((candidate) => {
      const label = candidate === 'en' ? 'EN' : candidate === 'th' ? 'ไทย' : '中文';
      return `<button type="button" data-language="${candidate}" class="${candidate === nextLanguage ? 'active' : ''}">${label}</button>`;
    }).join('');

    const standardMeta = `
      ${resolvedCustomerName ? `<div class="meta-card customer"><div class="label">${escapeHtml(labels.customer)}</div><div class="value">${escapeHtml(resolvedCustomerName)}</div></div>` : ''}
      <div class="meta-card"><div class="label">${escapeHtml(labels.order)}</div><div class="value">#${escapeHtml(order.order_number)}</div></div>
      ${order.created_at ? `<div class="meta-card"><div class="label">${escapeHtml(labels.ordered)}</div><div class="value">${escapeHtml(formatDate(order.created_at, nextLanguage, false, true))}</div></div>` : ''}
      ${resolvedPickupLabel || order.pickup_date ? `<div class="meta-card"><div class="label">${escapeHtml(labels.pickup)}</div><div class="value">${resolvedPickupLabel ? escapeHtml(resolvedPickupLabel) : ''}${resolvedPickupLabel && order.pickup_date ? '<br />' : ''}${order.pickup_date ? escapeHtml(formatDate(order.pickup_date, nextLanguage, true, false)) : ''}</div></div>` : ''}
      ${resolvedPickupLocationName ? `<div class="meta-card"><div class="label">${escapeHtml(labels.location)}</div><div class="value">${escapeHtml(resolvedPickupLocationName)}</div></div>` : ''}
      ${resolvedStatusLabel || order.status ? `<div class="meta-card"><div class="label">${escapeHtml(labels.status)}</div><div class="value">${escapeHtml(resolvedStatusLabel || order.status || '—')}</div></div>` : ''}
    `;

    const thermalMeta = `
      ${resolvedCustomerName ? `<div class="customer-name">${escapeHtml(resolvedCustomerName)}</div>` : ''}
      <div class="thermal-meta"><strong>${escapeHtml(labels.order)}</strong><span>#${escapeHtml(order.order_number)}</span></div>
      ${order.pickup_date ? `<div class="thermal-meta"><strong>${escapeHtml(labels.pickup)}</strong><span>${escapeHtml(formatDate(order.pickup_date, nextLanguage, true, false))}</span></div>` : ''}
      ${resolvedPickupLocationName ? `<div class="thermal-meta"><strong>${escapeHtml(labels.location)}</strong><span>${escapeHtml(resolvedPickupLocationName)}</span></div>` : ''}
      <div class="thermal-meta"><strong>${escapeHtml(labels.payment)}</strong><span>${escapeHtml(paymentDescription)}</span></div>
    `;

    const financialSummary = `
      ${documentType === 'receipt' || discount > 0 ? `<div class="summary-row"><span>${escapeHtml(labels.gross)}</span><strong>฿${money(grossTotal)}</strong></div>` : ''}
      ${discount > 0 ? `<div class="summary-row discount"><span>${escapeHtml(labels.discount)}</span><strong>−฿${money(discount)}</strong></div>` : ''}
      <div class="summary-row total"><span>${escapeHtml(order.payment_status === 'paid' ? labels.totalPaid : labels.amountDue)}</span><strong>฿${money(netTotal)}</strong></div>
      ${documentType === 'receipt' && pointsEarned > 0 ? `<div class="summary-row"><span>${escapeHtml(labels.pointsEarned)}</span><strong>+${escapeHtml(pointsEarned)}</strong></div>` : ''}
    `;

    const prepBody = `
      <div class="prep-focus">
        ${resolvedCustomerName ? `<div class="prep-customer">${escapeHtml(resolvedCustomerName)}</div>` : ''}
        ${order.pickup_date ? `<div class="prep-pickup">${escapeHtml(formatDate(order.pickup_date, nextLanguage, true, false))}</div>` : ''}
        ${resolvedPickupLocationName ? `<div class="prep-location">${escapeHtml(resolvedPickupLocationName)}</div>` : ''}
        <div class="prep-order">#${escapeHtml(order.order_number)}</div>
      </div>
      <div class="section-title">${escapeHtml(labels.items)}</div>
      <div class="prep-items">${itemRows || '<div class="muted">—</div>'}</div>
      <div class="prep-count"><span>${escapeHtml(labels.itemCount)}</span><strong>${escapeHtml(totalQuantity)}</strong></div>
      <div class="prep-payment">${escapeHtml(paymentDescription)}</div>
      <div class="prep-ready">${escapeHtml(labels.readyForPickup)}</div>
    `;

    const normalBody = `
      ${isThermal ? thermalMeta : `<div class="meta">${standardMeta}</div>`}
      <div class="section-title">${escapeHtml(labels.items)}</div>
      ${isThermal
        ? `<div class="thermal-items">${itemRows || '<div class="muted">—</div>'}</div>`
        : `<table><thead><tr><th>${escapeHtml(labels.items)}</th><th class="num">${escapeHtml(labels.quantity)}</th><th class="num">${escapeHtml(labels.unitPrice)}</th><th class="num">${escapeHtml(order.payment_status === 'paid' ? labels.totalPaid : labels.amountDue)}</th></tr></thead><tbody>${itemRows || '<tr><td colspan="4" class="muted">—</td></tr>'}</tbody></table>`}
      <div class="summary">${financialSummary}</div>
      <div class="payment-box"><strong>${escapeHtml(labels.payment)}</strong><span>${escapeHtml(paymentDescription)}</span></div>
      ${documentType === 'receipt' ? `<div class="disclaimer">${escapeHtml(labels.disclaimer)}</div>` : ''}
      <div class="footer">${escapeHtml(labels.thanks)}</div>
    `;

    const pageSize = nextProfile === '80mm'
      ? '80mm auto'
      : nextProfile === '58mm'
        ? '58mm auto'
        : 'auto';
    const thermalWidth = profileWidth(nextProfile);

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="${nextLanguage === 'zh' ? 'zh-CN' : nextLanguage}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(documentTitle)} · #${escapeHtml(order.order_number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #191919; background: ${isThermal ? '#fff' : '#f4f1ea'}; font-family: Arial, "Noto Sans Thai", "Noto Sans SC", sans-serif; }
    .toolbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 7px; padding: 10px 12px; background: #f2f2f2; border-bottom: 1px solid #ddd; }
    .toolbar-label { color: #666; font-size: 11px; font-weight: 700; }
    .toolbar button { min-height: 34px; border: 1px solid #aaa; border-radius: 6px; background: #fff; padding: 6px 9px; color: #222; font-size: 11px; cursor: pointer; }
    .toolbar button.active { border-color: #222; background: #222; color: #fff; }
    .toolbar .print-button { margin-left: auto; font-weight: 800; }
    .sheet { width: ${isThermal ? thermalWidth : 'min(760px, 100%)'}; max-width: 100%; margin: 0 auto; padding: ${isThermal ? '3mm' : '24px'}; background: #fff; }
    .brand { text-align: center; margin-bottom: ${isThermal ? '3mm' : '18px'}; }
    .brand-logo { display: block; width: auto; height: auto; max-width: ${nextProfile === '58mm' ? '34mm' : nextProfile === '80mm' ? '46mm' : '170px'}; max-height: ${isThermal ? '18mm' : '58px'}; margin: 0 auto 7px; object-fit: contain; filter: grayscale(1) contrast(1.75); }
    .brand-text-fallback { display: none; margin: 0; font-size: ${isThermal ? '18px' : '22px'}; letter-spacing: .05em; }
    h2 { margin: 0 0 ${isThermal ? '3mm' : '16px'}; text-align: center; font-size: ${isThermal ? '14px' : '18px'}; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
    .meta-card { padding: 10px 12px; border: 1px solid #e5e5e5; border-radius: 8px; }
    .meta-card.customer { grid-column: 1 / -1; }
    .label, .section-title { color: #666; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .value { margin-top: 4px; font-size: 13px; font-weight: 700; line-height: 1.45; }
    .customer .value { font-size: 17px; }
    .section-title { margin: ${isThermal ? '3mm 0 1.5mm' : '8px 0'}; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 9px 6px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; font-size: 12px; }
    th { color: #666; font-size: 9px; letter-spacing: .05em; text-transform: uppercase; }
    .num { text-align: right; white-space: nowrap; }
    .strong { font-weight: 800; }
    .muted { color: #666; font-size: ${isThermal ? '9px' : '10px'}; margin-top: 2px; }
    .customer-name { padding: 2mm 0; border-top: 1px solid #222; border-bottom: 1px solid #222; text-align: center; font-size: ${nextProfile === '58mm' ? '17px' : '20px'}; font-weight: 900; line-height: 1.15; }
    .thermal-meta { display: flex; justify-content: space-between; gap: 3mm; padding: 1.1mm 0; border-bottom: 1px dotted #aaa; font-size: ${nextProfile === '58mm' ? '9.5px' : '10.5px'}; }
    .thermal-meta span { text-align: right; }
    .thermal-items { border-top: 1px solid #222; }
    .thermal-item { display: flex; justify-content: space-between; gap: 2mm; padding: 1.8mm 0; border-bottom: 1px dotted #aaa; font-size: ${nextProfile === '58mm' ? '9.5px' : '10.5px'}; }
    .thermal-item > div { min-width: 0; overflow-wrap: anywhere; }
    .thermal-item > strong { white-space: nowrap; }
    .summary { margin-top: ${isThermal ? '2mm' : '12px'}; padding-top: ${isThermal ? '1mm' : '8px'}; border-top: 1px solid #222; }
    .summary-row { display: flex; justify-content: space-between; gap: 4mm; padding: ${isThermal ? '.8mm 0' : '4px 0'}; font-size: ${isThermal ? '10px' : '12px'}; }
    .summary-row.total { padding-top: ${isThermal ? '1.5mm' : '7px'}; font-size: ${isThermal ? '13px' : '16px'}; font-weight: 800; }
    .discount { color: #7a4900; }
    .payment-box { display: flex; justify-content: space-between; gap: 3mm; margin-top: ${isThermal ? '2mm' : '14px'}; padding: ${isThermal ? '2mm 0' : '10px 12px'}; border-top: ${isThermal ? '1px solid #222' : '0'}; border-bottom: ${isThermal ? '1px solid #222' : '0'}; background: ${isThermal ? '#fff' : '#f5f5f5'}; font-size: ${isThermal ? '10px' : '12px'}; }
    .payment-box span { text-align: right; font-weight: 800; }
    .disclaimer { margin-top: 12px; color: #666; text-align: center; font-size: 9px; }
    .footer { margin-top: ${isThermal ? '4mm' : '22px'}; text-align: center; font-size: ${isThermal ? '9px' : '11px'}; color: #666; }
    .prep-focus { padding: 2mm 0; border-top: 2px solid #111; border-bottom: 2px solid #111; text-align: center; }
    .prep-customer { overflow-wrap: anywhere; font-size: ${nextProfile === '58mm' ? '20px' : '24px'}; font-weight: 900; line-height: 1.05; }
    .prep-pickup { margin-top: 1.5mm; font-size: ${nextProfile === '58mm' ? '12px' : '14px'}; font-weight: 800; }
    .prep-location { margin-top: .7mm; font-size: ${nextProfile === '58mm' ? '10px' : '11px'}; }
    .prep-order { margin-top: 1.5mm; font-family: monospace; font-size: ${nextProfile === '58mm' ? '10px' : '11px'}; }
    .prep-items { border-top: 1px solid #111; }
    .prep-item { display: grid; grid-template-columns: auto 1fr; gap: 2mm; padding: 2mm 0; border-bottom: 1px dotted #888; font-size: ${nextProfile === '58mm' ? '11px' : '12.5px'}; line-height: 1.25; }
    .prep-item span { overflow-wrap: anywhere; }
    .prep-count { display: flex; justify-content: space-between; gap: 3mm; margin-top: 2mm; padding-top: 2mm; border-top: 2px solid #111; font-size: ${nextProfile === '58mm' ? '11px' : '12px'}; }
    .prep-count strong { font-size: ${nextProfile === '58mm' ? '16px' : '18px'}; }
    .prep-payment { margin-top: 2mm; padding: 2mm 1mm; border: 1px solid #111; text-align: center; font-size: ${nextProfile === '58mm' ? '11px' : '13px'}; font-weight: 900; }
    .prep-ready { margin-top: 4mm; padding-top: 2mm; border-top: 1px dashed #777; text-align: center; font-size: ${nextProfile === '58mm' ? '9px' : '10px'}; font-weight: 800; letter-spacing: .08em; }
    @media print {
      @page { size: ${pageSize}; margin: ${isThermal ? '3mm' : '12mm'}; }
      body { background: #fff; }
      .toolbar { display: none !important; }
      .sheet { width: ${isThermal ? thermalWidth : '100%'}; max-width: none; margin: 0; padding: 0; }
      .brand-logo { filter: grayscale(1) contrast(1.9); }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-label">${escapeHtml(labels.language)}:</span>
    ${languageButtons}
    <span class="toolbar-label">${escapeHtml(labels.profile)}:</span>
    ${profileButtons}
    <button id="order-document-print" type="button" class="print-button">${escapeHtml(labels.print)}</button>
  </div>
  <main class="sheet">
    <div class="brand">
      <img
        class="brand-logo"
        src="${escapeHtml(receiptLogoUrl)}"
        alt="JOKO TODAY"
        onerror="this.style.display='none';document.getElementById('order-document-brand-text').style.display='block';"
      />
      <h1 id="order-document-brand-text" class="brand-text-fallback">JOKO TODAY</h1>
    </div>
    <h2>${escapeHtml(documentTitle)}</h2>
    ${isPrep ? prepBody : normalBody}
  </main>
</body>
</html>`);
    printWindow.document.close();

    printWindow.document.querySelectorAll<HTMLButtonElement>('[data-language]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = button.dataset.language as PrintOrderLanguage | undefined;
        if (next) render(next, nextProfile);
      });
    });
    printWindow.document.querySelectorAll<HTMLButtonElement>('[data-profile]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = button.dataset.profile as PrintOrderProfile | undefined;
        if (!next) return;
        rememberProfile(next);
        render(nextLanguage, next);
      });
    });
    printWindow.document.getElementById('order-document-print')?.addEventListener('click', () => {
      rememberProfile(nextProfile);
      printWindow.focus();
      printWindow.print();
    });
  };

  render(language, initialProfile);
  printWindow.focus();
}
