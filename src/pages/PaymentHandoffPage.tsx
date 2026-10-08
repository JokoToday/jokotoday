import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, FileImage, Loader2, ShieldCheck, Smartphone, Upload } from 'lucide-react';
import {
  getPaymentHandoffStatus,
  verifyPaymentSlipFromHandoff,
  type PaymentHandoff,
} from '../lib/paymentService';

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export function PaymentHandoffPage({ token }: { token: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [handoff, setHandoff] = useState<PaymentHandoff | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refresh = async () => {
    const next = await getPaymentHandoffStatus(token);
    setHandoff(next);
    return next;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const next = await getPaymentHandoffStatus(token);
        if (!cancelled) setHandoff(next);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not open this payment handoff.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!handoff || handoff.state === 'verified' || handoff.state === 'expired') return;
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [handoff?.state, token]);

  const chooseFile = (nextFile: File | null) => {
    setError('');
    setPendingMessage('');

    if (!nextFile) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES.has(nextFile.type)) {
      setFile(null);
      setError('Please choose a JPEG, PNG, GIF or WebP bank-slip image.');
      return;
    }
    if (nextFile.size <= 0 || nextFile.size > MAX_FILE_BYTES) {
      setFile(null);
      setError('The bank-slip image must be 4 MB or smaller.');
      return;
    }
    setFile(nextFile);
  };

  const verify = async () => {
    if (!file) return;
    try {
      setVerifying(true);
      setError('');
      setPendingMessage('');
      const result = await verifyPaymentSlipFromHandoff(token, file);
      if (result.state === 'pending') {
        setPendingMessage(result.message || 'The bank transaction is still processing. You do not need to move the slip back to your computer.');
        await refresh();
        return;
      }
      if (result.state === 'verified') {
        setHandoff((current) => current ? { ...current, state: 'verified', paymentStatus: 'paid', orderStatus: 'confirmed' } : current);
        return;
      }
      setError(result.message || result.error || 'Payment could not be verified.');
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Payment could not be verified.');
    } finally {
      setVerifying(false);
    }
  };

  const expiryMs = handoff?.expiresAt ? new Date(handoff.expiresAt).getTime() : NaN;
  const remainingSeconds = Number.isFinite(expiryMs) ? Math.max(0, Math.ceil((expiryMs - nowMs) / 1000)) : 0;
  const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  if (loading) {
    return <div className="min-h-screen bg-[#FFF9EE] flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#55766F]" /></div>;
  }

  if (handoff?.state === 'verified') {
    return (
      <main className="min-h-screen bg-[#FFF9EE] px-4 py-10">
        <div className="mx-auto max-w-md rounded-[2rem] border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0" />
            <div>
              <p className="text-xl font-semibold">Payment verified</p>
              <p className="mt-2 text-sm leading-6">Your JOKO order is paid and confirmed. The payment screen on your computer will update automatically.</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (handoff?.state === 'expired') {
    return (
      <main className="min-h-screen bg-[#FFF9EE] px-4 py-10">
        <div className="mx-auto max-w-md rounded-[2rem] border border-red-200 bg-white p-6">
          <div className="flex items-start gap-3 text-red-700">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <p className="font-semibold">Payment window expired</p>
              <p className="mt-2 text-sm leading-6">This secure upload link is no longer active. Please return to JOKO TODAY and place the order again.</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FFF9EE] px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#55766F]">JOKO TODAY</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#292D2B]">Send your payment slip from this phone</h1>
          <p className="mt-2 text-sm leading-6 text-[#303532]/65">This secure link is already tied to your pending JOKO payment. No order number is needed.</p>
        </div>

        <section className="rounded-[2rem] border border-[#55766F]/15 bg-white p-5 shadow-[0_18px_50px_rgba(59,74,69,0.06)]">
          <div className="flex items-center gap-3 rounded-2xl bg-[#CFE3DF]/30 p-4">
            <Smartphone className="h-5 w-5 text-[#3F665E]" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#303532]/45">Pending payment</p>
              <p className="mt-1 text-xl font-bold text-[#C76624]">฿{Number(handoff?.amount || 0).toFixed(2)}</p>
              {handoff?.orderNumber && <p className="mt-1 text-xs text-[#303532]/45">Order #{handoff.orderNumber}</p>}
            </div>
          </div>

          {handoff?.expiresAt && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-[#55766F]/15 bg-[#FFF9EE] px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-[#303532]/60"><Clock className="h-4 w-4" /> Time remaining</span>
              <span className="font-mono font-bold text-[#303532]">{countdown}</span>
            </div>
          )}

          <div className="mt-5 border-t border-[#55766F]/12 pt-5">
            <p className="text-sm font-semibold text-[#303532]">Choose the bank slip from your phone</p>
            <p className="mt-1 text-xs leading-5 text-[#303532]/50">You can choose the image directly from Photos, Files, or your banking app's saved slip.</p>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(event) => chooseFile(event.target.files?.[0] || null)}
            />

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={verifying}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#55766F]/35 bg-[#FFF9EE] px-4 py-5 text-sm font-semibold text-[#3F665E] disabled:opacity-50"
            >
              <Upload className="h-4 w-4" />
              Choose bank slip
            </button>

            {file && (
              <div className="mt-3 rounded-xl border border-[#55766F]/15 bg-[#FFF9EE] p-3">
                <div className="flex items-center gap-2">
                  <FileImage className="h-4 w-4 shrink-0 text-[#55766F]" />
                  <span className="truncate text-sm font-medium text-[#303532]">{file.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void verify()}
                  disabled={verifying}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#C76624] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {verifying ? 'Checking payment…' : 'Verify payment'}
                </button>
              </div>
            )}

            {pendingMessage && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-800">{pendingMessage}</div>
            )}
            {error && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</div>
            )}

            <p className="mt-4 text-xs leading-5 text-[#303532]/45">EasySlip checks the receiving account, exact amount and duplicate transaction use. This link expires together with the payment window.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default PaymentHandoffPage;
