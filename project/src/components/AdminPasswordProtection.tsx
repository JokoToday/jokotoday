import { useState } from 'react';
import { Lock, AlertCircle } from 'lucide-react';
import { ADMIN_PASSWORD, setAdminAuthenticated } from '../lib/adminConfig';

interface AdminPasswordProtectionProps {
  onAuthenticated: () => void;
}

export function AdminPasswordProtection({ onAuthenticated }: AdminPasswordProtectionProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    await new Promise(resolve => setTimeout(resolve, 300));

    if (password === ADMIN_PASSWORD) {
      setAdminAuthenticated();
      onAuthenticated();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-primary-100 p-4 rounded-full">
              <Lock className="w-8 h-8 text-primary-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Admin Access</h1>
          <p className="text-center text-gray-600 text-sm mb-6">
            Enter the password to access the admin panel
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-medium py-3 rounded-lg transition-colors"
            >
              {isLoading ? 'Verifying...' : 'Access Admin Panel'}
            </button>
          </form>

          <p className="text-xs text-gray-500 text-center mt-6">
            Password required for security
          </p>
        </div>
      </div>
    </div>
  );
}
