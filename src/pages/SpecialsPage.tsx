import { useCallback, useEffect, useRef, useState } from "react";
import { Check, MapPin, Minus, Plus, ShoppingBag } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";
import { specialsCustomerCopy } from "../features/specials/customerCopy";
import { useAuth } from "../context/AuthContext";
import { SpecialsPaymentPanel } from "../features/specials/SpecialsPaymentPanel";
import {
  specialsError,
  specialsRpc,
  type SpecialsCatalog,
} from "../features/specials/customer";
export default function SpecialsPage({
  onNavigate,
}: {
  onNavigate: (page: string) => void;
}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const copy = specialsCustomerCopy[language];
  const locale = language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'en-GB';
  const money = (satang: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'THB' }).format(satang / 100);
  const time = (value: string) => new Date(value).toLocaleTimeString(locale, { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });
  const date = (value: string) => new Date(value).toLocaleDateString(locale, { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' });
  const [catalog, setCatalog] = useState<SpecialsCatalog>({}),
    [cart, setCart] = useState<Record<string, number>>({}),
    [order, setOrder] = useState<string | null>(
      new URLSearchParams(window.location.search).get("order"),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const inFlight = useRef(false);
  const load = useCallback(async () => {
    try {
      setCatalog(await specialsRpc<SpecialsCatalog>("specials_catalog_v1"));
      setLoaded(true);
    } catch (e) {
      setLoaded(true);
      setError(specialsError(e));
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem(`specials-order:${user.id}`);
    if (!order && saved) setOrder(saved);
  }, [user, order]);
  async function checkout() {
    if (inFlight.current || !user) return;
    const storedRequest = localStorage.getItem(`specials-request:${user.id}`);
    if (!catalog.batch && !storedRequest) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    const rows = Object.entries(cart)
      .filter(([, quantity]) => quantity > 0)
      .map(([item_id, quantity]) => ({ item_id, quantity }))
      .sort((a, b) => a.item_id.localeCompare(b.item_id));
    const storageKey = `specials-request:${user.id}`;
    try {
      const stored = localStorage.getItem(storageKey);
      const request = stored
        ? JSON.parse(stored)
        : {
            p_batch: catalog.batch?.id,
            p_cart: rows,
            p_key: crypto.randomUUID(),
          };
      localStorage.setItem(storageKey, JSON.stringify(request));
      const result = await specialsRpc<{ order_id: string }>(
        "specials_checkout_v1",
        request,
      );
      localStorage.setItem(`specials-order:${user.id}`, result.order_id);
      localStorage.removeItem(storageKey);
      setOrder(result.order_id);
      await load();
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        /^(22|23|28|40|42|P0)/.test(String(e.code))
      )
        localStorage.removeItem(storageKey);
      setError(specialsError(e));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  // A new daily batch starts a new selection; saved checkout retries keep their exact payload.
  useEffect(() => setCart({}), [catalog.batch?.id]);
  const items = catalog.items || [];
  const batch = catalog.batch;
  const selected = items.filter(item => (cart[item.id] || 0) > 0);
  const total = selected.reduce((sum, item) => sum + item.price_satang * cart[item.id], 0);
  const limit = (item: (typeof items)[number]) => Math.min(item.available, item.max_per_customer ?? item.available);
  const invalid = selected.some(item => cart[item.id] > limit(item));
  const pending = Boolean(user && localStorage.getItem(`specials-request:${user.id}`));
  const name = (item: (typeof items)[number]) => language === 'th' ? item.name_th || item.name_en : item.name_en;
  const location = batch ? (language === 'th' ? batch.location.name_th || batch.location.name_en : batch.location.name_en) : '';
  const mapUrl = batch?.location.maps_url && /^https?:\/\//i.test(batch.location.maps_url) ? batch.location.maps_url : null;
  function quantity(item: (typeof items)[number], value: number) {
    if (busy || pending) return;
    setCart(previous => ({ ...previous, [item.id]: Math.max(0, Math.min(limit(item), Math.floor(value || 0))) }));
  }
  const actionClass = 'min-h-11 rounded-xl bg-[#C76624] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#A95120] disabled:opacity-50';
  return (
    <main className="joko-mineral-field min-h-screen text-[#303532]">
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-9 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-8 grid items-center gap-7 md:grid-cols-[minmax(0,1fr)_17rem]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#55766F]">{copy.eyebrow}</p>
            <h1 className="mt-3 text-4xl leading-tight tracking-[-0.035em] sm:text-5xl lg:text-6xl" style={{ fontFamily: 'var(--joko-font-display)' }}>
              {copy.heading}<br /><span className="text-[#C76624]">{copy.accent}</span>
            </h1>
            <span className="mt-4 block h-[3px] w-40 -rotate-1 rounded-full bg-[#D98242]/75" aria-hidden="true" />
            <p className="mt-5 max-w-xl text-base leading-7 text-[#303532]/75">{copy.intro}</p>
          </div>
          {batch && <aside className="rounded-2xl border border-[#55766F]/15 bg-[#CFE3DF]/65 p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#55766F]">{copy.pickup}</p>
            <h2 className="mt-3 text-2xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{location}</h2>
            <p className="mt-3 text-sm">{date(batch.pickup_start_at)} · {time(batch.pickup_start_at)}–{time(batch.pickup_end_at)}</p>
            <p className="mt-2 text-xs text-[#303532]/70">{copy.closes} {time(new Date(new Date(batch.sales_end_at).getTime() - 5 * 60000).toISOString())} · {copy.timezone}</p>
            {mapUrl && <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm text-[#55766F] underline underline-offset-4"><MapPin className="h-4 w-4" />{copy.maps}</a>}
          </aside>}
        </div>
        <div className="mb-8 flex flex-wrap gap-x-7 gap-y-3 border-y border-[#55766F]/20 py-4">
          {copy.rules.map(rule => <span key={rule} className="inline-flex items-center gap-2 text-xs text-[#303532]/75"><Check className="h-4 w-4 text-[#55766F]" aria-hidden="true" />{rule}</span>)}
        </div>
        {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {user && order ? (
          <section className="mx-auto max-w-3xl">
            <SpecialsPaymentPanel orderId={order} />
            <div className="mt-5 flex flex-wrap gap-4">
              <button type="button" className="min-h-11 text-sm text-[#55766F] underline underline-offset-4" onClick={() => {
                localStorage.removeItem(`specials-order:${user.id}`);
                setOrder(null);
              }}>{copy.browse}</button>
              <button type="button" className="min-h-11 text-sm text-[#55766F] underline underline-offset-4" onClick={() => onNavigate('orders')}>{copy.orders}</button>
            </div>
          </section>
        ) : (
          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section>
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-2xl sm:text-3xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{batch?.title || copy.today}</h2>
                {batch && <span className="text-xs text-[#303532]/65">{copy.lasts}</span>}
              </div>
              {batch && items.length ? <div className="grid gap-5 sm:grid-cols-2">
                {items.map(item => <article key={item.id} className="overflow-hidden rounded-2xl border border-[#55766F]/20 bg-[#FFF9EE]">
                  <div className="relative flex h-44 items-center justify-center bg-[#CFE3DF]/45 sm:h-48">
                    {item.image ? <img src={item.image} alt={name(item)} loading="lazy" className="h-full w-full object-cover" /> : <ShoppingBag className="h-10 w-10 text-[#55766F]" aria-hidden="true" />}
                    <span className="absolute left-3 top-3 rounded-full bg-[#FFF9EE] px-3 py-1.5 text-xs font-medium text-[#C76624]">{item.available > 0 ? copy.special : copy.soldOut}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{name(item)}</h3>
                    {language === 'en' && item.name_th && <p className="mt-1 text-xs text-[#303532]/65">{item.name_th}</p>}
                    <p className="my-4 flex flex-wrap items-center gap-3"><span className="text-xl font-semibold text-[#C76624]">{money(item.price_satang)}</span>{item.regular_price_satang > item.price_satang && <s className="text-sm text-[#303532]/55">{money(item.regular_price_satang)}</s>}</p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-xs text-[#55766F]">{item.available > 0 ? `${item.available} ${copy.available}` : copy.soldOut}</span>
                      {(cart[item.id] || 0) > 0 ? <div className="flex items-center gap-2">
                        <button type="button" aria-label={`${copy.remove}: ${name(item)}`} disabled={busy || pending} onClick={() => quantity(item, cart[item.id] - 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#55766F]/25 disabled:opacity-50"><Minus className="h-4 w-4" /></button>
                        <label className="sr-only" htmlFor={`specials-qty-${item.id}`}>{copy.quantity}: {name(item)}</label>
                        <input id={`specials-qty-${item.id}`} type="number" min={0} max={limit(item)} value={cart[item.id]} disabled={busy || pending} aria-invalid={cart[item.id] > limit(item)} onChange={event => quantity(item, Number(event.target.value))} className="h-11 w-14 rounded-lg border border-[#55766F]/25 bg-[#FFF9EE] text-center text-base aria-[invalid=true]:border-red-600" />
                        <button type="button" aria-label={`${copy.add}: ${name(item)}`} disabled={busy || pending || cart[item.id] >= limit(item)} onClick={() => quantity(item, cart[item.id] + 1)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#55766F]/25 disabled:opacity-50"><Plus className="h-4 w-4" /></button>
                      </div> : <button type="button" disabled={busy || pending || item.available <= 0} onClick={() => quantity(item, 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#55766F]/25 px-4 text-sm disabled:opacity-50">{item.available > 0 ? copy.add : copy.soldOut}{item.available > 0 && <Plus className="h-4 w-4" aria-hidden="true" />}</button>}
                    </div>
                  </div>
                </article>)}
              </div> : <div className="rounded-2xl border border-[#55766F]/20 bg-[#FFF9EE]/80 p-7">
                <h3 className="text-xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{loaded ? copy.noSpecials : copy.loading}</h3>
                {loaded && <p className="mt-3 text-sm text-[#303532]/70">{copy.checkLater}</p>}
              </div>}
            </section>
            <aside className="rounded-2xl border border-[#55766F]/20 bg-[#F4EFE5] p-6">
              <h2 className="text-2xl" style={{ fontFamily: 'var(--joko-font-display)' }}>{copy.basket}</h2>
              {batch && <p className="mt-2 text-xs text-[#303532]/70">{copy.pickup} · {location}</p>}
              <div className="mt-5" aria-live="polite">
                {selected.length ? selected.map(item => <div key={item.id} className="flex items-start justify-between gap-3 border-b border-[#55766F]/20 py-3 text-sm">
                  <span className="min-w-0 break-words">{cart[item.id]} × {name(item)}</span><span className="shrink-0">{money(item.price_satang * cart[item.id])}</span>
                </div>) : <p className="text-sm leading-6 text-[#303532]/70">{copy.emptyBasket}</p>}
              </div>
              <div className="my-6 flex justify-between gap-3"><span>{copy.total}</span><strong>{money(total)}</strong></div>
              {invalid && <p role="alert" className="mb-4 text-sm text-red-800">{copy.changed}</p>}
              {user ? <button type="button" className={`${actionClass} w-full`} disabled={busy || (!pending && (total <= 0 || invalid || !batch))} onClick={() => void checkout()}>{busy ? copy.busy : pending ? copy.retry : copy.pay}</button> : <button type="button" className={`${actionClass} w-full`} disabled={!batch} onClick={() => onNavigate('login')}>{copy.signIn}</button>}
              <p className="mt-4 text-xs leading-6 text-[#303532]/70">{copy.hold}</p>
              {pending && <div className="mt-5 border-t border-[#55766F]/20 pt-4"><p className="text-xs leading-6">{copy.pending}</p><button type="button" className="mt-2 min-h-11 text-sm underline underline-offset-4" onClick={() => onNavigate('orders')}>{copy.orders}</button></div>}
            </aside>
          </div>
        )}
        <p className="mt-8 border-t border-[#55766F]/20 pt-6 text-sm leading-7 text-[#303532]/70"><strong className="text-[#303532]">{copy.different}</strong> {copy.separate}</p>
      </div>
    </main>
  );
}
