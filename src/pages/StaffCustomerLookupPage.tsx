import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Loader2,
  Lock,
  Mail,
  Package,
  Phone,
  Store,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  CustomerRecord,
  lookupCustomerByShortCode,
} from '../lib/customerLookup';

interface StaffCustomerLookupPageProps {
  onNavigate: (page: string) => void;
}

const MEMBER_CODE_PATTERN = /^VIP\d+$/i;

export function StaffCustomerLookupPage({ onNavigate }: StaffCustomerLookupPageProps) {
  const { language } = useLanguage();
  const { user, userRole, profileLoading } = useAuth();
  const hasStaffAccess = Boolean(user) && (userRole === 'staff' || userRole === 'admin');
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const memberCode = (new URLSearchParams(window.location.search).get('member') || '').toUpperCase();
  const validMemberCode = MEMBER_CODE_PATTERN.test(memberCode) ? memberCode : null;
  const isThai = language === 'th';

  useEffect(() => {
    if (!hasStaffAccess || !validMemberCode) return;

    let active = true;
    setLoading(true);
    setError('');

    lookupCustomerByShortCode(validMemberCode)
      .then((result) => {
        if (!active) return;
        if (!result) {
          setCustomer(null);
          setError(isThai ? 'ไม่พบลูกค้า' : 'Customer not found');
          return;
        }
        setCustomer(result);
      })
      .catch((err) => {
        console.error('Staff customer email lookup failed:', err);
        if (!active) return;
        setCustomer(null);
        setError(isThai ? 'ไม่สามารถโหลดข้อมูลลูกค้าได้' : 'Could not load customer details');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hasStaffAccess, validMemberCode, isThai]);

  if (profileLoading && user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
      </div>
    );
  }

  if (!hasStaffAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 text-center">
          <Lock className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {isThai ? 'ต้องเข้าสู่ระบบพนักงาน' : 'Staff sign-in required'}
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            {isThai
              ? 'เข้าสู่ระบบด้วยบัญชีพนักงานเพื่อดูข้อมูลลูกค้าจากอีเมลคำสั่งซื้อ'
              : 'Sign in with a staff account to view the customer referenced by this order email.'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('staff')}
            className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900"
          >
            {isThai ? 'ไปที่ Staff Login' : 'Go to Staff Login'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-2xl mx-auto py-8">
        <button
          type="button"
          onClick={() => onNavigate('staff')}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {isThai ? 'กลับไปหน้า Staff' : 'Back to Staff'}
        </button>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-8 py-7">
            <div className="text-sm font-semibold uppercase tracking-wider text-slate-300 mb-2">
              {isThai ? 'ข้อมูลลูกค้า' : 'Customer Lookup'}
            </div>
            <div className="text-3xl font-mono font-extrabold text-white">
              {validMemberCode || '—'}
            </div>
          </div>

          <div className="p-8">
            {!validMemberCode ? (
              <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
                {isThai ? 'ลิงก์นี้ไม่มีรหัสสมาชิกที่ถูกต้อง' : 'This link does not contain a valid member code.'}
              </div>
            ) : loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
              </div>
            ) : error ? (
              <div className="text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">{error}</div>
            ) : customer ? (
              <>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50">
                    <User className="w-5 h-5 text-slate-500" />
                    <div><div className="text-xs uppercase tracking-wide text-slate-400">{isThai ? 'ชื่อ' : 'Name'}</div><div className="font-semibold text-slate-900">{customer.name || '—'}</div></div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50">
                    <Mail className="w-5 h-5 text-slate-500" />
                    <div><div className="text-xs uppercase tracking-wide text-slate-400">Email</div><div className="font-semibold text-slate-900">{customer.email || '—'}</div></div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50">
                    <Phone className="w-5 h-5 text-slate-500" />
                    <div><div className="text-xs uppercase tracking-wide text-slate-400">{isThai ? 'โทรศัพท์' : 'Phone'}</div><div className="font-semibold text-slate-900">{customer.phone || '—'}</div></div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                    <Award className="w-5 h-5 text-amber-700" />
                    <div><div className="text-xs uppercase tracking-wide text-amber-600">{isThai ? 'คะแนนสะสม' : 'Loyalty Points'}</div><div className="font-semibold text-amber-900">{customer.loyalty_points ?? 0}</div></div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 mt-7">
                  <button
                    type="button"
                    onClick={() => onNavigate('pickup')}
                    className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-900"
                  >
                    <Package className="w-5 h-5" />
                    {isThai ? 'เปิด Pickup Desk' : 'Open Pickup Desk'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('walk-in')}
                    className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-slate-300 text-slate-800 font-semibold hover:bg-slate-50"
                  >
                    <Store className="w-5 h-5" />
                    {isThai ? 'เปิด Walk-In Desk' : 'Open Walk-In Desk'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
