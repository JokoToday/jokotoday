import { useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  Banknote,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Home,
  Keyboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Package,
  Phone,
  QrCode,
  Store,
  ToggleLeft,
  ToggleRight,
  Upload,
  User,
} from 'lucide-react';
import jsQR from 'jsqr';
import { supabase } from '../lib/supabase';
import {
  CustomerLookupNetworkError,
  CustomerLookupServiceError,
  InvalidCustomerCodeError,
  lookupCustomerByQRToken,
} from '../lib/customerLookup';
import { QRScanner } from '../components/QRScanner';
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
  order_items: any[];
  total_amount: number;
  pickup_date: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  customer_name: string;
  created_at: string;
  loyalty_points_earned: number | null;
  purchase_type?: 'online' | 'walk_in' | null;
  walk_in_amount?: number | null;
  picked_up_at?: string | null;
}

export function PickupDeskPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { language, setLanguage } = useLanguage();
  const { user, userRole, signOut } = useAuth();
  const hasStaffAccess = Boolean(user) && (userRole === 'staff' || userRole === 'admin');
  const [showScanner, setShowScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    await signOut();
    setCustomer(null);
    setOrders([]);
    setHistoryOrders([]);
    setShowHistory(false);
    setHistoryError(null);
    setShowScanner(false);
    setShowManualEntry(false);
    setManualCode('');
    setError(null);
  };

  const loadOrders = async (customerId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', customerId)
      .eq('pickup_date', today)
      .order('created_at', { ascending: false });
    if (ordersError) throw ordersError;
    setOrders(ordersData || []);
  };

  const loadPurchaseHistory = async (customerId: string) => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);

      const today = new Date().toISOString().split('T')[0];
      const { data: historyData, error: historyQueryError } = await supabase
        .from('orders')
        .select(
          'id, order_number, order_items, total_amount, pickup_date, status, payment_status, payment_method, customer_name, created_at, loyalty_points_earned, purchase_type, walk_in_amount, picked_up_at'
        )
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (historyQueryError) throw historyQueryError;

      const pastTransactions = (historyData || []).filter((order) => {
        if (order.purchase_type === 'walk_in') return true;
        return Boolean(order.pickup_date && order.pickup_date < today);
      });

      setHistoryOrders(pastTransactions);
    } catch (err) {
      console.error('Error loading purchase history:', err);
      setHistoryOrders([]);
      setHistoryError(
        language === 'en'
          ? 'Purchase history is temporarily unavailable.'
          : 'ไม่สามารถโหลดประวัติการซื้อได้ชั่วคราว'
      );
    } finally {
      setHistoryLoading(false);
    }
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
      setCustomer(null);
      setOrders([]);
      setHistoryOrders([]);
      setShowHistory(false);
      setHistoryError(null);

      const customerData = await lookupCustomerByQRToken(lookupValue);
      if (!customerData) {
        setError(language === 'en' ? 'Customer not found' : 'ไม่พบลูกค้า');
        return;
      }

      setCustomer(customerData);
      setShowManualEntry(false);
      setManualCode('');
      await loadOrders(customerData.id);
      await loadPurchaseHistory(customerData.id);
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

  const handleManualCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

        if (import.meta.env.DEV) {
          console.debug('[PickupDesk] Decoded QR content:', decoded.data);
        }
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
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleMarkAsPickedUp = async (orderId: string) => {
    try {
      setUpdatingOrder(orderId);
      const { error } = await supabase
        .from('orders')
        .update({ status: 'picked_up' })
        .eq('id', orderId);
      if (error) throw error;
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: 'picked_up' } : o)));
    } catch (err) {
      console.error('Error updating order:', err);
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

  const formatHistoryDate = (dateValue: string | null) => {
    if (!dateValue) return '—';
    return new Date(dateValue).toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getPaymentMethodLabel = (method: string | null) => {
    if (method === 'qr_code') return language === 'en' ? 'QR Code' : 'คิวอาร์';
    if (method === 'cash') return language === 'en' ? 'Cash' : 'เงินสด';
    return language === 'en' ? 'Not recorded' : 'ไม่ได้บันทึก';
  };

  const totalLoyaltyEarned = orders.reduce((sum, o) => sum + (o.loyalty_points_earned ?? 0), 0);
  const pastPickupOrders = historyOrders.filter((order) => order.purchase_type !== 'walk_in');
  const walkInPurchases = historyOrders.filter((order) => order.purchase_type === 'walk_in');

  const languageSwitch = (
    <div className="inline-flex rounded-lg bg-white/15 p-1" aria-label="Language">
      {(['en', 'th'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLanguage(option)}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
            language === option
              ? 'bg-white text-slate-800'
              : 'text-white hover:bg-white/10'
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

          <div className="p-8">
            {!customer ? (
              <>
                {showManualEntry ? (
                  <form onSubmit={handleManualCodeSubmit} className="space-y-4 max-w-md mx-auto">
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {language === 'en' ? 'Enter Member Code' : 'กรอกรหัสสมาชิก'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {language === 'en' ? 'e.g. VIP101' : 'เช่น VIP101'}
                      </p>
                    </div>
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
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
                      className="border-2 border-slate-700 bg-white text-slate-800 px-8 py-4 rounded-xl font-semibold hover:bg-gradient-to-r hover:from-slate-700 hover:to-slate-900 hover:text-white active:from-slate-800 active:to-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 transition-all duration-200 shadow-lg hover:shadow-xl mb-4"
                    >
                      {language === 'en' ? 'Start Scanning' : 'เริ่มแสกน'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualEntry(true)}
                      className="mx-auto flex items-center justify-center gap-2 px-5 py-3 border-2 border-slate-700 bg-white text-slate-800 rounded-lg font-medium hover:bg-gradient-to-r hover:from-slate-700 hover:to-slate-900 hover:text-white active:from-slate-800 active:to-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 transition-all duration-200"
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
                      className="mt-4 mx-auto flex items-center justify-center gap-2 px-5 py-3 border-2 border-slate-700 bg-white text-slate-800 rounded-lg font-medium hover:bg-gradient-to-r hover:from-slate-700 hover:to-slate-900 hover:text-white active:from-slate-800 active:to-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50"
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
                )}
              </>
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
                    <button
                      onClick={() => {
                        setCustomer(null);
                        setOrders([]);
                        setHistoryOrders([]);
                        setShowHistory(false);
                        setHistoryError(null);
                        setError(null);
                      }}
                      className="text-gray-500 hover:text-gray-700 text-sm font-medium"
                    >
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

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Package className="w-5 h-5 text-slate-600" />
                      {language === 'en' ? "Today's Orders" : 'คำสั่งซื้อวันนี้'} ({orders.length})
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
                      <p className="text-gray-500">
                        {language === 'en' ? 'No orders for today' : 'ไม่มีคำสั่งซื้อวันนี้'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div key={order.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="font-bold text-gray-900 text-lg">#{order.order_number}</p>
                              <p className="text-sm text-gray-500">
                                {order.order_items.length} {language === 'en' ? 'items' : 'รายการ'} &bull; ฿{order.total_amount.toFixed(2)}
                              </p>
                            </div>
                            <div className="flex gap-2 flex-wrap justify-end">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                order.status === 'picked_up' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {order.status === 'picked_up'
                                  ? (language === 'en' ? 'Picked Up' : 'รับแล้ว')
                                  : (language === 'en' ? 'Ready' : 'รอรับ')}
                              </span>
                            </div>
                          </div>

                          {(order.loyalty_points_earned ?? 0) > 0 && (
                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                              <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              <span className="text-sm text-amber-700 font-medium">
                                {language === 'en' ? 'Loyalty earned this order:' : 'แต้มสะสมคำสั่งนี้:'}&nbsp;
                                <strong>+{order.loyalty_points_earned} pts</strong>
                              </span>
                            </div>
                          )}

                          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">
                                {language === 'en' ? 'Paid' : 'ชำระแล้ว'}
                              </span>
                              <button
                                onClick={() => handleTogglePaid(order)}
                                disabled={updatingOrder === order.id}
                                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                                  order.payment_status === 'paid'
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                }`}
                              >
                                {updatingOrder === order.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : order.payment_status === 'paid' ? (
                                  <ToggleRight className="w-4 h-4" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4" />
                                )}
                                {order.payment_status === 'paid'
                                  ? (language === 'en' ? 'Yes' : 'ใช่')
                                  : (language === 'en' ? 'No' : 'ยังไม่')}
                              </button>
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                {language === 'en' ? 'Payment Method' : 'วิธีชำระเงิน'}
                              </p>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleSetPaymentMethod(order, 'qr_code')}
                                  disabled={updatingOrder === order.id}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                                    order.payment_method === 'qr_code'
                                      ? 'border-slate-700 bg-slate-700 text-white'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                                  }`}
                                >
                                  <QrCode className="w-4 h-4" />
                                  {language === 'en' ? 'QR Code' : 'คิวอาร์'}
                                  {order.payment_method === 'qr_code' && <Check className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => handleSetPaymentMethod(order, 'cash')}
                                  disabled={updatingOrder === order.id}
                                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                                    order.payment_method === 'cash'
                                      ? 'border-slate-700 bg-slate-700 text-white'
                                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                                  }`}
                                >
                                  <Banknote className="w-4 h-4" />
                                  {language === 'en' ? 'Cash' : 'เงินสด'}
                                  {order.payment_method === 'cash' && <Check className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {order.status !== 'picked_up' && (
                            <button
                              onClick={() => handleMarkAsPickedUp(order.id)}
                              disabled={updatingOrder === order.id}
                              className="w-full mt-4 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {updatingOrder === order.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              {language === 'en' ? 'Mark as Picked Up' : 'บันทึกรับสินค้า'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowHistory((current) => !current)}
                    className="w-full flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 transition-colors"
                    aria-expanded={showHistory}
                  >
                    <div>
                      <p className="font-bold text-gray-900">
                        {language === 'en' ? 'Purchase History' : 'ประวัติการซื้อ'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {historyLoading
                          ? (language === 'en' ? 'Loading history…' : 'กำลังโหลดประวัติ…')
                          : `${historyOrders.length} ${language === 'en' ? 'previous transactions' : 'รายการก่อนหน้า'}`}
                      </p>
                    </div>
                    {showHistory ? (
                      <ChevronUp className="w-5 h-5 text-slate-600" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-600" />
                    )}
                  </button>

                  {showHistory && (
                    <div className="mt-4 space-y-6">
                      {historyLoading ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>{language === 'en' ? 'Loading purchase history…' : 'กำลังโหลดประวัติการซื้อ…'}</span>
                        </div>
                      ) : historyError ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                          <div className="flex items-center gap-2 text-red-700">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="font-medium">{historyError}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => loadPurchaseHistory(customer.id)}
                            className="mt-3 text-sm font-semibold text-red-700 underline underline-offset-2"
                          >
                            {language === 'en' ? 'Try again' : 'ลองอีกครั้ง'}
                          </button>
                        </div>
                      ) : historyOrders.length === 0 ? (
                        <div className="text-center py-8 bg-slate-50 rounded-xl">
                          <Package className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                          <p className="text-gray-500">
                            {language === 'en' ? 'No previous purchases recorded' : 'ยังไม่มีประวัติการซื้อ'}
                          </p>
                        </div>
                      ) : (
                        <>
                          {pastPickupOrders.length > 0 && (
                            <section>
                              <h4 className="mb-3 flex items-center gap-2 font-bold text-gray-800">
                                <Package className="w-4 h-4 text-slate-600" />
                                {language === 'en' ? 'Past Pickup Orders' : 'คำสั่งซื้อที่รับแล้ว'} ({pastPickupOrders.length})
                              </h4>
                              <div className="space-y-3">
                                {pastPickupOrders.map((order) => (
                                  <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                          <Calendar className="w-4 h-4" />
                                          <span>{formatHistoryDate(order.pickup_date || order.created_at)}</span>
                                        </div>
                                        <p className="mt-1 font-bold text-gray-900">#{order.order_number}</p>
                                        <p className="text-sm text-gray-500">
                                          {order.order_items?.length || 0} {language === 'en' ? 'items' : 'รายการ'}
                                        </p>
                                      </div>
                                      <p className="text-lg font-bold text-slate-800">฿{order.total_amount.toFixed(2)}</p>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                                      <span className={`rounded-full px-2.5 py-1 ${
                                        order.payment_status === 'paid'
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {order.payment_status === 'paid'
                                          ? (language === 'en' ? 'Paid' : 'ชำระแล้ว')
                                          : (language === 'en' ? 'Unpaid' : 'ยังไม่ชำระ')}
                                      </span>
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                                        {getPaymentMethodLabel(order.payment_method)}
                                      </span>
                                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">
                                        {order.status}
                                      </span>
                                      {(order.loyalty_points_earned ?? 0) > 0 && (
                                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                                          +{order.loyalty_points_earned} pts
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}

                          {walkInPurchases.length > 0 && (
                            <section>
                              <h4 className="mb-3 flex items-center gap-2 font-bold text-gray-800">
                                <Store className="w-4 h-4 text-slate-600" />
                                {language === 'en' ? 'Walk-In Purchases' : 'การซื้อหน้าร้าน'} ({walkInPurchases.length})
                              </h4>
                              <div className="space-y-3">
                                {walkInPurchases.map((order) => (
                                  <div key={order.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div>
                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                          <Calendar className="w-4 h-4" />
                                          <span>{formatHistoryDate(order.created_at)}</span>
                                        </div>
                                        <div className="mt-1 flex items-center gap-2">
                                          <Store className="w-4 h-4 text-slate-600" />
                                          <p className="font-semibold text-gray-900">
                                            {language === 'en' ? 'In-store purchase' : 'ซื้อหน้าร้าน'}
                                          </p>
                                        </div>
                                      </div>
                                      <p className="text-lg font-bold text-slate-800">
                                        ฿{(order.walk_in_amount ?? order.total_amount).toFixed(2)}
                                      </p>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                                      <span className={`rounded-full px-2.5 py-1 ${
                                        order.payment_status === 'paid'
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-yellow-100 text-yellow-700'
                                      }`}>
                                        {order.payment_status === 'paid'
                                          ? (language === 'en' ? 'Paid' : 'ชำระแล้ว')
                                          : (language === 'en' ? 'Unpaid' : 'ยังไม่ชำระ')}
                                      </span>
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                                        {getPaymentMethodLabel(order.payment_method)}
                                      </span>
                                      {(order.loyalty_points_earned ?? 0) > 0 && (
                                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                                          +{order.loyalty_points_earned} pts
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
          language={language as 'en' | 'th'}
        />
      )}
    </div>
  );
}
