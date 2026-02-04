import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, QrCode, Lock, Eye, EyeOff, Camera, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { supabase } from '../lib/supabase';
import { getPickupLocations, CMSPickupLocation } from '../lib/cmsService';
import { generateQRToken } from '../lib/qrTokenGenerator';

interface MyProfilePageProps {
  onNavigate: (page: string) => void;
}

export function MyProfilePage({ onNavigate }: MyProfilePageProps) {
  const { user, userProfile, refreshProfile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { getLabel } = useCMSLabels();

  const [locations, setLocations] = useState<CMSPickupLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [qrRegenerating, setQrRegenerating] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [qrSuccess, setQrSuccess] = useState('');
  const [qrError, setQrError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    line_id: '',
    whatsapp: '',
    wechat_id: '',
    preferred_location: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        phone: userProfile.phone || '',
        line_id: userProfile.line_id || '',
        whatsapp: userProfile.whatsapp || '',
        wechat_id: userProfile.wechat_id || '',
        preferred_location: '',
      });

      if (userProfile.profile_picture_url) {
        setProfilePicture(userProfile.profile_picture_url);
      }
    }
  }, [userProfile]);

  const loadLocations = async () => {
    try {
      const data = await getPickupLocations();
      setLocations(data);
    } catch (err) {
      console.error('Error loading locations:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError(getLabel('profile.name_required_error', language, 'Name is required'));
      return;
    }

    if (!formData.phone.trim()) {
      setError(getLabel('profile.phone_required_error', language, 'Phone number is required'));
      return;
    }

    if (!formData.line_id && !formData.whatsapp && !formData.wechat_id) {
      setError(getLabel('profile.contact_required_error', language, 'At least one contact method is required'));
      return;
    }

    setLoading(true);

    try {
      const qrToken = userProfile?.qr_token || generateQRToken();

      const { error: updateError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user?.id,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          line_id: formData.line_id.trim() || null,
          whatsapp: formData.whatsapp.trim() || null,
          wechat_id: formData.wechat_id.trim() || null,
          qr_token: qrToken,
          profile_completed: true,
          updated_at: new Date().toISOString(),
        });

      if (updateError) throw updateError;

      const { error: customerError } = await supabase
        .from('customers')
        .upsert({
          id: user?.id,
          email: user?.email,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          line_id: formData.line_id.trim() || null,
          whatsapp: formData.whatsapp.trim() || null,
          wechat_id: formData.wechat_id.trim() || null,
          qr_token: qrToken,
        });

      if (customerError) throw customerError;

      await refreshProfile();
      setSuccess(getLabel('profile_page.saved', language, 'Changes saved!'));

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (updateError) throw updateError;

      setPasswordSuccess('Password updated successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating password:', err);
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleRegenerateQR = async () => {
    if (!user) return;

    const confirmRegenerate = window.confirm(
      'Are you sure you want to regenerate your QR code? Your old QR code will no longer work for login.'
    );

    if (!confirmRegenerate) return;

    setQrRegenerating(true);
    setQrError('');
    setQrSuccess('');

    try {
      const newQRToken = generateQRToken();

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          qr_token: newQRToken,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      const { error: customerError } = await supabase
        .from('customers')
        .update({
          qr_token: newQRToken,
        })
        .eq('id', user.id);

      if (customerError) throw customerError;

      await refreshProfile();
      setQrSuccess('QR code regenerated successfully! Your new QR code is ready to use.');

      setTimeout(() => setQrSuccess(''), 5000);
    } catch (err) {
      console.error('Error regenerating QR code:', err);
      setQrError(err instanceof Error ? err.message : 'Failed to regenerate QR code');
    } finally {
      setQrRegenerating(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePicture(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadPicture = async () => {
    if (!selectedFile || !user) return;

    setUploadingPicture(true);
    setError('');

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);

      const publicUrl = publicUrlData?.publicUrl;

      if (!publicUrl) {
        throw new Error('Failed to generate public URL for image');
      }

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ profile_picture_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setSelectedFile(null);
      setSuccess('Profile picture updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error uploading profile picture:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleRemovePicture = async () => {
    if (!user) return;

    setUploadingPicture(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ profile_picture_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      setProfilePicture(null);
      setSelectedFile(null);
      setSuccess('Profile picture removed');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error removing profile picture:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-600">Please sign in to view your profile.</p>
          <button
            onClick={() => onNavigate('home')}
            className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {getLabel('profile_page.header', language, 'My Profile ☀️')}
          </h1>
          <p className="text-gray-600 mb-8">
            {getLabel('profile_page.subtitle', language, 'Your details help us prepare your orders and stay in touch.')}
          </p>

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Profile Picture
              </h3>

              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                    {profilePicture ? (
                      <img
                        src={profilePicture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-12 h-12 text-gray-400" />
                    )}
                  </div>
                  {profilePicture && !selectedFile && (
                    <button
                      type="button"
                      onClick={handleRemovePicture}
                      disabled={uploadingPicture}
                      className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {selectedFile ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">
                        New photo selected: {selectedFile.name}
                      </p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={handleUploadPicture}
                          disabled={uploadingPicture}
                          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                          <Upload className="w-4 h-4" />
                          {uploadingPicture ? 'Uploading...' : 'Upload Photo'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            if (userProfile?.profile_picture_url) {
                              setProfilePicture(userProfile.profile_picture_url);
                            } else {
                              setProfilePicture(null);
                            }
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          disabled={uploadingPicture}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPicture}
                        className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto sm:mx-0"
                      >
                        <Camera className="w-4 h-4" />
                        {profilePicture ? 'Change Photo' : 'Upload Photo'}
                      </button>
                      <p className="text-xs text-gray-500 mt-2">
                        JPG, PNG or WebP. Max 5MB.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {getLabel('profile_page.personal_info', language, 'Personal Information')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getLabel('profile_page.name_label', language, 'Name / Nickname')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getLabel('profile_page.phone_label', language, 'Phone Number')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    disabled={loading}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getLabel('profile_page.email_label', language, 'Email Address')}
                  </label>
                  <input
                    type="email"
                    value={user.email || ''}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
                    disabled
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {getLabel('profile_page.email_readonly', language, '(verified, cannot be changed here)')}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {getLabel('profile_page.contact_methods', language, 'Contact Methods')}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {getLabel('profile_page.contact_help', language, 'How can we reach you with order updates?')}
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    {getLabel('profile_page.line_label', language, 'LINE ID')}
                  </label>
                  <input
                    type="text"
                    name="line_id"
                    value={formData.line_id}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    {getLabel('profile_page.whatsapp_label', language, 'WhatsApp')}
                  </label>
                  <input
                    type="text"
                    name="whatsapp"
                    value={formData.whatsapp}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    {getLabel('profile_page.wechat_label', language, 'WeChat ID')}
                  </label>
                  <input
                    type="text"
                    name="wechat_id"
                    value={formData.wechat_id}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {getLabel('profile_page.preferences', language, 'Preferences')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getLabel('profile_page.language_pref', language, 'Language Preference')}
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setLanguage('en')}
                      className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                        language === 'en'
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {getLabel('profile_page.language_en', language, 'English')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLanguage('th')}
                      className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
                        language === 'th'
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {getLabel('profile_page.language_th', language, 'ไทย')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-amber-600 text-white py-3 rounded-lg font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? getLabel('profile_page.saving', language, 'Saving...')
                  : getLabel('profile_page.save_changes', language, '✔ Save Changes')}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('my-qr')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <QrCode className="w-5 h-5" />
                {getLabel('profile_page.view_qr', language, 'View QR')}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-6 h-6 text-gray-700" />
            <h2 className="text-2xl font-bold text-gray-900">
              {getLabel('profile_page.security', language, 'Security 🔐')}
            </h2>
          </div>

          {passwordSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
              {passwordSuccess}
            </div>
          )}

          {passwordError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
              {passwordError}
            </div>
          )}

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLabel('profile_page.current_password', language, 'Current Password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword.current ? 'text' : 'password'}
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  disabled={passwordLoading}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword.current ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLabel('profile_page.new_password', language, 'New Password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword['new'] ? 'text' : 'password'}
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  disabled={passwordLoading}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, new: !prev['new'] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword['new'] ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLabel('profile_page.confirm_password', language, 'Confirm New Password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword.confirm ? 'text' : 'password'}
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  disabled={passwordLoading}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword.confirm ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full bg-gray-800 text-white py-3 rounded-lg font-semibold hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {passwordLoading
                ? getLabel('general.loading', language, 'Loading...')
                : getLabel('profile_page.update_password_button', language, 'Update Password')}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <QrCode className="w-6 h-6 text-gray-700" />
              <h3 className="text-xl font-bold text-gray-900">
                {getLabel('profile_page.qr_security', language, 'QR Code Security')}
              </h3>
            </div>

            {qrSuccess && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                {qrSuccess}
              </div>
            )}

            {qrError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                {qrError}
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-gray-800 mb-2">
                {getLabel('profile_page.qr_security_info', language, 'If you think your QR code has been compromised or you want to enhance security, you can generate a new one.')}
              </p>
              <p className="text-sm text-gray-700">
                {getLabel('profile_page.qr_security_warning', language, 'Your old QR code will immediately stop working after regeneration.')}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRegenerateQR}
              disabled={qrRegenerating}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <QrCode className="w-5 h-5" />
              {qrRegenerating
                ? getLabel('profile_page.regenerating_qr', language, 'Regenerating QR Code...')
                : getLabel('profile_page.regenerate_qr', language, 'Regenerate QR Code')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
