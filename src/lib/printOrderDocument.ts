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

cons