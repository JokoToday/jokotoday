import { SpecialsPrice } from './SpecialsPrice';
import { SpecialsOperations } from './SpecialsOperations';
import { SpecialsPageContentEditor } from './SpecialsPageContentEditor';
import { specialsLabels } from "./copy";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { RefreshCw, Tag } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import type {
  SpecialsAction,
  SpecialsAuditEvent,
  SpecialsBatch,
  SpecialsItem,
  SpecialsLocation,
  SpecialsOperation,
  SpecialsProduct,
} from "./contracts";
import { bangkokInputValue, bangkokInstant, priceToSatang } from "./time";
import {
  loadSpecialsBatch,
  loadSpecialsWorkspace,
  performSpecialsOperation,
} from "./service";

type BatchForm = {
  title: string;
  pickup_location_id: string;
  sales_start_at: string;
  sales_end_at: string;
  pickup_start_at: string;
  pickup_end_at: string;
  notes_internal: string;
};
function initialForm(): BatchForm {
  const now = new Date();
  const at = (minutes: number) =>
    bangkokInputValue(new Date(now.getTime() + minutes * 60000));
  return {
    title: "Specials Selection",
    pickup_location_id: "",
    sales_start_at: at(0),
    sales_end_at: at(60),
    pickup_start_at: at(0),
    pickup_end_at: at(90),
    notes_internal: "",
  };
}
function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error)
    return String(error.message);
  return "Could not load or save JOKO Specials.";
}

export function SpecialsManagement() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const copy = specialsLabels[language];
  const [batches, setBatches] = useState<SpecialsBatch[]>([]);
  const [products, setProducts] = useState<SpecialsProduct[]>([]);
  const [locations, setLocations] = useState<SpecialsLocation[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const initialSelectionLoaded = useRef(false);
  const [pastDate, setPastDate] = useState("");
  const [items, setItems] = useState<SpecialsItem[]>([]);
  const [events, setEvents] = useState<SpecialsAuditEvent[]>([]);
  const [form, setForm] = useState<BatchForm>(initialForm);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<SpecialsOperation | null>(null);
  const pendingRef = useRef<SpecialsOperation | null>(null);
  const batchLoadGeneration = useRef(0);
  const busyRef = useRef(false);
  const [productId, setProductId] = useState("");
  const [editItem, setEditItem] = useState<SpecialsItem | null>(null);
  const [price, setPrice] = useState("");
  const [cap, setCap] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [transferItemId, setTransferItemId] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState("1");
  const [source, setSource] = useState("");
  const [reason, setReason] = useState("");
  const [customSource, setCustomSource] = useState(false);
  const [customReason, setCustomReason] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [customCloseReason, setCustomCloseReason] = useState(false);
  const [isolated, setIsolated] = useState(false);
  const [quality, setQuality] = useState(false);
  const storageKey = `joko-specials-operation:${user?.id || ""}`;
  const batch = batches.find((candidate) => candidate.id === batchId);
  const locked = busy || loading || Boolean(pending);
  const isActiveSelection = (selection: SpecialsBatch) => !["closed", "cancelled"].includes(selection.status) && new Date(selection.pickup_end_at).getTime() > Date.now();
  const activeSelections = batches.filter(isActiveSelection).sort((a, b) => b.business_date.localeCompare(a.business_date) || b.sales_start_at.localeCompare(a.sales_start_at));
  const pastSelections = batches.filter(selection => !isActiveSelection(selection)).sort((a, b) => b.business_date.localeCompare(a.business_date) || b.sales_start_at.localeCompare(a.sales_start_at));
  const selectionLabel = (selection: SpecialsBatch) => `${selection.business_date} · ${selection.title} · ${selection.status}`;
  const productName = (product?: SpecialsProduct) =>
    product?.[`name_${language}`] || product?.name_en || "—";
  const selectedProduct = products.find(product => product.id === productId);
  const productDescription = (product?: SpecialsProduct) => product?.[`desc_${language}`] || product?.desc_en || "";
  const location = locations.find(
    (candidate) => candidate.id === batch?.pickup_location_id,
  );
  const time = (value: string) =>
    new Intl.DateTimeFormat(
      language === "th" ? "th-TH" : language === "zh" ? "zh-CN" : "en-GB",
      {
        timeZone: "Asia/Bangkok",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      },
    ).format(new Date(value));
  const money = (satang: number) => `฿${(satang / 100).toFixed(2)}`;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadSpecialsWorkspace();
      setBatches(data.batches);
      if (!initialSelectionLoaded.current) {
        initialSelectionLoaded.current = true;
        const active = data.batches.filter(selection => !["closed", "cancelled"].includes(selection.status) && new Date(selection.pickup_end_at).getTime() > Date.now());
        const priority = (selection: SpecialsBatch) => selection.status === "live" ? 0 : selection.status === "prepared" ? 1 : 2;
        active.sort((a, b) => priority(a) - priority(b) || b.business_date.localeCompare(a.business_date));
        if (active[0]) setBatchId(active[0].id);
      }
      setProducts(data.products);
      setLocations(data.locations);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      const value = stored ? (JSON.parse(stored) as SpecialsOperation) : null;
      pendingRef.current = value;
      setPending(value);
    } catch {
      setError(
        "Could not restore the pending operation. Check the audit history before transferring stock.",
      );
    }
  }, [storageKey]);
  useEffect(() => {
    const generation = ++batchLoadGeneration.current;
    setItems([]);
    setEvents([]);
    setTransferItemId("");
    setEditItem(null);
    setProductId("");
    setPrice("");
    setCap("");
    setIsolated(false);
    setQuality(false);
    setSource("");
    setReason("");
    setCustomSource(false);
    setCustomReason(false);
    setCloseReason("");
    setCustomCloseReason(false);
    if (!batchId) return;
    void loadSpecialsBatch(batchId)
      .then((data) => {
        if (generation !== batchLoadGeneration.current) return;
        setItems(data.items);
        setEvents(data.events);
      })
      .catch((err) => {
        if (generation === batchLoadGeneration.current)
          setError(errorMessage(err));
      });
  }, [batchId, batches]);
  useEffect(() => {
    if (!batch) return;
    setForm({
      title: batch.title,
      pickup_location_id: batch.pickup_location_id,
      sales_start_at: bangkokInputValue(new Date(batch.sales_start_at)),
      sales_end_at: bangkokInputValue(new Date(batch.sales_end_at)),
      pickup_start_at: bangkokInputValue(new Date(batch.pickup_start_at)),
      pickup_end_at: bangkokInputValue(new Date(batch.pickup_end_at)),
      notes_internal: batch.notes_internal,
    });
  }, [batch]);

  const run = async (
    action: SpecialsAction,
    request: Record<string, unknown>,
    replay = false,
  ) => {
    if (busyRef.current) return;
    if (!replay && pendingRef.current) {
      setError(copy.uncertain);
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const operation =
      replay && pendingRef.current
        ? pendingRef.current
        : { action, request, operationKey: crypto.randomUUID() };
    try {
      // Persist BEFORE calling the server: reconnect/reload must reuse this key.
      sessionStorage.setItem(storageKey, JSON.stringify(operation));
      pendingRef.current = operation;
      setPending(operation);
      const result = await performSpecialsOperation(operation);
      sessionStorage.removeItem(storageKey);
      pendingRef.current = null;
      setPending(null);
      setBatchId(result.batch.id);
      setNotice(action === "save_batch" ? "Draft saved. Add product offers and stock before publishing." : action === "save_item" ? "Offer saved. Add counted stock before preparing the selection." : action === "transfer" ? (request.direction === "in" ? "Stock added to Specials successfully." : "Unsold stock released from Specials successfully.") : action === "prepare" ? "Selection prepared. Use Publish prepared Specials to open checkout." : copy.saved);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
      // A definitive database validation failure rolls back the transaction.
      const code =
        err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (/^(22|23|28|40|42|P0)/.test(code)) {
        sessionStorage.removeItem(storageKey);
        pendingRef.current = null;
        setPending(null);
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const batchRequest = () => ({
    batch_id: batch?.id,
    expected_version: batch?.version,
  });
  const saveBatch = (event: FormEvent) => {
    event.preventDefault();
    try {
      void run("save_batch", {
        ...batchRequest(),
        ...form,
        business_date: form.sales_start_at.slice(0, 10),
        sales_start_at: bangkokInstant(form.sales_start_at),
        sales_end_at: bangkokInstant(form.sales_end_at),
        pickup_start_at: bangkokInstant(form.pickup_start_at),
        pickup_end_at: bangkokInstant(form.pickup_end_at),
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const saveItem = (event: FormEvent) => {
    event.preventDefault();
    try {
      void run("save_item", {
        ...batchRequest(),
        item_id: editItem?.id,
        item_version: editItem?.version,
        product_id: productId,
        special_price_satang: priceToSatang(price),
        max_per_customer: cap ? Number(cap) : null,
        is_enabled: enabled,
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  const transfer = (event: FormEvent) => {
    event.preventDefault();
    void run("transfer", {
      ...batchRequest(),
      item_id: transferItemId,
      direction,
      quantity: Number(quantity),
      source_reference: source.trim(),
      reason: reason.trim(),
      physically_isolated: isolated,
      unallocated_and_good_quality: quality,
    });
  };
  const close = (action: "close" | "cancel") => {
    if (!closeReason.trim()) {
      setError(copy.reason);
      return;
    }
    void run(action, { ...batchRequest(), reason: closeReason.trim() });
  };

  return (
    <section className="space-y-6 pt-6">
      {notice && <div role="status" className="fixed bottom-6 right-6 z-50 flex max-w-md items-start gap-4 rounded-xl border border-[#55766F]/30 bg-[#E6EEE9] p-4 text-[#303532] shadow-lg">
        <p>{notice}</p><button type="button" aria-label="Dismiss confirmation" className="font-semibold text-[#C76624]" onClick={() => setNotice("")}>×</button>
      </div>}
      <SpecialsPageContentEditor />
      <div className="joko-admin-paper-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="joko-admin-title flex items-center gap-2 text-3xl">
              <Tag className="h-6 w-6" />
              {copy.title}
            </h1>
            <p className="mt-2 text-sm">{copy.intro}</p>
          </div>
          <div className="flex gap-2">
            <button
              className="joko-admin-secondary-button px-3 py-2"
              disabled={locked}
              onClick={() => {
                setBatchId(null);
                setForm(initialForm());
                setItems([]);
                setEvents([]);
                setNotice("");
              }}
            >
              {copy.newBatch}
            </button>
            <button
              className="joko-admin-secondary-button flex items-center gap-2 px-3 py-2"
              disabled={busy}
              onClick={() => void refresh()}
            >
              <RefreshCw className="h-4 w-4" />
              {copy.refresh}
            </button>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-[#E6EEE9] p-3 text-sm">Select a saved selection below → choose a catalogue product and Specials price → add counted stock → prepare the selection → publish checkout. Saving a draft does not publish it.</p>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-3 text-sm text-[#45645E]">
            {notice}
          </p>
        )}
        {pending && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm">
            <p>{copy.uncertain}</p>
            <button
              className="joko-admin-secondary-button mt-2 px-3 py-2"
              disabled={busy}
              onClick={() => void run(pending.action, pending.request, true)}
            >
              {copy.retry}
            </button>
          </div>
        )}
        {loading && (
          <p role="status" className="mt-3">
            {copy.refresh}…
          </p>
        )}
        {!loading && batches.length === 0 && (
          <p className="mt-4 text-sm">{copy.empty}</p>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="block w-full max-w-md text-sm">
            {language === "th" ? "ชุด Specials ที่ใช้งานอยู่" : language === "zh" ? "当前 Specials 精选" : "Active selections"}
            <select className="joko-admin-field mt-1 w-full" disabled={locked} value={activeSelections.some(selection => selection.id === batchId) ? batchId || "" : ""} onChange={event => setBatchId(event.target.value || null)}>
              <option value="">{activeSelections.length ? "Choose active selection" : "No active selections"}</option>
              {activeSelections.map(selection => <option key={selection.id} value={selection.id}>{selectionLabel(selection)}</option>)}
            </select>
          </label>
          <label className="block w-full max-w-md text-sm">
            {language === "th" ? "ชุด Specials ที่ผ่านมา" : language === "zh" ? "往期 Specials 精选" : "Past selections"}
            <select className="joko-admin-field mt-1 w-full" disabled={locked} value={pastSelections.some(selection => selection.id === batchId) ? batchId || "" : ""} onChange={event => setBatchId(event.target.value || null)}>
              <option value="">Choose past selection</option>
              {pastSelections.filter(selection => !pastDate || selection.business_date === pastDate || selection.id === batchId).map(selection => <option key={selection.id} value={selection.id}>{selectionLabel(selection)}</option>)}
            </select>
          </label>
          <label className="block text-sm">Search past selections by date
            <input type="date" className="joko-admin-field mt-1 block" value={pastDate} disabled={locked} onChange={event => setPastDate(event.target.value)} />
          </label>
          {pastDate && <button className="joko-admin-secondary-button px-3 py-2" disabled={locked} onClick={() => setPastDate("")}>Clear date</button>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <form
          onSubmit={saveBatch}
          className="joko-admin-paper-card space-y-4 p-5"
        >
          <fieldset
            disabled={locked || Boolean(batch && batch.status !== "draft")}
            className="space-y-4"
          >
            <label className="block text-sm">
              {copy.titleField}
              <input
                required
                maxLength={120}
                className="joko-admin-field mt-1 w-full"
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </label>
            <label className="block text-sm">
              {copy.location}
              <select
                required
                className="joko-admin-field mt-1 w-full"
                value={form.pickup_location_id}
                onChange={(event) =>
                  setForm({ ...form, pickup_location_id: event.target.value })
                }
              >
                <option value="">—</option>
                {locations.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place[`name_${language}`] || place.name_en}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  "sales_start_at",
                  "sales_end_at",
                  "pickup_start_at",
                  "pickup_end_at",
                ] as const
              ).map((field, index) => (
                <label key={field} className="block text-sm">
                  {
                    [copy.start, copy.end, copy.pickupStart, copy.pickupEnd][
                      index
                    ]
                  }
                  <input
                    type="datetime-local"
                    required
                    className="joko-admin-field mt-1 w-full"
                    value={form[field]}
                    onChange={(event) =>
                      setForm({ ...form, [field]: event.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="text-xs leading-5 text-[#303532]/65">{copy.times}</p>
            <label className="block text-sm">
              {copy.notes}
              <textarea
                maxLength={2000}
                className="joko-admin-field mt-1 w-full"
                value={form.notes_internal}
                onChange={(event) =>
                  setForm({ ...form, notes_internal: event.target.value })
                }
              />
            </label>
            <button
              type="submit"
              className="joko-admin-primary-button px-4 py-2"
            >
              {copy.save}
            </button>
          </fieldset>
          {batch && batch.status !== "draft" && (
            <p className="text-sm">{copy.draftOnly}</p>
          )}
        </form>
        <div className="joko-admin-paper-card space-y-4 p-5">
          <h2 className="joko-admin-title text-xl">{copy.preview}</h2>
          {batch ? (
            <>
              <h3 className="joko-admin-title text-2xl">{batch.title}</h3>
              <p className="text-sm">
                {copy.today} · {batch.business_date}
                <br />
                {location?.[`name_${language}`] ||
                  location?.name_en ||
                  "—"} · {time(batch.pickup_start_at)}–
                {time(batch.pickup_end_at)}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {items
                  .filter((item) => item.is_enabled)
                  .map((item) => {
                    const product = products.find(
                      (candidate) => candidate.id === item.product_id,
                    );
                    return (
                      <article
                        key={item.id}
                        className="rounded-xl border border-[#55766F]/20 bg-[#F7F3EA] p-3"
                      >
                        {product?.image && (
                          <img
                            src={product.image}
                            alt={productName(product)}
                            className="mb-2 h-28 w-full rounded-lg object-contain"
                            loading="lazy"
                          />
                        )}
                        <h4 className="font-semibold">
                          {productName(product)}
                        </h4>
                        {productDescription(product) && <p className="my-2 whitespace-pre-line text-sm">{productDescription(product)}</p>}
                        <SpecialsPrice regular={item.regular_price_satang} special={item.special_price_satang} money={money} />
                        <p className="text-xs">
                          {Math.round(
                            (1 -
                              item.special_price_satang /
                                item.regular_price_satang) *
                              100,
                          )}
                          % · {item.quantity_available} {copy.available}
                        </p>
                      </article>
                    );
                  })}
              </div>
            </>
          ) : (
            <p className="text-sm">{batches.length ? "Select a saved selection above to add products, stock and publish it." : copy.empty}</p>
          )}
        </div>
      </div>
      {batch && (
        <>
          {batch.status === "draft" && (
            <form
              onSubmit={saveItem}
              className="joko-admin-paper-card space-y-4 p-5"
            >
              <h2 className="joko-admin-title text-xl">{copy.add}</h2>
              <p className="text-sm">Choose an existing catalogue product. Its name, image and regular price are reused; enter only the Specials price and optional customer limit.</p>
              {selectedProduct && <div className="rounded-xl border border-[#55766F]/20 p-4">
                {selectedProduct.image && <img src={selectedProduct.image} alt={productName(selectedProduct)} className="mb-3 h-28 w-28 object-contain" />}
                <strong>{productName(selectedProduct)}</strong>
                {productDescription(selectedProduct) && <p className="mt-2 whitespace-pre-line text-sm">{productDescription(selectedProduct)}</p>}
                <p className="mt-2 text-sm">Regular price: {money(Math.round(selectedProduct.price * 100))}</p>
              </div>}
              <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm">
                  {copy.product}
                  <select
                    required
                    disabled={Boolean(editItem)}
                    className="joko-admin-field mt-1 w-full"
                    value={productId}
                    onChange={(event) => {
                      setProductId(event.target.value);
                      setPrice("");
                    }}
                  >
                    <option value="">—</option>
                    {products
                      .filter(
                        (product) =>
                          product.is_active ||
                          product.id === editItem?.product_id,
                      )
                      .map((product) => (
                        <option key={product.id} value={product.id}>
                          {productName(product)} · ฿{product.price}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm">
                  {copy.price}
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    className="joko-admin-field mt-1 w-full"
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  {copy.limit}
                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="joko-admin-field mt-1 w-full"
                    value={cap}
                    onChange={(event) => setCap(event.target.value)}
                  />
                </label>
                {editItem && (
                  <label className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(event) => setEnabled(event.target.checked)}
                    />
                    {copy.enabled}
                  </label>
                )}
                <button
                  type="submit"
                  className="joko-admin-primary-button w-fit px-4 py-2"
                >
                  {copy.add}
                </button>
              </fieldset>
            </form>
          )}
          <form
            onSubmit={transfer}
            className="joko-admin-paper-card space-y-4 p-5"
          >
            <h2 className="joko-admin-title text-xl">{language === "th" ? "ปรับสต็อก Specials" : language === "zh" ? "调整 Specials 库存" : "Adjust Specials stock"}</h2>
            <p className="text-sm">{copy.sourceHint}</p>
            <fieldset disabled={locked} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  {copy.product}
                  <select
                    required
                    className="joko-admin-field mt-1 w-full"
                    value={transferItemId}
                    onChange={(event) => {
                      setTransferItemId(event.target.value);
                      setIsolated(false);
                      setQuality(false);
                    }}
                  >
                    <option value="">—</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {productName(
                          products.find(
                            (product) => product.id === item.product_id,
                          ),
                        )}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  {copy.transfer}
                  <select
                    className="joko-admin-field mt-1 w-full"
                    value={direction}
                    onChange={(event) => {
                      setDirection(event.target.value as "in" | "out");
                      setIsolated(false);
                      setQuality(false);
                    }}
                  >
                    <option
                      value="in"
                      disabled={!["draft", "prepared", "live"].includes(batch.status)}
                    >
                      {copy.in}
                    </option>
                    <option value="out">{copy.out}</option>
                  </select>
                </label>
                <label className="text-sm">
                  {copy.quantity}
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    className="joko-admin-field mt-1 w-full"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
              </div>
              <label className="block w-full max-w-md text-sm">
                {copy.source}
                <select required className="joko-admin-field mt-1 w-full" value={customSource ? "__other__" : source} onChange={event => {
                  setCustomSource(event.target.value === "__other__");
                  setSource(event.target.value === "__other__" ? "" : event.target.value);
                }}>
                  <option value="">Select source / destination</option>
                  {locations.map(place => <option key={place.id} value={place.name_en}>{place[`name_${language}`] || place.name_en}</option>)}
                  <option value="Bakery counter">Bakery counter</option>
                  <option value="Market stock">Market stock</option>
                  <option value="Returned to regular sale">Returned to regular sale</option>
                  <option value="Waste / disposal">Waste / disposal</option>
                  <option value="__other__">Other…</option>
                </select>
                {customSource && <input required aria-label="Other source / destination" maxLength={500} className="joko-admin-field mt-2 w-full" value={source} onChange={event => setSource(event.target.value)} />}
              </label>
              <label className="block w-full max-w-md text-sm">
                {copy.reason}
                <select required className="joko-admin-field mt-1 w-full" value={customReason ? "__other__" : reason} onChange={event => {
                  setCustomReason(event.target.value === "__other__");
                  setReason(event.target.value === "__other__" ? "" : event.target.value);
                }}>
                  <option value="">Select reason</option>
                  <option value="Today's surplus">Today's surplus</option>
                  <option value="End-of-day discount">End-of-day discount</option>
                  <option value="Promotional offer">Promotional offer</option>
                  <option value="Stock count correction">Stock count correction</option>
                  <option value="Unsold stock returned">Unsold stock returned</option>
                  <option value="Quality issue / disposal">Quality issue / disposal</option>
                  <option value="__other__">Other…</option>
                </select>
                {customReason && <input required aria-label="Other reason" maxLength={1000} className="joko-admin-field mt-2 w-full" value={reason} onChange={event => setReason(event.target.value)} />}
              </label>
              {direction === "in" && (
                <div className="space-y-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      required
                      type="checkbox"
                      checked={isolated}
                      onChange={(event) => setIsolated(event.target.checked)}
                    />
                    {copy.isolated}
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      required
                      type="checkbox"
                      checked={quality}
                      onChange={(event) => setQuality(event.target.checked)}
                    />
                    {copy.quality}
                  </label>
                </div>
              )}
              <button
                type="submit"
                className="joko-admin-primary-button px-4 py-2"
              >
                {direction === "in" ? copy.in : copy.out}
              </button>
            </fieldset>
          </form>
          <div className="joko-admin-paper-card overflow-x-auto p-5">
            <table className="w-full text-left text-sm">
              <caption className="mb-3 text-left joko-admin-title text-xl">
                {language === "th" ? "สรุปสต็อก" : language === "zh" ? "库存汇总" : "Stock summary"}
              </caption>
              <thead>
                <tr>
                  {[
                    copy.product,
                    copy.allocated,
                    copy.available,
                    copy.held,
                    copy.sold,
                    "",
                  ].map((label) => (
                    <th key={label} className="px-2 py-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[#55766F]/15">
                    <td className="px-2 py-3">
                      {productName(
                        products.find(
                          (product) => product.id === item.product_id,
                        ),
                      )}
                    </td>
                    {[
                      item.quantity_allocated,
                      item.quantity_available,
                      item.quantity_held,
                      item.quantity_committed,
                    ].map((value, index) => (
                      <td key={index} className="px-2 py-3">
                        {value}
                      </td>
                    ))}
                    <td>
                      {batch.status === "draft" && (
                        <button
                          disabled={locked}
                          className="joko-admin-secondary-button px-2 py-1"
                          onClick={() => {
                            setEditItem(item);
                            setProductId(item.product_id);
                            setPrice(
                              (item.special_price_satang / 100).toFixed(2),
                            );
                            setCap(item.max_per_customer?.toString() || "");
                            setEnabled(item.is_enabled);
                          }}
                        >
                          {copy.edit}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="joko-admin-paper-card space-y-3 p-5">
            <p className="text-sm">Prepare selection locks the offers and prices for publishing. It does not open checkout; publish in the section below.</p>
            <p className="text-sm">Release available stock removes unsold units from Specials. Choose their destination and reason in Transfer stock; staff must also move the physical units.</p>
            <div className="flex flex-wrap gap-2">
              {batch.status === "draft" && (
                <button
                  disabled={
                    locked ||
                    !items.some(
                      (item) => item.is_enabled && item.quantity_available > 0,
                    )
                  }
                  className="joko-admin-primary-button px-4 py-2"
                  onClick={() => void run("prepare", batchRequest())}
                >
                  {copy.prepare}
                </button>
              )}
              {["draft", "prepared", "live"].includes(batch.status) && (
                <>
                  <button
                    disabled={locked}
                    className="joko-admin-secondary-button px-4 py-2"
                    onClick={() => close("close")}
                  >
                    {copy.close}
                  </button>
                  <button
                    disabled={locked}
                    className="joko-admin-secondary-button px-4 py-2"
                    onClick={() => close("cancel")}
                  >
                    {copy.cancel}
                  </button>
                </>
              )}
            </div>
            <label className="block w-full max-w-md text-sm">
              {copy.reason}
              <select disabled={locked} className="joko-admin-field mt-1 w-full" value={customCloseReason ? "__other__" : closeReason} onChange={event => {
                setCustomCloseReason(event.target.value === "__other__");
                setCloseReason(event.target.value === "__other__" ? "" : event.target.value);
              }}>
                <option value="">Select closing / cancellation reason</option>
                {closeReason && !["Sales finished", "Sold out", "Pickup window ended", "Quality issue / disposal", "Selection created by mistake"].includes(closeReason) && !customCloseReason && <option value={closeReason}>{closeReason}</option>}
                <option value="Sales finished">Sales finished</option>
                <option value="Sold out">Sold out</option>
                <option value="Pickup window ended">Pickup window ended</option>
                <option value="Quality issue / disposal">Quality issue / disposal</option>
                <option value="Selection created by mistake">Selection created by mistake</option>
                <option value="__other__">Other…</option>
              </select>
              {customCloseReason && <input aria-label="Other closing reason" disabled={locked} maxLength={1000} className="joko-admin-field mt-2 w-full" value={closeReason} onChange={event => setCloseReason(event.target.value)} />}
            </label>
          </div>

        </>
      )}
      <SpecialsOperations batch={batches.find(b => b.id === batchId) || null} onChanged={() => { void loadSpecialsWorkspace().then(data => setBatches(data.batches)); }} />
      {batch && (
      <details className="joko-admin-paper-card p-5">
            <summary className="joko-admin-title cursor-pointer text-xl">{copy.history} ({events.length})</summary>
            {events.length === 0 && <p className="text-sm">{copy.noEvents}</p>}
            <ol className="mt-4 space-y-3 text-sm">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="border-b border-[#55766F]/15 pb-3"
                >
                  <p>
                    <strong>{event.event_type}</strong> ·{" "}
                    {bangkokInputValue(new Date(event.created_at)).replace(
                      "T",
                      " ",
                    )}
                    {event.quantity_delta
                      ? ` · ${event.quantity_delta > 0 ? "+" : ""}${event.quantity_delta}`
                      : ""}
                  </p>
                  <p>
                    {event.source_reference} · {event.reason}
                  </p>
                  <p className="break-all text-xs opacity-55">
                    {event.actor_id}
                  </p>
                </li>
              ))}
            </ol>
          </details>
      )}
    </section>
  );
}
