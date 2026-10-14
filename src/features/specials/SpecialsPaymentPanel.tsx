import { buildKShopMasterPayload } from '../../../supabase/functions/_shared/kshop-master-qr';
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import {
  specialsError,
  specialsRpc,
  specialsTime,
  type SpecialsState,
} from "./customer";
export function SpecialsPaymentPanel({
  orderId,
  onPaid,
  onClose,
}: {
  orderId: string;
  onPaid?: () => void;
  onClose?: () => void;
}) {
  const [state, setState] = useState<SpecialsState | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [seconds, setSeconds] = useState(0);
  const [stripeQr, setStripeQr] = useState<string | null>(null);
  const [stripeRetry, setStripeRetry] = useState(0);
  const [stripeTestUrl, setStripeTestUrl] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try {
      const next = await specialsRpc<SpecialsState>(
        "specials_customer_state_v1",
        { p_order: orderId },
      );
      setState(next);
      setSeconds(
        Math.max(
          0,
          Math.ceil(
            (new Date(
              next.checkout.inventory_state === "verifying"
                ? next.checkout.verification_deadline
                : next.checkout.payment_deadline,
            ).getTime() -
              new Date(next.server_now).getTime()) /
              1000,
          ),
        ),
      );
    } catch (e) {
      setError(specialsError(e));
    }
  }, [orderId]);
  useEffect(() => {
    setState(null);
    setStripeQr(null);
    setStripeTestUrl(null);
    setError("");
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(
      () => setSeconds((s) => Math.max(0, s - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (state?.payment.mode !== 'stripe_promptpay' || state.checkout.inventory_state !== 'held') { setStripeQr(null); setStripeTestUrl(null); return; }
    setStripeQr(null);
    setStripeTestUrl(null);
    let active = true;
    void supabase.functions.invoke('stripe-promptpay-intent', {body:{paymentTransactionId:state.payment.id}}).then(({data,error:failure}) => {
      if (!active) return;
      if (failure) { setError(specialsError(failure)); return; }
      setStripeQr(data?.promptPayPayload || null);
      if (data?.stripeLivemode === false && data.stripeHostedInstructionsUrl) {
        const url = new URL(data.stripeHostedInstructionsUrl);
        if (url.protocol === "https:" && url.hostname.endsWith(".stripe.com")) setStripeTestUrl(url.href);
      }
    }).catch(e => { if (active) setError(specialsError(e)); });
    return () => { active = false; };
  }, [state?.payment.id, state?.payment.mode, state?.checkout.inventory_state, stripeRetry]);
  async function submit(file: File) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const body = new FormData();
      body.set("order_id", orderId);
      body.set("slip", file);
      const { data, error: failure } = await supabase.functions.invoke(
        "specials-verify-payment",
        { body },
      );
      if (failure) throw failure;
      setMessage(data.message || data.state);
      if (data.state === "verified") onPaid?.();
    } catch (e) {
      setError(specialsError(e));
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      await specialsRpc("specials_customer_state_v1", {
        p_order: orderId,
        p_cancel: true,
      });
      await refresh();
      onClose?.();
    } catch (e) {
      setError(specialsError(e));
    } finally {
      setBusy(false);
    }
  }
  if (!state) return <p role="status">{error || "Loading checkout…"}</p>;
  const c = state.checkout,
    paid = c.financial_state === "verified",
    held = c.inventory_state === "held",
    released = c.inventory_state === "released",
    reconcile = ["reconciliation_required", "refund_pending"].includes(
      c.financial_state,
    );
  return (
    <section className="space-y-4 rounded-2xl border border-[#ddd7cd] bg-white p-6">
      <h2 className="text-xl font-semibold">
        JOKO Specials · {state.order.order_number}
      </h2>
      <p>
        ฿{Number(state.order.total_amount).toFixed(2)} · {state.payment.mode === 'stripe_promptpay' ? 'Stripe PromptPay' : state.receiver_label}
      </p>
      <p>
        {state.order.pickup.name_en} / {state.order.pickup.name_th}
        <br />
        {specialsTime(state.order.pickup.start_at)}–
        {specialsTime(state.order.pickup.end_at)} (Bangkok)
      </p>
      {state.order.pickup.maps_url && (
        <a
          className="underline"
          href={state.order.pickup.maps_url}
          target="_blank"
          rel="noreferrer"
        >
          Pickup map
        </a>
      )}
      {paid ? (
        <p className="font-semibold text-green-800">
          Payment verified / ชำระเงินแล้ว ·{" "}
          {c.fulfillment_state === "picked_up"
            ? "Picked up"
            : c.fulfillment_state === "no_show"
              ? "Pickup window has ended"
              : "Ready for same-day pickup. Show your My QR at the Pickup Desk."}
        </p>
      ) : reconcile ? (
        <p role="alert">
          Payment or refund needs Admin review. Pickup is unavailable. Do not
          pay again / กรุณาติดต่อแอดมิน ไม่ต้องชำระซ้ำ
        </p>
      ) : c.financial_state === "refunded" ? (
        <p>Refund recorded. This order is cancelled.</p>
      ) : c.inventory_state === "verifying" ? (
        <p role="status">
          Verifying payment. Stock remains held until{" "}
          {specialsTime(c.verification_deadline)}. {Math.floor(seconds / 60)}:
          {String(seconds % 60).padStart(2, "0")} remaining. Do not pay again.
        </p>
      ) : released ? (
        <p>
          Checkout expired or cancelled. Your stock hold has been released. If
          you already paid, {state.payment.mode === 'stripe_promptpay' ? 'any late payment will be reviewed for refund. Do not pay again.' : 'submit the slip below for Admin review.'}
        </p>
      ) : (
        <>
          <p className="font-semibold">
            {state.payment.mode === 'stripe_promptpay' ? 'Pay within' : 'Pay and upload the slip within'} {Math.floor(seconds / 60)}:
            {String(seconds % 60).padStart(2, "0")} /
            ชำระและส่งสลิปภายในเวลาที่กำหนด
          </p>
          {(state.payment.mode === 'stripe_promptpay' ? stripeQr : state.qr_payload) && seconds > 0 && (
            <QRCodeSVG value={state.payment.mode === 'stripe_promptpay' ? stripeQr! : buildKShopMasterPayload(state.qr_payload!,Number(state.order.total_amount))} size={224} marginSize={4} />
          )}
          {stripeTestUrl && <p><a href={stripeTestUrl} target="_blank" rel="noreferrer" className="underline">Open Stripe sandbox payment</a> · Test mode: no real bank transfer.</p>}
          {state.payment.mode === 'stripe_promptpay' ? <p>Scan the Stripe PromptPay QR. Payment is confirmed automatically; no slip upload is needed.</p> : <p>
            Scan the JOKO merchant QR and confirm exactly ฿
            {Number(state.order.total_amount).toFixed(2)}. Check the receiver
            name in your banking app before confirming.
          </p>}
        </>
      )}
      {state.payment.mode === 'kshop_master' && !paid &&
        !reconcile &&
        c.financial_state !== "refunded" &&
        (held || released) && (
          <label className="block">
            {released
              ? "Submit an already-paid slip for review"
              : "Upload payment slip / ส่งสลิป"}
            <input
              className="mt-2 block max-w-full"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={busy || (held && seconds === 0)}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void submit(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
      <div className="flex gap-4">
        <button
          className="underline"
          onClick={() => { setStripeRetry(s => s + 1); void refresh(); }}
          disabled={busy}
        >
          Refresh status
        </button>
        {held && (
          <button
            className="underline"
            disabled={busy}
            onClick={() => void cancel()}
          >
            Cancel checkout
          </button>
        )}
        {!held && onClose && <button type="button" className="underline" disabled={busy} onClick={onClose}>Close checkout</button>}
      </div>
      {busy && <p role="status">Submitting slip…</p>}
      {message && <p role="status">{message}</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
