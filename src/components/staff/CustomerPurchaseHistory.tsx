import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  Banknote,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  MapPin,
  Package,
  Printer,
  QrCode,
  Store,
  UserRoundCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { printOrderReceipt } from '../../lib/printReceipt';

type StaffLanguage = 'en' | 'th';

type OrderItem = {
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

type HistoryOrder = {
  id: string;
  order_number: string;
  order_items: OrderItem[] | null;
  total_amount: number;
  pickup_date: string | null;
  pickup_location_id: string | null;
  status: string;
  payment_status: string;
  payment_method: string | null;
  created_at: string;
  loyalty_points_earned: number | null;
  purchase_type?: 'online' | 'walk_in' | null;
  walk_in_amount?: number | null;
  picked_up_at?: string | null;
  staff_id?: string | null;
};

type PickupLocation = { id: string; name_en: string; name_th: string };
type StaffProfile = { id: string; name: string | null };

type Props = {
  customerId: string;
  customerName?: string | null;
  language: StaffLanguage;
  refreshKey?: number;
};

const money = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
};

const getBangkokToday = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export function CustomerPurchaseHistory({ customerId, customerName, language, refreshKey = 0 }: Props) {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [locations, setLocations] = useState<Record<string, PickupLocation>>({});
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingPaymentId, setUpdatingPaymentId] = useState<string | null>(null);
  const [paymentErrorId, setPaymentErrorId] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const today = getBangkokToday();
      const { data, error: orderError } = await supabase
        .from('orders')
        .select(
          'id, order_number, order_items, total_amount, pickup_date, pickup_location_id, status, payment_status, payment_method, created_at, loyalty_points_earned, purchase_type, walk_in_amount, picked_up_at, staff_id'
        )
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (orderError) throw orderError;

      const historyRows = ((data || []) as HistoryOrder[]).filter((order) => (
        order.purchase_type === 'walk_in'
        || Boolean(order.picked_up_at)
        || ['picked_up', 'completed'].includes(order.status)
        || Boolean(order.pickup_date && order.pickup_date < today)
      ));
      setOrders(historyRows);

      const locationIds = Array.from(new Set(
        historyRows.map((order) => order.pickup_location_id).filter(Boolean) as string[]
      ));
      if (locationIds.length) {
        const { data: locationRows, error: locationError } = await supabase
          .from('cms_pickup_locations')
          .select('id, name_en, name_th')
          .in('id', locationIds);
        if (locationError) {
          console.warn('Could not enrich purchase history with pickup locations:', locationError);
          setLocations({});
        } else {
          setLocations(((locationRows || []) as PickupLocation[]).reduce<Record<string, PickupLocation>>((map, row) => {
            map[row.id] = row;
            return map;
          }, {}));
        }
      } else {
        setLocations({});
      }

      const staffIds = Array.from(new Set(
        historyRows.map((order) => order.staff_id).filter(Boolean) as string[]
      ));
      if (staffIds.length) {
        const { data: staffRows, error: staffError } = await supabase
          .from('user_profiles')
          .select('id, name')
          .in('id', staffIds);
        if (staffError) {
          console.warn('Could not enrich purchase history with staff names:', staffError);
          setStaffNames({});
        } else {
          setStaffNames(((staffRows || []) as StaffProfile[]).reduce<Record<string, string>>((map, row) => {
            if (row.name) map[row.id] = row.name;
            return map;
          }, {}));
        }
      } else {
        setStaffNames({});
      }
    } catch (err) {
      console.error('Error loading customer purchase history:', err);
      setOrders([]);
      setLocations({});
      setStaffNames({});
      setError(language === 'en'
        ? 'Purchase history is temporarily unavailable.'
        : 'ไม่สามารถโหลดประวัติการซื้อได้ชั่วคราว');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setExpandedOrderId(null);
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, language, refreshKey]);

  const pickupCount = useMemo(
    () => orders.filter((order) => order.purchase_type !== 'walk_in').length,
    [orders]
  );
  const walkInCount = orders.length - pickupCount;
  const notRecorded = language === 'en' ? 'Not recorded' : 'ไม่ได้บันทึก';

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return notRecorded;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(language === 'th' ? 'th-TH' : 'en-GB', {
      timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const formatPickupDate = (value: string | null | undefined) => {
    if (!value) return notRecorded;
    const date = new Date(`${value}T00:00:00+07:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', {
      timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const paymentMethod = (method: string | null) => {
    if (method === 'cash') return language === 'en' ? 'Cash' : 'เงินสด';
    if (method === 'qr_code' || method === 'qr') return language === 'en' ? 'QR' : 'คิวอาร์';
    return notRecorded;
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, [string, string]> = {
      pending: ['Pending', 'รอดำเนินการ'],
      confirmed: ['Confirmed', 'ยืนยันแล้ว'],
      ready: ['Ready', 'พร้อมรับ'],
      picked_up: ['Picked up', 'รับแล้ว'],
      completed: ['Completed', 'เสร็จสิ้น'],
      cancelled: ['Cancelled', 'ยกเลิก'],
    };
    const label = labels[status];
    return label ? label[language === 'th' ? 1 : 0] : status;
  };

  const itemName = (item: OrderItem) => {
    if (language === 'th') {
      return item.product_name_th || item.name_th || item.product_name || item.product_name_en || item.name || '—';
    }
    return item.product_name || item.product_name_en || item.name || item.product_name_th || item.name_th || '—';
  };

  const orderAmount = (order: HistoryOrder) => (
    order.purchase_type === 'walk_in' ? order.walk_in_amount ?? order.total_amount : order.total_amount
  );

  const recordPayment = async (order: HistoryOrder, method: 'qr_code' | 'cash') => {
    try {
      setUpdatingPaymentId(order.id);
      setPaymentErrorId(null);
      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_method: method, payment_status: 'paid' })
        .eq('id', order.id);
      if (updateError) throw updateError;
      setOrders((current) => current.map((item) => (
        item.id === order.id ? { ...item, payment_method: method, payment_status: 'paid' } : item
      )));
    } catch (err) {
      console.error('Error recording history payment:', err);
      setPaymentErrorId(order.id);
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const printReceipt = (order: HistoryOrder) => {
    try {
      printOrderReceipt({ order, customerName, language });
    } catch (err) {
      console.error('Could not open receipt print window:', err);
      setPaymentErrorId(order.id);
    }
  };

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <button
        type="button"
        onClick={() => setShowHistory((value) => !value)}
        className="w-full flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 transition-colors"
        aria-expanded={showHistory}
      >
        <div>
          <p className="font-bold text-gray-900">{language === 'en' ? 'Purchase History' : 'ประวัติการซื้อ'}</p>
          <p className="text-sm text-gray-500">
            {loading
              ? (language === 'en' ? 'Loading history…' : 'กำลังโหลดประวัติ…')
              : `${orders.length} ${language === 'en' ? 'previous transactions' : 'รายการก่อนหน้า'}`}
          </p>
        </div>
        {showHistory ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
      </button>

      {showHistory && (
        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{language === 'en' ? 'Loading purchase history…' : 'กำลังโหลดประวัติการซื้อ…'}</span>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
              <button type="button" onClick={() => void loadHistory()} className="mt-3 text-sm font-semibold text-red-700 underline underline-offset-2">
                {language === 'en' ? 'Try again' : 'ลองอีกครั้ง'}
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl">
              <Package className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-gray-500">{language === 'en' ? 'No previous purchases recorded' : 'ยังไม่มีประวัติการซื้อ'}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                {pickupCount > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1">{language === 'en' ? 'Pickup' : 'รับสินค้า'}: {pickupCount}</span>}
                {walkInCount > 0 && <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700">Walk-In: {walkInCount}</span>}
              </div>

              <div className="space-y-3">
                {orders.map((order) => {
                  const expanded = expandedOrderId === order.id;
                  const isWalkIn = order.purchase_type === 'walk_in';
                  const location = order.pickup_location_id ? locations[order.pickup_location_id] : undefined;
                  const handledBy = order.staff_id ? staffNames[order.staff_id] : undefined;
                  const items = Array.isArray(order.order_items) ? order.order_items : [];
                  const paymentComplete = order.payment_status === 'paid' && Boolean(order.payment_method);

                  return (
                    <div key={order.id} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                        className="w-full p-4 text-left hover:bg-slate-50 transition-colors"
                        aria-expanded={expanded}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              {isWalkIn ? <Store className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                              <span>{isWalkIn ? 'Walk-In' : (language === 'en' ? 'Pickup order' : 'คำสั่งรับสินค้า')}</span>
                            </div>
                            <p className="mt-1 font-bold text-gray-900">#{order.order_number}</p>
                            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                              <Calendar className="w-4 h-4" />
                              <span>{formatDateTime(order.created_at)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-lg font-bold text-slate-800">฿{money(orderAmount(order))}</p>
                            {expanded ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className={`rounded-full px-2.5 py-1 ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {order.payment_status === 'paid' ? (language === 'en' ? 'Paid' : 'ชำระแล้ว') : (language === 'en' ? 'Unpaid' : 'ยังไม่ชำระ')}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{paymentMethod(order.payment_method)}</span>
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">{statusLabel(order.status)}</span>
                          {(order.loyalty_points_earned ?? 0) > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">+{order.loyalty_points_earned} pts</span>}
                        </div>
                      </button>

                      {expanded && (
                        <div className="border-t border-slate-200 bg-slate-50/70 p-4 space-y-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Detail label={language === 'en' ? 'Payment' : 'การชำระเงิน'}>
                              {order.payment_status === 'paid' ? (language === 'en' ? 'Paid' : 'ชำระแล้ว') : (language === 'en' ? 'Unpaid' : 'ยังไม่ชำระ')} · {paymentMethod(order.payment_method)}
                            </Detail>
                            <Detail label={language === 'en' ? 'Status' : 'สถานะ'}>{statusLabel(order.status)}</Detail>
                            <Detail label={language === 'en' ? 'Loyalty points earned' : 'แต้มสะสมที่ได้รับ'} icon={<Award className="w-3.5 h-3.5" />}>
                              +{order.loyalty_points_earned ?? 0} pts
                            </Detail>
                            <Detail label={language === 'en' ? 'Handled by' : 'ผู้ดำเนินการ'} icon={<UserRoundCheck className="w-3.5 h-3.5" />}>
                              {handledBy || notRecorded}
                            </Detail>
                          </div>

                          {!isWalkIn && (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Detail label={language === 'en' ? 'Scheduled pickup' : 'วันที่รับสินค้าที่กำหนด'} icon={<Calendar className="w-3.5 h-3.5" />}>
                                {formatPickupDate(order.pickup_date)}
                              </Detail>
                              <Detail label={language === 'en' ? 'Pickup location' : 'สถานที่รับสินค้า'} icon={<MapPin className="w-3.5 h-3.5" />}>
                                {location ? (language === 'th' ? location.name_th || location.name_en : location.name_en) : notRecorded}
                              </Detail>
                            </div>
                          )}

                          {order.picked_up_at && (
                            <Detail label={language === 'en' ? 'Actually picked up' : 'เวลารับสินค้าจริง'} icon={<Clock className="w-3.5 h-3.5" />}>
                              {formatDateTime(order.picked_up_at)}
                            </Detail>
                          )}

                          {!paymentComplete && ['picked_up', 'completed'].includes(order.status) && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                              <p className="text-sm font-bold text-amber-900">
                                {language === 'en' ? 'Complete payment record' : 'บันทึกการชำระเงินให้สมบูรณ์'}
                              </p>
                              <p className="mt-1 text-xs text-amber-800">
                                {language === 'en'
                                  ? 'This pickup was recorded without a complete payment method. Select how payment was received.'
                                  : 'รายการรับสินค้านี้ยังไม่มีวิธีการชำระเงินที่สมบูรณ์ กรุณาเลือกวิธีที่รับชำระ'}
                              </p>
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void recordPayment(order, 'qr_code')}
                                  disabled={updatingPaymentId === order.id}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  {updatingPaymentId === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                                  {language === 'en' ? 'QR received' : 'รับชำระ QR'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void recordPayment(order, 'cash')}
                                  disabled={updatingPaymentId === order.id}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                                >
                                  <Banknote className="w-4 h-4" />
                                  {language === 'en' ? 'Cash received' : 'รับเงินสด'}
                                </button>
                              </div>
                              {paymentErrorId === order.id && (
                                <p className="mt-2 text-xs font-semibold text-red-700">
                                  {language === 'en' ? 'Could not update the payment record.' : 'ไม่สามารถอัปเดตข้อมูลการชำระเงินได้'}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="rounded-lg bg-white p-3 border border-slate-100">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{language === 'en' ? 'Items' : 'รายการสินค้า'}</p>
                            {items.length === 0 ? (
                              <p className="text-sm text-slate-500">
                                {isWalkIn
                                  ? (language === 'en' ? 'Item details were not recorded for this walk-in purchase.' : 'รายการสินค้าไม่ได้ถูกบันทึกสำหรับการซื้อ Walk-In นี้')
                                  : (language === 'en' ? 'Item details not recorded.' : 'ไม่ได้บันทึกรายการสินค้า')}
                              </p>
                            ) : (
                              <div className="divide-y divide-slate-100">
                                {items.map((item, index) => {
                                  const quantity = Number(item.quantity ?? item.qty ?? 0);
                                  const price = Number(item.price_at_order ?? item.price ?? 0);
                                  return (
                                    <div key={`${order.id}-${index}`} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">{itemName(item)}</p>
                                        <p className="text-xs text-slate-500">{quantity} × ฿{money(price)}</p>
                                      </div>
                                      <p className="text-sm font-semibold text-gray-800">฿{money(quantity * price)}</p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                              <span className="text-sm font-semibold text-gray-700">{language === 'en' ? 'Total' : 'รวม'}</span>
                              <span className="text-base font-bold text-gray-900">฿{money(orderAmount(order))}</span>
                            </div>
                          </div>

                          {paymentComplete && ['picked_up', 'completed'].includes(order.status) && (
                            <button
                              type="button"
                              onClick={() => printReceipt(order)}
                              className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-slate-700 bg-white px-4 py-2.5 font-semibold text-slate-800 hover:bg-slate-700 hover:text-white transition-colors"
                            >
                              <Printer className="w-4 h-4" />
                              {language === 'en' ? 'Print Order Receipt' : 'พิมพ์ใบเสร็จรับเงิน'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white p-3 border border-slate-100">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1">
        {icon}{label}
      </p>
      <p className="mt-1 text-sm font-medium text-gray-800">{children}</p>
    </div>
  );
}
