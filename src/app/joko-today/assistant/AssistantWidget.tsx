import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../../context/LanguageContext';
import { usePublishedJokoBranding } from '../builder/usePublishedJokoLogo';
import { jokoBrandingCssVariables } from '../../../platform/builder/branding';
import './assistant.css';

type Language = 'en' | 'th';
type Product = { id: string; name: { en: string; th: string }; price: number; product_url: string; available_to_order: boolean; pickups: { pickup_date: string; remaining_quantity: number; locations: { id: string; name: { en: string; th: string } }[] }[] };
type Message = { role: 'user' | 'assistant'; text: string; products?: Product[]; checkedAt?: string };
const copy = {
  en: { title: 'Ask JOKO', welcome: 'What would you like to preorder? I can check products, pickup dates and available quantities.', disclosure: 'AI-assisted answers. Please don’t share personal or payment details.', placeholder: 'Ask about products or pickup…', send: 'Send', close: 'Close', clear: 'Clear chat', wait: 'Checking JOKO…', notice: 'Stock is shared across locations for each date. Checkout confirms final availability.', browse: 'Browse products', contact: 'Contact JOKO', error: 'I couldn’t check availability. Please browse products or contact JOKO.', expired: 'This chat has expired. Clear the chat to start again.', budget: 'The assistant is taking a break. You can still browse and order normally.', checked: 'Checked', unavailable: 'No currently orderable pickup found', open: 'View product', sample: 'What croissants can I preorder?' },
  th: { title: 'ถาม JOKO', welcome: 'อยากสั่งจองอะไรคะ? ฉันช่วยตรวจสอบสินค้า วันรับสินค้า และจำนวนที่เหลือได้', disclosure: 'คำตอบช่วยโดย AI โปรดอย่าส่งข้อมูลส่วนตัวหรือข้อมูลการชำระเงิน', placeholder: 'ถามเกี่ยวกับสินค้าหรือวันรับ…', send: 'ส่ง', close: 'ปิด', clear: 'ล้างแชต', wait: 'กำลังตรวจสอบ…', notice: 'จำนวนสินค้าใช้ร่วมกันทุกจุดรับในแต่ละวัน ระบบจะตรวจสอบอีกครั้งเมื่อสั่งซื้อ', browse: 'ดูสินค้า', contact: 'ติดต่อ JOKO', error: 'ไม่สามารถตรวจสอบสินค้าได้ในขณะนี้ โปรดดูสินค้าหรือติดต่อ JOKO', expired: 'แชตหมดอายุ กรุณาล้างแชตเพื่อเริ่มใหม่', budget: 'ผู้ช่วยพักชั่วคราว คุณยังดูสินค้าและสั่งซื้อได้ตามปกติ', checked: 'ตรวจสอบเมื่อ', unavailable: 'ไม่พบวันรับที่สั่งจองได้ในขณะนี้', open: 'ดูสินค้า', sample: 'มีครัวซองต์อะไรให้สั่งจองบ้าง?' },
};
async function request(path: string, body: object, signal: AbortSignal, method = 'POST') {
  const response = await fetch(`/api/assistant/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal, credentials: 'omit' });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'unavailable');
  return result;
}
function safeProducts(value: unknown): Product[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).filter((p): p is Product => {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string' || typeof p.name?.en !== 'string' || typeof p.name?.th !== 'string' || typeof p.price !== 'number' || !Number.isFinite(p.price) || p.price < 0 || !Array.isArray(p.pickups)) return false;
    try {
      const url = new URL(p.product_url);
      return url.origin === 'https://joko.today' && !url.username && !url.password && !url.search && !url.hash && /^\/products\/[^/]+$/.test(url.pathname) && p.pickups.every((s: Product['pickups'][number]) => /^\d{4}-\d{2}-\d{2}$/.test(s.pickup_date) && Number.isSafeInteger(s.remaining_quantity) && s.remaining_quantity >= 0 && Array.isArray(s.locations) && s.locations.every(l => typeof l.id === 'string' && typeof l.name?.en === 'string' && typeof l.name?.th === 'string'));
    } catch { return false; }
  });
}
export default function AssistantWidget({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { language: siteLanguage } = useLanguage();
  const { branding } = usePublishedJokoBranding();
  const [language, setLanguage] = useState<Language>(siteLanguage === 'th' ? 'th' : 'en');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useRef<string>();
  const controller = useRef<AbortController>();
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const text = copy[language];
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { if (open && !busy) input.current?.focus(); }, [open, busy]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, busy, open]);
  const close = () => { setOpen(false); requestAnimationFrame(() => launcher.current?.focus()); };
  async function send(value = draft) {
    const message = value.trim();
    if (!message || message.length > 1000 || busyRef.current) return;
    busyRef.current = true; setBusy(true); setDraft('');
    setMessages(previous => [...previous, { role: 'user', text: message }]);
    const abort = new AbortController(); controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 85000);
    try {
      if (!session.current) {
        const created = await request('session', {}, abort.signal);
        if (typeof created.sessionId !== 'string') throw new Error('unavailable');
        session.current = created.sessionId;
      }
      const result = await request('messages', { sessionId: session.current, clientRequestId: crypto.randomUUID(), message, language }, abort.signal);
      if (typeof result.answer !== 'string' || result.answer.length > 4000) throw new Error('unavailable');
      setMessages(previous => [...previous, { role: 'assistant', text: result.answer, products: safeProducts(result.products), checkedAt: typeof result.checked_at === 'string' ? result.checked_at : undefined }]);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      const reply = code === 'session_expired' || code === 'session_limit' ? text.expired : code === 'budget_exhausted' || code === 'assistant_disabled' ? text.budget : text.error;
      setMessages(previous => [...previous, { role: 'assistant', text: reply }]);
    } finally { window.clearTimeout(timeout); busyRef.current = false; setBusy(false); }
  }
  async function clear() {
    if (busyRef.current) return;
    const token = session.current;
    if (token) {
      busyRef.current = true; setBusy(true);
      try { await request('session', { sessionId: token }, AbortSignal.timeout(5000), 'DELETE'); }
      catch { /* Expired server state is already cleared; memory is dropped below. */ }
      finally { busyRef.current = false; setBusy(false); }
    }
    session.current = undefined; setMessages([]); setDraft(''); input.current?.focus();
  }
  return <div className="joko-assistant" style={jokoBrandingCssVariables(branding, language)}>
    <button hidden={open} ref={launcher} type="button" className="joko-assistant-launcher" aria-haspopup="dialog" onClick={() => setOpen(true)}>{text.title}</button>
    {open && <section role="dialog" aria-labelledby="joko-assistant-title" className="joko-assistant-panel" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}>
      <header><h2 id="joko-assistant-title">{text.title}</h2><button type="button" onClick={close} aria-label={text.close}>×</button></header>
      <div className="joko-assistant-controls"><select aria-label="Language / ภาษา" value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="en">English</option><option value="th">ไทย</option></select><button type="button" onClick={() => void clear()} disabled={busy}>{text.clear}</button></div>
      <p className="joko-assistant-disclosure">{text.disclosure}</p>
      <div ref={log} role="log" aria-live="polite" aria-relevant="additions" className="joko-assistant-log">
        <p>{text.welcome}</p>
        {!messages.length && <button type="button" className="joko-assistant-sample" disabled={busy} onClick={() => void send(text.sample)}>{text.sample}</button>}
        {messages.map((message, index) => <div key={index} className={`joko-assistant-message ${message.role}`}><p>{message.text}</p>
          {message.products?.map(product => <article key={product.id} className="joko-assistant-product"><strong>{product.name[language] || product.name.en}</strong><span>{new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency: 'THB' }).format(product.price)}</span>
            {product.pickups.length ? product.pickups.map(pickup => <p key={pickup.pickup_date}>{pickup.pickup_date} · {pickup.remaining_quantity} {language === 'th' ? 'ชิ้น' : 'remaining'} · {pickup.locations.map(l => l.name[language] || l.name.en).join(', ')}</p>) : <p>{text.unavailable}</p>}
            <a href={new URL(product.product_url).pathname} onClick={close}>{text.open}</a>
          </article>)}
          {message.checkedAt && Number.isFinite(Date.parse(message.checkedAt)) && <small>{text.checked}: {new Date(message.checkedAt).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB', { timeZone: 'Asia/Bangkok' })}</small>}
        </div>)}
        {busy && <p role="status">{text.wait}</p>}
      </div>
      <form onSubmit={event => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor="joko-assistant-input">{text.placeholder}</label><textarea ref={input} id="joko-assistant-input" value={draft} maxLength={1000} rows={2} placeholder={text.placeholder} onChange={event => setDraft(event.target.value)} disabled={busy} /><button type="submit" disabled={busy || !draft.trim()}>{text.send}</button></form>
      <p className="joko-assistant-disclosure">{text.notice}</p>
      <footer><button type="button" onClick={() => { close(); onNavigate('products'); }}>{text.browse}</button><a href="#joko-contact" onClick={close}>{text.contact}</a></footer>
    </section>}
  </div>;
}
