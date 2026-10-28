import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, QrCode, Camera, Upload, X, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { supabase } from '../lib/supabase';
import { LINE_LINKING_ENABLED, hasLinkedLINE } from '../lib/lineAuth';
import { hasVerifiedEmail, lineDisplayName } from '../lib/lineProfile';
import { EmailVerificationPanel } from '../components/EmailVerificationPanel';
import { NotificationPreferencesFields } from '../components/NotificationPreferencesFields';
import {
  LINE_OFFICIAL_ACCOUNT_URL,
  dismissLINEFriendInvite,
  refreshLINEFriendshipStatusFromServer,
  refreshLINEFriendshipStatus,
  type LINEFriendshipStatus,
} from '../lib/lineOfficialAccount';
import { Container } from '../platform/design-system';
import type { Language } from '../translations';
import {
  EMPTY_DELIVERY_ADDRESS,
  normalizeDeliveryAddress,
  validateSavedDeliveryAddress,
  type CustomerDeliveryAddress,
} from '../lib/deliveryAddress';

interface MyProfilePageProps {
  onNavigate: (page: string) => void;
}

export function MyProfilePage({ onNavigate }: MyProfilePageProps) {
  const { user, userProfile, updateProfileDetails, refreshProfile, linkLINE } = useAuth();
  const { language, setLanguage } = useLanguage();
  const { getLabel } = useCMSLabels();

  const [loading, setLoading] = useState(false);
  const [lineLinked, setLineLinked] = useState<boolean | null>(null);
  const [lineFriendship, setLineFriendship] = useState<LINEFriendshipStatus>('unknown');
  const [success, setSuccess] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [error, setError] = useState('');
  const [notificationChannelError, setNotificationChannelError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    public_nickname: '',
    phone: '',
    line_id: '',
    notification_email_enabled: true,
    notification_line_enabled: false,
    default_delivery_address: { ...EMPTY_DELIVERY_ADDRESS },
  });
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notificationsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userProfile) return;
    let signupDraft: {email:string;name:string;public_nickname:string}|null=null;
    try { const raw=sessionStorage.getItem('joko_signup_identity_draft');if(raw)signupDraft=JSON.parse(raw); }catch { /* ignore malformed draft */ }
    if(signupDraft?.email?.toLowerCase()!==user?.email?.toLowerCase())signupDraft=null;
    setFormData({
      name: userProfile.name || signupDraft?.name || '',
      public_nickname: userProfile.public_nickname || signupDraft?.public_nickname || '',
      phone: userProfile.phone || '',
      line_id: userProfile.line_id || '',
      notification_email_enabled: userProfile.notification_email_enabled ?? true,
      notification_line_enabled: userProfile.notification_line_enabled ?? false,
      default_delivery_address: {
        ...EMPTY_DELIVERY_ADDRESS,
        ...(userProfile.default_delivery_address || {}),
      },
    });
    setProfilePicture(userProfile.profile_picture_url || null);
  }, [userProfile, user]);

  useEffect(() => {
    let cancelled = false;
    setLineLinked(null);
    if (!user) return;
    // Check the server's linked identities, not potentially stale
    // session metadata (notably after disconnect/relink operations).
    void supabase.auth.getUserIdentities().then(({ data, error: identitiesError }) => {
      if (!cancelled && !identitiesError) {
        setLineLinked(data.identities.some((identity) => identity.provider === 'custom:line'));
      }
    });
    return () => { cancelled = true; };
  }, [user?.id, user?.identities]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setLineFriendship('unknown');
      return;
    }

    setLineFriendship('unknown');
    void refreshLINEFriendshipStatusFromServer(user.id).then((status) => {
      if (!cancelled) setLineFriendship(status);
    });
    if (lineLinked !== true) return;

    // A provider token may still be present immediately after LINE OAuth.
    // Without one, the server-verified relationship above remains the source
    // of truth; the permanent Add Friend CTA remains available regardless.
    void supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (cancelled || sessionError || !data.session?.provider_token) return;
      const status = await refreshLINEFriendshipStatus(data.session.provider_token, user.id);
      if (!cancelled) setLineFriendship(status);
    });

    return () => { cancelled = true; };
  }, [lineLinked, user?.id]);

  const handleLinkLINE = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await linkLINE();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link LINE');
      setLoading(false);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setProfileSaved(false);
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFormData((current) => ({
      ...current,
      [event.target.name]: value,
    }));
  };

  const handleDeliveryAddressChange = (field: keyof CustomerDeliveryAddress, value: string) => {
    setProfileSaved(false);
    setFormData((current) => ({
      ...current,
      default_delivery_address: {
        ...current.default_delivery_address,
        [field]: value,
      },
    }));
  };

  const handleLanguageChange = async (preferredLanguage: Language) => {
    if (!user || preferredLanguage === language) return;

    const previousLanguage = language;
    setLanguage(preferredLanguage);
    setError('');

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ preferred_language: preferredLanguage })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating language preference:', updateError);
      setLanguage(previousLanguage);
      setError('Failed to update language preference');
      return;
    }

    await refreshProfile();
  };

  const isLINEConnected = lineLinked === true || (lineLinked === null && hasLinkedLINE(user));

  const scrollToNotificationPreferences = () => {
    window.requestAnimationFrame(() => {
      notificationsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notificationsSectionRef.current
        ?.querySelector<HTMLInputElement>('input[type="checkbox"]')
        ?.focus({ preventScroll: true });
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setProfileSaved(false);
    setNotificationChannelError('');

    if (!formData.name.trim()) {
      setError(getLabel('profile.name_required_error', language, 'Name is required'));
      return;
    }
    if (!/^[A-Za-z0-9_]{3,30}$/.test(formData.public_nickname.trim())) {
      setError(language === 'th' ? 'ชื่อเล่นสาธารณะต้องมี 3–30 ตัวอักษร (A-Z, 0-9, _)' : language === 'zh' ? '公开昵称须为 3–30 位英文字母、数字或下划线' : 'Public nickname is required: 3–30 letters, numbers or underscores.');
      return;
    }
    if (!formData.phone.trim()) {
      setError(getLabel('profile.phone_required_error', language, 'Phone number is required'));
      return;
    }
    if (!hasVerifiedEmail(user)) {
      setError(getLabel(
        'profile.email_required_error',
        language,
        language === 'th'
          ? 'จำเป็นต้องยืนยันอีเมลก่อนบันทึกโปรไฟล์'
          : language === 'zh'
            ? '保存个人资料前必须先验证邮箱。'
            : 'A verified email is required before saving your profile.',
      ));
      return;
    }
    if (!formData.line_id.trim() && !isLINEConnected) {
      setError(getLabel(
        'profile.line_required_error',
        language,
        language === 'th'
          ? 'จำเป็นต้องมี LINE กรุณากรอก LINE ID หรือเชื่อมต่อบัญชี LINE ของคุณ'
          : language === 'zh'
            ? 'LINE 为必填项。请输入 LINE ID 或关联您的 LINE 账号。'
            : 'LINE is required. Enter your LINE ID or connect your LINE account.',
      ));
      return;
    }
    if (!formData.notification_email_enabled && !formData.notification_line_enabled) {
      setNotificationChannelError(getLabel(
        'profile.notifications_required_error',
        language,
        language === 'th'
          ? 'กรุณาเลือกช่องทางการแจ้งเตือนที่คุณต้องการ'
          : language === 'zh'
            ? '请选择您偏好的通知方式。'
            : 'Please selected your preferred notifications channel.',
      ));
      scrollToNotificationPreferences();
      return;
    }
    if (
      !formData.notification_email_enabled
      && formData.notification_line_enabled
      && (!isLINEConnected || lineFriendship !== 'friend')
    ) {
      setNotificationChannelError(getLabel(
        'profile.notifications_line_only_error',
        language,
        language === 'th'
          ? 'หากต้องการใช้ LINE เป็นช่องทางการแจ้งเตือนเพียงช่องทางเดียว กรุณาเชื่อมต่อ LINE และเพิ่ม JOKO Today เป็นเพื่อนก่อน'
          : language === 'zh'
            ? '如需仅通过 LINE 接收通知，请先关联 LINE 账号并将 JOKO Today 添加为好友。'
            : 'To use LINE as your only notification channel, connect LINE and add JOKO Today as a friend first.',
      ));
      scrollToNotificationPreferences();
      return;
    }

    const deliveryAddressError = validateSavedDeliveryAddress(formData.default_delivery_address);
    if (deliveryAddressError) {
      setError(language === 'th'
        ? 'กรุณาตรวจสอบที่อยู่จัดส่งและลิงก์แผนที่ โดยลิงก์ต้องเป็น HTTPS'
        : language === 'zh'
          ? '请检查配送地址和地图链接；地图链接必须使用 HTTPS。'
          : 'Please check the delivery address and map link. Map links must use HTTPS.');
      return;
    }

    setLoading(true);
    try {
      await updateProfileDetails({
        name: formData.name.trim(),
        public_nickname: formData.public_nickname.trim(),
        phone: formData.phone.trim(),
        line_id: formData.line_id.trim() || undefined,
        notification_email_enabled: formData.notification_email_enabled,
        notification_line_enabled: formData.notification_line_enabled,
        default_delivery_address: normalizeDeliveryAddress(formData.default_delivery_address),
      });
      sessionStorage.removeItem('joko_signup_identity_draft');
      setProfileSaved(true);
    } catch (err) {
      console.error('Error updating profile:', err);
      const message = typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string' ? err.message : 'Failed to update profile';
      const code = typeof err === 'object' && err !== null && 'code' in err ? String(err.code) : '';
      const duplicateNickname = code === '23505' && /user_profiles_public_nickname_unique/i.test(message);
      setError(duplicateNickname
        ? language === 'th' ? 'ชื่อเล่นนี้มีคนใช้แล้ว กรุณาเลือกชื่อเล่นอื่น' : language === 'zh' ? '此公开昵称已被使用，请选择其他昵称。' : 'This public nickname is already taken. Please choose another.'
        : message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
    reader.onloadend = () => setProfilePicture(reader.result as string);
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
        .upload(fileName, selectedFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);
      const publicUrl = publicUrlData.publicUrl;
      if (!publicUrl) throw new Error('Failed to generate public URL for image');

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ profile_picture_url: publicUrl })
        .eq('id', user.id);
      if (updateError) throw updateError;

      await refreshProfile();
      setSelectedFile(null);
      setProfilePicture(publicUrl);
      setSuccess('Profile picture updated successfully!');
      window.setTimeout(() => setSuccess(''), 3000);
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
      window.setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error removing profile picture:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  const deliveryAddressCopy = {
    en: {
      heading: 'Saved delivery address',
      description: 'Optional. We can pre-fill a future JOKO Store delivery with this address. You can confirm or change it at checkout.',
      fields: [
        { key: 'address_line_1', label: 'House number / building / room', type: 'text', maxLength: 200 },
        { key: 'address_line_2', label: 'Village / soi / road (optional)', type: 'text', maxLength: 200 },
        { key: 'subdistrict', label: 'Subdistrict', type: 'text', maxLength: 120 },
        { key: 'district', label: 'District', type: 'text', maxLength: 120 },
        { key: 'province', label: 'Province', type: 'text', maxLength: 120 },
        { key: 'postal_code', label: 'Postal code', type: 'text', maxLength: 20 },
        { key: 'map_url', label: 'Google Maps link or map pin (optional)', type: 'url', maxLength: 2048 },
        { key: 'instructions', label: 'Delivery instructions (optional)', type: 'text', maxLength: 500 },
      ],
    },
    th: {
      heading: 'ที่อยู่จัดส่งที่บันทึกไว้',
      description: 'ไม่บังคับ เราสามารถกรอกที่อยู่นี้ล่วงหน้าสำหรับการจัดส่งจาก JOKO Store คุณยืนยันหรือเปลี่ยนที่อยู่ได้ตอนสั่งซื้อ',
      fields: [
        { key: 'address_line_1', label: 'บ้านเลขที่ / อาคาร / ห้อง', type: 'text', maxLength: 200 },
        { key: 'address_line_2', label: 'หมู่บ้าน / ซอย / ถนน (ไม่บังคับ)', type: 'text', maxLength: 200 },
        { key: 'subdistrict', label: 'ตำบล / แขวง', type: 'text', maxLength: 120 },
        { key: 'district', label: 'อำเภอ / เขต', type: 'text', maxLength: 120 },
        { key: 'province', label: 'จังหวัด', type: 'text', maxLength: 120 },
        { key: 'postal_code', label: 'รหัสไปรษณีย์', type: 'text', maxLength: 20 },
        { key: 'map_url', label: 'ลิงก์ Google Maps หรือหมุดแผนที่ (ไม่บังคับ)', type: 'url', maxLength: 2048 },
        { key: 'instructions', label: 'คำแนะนำการจัดส่ง (ไม่บังคับ)', type: 'text', maxLength: 500 },
      ],
    },
    zh: {
      heading: '已保存的配送地址',
      description: '选填。以后使用 JOKO Store 配送时可自动填入此地址，结账时仍可确认或修改。',
      fields: [
        { key: 'address_line_1', label: '门牌号 / 大楼 / 房间号', type: 'text', maxLength: 200 },
        { key: 'address_line_2', label: '小区 / 巷 / 道路（选填）', type: 'text', maxLength: 200 },
        { key: 'subdistrict', label: '街道 / 分区', type: 'text', maxLength: 120 },
        { key: 'district', label: '区 / 县', type: 'text', maxLength: 120 },
        { key: 'province', label: '府 / 省', type: 'text', maxLength: 120 },
        { key: 'postal_code', label: '邮政编码', type: 'text', maxLength: 20 },
        { key: 'map_url', label: 'Google 地图链接或地图定位（选填）', type: 'url', maxLength: 2048 },
        { key: 'instructions', label: '配送说明（选填）', type: 'text', maxLength: 500 },
      ],
    },
  }[language];

  if (!user) {
    return (
      <div className="joko-mineral-field min-h-[70vh]">
        <Container width="wide" className="relative z-10 flex min-h-[70vh] items-center justify-center py-12">
          <div className="w-full max-w-xl rounded-[2rem] border border-[#55766F]/14 bg-[#FFF9EE]/94 p-8 text-center shadow-[0_18px_50px_rgba(59,74,69,0.08)] sm:p-10">
            <p className="text-[#303532]/68">Please sign in to view your profile.</p>
            <button onClick={() => onNavigate('home')} className="mt-5 rounded-xl bg-[#C76624] px-6 py-3 font-semibold text-white transition hover:bg-[#A95120]">Go to Home</button>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="joko-mineral-field min-h-screen">
      <Container width="wide" className="relative z-10 py-8 sm:py-12 lg:py-14">
        <div className="mx-auto max-w-4xl">
          <button onClick={() => onNavigate('home-dashboard')} className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#FFF9EE]/78 px-4 py-2 text-sm font-semibold text-[#3F665E] transition hover:bg-[#FFF9EE]">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="mb-6 rounded-[2.25rem] border border-[#55766F]/14 bg-[#FFF9EE]/95 p-6 shadow-[0_18px_50px_rgba(59,74,69,0.08)] md:p-8 lg:p-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B] sm:text-4xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{getLabel('profile_page.header', language, 'My Profile')}</h1>
            <p className="mt-2 max-w-2xl text-[#303532]/66">{getLabel('profile_page.subtitle', language, 'Your details help us prepare your orders and stay in touch.')}</p>

            {userProfile?.short_code && (
              <div className="mb-8 mt-5 inline-flex items-center gap-3 rounded-xl border border-[#55766F]/16 bg-white/55 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#55766F]">
                  {getLabel(
                    'profile_page.member_code',
                    language,
                    language === 'th' ? 'รหัสสมาชิก' : language === 'zh' ? '会员编号' : 'Member Code',
                  )}
                </span>
                <span className="text-sm font-extrabold tracking-[0.12em] text-[#303532]">
                  {userProfile.short_code}
                </span>
              </div>
            )}

          {success && <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">{success}</div>}
          {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="border-b border-[#55766F]/14 pb-7">
              <h3 className="mb-4 text-lg font-semibold text-[#303532]">{getLabel('profile_page.picture_heading', language, 'Profile Picture')}</h3>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                  <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-[#55766F]/14 bg-[#CFE3DF]/65 shadow-inner">
                    {profilePicture ? <img src={profilePicture} alt="Profile" className="h-full w-full object-cover" /> : <Camera className="h-12 w-12 text-[#55766F]/55" />}
                  </div>
                  {profilePicture && !selectedFile && (
                    <button type="button" onClick={handleRemovePicture} disabled={uploadingPicture} className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 disabled:opacity-50">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
                  {selectedFile ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">New photo selected: {selectedFile.name}</p>
                      <div className="flex gap-3">
                        <button type="button" onClick={handleUploadPicture} disabled={uploadingPicture} className="flex items-center gap-2 rounded-xl bg-[#C76624] px-4 py-2 font-semibold text-white transition hover:bg-[#A95120] disabled:opacity-50">
                          <Upload className="w-4 h-4" /> {uploadingPicture ? 'Uploading...' : 'Upload Photo'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null);
                            setProfilePicture(userProfile?.profile_picture_url || null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          disabled={uploadingPicture}
                          className="rounded-xl border border-[#55766F]/20 bg-white/65 px-4 py-2 text-[#303532] transition hover:bg-[#CFE3DF]/35"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingPicture} className="mx-auto flex items-center gap-2 rounded-xl bg-[#303532] px-4 py-2 font-semibold text-white transition hover:bg-[#3F665E] disabled:opacity-50 sm:mx-0">
                        <Camera className="w-4 h-4" />
                        {profilePicture ? getLabel('profile_page.change_photo', language, 'Change Photo') : getLabel('profile_page.upload_photo', language, 'Upload Photo')}
                      </button>
                      <p className="text-xs text-gray-500 mt-2">JPG, PNG or WebP. Max 5MB.</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-[1.5rem] bg-white/48 p-5 sm:p-6">
              <h3 className="mb-4 text-lg font-semibold text-[#303532]">{getLabel('profile_page.personal_info', language, 'Personal Information')}</h3>
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">{language === 'th' ? 'ชื่อจริง' : language === 'zh' ? '真实姓名' : 'Real Name'} <span className="text-red-500">*</span>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-2 w-full rounded-xl border border-[#55766F]/20 bg-white/72 px-4 py-3 text-[#303532] outline-none transition focus:border-[#55766F]/45 focus:ring-2 focus:ring-[#55766F]/16" disabled={loading} required />
                </label>
                <label className="block text-sm font-medium text-gray-700">{language === 'th' ? 'ชื่อเล่นสาธารณะ' : language === 'zh' ? '公开昵称' : 'Public Nickname'} <span className="text-red-500">*</span>
                  <input type="text" name="public_nickname" value={formData.public_nickname} onChange={handleChange} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" autoComplete="nickname" className="mt-2 w-full rounded-xl border border-[#55766F]/20 bg-white/72 px-4 py-3 text-[#303532] outline-none focus:border-[#55766F]/45 focus:ring-2 focus:ring-[#55766F]/16" disabled={loading} required />
                  <span className="mt-1 block text-xs font-normal text-gray-600">{language === 'th' ? 'ชื่อที่สมาชิกคนอื่นจะเห็นเมื่อคุณแชร์คอลเลกชันหรือเข้าร่วมชุมชน ต้องไม่ซ้ำใคร' : language === 'zh' ? '其他成员在分享合集和社区互动时看到的唯一名称；真实姓名不会公开。' : 'Your unique public name on JOKO. Other members will see it on shared collections and community posts. Your real name stays private.'}</span>
                </label>
                <label className="block text-sm font-medium text-gray-700">{getLabel('profile_page.phone_label', language, 'Phone Number')} <span className="text-red-500">*</span>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-2 w-full rounded-xl border border-[#55766F]/20 bg-white/72 px-4 py-3 text-[#303532] outline-none transition focus:border-[#55766F]/45 focus:ring-2 focus:ring-[#55766F]/16" disabled={loading} required />
                </label>
              </div>
            </section>

            <section className="rounded-[1.5rem] bg-white/48 p-5 sm:p-6">
              <h3 className="mb-2 text-lg font-semibold text-[#303532]">{deliveryAddressCopy.heading}</h3>
              <p className="mb-4 text-sm text-gray-600">{deliveryAddressCopy.description}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {deliveryAddressCopy.fields.map((field) => (
                  <label key={field.key} className="block text-sm font-medium text-gray-700">
                    {field.label}
                    <input
                      type={field.type}
                      maxLength={field.maxLength}
                      value={formData.default_delivery_address[field.key as keyof CustomerDeliveryAddress]}
                      onChange={(event) => handleDeliveryAddressChange(
                        field.key as keyof CustomerDeliveryAddress,
                        event.target.value,
                      )}
                      className="mt-2 w-full rounded-xl border border-[#55766F]/20 bg-white/72 px-4 py-3 text-[#303532] outline-none transition focus:border-[#55766F]/45 focus:ring-2 focus:ring-[#55766F]/16"
                      disabled={loading}
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="border-t border-[#55766F]/14 pt-7">
              <h3 className="mb-2 text-lg font-semibold text-[#303532]">
                {getLabel('profile_page.contact_methods', language, 'Contact Methods')}
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                {getLabel(
                  'profile_page.contact_help_email_line',
                  language,
                  language === 'th'
                    ? 'ต้องมีทั้งอีเมลและ LINE สำหรับการติดต่อและแจ้งข้อมูลคำสั่งซื้อ'
                    : language === 'zh'
                      ? '邮箱和 LINE 都是必填项，用于联系您并发送订单更新。'
                      : 'Email and LINE are both required for customer contact and order updates.',
                )}
              </p>
              {hasVerifiedEmail(user) ? (
                <div className="mb-4 rounded-xl border border-[#06C755]/30 bg-[#E9F8EE] p-4 text-sm text-[#285A39]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {language === 'th' ? 'อีเมล: ยืนยันแล้ว'
                          : language === 'zh' ? '邮箱：已验证' : 'Email: Verified'}
                      </p>
                      <p className="mt-1 break-all">{user?.email}</p>
                      <p className="mt-1 text-xs">
                        {language === 'th' ? 'สามารถรับอีเมลยืนยันคำสั่งซื้อได้'
                          : language === 'zh' ? '可以接收订单确认邮件'
                            : 'Ready to receive order confirmations'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-5">
                  <EmailVerificationPanel />
                </div>
              )}
              <div className="space-y-3">
                {isLINEConnected && (
                  <div className="rounded-xl border border-[#06C755]/30 bg-[#E9F8EE] p-3 text-sm text-[#285A39]">
                    {language === 'th'
                      ? 'เชื่อมต่อบัญชี LINE แล้ว — ครบตามข้อกำหนด ไม่จำเป็นต้องกรอก LINE ID'
                      : language === 'zh'
                        ? 'LINE 账号已关联——已满足要求，无需填写 LINE ID。'
                        : 'LINE account connected — requirement fulfilled. You do not need to enter a LINE ID.'}
                  </div>
                )}
                <label className="block text-sm text-gray-600">
                  LINE ID <span className="text-red-500">*</span>
                  <input
                    type="text"
                    name="line_id"
                    value={formData.line_id}
                    onChange={handleChange}
                    className="mt-1 w-full rounded-xl border border-[#55766F]/20 bg-white/72 px-4 py-2.5 text-[#303532] outline-none transition focus:border-[#55766F]/45 focus:ring-2 focus:ring-[#55766F]/16"
                    disabled={loading}
                    required={!isLINEConnected}
                  />
                </label>
                <p className="text-xs text-gray-500">
                  {isLINEConnected
                    ? (language === 'th'
                      ? 'LINE Login ไม่เปิดเผย LINE ID ที่ค้นหาได้ คุณสามารถเว้นช่องนี้ว่างได้เมื่อเชื่อมต่อบัญชี LINE แล้ว'
                      : language === 'zh'
                        ? 'LINE 登录不会提供可搜索的 LINE ID。账号已关联时，此栏可以留空。'
                        : 'LINE Login does not share a searchable LINE ID. You may leave this blank when your LINE account is connected.')
                    : (language === 'th'
                      ? 'จำเป็น กรุณากรอก LINE ID ที่นี่ หรือเชื่อมต่อบัญชี LINE ด้านล่าง'
                      : language === 'zh'
                        ? '必填。请在此输入 LINE ID，或在下方关联您的 LINE 账号。'
                        : 'Required. Enter your LINE ID here, or connect your LINE account below.')}
                </p>
              </div>
            </section>

            {LINE_LINKING_ENABLED && (
              <section className="border-t border-[#55766F]/14 pt-7">
                <h3 className="mb-2 text-lg font-semibold text-[#303532]">
                  {language === 'th' ? 'บัญชีที่เชื่อมต่อ'
                    : language === 'zh' ? '已关联的账号' : 'Connected Accounts'}
                </h3>
                <p className="mb-4 text-sm text-gray-600">
                  {language === 'th' ? 'เชื่อมต่อ LINE เพื่อเข้าสู่ระบบบัญชี JOKO เดิม ชื่อจริงและชื่อเล่นสาธารณะที่บันทึกไว้จะไม่เปลี่ยน แม้ชื่อใน LINE จะแตกต่างกัน'
                    : language === 'zh' ? '关联 LINE 后可登录同一个 JOKO 账号。即使 LINE 显示名称不同，已保存的真实姓名和公开昵称也不会改变。'
                      : 'Connect LINE to sign in to this same JOKO account. Your saved real name and public nickname stay unchanged, even if your LINE display name is different.'}
                </p>
                {lineLinked === true ? (
                  <div className="rounded-xl border border-[#06C755]/30 bg-[#E9F8EE] p-4 text-sm text-[#285A39]">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {language === 'th' ? 'LINE · เชื่อมต่อแล้ว'
                            : language === 'zh' ? 'LINE · 已关联' : 'LINE · Connected'}
                        </p>
                        {lineDisplayName(user) && <p className="mt-1">{lineDisplayName(user)}</p>}
                        <p className="mt-1 text-xs">
                          {language === 'th' ? 'ใช้ LINE เพื่อเข้าสู่ระบบบัญชี JOKO นี้ได้อย่างปลอดภัย'
                            : language === 'zh' ? '可使用 LINE 安全登录此 JOKO 账号。'
                              : 'Available for secure sign-in to this JOKO account.'}
                        </p>

                        <div className="mt-4 border-t border-[#06C755]/20 pt-4">
                          <p className="font-semibold text-[#303532]">
                            {language === 'th' ? 'บัญชีทางการ JOKO Today'
                              : language === 'zh' ? 'JOKO Today 官方账号' : 'JOKO Today Official Account'}
                            {lineFriendship === 'friend' && (
                              <span className="ml-2 text-[#285A39]">
                                {language === 'th' ? '· เป็นเพื่อนแล้ว ✓'
                                  : language === 'zh' ? '· 已添加好友 ✓' : '· Friend ✓'}
                              </span>
                            )}
                          </p>
                          {lineFriendship === 'friend' ? (
                            <p className="mt-1 text-xs text-[#285A39]">
                              {language === 'th' ? 'พร้อมรับข่าวจาก JOKO ทาง LINE เมื่อเราเปิดใช้งานการแจ้งเตือน'
                                : language === 'zh' ? '已准备好在我们启用通知后通过 LINE 接收 JOKO 更新。'
                                  : 'Ready for JOKO updates on LINE as we roll out messaging.'}
                            </p>
                          ) : (
                            <>
                              <p className="mt-1 text-xs text-[#303532]/70">
                                {language === 'th' ? 'เพิ่มเราเป็นเพื่อนเพื่อรับข่าวจากเบเกอรี่ และเตรียมพร้อมสำหรับการแจ้งเตือนรับสินค้าและคำสั่งซื้อทาง LINE'
                                  : language === 'zh' ? '添加我们为好友，获取烘焙店动态，并为未来的取货和订单 LINE 通知做好准备。'
                                    : 'Add us as a friend for bakery news and future pickup and order updates on LINE.'}
                              </p>
                              <a
                                href={LINE_OFFICIAL_ACCOUNT_URL}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => user?.id && dismissLINEFriendInvite(user.id)}
                                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#06C755] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                              >
                                <MessageCircle aria-hidden="true" className="h-4 w-4" />
                                {language === 'th' ? 'เพิ่ม JOKO Today ใน LINE'
                                  : language === 'zh' ? '在 LINE 添加 JOKO Today' : 'Add JOKO Today on LINE'}
                              </a>
                              {lineFriendship === 'unknown' && (
                                <p className="mt-2 text-[11px] text-[#303532]/55">
                                  {language === 'th' ? 'ยังไม่สามารถยืนยันสถานะเพื่อนได้จากเซสชันนี้'
                                    : language === 'zh' ? '当前会话尚无法确认好友状态。'
                                      : 'Friendship status is not confirmed in this session.'}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : lineLinked === false ? (
                  <div className="rounded-xl border border-[#55766F]/20 bg-white/50 p-4">
                    <p className="mb-3 font-semibold text-[#303532]">
                      {language === 'th' ? 'LINE · ยังไม่เชื่อมต่อ'
                        : language === 'zh' ? 'LINE · 尚未关联' : 'LINE · Not connected'}
                    </p>
                    <p className="mb-3 text-sm text-gray-600">
                      {language === 'th' ? 'เชื่อม LINE ก่อนใช้ LINE Login เพื่อเก็บคำสั่งซื้อ บัตร QR และรางวัลในบัญชีเดิม'
                        : language === 'zh' ? '请先关联 LINE 账号，以保留现有订单、二维码会员卡及奖励。'
                          : 'Connect LINE before signing in with it, to preserve your existing orders, QR pass and rewards.'}
                    </p>
                    <button type="button" onClick={() => void handleLinkLINE()} disabled={loading}
                      className="rounded-xl bg-[#06C755] px-5 py-3 font-semibold text-white transition hover:bg-[#05AD49] disabled:opacity-50">
                      {language === 'en' ? 'Connect LINE' : language === 'th' ? 'เชื่อมต่อ LINE' : '绑定 LINE'}
                    </button>
                  </div>
                ) : (
                  <p role="status" className="text-sm text-gray-600">
                    {language === 'th' ? 'กำลังตรวจสอบบัญชีที่เชื่อมต่อ…'
                      : language === 'zh' ? '正在检查已关联的账号…' : 'Checking linked accounts…'}
                  </p>
                )}
              </section>
            )}

            <div ref={notificationsSectionRef} id="profile-notification-preferences">
              <NotificationPreferencesFields
                emailEnabled={formData.notification_email_enabled}
                lineEnabled={formData.notification_line_enabled}
                onEmailChange={(enabled) => {
                  setProfileSaved(false);
                  setNotificationChannelError('');
                  setFormData((current) => ({ ...current, notification_email_enabled: enabled }));
                }}
                onLineChange={(enabled) => {
                  setProfileSaved(false);
                  setNotificationChannelError('');
                  setFormData((current) => ({ ...current, notification_line_enabled: enabled }));
                }}
                lineConnected={isLINEConnected}
                lineFriendship={lineFriendship}
                customerId={user.id}
                onFriendshipChange={setLineFriendship}
                validationError={notificationChannelError}
              />
            </div>

            <section className="border-t border-[#55766F]/14 pt-7">
              <h3 className="mb-4 text-lg font-semibold text-[#303532]">{getLabel('profile_page.preferences', language, 'Preferences')}</h3>
              <label className="block text-sm font-medium text-gray-700 mb-2">{getLabel('profile_page.language_pref', language, 'Language Preference')}</label>
              <div className="flex gap-3">
                {(['en', 'th', 'zh'] as Language[]).map((option) => (
                  <button key={option} type="button" onClick={() => void handleLanguageChange(option)} className={`flex-1 rounded-xl py-3 font-medium transition-colors ${language === option ? 'bg-[#55766F] text-white shadow-sm' : 'border border-[#55766F]/14 bg-white/58 text-[#303532] hover:bg-[#CFE3DF]/38'}`}>
                    {option === 'en' ? getLabel('profile_page.language_en', language, 'English') : option === 'th' ? getLabel('profile_page.language_th', language, 'ไทย') : '中文'}
                  </button>
                ))}
              </div>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button type="submit" disabled={loading} className="flex-1 rounded-xl bg-[#C76624] py-3 font-semibold text-white transition hover:bg-[#A95120] disabled:opacity-50">
                {loading ? getLabel('profile_page.saving', language, 'Saving...') : getLabel('profile_page.save_changes', language, 'Save Changes')}
              </button>
              {profileSaved && (
                <p role="status" aria-live="polite" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#55766F]/25 bg-[#E2ECE6] px-4 py-3 text-sm font-semibold text-[#304B45]">
                  <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {language === 'th' ? 'บันทึกสำเร็จ' : language === 'zh' ? '保存成功' : 'Saved successfully'}
                </p>
              )}
              <button type="button" onClick={() => onNavigate('my-qr')} className="flex items-center justify-center gap-2 rounded-xl border border-[#55766F]/22 bg-[#CFE3DF]/65 px-6 py-3 font-semibold text-[#304B45] transition hover:bg-[#CFE3DF]">
                <QrCode className="w-5 h-5" /> {getLabel('profile_page.view_qr', language, 'View QR')}
              </button>
            </div>
          </form>
        </div>
        </div>
      </Container>
    </div>
  );
}
