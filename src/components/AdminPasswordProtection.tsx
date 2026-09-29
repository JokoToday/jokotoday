import { Loader2, ShieldCheck } from 'lucide-react';

interface AdminPasswordProtectionProps {
  onAuthenticated: () => void;
}

export function AdminPasswordProtection({ onAuthenticated }: AdminPasswordProtectionProps) {
  void onAuthenticated;

  return (
    <div className="flex min-h-[55vh] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="joko-admin-paper-card p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-[#D9ECE9] p-4">
              <ShieldCheck className="h-8 w-8 text-[#55766F]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Admin Session</h1>
          <p className="text-sm text-gray-600 mb-5">Verifying your authorized admin session…</p>
          <Loader2 className="w-6 h-6 animate-spin text-[#55766F] mx-auto" />
        </div>
      </div>
    </div>
  );
}
