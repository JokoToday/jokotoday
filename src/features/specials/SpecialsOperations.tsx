import { useLanguage } from '../../context/LanguageContext';
import { specialsAdminText } from './adminThai';
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { supabase } from "../../lib/supabase";
import { specialsError, specialsRpc } from "./customer";
import type { SpecialsBatch } from "./contracts";
type Settings = {
  payment_mode: "stripe_promptpay" | "kshop_master";
  enabled: boolean;
  qr_payload: string;
  receiver_bank_code: string;
  receiver_bank_number: string;
  receiver_label: string;
};
type Receipt = {
  batch_id: string;
  provider_ref: string;
  order_id: string;
  amount: number;
  disposition: string;
};
type Announcement = {
  message: string;
  status: string;
  retry_key: string;
  last_error: string | null;
};
export function SpecialsOperations({
  batch,
  onChanged,
}: {
  batch: SpecialsBatch | null;
  onChanged: () => void;
}) {
  const { language } = useLanguage();
  const [settings, setSettings] = useState<Settings | null>(null),
    [receipts, setReceipts] = useState<Receipt[]>([]),
    [announcement, setAnnouncement] = useState<Announcement | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [staff, setStaff] = useState<{ id: string; name: string }[]>([]),
    [staffId, setStaffId] = useState(""),
    [locationId, setLocationId] = useState(""),
    [approved, setApproved] = useState(false),
    [refundRef, setRefundRef] = useState(""),
    [refundReason, setRefundReason] = useState("");
  const lock = useRef(false);
  const load = useCallback(async () => {
    try {
      const [details, people] = await Promise.all([
        specialsRpc<{ settings: Settings; receipts: Receipt[] }>(
          "specials_admin_details_v1",
        ),
        supabase.from("user_profiles").select("id,name").eq("role", "staff"),
      ]);
      setSettings(details.settings);
      setReceipts(details.receipts);
      if (people.error) throw people.error;
      setStaff(people.data || []);
      if (batch) {
        const { data, error } = await supabase
          .from("specials_line_outbox")
          .select("message,status,retry_key,last_error")
          .eq("batch_id", batch.id)
          .maybeSingle();
        if (error) throw error;
        setAnnouncement(data);
      } else setAnnouncement(null);
    } catch (e) {
      setError(specialsError(e));
    }
  }, [batch]);
  useEffect(() => {
    void load();
    setLocationId(batch?.pickup_location_id || "");
  }, [load, batch?.pickup_location_id]);
  async function run(action: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(specialsAdminText(language, "Saved."));
      await load();
      onChanged();
    } catch (e) {
      setError(specialsError(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const action = (name: string, request: Record<string, unknown>) =>
    specialsRpc("admin_specials_action_v1", {
      p_action: name,
      p_request: request,
      p_operation_key: crypto.randomUUID(),
    });
  async function importMaster() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const { data, error } = await supabase.functions.invoke(
        "specials-merchant-config",
        { body: {} },
      );
      if (error) throw error;
      setSettings((current) =>
        current ? { ...current, qr_payload: data.qr_payload } : current,
      );
      setApproved(false);
      setNotice(
        specialsAdminText(language, "Master QR imported. Check the receiver and save the configuration."),
      );
    } catch (error) {
      setError(specialsError(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function decode(file: File) {
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(specialsAdminText(language, "Could not read QR image"));
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(pixels.data, pixels.width, pixels.height);
      if (!qr) throw new Error(specialsAdminText(language, "No QR found in image"));
      setSettings((s) => (s ? { ...s, qr_payload: qr.data } : s));
      setApproved(false);
    } catch (e) {
      setError(specialsError(e));
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border border-[#d8ded9] bg-white p-5">
      <h2 className="text-xl font-semibold">{specialsAdminText(language, "Checkout, pickup & LINE")}</h2>
      {settings && (
        <details>
          <summary className="w-fit cursor-pointer rounded-lg bg-[#C76624] px-4 py-2 font-semibold text-white">{specialsAdminText(language, "Merchant payment configuration")}</summary>
          <div className="mt-4 space-y-3">
            <p>{specialsAdminText(language, "Choose the payment method for new Specials checkouts. Existing checkouts keep their original method.")}</p>
            <label className="block w-full max-w-md">{specialsAdminText(language, "Payment method")}<select className="mt-1 block w-full rounded border p-2" value={settings.payment_mode || 'stripe_promptpay'} disabled={busy}
                onChange={e => { setSettings({...settings, payment_mode: e.target.value as Settings['payment_mode']}); setApproved(false); }}>
                <option value="stripe_promptpay">{specialsAdminText(language, "Stripe PromptPay (default)")}</option>
                <option value="kshop_master">{specialsAdminText(language, "Merchant PromptPay QR + EasySlip verification")}</option>
              </select>
            </label>
            {settings.payment_mode === 'stripe_promptpay' && <p>{specialsAdminText(language, "Stripe confirms payment automatically. No slip upload. Changes apply to new checkouts only.")}</p>}
            {settings.payment_mode === "kshop_master" && <>
            <p>{specialsAdminText(language, "Use a genuine merchant QR whose receiver matches the account registered with EasySlip.")}</p>
            <label className="block">
              {specialsAdminText(language, "Merchant QR image")}{" "}
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void decode(file);
                }}
              />
            </label>
            <button
              className="joko-admin-primary-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy}
              onClick={() => void importMaster()}
            >{specialsAdminText(language, "Import existing K SHOP master QR")}</button>
            {(
              [
                "qr_payload",
                "receiver_bank_code",
                "receiver_bank_number",
                "receiver_label",
              ] as const
            ).map((key) => (
              <label key={key} className="block">
                {specialsAdminText(language, key.replace(/_/g, " "))}
                <input
                  className="mt-1 block w-full rounded border p-2"
                  value={settings[key]}
                  disabled={busy}
                  onChange={(e) => {
                    setSettings({ ...settings, [key]: e.target.value });
                    setApproved(false);
                  }}
                />
              </label>
            ))}
            </>}
            <label className="block">
              <input
                type="checkbox"
                checked={settings.enabled}
                disabled={busy}
                onChange={(e) =>
                  setSettings({ ...settings, enabled: e.target.checked })
                }
              />{" "}
              Enable Specials payments
            </label>
            {settings.payment_mode === "kshop_master" && <label className="block">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />{" "}
              I tested this QR in a banking app and checked the exact registered
              receiver.
            </label>}
            <button
              className="joko-admin-primary-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy || (settings.enabled && settings.payment_mode === "kshop_master" && !approved)}
              onClick={() => void run(() => action("settings", settings))}
            >{specialsAdminText(language, "Save payment configuration")}</button>
          </div>
        </details>
      )}
      {batch && (
        <>
          <p>
            {language === "th" ? "สถานะชุดสินค้า:" : "Selection:"} {specialsAdminText(language, batch.status)}. {language === "th" ? "การเผยแพร่จะเปิดให้ลูกค้าสั่งซื้อ Specials ส่วนการส่ง LINE ต้องกดส่งแยกต่างหาก" : "Publish makes the Specials checkout public. Sending LINE is a separate deliberate action."}
          </p>
          <button
            className="joko-admin-primary-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy || batch.status !== "prepared"}
            onClick={() =>
              void run(() =>
                action("publish", {
                  batch_id: batch.id,
                  expected_version: batch.version,
                }),
              )
            }
          >{specialsAdminText(language, "Publish prepared Specials")}</button>
          <button
            className="joko-admin-primary-button ml-3 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy || batch.status !== "live"}
            onClick={() =>
              void run(() => action("queue_line", { batch_id: batch.id }))
            }
          >{specialsAdminText(language, "Prepare LINE preview")}</button>
          {announcement && (
            <div className="space-y-3 rounded-xl bg-[#f1f4ee] p-4">
              <pre className="whitespace-pre-wrap font-sans">
                {announcement.message}
              </pre>
              <p>
                {language === "th" ? "สถานะ LINE:" : "LINE status:"} {specialsAdminText(language, announcement.status)}. {language === "th" ? "รับคำขอแล้ว หมายถึง LINE รับคำขอ API แล้ว แต่ยังไม่ยืนยันการส่งถึงหรือการอ่าน ผู้รับคือเพื่อนของบัญชี JOKO LINE Official Account ที่มีสิทธิ์รับข้อความ" : "Accepted means LINE accepted the API request; delivery and reading are not confirmed. Audience: eligible friends of the JOKO LINE Official Account."}
              </p>
              {announcement.last_error && <p>{announcement.last_error}</p>}
              <button
                className="joko-admin-primary-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={
                  busy ||
                  ["accepted", "suppressed", "sending"].includes(
                    announcement.status,
                  ) ||
                  batch.status !== "live"
                }
                onClick={() =>
                  void run(async () => {
                    const { data, error } = await supabase.functions.invoke(
                      "specials-line-send",
                      { body: { batch_id: batch.id } },
                    );
                    if (error) throw error;
                    return data;
                  })
                }
              >
                {announcement.status === "queued"
                  ? specialsAdminText(language, "Send this LINE announcement")
                  : specialsAdminText(language, "Retry the same LINE announcement")}
              </button>
            </div>
          )}
          <details>
            <summary className="w-fit cursor-pointer rounded-lg bg-[#C76624] px-4 py-2 font-semibold text-white">{specialsAdminText(language, "Staff pickup location access")}</summary>
            <p>{specialsAdminText(language, "Only assigned staff and Admin can hand over Specials at this location.")}</p>
            <select
              className="my-3 rounded border p-2"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              <option value="">{specialsAdminText(language, "Choose staff")}</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p>{specialsAdminText(language, "Location:")} {locationId}</p>
            <button
              className="joko-admin-primary-button mr-3 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy || !staffId || !locationId}
              onClick={() =>
                void run(() =>
                  action("staff_location", {
                    user_id: staffId,
                    location_id: locationId,
                    enabled: true,
                  }),
                )
              }
            >{specialsAdminText(language, "Assign location")}</button>
            <button
              className="joko-admin-primary-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy || !staffId || !locationId}
              onClick={() =>
                void run(() =>
                  action("staff_location", {
                    user_id: staffId,
                    location_id: locationId,
                    enabled: false,
                  }),
                )
              }
            >{specialsAdminText(language, "Remove access")}</button>
          </details>
          <details>
            <summary className="w-fit cursor-pointer rounded-lg bg-[#C76624] px-4 py-2 font-semibold text-white">{specialsAdminText(language, "Payment reconciliation & actual refunds")}</summary>
            <p>{specialsAdminText(language, "Return the money through the bank first, then record its full amount and reference. Recording a refund does not return committed items to stock.")}</p>
            <input
              className="my-2 block rounded border p-2"
              placeholder={specialsAdminText(language, "Actual bank refund reference")}
              value={refundRef}
              onChange={(e) => setRefundRef(e.target.value)}
            />
            <input
              className="my-2 block rounded border p-2"
              placeholder={specialsAdminText(language, "Reason")}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
            />
            {receipts
              .filter(
                (r) => r.batch_id === batch.id && r.disposition !== "refunded",
              )
              .map((r) => (
                <div className="my-3 rounded border p-3" key={r.provider_ref}>
                  <p>
                    {r.provider_ref} · ฿{r.amount} · {specialsAdminText(language, r.disposition)}
                  </p>
                  <p className="break-all text-xs">{specialsAdminText(language, "Order")} {r.order_id}</p>
                  <button
                    className="joko-admin-primary-button mt-2 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={busy || !refundRef.trim() || !refundReason.trim()}
                    onClick={() =>
                      void run(() =>
                        action("refund", {
                          batch_id: batch.id,
                          reference: r.provider_ref,
                          amount: r.amount,
                          refund_reference: refundRef,
                          reason: refundReason,
                        }),
                      )
                    }
                  >{specialsAdminText(language, "Record actual full refund")}</button>
                  <button
                    className="joko-admin-primary-button ml-4 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={busy || !refundReason.trim()}
                    onClick={() =>
                      void run(() =>
                        action("refund_pending", {
                          batch_id: batch.id,
                          reference: r.provider_ref,
                          reason: refundReason,
                        }),
                      )
                    }
                  >{specialsAdminText(language, "Mark refund pending")}</button>
                </div>
              ))}
          </details>
        </>
      )}
      <button className="joko-admin-primary-button px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40" disabled={busy} onClick={() => void load()}>{specialsAdminText(language, "Refresh operations")}</button>
      {notice && <p role="status" className="rounded-xl border border-[#55766F]/30 bg-[#E6EEE9] p-4 font-medium">{notice}</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
