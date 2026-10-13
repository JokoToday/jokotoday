/// <reference lib="es2021.string" />
import { buildTransactionalEmailShell, escapeHtml, jokoEmailLogoAttachment, renderPrimaryButton, renderSecondaryLink } from './transactional-email.ts';
export type PickupEvent = 'pickup_reminder' | 'pickup_completed' | 'pickup_not_collected';
export interface PickupPayload {
  version: number;
  event_type: PickupEvent;
  order_number: string;
  pickup_date: string;
  slot_start?: string | null;
  slot_end?: string | null;
  location?: { name_en?: string; name_th?: string; name_zh?: string; maps_url?: string } | null;
}
const copy = {
  en: { titles: { pickup_reminder: 'Your JOKO pickup reminder', pickup_completed: 'Thank you for picking up your JOKO order', pickup_not_collected: 'JOKO pickup not yet recorded' },
    messages: { pickup_reminder: 'A reminder about your upcoming pickup. Your selected time window is approximate.', pickup_completed: 'Thank you for picking up your JOKO order. We hope you enjoy it!', pickup_not_collected: "We haven't recorded collection of your JOKO order yet. If you already collected it, please let us know. Otherwise, contact us to discuss the next step." },
    order: 'Order', date: 'Pickup date', location: 'Pickup location', window: 'Approximate pickup time', view: 'View order', help: 'Contact JOKO' },
  th: { titles: { pickup_reminder: 'แจ้งเตือนการรับสินค้าจาก JOKO', pickup_completed: 'ขอบคุณที่มารับสินค้าจาก JOKO', pickup_not_collected: 'ยังไม่มีบันทึกการรับสินค้าจาก JOKO' },
    messages: { pickup_reminder: 'ขอแจ้งเตือนการรับสินค้าของคุณ ช่วงเวลาที่เลือกเป็นเวลาโดยประมาณ', pickup_completed: 'ขอบคุณที่มารับสินค้าจาก JOKO ขอให้คุณเพลิดเพลินกับสินค้าของเรา!', pickup_not_collected: 'เรายังไม่มีบันทึกว่าคุณรับสินค้าจาก JOKO แล้ว หากรับสินค้าแล้ว โปรดแจ้งเรา หากยังไม่ได้รับ โปรดติดต่อเราเพื่อหารือขั้นตอนต่อไป' },
    order: 'คำสั่งซื้อ', date: 'วันที่รับสินค้า', location: 'สถานที่รับสินค้า', window: 'เวลารับสินค้าโดยประมาณ', view: 'ดูคำสั่งซื้อ', help: 'ติดต่อ JOKO' },
  zh: { titles: { pickup_reminder: 'JOKO 取货提醒', pickup_completed: '感谢您领取 JOKO 订单', pickup_not_collected: 'JOKO 尚未记录取货' },
    messages: { pickup_reminder: '提醒您即将到来的取货安排。您选择的时间段是预计到达时间。', pickup_completed: '感谢您领取 JOKO 订单。希望您喜欢我们的商品！', pickup_not_collected: '我们尚未记录您领取 JOKO 订单。如果您已经取货，请告知我们；如果尚未取货，请联系我们讨论下一步安排。' },
    order: '订单', date: '取货日期', location: '取货地点', window: '预计取货时间', view: '查看订单', help: '联系 JOKO' },
} as const;
export function safeHttps(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function renderPickupNotification(payload: PickupPayload, language: string, channel: 'email' | 'line', recipient: string): string {
  if (payload.version !== 1 || !['pickup_reminder', 'pickup_completed', 'pickup_not_collected'].includes(payload.event_type)) throw new Error('Unsupported notification payload');
  const lang = language === 'th' || language === 'zh' ? language : 'en';
  const t = copy[lang];
  const title = t.titles[payload.event_type];
  const location = payload.location?.[`name_${lang}`] || payload.location?.name_en || '';
  const details = [`${t.order}: ${payload.order_number}`, `${t.date}: ${payload.pickup_date}`, ...(location ? [`${t.location}: ${location}`] : []),
    ...(payload.slot_start && payload.slot_end ? [`${t.window}: ${payload.slot_start.slice(0, 5)}–${payload.slot_end.slice(0, 5)}`] : [])];
  const orderUrl = 'https://joko.today/my-orders';
  const supportUrl = 'https://joko.today/contact';
  const maps = safeHttps(payload.location?.maps_url);
  const message = t.messages[payload.event_type];
  if (channel === 'email') {
    return JSON.stringify({ from: 'JOKO TODAY <orders@joko.today>', to: [recipient], subject: title,
      text: [title, message, ...details, `${t.view}: ${orderUrl}`, `${t.help}: ${supportUrl}`, ...(maps ? [maps] : [])].join('\n'),
      attachments: [jokoEmailLogoAttachment()],
      html: buildTransactionalEmailShell({ language: lang, title, preheader: message, eyebrow: `${t.order} · ${payload.order_number}`, heading: title,
        contentHtml: `<p>${escapeHtml(message)}</p>${details.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}${renderPrimaryButton(orderUrl, t.view)}<p style="text-align:center">${renderSecondaryLink(supportUrl, t.help)}</p>${maps ? `<p>${renderSecondaryLink(maps, t.location)}</p>` : ''}`,
        footerText: 'JOKO TODAY' }) });
  }
  return JSON.stringify({ to: recipient, messages: [{ type: 'flex', altText: `${title} · ${payload.order_number}`.slice(0, 400), contents: { type: 'bubble',
    body: { type: 'box', layout: 'vertical', spacing: 'md', contents: [
      { type: 'text', text: 'JOKO TODAY', weight: 'bold', color: '#287D79', size: 'sm' },
      { type: 'text', text: title, weight: 'bold', wrap: true }, { type: 'text', text: message, wrap: true, size: 'sm' },
      ...details.map((line) => ({ type: 'text', text: line.slice(0, 1000), wrap: true, size: 'sm' })),
    ] }, footer: { type: 'box', layout: 'vertical', contents: [
      { type: 'button', style: 'primary', color: '#287D79', action: { type: 'uri', label: t.view, uri: orderUrl } },
      { type: 'button', action: { type: 'uri', label: t.help, uri: supportUrl } },
    ] } } }] });
}
