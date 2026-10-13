import { Mail, MessageCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useCMSLabels } from '../hooks/useCMSLabels';
import { LINE_OFFICIAL_ACCOUNT_URL, type LINEFriendshipStatus } from '../lib/lineOfficialAccount';

interface NotificationPreferencesFieldsProps {
  emailEnabled: boolean;
  lineEnabled: boolean;
  onEmailChange: (enabled: boolean) => void;
  onLineChange: (enabled: boolean) => void;
  lineConnected?: boolean;
  lineFriendship?: LINEFriendshipStatus;
  compact?: boolean;
}

export function NotificationPreferencesFields({
  emailEnabled,
  lineEnabled,
  onEmailChange,
  onLineChange,
  lineConnected = false,
  lineFriendship = 'unknown',
  compact = false,
}: NotificationPreferencesFieldsProps) {
  const { language } = useLanguage();
  const { getLabel } = useCMSLabels();

  const events = [
    getLabel('profile.notifications_type_order', language, language === 'th'
      ? 'การยืนยันคำสั่งซื้อและข้อมูลสำคัญเกี่ยวกับคำสั่งซื้อ'
      : language === 'zh' ? '订单确认及重要订单更新' : 'Order confirmations and important order updates'),
    getLabel('profile.notifications_type_payment', language, language === 'th'
      ? 'การยืนยันและข้อมูลอัปเดตสำคัญเกี่ยวกับการชำระเงิน'
      : language === 'zh' ? '付款确认及重要付款更新' : 'Payment confirmations and important payment updates'),
    getLabel('profile.notifications_type_pickup', language, language === 'th'
      ? 'การแจ้งเตือนรับสินค้าและข้อมูลอัปเดตเกี่ยวกับเวลารับสินค้า'
      : language === 'zh' ? '取货提醒及取货时间更新' : 'Pickup reminders and pickup-time updates'),
    getLabel('profile.notifications_type_receipt', language, language === 'th'
      ? 'การยืนยันรับสินค้า ข้อความขอบคุณ และใบเสร็จ'
      : language === 'zh' ? '取货确认、感谢消息及收据' : 'Pickup confirmation, thank-you messages and receipts'),
    getLabel('profile.notifications_type_missed', language, language === 'th'
      ? 'การแจ้งเตือนเมื่อยังไม่ได้รับสินค้า หรือข้อความติดตามเมื่อจำเป็น'
      : language === 'zh' ? '未取货提醒或必要的后续通知' : 'Missed-pickup or follow-up notices when needed'),
  ];

  const cardClass = compact
    ? 'rounded-xl border border-[#55766F]/16 bg-white/65 p-4'
    : 'rounded-[1.5rem] border border-[#55766F]/14 bg-white/50 p-5 sm:p-6';

  return (
    <section className={cardClass}>
      <h3 className="text-lg font-semibold text-[#303532]">
        {getLabel('profile.notifications_heading', language, language === 'th' ? 'รับการแจ้งเตือนผ่าน' : language === 'zh' ? '通知方式' : 'Notifications via')}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-[#303532]/65">
        {getLabel(
          'profile.notifications_intro',
          language,
          language === 'th'
            ? 'เลือกช่องทางที่คุณต้องการให้ JOKO ส่งข้อมูลสำคัญเกี่ยวกับคำสั่งซื้อ โปรดเลือกอย่างน้อยหนึ่งช่องทาง'
            : language === 'zh'
              ? '请选择 JOKO 向您发送重要订单更新的方式。请至少选择一种通知渠道。'
              : 'Choose how you would like JOKO to send important order updates. Please keep at least one channel selected.',
        )}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#55766F]/18 bg-[#FFF9EE]/80 p-4">
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={(event) => onEmailChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#55766F]/35 accent-[#55766F]"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-semibold text-[#303532]">
              <Mail className="h-4 w-4 text-[#55766F]" aria-hidden="true" />
              {getLabel('profile.notifications_email', language, language === 'th' ? 'อีเมล' : language === 'zh' ? '电子邮箱' : 'Email')}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-[#303532]/60">
              {getLabel(
                'profile.notifications_email_help',
                language,
                language === 'th'
                  ? 'ส่งไปยังอีเมลที่ยืนยันแล้วในบัญชี JOKO ของคุณ'
                  : language === 'zh'
                    ? '发送到您的 JOKO 账户已验证邮箱。'
                    : 'Sent to your verified JOKO account email.',
              )}
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#06C755]/24 bg-[#E9F8EE]/72 p-4">
          <input
            type="checkbox"
            checked={lineEnabled}
            onChange={(event) => onLineChange(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-[#06C755]/45 accent-[#06C755]"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-2 font-semibold text-[#303532]">
              <MessageCircle className="h-4 w-4 text-[#06C755]" aria-hidden="true" />
              {getLabel('profile.notifications_line', language, 'LINE')}
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-[#303532]/60">
              {getLabel(
                'profile.notifications_line_help',
                language,
                language === 'th'
                  ? 'การแจ้งเตือนทาง LINE ต้องเชื่อมต่อบัญชี LINE และเพิ่ม JOKO Today เป็นเพื่อน'
                  : language === 'zh'
                    ? '接收 LINE 通知需要关联 LINE 账号，并将 JOKO Today 添加为好友。'
                    : 'LINE notifications require a connected LINE account and JOKO Today added as a friend.',
              )}
            </span>
          </span>
        </label>
      </div>

      {lineEnabled && (!lineConnected || lineFriendship !== 'friend') && (
        <div className="mt-3 rounded-xl border border-[#06C755]/25 bg-[#F4FBF6] p-3 text-xs leading-relaxed text-[#285A39]">
          <p>
            {getLabel(
              'profile.notifications_line_pending',
              language,
              language === 'th'
                ? 'คุณสามารถเลือก LINE ได้ตอนนี้ ข้อความจะเริ่มส่งเมื่อเชื่อมต่อบัญชี LINE และเพิ่ม JOKO Today เป็นเพื่อนแล้ว'
                : language === 'zh'
                  ? '您现在可以选择 LINE。关联 LINE 账号并将 JOKO Today 添加为好友后，才会开始接收消息。'
                  : 'You can select LINE now. Messages will start once your LINE account is connected and JOKO Today is added as a friend.',
            )}
          </p>
          <a
            href={LINE_OFFICIAL_ACCOUNT_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-3 py-2 font-semibold text-white transition hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {language === 'th' ? 'เพิ่ม JOKO Today ใน LINE' : language === 'zh' ? '在 LINE 添加 JOKO Today' : 'Add JOKO Today on LINE'}
          </a>
        </div>
      )}

      <div className="mt-4 rounded-xl bg-[#CFE3DF]/35 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#55766F]">
          {getLabel('profile.notifications_types_heading', language, language === 'th' ? 'การแจ้งเตือนอาจรวมถึง:' : language === 'zh' ? '通知可能包括：' : 'These may include:')}
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-[#303532]/72">
          {events.map((event) => <li key={event}>• {event}</li>)}
        </ul>
      </div>
    </section>
  );
}
