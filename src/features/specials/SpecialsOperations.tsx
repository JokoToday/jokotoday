import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { supabase } from "../../lib/supabase";
import { specialsError, specialsRpc } from "./customer";
import type { SpecialsBatch } from "./contracts";
type Settings = {
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
      setNotice("Saved.");
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
        "Master QR imported. Check the receiver and save the configuration.",
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
      if (!ctx) throw new Error("Could not read QR image");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(pixels.data, pixels.width, pixels.height);
      if (!qr) throw new Error("No QR found in image");
      setSettings((s) => (s ? { ...s, qr_payload: qr.data } : s));
      setApproved(false);
    } catch (e) {
      setError(specialsError(e));
    }
  }
  return (
    <section className="space-y-4 rounded-2xl border border-[#d8ded9] bg-white p-5">
      <h2 className="text-xl font-semibold">Checkout, pickup & LINE</h2>
      {settings && (
        <details>
          <summary className="cursor-pointer font-semibold">
            Merchant payment configuration
          </summary>
          <div className="mt-4 space-y-3">
            <p>
              Use the same genuine K SHOP master QR as regular online payment.
              The QR includes the exact order total. The receiver must match the
              account registered with EasySlip. Changes apply to new checkouts
              only.
            </p>
            <label className="block">
              Merchant QR image{" "}
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
              className="rounded border px-4 py-2"
              disabled={busy}
              onClick={() => void importMaster()}
            >
              Import existing K SHOP master QR
            </button>
            {(
              [
                "qr_payload",
                "receiver_bank_code",
                "receiver_bank_number",
                "receiver_label",
              ] as const
            ).map((key) => (
              <label key={key} className="block">
                {key.replace(/_/g, " ")}
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
            <label className="block">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />{" "}
              I tested this QR in a banking app and checked the exact registered
              receiver.
            </label>
            <button
              className="rounded border px-4 py-2"
              disabled={busy || (settings.enabled && !approved)}
              onClick={() => void run(() => action("settings", settings))}
            >
              Save payment configuration
            </button>
          </div>
        </details>
      )}
      {batch && (
        <>
          <p>
            Batch: {batch.status}. Publish makes the Specials checkout public.
            Sending LINE is a separate deliberate action.
          </p>
          <button
            className="rounded border px-4 py-2"
            disabled={busy || batch.status !== "prepared"}
            onClick={() =>
              void run(() =>
                action("publish", {
                  batch_id: batch.id,
                  expected_version: batch.version,
                }),
              )
            }
          >
            Publish prepared Specials
          </button>
          <button
            className="ml-3 rounded border px-4 py-2"
            disabled={busy || batch.status !== "live"}
            onClick={() =>
              void run(() => action("queue_line", { batch_id: batch.id }))
            }
          >
            Prepare LINE preview
          </button>
          {announcement && (
            <div className="space-y-3 rounded-xl bg-[#f1f4ee] p-4">
              <pre className="whitespace-pre-wrap font-sans">
                {announcement.message}
              </pre>
              <p>
                LINE status: {announcement.status}. Accepted means LINE accepted
                the API request; delivery and reading are not confirmed.
                Audience: eligible friends of the JOKO LINE Official Account.
              </p>
              {announcement.last_error && <p>{announcement.last_error}</p>}
              <button
                className="rounded border px-4 py-2"
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
                  ? "Send this LINE announcement"
                  : "Retry the same LINE announcement"}
              </button>
            </div>
          )}
          <details>
            <summary className="cursor-pointer font-semibold">
              Staff pickup location access
            </summary>
            <p>
              Only assigned staff and Admin can hand over Specials at this
              location.
            </p>
            <select
              className="my-3 rounded border p-2"
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
            >
              <option value="">Choose staff</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <p>Location: {locationId}</p>
            <button
              className="mr-3 rounded border px-4 py-2"
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
            >
              Assign location
            </button>
            <button
              className="rounded border px-4 py-2"
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
            >
              Remove access
            </button>
          </details>
          <details>
            <summary className="cursor-pointer font-semibold">
              Payment reconciliation & actual refunds
            </summary>
            <p>
              Return the money through the bank first, then record its full
              amount and reference. Recording a refund does not return committed
              items to stock.
            </p>
            <input
              className="my-2 block rounded border p-2"
              placeholder="Actual bank refund reference"
              value={refundRef}
              onChange={(e) => setRefundRef(e.target.value)}
            />
            <input
              className="my-2 block rounded border p-2"
              placeholder="Reason"
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
                    {r.provider_ref} · ฿{r.amount} · {r.disposition}
                  </p>
                  <p className="break-all text-xs">Order {r.order_id}</p>
                  <button
                    className="mt-2 underline"
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
                  >
                    Record actual full refund
                  </button>
                  <button
                    className="ml-4 underline"
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
                  >
                    Mark refund pending
                  </button>
                </div>
              ))}
          </details>
        </>
      )}
      <button className="underline" disabled={busy} onClick={() => void load()}>
        Refresh operations
      </button>
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
