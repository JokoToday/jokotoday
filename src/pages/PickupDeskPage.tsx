import { useState, useEffect } from 'react';
import { Lock, LogOut, Package, User, Phone, Mail, MessageCircle, Award, Check, Loader2, Home, QrCode, Banknote, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { lookupCustomerByQRToken } from '../lib/customerLookup';
import { QRScanner } from '../components/QRScanner';
import { useLanguage } from '../context/LanguageContext';

const PICKUP_DESK_PIN = '1234';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
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
  pickup_date: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  customer_name: string;
  created_at: string;
  loyalty_points_earned: number | null;
}

export function PickupDeskPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { language } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('pickupDeskAuth');
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    if (pin === PICKUP_DESK_PIN) {
      sessionStorage.setItem('pickupDeskAuth', 'true');
      setIsAuthenticated(true);
      setPin('');
    } else {
      setPinError(language === 'en' ? 'Invalid PIN' : 'PIN ไม่ถูกต้อง');
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

  const handleScan = async (decodedText: string) => {
    try {
      setLoading(true);
      setError(null);
      setCustomer(null);
      setOrders([]);
      const customerData = await lookupCustomerByQRToken(decodedText);
      if (!customerData) {
        setError(language === 'en' ? 'Customer not found' : 'ไม่พบลูกค้า');
        return;
      }
      setCustomer(customerData);
      await loadOrders(customerData.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : (language === 'en' ? 'Failed to load customer data' : 'เกิดข้อผิดพลาด'));
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
      setCustomer(null);
      setOrders([]);
      const customerData = await lookupCustomerByQRToken(manualCode.trim());
      if (!customerData) {
        setError(language === 'en' ? 'No customer found with this code.' : 'ไม่พบลูกค้าด้วยรหัสนี้');
        setManualCode('');
        return;
      }
      setCustomer(customerData);
      setShowManualEntry(false);
      setManualCode('');
      await loadOrders(customerData.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : (language === 'en' ? 'Failed to load customer data' : 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
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

  const totalLoyaltyEarned = orders.reduce((sum, o) => sum + (o.loyalty_points_earned ?? 0), 0);

  if (!isAuthenticated) {
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
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-8 py-8">
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
              <form onSubmit={handlePinSubmit}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'en' ? 'Staff PIN' : 'PIN พนักงาน'}
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
                  {language === 'en' ? 'Login' : 'เข้าสู่ระบบ'}
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
        {language === 'en' ? 'Back to Home' : 'กลับหน้าแรก'}
      </button>
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {language === 'en' ? 'Pickup Desk' : 'จุดรับสินค้า'}
                </h1>
                <p className="text-slate-300">
                  {language === 'en' ? 'Scan customer QR codes to manage orders' : 'สแกน QR โค้ดลูกค้าเพื่อจัดการคำสั่งซื้อ'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                {language === 'en' ? 'Logout' : 'ออกจากระบบ'}
              </button>
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
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder={language === 'en' ? 'e.g. VIP101' : 'เช่น VIP101'}
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
                      className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl mb-4"
                    >
                      {language === 'en' ? 'Start Scanning' : 'เริ่มแสกน'}
                    </button>
                    <br />
                    <button
                      onClick={() => setShowManualEntry(true)}
                      className="text-slate-600 hover:text-slate-900 font-medium text-sm"
                    >
                      {language === 'en' ? 'Or enter member code' : 'หรือกรอกรหัสสมาชิก'}
                    </button>
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
                        <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <Award className="w-4 h-4 text-amber-600" />
                          <span className="text-amber-600 font-semibold">{customer.loyalty_points} pts total</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => { setCustomer(null); setOrders([]); setError(null); }}
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

                {/* Today's Orders */}
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
                          {/* Order Header */}
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

                          {/* Loyalty Points Earned */}
                          {(order.loyalty_points_earned ?? 0) > 0 && (
                            <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
                              <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              <span className="text-sm text-amber-700 font-medium">
                                {language === 'en' ? 'Loyalty earned this order:' : 'แต้มสะสมคำสั่งนี้:'}&nbsp;
                                <strong>+{order.loyalty_points_earned} pts</strong>
                              </span>
                            </div>
                          )}

                          {/* Payment Controls */}
                          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                            {/* Paid Toggle */}
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

                            {/* Payment Method Checkboxes */}
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
                                  {order.payment_method === 'qr_code' && (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
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
                                  {order.payment_method === 'cash' && (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Mark as Picked Up */}
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
              </>
            )}
          </div>
        </div>
      </div>

      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} language={language as 'en' | 'th'} />}
    </div>
  );
}
