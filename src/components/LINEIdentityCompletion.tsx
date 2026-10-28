import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { hasLinkedLINE } from '../lib/lineAuth';
import { supabase } from '../lib/supabase';

// Keep existing completed accounts usable. New LINE accounts must choose
// their identity without requiring a phone number or verified email here.
export function LINEIdentityCompletion({ enabled }: { enabled: boolean }) {
  const { user, userProfile, userRole, profileLoading, refreshProfile, signOut } = useAuth();
  const { language } = useLanguage();
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const show = Boolean(enabled && user && userProfile && !profileLoading && userRole === null
    && !userProfile.profile_completed && !userProfile.public_nickname && hasLinkedLINE(user));

  useEffect(() => {
    if (show) { setName(userProfile?.name || ''); setNickname(''); setError(''); }
  }, [show, user?.id]);

  if (!show || !user || !userProfile) return null;
  const copy = language === 'th'
    ? { title: 'ตั้งชื่อสำหรับบัญชี JOKO', name: 'ชื่อจริง', nickname: 'ชื่อเล่นสาธารณะ', hint: 'ชื่อจริงเป็นข้อมูลส่วนตัว ใช้สำหรับคำสั่งซื้อ สมาชิกคนอื่นจะไม่เห็น ชื่อเล่นสาธารณะจะแสดงในคอลเลกชันที่แชร์และโพสต์ชุมชน คุณเปลี่ยนทั้งสองชื่อได้ภายหลังในโปรไฟล์ หากระบบกรอกชื่อจาก LINE โปรดตรวจสอบก่อนบันทึก', save: 'บันทึก', signout: 'ออกจากระบบ', invalid: 'กรุณากรอกชื่อจริงและชื่อเล่น 3–30 ตัวอักษรภาษาอังกฤษ ตัวเลข หรือ _', duplicate: 'ชื่อเล่นนี้มีคนใช้แล้ว', failed: 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง' }
    : language === 'zh'
      ? { title: '设置您的 JOKO 名称', name: '真实姓名', nickname: '公开昵称', hint: '真实姓名仅用于订单，不向其他会员公开。公开昵称将显示在分享合集和社区帖子中。您以后可在个人资料中修改这两个名称。如果姓名由 LINE 预填，请在保存前确认。', save: '保存', signout: '退出登录', invalid: '请输入真实姓名和 3–30 位英文字母、数字或下划线组成的昵称。', duplicate: '此昵称已被使用。', failed: '保存失败，请重试。' }
      : { title: 'Choose your JOKO names', name: 'Real name', nickname: 'Public nickname', hint: 'Your real name is private and used for orders; other members cannot see it. Your public nickname appears on shared collections and community posts. You can change both later in My Profile. If your name was prefilled from LINE, please check it before saving.', save: 'Save', signout: 'Sign out', invalid: 'Enter your real name and a nickname of 3–30 letters, numbers or underscores.', duplicate: 'This nickname is already taken.', failed: 'Could not save your names. Please try again.' };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!name.trim() || !/^[A-Za-z0-9_]{3,30}$/.test(nickname.trim())) { setError(copy.invalid); return; }
    setBusy(true);
    try {
      let query = supabase.from('user_profiles').update({ name: name.trim(), public_nickname: nickname.trim() })
        .eq('id', user.id).is('public_nickname', null);
      query = userProfile.name === null ? query.is('name', null) : query.eq('name', userProfile.name);
      const { data, error: saveError } = await query.select('id').maybeSingle();
      if (saveError) throw saveError;
      if (!data) { await refreshProfile(); throw new Error('Profile changed'); }
      await refreshProfile();
    } catch (err) {
      setError(typeof err === 'object' && err !== null && 'code' in err && err.code === '23505' ? copy.duplicate : copy.failed);
    } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="line-identity-title">
    <form onSubmit={save} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl">
      <h2 id="line-identity-title" className="text-xl font-semibold">{copy.title}</h2>
      <p className="text-sm text-gray-600">{copy.hint}</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="block text-sm font-medium">{copy.name} *<input value={name} onChange={e => setName(e.target.value)} maxLength={120} required disabled={busy} autoComplete="name" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" /></label>
      <label className="block text-sm font-medium">{copy.nickname} *<input value={nickname} onChange={e => setNickname(e.target.value)} minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" required disabled={busy} autoComplete="nickname" className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3" /></label>
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-amber-600 py-3 font-semibold text-white disabled:opacity-50">{copy.save}</button>
      <button type="button" disabled={busy} onClick={() => void signOut()} className="w-full text-sm text-gray-600">{copy.signout}</button>
    </form>
  </div>;
}
