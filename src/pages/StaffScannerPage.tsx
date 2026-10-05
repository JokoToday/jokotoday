import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  History,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Package,
  Phone,
  QrCode,
  Search,
  ShoppingBag,
  Star,
  Store,
  Upload,
  UserCircle,
} from 'lucide-react';
import jsQR from 'jsqr';
import { QRScanner } from '../components/QRScanner';
import { CustomerPurchaseHistory } from '../components/staff/CustomerPurchaseHistory';
import { useAuth } from '../context/AuthContext';
import { InternalSignedInAccount } from '../components/InternalSignedInAccount';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import {
  CustomerRecord,
  CustomerLookupNetworkError,
  CustomerLookupServiceError,
  InvalidCustomerCodeError,
  lookupCustomerByQRToken,
} from '../lib/customerLookup';

type StaffLanguage = 'en' | 'th';

type OrderSummaryRow = {
  total_amount: number;
  loyalty_discount_amount?: number | null;
  amount_paid?: number | null;
  pickup_date: string | null;
  status: string;
  purchase_type?: 'online' | 'walk_in' | null;
  created_at: string;
};

type CustomerStats = {
  purchaseCount: number;
  pickupCount: number;
  walkInCount: number;
  activeOrders: number;
  lifetimeSpend: number;
  lastPurchaseAt: string | null;
  nextPickupDate: string | null;
};

const EMPTY_STATS: CustomerStats = {
  purchaseCount: 0,
  pickupCount: 0,
  walkInCount: 0,
  activeOrders: 0,
  lifetimeSpend: 0,
  lastPurchaseAt: null,
  nextPickupDate: null,
};

const ACTIVE_ORDER_STATUSES = new Set(['pending', 'confirmed', 'ready']);

function bangkokToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatDate(value: string | null, language: StaffLanguage): string {
  if (!value) return '—';
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(language === 'th' ? 'th-TH' : 'en-GB', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function orderPaidAmount(order: OrderSummaryRow): number {
  if (order.amount_paid !== null && order.amount_paid !== undefined && Number.isFinite(Number(order.amount_paid))) {
    return Number(order.amount_paid);
  }
  return Math.max(0, Number(order.total_amount || 0) - Number(order.loyalty_discount_amount || 0));
}

export function StaffScannerPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user, userRole, profileLoading } = useAuth();
  const { language, setLanguage } = useLanguage();
  const staffLanguage: StaffLanguage = language === 'th' ? 'th' : 'en';
  const hasStaffAccess = Boolean(user) && (userRole === 'staff' || userRole === 'admin');

  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [stats, setStats] = useState<CustomerStats>(EMPTY_STATS);
  const [showScanner, setShowScanner] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const deepLinkHandledRef = useRef(false);

  const copy = staffLanguage === 'th'
    ? {
        title: 'Customer Desk',
        subtitle: 'ดูข้อมูลลูกค้า ประวัติการซื้อ และสถานะสมาชิก โดยไม่เปลี่ยนแปลงคำสั่งซื้อ',
        back: 'กลับ Admin',
        scan: 'สแกน QR',
        upload: 'อัปโหลด QR',
        clear: 'ลูกค้ารายอื่น',
        lookup: 'ค้นหา',
        placeholder: 'VIP101 หรือ QR token',
        notFound: 'ไม่พบลูกค้า กรุณาตรวจสอบ QR หรือรหัส VIP แล้วลองใหม่',
        invalid: 'รหัสสมาชิกหรือ QR ไม่ถูกต้อง',
        network: 'ไม่สามารถเชื่อมต่อระบบค้นหาลูกค้าได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง',
        loading: 'กำลังค้นหาลูกค้า…',
        points: 'แต้มสะสม',
        purchases: 'รายการซื้อ',
        spend: 'ยอดซื้อรวม',
        active: 'คำสั่งซื้อที่กำลังดำเนินการ',
        pickups: 'รับสินค้า',
        walkIns: 'หน้าร้าน',
        nextPickup: 'รับสินค้าครั้งถัดไป',
        lastPurchase: 'ซื้อครั้งล่าสุด',
        profile: 'ข้อมูลลูกค้า',
        email: 'อีเมล',
        phone: 'โทรศัพท์',
        line: 'LINE',
        whatsapp: 'WhatsApp',
        wechat: 'WeChat',
        operations: 'ทำรายการต่อ',
        operationsHint: 'Customer Desk เป็นหน้าดูข้อมูลเท่านั้น เลือกหน้าปฏิบัติงานเมื่อจำเป็นต้องทำรายการจริง',
        pickupDesk: 'ไป Pickup Desk',
        walkInDesk: 'เริ่ม Walk-In Purchase',
        readOnly: 'โหมดดูข้อมูลเท่านั้น — ไม่มีการยืนยันรับสินค้า การรับชำระ หรือการแก้ไขคำสั่งซื้อจากหน้านี้',
        unsupportedImage: 'กรุณาเลือกรูป PNG, JPEG หรือ WebP',
        noQr: 'ไม่พบ QR Code ในรูปภาพนี้',
        badImage: 'ไม่สามารถอ่านรูปภาพนี้ได้ กรุณาเลือกรูปอื่น',
        staffRequired: 'ต้องเข้าสู่ระบบด้วยบัญชี Staff หรือ Admin เพื่อใช้ Customer Desk',
      }
    : {
        title: 'Customer Desk',
        subtitle: 'Customer profile, purchase history and membership status — without changing orders.',
        back: 'Back to Admin',
        scan: 'Scan QR',
        upload: 'Upload QR',
        clear: 'Another customer',
        lookup: 'Lookup',
        placeholder: 'VIP101 or QR token',
        notFound: 'Customer not found. Check the member QR or VIP code and try again.',
        invalid: 'Invalid member code or QR code.',
        network: 'Unable to reach customer lookup. Check the connection and try again.',
        loading: 'Looking up customer…',
        points: 'Loyalty points',
        purchases: 'Purchases',
        spend: 'Lifetime spend',
        active: 'Active orders',
        pickups: 'Pick-Up',
        walkIns: 'Walk-In',
        nextPickup: 'Next pickup',
        lastPurchase: 'Last purchase',
        profile: 'Customer profile',
        email: 'Email',
        phone: 'Phone',
        line: 'LINE',
        whatsapp: 'WhatsApp',
        wechat: 'WeChat',
        operations: 'Continue in an operational desk',
        operationsHint: 'Customer Desk is read-only. Use an operational desk when you need to perform a transaction.',
        pickupDesk: 'Go to Pickup Desk',
        walkInDesk: 'Start Walk-In Purchase',
        readOnly: 'Read-only customer view — no pickup confirmation, payment recording or order mutation is available here.',
        unsupportedImage: 'Choose a PNG, JPEG, or WebP image.',
        noQr: 'No QR code was detected in this image.',
        badImage: 'Could not read this image. Please choose another.',
        staffRequired: 'Sign in with a staff or admin account before using Customer Desk.',
      };

  const loadStats = async (customerId: string) => {
    setStatsLoading(true);
    try {
      const { data, error: orderError } = await supabase
        .from('orders')
        .select('total_amount, loyalty_discount_amount, amount_paid, pickup_date, status, purchase_type, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (orderError) throw orderError;

      const rows = (data || []) as OrderSummaryRow[];
      const validOrders = rows.filter((order) => order.status !== 'cancelled');
      const today = bangkokToday();
      const activeRows = validOrders.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status));
      const nextPickupDate = activeRows
        .map((order) => order.pickup_date)
        .filter((value): value is string => Boolean(value && value >= today))
        .sort()[0] || null;

      setStats({
        purchaseCount: validOrders.length,
        pickupCount: validOrders.filter((order) => order.purchase_type !== 'walk_in').length,
        walkInCount: validOrders.filter((order) => order.purchase_type === 'walk_in').length,
        activeOrders: activeRows.length,
        lifetimeSpend: validOrders.reduce((sum, order) => sum + orderPaidAmount(order), 0),
        lastPurchaseAt: validOrders[0]?.created_at || null,
        nextPickupDate,
      });
    } catch (err) {
      console.warn('Customer Desk summary could not be loaded:', err);
      setStats(EMPTY_STATS);
    } finally {
      setStatsLoading(false);
    }
  };

  const lookupCustomer = async (rawCode: string) => {
    setLoading(true);
    setError('');
    setCustomer(null);
    setStats(EMPTY_STATS);

    try {
      const result = await lookupCustomerByQRToken(rawCode);
      if (!result) {
        setError(copy.notFound);
        return;
      }

      setCustomer(result);
      setManualCode('');
      setShowScanner(false);
      void loadStats(result.id);
    } catch (err) {
      console.error('Customer Desk lookup failed:', err);
      if (err instanceof InvalidCustomerCodeError) {
        setError(copy.invalid);
      } else if (err instanceof CustomerLookupNetworkError) {
        setError(copy.network);
      } else if (err instanceof CustomerLookupServiceError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : copy.notFound);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasStaffAccess || deepLinkHandledRef.current) return;
    const memberCode = new URLSearchParams(window.location.search).get('member');
    if (!memberCode) return;
    deepLinkHandledRef.current = true;
    void lookupCustomer(memberCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStaffAccess]);

  const handleManualSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!manualCode.trim() || loading) return;
    void lookupCustomer(manualCode);
  };

  const handleQrUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError(copy.unsupportedImage);
      return;
    }

    setLoading(true);
    setError('');
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas unavailable');
        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height);
        if (!decoded?.data) {
          setError(copy.noQr);
          return;
        }
        await lookupCustomer(decoded.data);
      } catch (err) {
        console.error('Customer Desk QR image lookup failed:', err);
        setError(err instanceof InvalidCustomerCodeError ? copy.invalid : copy.badImage);
      } finally {
        URL.revokeObjectURL(objectUrl);
        setLoading(false);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setLoading(false);
      setError(copy.badImage);
    };

    image.src = objectUrl;
  };

  const resetCustomer = () => {
    setCustomer(null);
    setStats(EMPTY_STATS);
    setManualCode('');
    setError('');
    setShowScanner(false);
  };

  const openOperationalDesk = (page: 'pickup' | 'walk-in') => {
    if (!customer?.short_code) {
      onNavigate(page);
      return;
    }
    const path = page === 'pickup' ? '/pickup' : '/walk-in';
    window.history.pushState({}, '', `${path}?member=${encodeURIComponent(customer.short_code)}`);
    onNavigate(page);
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-[#EEF3F0] flex items-center justify-center">
        <Loader2 className="w-9 h-9 text-[#55766F] animate-spin" />
      </div>
    );
  }

  if (!hasStaffAccess) {
    return (
      <div className="min-h-screen bg-[#EEF3F0] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-[#55766F]/15 p-8 text-center">
          <Lock className="w-12 h-12 text-[#55766F] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Customer Desk</h1>
          <p className="text-sm text-slate-600">{copy.staffRequired}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#EEF3F0] px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onNavigate('admin')}
            className="inline-flex items-center gap-2 rounded-lg border border-[#55766F]/20 bg-white px-4 py-2 text-sm font-semibold text-[#3F665E] hover:bg-[#F7F1E7]"
          >
            <ArrowLeft className="h-4 w-4" />
            {copy.back}
          </button>

          <div className="inline-flex rounded-lg border border-[#55766F]/20 bg-white p-1" aria-label="Language">
            {(['en', 'th'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLanguage(option)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                  staffLanguage === option ? 'bg-[#55766F] text-white' : 'text-[#55766F] hover:bg-[#EEF3F0]'
                }`}
                aria-pressed={staffLanguage === option}
              >
                {option === 'en' ? 'EN' : 'ไทย'}
              </button>
            ))}
          </div>
        </div>

        <header className="mb-6 rounded-[1.75rem] border border-[#55766F]/15 bg-[#FFF9EE] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#55766F] text-white">
              <UserCircle className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#292D2B]">{copy.title}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#303532]/65">{copy.subtitle}</p>
            </div>
            <InternalSignedInAccount label={staffLanguage === 'th' ? 'เข้าสู่ระบบเป็น' : 'Signed in as'} />
          </div>
        </header>

        <section className="rounded-2xl border border-[#55766F]/15 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => { setError(''); setShowScanner(true); }}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#55766F] px-4 py-3 font-semibold text-white hover:bg-[#46665F] disabled:opacity-50"
            >
              <Camera className="h-5 w-5" />
              {copy.scan}
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
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#55766F]/30 bg-white px-4 py-3 font-semibold text-[#3F665E] hover:bg-[#EEF3F0] disabled:opacity-50"
            >
              <Upload className="h-5 w-5" />
              {copy.upload}
            </button>

            <button
              type="button"
              onClick={resetCustomer}
              disabled={loading}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {copy.clear}
            </button>
          </div>

          <form onSubmit={handleManualSubmit} className="mt-4 flex gap-2">
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value.toUpperCase())}
              placeholder={copy.placeholder}
              className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-3 font-mono focus:border-transparent focus:ring-2 focus:ring-[#55766F]"
              autoComplete="off"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !manualCode.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#292D2B] px-5 font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              <span className="hidden sm:inline">{copy.lookup}</span>
            </button>
          </form>
        </section>

        {error && (
          <div className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading && !customer && (
          <div className="mt-5 rounded-2xl border border-[#55766F]/15 bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-[#55766F]" />
            <p className="text-gray-600">{copy.loading}</p>
          </div>
        )}

        {customer && (
          <div className="mt-6 space-y-6">
            <section className="overflow-hidden rounded-[1.75rem] border border-[#55766F]/15 bg-white shadow-sm">
              <div className="bg-[#55766F] px-6 py-5 text-white sm:px-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
                      <UserCircle className="h-8 w-8" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">{customer.short_code}</p>
                      <h2 className="truncate text-2xl font-bold">{customer.name}</h2>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold">{copy.readOnly}</span>
                </div>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6">
                <StatCard
                  icon={<Star className="h-5 w-5" />}
                  label={copy.points}
                  value={customer.loyalty_points.toLocaleString()}
                  detail={copy.points}
                />
                <StatCard
                  icon={<History className="h-5 w-5" />}
                  label={copy.purchases}
                  value={statsLoading ? '…' : stats.purchaseCount.toLocaleString()}
                  detail={statsLoading ? '—' : `${copy.pickups} ${stats.pickupCount} · ${copy.walkIns} ${stats.walkInCount}`}
                />
                <StatCard
                  icon={<ShoppingBag className="h-5 w-5" />}
                  label={copy.spend}
                  value={statsLoading ? '…' : `฿${stats.lifetimeSpend.toFixed(2)}`}
                  detail={stats.lastPurchaseAt ? `${copy.lastPurchase}: ${formatDate(stats.lastPurchaseAt, staffLanguage)}` : '—'}
                />
                <StatCard
                  icon={<Package className="h-5 w-5" />}
                  label={copy.active}
                  value={statsLoading ? '…' : stats.activeOrders.toLocaleString()}
                  detail={stats.nextPickupDate ? `${copy.nextPickup}: ${formatDate(stats.nextPickupDate, staffLanguage)}` : `${copy.nextPickup}: —`}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-[#55766F]/15 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-lg font-bold text-[#292D2B]">{copy.profile}</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Info icon={<Mail className="h-4 w-4" />} label={copy.email} value={customer.email || '—'} />
                <Info icon={<Phone className="h-4 w-4" />} label={copy.phone} value={customer.phone || '—'} />
                <Info icon={<MessageCircle className="h-4 w-4" />} label={copy.line} value={customer.line_id || '—'} />
                <Info icon={<MessageCircle className="h-4 w-4" />} label={copy.whatsapp} value={customer.whatsapp || '—'} />
                <Info icon={<MessageCircle className="h-4 w-4" />} label={copy.wechat} value={customer.wechat_id || '—'} />
                <Info icon={<QrCode className="h-4 w-4" />} label="VIP" value={customer.short_code || '—'} />
              </div>
            </section>

            <section className="rounded-2xl border border-[#C76624]/20 bg-[#FFF9EE] p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <Store className="mt-0.5 h-5 w-5 shrink-0 text-[#C76624]" />
                <div>
                  <h3 className="font-bold text-[#292D2B]">{copy.operations}</h3>
                  <p className="mt-1 text-sm leading-6 text-[#303532]/65">{copy.operationsHint}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => openOperationalDesk('pickup')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C76624] px-4 py-3 font-semibold text-white hover:bg-[#A95120]"
                >
                  <Package className="h-5 w-5" />
                  {copy.pickupDesk}
                </button>
                <button
                  type="button"
                  onClick={() => openOperationalDesk('walk-in')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#55766F]/30 bg-white px-4 py-3 font-semibold text-[#3F665E] hover:bg-[#EEF3F0]"
                >
                  <Store className="h-5 w-5" />
                  {copy.walkInDesk}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-[#55766F]/15 bg-white px-5 pb-6 pt-1 shadow-sm sm:px-6">
              <CustomerPurchaseHistory
                customerId={customer.id}
                customerName={customer.name}
                language={staffLanguage}
                defaultExpanded
                readOnly
              />
            </section>
          </div>
        )}
      </div>

      {showScanner && (
        <QRScanner
          onScan={(decodedText) => void lookupCustomer(decodedText)}
          onClose={() => setShowScanner(false)}
          language={staffLanguage}
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-[#55766F]/12 bg-[#F7F1E7]/55 p-4">
      <div className="flex items-center gap-2 text-[#55766F]">
        {icon}
        <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-extrabold text-[#292D2B]">{value}</p>
      <p className="mt-1 text-xs leading-5 text-[#303532]/55">{detail}</p>
    </div>
  );
}

function Info({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-1 flex items-center gap-2 text-gray-500">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="break-words font-medium text-gray-900">{value}</p>
    </div>
  );
}
