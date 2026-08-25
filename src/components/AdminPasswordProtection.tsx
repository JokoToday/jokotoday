import { Loader2, ShieldCheck } from 'lucide-react';

interface AdminPasswordProtectionProps {
  onAuthenticated: () => void;
}

export function AdminPasswordProtection({ onAuthenticated }: AdminPasswordProtectionProps) {
  void onAuthenticated;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-primary-100 p-4 rounded-full">
              <ShieldCheck className="w-8 h-8 text-primary-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Session</h1>
          <p className="text-sm text-gray-600 mb-5">Verifying your authorized admin session…</p>
          <Loader2 className="w-6 h-6 animate-spin text-primary-600 mx-auto" />
        </div>
      </div>
    </div>
  );
}
