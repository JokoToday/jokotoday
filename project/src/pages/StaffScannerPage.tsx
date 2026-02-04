import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { QRScanner } from '../components/QRScanner';
import { Camera, User, Phone, Mail, MessageCircle, Package, Award, Check, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { getPermissions } from '../lib/rolePermissions';

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
  customer_name: string;
  created_at: string;
}

export function StaffScannerPage() {
  const { language } = useLanguage();
  const { userRole } = useAuth();
  const permissions = userRole ? getPermissions(userRole) : null;
  const [showScanner, setShowScanner] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [addingPoints, setAddingPoints] = useState(false);

  const handleScan = async (decodedText: string) => {
    try {
      setLoading(true);
      setError(null);
      setCustomer(null);
      setOrders([]);

      const qrToken = decodedText.includes('/c/')
        ? decodedText.split('/c/')[1]
        : decodedText;

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('qr_token', qrToken)
        .maybeSingle();

      if (customerError) throw customerError;

      if (!customerData) {
        setError(language === 'en' ? 'Customer not found' : 'ไม่พบลูกค้า');
        return;
      }

      setCustomer(customerData);

      const today = new Date().toISOString().split('T')[0];
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerData.id)
        .eq('pickup_date', today)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      setOrders(ordersData || []);
    } catch (err) {
      console.error('Error loading customer:', err);
      setError(err instanceof Error ? err.message : 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (orderId: string) => {
    try {
      setUpdatingOrder(orderId);
      const { error } = await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', orderId);

      if (error) throw error;

      setOrders(orders.map(order =>
        order.id === orderId
          ? { ...order, payment_status: 'paid' }
          : order
      ));

      alert(language === 'en' ? 'Payment marked as received.' : 'บันทึกการชำระเงินแล้ว');
    } catch (err) {
      console.error('Error updating order:', err);
      alert(language === 'en' ? 'Failed to update order' : 'เกิดข้อผิดพลาด');
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

      setOrders(orders.map(order =>
        order.id === orderId
          ? { ...order, status: 'picked_up' }
          : order
      ));

      alert(language === 'en' ? 'Order marked as picked up.' : 'บันทึกรับสินค้าแล้ว');
    } catch (err) {
      console.error('Error updating order:', err);
      alert(language === 'en' ? 'Failed to update order' : 'เกิดข้อผิดพลาด');
    } finally {
      setUpdatingOrder(null);
    }
  };

  const handleAddPoints = async () => {
    if (!customer) return;

    const points = prompt('Enter points to add:', '10');
    if (!points) return;

    const pointsToAdd = parseInt(points, 10);
    if (isNaN(pointsToAdd) || pointsToAdd <= 0) {
      alert('Invalid points value');
      return;
    }

    try {
      setAddingPoints(true);
      const newPoints = customer.loyalty_points + pointsToAdd;

      const { error } = await supabase
        .from('customers')
        .update({ loyalty_points: newPoints })
        .eq('id', customer.id);

      if (error) throw error;

      setCustomer({ ...customer, loyalty_points: newPoints });
      alert(`Successfully added ${pointsToAdd} points!`);
    } catch (err) {
      console.error('Error adding points:', err);
      alert('Failed to add points');
    } finally {
      setAddingPoints(false);
    }
  };

  const getContactMethod = () => {
    if (!customer) return null;

    if (customer.line_id) return { type: 'LINE', value: customer.line_id };
    if (customer.whatsapp) return { type: 'WhatsApp', value: customer.whatsapp };
    if (customer.wechat_id) return { type: 'WeChat', value: customer.wechat_id };
    return null;
  };

  if (!permissions?.canAccessScanner) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {language === 'en' ? 'Access Denied' : 'ไม่มีสิทธิ์เข้าถึง'}
          </h1>
          <p className="text-gray-600 mb-6">
            {language === 'en'
              ? 'You do not have permission to access this page.'
              : 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-8 py-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              {language === 'en' ? 'Staff Scanner' : 'แสกน QR ลูกค้า'}
            </h1>
            <p className="text-slate-300">
              {language === 'en' ? 'Scan customer QR codes to manage orders' : 'สแกน QR โค้ดลูกค้าเพื่อจัดการคำสั่งซื้อ'}
            </p>
          </div>

          <div className="p-8">
            {!customer ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Camera className="w-10 h-10 text-slate-600" />
                </div>
                <button
                  onClick={() => setShowScanner(true)}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl"
                >
                  {language === 'en' ? 'Start Scanning' : 'เริ่มแสกน'}
                </button>
                {error && (
                  <p className="mt-4 text-red-600 font-medium">{error}</p>
                )}
              </div>
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
                          <span className="text-amber-600 font-semibold">{customer.loyalty_points} points</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setCustomer(null);
                        setOrders([]);
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
                        <p className="text-sm font-medium text-gray-900">{customer.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
                      <Mail className="w-5 h-5 text-slate-600" />
                      <div>
                        <p className="text-xs text-gray-500">{language === 'en' ? 'Email' : 'อีเมล'}</p>
                        <p className="text-sm font-medium text-gray-900">{customer.email}</p>
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

                  <button
                    onClick={handleAddPoints}
                    disabled={addingPoints}
                    className="mt-4 w-full bg-amber-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {addingPoints ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Award className="w-5 h-5" />
                    )}
                    {language === 'en' ? 'Add Loyalty Points' : 'เพิ่มแต้มสะสม'}
                  </button>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-slate-600" />
                    {language === 'en' ? "Today's Orders" : 'คำสั่งซื้อวันนี้'} ({orders.length})
                  </h3>

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
                        <div key={order.id} className="border border-gray-200 rounded-xl p-4 bg-white">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <p className="font-bold text-gray-900 text-lg">#{order.order_number}</p>
                              <p className="text-sm text-gray-600">{order.order_items.length} items • ฿{order.total_amount.toFixed(2)}</p>
                            </div>
                            <div className="flex gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                order.payment_status === 'paid'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {order.payment_status === 'paid'
                                  ? (language === 'en' ? 'Paid' : 'ชำระแล้ว')
                                  : (language === 'en' ? 'Unpaid' : 'ยังไม่ชำระ')}
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                order.status === 'picked_up'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {order.status === 'picked_up'
                                  ? (language === 'en' ? 'Picked Up' : 'รับแล้ว')
                                  : (language === 'en' ? order.status : 'รอรับ')}
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-4">
                            {order.payment_status !== 'paid' && (
                              <button
                                onClick={() => handleMarkAsPaid(order.id)}
                                disabled={updatingOrder === order.id}
                                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {updatingOrder === order.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                                {language === 'en' ? 'Mark as Paid' : 'บันทึกการชำระ'}
                              </button>
                            )}
                            {order.status !== 'picked_up' && (
                              <button
                                onClick={() => handleMarkAsPickedUp(order.id)}
                                disabled={updatingOrder === order.id}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
