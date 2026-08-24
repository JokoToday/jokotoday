import { FormEvent, useState } from 'react';
import { AlertCircle, Camera, Loader2, Lock, QrCode, Search, Star, UserCircle } from 'lucide-react';
import { QRScanner } from '../components/QRScanner';
import { useAuth } from '../context/AuthContext';
import {
  CustomerRecord,
  CustomerLookupNetworkError,
  CustomerLookupServiceError,
  InvalidCustomerCodeError,
  lookupCustomerByQRToken,
} from '../lib/customerLookup';

export function StaffScannerPage() {
  const { user, userRole, profileLoading } = useAuth();
  const hasStaffAccess = Boolean(user) && (userRole === 'staff' || userRole === 'admin');
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookupCustomer = async (rawCode: string) => {
    setLoading(true);
    setError('');
    setCustomer(null);
    try {
      const result = await lookupCustomerByQRToken(rawCode);
      if (!result) {
        setError('Customer not found. Check the member QR or VIP code and try again.');
        return;
      }
      setCustomer(result);
      setManualCode('');
      setShowScanner(false);
    } catch (err) {
      console.error('Staff customer lookup failed:', err);
      if (err instanceof InvalidCustomerCodeError) {
        setError('Invalid member code or QR code.');
      } else if (err instanceof CustomerLookupNetworkError) {
        setError('Unable to reach customer lookup. Check the connection and try again.');
      } else if (err instanceof CustomerLookupServiceError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Customer lookup failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!manualCode.trim() || loading) return;
    void lookupCustomer(manualCode);
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 flex items-center justify-center">
        <Loader2 className="w-9 h-9 text-amber-600 animate-spin" />
      </div>
    );
  }

  if (!hasStaffAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <Lock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Staff access required</h1>
          <p className="text-sm text-slate-600">Sign in with a staff or admin account before using the customer scanner.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg">
            <QrCode className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Customer Scanner</h1>
          <p className="text-gray-600 mt-2">Scan a member QR code or enter the VIP code to look up the customer.</p>
        </header>

        <section className="bg-white rounded-2xl shadow-lg border border-amber-100 p-6 mb-6">
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            <button
              type="button"
              onClick={() => { setError(''); setShowScanner(true); }}
              disabled={loading}
              className="flex items-center justify-center gap-2 bg-amber-600 text-white py-3 rounded-xl font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              <Camera className="w-5 h-5" /> Scan QR Code
            </button>
            <button
              type="button"
              onClick={() => { setCustomer(null); setError(''); setManualCode(''); }}
              disabled={loading}
              className="border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value.toUpperCase())}
              placeholder="VIP101 or QR token"
              className="flex-1 min-w-0 px-4 py-3 border border-gray-300 rounded-xl font-mono focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              autoComplete="off"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !manualCode.trim()}
              className="px-5 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              <span className="hidden sm:inline">Lookup</span>
            </button>
          </form>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 flex gap-3 mb-6">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {loading && !customer && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Looking up customer…</p>
          </div>
        )}

        {customer && (
          <section className="bg-white rounded-2xl shadow-xl border border-amber-200 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <UserCircle className="w-8 h-8" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-amber-100 font-semibold">{customer.short_code}</p>
                <h2 className="text-2xl font-bold truncate">{customer.name}</h2>
              </div>
            </div>

            <div className="p-6 grid sm:grid-cols-2 gap-4 text-sm">
              <Info label="Email" value={customer.email || '—'} />
              <Info label="Phone" value={customer.phone || '—'} />
              <Info label="LINE" value={customer.line_id || '—'} />
              <Info label="WhatsApp" value={customer.whatsapp || '—'} />
              <Info label="WeChat" value={customer.wechat_id || '—'} />
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold mb-1">Loyalty Points</p>
                <p className="text-2xl font-extrabold text-amber-900 flex items-center gap-2">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                  {customer.loyalty_points.toLocaleString()}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      {showScanner && (
        <QRScanner
          onScan={(decodedText) => void lookupCustomer(decodedText)}
          onClose={() => setShowScanner(false)}
          language="en"
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
      <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">{label}</p>
      <p className="font-medium text-gray-900 break-words">{value}</p>
    </div>
  );
}