import { useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Lock, LogOut, Package, User, Phone, Mail, MessageCircle, Award, Check, Loader2, Home, QrCode, Banknote, ToggleLeft, ToggleRight, Calendar, AlertTriangle, X, ChevronDown, ChevronUp, ShoppingBag, Keyboard, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  CustomerLookupNetworkError,
  CustomerLookupServiceError,
  InvalidCustomerCodeError,
  lookupCustomerByQRToken,
} from '../lib/customerLookup';
import { QRScanner } from '../components/QRScanner';
import { useLanguage } from '../context/LanguageContext';

const PICKUP_DESK_PIN = '1234';

const PICKUP_DESK_TEXT = {
  en: {
    pickupDesk: 'Pickup Desk',
    enterStaffPin: 'Enter Staff PIN',
    pin: 'PIN',
    signIn: 'Sign In',
    invalidPin: 'Invalid PIN',
    logout: 'Logout',
    goHome: 'Go Home',
    subtitle: 'Scan customer QR codes to manage scheduled orders',
    scanCustomerQr: 'Scan Customer QR',
    uploadQrImage: 'Upload QR Image',
    invalidImageType: 'Choose a PNG, JPEG, or WebP image.',
    noQrInImage: 'No QR code was detected in this image.',
    unreadableImage: 'Unable to read this image. Please choose another.',
    enterMemberCode: 'Enter Member Code',
    memberCodeExample: 'e.g. VIP101',
    search: 'Search',
    cancel: 'Cancel',
    scanAnother: 'Scan Another',
    customerDetails: 'Customer Details',
    phone: 'Phone',
    email: 'Email',
    pointsTotal: 'points total',
    scheduledOrders: 'Scheduled Orders',
    upcoming: 'Upcoming',
    today: 'Today',
    overdue: 'Overdue',
    completedPickups: 'Completed Pickups',
    noScheduledOrders: 'No scheduled orders',
    scheduledPickup: 'Scheduled Pickup',
    actualPickup: 'Actual Pickup',
    payment: 'Payment',
    paymentStatusLabel: 'Payment Status',
    paid: 'Paid',
    paidThaiQr: 'Thai QR',
    paidCash: 'Cash',
    payOnPickup: 'Pay on Pickup',
    unpaid: 'Unpaid',
    paymentUnknown: 'Payment Unknown',
    bankTransfer: 'Bank Transfer',
    card: 'Card',
    ready: 'Ready',
    alreadyPickedUp: 'Already Picked Up',
    paidQuestion: 'Paid',
    yes: 'Yes',
    no: 'No',
    paymentMethod: 'Payment Method',
    qrCode: 'Thai QR',
    cash: 'Cash',
    pickUpNow: 'Pick Up Now',
    markPickedUp: 'Mark as Picked Up',
    futureWarning: 'This order is scheduled for a future date.',
    futureHelper: 'You can still confirm pickup now.',
    overdueWarning: 'This order is overdue.',
    confirmEarlyPickup: 'Confirm Early Pickup',
    confirmPickup: 'Confirm Pickup',
    customer: 'Customer',
    orderNumber: 'Order Number',
    total: 'Total',
    pickupTiming: 'Pickup Timing',
    early: 'Early',
    onTime: 'On Time',
    items: 'items',
    loadingCustomer: 'Loading customer…',
    loadingOrders: 'Loading orders…',
    confirmingPickup: 'Confirming pickup…',
    pickupConfirmed: 'Pickup Confirmed',
    pickupConfirmedMessage: 'Order successfully marked as picked up',
    pickUpAnotherOrder: 'Pick Up Another Order',
    signInAnotherCustomer: 'Sign In Another Customer',
    viewOrderDetails: 'View Order Details',
    hideOrderDetails: 'Hide Order Details',
    orderDetails: 'Order Details',
    product: 'Product',
    quantity: 'Quantity',
    quantityUnavailable: 'Quantity unavailable',
    unitPrice: 'Unit Price',
    lineTotal: 'Line Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    deliveryFee: 'Delivery Fee',
    packingChecklist: 'Packing Checklist',
    allItemsChecked: 'All items checked',
    unknownProduct: 'Unknown product',
    noOrderDetails: 'No order details available',
    priceUnavailable: 'Price unavailable',
    each: 'each',
    customerNotFound: 'Customer not found',
    invalidQr: 'Invalid QR code or member code',
    lookupUnavailable: 'Unable to load customer. Check the connection and try again.',
    pickupSuccess: 'Pickup confirmed successfully',
    pickupFailed: 'Failed to confirm pickup',
    paymentUpdateFailed: 'Failed to update payment information',
    switchWalkIn: 'Switch to Walk-In Desk',
    language: 'Language',
  },
  th: {
    pickupDesk: 'จุดรับสินค้า',
    enterStaffPin: 'กรอก PIN พนักงาน',
    pin: 'PIN',
    signIn: 'เข้าสู่ระบบ',
    invalidPin: 'PIN ไม่ถูกต้อง',
    logout: 'ออกจากระบบ',
    goHome: 'กลับหน้าหลัก',
    subtitle: 'สแกน QR ลูกค้าเพื่อจัดการออเดอร์ที่มีกำหนดรับ',
    scanCustomerQr: 'สแกน QR ลูกค้า',
    uploadQrImage: 'อัปโหลดรูป QR',
    invalidImageType: 'กรุณาเลือกรูป PNG, JPEG หรือ WebP',
    noQrInImage: 'ไม่พบ QR ในรูปภาพนี้',
    unreadableImage: 'ไม่สามารถอ่านรูปภาพนี้ได้ กรุณาเลือกรูปอื่น',
    enterMemberCode: 'กรอกรหัสสมาชิก',
    memberCodeExample: 'เช่น VIP101',
    search: 'ค้นหา',
    cancel: 'ยกเลิก',
    scanAnother: 'สแกนลูกค้ารายอื่น',
    customerDetails: 'ข้อมูลลูกค้า',
    phone: 'เบอร์โทร',
    email: 'อีเมล',
    pointsTotal: 'แต้มสะสม',
    scheduledOrders: 'ออเดอร์รับสินค้าตามกำหนด',
    upcoming: 'กำหนดรับเร็ว ๆ นี้',
    today: 'วันนี้',
    overdue: 'เลยกำหนดรับ',
    completedPickups: 'รายการที่รับสินค้าแล้ว',
    noScheduledOrders: 'ไม่มีออเดอร์ที่มีกำหนดรับ',
    scheduledPickup: 'กำหนดรับสินค้า',
    actualPickup: 'รับสินค้าจริง',
    payment: 'การชำระเงิน',
    paymentStatusLabel: 'สถานะการชำระเงิน',
    paid: 'ชำระแล้ว',
    paidThaiQr: 'Thai QR',
    paidCash: 'เงินสด',
    payOnPickup: 'ชำระเงินตอนรับสินค้า',
    unpaid: 'ยังไม่ได้ชำระ',
    paymentUnknown: 'ไม่ทราบสถานะการชำระเงิน',
    bankTransfer: 'โอนเงินผ่านธนาคาร',
    card: 'บัตร',
    ready: 'รอรับ',
    alreadyPickedUp: 'รับสินค้าแล้ว',
    paidQuestion: 'ชำระแล้ว',
    yes: 'ใช่',
    no: 'ยังไม่',
    paymentMethod: 'วิธีชำระเงิน',
    qrCode: 'Thai QR',
    cash: 'เงินสด',
    pickUpNow: 'รับสินค้าตอนนี้',
    markPickedUp: 'บันทึกว่ารับสินค้าแล้ว',
    futureWarning: 'ออเดอร์นี้มีกำหนดรับสินค้าในอนาคต',
    futureHelper: 'สามารถยืนยันการรับสินค้าตอนนี้ได้',
    overdueWarning: 'ออเดอร์นี้เลยกำหนดรับแล้ว',
    confirmEarlyPickup: 'ยืนยันการรับสินค้าก่อนกำหนด',
    confirmPickup: 'ยืนยันการรับสินค้า',
    customer: 'ลูกค้า',
    orderNumber: 'เลขออเดอร์',
    total: 'ยอดรวม',
    pickupTiming: 'ช่วงเวลารับสินค้า',
    early: 'ก่อนกำหนด',
    onTime: 'ตรงกำหนด',
    items: 'รายการ',
    loadingCustomer: 'กำลังโหลดข้อมูลลูกค้า…',
    loadingOrders: 'กำลังโหลดออเดอร์…',
    confirmingPickup: 'กำลังยืนยันการรับสินค้า…',
    pickupConfirmed: 'ยืนยันการรับสินค้าแล้ว',
    pickupConfirmedMessage: 'บันทึกว่าออเดอร์รับสินค้าแล้วเรียบร้อย',
    pickUpAnotherOrder: 'รับออเดอร์ถัดไป',
    signInAnotherCustomer: 'เข้าสู่ระบบลูกค้ารายอื่น',
    viewOrderDetails: 'ดูรายละเอียดคำสั่งซื้อ',
    hideOrderDetails: 'ซ่อนรายละเอียดคำสั่งซื้อ',
    orderDetails: 'รายละเอียดคำสั่งซื้อ',
    product: 'สินค้า',
    quantity: 'จำนวน',
    quantityUnavailable: 'ไม่ระบุจำนวน',
    unitPrice: 'ราคาต่อชิ้น',
    lineTotal: 'รวมรายการ',
    subtotal: 'ยอดรวมสินค้า',
    discount: 'ส่วนลด',
    deliveryFee: 'ค่าจัดส่ง',
    packingChecklist: 'รายการตรวจสอบการจัดสินค้า',
    allItemsChecked: 'ตรวจสอบสินค้าครบแล้ว',
    unknownProduct: 'ไม่ทราบชื่อสินค้า',
    noOrderDetails: 'ไม่มีรายละเอียดสินค้า',
    priceUnavailable: 'ไม่ระบุราคา',
    each: 'ต่อชิ้น',
    customerNotFound: 'ไม่พบลูกค้า',
    invalidQr: 'QR หรือรหัสสมาชิกไม่ถูกต้อง',
    lookupUnavailable: 'ไม่สามารถโหลดข้อมูลลูกค้าได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่',
    pickupSuccess: 'ยืนยันการรับสินค้าสำเร็จ',
    pickupFailed: 'ไม่สามารถยืนยันการรับสินค้าได้',
    paymentUpdateFailed: 'ไม่สามารถอัปเดตข้อมูลการชำระเงินได้',
    switchWalkIn: 'ไปที่จุดขายหน้าร้าน',
    language: 'ภาษา',
  },
} as const;

interface Customer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  line_id: string | null;
  whatsapp: string | null;
  wechat_id: string | null;
  qr_token: string;
  loyalty_points: number;
}

interface Order {
  id: string;
  order_number: string;
  order_items: unknown;
  total_amount: number;
  pickup_date: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  customer_name: string;
  customer_id: string;
  created_at: string;
  loyalty_points_earned: number | null;
  picked_up_at: string | null;
}

interface NormalizedOrderItem {
  key: string;
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  imageUrl: string | null;
}

interface PickupSuccess {
  orderId: string;
  orderNumber: string;
  scheduledPickupDate: string | null;
  actualPickupTimestamp: string | null;
  totalAmount: number;
  paymentStatus: string;
  paymentMethod: string | null;
  itemCount: number;
  customerName: string | null;
}

type OrderTiming = 'early' | 'on_time' | 'overdue';
type ConfirmationPaymentStatus = 'paid' | 'pending' | 'unpaid' | '';
type ConfirmationPaymentMethod = 'cash' | 'qr' | '';

const COMPLETED_STATUSES = new Set(['picked_up', 'completed']);

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatPickupDate(date: string | null, language: string) {
  if (!date) return '—';
  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`));
}

function formatPickupTimestamp(timestamp: string | null, language: string) {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function getOrderTiming(order: Order): OrderTiming {
  const today = localDateKey();
  if ((order.pickup_date || '') > today) return 'early';
  if (order.pickup_date === today) return 'on_time';
  return 'overdue';
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function getStoredImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function PickupDeskPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { language, setLanguage } = useLanguage();
  const deskLanguage = language === 'th' ? 'th' : 'en';
  const copy = PICKUP_DESK_TEXT[deskLanguage];
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('pickupDeskAuth') === 'true'
  );
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null);
  const [confirmationPaymentStatus, setConfirmationPaymentStatus] = useState<ConfirmationPaymentStatus>('');
  const [confirmationPaymentMethod, setConfirmationPaymentMethod] = useState<ConfirmationPaymentMethod>('');
  const [pickupSuccess, setPickupSuccess] = useState<PickupSuccess | null>(null);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(() => new Set());
  const [packingChecks, setPackingChecks] = useState<Record<string, Record<string, boolean>>>({});
  const qrImageInputRef = useRef<HTMLInputElement>(null);

  const resetOrderCardState = () => {
    setExpandedOrderIds(new Set());
    setPackingChecks({});
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (pin === PICKUP_DESK_PIN) {
      sessionStorage.setItem('pickupDeskAuth', 'true');
      setIsAuthenticated(true);
      setPin('');
    } else {
      setPinError(copy.invalidPin);
      setPin('');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('pickupDeskAuth');
    setIsAuthenticated(false);
    setCustomer(null);
    setOrders([]);
    setShowScanner(false);
    setPin('');
    setPickupSuccess(null);
    setConfirmingOrder(null);
    resetOrderCardState();
  };

  const loadOrders = async (customerId: string) => {
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, pickup_date, status, payment_status, payment_method, order_items, total_amount, customer_id, customer_name, created_at, loyalty_points_earned, picked_up_at')
      .eq('customer_id', customerId)
      .neq('status', 'cancelled')
      .not('pickup_date', 'is', null)
      .or('purchase_type.eq.online,purchase_type.is.null')
      .order('pickup_date', { ascending: true })
      .order('created_at', { ascending: false });
    if (ordersError) throw ordersError;
    setOrders(ordersData || []);
  };

  const getLookupErrorMessage = (err: unknown) => {
    if (err instanceof InvalidCustomerCodeError) return copy.invalidQr;
    if (err instanceof CustomerLookupNetworkError || err instanceof CustomerLookupServiceError) {
      return copy.lookupUnavailable;
    }
    return copy.lookupUnavailable;
  };

  const handleScan = async (decodedText: string) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setCustomer(null);
      setOrders([]);
      setPickupSuccess(null);
      resetOrderCardState();
      const customerData = await lookupCustomerByQRToken(decodedText);
      if (!customerData) {
        setError(copy.customerNotFound);
        return;
      }
      setCustomer(customerData);
      await loadOrders(customerData.id);
    } catch (err) {
      setError(getLookupErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleManualCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setCustomer(null);
      setOrders([]);
      setPickupSuccess(null);
      resetOrderCardState();
      const customerData = await lookupCustomerByQRToken(manualCode.trim());
      if (!customerData) {
        setError(copy.customerNotFound);
        setManualCode('');
        return;
      }
      setCustomer(customerData);
      setShowManualEntry(false);
      setManualCode('');
      await loadOrders(customerData.id);
    } catch (err) {
      setError(getLookupErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleQrImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError(copy.invalidImageType);
      return;
    }

    setLoading(true);
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas unavailable');
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(pixels.data, pixels.width, pixels.height);
        if (!decoded?.data) {
          setError(copy.noQrInImage);
          return;
        }
        setShowScanner(false);
        await handleScan(decoded.data);
      } catch {
        setError(copy.unreadableImage);
      } finally {
        URL.revokeObjectURL(objectUrl);
        setLoading(false);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setLoading(false);
      setError(copy.unreadableImage);
    };
    image.src = objectUrl;
  };

  const handleTogglePaid = async (order: Order) => {
    try {
      setUpdatingOrder(order.id);
      const newStatus = order.payment_status === 'paid' ? 'unpaid' : 'paid';
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: newStatus })
        .eq('id', order.id);
      if (error) throw error;
      setOrders(orders.map((o) => (o.id === order.id ? { ...o, payment_status: newStatus } : o)));
    } catch (err) {
      console.error('Error updating payment status:', err);
      setError(copy.paymentUpdateFailed);
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleSetPaymentMethod = async (order: Order, method: 'qr_code' | 'cash') => {
    try {
      setUpdatingOrder(order.id);
      const newMethod = order.payment_method === method ? null : method;
      const { error } = await supabase
        .from('orders')
        .update({ payment_method: newMethod })
        .eq('id', order.id);
      if (error) throw error;
      setOrders(orders.map((o) => (o.id === order.id ? { ...o, payment_method: newMethod } : o)));
    } catch (err) {
      console.error('Error updating payment method:', err);
      setError(copy.paymentUpdateFailed);
    } finally {
      setUpdatingOrder(null);
    }
  };

  const openPickupConfirmation = (order: Order) => {
    const existingStatus: ConfirmationPaymentStatus = order.payment_status === 'paid'
      ? 'paid'
      : order.payment_status === 'pending' || order.payment_status === 'pay_on_pickup'
        ? 'pending'
        : order.payment_status === 'unpaid'
          ? 'unpaid'
          : '';
    const existingMethod: ConfirmationPaymentMethod = order.payment_method === 'cash'
      ? 'cash'
      : order.payment_method === 'qr' || order.payment_method === 'qr_code'
        ? 'qr'
        : '';

    setConfirmationPaymentStatus(existingStatus);
    setConfirmationPaymentMethod(existingStatus === 'paid' ? existingMethod : '');
    setConfirmingOrder(order);
    setError(null);
    setSuccess(null);
  };

  const closePickupConfirmation = () => {
    setConfirmingOrder(null);
    setConfirmationPaymentStatus('');
    setConfirmationPaymentMethod('');
  };

  const handleMarkAsPickedUp = async (order: Order) => {
    if (!confirmationPaymentStatus || (
      confirmationPaymentStatus === 'paid' && !confirmationPaymentMethod
    )) return;

    try {
      setUpdatingOrder(order.id);
      setError(null);
      setSuccess(null);
      const nextPaymentMethod = confirmationPaymentStatus === 'paid'
        ? confirmationPaymentMethod
        : null;
      const existingStatus = order.payment_status === 'pay_on_pickup'
        ? 'pending'
        : order.payment_status;
      const existingMethod = order.payment_method === 'qr_code'
        ? 'qr'
        : order.payment_method;
      const shouldUpdatePayment = existingStatus !== confirmationPaymentStatus
        || existingMethod !== nextPaymentMethod;

      if (shouldUpdatePayment) {
        const { error: paymentError } = await supabase
          .from('orders')
          .update({
            payment_status: confirmationPaymentStatus,
            payment_method: nextPaymentMethod,
          })
          .eq('id', order.id);
        if (paymentError) {
          console.error('Error updating payment information:', paymentError);
          setError(copy.paymentUpdateFailed);
          return;
        }
      }

      const { data, error } = await supabase.rpc('confirm_order_pickup', {
        p_order_id: order.id,
      });
      if (error) throw error;
      const updated = Array.isArray(data) ? data[0] : data;
      if (!updated) throw new Error('Missing pickup confirmation result');
      setOrders((current) => current.map((item) => (
        item.id === order.id
          ? {
              ...item,
              status: updated.status,
              picked_up_at: updated.picked_up_at,
              payment_status: shouldUpdatePayment ? confirmationPaymentStatus : item.payment_status,
              payment_method: shouldUpdatePayment ? nextPaymentMethod : item.payment_method,
            }
          : item
      )));
      const rawItems = Array.isArray(order.order_items) ? order.order_items : [];
      const itemCount = rawItems.reduce((total, rawItem) => {
        if (!rawItem || typeof rawItem !== 'object') return total;
        const quantity = toFiniteNumber((rawItem as Record<string, unknown>).quantity);
        return total + (quantity ?? 0);
      }, 0) || rawItems.length;
      setPackingChecks((current) => {
        const remainingChecks = { ...current };
        delete remainingChecks[order.id];
        return remainingChecks;
      });
      setExpandedOrderIds((current) => {
        const next = new Set(current);
        next.delete(order.id);
        return next;
      });
      closePickupConfirmation();
      setPickupSuccess({
        orderId: order.id,
        orderNumber: order.order_number,
        scheduledPickupDate: order.pickup_date,
        actualPickupTimestamp: updated.picked_up_at ?? null,
        totalAmount: Number(order.total_amount),
        paymentStatus: shouldUpdatePayment ? confirmationPaymentStatus : order.payment_status,
        paymentMethod: shouldUpdatePayment ? nextPaymentMethod : order.payment_method,
        itemCount,
        customerName: customer?.name ?? order.customer_name ?? null,
      });
    } catch (err) {
      console.error('Error updating order:', err);
      setError(copy.pickupFailed);
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handlePickUpAnotherOrder = async () => {
    setPickupSuccess(null);
    setError(null);
    setSuccess(null);
    if (!customer) return;
    try {
      setLoading(true);
      await loadOrders(customer.id);
    } catch {
      setError(copy.lookupUnavailable);
    } finally {
      setLoading(false);
    }
  };

  const handleSignInAnotherCustomer = () => {
    setCustomer(null);
    setOrders([]);
    setPickupSuccess(null);
    setConfirmingOrder(null);
    setError(null);
    setSuccess(null);
    resetOrderCardState();
  };

  const handlePickupSuccessGoHome = () => {
    setCustomer(null);
    setOrders([]);
    setPickupSuccess(null);
    setConfirmingOrder(null);
    setError(null);
    setSuccess(null);
    resetOrderCardState();
    onNavigate('home');
  };

  const getContactMethod = () => {
    if (!customer) return null;
    if (customer.line_id) return { type: 'LINE', value: customer.line_id };
    if (customer.whatsapp) return { type: 'WhatsApp', value: customer.whatsapp };
    if (customer.wechat_id) return { type: 'WeChat', value: customer.wechat_id };
    return null;
  };

  const activeOrders = orders.filter((order) => !COMPLETED_STATUSES.has(order.status));
  const completedOrders = orders
    .filter((order) => COMPLETED_STATUSES.has(order.status))
    .sort((a, b) => (b.picked_up_at || b.pickup_date || b.created_at).localeCompare(a.picked_up_at || a.pickup_date || a.created_at));
  const today = localDateKey();
  const todayOrders = activeOrders.filter((order) => order.pickup_date === today);
  const upcomingByDate = Object.entries(
    activeOrders
      .filter((order) => (order.pickup_date || '') > today)
      .reduce<Record<string, Order[]>>((groups, order) => {
        (groups[order.pickup_date!] ||= []).push(order);
        return groups;
      }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));
  const overdueByDate = Object.entries(
    activeOrders
      .filter((order) => (order.pickup_date || '') < today)
      .reduce<Record<string, Order[]>>((groups, order) => {
        (groups[order.pickup_date!] ||= []).push(order);
        return groups;
      }, {}),
  ).sort(([a], [b]) => b.localeCompare(a));
  const upcomingOrderCount = upcomingByDate.reduce((count, [, dateOrders]) => count + dateOrders.length, 0);
  const overdueOrderCount = overdueByDate.reduce((count, [, dateOrders]) => count + dateOrders.length, 0);
  const noScheduledOrdersLabel = copy.noScheduledOrders;

  const normalizeOrderItems = (rawItems: unknown): NormalizedOrderItem[] => {
    if (!Array.isArray(rawItems)) return [];

    return rawItems.map((rawItem, index) => {
      const item = rawItem && typeof rawItem === 'object'
        ? rawItem as Record<string, unknown>
        : {};
      const preferredName = deskLanguage === 'th'
        ? item.product_name_th ?? item.name_th
        : item.product_name ?? item.name ?? item.productName;
      const fallbackName = item.product_name ?? item.name ?? item.productName ?? item.product_name_th ?? item.name_th;
      const nameValue = preferredName ?? fallbackName;
      const quantity = toFiniteNumber(item.quantity ?? item.qty);
      const unitPrice = toFiniteNumber(item.price_at_order ?? item.unit_price ?? item.unitPrice ?? item.price);
      const storedLineTotal = toFiniteNumber(item.line_total ?? item.lineTotal ?? item.subtotal ?? item.total);
      const productId = item.product_id ?? item.productId ?? 'legacy';

      return {
        key: `${String(productId)}-${index}`,
        name: typeof nameValue === 'string' && nameValue.trim() ? nameValue.trim() : copy.unknownProduct,
        quantity,
        unitPrice,
        lineTotal: storedLineTotal ?? (
          quantity !== null && unitPrice !== null ? quantity * unitPrice : null
        ),
        imageUrl: getStoredImageUrl(item.image_url ?? item.imageUrl ?? item.image),
      };
    });
  };

  const formatBaht = (value: number | null) => (
    value === null
      ? copy.priceUnavailable
      : `฿${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );

  const toggleOrderDetails = (orderId: string) => {
    setExpandedOrderIds((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const togglePackingItem = (orderId: string, itemKey: string) => {
    setPackingChecks((current) => ({
      ...current,
      [orderId]: {
        ...current[orderId],
        [itemKey]: !current[orderId]?.[itemKey],
      },
    }));
  };

  const getPaymentDisplay = (order: Pick<Order, 'payment_status' | 'payment_method'>) => {
    const methodLabels: Record<string, { en: string; th: string }> = {
      qr: { en: copy.paidThaiQr, th: copy.paidThaiQr },
      qr_code: { en: copy.paidThaiQr, th: copy.paidThaiQr },
      cash: { en: copy.paidCash, th: copy.paidCash },
      bank_transfer: { en: copy.bankTransfer, th: copy.bankTransfer },
      card: { en: copy.card, th: copy.card },
    };
    const knownMethod = order.payment_method ? methodLabels[order.payment_method] : null;
    const fallbackMethod = order.payment_method
      ? order.payment_method
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')
      : '';
    const methodLabel = knownMethod
      ? knownMethod[deskLanguage]
      : fallbackMethod;

    if (order.payment_status === 'paid') {
      const paidLabel = copy.paid;
      return {
        label: methodLabel ? `${paidLabel} (${methodLabel})` : paidLabel,
        className: 'bg-green-100 text-green-800 border-green-200',
      };
    }
    if (order.payment_status === 'pending' || order.payment_status === 'pay_on_pickup') {
      return {
        label: copy.payOnPickup,
        className: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    }
    if (order.payment_status === 'unpaid') {
      return {
        label: copy.unpaid,
        className: 'bg-red-100 text-red-800 border-red-200',
      };
    }
    return {
      label: copy.paymentUnknown,
      className: 'bg-gray-100 text-gray-700 border-gray-200',
    };
  };

  const renderOrderCard = (order: Order, completed = false) => {
    const timing = getOrderTiming(order);
    const payment = getPaymentDisplay(order);
    const items = normalizeOrderItems(order.order_items);
    const isExpanded = expandedOrderIds.has(order.id);
    const knownQuantityTotal = items.reduce(
      (total, item) => total + (item.quantity ?? 0),
      0,
    );
    const itemCount = knownQuantityTotal || items.length;
    const subtotal = items.length > 0 && items.every((item) => item.lineTotal !== null)
      ? items.reduce((total, item) => total + item.lineTotal!, 0)
      : null;
    const allItemsChecked = items.length > 0
      && items.every((item) => packingChecks[order.id]?.[item.key]);
    const detailsId = `order-details-${order.id}`;

    return (
      <div key={order.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="font-bold text-gray-900 text-lg">#{order.order_number}</p>
            <p className="text-sm text-gray-500">
              {itemCount} {copy.items} &bull; {formatBaht(Number(order.total_amount))}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            completed ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
          }`}>
            {completed
              ? copy.alreadyPickedUp
              : copy.ready}
          </span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-700 mb-4">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="font-medium">{copy.scheduledPickup}:</span>
          <span>{formatPickupDate(order.pickup_date, deskLanguage)}</span>
        </div>

        {completed && (
          <div className="flex items-center gap-2 text-sm text-gray-700 mb-4">
            <span className="font-medium">{copy.payment}:</span>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${payment.className}`}>
              {payment.label}
            </span>
          </div>
        )}

        {completed && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-4 text-sm text-blue-800">
            <span className="font-medium">{copy.actualPickup}:</span>{' '}
            {formatPickupTimestamp(order.picked_up_at, deskLanguage)}
          </div>
        )}

        {!completed && timing === 'early' && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 mb-4 text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">
                {copy.futureWarning}
              </p>
              <p>{copy.futureHelper}</p>
            </div>
          </div>
        )}

        {!completed && timing === 'overdue' && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-3 mb-4 text-sm text-red-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p className="font-semibold">{copy.overdueWarning}</p>
          </div>
        )}

        <button
          type="button"
          onClick={() => toggleOrderDetails(order.id)}
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          aria-label={isExpanded ? copy.hideOrderDetails : copy.viewOrderDetails}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-100"
        >
          <span>{isExpanded ? copy.hideOrderDetails : copy.viewOrderDetails}</span>
          {isExpanded
            ? <ChevronUp className="h-5 w-5 flex-shrink-0" />
            : <ChevronDown className="h-5 w-5 flex-shrink-0" />}
        </button>

        {isExpanded && (
          <div id={detailsId} className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
              <h4 className="font-bold text-gray-900">{copy.orderDetails}</h4>
            </div>

            {items.length === 0 ? (
              <div className="flex items-center gap-3 px-4 py-5 text-sm text-gray-500 sm:px-5">
                <ShoppingBag className="h-5 w-5 flex-shrink-0 text-slate-400" />
                <span>{copy.noOrderDetails}</span>
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-[minmax(0,2fr)_minmax(5rem,0.7fr)_minmax(7rem,0.9fr)_minmax(7rem,0.9fr)] gap-4 border-b border-slate-200 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 md:grid">
                  <span>{copy.product}</span>
                  <span>{copy.quantity}</span>
                  <span>{copy.unitPrice}</span>
                  <span className="text-right">{copy.lineTotal}</span>
                </div>
                <div className="divide-y divide-slate-200">
                  {items.map((item) => (
                    <div key={item.key}>
                      <div className="hidden grid-cols-[minmax(0,2fr)_minmax(5rem,0.7fr)_minmax(7rem,0.9fr)_minmax(7rem,0.9fr)] items-center gap-4 px-5 py-4 text-sm md:grid">
                        <div className="flex min-w-0 items-center gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="h-11 w-11 flex-shrink-0 rounded-lg border border-slate-200 object-cover"
                            />
                          ) : (
                            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400">
                              <ShoppingBag className="h-5 w-5" />
                            </span>
                          )}
                          <span className="min-w-0 break-words font-medium text-gray-900">{item.name}</span>
                        </div>
                        <span className="text-gray-700">
                          {item.quantity ?? copy.quantityUnavailable}
                        </span>
                        <span className="text-gray-700">{formatBaht(item.unitPrice)}</span>
                        <span className="text-right font-semibold text-gray-900">{formatBaht(item.lineTotal)}</span>
                      </div>

                      <div className="flex gap-3 px-4 py-4 md:hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-12 w-12 flex-shrink-0 rounded-lg border border-slate-200 object-cover"
                          />
                        ) : (
                          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400">
                            <ShoppingBag className="h-5 w-5" />
                          </span>
                        )}
                        <div className="min-w-0 flex-1 text-sm">
                          <p className="break-words font-semibold text-gray-900">{item.name}</p>
                          <p className="mt-1 text-gray-600">
                            {copy.quantity}: {item.quantity ?? copy.quantityUnavailable}
                          </p>
                          <p className="text-gray-600">{formatBaht(item.unitPrice)} {copy.each}</p>
                          <p className="mt-1 font-semibold text-gray-900">
                            {copy.lineTotal}: {formatBaht(item.lineTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-5">
                  <dl className="ml-auto max-w-sm space-y-2 text-sm">
                    <div className="flex justify-between gap-4 text-gray-600">
                      <dt>{copy.items}</dt>
                      <dd>{itemCount}</dd>
                    </div>
                    {subtotal !== null && (
                      <div className="flex justify-between gap-4 text-gray-600">
                        <dt>{copy.subtotal}</dt>
                        <dd>{formatBaht(subtotal)}</dd>
                      </div>
                    )}
                    <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 font-bold text-gray-900">
                      <dt>{copy.total}</dt>
                      <dd>{formatBaht(Number(order.total_amount))}</dd>
                    </div>
                  </dl>
                </div>

                {!completed && (
                  <div className="border-t border-slate-200 px-4 py-4 sm:px-5">
                    <h5 className="mb-3 font-bold text-gray-900">{copy.packingChecklist}</h5>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <label
                          key={item.key}
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-800 transition-colors duration-200 hover:bg-green-50"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(packingChecks[order.id]?.[item.key])}
                            onChange={() => togglePackingItem(order.id, item.key)}
                            className="h-5 w-5 flex-shrink-0 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="min-w-0 break-words">
                            {item.name}{item.quantity !== null ? ` × ${item.quantity}` : ''}
                          </span>
                        </label>
                      ))}
                    </div>
                    {allItemsChecked && (
                      <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-green-700">
                        <Check className="h-4 w-4" />
                        {copy.allItemsChecked}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!completed && (
          <>
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{copy.paidQuestion}</span>
                <button
                  onClick={() => handleTogglePaid(order)}
                  disabled={updatingOrder === order.id}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                    order.payment_status === 'paid' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-green-100'
                  }`}
                >
                  {order.payment_status === 'paid' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {order.payment_status === 'paid'
                    ? copy.yes
                    : copy.no}
                </button>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {copy.paymentMethod}
                </p>
                <div className="flex gap-3">
                  {(['qr_code', 'cash'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => handleSetPaymentMethod(order, method)}
                      disabled={updatingOrder === order.id}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all duration-200 ${
                        order.payment_method === method
                          ? 'border-slate-700 bg-slate-700 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-green-500 hover:text-green-700'
                      }`}
                    >
                      {method === 'qr_code' ? <QrCode className="w-4 h-4" /> : <Banknote className="w-4 h-4" />}
                      {method === 'qr_code' ? copy.qrCode : copy.cash}
                      {order.payment_method === method && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button
              onClick={() => openPickupConfirmation(order)}
              disabled={updatingOrder === order.id}
              className="w-full mt-4 border-2 border-green-600 text-green-700 px-4 py-2.5 rounded-lg font-semibold hover:bg-green-600 hover:text-white transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {timing === 'early'
                ? copy.pickUpNow
                : copy.markPickedUp}
            </button>
          </>
        )}
      </div>
    );
  };

  const pickupSuccessPayment = pickupSuccess
    ? getPaymentDisplay({
        payment_status: pickupSuccess.paymentStatus,
        payment_method: pickupSuccess.paymentMethod,
      })
    : null;
  const pickupSuccessActionClass = 'h-12 w-full rounded-lg border-2 border-orange-600 bg-white px-6 font-semibold text-orange-700 transition-all duration-200 hover:bg-orange-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 active:scale-[0.99]';

  const languageSwitch = (
    <div className="flex w-full rounded-lg bg-white/15 p-1" aria-label={copy.language}>
      {(['en', 'th'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLanguage(option)}
          className={`flex-1 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors duration-200 ${
            deskLanguage === option
              ? 'bg-white text-slate-800'
              : 'text-white hover:bg-white/10'
          }`}
          aria-pressed={deskLanguage === option}
        >
          {option === 'en' ? 'EN' : 'ไทย'}
        </button>
      ))}
    </div>
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <button
          onClick={() => onNavigate('home')}
          className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors"
        >
          <Home className="w-4 h-4" />
          {copy.goHome}
        </button>
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="relative bg-gradient-to-r from-slate-700 to-slate-900 px-8 py-8">
              <div className="absolute right-4 top-4 w-48">{languageSwitch}</div>
              <div className="flex items-center justify-center mb-4">
                <Lock className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white text-center mb-2">
                {copy.pickupDesk}
              </h1>
              <p className="text-slate-300 text-center">
                {copy.enterStaffPin}
              </p>
            </div>
            <div className="p-8">
              <form onSubmit={handlePinSubmit}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {copy.pin}
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest font-semibold focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent"
                  autoFocus
                />
                {pinError && <p className="mt-2 text-red-600 text-sm text-center font-medium">{pinError}</p>}
                <button
                  type="submit"
                  className="w-full mt-6 bg-gradient-to-r from-slate-700 to-slate-900 text-white font-bold py-3 px-4 rounded-lg hover:from-slate-800 hover:to-slate-950 transition-all"
                >
                  {copy.signIn}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <button
        onClick={() => onNavigate('home')}
        className="mb-4 flex items-center gap-2 px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors"
      >
        <Home className="w-4 h-4" />
        {copy.goHome}
      </button>
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-8 py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {copy.pickupDesk}
                </h1>
                <p className="text-slate-300">
                  {copy.subtitle}
                </p>
              </div>
              <div className="flex w-full flex-col items-stretch gap-3 sm:w-48">
                {languageSwitch}
                <button
                  onClick={() => onNavigate('walk-in')}
                  className="w-full min-h-10 px-3 py-2 text-sm font-medium text-white border border-white/30 hover:bg-white/10 rounded-lg transition-colors duration-200"
                >
                  {copy.switchWalkIn}
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full min-h-10 items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                >
                  <LogOut className="w-4 h-4" />
                  {copy.logout}
                </button>
              </div>
            </div>
          </div>

          <div className="p-8">
            {!customer ? (
              <>
                {showManualEntry ? (
                  <form onSubmit={handleManualCodeSubmit} className="space-y-4 max-w-md mx-auto">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {copy.enterMemberCode}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {copy.memberCodeExample}
                      </p>
                    </div>
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      placeholder={copy.memberCodeExample}
                      className="w-full px-4 py-3 text-lg font-semibold border-2 border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 text-center tracking-widest"
                      autoFocus
                      disabled={loading}
                    />
                    {error && <p className="text-red-600 text-sm font-medium text-center">{error}</p>}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setShowManualEntry(false); setManualCode(''); setError(null); }}
                        className="flex-1 px-4 py-3 text-slate-700 border-2 border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                      >
                        {copy.cancel}
                      </button>
                      <button
                        type="submit"
                        disabled={!manualCode.trim() || loading}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-900 text-white rounded-lg font-medium hover:from-slate-800 hover:to-slate-950 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {copy.loadingCustomer}
                          </>
                        ) : copy.search}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Package className="w-10 h-10 text-slate-600" />
                    </div>
                    <div className="mx-auto flex w-full max-w-xs flex-col gap-4">
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-orange-600 bg-white px-5 font-semibold text-orange-700 shadow-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-amber-600 hover:to-orange-600 hover:text-white hover:shadow-xl active:from-amber-700 active:to-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
                      >
                        {copy.scanCustomerQr}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowManualEntry(true)}
                        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-orange-600 bg-white px-5 font-semibold text-orange-700 shadow-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-amber-600 hover:to-orange-600 hover:text-white hover:shadow-xl active:from-amber-700 active:to-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
                      >
                        <Keyboard className="h-4 w-4" />
                        {copy.enterMemberCode}
                      </button>
                      <button
                        type="button"
                        onClick={() => qrImageInputRef.current?.click()}
                        disabled={loading}
                        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-orange-600 bg-white px-5 font-semibold text-orange-700 shadow-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-amber-600 hover:to-orange-600 hover:text-white hover:shadow-xl active:from-amber-700 active:to-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {copy.uploadQrImage}
                      </button>
                    </div>
                    {loading && (
                      <p className="mt-4 text-sm text-slate-600 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {copy.loadingCustomer}
                      </p>
                    )}
                    {error && <p className="mt-4 text-red-600 font-medium">{error}</p>}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Customer Header */}
                <div className="border-b border-gray-200 pb-6 mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">{copy.customerDetails}</p>
                        <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <Award className="w-4 h-4 text-amber-600" />
                          <span className="text-amber-600 font-semibold">{customer.loyalty_points} {copy.pointsTotal}</span>
                        </div>
                      </div>
                    </div>
                    {!pickupSuccess && (
                      <button
                        onClick={handleSignInAnotherCustomer}
                        className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                      >
                        {copy.scanAnother}
                      </button>
                    )}
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                      <Phone className="w-5 h-5 text-slate-600" />
                      <div>
                        <p className="text-xs text-gray-500">{copy.phone}</p>
                        <p className="text-sm font-medium text-gray-900">{customer.phone || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                      <Mail className="w-5 h-5 text-slate-600" />
                      <div>
                        <p className="text-xs text-gray-500">{copy.email}</p>
                        <p className="text-sm font-medium text-gray-900">{customer.email || '—'}</p>
                      </div>
                    </div>
                    {getContactMethod() && (
                      <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                        <MessageCircle className="w-5 h-5 text-slate-600" />
                        <div>
                          <p className="text-xs text-gray-500">{getContactMethod()?.type}</p>
                          <p className="text-sm font-medium text-gray-900">{getContactMethod()?.value}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {pickupSuccess && pickupSuccessPayment ? (
                  <div className="space-y-6">
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-6 text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600">
                        <Check className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-orange-900">{copy.pickupConfirmed}</h3>
                      <p className="mt-2 text-orange-800">{copy.pickupConfirmedMessage}</p>
                    </div>

                    <dl className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 p-4">
                        <dt className="text-sm text-gray-600">{copy.customer}</dt>
                        <dd className="mt-1 break-words font-bold text-gray-900">{pickupSuccess.customerName || '—'}</dd>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <dt className="text-sm text-gray-600">{copy.orderNumber}</dt>
                        <dd className="mt-1 font-bold text-gray-900">#{pickupSuccess.orderNumber}</dd>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <dt className="text-sm text-gray-600">{copy.scheduledPickup}</dt>
                        <dd className="mt-1 font-bold text-gray-900">
                          {formatPickupDate(pickupSuccess.scheduledPickupDate, deskLanguage)}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <dt className="text-sm text-gray-600">{copy.actualPickup}</dt>
                        <dd className="mt-1 font-bold text-gray-900">
                          {formatPickupTimestamp(pickupSuccess.actualPickupTimestamp, deskLanguage)}
                        </dd>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <dt className="text-sm text-gray-600">{copy.total}</dt>
                        <dd className="mt-1 font-bold text-gray-900">{formatBaht(pickupSuccess.totalAmount)}</dd>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4">
                        <dt className="text-sm text-gray-600">{copy.payment}</dt>
                        <dd className="mt-1">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${pickupSuccessPayment.className}`}>
                            {pickupSuccessPayment.label}
                          </span>
                        </dd>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4 sm:col-span-2">
                        <dt className="text-sm text-gray-600">{copy.items}</dt>
                        <dd className="mt-1 font-bold text-gray-900">{pickupSuccess.itemCount}</dd>
                      </div>
                    </dl>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handlePickUpAnotherOrder}
                        className={pickupSuccessActionClass}
                      >
                        {copy.pickUpAnotherOrder}
                      </button>
                      <button
                        type="button"
                        onClick={handleSignInAnotherCustomer}
                        className={pickupSuccessActionClass}
                      >
                        {copy.signInAnotherCustomer}
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('walk-in')}
                        className={pickupSuccessActionClass}
                      >
                        {copy.switchWalkIn}
                      </button>
                      <button
                        type="button"
                        onClick={handlePickupSuccessGoHome}
                        className={pickupSuccessActionClass}
                      >
                        {copy.goHome}
                      </button>
                    </div>
                  </div>
                ) : (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <Package className="w-5 h-5 text-slate-600" />
                    {copy.scheduledOrders}
                  </h3>

                  {success && <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-800">{success}</div>}
                  {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800">{error}</div>}
                  {loading && (
                    <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {copy.loadingOrders}
                    </div>
                  )}

                  <div className="space-y-8">
                    <section>
                      <h4 className="font-bold text-green-800 mb-3">
                        {copy.upcoming} ({upcomingOrderCount})
                      </h4>
                      {upcomingByDate.length > 0 ? (
                          <div className="space-y-6">
                            {upcomingByDate.map(([date, dateOrders]) => (
                              <div key={date}>
                                <h5 className="font-semibold text-gray-700 mb-3">{formatPickupDate(date, deskLanguage)}</h5>
                                <div className="space-y-4">{dateOrders.map((order) => renderOrderCard(order))}</div>
                              </div>
                            ))}
                          </div>
                      ) : (
                        <p className="text-sm text-gray-500 bg-slate-50 rounded-lg px-4 py-3">{noScheduledOrdersLabel}</p>
                      )}
                    </section>

                    <section>
                      <h4 className="font-bold text-gray-900 mb-3">
                        {copy.today} ({todayOrders.length})
                      </h4>
                      {todayOrders.length > 0 ? (
                        <>
                          <h5 className="font-semibold text-gray-700 mb-3">{formatPickupDate(today, deskLanguage)}</h5>
                          <div className="space-y-4">{todayOrders.map((order) => renderOrderCard(order))}</div>
                        </>
                      ) : (
                        <p className="text-sm text-gray-500 bg-slate-50 rounded-lg px-4 py-3">{noScheduledOrdersLabel}</p>
                      )}
                    </section>

                    <section>
                      <h4 className="font-bold text-red-700 mb-3">
                        {copy.overdue} ({overdueOrderCount})
                      </h4>
                      {overdueByDate.length > 0 ? (
                          <div className="space-y-6">
                            {overdueByDate.map(([date, dateOrders]) => (
                              <div key={date}>
                                <h5 className="font-semibold text-red-700 mb-3">
                                  {copy.overdue} — {formatPickupDate(date, deskLanguage)}
                                </h5>
                                <div className="space-y-4">{dateOrders.map((order) => renderOrderCard(order))}</div>
                              </div>
                            ))}
                          </div>
                      ) : (
                        <p className="text-sm text-gray-500 bg-slate-50 rounded-lg px-4 py-3">{noScheduledOrdersLabel}</p>
                      )}
                    </section>

                    <details className="border-t border-gray-200 pt-5" open>
                      <summary className="font-bold text-blue-800 cursor-pointer mb-3">
                        {copy.completedPickups} ({completedOrders.length})
                      </summary>
                      {completedOrders.length > 0 ? (
                          <div className="space-y-4 mt-3">{completedOrders.map((order) => renderOrderCard(order, true))}</div>
                      ) : (
                        <p className="text-sm text-gray-500 bg-slate-50 rounded-lg px-4 py-3 mt-3">{noScheduledOrdersLabel}</p>
                      )}
                    </details>
                  </div>
                </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {confirmingOrder && customer && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {getOrderTiming(confirmingOrder) === 'early'
                  ? copy.confirmEarlyPickup
                  : copy.confirmPickup}
              </h2>
              <button
                onClick={closePickupConfirmation}
                disabled={updatingOrder === confirmingOrder.id}
                className="p-1 text-gray-500 hover:text-gray-800 transition-colors duration-200"
                aria-label={copy.cancel}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <span className="text-gray-500">{copy.customer}</span>
                <span className="font-semibold text-gray-900">{customer.name}</span>
                <span className="text-gray-500">{copy.orderNumber}</span>
                <span className="font-semibold text-gray-900">#{confirmingOrder.order_number}</span>
                <span className="text-gray-500">{copy.scheduledPickup}</span>
                <span className="font-semibold text-gray-900">{formatPickupDate(confirmingOrder.pickup_date, deskLanguage)}</span>
                <span className="text-gray-500">{copy.total}</span>
                <span className="font-semibold text-gray-900">฿{Number(confirmingOrder.total_amount).toFixed(2)}</span>
                <span className="text-gray-500">{copy.pickupTiming}</span>
                <span className="font-semibold text-gray-900">
                  {getOrderTiming(confirmingOrder) === 'early'
                    ? copy.early
                    : getOrderTiming(confirmingOrder) === 'on_time'
                      ? copy.onTime
                      : copy.overdue}
                </span>
              </div>
              <fieldset className="border-t border-gray-200 pt-4">
                <legend className="mb-3 text-sm font-semibold text-gray-900">
                  {copy.paymentStatusLabel}
                </legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {([
                    ['paid', copy.paid],
                    ['pending', copy.payOnPickup],
                    ['unpaid', copy.unpaid],
                  ] as const).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                        confirmationPaymentStatus === value
                          ? 'border-orange-600 bg-orange-50 text-orange-800'
                          : 'border-slate-200 bg-white text-gray-700 hover:border-orange-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="pickup-payment-status"
                        value={value}
                        checked={confirmationPaymentStatus === value}
                        onChange={() => {
                          setConfirmationPaymentStatus(value);
                          if (value !== 'paid') setConfirmationPaymentMethod('');
                        }}
                        className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {confirmationPaymentStatus === 'paid' && (
                <fieldset className="border-t border-gray-200 pt-4">
                  <legend className="mb-3 text-sm font-semibold text-gray-900">
                    {copy.paymentMethod}
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['cash', copy.cash],
                      ['qr', copy.qrCode],
                    ] as const).map(([value, label]) => (
                      <label
                        key={value}
                        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                          confirmationPaymentMethod === value
                            ? 'border-orange-600 bg-orange-50 text-orange-800'
                            : 'border-slate-200 bg-white text-gray-700 hover:border-orange-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="pickup-payment-method"
                          value={value}
                          checked={confirmationPaymentMethod === value}
                          onChange={() => setConfirmationPaymentMethod(value)}
                          className="h-4 w-4 text-orange-600 focus:ring-orange-500"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {getOrderTiming(confirmingOrder) === 'early' && (
                <div className="flex gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {copy.futureWarning}
                    </p>
                    <p>{copy.futureHelper}</p>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 bg-slate-50 border-t border-gray-200">
              <button
                onClick={closePickupConfirmation}
                disabled={updatingOrder === confirmingOrder.id}
                className="flex-1 px-4 py-2.5 border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:border-green-500 hover:text-green-700 transition-all duration-200 disabled:opacity-50"
              >
                {copy.cancel}
              </button>
              <button
                onClick={() => handleMarkAsPickedUp(confirmingOrder)}
                disabled={
                  updatingOrder === confirmingOrder.id
                  || !confirmationPaymentStatus
                  || (confirmationPaymentStatus === 'paid' && !confirmationPaymentMethod)
                }
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {updatingOrder === confirmingOrder.id && <Loader2 className="w-4 h-4 animate-spin" />}
                {updatingOrder === confirmingOrder.id ? copy.confirmingPickup : copy.confirmPickup}
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={qrImageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleQrImageUpload}
        className="hidden"
        aria-label={copy.uploadQrImage}
      />

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          onUpload={() => qrImageInputRef.current?.click()}
          language={deskLanguage}
        />
      )}
    </div>
  );
}
