import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Award,
  Check,
  DollarSign,
  Home,
  Keyboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MessageCircle,
  Package,
  Phone,
  ShoppingCart,
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

interface PurchaseResult {
  order_number: string;
  amount: number;
  points_earned: number;
  updated_balance: number;
}

export function WalkInDeskPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { language, setLanguage } = useLanguage();
  const { user, userRole, signOut } = useAuth();
  const hasStaffAccess = Boolean(user) && (userRole === 'staff' || userRole === 'admin');
  const [showScanner, setShowScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loyaltyMultiplier, setLoyaltyMultiplier] = useState(0.5);
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const deepLinkHandledRef = useRef(false);
  const savingRef = useRef(false);
  const purchaseReferenceRef = useRef<string | null>(null);

  const parsedAmount = Number.parseFloat(amount);
  const calculationAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
  const currentBalance = customer?.loyalty_points ?? 0;
  const projectedPointsEarned = Math.round(calculationAmount * loyaltyMultiplier);
  const projectedNewBalance = currentBalance + projectedPointsEarned;

  const clearCustomerState = () => {
    setCustomer(null);
    setAmount('');
    setShowScanner(false);
    setShowManualEntry(false);
    setManualCode('');
    setError(null);
    setPurchaseResult(null);
    purchaseReferenceRef.current = null;
  };

  const handleLogout = async () => {
    await signOut();
    clearCustomerState();
    onNavigate('staff');
  };

  const resetTransaction = () => {
    clearCustomerState();
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
      setAmount('');
      setPurchaseResult(null);

      const customerData = await lookupCustomerByQRToken(lookupValue);
      if (!customerData) {
        setError(language === 'en' ? 'Customer not found' : 'ไม่พบลูกค้า');
        return;
      }

      setCustomer(customerData);
      setShowManualEntry(false);
      setManualCode('');

      const { data: loyaltyData } = await supabase
        .from('loyalty_settings')
        .select('multiplier')
        .eq('purchase_type', 'walk_in')
        .maybeSingle();

      if (loyaltyData) setLoyaltyMultiplier(loyaltyData.multiplier);
    } catch (err) {
      console.error('Error loading customer:', err);
      setError(getLookupErrorMessage(err, source));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasStaffAccess || deepLinkHandledRef.current) return;
    const memberCode = new URLSearchParams(window.location.search).get('member');
    if (!memberCode) return;
    deepLinkHandledRef.current = true;
    void findCustomer(memberCode, 'manual');
  }, [hasStaffAccess]);

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
        if (import.meta.env.DEV) console.debug('[WalkInDesk] Decoded QR content:', decoded.data);
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

  const handleSaveWalkIn = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customer || !amount || savingRef.current) return;

    try {
      savingRef.current = true;
      setSaving(true);
      setError(null);
      const amountNum = Number.parseFloat(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        setError(language === 'en' ? 'Please enter a valid amount' : 'กรุณากรอกจำนวนเงินที่ถูกต้อง');
        return;
      }

      const orderNumber = purchaseReferenceRef.current ?? `WI-${crypto.randomUUID()}`;
      purchaseReferenceRef.current = orderNumber;

      const { data, error: purchaseError } = await supabase.rpc('record_walk_in_purchase', {
        p_customer_id: customer.id,
        p_amount: amountNum,
        p_order_number: orderNumber,
      });

      if (purchaseError) throw purchaseError;
      if (
        !data
        || typeof data.amount !== 'number'
        || typeof data.points_earned !== 'number'
        || typeof data.updated_balance !== 'number'
      ) {
        throw new Error('Purchase was saved but the confirmation response was invalid.');
      }

      setCustomer({ ...customer, loyalty_points: data.updated_balance });
      setPurchaseResult(data as PurchaseResult);
      setHistoryRefreshKey((value) => value + 1);
    } catch (err) {
      console.error('Error saving walk-in purchase:', err);
      setError(err instanceof Error ? err.message : (language === 'en' ? 'Failed to save purchase' : 'เกิดข้อผิดพลาด'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleAnotherPurchase = () => {
    setAmount('');
    setError(null);
    setPurchaseResult(null);
    purchaseReferenceRef.current = null;
  };

  const handleFinishAndGoHome = () => {
    resetTransaction();
    onNavigate('home');
  };

  const handleSignInAnotherCustomer = () => resetTransaction();

  const handleFinishAndGoToPickup = () => {
    resetTransaction();
    onNavigate('pickup');
  };

  const getContactMethod = () => {
    if (!customer) return null;
    if (customer.line_id) return { type: 'LINE', value: customer.line_id };
    if (customer.whatsapp) return { type: 'WhatsApp', value: customer.whatsapp };
    if (customer.wechat_id) return { type: 'WeChat', value: customer.wechat_id };
    return null;
  };

  const staffLanguage = language === 'th' ? 'th' : 'en';

  const languageSwitch = (
    <div className="inline-flex rounded-lg bg-white/15 p-1" aria-label="Language">
      {(['en', 'th'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLanguage(option)}
          className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
            language === option ? 'bg-white text-green-800' : 'text-white hover:bg-white/10'
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
            <div className="relative bg-gradient-to-r from-green-700 to-emerald-900 px-8 py-8">
              <div className="absolute right-4 top-4">{languageSwitch}</div>
              <div className="flex items-center justify-center mb-4">
                <Lock className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-white text-center mb-2">
                {language === 'en' ? 'Walk-In Desk' : 'เคาน์เตอร์ลูกค้า Walk-In'}
              </h1>
              <p className="text-green-100 text-center">
                {language === 'en' ? 'Log in-store purchases' : 'บันทึกการซื้อหน้าร้าน'}
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

      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-green-700 to-emerald-900 px-8 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {language === 'en' ? 'Walk-In Desk' : 'เคาน์เตอร์ลูกค้า Walk-In'}
                </h1>
                <p className="text-green-100">
                  {language === 'en' ? 'Record in-store purchases for existing members' : 'บันทึกการซื้อหน้าร้านสำหรับสมาชิก'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                {languageSwitch}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('pickup')}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-white/15 hover:bg-white/25 rounded-lg transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    {language === 'en' ? 'Pickup Desk' : 'จุดรับสินค้า'}
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
                    className="w-full px-4 py-3 text-lg font-semibold border-2 border-green-300 rounded-lg focus:outline-none focus:border-green-600 text-center tracking-widest"
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
                      className="flex-1 px-4 py-3 text-green-700 border-2 border-green-300 rounded-lg font-medium hover:bg-green-50 transition-colors"
                    >
                      {language === 'en' ? 'Cancel' : 'ยกเลิก'}
                    </button>
                    <button
                      type="submit"
                      disabled={!manualCode.trim() || loading}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (language === 'en' ? 'Find Customer' : 'ค้นหาลูกค้า')}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShoppingCart className="w-10 h-10 text-green-600" />
                  </div>
                  <button
                    onClick={() => setShowScanner(true)}
                    className="border-2 border-green-600 bg-white text-green-700 px-8 py-4 rounded-xl font-semibold hover:bg-gradient-to-r hover:from-green-600 hover:to-emerald-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 transition-all shadow-lg hover:shadow-xl mb-4"
                  >
                    {language === 'en' ? 'Start Scanning' : 'เริ่มแสกน'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManualEntry(true)}
                    className="mx-auto flex items-center justify-center gap-2 px-5 py-3 border-2 border-green-600 bg-white text-green-700 rounded-lg font-medium hover:bg-green-600 hover:text-white transition-colors"
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
                    className="mt-4 mx-auto flex items-center justify-center gap-2 px-5 py-3 border-2 border-green-600 bg-white text-green-700 rounded-lg font-medium hover:bg-green-600 hover:text-white transition-colors disabled:opacity-50"
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
                      <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8 text-green-600" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <Award className="w-4 h-4 text-green-600" />
                          <span className="text-green-600 font-semibold">
                            {customer.loyalty_points} {language === 'en' ? 'points' : 'แต้ม'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {!purchaseResult && (
                      <button onClick={resetTransaction} className="text-gray-500 hover:text-gray-700 text-sm font-medium">
                        {language === 'en' ? 'Scan Another' : 'แสกนต่อ'}
                      </button>
                    )}
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

                {purchaseResult ? (
                  <div className="space-y-6">
                    <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-center">
                      <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Check className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-green-900">
                        {language === 'en' ? 'Purchase saved successfully' : 'บันทึกรายการซื้อสำเร็จ'}
                      </h3>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-600">{language === 'en' ? 'Purchase amount' : 'ยอดซื้อ'}</p>
                        <p className="text-xl font-bold text-gray-900 mt-1">฿{purchaseResult.amount.toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-600">{language === 'en' ? 'Points earned' : 'แต้มที่ได้รับ'}</p>
                        <p className="text-xl font-bold text-green-700 mt-1">+{purchaseResult.points_earned}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-4 text-center">
                        <p className="text-sm text-gray-600">{language === 'en' ? 'Updated points balance' : 'ยอดแต้มสะสมล่าสุด'}</p>
                        <p className="text-xl font-bold text-green-700 mt-1">{purchaseResult.updated_balance}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <button type="button" onClick={handleAnotherPurchase} className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors">
                        {language === 'en' ? 'Make Another Purchase' : 'ทำรายการซื้ออีกครั้ง'}
                      </button>
                      <button type="button" onClick={handleSignInAnotherCustomer} className="w-full border-2 border-green-600 bg-white text-green-700 px-6 py-3 rounded-lg font-semibold hover:bg-green-600 hover:text-white transition-colors">
                        {language === 'en' ? 'Sign In Another Walk-In Customer' : 'เข้าสู่ระบบลูกค้าวอล์กอินรายอื่น'}
                      </button>
                      <button type="button" onClick={handleFinishAndGoToPickup} className="w-full border-2 border-green-600 bg-white text-green-700 px-6 py-3 rounded-lg font-semibold hover:bg-green-600 hover:text-white transition-colors">
                        {language === 'en' ? 'Finish and Go to Pickup Desk' : 'เสร็จสิ้นและไปที่จุดรับสินค้า'}
                      </button>
                      <button type="button" onClick={handleFinishAndGoHome} className="w-full border-2 border-green-600 bg-white text-green-700 px-6 py-3 rounded-lg font-semibold hover:bg-green-600 hover:text-white transition-colors">
                        {language === 'en' ? 'Finish and Go Home' : 'เสร็จสิ้นและกลับหน้าหลัก'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      {language === 'en' ? 'Record Purchase' : 'บันทึกการซื้อ'}
                    </h3>
                    <form onSubmit={handleSaveWalkIn} className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          {language === 'en' ? 'Enter paid amount (in-store purchase)' : 'กรอกยอดชำระเงิน (ซื้อหน้าร้าน)'}
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-gray-400">฿</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={amount}
                            onChange={(event) => {
                              setAmount(event.target.value);
                              setError(null);
                            }}
                            placeholder="0.00"
                            className="w-full pl-12 pr-4 py-4 text-3xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-100 transition-all"
                            autoFocus
                          />
                        </div>
                        {error && (
                          <p className="mt-2 text-red-600 text-sm font-medium flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                          </p>
                        )}
                      </div>

                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-sm font-semibold text-gray-700 mb-4">
                          {language === 'en' ? 'Loyalty Points Calculation' : 'การคำนวณคะแนนสะสม'}
                        </p>
                        <div className="space-y-3">
                          <div className="flex items-baseline justify-between gap-4">
                            <span className="text-sm text-gray-600">{language === 'en' ? 'Current Balance' : 'คะแนนปัจจุบัน'}</span>
                            <span className="font-medium text-gray-900">{currentBalance} {language === 'en' ? 'points' : 'คะแนน'}</span>
                          </div>
                          <div className="flex items-baseline justify-between gap-4">
                            <span className="text-sm text-gray-600">{language === 'en' ? 'Points Earned' : 'คะแนนที่ได้รับ'}</span>
                            <span className="font-semibold text-green-700">{projectedPointsEarned > 0 ? '+' : ''}{projectedPointsEarned} {language === 'en' ? 'points' : 'คะแนน'}</span>
                          </div>
                          <div className="border-t border-green-200 pt-3 flex items-baseline justify-between gap-4">
                            <span className="font-semibold text-gray-800">{language === 'en' ? 'New Balance' : 'คะแนนใหม่'}</span>
                            <span className="text-3xl font-bold text-green-700">{projectedNewBalance} <span className="text-base font-semibold">{language === 'en' ? 'points' : 'คะแนน'}</span></span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{calculationAmount.toFixed(2)} ฿ × {loyaltyMultiplier}x</p>
                      </div>

                      <button
                        type="submit"
                        disabled={saving || !amount}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                      >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                        {saving
                          ? (language === 'en' ? 'Saving purchase…' : 'กำลังบันทึกรายการซื้อ…')
                          : (language === 'en' ? 'Save Walk-In Purchase' : 'บันทึกการซื้อหน้าร้าน')}
                      </button>
                    </form>
                  </div>
                )}

                <CustomerPurchaseHistory
                  customerId={customer.id}
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
