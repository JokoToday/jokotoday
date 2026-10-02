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
        : labe