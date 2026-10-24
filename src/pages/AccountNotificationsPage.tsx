import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Bell, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';

type NotificationCategory = 'orders' | 'test_baker';
type LocalizedCopy = { title?: string; body?: string };
type NotificationContent = Partial<Record<'en' | 'th' | 'zh', LocalizedCopy>>;

interface AccountNotification {
  id: string;
  category: NotificationCategory;
  content: NotificationContent;
  href: string | null;
  delivered_channels: string[];
  created_at: string;
  read_at: string | null;
}

interface AccountNotificationsPageProps {
  onNavigate: (page: string) => void;
}

const copy = {
  en: {
    title: 'Notifications', subtitle: 'Updates for your JOKO TODAY account, orders and test-baker activity.',
    back: 'Back to profile', loading: 'Loading notifications…', empty: 'You’re all caught up.',
    signIn: 'Please sign in to view your account notifications.',
    error: 'Notifications could not be loaded. Please try again.', orders: 'Orders & pickup', testBaker: 'Test baker',
    unread: 'New', read: 'Read', sentVia: 'Also sent by', email: 'Email', line: 'LINE',
  },
  th: {
    title: 'การแจ้งเตือน', subtitle: 'ข่าวสารเกี่ยวกับบัญชี JOKO TODAY คำสั่งซื้อ และกิจกรรมผู้ทดสอบสูตร',
    back: 'กลับไปที่โปรไฟล์', loading: 'กำลังโหลดการแจ้งเตือน…', empty: 'ไม่มีการแจ้งเตือนใหม่',
    signIn: 'กรุณาเข้าสู่ระบบเพื่อดูการแจ้งเตือนในบัญชี',
    error: 'โหลดการแจ้งเตือนไม่สำเร็จ โปรดลองอีกครั้ง', orders: 'คำสั่งซื้อและรับสินค้า', testBaker: 'ผู้ทดสอบสูตร',
    unread: 'ใหม่', read: 'อ่านแล้ว', sentVia: 'ส่งผ่าน', email: 'อีเมล', line: 'LINE',
  },
  zh: {
    title: '通知', subtitle: 'JOKO TODAY 账户、订单和试烘焙活动的最新消息。',
    back: '返回个人资料', loading: '正在加载通知…', empty: '目前没有新通知。',
    signIn: '请登录以查看账户通知。',
    error: '无法加载通知，请重试。', orders: '订单与取货', testBaker: '试烘焙者',
    unread: '新', read: '已读', sentVia: '同时发送至', email: '电子邮件', line: 'LINE',
  },
} as const;

export function AccountNotificationsPage({ onNavigate }: AccountNotificationsPageProps) {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const [items, setItems] = useState<AccountNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const labels = copy[language] ?? copy.en;

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from('account_notifications')
      .select('id, category, content, href, delivered_channels, created_at, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Could not load account notifications:', error);
      setLoadError(true);
      setItems([]);
    } else {
      setItems((data || []) as AccountNotification[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) void loadNotifications();
  }, [authLoading, loadNotifications]);

  const markRead = async (item: AccountNotification) => {
    if (item.read_at || !user || markingId) return;
    setMarkingId(item.id);
    const readAt = new Date().toISOString();
    const { error } = await supabase
      .from('account_notifications')
      .update({ read_at: readAt })
      .eq('id', item.id)
      .eq('user_id', user.id)
      .is('read_at', null);

    if (error) {
      console.error('Could not mark account notification as read:', error);
    } else {
      setItems((current) => current.map((candidate) => (
        candidate.id === item.id ? { ...candidate, read_at: readAt } : candidate
      )));
    }
    setMarkingId(null);
  };

  const getLocalizedCopy = (item: AccountNotification) => {
    const message = item.content[language] || item.content.en || {};
    return {
      title: typeof message.title === 'string' ? message.title : '',
      body: typeof message.body === 'string' ? message.body : '',
    };
  };

  if (authLoading) {
    return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#55766F]" /></div>;
  }

  return (
    <main className="joko-mineral-field min-h-[70vh] px-4 py-8 md:py-12">
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => onNavigate('profile')} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#55766F] hover:text-[#303532]">
          <ArrowLeft className="h-4 w-4" /> {labels.back}
        </button>

        <section className="overflow-hidden rounded-[2rem] border border-[#55766F]/14 bg-[#FFF9EE]/94 shadow-[0_18px_50px_rgba(59,74,69,0.08)]">
          <header className="border-b border-[#55766F]/12 bg-white/55 p-6 md:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#CFE3DF]/70 text-[#55766F]"><Bell className="h-6 w-6" /></span>
              <div>
                <h1 className="text-2xl font-bold text-[#303532] md:text-3xl">{labels.title}</h1>
                <p className="mt-2 text-sm leading-6 text-[#56615B]">{labels.subtitle}</p>
              </div>
            </div>
          </header>

          <div className="space-y-3 p-4 md:p-6">
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-12 text-sm text-[#56615B]"><Loader2 className="h-5 w-5 animate-spin" />{labels.loading}</div>
            ) : loadError ? (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-6 text-center text-sm text-red-800">
                <p>{labels.error}</p>
                <button type="button" onClick={() => void loadNotifications()} className="mt-3 font-semibold underline">{language === 'th' ? 'ลองอีกครั้ง' : language === 'zh' ? '重试' : 'Try again'}</button>
              </div>
            ) : !user ? (
              <div className="rounded-2xl border border-dashed border-[#55766F]/25 bg-white/50 px-5 py-12 text-center text-sm text-[#56615B]">{labels.signIn}</div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#55766F]/25 bg-white/50 px-5 py-12 text-center text-sm text-[#56615B]">{labels.empty}</div>
            ) : items.map((item) => {
              const message = getLocalizedCopy(item);
              const categoryLabel = item.category === 'test_baker' ? labels.testBaker : labels.orders;
              const isUnread = !item.read_at;
              const content = (
                <>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-[#E7EEE8] px-2.5 py-1 font-semibold text-[#46635C]">{categoryLabel}</span>
                    <span className="text-[#6C756F]">{new Date(item.created_at).toLocaleString(language === 'zh' ? 'zh-CN' : language === 'th' ? 'th-TH' : 'en-US')}</span>
                    {isUnread && <span className="rounded-full bg-[#C76624] px-2.5 py-1 font-semibold text-white">{labels.unread}</span>}
                  </div>
                  <h2 className="font-semibold text-[#303532]">{message.title}</h2>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#56615B]">{message.body}</p>
                  {item.delivered_channels.length > 0 && (
                    <p className="mt-3 text-xs text-[#6C756F]">
                      {labels.sentVia}: {item.delivered_channels.map((channel) => channel === 'line' ? labels.line : labels.email).join(' · ')}
                    </p>
                  )}
                </>
              );

              return (
                <article key={item.id} className={`rounded-2xl border p-4 transition md:p-5 ${isUnread ? 'border-[#C76624]/35 bg-[#FFFDF8]' : 'border-[#55766F]/12 bg-white/55'}`}>
                  <div className="flex items-start justify-between gap-4">
                    {item.href ? (
                      <a href={item.href} onClick={() => void markRead(item)} className="min-w-0 flex-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#55766F]">{content}</a>
                    ) : <div className="min-w-0 flex-1">{content}</div>}
                    {isUnread && (
                      <button type="button" aria-label={labels.read} onClick={() => void markRead(item)} disabled={markingId === item.id} className="shrink-0 rounded-xl border border-[#55766F]/20 p-2 text-[#55766F] hover:bg-[#E7EEE8] disabled:opacity-50">
                        {markingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
