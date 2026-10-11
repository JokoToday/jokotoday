import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Loader2, Play, QrCode, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../lib/supabase';
import { getPaymentTransactionStatus, getStripePromptPayIntent, type PromptPayIntent } from '../lib/paymentService';

type TestSession = {
  state: 'created';
  orderId: string;
  orderNumber: string;
  paymentTransactionId: string;
  amount: number;
  currency: string;
  expiresAt: string;
  paymentMode: 'stripe_promptpay';
  provider: 'stripe';
  globalPaymentModeChanged: false;
};

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  });
}

export function StripePromptPayTest() {
  const [amount, setAmount] = useState('10.00');
  const [session, setSession] = useState<TestSession | null>(null);
  const [intent, setIntent] = useState<PromptPayIntent | null>(null);
  const [status, setStatus] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session?.paymentTransactionId || status === 'verified') return;
    let cancelled = false;

    const poll = async () => {
      try {
        const next = await getPaymentTransactionStatus(session.paymentTransactionId);
        if (!cancelled) setStatus(next.status);
      } catch {
        // Polling is best-effort; the explicit refresh button remains available.
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [session?.paymentTransactionId, status]);

  const createTest = async () => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 1 || numericAmount > 1000) {
      setError('Use a test amount between ฿1.00 and ฿1,000.00.');
      return;
    }

    setCreating(true);
    setError('');
    setSession(null);
    setIntent(null);
    setStatus('');

    try {
      const { data, error: createError } = await supabase.functions.invoke('admin-stripe-test-payment', {
        body: { amount: Math.round(numericAmount * 100) / 100 },
      });
      if (createError) throw createError;
      if (!data?.paymentTransactionId) throw new Error(data?.error || 'Could not create Stripe test payment.');

      const nextSession = data as TestSession;
      setSession(nextSession);
      setStatus('pending');

      const nextIntent = await getStripePromptPayIntent(nextSession.paymentTransactionId);
      setIntent(nextIntent);
    } catch (createFailure) {
      setError(createFailure instanceof Error ? createFailure.message : 'Could not create Stripe sandbox test payment.');
    } finally {
      setCreating(false);
    }
  };

  const refreshStatus = async () => {
    if (!session) return;
    try {
      const next = await getPaymentTransactionStatus(session.paymentTransactionId);
      setStatus(next.status);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Could not refresh payment status.');
    }
  };

  const verified = status === 'verified';

  return (
    <div className="joko-admin-paper-card max-w-3xl p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-[#55766F]/10 p-2.5 text-[#45645E]">
          <QrCode className="h-5 w-5" />
        </div>
        <div>
          <h2 className="joko-admin-title text-xl font-semibold">Stripe PromptPay sandbox test</h2>
          <p className="mt-1 text-sm leading-6 text-[#303532]/65">
            Creates an admin-only synthetic JOKO order and a Stripe PromptPay payment without changing the live K SHOP payment mode. No inventory is reserved and no bank slip is used.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-[#55766F]/15 bg-white/65 p-4">
        <label className="block max-w-xs">
          <span className="text-sm font-semibold text-[#303532]">Sandbox test amount</span>
          <div className="mt-2 flex items-center rounded-xl border border-[#55766F]/20 bg-white px-3">
            <span className="text-sm text-[#303532]/55">฿</span>
            <input
              type="number"
              min="1"
              max="1000"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={creating}
              className="w-full bg-transparent px-2 py-3 text-sm outline-none"
            />
          </div>
        </label>

        <button
          type="button"
          onClick={() => void createTest()}
          disabled={creating}
          className="joko-admin-primary-button mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {creating ? 'Creating Stripe test…' : 'Create Stripe test payment'}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {session && (
        <div className="mt-5 rounded-2xl border border-[#55766F]/15 bg-[#FFF9EE] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#303532]/45">Sandbox test order</p>
              <p className="mt-1 font-mono text-sm font-semibold text-[#303532]">#{session.orderNumber}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {verified ? 'Paid · Confirmed' : `Stripe: ${status || 'pending'}`}
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-[#303532]/50">Amount</p>
              <p className="mt-1 text-2xl font-bold text-[#C76624]">฿{Number(session.amount).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-[#303532]/50">JOKO payment expiry</p>
              <p className="mt-1 text-sm font-semibold text-[#303532]">{formatExpiry(session.expiresAt)}</p>
            </div>
          </div>

          {verified ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Automation complete</p>
                <p className="mt-1 text-sm leading-6">
                  Stripe reported payment success, the signed webhook reached JOKO, and the existing JOKO payment finalizer marked this order paid and confirmed automatically.
                </p>
              </div>
            </div>
          ) : intent?.promptPayPayload ? (
            <div className="mt-5 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
              <div className="mx-auto rounded-2xl border border-[#55766F]/15 bg-white p-3">
                <QRCodeSVG value={intent.promptPayPayload} size={154} level="M" includeMargin aria-label="Stripe PromptPay sandbox QR" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#303532]">Simulate the PromptPay payment</p>
                <p className="mt-1 text-xs leading-5 text-[#303532]/60">
                  In Stripe sandbox this QR opens Stripe’s PromptPay simulator rather than moving real money. Authorize the payment there; JOKO should confirm automatically within a few seconds.
                </p>
                {intent.stripeHostedInstructionsUrl && (
                  <a
                    href={intent.stripeHostedInstructionsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="joko-admin-secondary-button mt-3 inline-flex items-center gap-2 px-3 py-2 text-xs"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Stripe sandbox payment
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void refreshStatus()}
                  className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#3F665E]"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Refresh JOKO status
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex items-center gap-2 text-sm text-[#55766F]">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing Stripe QR…
            </div>
          )}

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#55766F]/12 bg-white/60 p-3 text-xs leading-5 text-[#303532]/55">
            <Clock className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This test does not alter the global customer payment setting. Production remains on the currently selected payment mode. The synthetic order is tagged STRIPE_SANDBOX_TEST and reserves no inventory.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
