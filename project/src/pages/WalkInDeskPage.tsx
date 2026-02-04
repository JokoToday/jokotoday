import { useState, useEffect } from 'react';
import { Lock, LogOut, User, Phone, Mail, MessageCircle, Award, Check, Loader2, AlertCircle, ShoppingCart, DollarSign, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { QRScanner } from '../components/QRScanner';
import { useLanguage } from '../context/LanguageContext';

const WALK_IN_DESK_PIN = '1234';

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

interface LoyaltySettings {
  purchase_type: string;
  multiplier: number;
}

export function WalkInDeskPage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { language } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loyaltyMultiplier, setLoyaltyMultiplier] = useState(0.5);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('walkInDeskAuth');
    if (stored === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (pin === WALK_IN_DESK_PIN) {
      sessionStorage.setItem('walkInDeskAuth', 'true');
      setIsAuthenticated(true);
      setPin('');
    } else {
      setPinError(language === 'en' ? 'Invalid PIN' : 'PIN ไม่ถูกต้อง');
      setPin('');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('walkInDeskAuth');
    setIsAuthenticated(false);
    setCustomer(null);
    setAmount('');
    setShowScanner(false);
    setPin('');
    setError(null);
  };

  const handleScan = async (decodedText: string) => {
    try {
      setLoading(true);
      setError(null);
      setCustomer(null);
      setAmount('');
      setSuccessMessage(null);

      const qrToken = decodedText.includes('/c/') ? decodedText.split('/c/')[1] : decodedText;

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

      const { data: loyaltyData } = await supabase
        .from('loyalty_settings')
        .select('multiplier')
        .eq('purchase_type', 'walk_in')
        .maybeSingle();

      if (loyaltyData) {
        setLoyaltyMultiplier(loyaltyData.multiplier);
      }
    } catch (err) {
      console.error('Error loading customer:', err);
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
      setAmount('');
      setSuccessMessage(null);

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('short_code', manualCode.trim())
        .maybeSingle();

      if (customerError) throw customerError;

      if (!customerData) {
        setError(language === 'en' ? 'No customer found with this code.' : 'ไม่พบลูกค้าด้วยรหัสนี้');
        setManualCode('');
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

      if (loyaltyData) {
        setLoyaltyMultiplier(loyaltyData.multiplier);
      }
    } catch (err) {
      console.error('Error loading customer:', err);
      setError(err instanceof Error ? err.message : (language === 'en' ? 'Failed to load customer data' : 'เกิดข้อผิดพลาด'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !amount) return;

    try {
      setSaving(true);
      const amountNum = parseFloat(amount);

      if (isNaN(amountNum) || amountNum <= 0) {
        setError(language === 'en' ? 'Please enter a valid amount' : 'กรุณากรอกจำนวนเงินที่ถูกต้อง');
        return;
      }

      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;

      const { error: insertError } = await supabase
        .from('orders')
        .insert({
          customer_id: customer.id,
          purchase_type: 'walk_in',
          walk_in_amount: amountNum,
          staff_id: currentUserId || null,
          order_number: `WI-${Date.now()}`,
          order_items: [],
          total_amount: amountNum,
          status: 'completed',
          payment_status: 'paid',
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_email: customer.email,
          loyalty_multiplier: loyaltyMultiplier,
          created_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      const pointsEarned = Math.round(amountNum * loyaltyMultiplier);
      const { error: updateError } = await supabase
        .from('customers')
        .update({ loyalty_points: customer.loyalty_points + pointsEarned })
        .eq('id', customer.id);

      if (updateError) throw updateError;

      setSuccessMessage(
        language === 'en'
          ? `Walk-in purchase saved! ${pointsEarned} loyalty points awarded.`
          : `บันทึกการซื้อหน้าร้านแล้ว! ได้รับ ${pointsEarned} แต้มสะสม`
      );

      setTimeout(() => {
        setCustomer(null);
        setAmount('');
        setSuccessMessage(null);
        setShowScanner(false);
      }, 2000);
    } catch (err) {
      console.error('Error saving walk-in purchase:', err);
      setError(err instanceof Error ? err.message : (language === 'en' ? 'Failed to save purchase' : 'เกิดข้อผิดพลาด'));
    } finally {
      setSaving(false);
    }
  };

  const getContactMethod = () => {
    if (!customer) return null;
    if (customer.line_id) return { type: 'LINE', value: customer.line_id };
    if (customer.whatsapp) return { type: 'WhatsApp', value: customer.whatsapp };
    if (customer.wechat_id) return { type: 'WeChat', value: customer.wechat_id };
    return null;
  };

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
            <div className="bg-gradient-to-r from-green-700 to-emerald-900 px-8 py-8">
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
              <form onSubmit={handlePinSubmit}>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {language === 'en' ? 'Staff PIN' : 'PIN พนักงาน'}
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest font-semibold focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
                  autoFocus
                />
                {pinError && <p className="mt-2 text-red-600 text-sm text-center font-medium">{pinError}</p>}
                <button
                  type="submit"
                  className="w-full mt-6 bg-gradient-to-r from-green-700 to-emerald-900 text-white font-bold py-3 px-4 rounded-lg hover:from-green-800 hover:to-emerald-950 transition-all"
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
      <div className="max-w-2xl mx-auto py-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-green-700 to-emerald-900 px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {language === 'en' ? 'Walk-In Desk' : 'เคาน์เตอร์ลูกค้า Walk-In'}
                </h1>
                <p className="text-green-100">
                  {language === 'en' ? 'Record in-store purchases for existing members' : 'บันทึกการซื้อหน้าร้านสำหรับสมาชิก'}
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
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
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
                        {loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            {language === 'en' ? 'Find Customer' : 'ค้นหาลูกค้า'}
                          </>
                        )}
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
                      className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl mb-4"
                    >
                      {language === 'en' ? 'Start Scanning' : 'เริ่มแสกน'}
                    </button>
                    <button
                      onClick={() => setShowManualEntry(true)}
                      className="text-green-700 hover:text-green-900 font-medium text-sm"
                    >
                      {language === 'en' ? 'Or enter member code' : 'หรือกรอกรหัสสมาชิก'}
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
                      <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8 text-green-600" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{customer.name}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <Award className="w-4 h-4 text-green-600" />
                          <span className="text-green-600 font-semibold">{customer.loyalty_points} points</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setCustomer(null);
                        setAmount('');
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
                </div>

                {successMessage && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-green-800 font-medium">{successMessage}</p>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    {language === 'en' ? 'Record Purchase' : 'บันทึกการซื้อ'}
                  </h3>

                  <form onSubmit={handleSaveWalkIn} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        {language === 'en'
                          ? 'Enter paid amount (in-store purchase)'
                          : 'กรอกยอดชำระเงิน (ซื้อหน้าร้าน)'}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-gray-400">
                          ฿
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={amount}
                          onChange={(e) => {
                            setAmount(e.target.value);
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
                      <p className="text-xs text-gray-600 mb-2">
                        {language === 'en' ? 'Loyalty Points Calculation' : 'การคำนวณแต้มสะสม'}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-green-600">
                          {amount ? Math.round(parseFloat(amount) * loyaltyMultiplier) : 0}
                        </span>
                        <span className="text-gray-600">
                          {language === 'en' ? 'points earned' : 'แต้ม'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        {language === 'en'
                          ? `${amount ? parseFloat(amount).toFixed(2) : '0.00'} ฿ × ${loyaltyMultiplier}x`
                          : `${amount ? parseFloat(amount).toFixed(2) : '0.00'} ฿ × ${loyaltyMultiplier}x`}
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={saving || !amount}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                    >
                      {saving ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Check className="w-5 h-5" />
                      )}
                      {language === 'en' ? 'Save Walk-In Purchase' : 'บันทึกการซื้อหน้าร้าน'}
                    </button>
                  </form>
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
