import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { QRCodeDisplay } from '../components/QRCodeDisplay';
import { Package, User, Award, Loader2 } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  qr_token: string;
  loyalty_points: number;
  created_at: string;
}

interface CustomerAccountPageProps {
  qrToken: string;
}

export function CustomerAccountPage({ qrToken }: CustomerAccountPageProps) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomerData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('customers')
          .select('*')
          .eq('qr_token', qrToken)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!data) {
          setError('Customer not found');
          return;
        }

        setCustomer(data);
      } catch (err) {
        console.error('Error fetching customer:', err);
        setError(err instanceof Error ? err.message : 'Failed to load customer data');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomerData();
  }, [qrToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading customer account...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Not Found</h1>
          <p className="text-gray-600">
            {error || 'This QR code is not linked to any customer account.'}
          </p>
        </div>
      </div>
    );
  }

  const memberSince = new Date(customer.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-8 py-12 text-white">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <User className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1">{customer.name}</h1>
                <p className="text-amber-100">Member since {memberSince}</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-600" />
                  Loyalty Points
                </h2>
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-200">
                  <div className="text-5xl font-bold text-amber-600 mb-2">
                    {customer.loyalty_points}
                  </div>
                  <p className="text-gray-600 text-sm">Points earned</p>
                </div>
              </div>

              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-amber-600" />
                  Orders
                </h2>
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 text-center">
                  <p className="text-gray-500 text-sm">No orders yet</p>
                  <p className="text-xs text-gray-400 mt-1">Your orders will appear here</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Email</p>
                  <p className="text-gray-900 font-medium">{customer.email}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Phone</p>
                  <p className="text-gray-900 font-medium">{customer.phone}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">
            Your Loyalty QR Code
          </h2>
          <QRCodeDisplay qrToken={customer.qr_token} qrValue={String(customer.qr_token).trim()} />
        </div>
      </div>
    </div>
  );
}
