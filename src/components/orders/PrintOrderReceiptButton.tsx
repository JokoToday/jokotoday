import { Printer } from 'lucide-react';
import { usePublishedJokoLogo } from '../../app/joko-today/builder/usePublishedJokoLogo';
import {
  printOrderDocument,
  type PrintableOrder,
  type PrintOrderCopy,
  type PrintOrderLanguage,
} from '../../lib/printOrderDocument';
import { Order } from './OrderTypes';

interface PrintOrderReceiptButtonProps {
  order: Order;
  language: 'en' | 'th' | 'zh';
  getLabel: (key: string, lang: 'en' | 'th' | 'zh', fallback: string) => string;
  pickupLocationName?: string | null;
  className?: string;
}

const FALLBACK = {
  button: { en: 'Print receipt', th: 'พิมพ์ใบเสร็จ', zh: '打印收据' },
  title: { en: 'Receipt', th: 'ใบเสร็จรับเงิน', zh: '收据' },
  receiptNumber: { en: 'Receipt', th: 'เลขที่ใบเสร็จ', zh: '收据编号' },
  disclaimer: {
    en: 'This receipt confirms payment and collection. It is not a tax invoice.',
    th: 'ใบเสร็จนี้ยืนยันการชำระเงินและการรับสินค้า เอกสารนี้ไม่ใช่ใบกำกับภาษี',
    zh: '此收据确认付款及取货。本文件不是税务发票。',
  },
  customer: { en: 'Customer', th: 'ลูกค้า', zh: '客户' },
  order: { en: 'Order', th: 'คำสั่งซื้อ', zh: '订单' },
  ordered: { en: 'Ordered', th: 'วันที่สั่งซื้อ', zh: '下单日期' },
  pickup: { en: 'Pickup', th: 'รับสินค้า', zh: '取货' },
  pickedUp: { en: 'Collected', th: 'รับสินค้าแล้ว', zh: '已取货' },
  location: { en: 'Location', th: 'สถานที่รับสินค้า', zh: '取货地点' },
  status: { en: 'Order status', th: 'สถานะคำสั่งซื้อ', zh: '订单状态' },
  items: { en: 'Items', th: 'รายการสินค้า', zh: '商品' },
  quantity: { en: 'Qty', th: 'จำนวน', zh: '数量' },
  unitPrice: { en: 'Unit price', th: 'ราคาต่อชิ้น', zh: '单价' },
  gross: { en: 'Gross total', th: 'ยอดก่อนส่วนลด', zh: '折扣前金额' },
  discount: { en: 'Loyalty discount', th: 'ส่วนลดสมาชิก', zh: '会员优惠' },
  totalPaid: { en: 'Total paid', th: 'ยอดชำระจริง', zh: '实付金额' },
  payment: { en: 'Payment', th: 'การชำระเงิน', zh: '付款' },
  points: { en: 'Points earned', th: 'แต้มที่ได้รับ', zh: '获得积分' },
  footer: {
    en: 'THANK YOU FOR YOUR ORDER.\nSELECTED GOODNESS. FOR A BRIGHTER TODAY.',
    th: 'ขอบคุณสำหรับคำสั่งซื้อของคุณ\nSELECTED GOODNESS. FOR A BRIGHTER TODAY.',
    zh: '感谢您的订购。\nSELECTED GOODNESS. FOR A BRIGHTER TODAY.',
  },
  nextOrder: { en: 'Your next order', th: 'สั่งครั้งถัดไป', zh: '下一次订购' },
  paid: { en: 'Paid', th: 'ชำระแล้ว', zh: '已付款' },
  collected: { en: 'Collected', th: 'รับสินค้าแล้ว', zh: '已取货' },
} as const;

function snapshotOrder(order: Order): {
  printable: PrintableOrder;
  receiptNumber: string;
  pickupLocationNames: Partial<Record<PrintOrderLanguage, string>>;
  catalogUrl: string;
} {
  const snapshot = order.receipt_snapshot;

  if (!snapshot || snapshot.version !== 1) {
    return {
      printable: order,
      receiptNumber: `R-${order.order_number}`,
      pickupLocationNames: {},
      catalogUrl: 'https://joko.today/products',
    };
  }

  return {
    printable: {
      order_number: snapshot.order_number || order.order_number,
      customer_name: snapshot.customer?.name || order.customer_name || null,
      order_items: snapshot.items || [],
      total_amount: Number(snapshot.amounts?.gross ?? order.total_amount ?? 0),
      loyalty_discount_amount: Number(snapshot.amounts?.loyalty_discount ?? order.loyalty_discount_amount ?? 0),
      amount_paid: Number(snapshot.amounts?.paid ?? order.amount_paid ?? 0),
      purchase_type: order.purchase_type || 'online',
      pickup_date: snapshot.pickup_date || order.pickup_date,
      picked_up_at: snapshot.picked_up_at || order.picked_up_at || snapshot.issued_at,
      payment_method: snapshot.payment?.method || order.payment_method || null,
      payment_status: snapshot.payment?.status || order.payment_status || 'paid',
      created_at: snapshot.ordered_at || order.created_at,
      loyalty_points_earned: Number(snapshot.loyalty_points_earned ?? order.loyalty_points_earned ?? 0),
      status: order.status,
    },
    receiptNumber: snapshot.receipt_number || `R-${order.order_number}`,
    pickupLocationNames: {
      en: snapshot.pickup_location?.name_en || '',
      th: snapshot.pickup_location?.name_th || snapshot.pickup_location?.name_en || '',
      zh: snapshot.pickup_location?.name_zh || snapshot.pickup_location?.name_en || '',
    },
    catalogUrl: snapshot.catalog_url || 'https://joko.today/products',
  };
}

export function PrintOrderReceiptButton({
  order,
  language,
  getLabel,
  pickupLocationName,
  className = '',
}: PrintOrderReceiptButtonProps) {
  const publishedLogoUrl = usePublishedJokoLogo();

  const handlePrint = () => {
    const { printable, receiptNumber, pickupLocationNames, catalogUrl } = snapshotOrder(order);
    const languages: PrintOrderLanguage[] = ['en', 'th', 'zh'];

    if (pickupLocationName && !pickupLocationNames[language]) {
      pickupLocationNames[language] = pickupLocationName;
    }

    const copyByLanguage = Object.fromEntries(
      languages.map((lang) => [lang, {
        title: getLabel('my_orders_page.receipt_title', lang, FALLBACK.title[lang]),
        receiptNumber: getLabel('my_orders_page.receipt_number', lang, FALLBACK.receiptNumber[lang]),
        disclaimer: getLabel('my_orders_page.receipt_disclaimer', lang, FALLBACK.disclaimer[lang]),
        customer: getLabel('my_orders_page.receipt_customer', lang, FALLBACK.customer[lang]),
        order: getLabel('my_orders_page.receipt_order', lang, FALLBACK.order[lang]),
        ordered: getLabel('my_orders_page.receipt_ordered', lang, FALLBACK.ordered[lang]),
        pickup: getLabel('my_orders_page.receipt_pickup', lang, FALLBACK.pickup[lang]),
        pickedUp: getLabel('my_orders_page.receipt_picked_up', lang, FALLBACK.pickedUp[lang]),
        location: getLabel('my_orders_page.receipt_location', lang, FALLBACK.location[lang]),
        status: getLabel('my_orders_page.receipt_status', lang, FALLBACK.status[lang]),
        items: getLabel('my_orders_page.receipt_items', lang, FALLBACK.items[lang]),
        quantity: getLabel('my_orders_page.receipt_quantity', lang, FALLBACK.quantity[lang]),
        unitPrice: getLabel('my_orders_page.receipt_unit_price', lang, FALLBACK.unitPrice[lang]),
        gross: getLabel('my_orders_page.receipt_gross', lang, FALLBACK.gross[lang]),
        discount: getLabel('my_orders_page.receipt_discount', lang, FALLBACK.discount[lang]),
        totalPaid: getLabel('my_orders_page.receipt_total_paid', lang, FALLBACK.totalPaid[lang]),
        payment: getLabel('my_orders_page.receipt_payment', lang, FALLBACK.payment[lang]),
        pointsEarned: getLabel('my_orders_page.receipt_points', lang, FALLBACK.points[lang]),
        thanks: getLabel('my_orders_page.receipt_footer', lang, FALLBACK.footer[lang]),
      }])
    ) as Record<PrintOrderLanguage, Partial<PrintOrderCopy>>;

    const statusLabels = Object.fromEntries(
      languages.map((lang) => [lang, getLabel('my_orders_page.receipt_status_collected', lang, FALLBACK.collected[lang])])
    ) as Record<PrintOrderLanguage, string>;

    const paymentDescriptions = Object.fromEntries(
      languages.map((lang) => [lang, getLabel('my_orders_page.receipt_payment_paid', lang, FALLBACK.paid[lang])])
    ) as Record<PrintOrderLanguage, string>;

    const qrLabels = Object.fromEntries(
      languages.map((lang) => [lang, getLabel('my_orders_page.receipt_next_order', lang, FALLBACK.nextOrder[lang])])
    ) as Record<PrintOrderLanguage, string>;

    printOrderDocument({
      order: printable,
      customerName: printable.customer_name || order.customer_name || null,
      language,
      logoUrl: publishedLogoUrl,
      documentType: 'receipt',
      receiptNumber,
      pickupLocationNames,
      statusLabels,
      paymentDescriptions,
      copyByLanguage,
      footerQr: {
        value: catalogUrl,
        labels: qrLabels,
      },
    });
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-stone-50 ${className}`}
      style={{ borderColor: '#55766F55', color: '#3F665E', background: '#FFF9EE' }}
    >
      <Printer className="h-3.5 w-3.5" />
      {getLabel('my_orders_page.print_receipt', language, FALLBACK.button[language])}
    </button>
  );
}
