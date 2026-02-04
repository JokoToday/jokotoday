import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, CheckCircle } from 'lucide-react';

interface ResetPasswordPageProps {
  onNavigate: (page: string) => void;
}

export function ResetPasswordPage({ onNavigate }: ResetPasswordPageProps) {
  const { t, language } = useLanguage();
  const { getLabel } = useCMSLabels();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('access_token') && !hash.includes('type=recovery')) {
      setError(getLabel('auth.invalid_reset_link', language, 'Invalid or expired reset link. Please request a new one.'));
    }
  }, [language, getLabel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (newPassword.length < 6) {
      setError(getLabel('auth.password_min_length', language, t.auth.passwordMinLength));
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(getLabel('auth.password_mismatch', language, t.auth.passwordMismatch));
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        onNavigate('home');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : getLabel('auth.password_reset_failed', language, t.auth.passwordResetFailed));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center">
          <div className="mb-6">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {getLabel('auth.password_reset_success', language, t.auth.passwordResetSuccess)}
          </h1>
          <p className="text-gray-600 mb-8">
            {getLabel('auth.redirecting_home', language, 'Redirecting you home...')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {getLabel('auth.reset_password_header', language, t.auth.resetPassword)}
          </h1>
          <p className="text-gray-600 text-sm mb-6">
            {getLabel('auth.reset_password_new_password', language, 'Choose a strong new password for your account')}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLabel('auth.new_password_label', language, t.auth.newPassword)}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={getLabel('auth.password_placeholder', language, 'At least 6 characters')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent pr-12"
                  required
                  disabled={loading}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {getLabel('auth.password_hint', language, 'Minimum 6 characters')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLabel('auth.confirm_password_label', language, t.auth.confirmPassword)}
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={getLabel('auth.confirm_password_placeholder', language, 'Re-enter your password')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent pr-12"
                  required
                  disabled={loading}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  disabled={loading}
                >
                  {showConfirm ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-600 text-white py-3 rounded-lg font-medium hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading
                ? getLabel('auth.loading', language, t.auth.loading)
                : getLabel('auth.update_password_button', language, t.auth.updatePassword)}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="w-full text-amber-600 hover:text-amber-700 font-medium py-2"
              disabled={loading}
            >
              {getLabel('auth.back_to_home', language, 'Back to Home')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
