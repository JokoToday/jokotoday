import { useEffect, useState } from 'react';
import { CheckCircle2, MessageCircle, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  LINE_FRIEND_INVITE_EVENT,
  LINE_OFFICIAL_ACCOUNT_URL,
  clearPendingLINEFriendInvite,
  dismissLINEFriendInvite,
  hasPendingLINEFriendInvite,
} from '../lib/lineOfficialAccount';

const copy = {
  en: {
    title: "You're signed in with LINE",
    body: 'Add JOKO Today as a friend for bakery news and future pickup and order updates.',
    add: 'Add JOKO Today on LINE',
    later: 'Not now',
  },
  th: {
    title: 'เข้าสู่ระบบด้วย LINE แล้ว',
    body: 'เพิ่ม JOKO Today เป็นเพื่อนเพื่อรับข่าวจากเบเกอรี่ และเตรียมพร้อมสำหรับการแจ้งเตือนรับสินค้าและคำสั่งซื้อทาง LINE',
    add: 'เพิ่ม JOKO Today ใน LINE',
    later: 'ไว้คราวหน้า',
  },
  zh: {
    title: '已使用 LINE 登录',
    body: '添加 JOKO Today 为好友，获取烘焙店动态，并为未来的取货和订单 LINE 通知做好准备。',
    add: '在 LINE 添加 JOKO Today',
    later: '以后再说',
  },
};

export function LINEFriendInvite() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [visible, setVisible] = useState(false);
  const t = copy[language];

  useEffect(() => {
    if (!user?.id) {
      setVisible(false);
      return;
    }
    const sync = () => setVisible(hasPendingLINEFriendInvite(user.id));
    sync();
    window.addEventListener(LINE_FRIEND_INVITE_EVENT, sync);
    return () => window.removeEventListener(LINE_FRIEND_INVITE_EVENT, sync);
  }, [user?.id]);

  if (!user || !visible) return null;

  const handleAdd = () => {
    dismissLINEFriendInvite(user.id);
    setVisible(false);
    window.open(LINE_OFFICIAL_ACCOUNT_URL, '_blank', 'noopener,noreferrer');
  };

  const handleLater = () => {
    dismissLINEFriendInvite(user.id);
    setVisible(false);
  };

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-labelledby="line-friend-invite-title"
      className="fixed bottom-4 left-4 right-4 z-[120] mx-auto max-w-md rounded-2xl border border-[#06C755]/30 bg-[#FFF9EE] p-5 shadow-xl sm:left-auto sm:right-5"
    >
      <button
        type="button"
        onClick={handleLater}
        aria-label="Close"
        className="absolute right-3 top-3 rounded-full p-1.5 text-[#303532]/55 transition hover:bg-[#F4EFE5]"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <span className="mt-0.5 rounded-full bg-[#E9F8EE] p-2 text-[#285A39]">
          <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h2 id="line-friend-invite-title" className="font-semibold text-[#303532]">{t.title}</h2>
          <p className="mt-1 text-sm leading-6 text-[#303532]/72">{t.body}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-[#06C755] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <MessageCircle aria-hidden="true" className="h-4 w-4" />
          {t.add}
        </button>
        <button
          type="button"
          onClick={handleLater}
          className="rounded-xl border border-[#55766F]/20 px-4 py-2.5 text-sm font-semibold text-[#3F665E]"
        >
          {t.later}
        </button>
      </div>
    </aside>
  );
}
