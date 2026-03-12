import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, QrCode, Camera, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { supabase } from '../lib/supabase';
import { getPickupLocations, CMSPickupLocation } from '../lib/cmsService';

interface MyProfilePageProps {
  onNavigate: (page: string) => void;
}

export function MyProfilePage({ onNavigate }: MyProfilePageProps) {
  const { user, userProfile, updateProfileDetails, refreshProfile } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { getLabel } = useCMSLabels();

  const [locations, setLocations] = useState<CMSPickupLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    line_id: '',
    whatsapp: '',
    wechat_id: '',
    preferred_location: '',
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
      await updateProfileDetails({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        line_id: formData.line_id.trim() || undefined,
        whatsapp: formData.whatsapp.trim() || undefined,
        wechat_id: formData.wechat_id.trim() || undefined,
      });

      setSuccess(getLabel('profile_page.saved', language, 'Changes saved!'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setLoading(false);
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

      const { error: uploadError } = await supabase.storage
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
            {getLabel('profile_page.header', language, 'My Profile')}
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
                {getLabel('profile_page.picture_heading', language, 'Profile Picture')}
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
                        {profilePicture
                          ? getLabel('profile_page.change_photo', language, 'Change Photo')
                          : getLabel('profile_page.upload_photo', language, 'Upload Photo')}
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
                  : getLabel('profile_page.save_changes', language, 'Save Changes')}
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
      </div>
    </div>
  );
}
