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
type OrderTypeFilter = 'all' | 'pickup' | 'walk_in';
type StatusFilter = 'all' | 'active' | 'picked_up' | 'completed' | 'cancelled';

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
  loyalty_discount_amount?: number | null;
  amount_paid?: number | null;
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

const ACTIVE_STATUSES = new Set(['pending', 'confirmed', 'ready']);

const money = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
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
  const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: orderError } = await supabase
        .from('orders')
        .select(
          'id, order_number, order_items, total_amount, loyalty_discount_amount, amount_paid, pickup_date, pickup_location_id, status, payment_status, payment_method, created_at, loyalty_points_earned, purchase_type, walk_in_amount, picked_up_at, staff_id'
        )
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (orderError) throw orderError;

      const historyRows = (data || []) as HistoryOrder[];
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
          console.warn('Could not enrich order history with pickup locations:', locationError);
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
          console.warn('Could not enrich order history with staff names:', staffError);
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
      console.error('Error loading customer order history:', err);
      setOrders([]);
      setLocations({});
      setStaffNames({});
      setError(language === 'en'
        ? 'Order history is temporarily unavailable.'
        : 'ไม่สามารถโหลดประวัติคำสั่งซื้อได้ชั่วคราว');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setExpandedOrderId(null);
    setTypeFilter('all');
    setStatusFilter('all');
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, language, refreshKey]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const isWalkIn = order.purchase_type === 'walk_in';
    const typeMatches = typeFilter === 'all'
      || (typeFilter === 'walk_in' && isWalkIn)
      || (typeFilter === 'pickup' && !isWalkIn);

    const statusMatches = statusFilter === 'all'
      || (statusFilter === 'active' && ACTIVE_STATUSES.has(order.status))
      || (statusFilter === 'picked_up' && order.status === 'picked_up')
      || (statusFilter === 'completed' && order.status === 'completed')
      || (statusFilter === 'cancelled' && order.status === 'cancelled');

    return typeMatches && statusMatches;
  }), [orders, typeFilter, statusFilter]);

  const filteredPickupCount = filteredOrders.filter((order) => order.purchase_type !== 'walk_in').length;
  const filteredWalkInCount = filteredOrders.length - filteredPickupCount;
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
      picked_up: ['Picked Up', 'รับแล้ว'],
      completed: ['Completed', 'เสร็จสิ้น'],
      cancelled: ['Cancelled', 'ยกเลิก'],
    };
    const label = labels[status];
    return label ? label[language === 'th' ? 1 : 0] : status;
  };

  const statusClass = (status: string) => {
    if (status === 'cancelled') return 'bg-red-100 text-red-700';
    if (status === 'picked_up') return 'bg-blue-100 text-blue-700';
    if (status === 'completed') return 'bg-green-100 text-green-700';
    return 'bg-amber-100 text-amber-700';
  };

  const itemName = (item: OrderItem) => {
    if (language === 'th') {
      return item.product_name_th || item.name_th || item.product_name || item.product_name_en || item.name || '—';
    }
    return item.product_name || item.product_name_en || item.name || item.product_name_th || item.name_th || '—';
  };

  const orderGrossAmount = (order: HistoryOrder) => (
    order.purchase_type === 'walk_in' ? order.walk_in_amount ?? order.total_amount : order.total_amount
  );

  const orderDiscountAmount = (order: HistoryOrder) => Math.max(0, Number(order.loyalty_discount_amount || 0));

  const orderPaidAmount = (order: HistoryOrder) => {
    if (order.amount_paid !== null && order.amount_paid !== undefined && Number.isFinite(Number(order.amount_paid))) {
      return Number(order.amount_paid);
    }
    return Math.max(0, Number(orderGrossAmount(order) || 0) - orderDiscountAmount(order));
  };

  const recordPayment = async (order: HistoryOrder, method: 'qr_code' | 'cash') => {
    if (order.status === 'cancelled') return;

    try {
      setUpdatingPaymentId(order.id);
      setPaymentErrorId(null);
      const { data, error: updateError } = await supabase.rpc('staff_repair_completed_order_payment_method_v2', {
        p_order_id: order.id,
        p_payment_method: method,
      });
      if (updateError) throw updateError;
      if (!data || typeof data.id !== 'string' || !['cash', 'qr_code', 'qr'].includes(data.payment_method)) {
        throw new Error('Payment method repair returned an invalid response.');
      }
      const returnedOrder = data as HistoryOrder;
      setOrders((current) => current.map((item) => (
        item.id === order.id ? returnedOrder : item
      )));
    } catch (err) {
      console.error('Error recording history payment:', err);
      setPaymentErrorId(order.id);
    } finally {
      setUpdatingPaymentId(null);
    }
  };

  const printReceipt = (order: HistoryOrder) => {
    if (order.status === 'cancelled') return;

    try {
      printOrderReceipt({ order, customerName, language });
    } catch (err) {
      console.error('Could not open receipt print window:', err);
      setPaymentErrorId(order.id);
    }
  };

  const typeOptions: Array<{ value: OrderTypeFilter; en: string; th: string }> = [
    { value: 'all', en: 'All', th: 'ทั้งหมด' },
    { value: 'pickup', en: 'Pick-Up', th: 'รับสินค้า' },
    { value: 'walk_in', en: 'Walk-In', th: 'หน้าร้าน' },
  ];

  const statusOptions: Array<{ value: StatusFilter; en: string; th: string }> = [
    { value: 'all', en: 'All', th: 'ทั้งหมด' },
    { value: 'active', en: 'Active', th: 'กำลังดำเนินการ' },
    { value: 'picked_up', en: 'Picked Up', th: 'รับแล้ว' },
    { value: 'completed', en: 'Completed', th: 'เสร็จสิ้น' },
    { value: 'cancelled', en: 'Cancelled', th: 'ยกเลิก' },
  ];

  return (
    <div className="mt-8 pt-6 border-t border-gray-200">
      <button
        type="button"
        onClick={() => setShowHistory((value) => !value)}
        className="w-full flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 transition-colors"
        aria-expanded={showHistory}
      >
        <div>
          <p className="font-bold text-gray-900">{language === 'en' ? 'Order History' : 'ประวัติคำสั่งซื้อ'}</p>
          <p className="text-sm text-gray-500">
            {loading
              ? (language === 'en' ? 'Loading history…' : 'กำลังโหลดประวัติ…')
              : `${orders.length} ${language === 'en' ? 'orders' : 'คำสั่งซื้อ'}`}
          </p>
        </div>
        {showHistory ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <ChevronDown className="w-5 h-5 text-slate-600" />}
      </button>

      {showHistory && (
        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{language === 'en' ? 'Loading order history…' : 'กำลังโหลดประวัติคำสั่งซื้อ…'}</span>
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
              <p className="text-gray-500">{language === 'en' ? 'No orders recorded' : 'ยังไม่มีคำสั่งซื้อ'}</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                <FilterRow
                  label={language === 'en' ? 'Type' : 'ประเภท'}
                  options={typeOptions}
                  value={typeFilter}
                  language={language}
                  onChange={(value) => {
                    setTypeFilter(value as OrderTypeFilter);
                    setExpandedOrderId(null);
                  }}
                />
                <FilterRow
                  label={language === 'en' ? 'Status' : 'สถานะ'}
                  options={statusOptions}
                  value={statusFilter}
                  language={language}
                  onChange={(value) => {
                    setStatusFilter(value as StatusFilter);
                    setExpandedOrderId(null);
                  }}
                />
                <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-full bg-white px-2.5 py-1 border border-slate-200">
                    {language === 'en' ? 'Showing' : 'แสดง'}: {filteredOrders.length}
                  </span>
                  {filteredPickupCount > 0 && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">Pick-Up: {filteredPickupCount}</span>
                  )}
                  {filteredWalkInCount > 0 && (
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700">Walk-In: {filteredWalkInCount}</span>
                  )}
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-xl">
                  <Package className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-gray-500">
                    {language === 'en' ? 'No orders match these filters.' : 'ไม่มีคำสั่งซื้อที่ตรงกับตัวกรองนี้'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map((order) => {
                    const expanded = expandedOrderId === order.id;
                    const isWalkIn = order.purchase_type === 'walk_in';
                    const isCancelled = order.status === 'cancelled';
                    const location = order.pickup_location_id ? locations[order.pickup_location_id] : undefined;
                    const handledBy = order.staff_id ? staffNames[order.staff_id] : undefined;
                    const items = Array.isArray(order.order_items) ? order.order_items : [];
                    const paymentComplete = order.payment_status === 'paid'
                      && ['cash', 'qr_code', 'qr'].includes(order.payment_method ?? '');

                    return (
                      <div key={order.id} className={`rounded-xl border bg-white shadow-sm overflow-hidden ${isCancelled ? 'border-red-200' : 'border-slate-200'}`}>
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
                                <span>{isWalkIn ? 'Walk-In' : 'Pick-Up'}</span>
                              </div>
                              <p className="mt-1 font-bold text-gray-900">#{order.order_number}</p>
                              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                                <Calendar className="w-4 h-4" />
                                <span>{formatDateTime(order.created_at)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-lg font-bold text-slate-800">฿{money(orderPaidAmount(order))}</p>
                                {orderDiscountAmount(order) > 0 && (
                                  <p className="text-xs font-medium text-amber-700">
                                    {language === 'en' ? 'Gross' : 'ก่อนส่วนลด'} ฿{money(orderGrossAmount(order))}
                                  </p>
                                )}
                              </div>
                              {expanded ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                              {isWalkIn ? 'Walk-In' : 'Pick-Up'}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 ${statusClass(order.status)}`}>
                              {statusLabel(order.status)}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 ${order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {order.payment_status === 'paid' ? (language === 'en' ? 'Paid' : 'ชำระแล้ว') : (language === 'en' ? 'Unpaid' : 'ยังไม่ชำระ')}
                            </span>
                            {!isCancelled && (order.loyalty_points_earned ?? 0) > 0 && (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">+{order.loyalty_points_earned} pts</span>
                            )}
                            {isCancelled && (order.loyalty_points_earned ?? 0) > 0 && (
                              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
                                {language === 'en' ? 'Points reversed' : 'คืนแต้มแล้ว'}
                              </span>
                            )}
                          </div>
                        </button>

                        {expanded && (
                          <div className="border-t border-slate-200 bg-slate-50/70 p-4 space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Detail label={language === 'en' ? 'Payment' : 'การชำระเงิน'}>
                                {order.payment_status === 'paid' ? (language === 'en' ? 'Paid' : 'ชำระแล้ว') : (language === 'en' ? 'Unpaid' : 'ยังไม่ชำระ')} · {paymentMethod(order.payment_method)}
                              </Detail>
                              <Detail label={language === 'en' ? 'Status' : 'สถานะ'}>{statusLabel(order.status)}</Detail>
                              <Detail label={language === 'en' ? 'Loyalty points' : 'แต้มสะสม'} icon={<Award className="w-3.5 h-3.5" />}>
                                {isCancelled
                                  ? `${language === 'en' ? 'Reversed' : 'คืนแล้ว'} (${order.loyalty_points_earned ?? 0} pts)`
                                  : `+${order.loyalty_points_earned ?? 0} pts`}
                              </Detail>
                              <Detail label={language === 'en' ? 'Handled by' : 'ผู้ดำเนินการ'} icon={<UserRoundCheck className="w-3.5 h-3.5" />}>
                                {handledBy || notRecorded}
                              </Detail>
                            </div>

                            {!isWalkIn && (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Detail label={language === 'en' ? 'Scheduled pick-up' : 'วันที่รับสินค้าที่กำหนด'} icon={<Calendar className="w-3.5 h-3.5" />}>
                                  {formatPickupDate(order.pickup_date)}
                                </Detail>
                                <Detail label={language === 'en' ? 'Pick-up location' : 'สถานที่รับสินค้า'} icon={<MapPin className="w-3.5 h-3.5" />}>
                                  {location ? (language === 'th' ? location.name_th || location.name_en : location.name_en) : notRecorded}
                                </Detail>
                              </div>
                            )}

                            {order.picked_up_at && (
                              <Detail label={language === 'en' ? 'Actually picked up' : 'เวลารับสินค้าจริง'} icon={<Clock className="w-3.5 h-3.5" />}>
                                {formatDateTime(order.picked_up_at)}
                              </Detail>
                            )}

                            {!isCancelled && order.payment_status === 'paid' && !paymentComplete && ['picked_up', 'completed'].includes(order.status) && (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <p className="text-sm font-bold text-amber-900">
                                  {language === 'en' ? 'Complete payment record' : 'บันทึกการชำระเงินให้สมบูรณ์'}
                                </p>
                                <p className="mt-1 text-xs text-amber-800">
                                  {language === 'en'
                                    ? 'This order was completed without a complete payment method. Select how payment was received.'
                                    : 'คำสั่งซื้อนี้ยังไม่มีวิธีการชำระเงินที่สมบูรณ์ กรุณาเลือกวิธีที่รับชำระ'}
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
                                    ? (language === 'en' ? 'Item details were not recorded for this Walk-In.' : 'ไม่ได้บันทึกรายการสินค้าสำหรับ Walk-In นี้')
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
                              <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
                                {orderDiscountAmount(order) > 0 && (
                                  <>
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-gray-600">{language === 'en' ? 'Gross total' : 'ยอดก่อนส่วนลด'}</span>
                                      <span className="text-sm font-semibold text-gray-800">฿{money(orderGrossAmount(order))}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-amber-700">
                                      <span className="text-sm">{language === 'en' ? 'Loyalty reward discount' : 'ส่วนลดรางวัลสะสมแต้ม'}</span>
                                      <span className="text-sm font-semibold">−฿{money(orderDiscountAmount(order))}</span>
                                    </div>
                                  </>
                                )}
                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-sm font-semibold text-gray-700">
                                    {order.payment_status === 'paid'
                                      ? (language === 'en' ? 'Total paid' : 'ยอดชำระจริง')
                                      : (language === 'en' ? 'Amount due' : 'ยอดที่ต้องชำระ')}
                                  </span>
                                  <span className="text-base font-bold text-gray-900">฿{money(orderPaidAmount(order))}</span>
                                </div>
                              </div>
                            </div>

                            {!isCancelled && paymentComplete && ['picked_up', 'completed'].includes(order.status) && (
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
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  options,
  value,
  language,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; en: string; th: string }>;
  value: string;
  language: StaffLanguage;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              value === option.value
                ? 'border-slate-700 bg-slate-700 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-500'
            }`}
          >
            {language === 'th' ? option.th : option.en}
          </button>
        ))}
      </div>
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
