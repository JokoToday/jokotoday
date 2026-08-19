import { useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  Banknote,
  Calendar,
  Check,
  Home,
  Keyboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Package,
  Phone,
  Printer,
  QrCode,
  Store,
  Upload,
  User,
} from 'lucide-react';
import jsQR from 'jsqr';
import { supabase } from '../lib/supabase';
import { printOrderReceipt } from '../lib/printReceipt';
import {
  CustomerLookupNetworkError,
  CustomerLookupServiceError,
  InvalidCustomerCodeError,
  lookupCustomerByQRToken,
} from '../lib/customerLookup';
import { QRScanner } from '../components/QRScanner';
import { CustomerPurchaseHistory } from '../components/staff/CustomerPurchaseHistory';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

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
  order_items: unknown[];
  total_amount: number;
  pickup_date: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  customer_name: string;
  created_at: string;
  loyalty_points_earned: number | null;
  picked_up_at?: string | null;
  staff_id?: string | null;
  purchase_type?: string | null;
}

const getBangkokToday = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const paymentComplete = (order: Order) => (
  order.payment_status === 'paid' && ['cash', 'qr_code', 'qr'].includes(order.payment_method || '')
);

export function PickupDeskPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { language, setLanguage } = useLanguage();
  const { user, userRole, signOut } = useAuth();
  const hasStaffAccess = Boolean(user) && (userRole === 'staff' || userRole === 'admin');
  const [showScanner, setShowScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [upcomingOrders, setUpcomingOrders] = useState<Order[]>([]);
  const [earlyPickupOrder, setEarlyPickupOrder] = useState<Order | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [lastReceiptOrder, setLastReceiptOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const resetCustomer = () => {
    setCustomer(null);
    setOrders([]);
    setUpcomingOrders([]);
    setEarlyPickupOrder(null);
    setLastReceiptOrder(null);
    setShowScanner(false);
    setShowManualEntry(false);
    setManualCode('');
    setError(null);
    setActionError(null);
    setActionSuccess(null);
  };

  const handleLogout = async () => {
    await signOut();
    resetCustomer();
    onNavigate('staff');
  };

  const loadOrders = async (customerId: string) => {
    const today = getBangkokToday();
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .gte('pickup_date', today)
      .order('pickup_date', { ascending: true })
      .order('created_at', { ascending: false });
    if (ordersError) throw ordersError;

    const scheduledOrders = (ordersData || []) as Order[];
    setOrders(scheduledOrders.filter((order) => order.pickup_date === today));
    setUpcomingOrders(scheduledOrders.filter((order) => (
      Boolean(order.pickup_date && order.pickup_date > today)
      && !['cancelled', 'picked_up', 'completed'].includes(order.status)
    )));
  };

  const getLookupErrorMessage = (err: unknown, source: 'manual' | 'qr' = 'qr') => {
    if (err instanceof InvalidCustomerCodeError) {
      if (source === 'manual') {
        return language === 'en'
          ? 'Enter a valid member code, such as VIP103.'
          : 'กรุณากรอกรหัสสมาชิกที่ถูกต้อง เช่น VIP103';
      }
      return language === 'en'
        ? 'The QR code was decoded, but its content is not supported.'
        : 'อ่าน QR Code ได้ แต่รูปแบบข้อมูลไม่รองรับ';
    }
    if (err instanceof CustomerLookupNetworkError) {
      return language === 'en'
        ? 'Unable to reach customer lookup. Check your connection and try again.'
        : 'ไม่สามารถเชื่อมต่อระบบค้นหาลูกค้าได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง';
    }
    if (err instanceof CustomerLookupServiceError) {
      return language === 'en'
        ? 'Customer lookup is temporarily unavailable. Please try again.'
        : 'ระบบค้นหาลูกค้าไม่พร้อมใช้งานชั่วคราว กรุณาลองอีกครั้ง';
    }
    return err instanceof Error
      ? err.message
      : (language === 'en' ? 'Failed to load customer data' : 'เกิดข้อผิดพลาด');
  };

  const findCustomer = async (lookupValue: string, source: 'manual' | 'qr' = 'qr') => {
    try {
      setLoading(true);
      setError(null);
      setActionError(null);
      setActionSuccess(null);
      setCustomer(null);
      setOrders([]);
      setUpcomingOrders([]);
      setEarlyPickupOrder(null);
      setLastReceiptOrder(null);

      const customerData = await lookupCustomerByQRToken(lookupValue);
      if (!customerData) {
        setError(language === 'en' ? 'Customer not found' : 'ไม่พบลูกค้า');
        return;
      }

      setCustomer(customerData);
      setShowManualEntry(false);
      setManualCode('');
      await loadOrders(customerData.id);
    } catch (err) {
      console.error('Error loading pickup customer:', err);
      setError(getLookupErrorMessage(err, source));
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (decodedText: string) => {
    setShowScanner(false);
    await findCustomer(decodedText);
  };

  const handleManualCodeSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!manualCode.trim()) return;
    await findCustomer(manualCode, 'manual');
  };

  const handleQrUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const supportedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!supportedTypes.includes(file.type)) {
      setError(language === 'en' ? 'Choose a PNG, JPEG, or WebP image.' : 'กรุณาเลือกรูป PNG, JPEG หรือ WebP');
      return;
    }

    setLoading(true);
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);
        if (!decoded?.data) {
          setError(language === 'en' ? 'No QR code was detected in this image.' : 'ไม่พบ QR Code ในรูปภาพนี้');
          return;
        }
        if (import.meta.env.DEV) console.debug('[PickupDesk] Decoded QR content:', decoded.data);
        await findCustomer(decoded.data);
      } catch (err) {
        if (err instanceof InvalidCustomerCodeError) {
          setError(getLookupErrorMessage(err));
        } else {
          setError(language === 'en' ? 'Could not read this image. Please choose another.' : 'ไม่สามารถอ่านรูปภาพนี้ได้ กรุณาเลือกรูปอื่น');
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
        setLoading(false);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setLoading(false);
      setError(language === 'en' ? 'Could not read this image. Please choose another.' : 'ไม่สามารถอ่านรูปภาพนี้ได้ กรุณาเลือกรูปอื่น');
    };

    image.src = objectUrl;
  };

  const recordPayment = async (order: Order, method: 'qr_code' | 'cash') => {
    try {
      setUpdatingOrder(order.id);
      setActionError(null);
      setActionSuccess(null);
      setLastReceiptOrder(null);
      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_method: method, payment_status: 'paid' })
        .eq('id', order.id);
      if (updateError) throw updateError;

      const applyPayment = (item: Order) => (
        item.id === order.id ? { ...item, payment_method: method, payment_status: 'paid' } : item
      );
      setOrders((current) => current.map(applyPayment));
      setUpcomingOrders((current) => current.map(applyPayment));
      setEarlyPickupOrder((current) => current?.id === order.id ? applyPayment(current) : current);
      setActionSuccess(language === 'en'
        ? `${method === 'cash' ? 'Cash' : 'QR'} payment recorded.`
        : `บันทึกการชำระเงิน${method === 'cash' ? 'สด' : ' QR'}แล้ว`);
    } catch (err) {
      console.error('Error recording payment:', err);
      setActionError(language === 'en' ? 'Could not record payment.' : 'ไม่สามารถบันทึกการชำระเงินได้');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const confirmPickup = async (order: Order, early: boolean) => {
    if (!paymentComplete(order)) {
      setActionError(language === 'en'
        ? 'Record payment by QR or Cash before confirming pickup.'
        : 'กรุณาบันทึกการชำระเงินด้วย QR หรือเงินสดก่อนยืนยันการรับสินค้า');
      return;
    }

    try {
      setUpdatingOrder(order.id);
      setActionError(null);
      setActionSuccess(null);
      setLastReceiptOrder(null);
      const { data: pickupRows, error: pickupError } = await supabase.rpc('confirm_order_pickup', {
        p_order_id: order.id,
      });
      if (pickupError) throw pickupError;

      const returnedOrder = Array.isArray(pickupRows) && pickupRows[0]
        ? pickupRows[0] as Order
        : { ...order, status: 'picked_up', picked_up_at: new Date().toISOString() };

      if (early) {
        setUpcomingOrders((current) => current.filter((item) => item.id !== order.id));
        setEarlyPickupOrder(null);
        setActionSuccess(language === 'en'
          ? 'Early pickup recorded successfully.'
          : 'บันทึกการรับสินค้าก่อนกำหนดเรียบร้อยแล้ว');
      } else {
        setOrders((current) => current.map((item) => (
          item.id === order.id ? returnedOrder : item
        )));
        setActionSuccess(language === 'en'
          ? 'Pickup recorded successfully.'
          : 'บันทึกการรับสินค้าเรียบร้อยแล้ว');
      }

      setLastReceiptOrder(returnedOrder);
      setHistoryRefreshKey((value) => value + 1);
    } catch (err) {
      console.error('Error confirming pickup:', err);
      setActionError(language === 'en'
        ? 'Could not confirm pickup. Please try again.'
        : 'ไม่สามารถยืนยันการรับสินค้าได้ กรุณาลองอีกครั้ง');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const getContactMethod = () => {
    if (!customer) return null;
    if (customer.line_id) return { type: 'LINE', value: customer.line_id };
    if (customer.whatsapp) return { type: 'WhatsApp', value: customer.whatsapp };
    if (customer.wechat_id) return { type: 'WeChat', value: customer.wechat_id };
    return null;
  };

  const formatPickupDate = (value: string | null) => {
    if (!value) return '—';
    const date = new Date(`${value}T00:00:00+07:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', {
      timeZone: 'Asia/Bangkok',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalLoyaltyEarned = orders.reduce((sum, order) => sum + (order.loyalty_points_earned ?? 0), 0);
  const staffLanguage = language === 'th' ? 'th' : 'en';

  const languageSwitch = (
    <div className="inline-flex rounded-lg bg-white/15 p-1" aria-label="Language">
      {(['en', 'th'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLanguage(option)}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
            language === option ? 'bg-white text-slate-800' : 'text-white hover:bg-white/10'
          }`}
          aria-pressed={language === option}
        >
          {option === 'en' ? 'EN' : 'ไทย'}
        </button>
      ))}
    </div>
  );

  if (!hasStaffAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <button
          onClick={() => onNavigate('home')}
          className="absolute top-4 left-4 flex items-center gap-2 px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition-colors"
        >
          <Home className="w-4 h-4" />
          {language === 'en' ? 'Back to Home' : 'กลับหน้าแรก'}
        </button>
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="relative bg-gradient-to-r from-slate-700 to-slate-900 px-8 py-8">
              <div className="absolute right-4 top-4">{languageSwitch}</div>
              <div className="flex items-center justify-center mb-4">
                <Lock className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white text-center mb-2">
                {language === 'en' ? 'Pickup Desk' : 'จุดรับสินค้า'}
              </h1>
              <p className="text-slate-300 text-center">
                {language === 'en' ? 'Scan Customer QR' : 'สแกน QR ลูกค้า'}
              </p>
            </div>
            <div className="p-8">
              <p className="text-center text-sm text-gray-600">
                {language === 'en'
                  ? 'Staff account required. Sign in from the main site, then return to this page.'
                  : 'ต้องใช้บัญชีพนักงาน กรุณาเข้าสู่ระบบจากเว็บไซต์หลัก แล้วกลับมาที่หน้านี้'}
              </p>
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
        {language === 'en' ? 'Back to Home' : 'กลับหน้าแรก'}
      </button>

      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-8 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {language === 'en' ? 'Pickup Desk' : 'จุดรับสินค้า'}
                </h1>
                <p className="text-slate-300">
                  {language === 'en' ? 'Scan customer QR codes to manage orders' : 'สแกน QR โค้ดลูกค้าเพื่อจัดการคำสั่งซื้อ'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                {languageSwitch}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('walk-in')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-white/15 hover:bg-white/25 rounded-lg transition-colors"
                  >
                    <Store className="w-4 h-4" />
                    {language === 'en' ? 'Walk-In Desk' : 'เคาน์เตอร์ Walk-In'}
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {language === 'en' ? 'Logout' : 'ออกจากระบบ'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            {!customer ? (
              showManualEntry ? (
                <form onSubmit={handleManualCodeSubmit} className="space-y-4 max-w-md mx-auto">
                  <div className="text-center mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {language === 'en' ? 'Enter Member Code' : 'กรอกรหัสสมาชิก'}
                    </h3>
                    <p className="text-sm text-gray-600">{language === 'en' ? 'e.g. VIP101' : 'เช่น VIP101'}</p>
                  </div>
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                    placeholder={language === 'en' ? 'e.g. VIP101' : 'เช่น VIP101'}
                    className="w-full px-4 py-3 text-lg font-semibold border-2 border-slate-300 rounded-lg focus:outline-none focus:border-slate-600 text-center tracking-widest"
                    autoFocus
                    disabled={loading}
                  />
                  {error && <p className="text-red-600 text-sm font-medium text-center">{error}</p>}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualEntry(false);
                        setManualCode('');
                        setError(null);
                      }}
                      className="flex-1 px-4 py-3 text-slate-700 border-2 border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                    >
                      {language === 'en' ? 'Cancel' : 'ยกเลิก'}
                    </button>
                    <button
                      type="submit"
                      disabled={!manualCode.trim() || loading}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-slate-700 to-slate-900 text-white rounded-lg font-medium hover:from-slate-800 hover:to-slate-950 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'en' ? 'Find Customer' : 'ค้นหาลูกค้า')}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Package className="w-10 h-10 text-slate-600" />
                  </div>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="border-2 border-slate-700 bg-white text-slate-800 px-8 py-4 rounded-xl font-semibold hover:bg-gradient-to-r hover:from-slate-700 hover:to-slate-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 transition-all shadow-lg hover:shadow-xl mb-4"
                  >
                    {language === 'en' ? 'Start Scanning' : 'เริ่มแสกน'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualEntry(true)}
                    className="mx-auto flex items-center justify-center gap-2 px-5 py-3 border-2 border-slate-700 bg-white text-slate-800 rounded-lg font-medium hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <Keyboard className="w-4 h-4" />
                    {language === 'en' ? 'Enter member code' : 'กรอกรหัสสมาชิก'}
                  </button>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleQrUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={loading}
                    className="mt-4 mx-auto flex items-center justify-center gap-2 px-5 py-3 border-2 border-slate-700 bg-white text-slate-800 rounded-lg font-medium hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {language === 'en' ? 'Upload QR Code' : 'อัปโหลด QR Code'}
                  </button>
                  {error && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <p className="text-red-600 font-medium">{error}</p>
                    </div>
                  )}
                </div>
              )
            ) : (
              <>
                <div className="border-b border-gray-200 pb-6 mb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8 text-amber-600" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <Award className="w-4 h-4 text-amber-600" />
                          <span className="text-amber-600 font-semibold">{customer.loyalty_points} pts total</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={resetCustomer} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                      {language === 'en' ? 'Scan Another' : 'แสกนต่อ'}
                    </button>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                      <Phone className="w-5 h-5 text-slate-600" />
                      <div>
                        <p className="text-xs text-gray-500">{language === 'en' ? 'Phone' : 'เบอร์โทร'}</p>
                        <p className="text-sm font-medium text-gray-900">{customer.phone || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                      <Mail className="w-5 h-5 text-slate-600" />
                      <div>
                        <p className="text-xs text-gray-500">{language === 'en' ? 'Email' : 'อีเมล'}</p>
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

                {actionError && (
                  <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm font-medium text-red-700">{actionError}</p>
                  </div>
                )}

                {actionSuccess && (
                  <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
                    <div className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <p className="text-sm font-medium text-green-700">{actionSuccess}</p>
                    </div>
                    {lastReceiptOrder && (
                      <button
                        type="button"
                        onClick={() => printOrderReceipt({ order: lastReceiptOrder, customerName: customer.name, language: staffLanguage })}
                        className="mt-3 flex items-center gap-2 rounded-lg border border-green-300 bg-white px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-100"
                      >
                        <Printer className="w-4 h-4" />
                        {language === 'en' ? 'Print Order Receipt' : 'พิมพ์ใบเสร็จรับเงิน'}
                      </button>
                    )}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Package className="w-5 h-5 text-slate-600" />
                      {language === 'en' ? "Today's Pickup Orders" : 'รายการรับสินค้าวันนี้'} ({orders.length})
                    </h3>
                    {totalLoyaltyEarned > 0 && (
                      <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                        <Award className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-700">
                          +{totalLoyaltyEarned} pts {language === 'en' ? 'earned today' : 'รับวันนี้'}
                        </span>
                      </div>
                    )}
                  </div>

                  {orders.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-xl">
                      <Package className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                      <p className="text-gray-500">{language === 'en' ? 'No orders for today' : 'ไม่มีคำสั่งซื้อวันนี้'}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div key={order.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="font-bold text-gray-900 text-lg">#{order.order_number}</p>
                              <p className="text-sm text-gray-500">
                                {order.order_items?.length || 0} {language === 'en' ? 'items' : 'รายการ'} &bull; ฿{Number(order.total_amount || 0).toFixed(2)}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              order.status === 'picked_up' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {order.status === 'picked_up'
                                ? (language === 'en' ? 'Picked Up' : 'รับแล้ว')
                                : (language === 'en' ? 'Ready' : 'รอรับ')}
                            </span>
                          </div>

                          {(order.loyalty_points_earned ?? 0) > 0 && (
                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                              <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              <span className="text-sm text-amber-700 font-medium">
                                {language === 'en' ? 'Loyalty earned this order:' : 'แต้มสะสมคำสั่งนี้:'}{' '}
                                <strong>+{order.loyalty_points_earned} pts</strong>
                              </span>
                            </div>
                          )}

                          <div className="bg-slate-50 rounded-xl p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                              {language === 'en' ? 'Payment received' : 'รับชำระเงิน'}
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => void recordPayment(order, 'qr_code')}
                                disabled={updatingOrder === order.id || order.status === 'picked_up'}
                                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                                  order.payment_status === 'paid' && order.payment_method === 'qr_code'
                                    ? 'border-slate-700 bg-slate-700 text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                                } disabled:opacity-50`}
                              >
                                {updatingOrder === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                                {language === 'en' ? 'QR received' : 'รับชำระ QR'}
                              </button>
                              <button
                                onClick={() => void recordPayment(order, 'cash')}
                                disabled={updatingOrder === order.id || order.status === 'picked_up'}
                                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                                  order.payment_status === 'paid' && order.payment_method === 'cash'
                                    ? 'border-slate-700 bg-slate-700 text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                                } disabled:opacity-50`}
                              >
                                <Banknote className="w-4 h-4" />
                                {language === 'en' ? 'Cash received' : 'รับเงินสด'}
                              </button>
                            </div>
                          </div>

                          {order.status !== 'picked_up' && (
                            <button
                              onClick={() => void confirmPickup(order, false)}
                              disabled={updatingOrder === order.id || !paymentComplete(order)}
                              className="w-full mt-4 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                              {updatingOrder === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              {paymentComplete(order)
                                ? (language === 'en' ? 'Mark as Picked Up' : 'บันทึกรับสินค้า')
                                : (language === 'en' ? 'Record payment first' : 'บันทึกการชำระเงินก่อน')}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {upcomingOrders.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-slate-600" />
                        {language === 'en' ? 'Upcoming Pickup Orders' : 'คำสั่งรับสินค้าที่กำลังจะมาถึง'} ({upcomingOrders.length})
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        {language === 'en'
                          ? 'For an early pickup, record how payment was received first, then confirm the early collection.'
                          : 'หากรับสินค้าก่อนกำหนด ให้บันทึกวิธีการชำระเงินก่อน แล้วจึงยืนยันการรับสินค้าก่อนกำหนด'}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {upcomingOrders.map((order) => {
                        const confirmingEarly = earlyPickupOrder?.id === order.id;
                        return (
                          <div key={order.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-bold text-gray-900">#{order.order_number}</p>
                                <div className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                                  <Calendar className="w-4 h-4 text-slate-500" />
                                  <span>{formatPickupDate(order.pickup_date)}</span>
                                </div>
                                <p className="mt-1 text-sm text-gray-500">
                                  {order.order_items?.length || 0} {language === 'en' ? 'items' : 'รายการ'} &bull; ฿{Number(order.total_amount || 0).toFixed(2)}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                                  {language === 'en' ? 'Scheduled' : 'กำหนดไว้'}
                                </span>
                                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  paymentComplete(order)
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {paymentComplete(order)
                                    ? `${language === 'en' ? 'Paid' : 'ชำระแล้ว'} · ${order.payment_method === 'cash' ? (language === 'en' ? 'Cash' : 'เงินสด') : 'QR'}`
                                    : (language === 'en' ? 'Payment needed' : 'ต้องบันทึกการชำระเงิน')}
                                </span>
                              </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => void recordPayment(order, 'qr_code')}
                                disabled={Boolean(updatingOrder)}
                                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                                  order.payment_status === 'paid' && order.payment_method === 'qr_code'
                                    ? 'border-slate-700 bg-slate-700 text-white'
                                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                                } disabled:opacity-50`}
                              >
                                {updatingOrder === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                                {language === 'en' ? 'QR received' : 'รับชำระ QR'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void recordPayment(order, 'cash')}
                                disabled={Boolean(updatingOrder)}
                                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                                  order.payment_status === 'paid' && order.payment_method === 'cash'
                                    ? 'border-slate-700 bg-slate-700 text-white'
                                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                                } disabled:opacity-50`}
                              >
                                <Banknote className="w-4 h-4" />
                                {language === 'en' ? 'Cash received' : 'รับเงินสด'}
                              </button>
                            </div>

                            {!confirmingEarly ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null);
                                  setActionSuccess(null);
                                  setLastReceiptOrder(null);
                                  setEarlyPickupOrder(order);
                                }}
                                disabled={Boolean(updatingOrder) || !paymentComplete(order)}
                                className="mt-3 w-full rounded-lg border-2 border-amber-500 bg-white px-4 py-2.5 font-semibold text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-40"
                              >
                                {paymentComplete(order)
                                  ? (language === 'en' ? 'Pick Up Early' : 'รับสินค้าก่อนกำหนด')
                                  : (language === 'en' ? 'Record payment first' : 'บันทึกการชำระเงินก่อน')}
                              </button>
                            ) : (
                              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                                <p className="font-bold text-amber-900">
                                  {language === 'en' ? 'Confirm early pickup?' : 'ยืนยันการรับสินค้าก่อนกำหนด?'}
                                </p>
                                <p className="mt-1 text-sm text-amber-800">
                                  {language === 'en'
                                    ? `This order is scheduled for ${formatPickupDate(order.pickup_date)}. Confirming will record the pickup now and identify the staff member who processed it.`
                                    : `คำสั่งซื้อนี้กำหนดรับวันที่ ${formatPickupDate(order.pickup_date)} การยืนยันจะบันทึกการรับสินค้าตอนนี้และระบุพนักงานผู้ดำเนินการ`}
                                </p>
                                <p className="mt-2 text-sm font-semibold text-amber-900">
                                  {language === 'en'
                                    ? `Payment recorded: ${order.payment_method === 'cash' ? 'Cash' : 'QR'}.`
                                    : `บันทึกการชำระเงินแล้ว: ${order.payment_method === 'cash' ? 'เงินสด' : 'QR'}`}
                                </p>
                                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setEarlyPickupOrder(null)}
                                    disabled={updatingOrder === order.id}
                                    className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                                  >
                                    {language === 'en' ? 'Cancel' : 'ยกเลิก'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void confirmPickup(order, true)}
                                    disabled={updatingOrder === order.id}
                                    className="flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                                  >
                                    {updatingOrder === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    {language === 'en' ? 'Confirm Early Pickup' : 'ยืนยันรับสินค้าก่อนกำหนด'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <CustomerPurchaseHistory
                  customerId={customer.id}
                  customerName={customer.name}
                  language={staffLanguage}
                  refreshKey={historyRefreshKey}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          language={staffLanguage}
        />
      )}
    </div>
  );
}
