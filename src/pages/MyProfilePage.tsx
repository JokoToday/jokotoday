import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowLeft, QrCode, Camera, Upload, X, CheckCircle2, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { supabase } from '../lib/supabase';
import { LINE_LINKING_ENABLED } from '../lib/lineAuth';
import { hasVerifiedEmail, lineDisplayName } from '../lib/lineProfile';
import { EmailVerificationPanel } from '../components/EmailVerificationPanel';
import {
  LINE_OFFICIAL_ACCOUNT_URL,
  dismissLINEFriendInvite,
  getCachedLINEFriendshipStatus,
  refreshLINEFriendshipStatus,
  type LINEFriendshipStatus,
} from '../lib/lineOfficialAccount';
import { Container } from '../platform/design-system';
import type { Language } from '../translations';

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
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    line_id: '',
    whatsapp: '',
    wechat_id: '',
  });
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userProfile) return;
    setFormData({
      name: userProfile.name || lineDisplayName(user) || '',
      phone: userProfile.phone || '',
      line_id: userProfile.line_id || '',
      whatsapp: userProfile.whatsapp || '',
      wechat_id: userProfile.wechat_id || '',
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

    setLineFriendship(getCachedLINEFriendshipStatus(user.id));
    if (lineLinked !== true) return;

    // A provider token may still be present immediately after LINE OAuth.
    // If not, keep the most recent cached status; the permanent Add Friend
    // CTA remains available regardless.
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
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
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
    if (!formData.line_id.trim() && !formData.whatsapp.trim() && !formData.wechat_id.trim() && lineLinked !== true) {
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
      window.setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
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
          <button onClick={() => onNavigate('home')} className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#FFF9EE]/78 px-4 py-2 text-sm font-semibold text-[#3F665E] transition hover:bg-[#FFF9EE]">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="mb-6 rounded-[2.25rem] border border-[#55766F]/14 bg-[#FFF9EE]/95 p-6 shadow-[0_18px_50px_rgba(59,74,69,0.08)] md:p-8 lg:p-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#55766F]">JOKO TODAY</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#292D2B] sm:text-4xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{getLabel('profile_page.header', language, 'My Profile')}</h1>
            <p className="mb-8 mt-2 max-w-2xl text-[#303532]/66">{getLabel('profile_page.subtitle', language, 'Your details help us prepare your orders and stay in touch.')}</p>

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
                <label className="block text-sm font-medium text-gray-700">{getLabel('profile_page.name_label', language, 'Name / Nickname')} <span className="text-red-500">*</span>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className="mt-2 w-full rounded-xl border border-[#55766F]/20 bg-white/72 px-4 py-3 text-[#303532] outline-none transition focus:border-[#55766F]/45 focus:ring-2 focus:ring-[#55766F]/16" disabled={loading} required />
                </label>
                <label className="block text-sm font-medium text-gray-700">{getLabel('profile_page.phone_label', language, 'Phone Number')} <span className="text-red-500">*</span>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="mt-2 w-full rounded-xl border border-[#55766F]/20 bg-white/72 px-4 py-3 text-[#303532] outline-none transition focus:border-[#55766F]/45 focus:ring-2 focus:ring-[#55766F]/16" disabled={loading} required />
                </label>
              </div>
            </section>

            <section className="border-t border-[#55766F]/14 pt-7">
              <h3 className="mb-2 text-lg font-semibold text-[#303532]">
                {getLabel('profile_page.contact_methods', language, 'Contact Methods')}
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                {getLabel('profile_page.contact_help', language, 'How can we reach you with order updates?')}
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
                {[
                  ['line_id', language === 'th' ? 'LINE ID (ไม่บังคับ)'
                    : language === 'zh' ? 'LINE ID（选填）' : 'LINE ID (optional)'],
                  ['whatsapp', getLabel('profile_page.whatsapp_label', language, 'WhatsApp')],
                  ['wechat_id', getLabel('profile_page.wechat_label', language, 'WeChat ID')],
                ].map(([name, label]) => (
                  <label key={name} className="block text-sm text-gray-600">
                    {label}
                    <input type="text" name={name}
                      value={formData[name as keyof typeof formData]}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-xl border border-[#55766F]/20 bg-white/72 px-4 py-2.5 text-[#303532] outline-none transition focus:border-[#55766F]/45 focus:ring-2 focus:ring-[#55766F]/16"
                      disabled={loading} />
                  </label>
                ))}
                <p className="text-xs text-gray-500">
                  {language === 'th' ? 'LINE Login ไม่เปิดเผย LINE ID ที่ค้นหาได้ หากต้องการระบุ LINE ID กรุณากรอกด้วยตัวเอง'
                    : language === 'zh' ? 'LINE 登录不会提供可搜索的 LINE ID。如需填写，请手动输入。'
                      : 'LINE Login does not share a searchable LINE ID. Enter yours manually only if needed.'}
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
                  {language === 'th' ? 'ใช้บัญชีเหล่านี้เข้าสู่ระบบ JOKO โดยไม่สร้างบัญชีลูกค้าใหม่'
                    : language === 'zh' ? '将登录方式关联到同一个 JOKO 客户账号'
                      : 'Link sign-in methods to your existing JOKO customer account.'}
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

            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="flex-1 rounded-xl bg-[#C76624] py-3 font-semibold text-white transition hover:bg-[#A95120] disabled:opacity-50">
                {loading ? getLabel('profile_page.saving', language, 'Saving...') : getLabel('profile_page.save_changes', language, 'Save Changes')}
              </button>
              <button type="button" onClick={() => onNavigate('my-qr')} className="flex items-center gap-2 rounded-xl border border-[#55766F]/22 bg-[#CFE3DF]/65 px-6 py-3 font-semibold text-[#304B45] transition hover:bg-[#CFE3DF]">
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
