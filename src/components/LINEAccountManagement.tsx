import { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Language } from '../translations';
import { supabase } from '../lib/supabase';
import { hasVerifiedEmail } from '../lib/lineProfile';
import { LINE_OFFICIAL_ACCOUNT_URL } from '../lib/lineOfficialAccount';
import { disconnectLINELogin, stopLINENotifications, hasEmailLogin, LINEAccountActionError } from '../lib/lineAccountManagement';

const text = {
  en: {
    heading: 'Manage LINE', disconnect: 'Disconnect LINE login', cancel: 'Cancel',
    disconnectHint: 'Removes LINE as a sign-in method. Your saved names, orders and contact LINE ID stay unchanged. This does not block or remove the JOKO Official Account in LINE.',
    emailRequired: 'Add and verify an email login before disconnecting LINE, so you can still access this JOKO account.',
    stopNotificationsFirst: 'First stop LINE notifications using the button below. Email notifications must remain enabled before disconnecting.',
    confirm: 'Disconnect LINE login? You will use your verified email to sign in to this same JOKO account.',
    stop: 'Stop LINE notifications', stopHint: 'Saves immediately: switches JOKO order notifications to your verified email. LINE login and friendship stay unchanged. Other profile edits are not saved.',
    verifyEmail: 'Verify your email first so important order updates can continue by email.',
    stopped: 'LINE notifications stopped. Email notifications are enabled.',
    disconnected: 'LINE login disconnected. Use email to sign in to this JOKO account.',
    refresh: 'LINE login disconnected. Refresh this page to update its status.',
    manage: 'Open JOKO in LINE', friendshipHint: 'On a computer, scan the QR code with LINE on your phone. Then open the JOKO chat and use LINE’s Block option to stop Official Account messages. You can remove the account in LINE too. This does not disconnect LINE login or change your saved notification preferences.',
    failed: 'Could not complete this change. Please try again.', profileUnavailable: 'Your profile could not be updated. Please sign out and sign in again.',
    sessionChanged: 'Your sign-in session changed. Refresh this page before trying again.', busy: 'Updating…',
  },
  th: {
    heading: 'จัดการ LINE', disconnect: 'ยกเลิก LINE Login', cancel: 'ยกเลิก',
    disconnectHint: 'นำ LINE ออกจากวิธีเข้าสู่ระบบ ชื่อ คำสั่งซื้อ และ LINE ID สำหรับติดต่อจะไม่เปลี่ยน การดำเนินการนี้ไม่บล็อกหรือลบบัญชีทางการ JOKO ใน LINE',
    emailRequired: 'กรุณาเพิ่มและยืนยันวิธีเข้าสู่ระบบด้วยอีเมลก่อนยกเลิก LINE เพื่อให้ยังเข้าสู่บัญชี JOKO นี้ได้',
    stopNotificationsFirst: 'กรุณาหยุดการแจ้งเตือนทาง LINE ด้วยปุ่มด้านล่างก่อน ต้องเปิดการแจ้งเตือนทางอีเมลไว้ก่อนยกเลิกการเชื่อมต่อ',
    confirm: 'ยกเลิก LINE Login หรือไม่? คุณจะใช้อีเมลที่ยืนยันแล้วเข้าสู่บัญชี JOKO เดิม',
    stop: 'หยุดการแจ้งเตือนทาง LINE', stopHint: 'บันทึกทันที: เปลี่ยนการแจ้งเตือนคำสั่งซื้อ JOKO ไปยังอีเมลที่ยืนยันแล้ว LINE Login และสถานะเพื่อนไม่เปลี่ยน ข้อมูลอื่นในแบบฟอร์มจะไม่ถูกบันทึก',
    verifyEmail: 'กรุณายืนยันอีเมลก่อน เพื่อรับข้อมูลสำคัญเกี่ยวกับคำสั่งซื้อทางอีเมลต่อไป',
    stopped: 'หยุดการแจ้งเตือนทาง LINE แล้ว และเปิดการแจ้งเตือนทางอีเมลแล้ว',
    disconnected: 'ยกเลิก LINE Login แล้ว ใช้อีเมลเพื่อเข้าสู่บัญชี JOKO นี้',
    refresh: 'ยกเลิก LINE Login แล้ว กรุณารีเฟรชหน้าเพื่ออัปเดตสถานะ',
    manage: 'เปิด JOKO ใน LINE', friendshipHint: 'หากใช้คอมพิวเตอร์ ให้สแกน QR ด้วย LINE บนโทรศัพท์ จากนั้นเปิดแชท JOKO และใช้ตัวเลือกบล็อกเพื่อหยุดข้อความจากบัญชีทางการ คุณสามารถลบบัญชีใน LINE ได้เช่นกัน การดำเนินการนี้ไม่ยกเลิก LINE Login หรือเปลี่ยนการตั้งค่าการแจ้งเตือนที่บันทึกไว้',
    failed: 'เปลี่ยนแปลงไม่สำเร็จ กรุณาลองอีกครั้ง', profileUnavailable: 'อัปเดตโปรไฟล์ไม่สำเร็จ กรุณาออกจากระบบแล้วเข้าสู่ระบบอีกครั้ง',
    sessionChanged: 'เซสชันการเข้าสู่ระบบเปลี่ยนไป กรุณารีเฟรชหน้าก่อนลองอีกครั้ง', busy: 'กำลังอัปเดต…',
  },
  zh: {
    heading: '管理 LINE', disconnect: '断开 LINE 登录', cancel: '取消',
    disconnectHint: '移除 LINE 登录方式，已保存的姓名、订单和联系 LINE ID 保持不变。此操作不会在 LINE 中屏蔽或删除 JOKO 官方账号。',
    emailRequired: '断开 LINE 前，请先添加并验证邮箱登录方式，以便继续访问此 JOKO 账号。',
    stopNotificationsFirst: '请先使用下方按钮停止 LINE 通知。断开关联前必须保持邮箱通知开启。',
    confirm: '断开 LINE 登录？之后您将使用已验证的邮箱登录同一个 JOKO 账号。',
    stop: '停止 LINE 通知', stopHint: '立即保存：将 JOKO 订单通知切换至已验证的邮箱。LINE 登录和好友关系保持不变。不会保存其他个人资料修改。',
    verifyEmail: '请先验证邮箱，以便继续通过邮箱接收重要订单通知。',
    stopped: 'LINE 通知已停止，邮箱通知已开启。',
    disconnected: 'LINE 登录已断开。请使用邮箱登录此 JOKO 账号。',
    refresh: 'LINE 登录已断开。请刷新页面以更新状态。',
    manage: '在 LINE 打开 JOKO', friendshipHint: '使用电脑时，请用手机上的 LINE 扫描二维码，然后打开 JOKO 聊天并使用屏蔽选项停止官方账号消息。您也可在 LINE 中删除该账号。此操作不会断开 LINE 登录或更改已保存的通知偏好。',
    failed: '无法完成更改，请重试。', profileUnavailable: '无法更新个人资料，请退出后重新登录。',
    sessionChanged: '登录会话已改变，请刷新页面后重试。', busy: '更新中…',
  },
};

interface Props {
  user: User; linked: boolean | null; language: Language; disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onDisconnected: () => Promise<void>;
  onNotificationsStopped: () => void;
}

export function LINEAccountManagement({ user, linked, language, disabled, onBusyChange, onDisconnected, onNotificationsStopped }: Props) {
  const copy = text[language];
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const canDisconnect = hasEmailLogin(user);
  const run = async (action: 'disconnect' | 'stop') => {
    if (busy || disabled) return;
    setBusy(true); onBusyChange(true); setError(''); setMessage('');
    try {
      if (action === 'stop') {
        await stopLINENotifications(supabase, user.id);
        onNotificationsStopped(); setMessage(copy.stopped);
      } else {
        await disconnectLINELogin(supabase, user.id);
        setConfirming(false); setMessage(copy.disconnected);
        try { await onDisconnected(); } catch { setMessage(copy.refresh); }
      }
    } catch (failure) {
      setError(failure instanceof LINEAccountActionError ? failure.code === 'emailRequired' && action === 'stop' ? copy.verifyEmail : copy[failure.code] : copy.failed);
    } finally { setBusy(false); onBusyChange(false); }
  };
  return <div className="mt-5 space-y-5 rounded-xl border border-[#55766F]/20 bg-white/60 p-4">
    <h4 className="font-semibold text-[#303532]">{copy.heading}</h4>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="text-sm text-[#285A39]">{message}</p>}
    {linked === true && <div className="space-y-2">
      <p className="text-sm text-gray-600">{copy.disconnectHint}</p>
      {!canDisconnect && <p className="text-sm text-amber-800">{copy.emailRequired}</p>}
      {confirming ? <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
        <p className="text-sm">{copy.confirm}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={disabled || busy || !canDisconnect} onClick={() => void run('disconnect')} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? copy.busy : copy.disconnect}</button>
          <button type="button" disabled={disabled || busy} onClick={() => setConfirming(false)} className="rounded-xl border px-4 py-2 text-sm">{copy.cancel}</button>
        </div>
      </div> : <button type="button" disabled={disabled || busy || !canDisconnect} onClick={() => { setError(''); setMessage(''); setConfirming(true); }} className="rounded-xl border border-red-700/30 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">{copy.disconnect}</button>}
    </div>}
    <div className="space-y-2">
      <p className="text-sm text-gray-600">{copy.stopHint}</p>
      {!hasVerifiedEmail(user) && <p className="text-sm text-amber-800">{copy.verifyEmail}</p>}
      <button type="button" disabled={disabled || busy || !hasVerifiedEmail(user)} onClick={() => void run('stop')} className="rounded-xl border border-[#55766F]/30 px-4 py-2 text-sm font-semibold disabled:opacity-50">{busy ? copy.busy : copy.stop}</button>
    </div>
    <div className="space-y-2">
      <p className="text-sm text-gray-600">{copy.friendshipHint}</p>
      <a href={LINE_OFFICIAL_ACCOUNT_URL} target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-[#06C755]/40 px-4 py-2 text-sm font-semibold text-[#285A39]">{copy.manage}</a>
    </div>
  </div>;
}
