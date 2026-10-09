import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { SpecialsPaymentPanel } from "../features/specials/SpecialsPaymentPanel";
import {
  specialsError,
  specialsRpc,
  specialsTime,
  type SpecialsCatalog,
} from "../features/specials/customer";
export default function SpecialsPage({
  onNavigate,
}: {
  onNavigate: (page: string) => void;
}) {
  const { user } = useAuth();
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
  const total =
    (catalog.items || []).reduce(
      (sum, item) => sum + item.price_satang * (cart[item.id] || 0),
      0,
    ) / 100;
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-5 py-10">
      <h1 className="text-3xl font-semibold">JOKO Specials / ขนมราคาพิเศษ</h1>
      <p>
        Made by JOKO. Limited surplus, special prices, same-day pickup only.
        This checkout is separate from your regular bakery cart.
      </p>
      {user && order ? (
        <>
          <SpecialsPaymentPanel orderId={order} />
          <button
            className="underline"
            onClick={() => {
              localStorage.removeItem(`specials-order:${user.id}`);
              setOrder(null);
            }}
          >
            Browse today’s Specials
          </button>
          <button
            className="ml-5 underline"
            onClick={() => onNavigate("orders")}
          >
            My Orders
          </button>
        </>
      ) : catalog.batch ? (
        <>
          <h2 className="text-xl">{catalog.batch.title}</h2>
          <p>
            {catalog.batch.location.name_en} / {catalog.batch.location.name_th}{" "}
            · {specialsTime(catalog.batch.pickup_start_at)}–
            {specialsTime(catalog.batch.pickup_end_at)} (Bangkok)
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {catalog.items?.map((item) => (
              <article key={item.id} className="rounded-2xl border p-5">
                {item.image && (
                  <img
                    className="mb-3 h-40 w-full rounded-xl object-cover"
                    src={item.image}
                    alt={item.name_en}
                  />
                )}
                <h3 className="font-semibold">
                  {item.name_en} / {item.name_th}
                </h3>
                <p>
                  <s className="mr-3 opacity-50">
                    ฿{(item.regular_price_satang / 100).toFixed(2)}
                  </s>
                  ฿{(item.price_satang / 100).toFixed(2)}
                </p>
                <p>{item.available} available</p>
                <label>
                  Quantity{" "}
                  <input
                    className="ml-3 w-20 rounded border p-2"
                    type="number"
                    min={0}
                    max={Math.min(
                      item.available,
                      item.max_per_customer || item.available,
                    )}
                    value={cart[item.id] || 0}
                    disabled={busy}
                    onChange={(e) =>
                      setCart({
                        ...cart,
                        [item.id]: Math.max(
                          0,
                          Math.min(
                            item.available,
                            item.max_per_customer || item.available,
                            Math.floor(Number(e.target.value) || 0),
                          ),
                        ),
                      })
                    }
                  />
                </label>
              </article>
            ))}
          </div>
          {user ? (
            <button
              className="rounded-xl bg-[#305c46] px-6 py-3 text-white disabled:opacity-50"
              disabled={
                busy ||
                (total <= 0 &&
                  !localStorage.getItem(`specials-request:${user.id}`))
              }
              onClick={() => void checkout()}
            >
              {localStorage.getItem(`specials-request:${user.id}`)
                ? "Retry pending checkout"
                : `Hold stock & pay ฿${total.toFixed(2)}`}
            </button>
          ) : (
            <button className="underline" onClick={() => onNavigate("login")}>
              Sign in to checkout / เข้าสู่ระบบ
            </button>
          )}
          <p>
            Your 15-minute hold begins when checkout succeeds. Availability and
            prices are checked on the server.
          </p>
        </>
      ) : (
        <p>
          {loaded
            ? "No Specials are available now. Please check again later."
            : "Loading today’s Specials…"}
        </p>
      )}
      {user &&
        !order &&
        localStorage.getItem(`specials-request:${user.id}`) && (
          <div className="rounded-xl border p-4">
            <p>
              A checkout request is awaiting confirmation. Retry the saved cart
              before creating another checkout.
            </p>
            <button
              className="underline"
              disabled={busy}
              onClick={() => void checkout()}
            >
              Recover saved checkout
            </button>
            <button
              className="ml-4 underline"
              onClick={() => onNavigate("orders")}
            >
              Check My Orders
            </button>
          </div>
        )}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </main>
  );
}
