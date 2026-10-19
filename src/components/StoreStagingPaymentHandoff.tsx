import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { createPaymentHandoff, getPaymentHandoffStatus } from '../lib/paymentService';

/**
 * Internal testing only. Displayed exclusively by the staging hostname and
 * only to the designated authenticated staging test account.
 * Does not create an order, payment transaction, or collect any payment.
 */
export function StoreStagingPaymentHandoff() {
  const { user } = useAuth();
  const paymentId = new URLSearchParams(window.location.search).get('stagingPayment');
  const authorizedHost = window.location.hostname === 'staging.joko.today';
  if (!authorizedHost || !paymentId || !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(paymentId) || user?.email?.toLowerCase() !== 'jokotoday@gmail.com') return null;
  return <TestHandoff paymentId={paymentId} />;
}

function TestHandoff({ paymentId }: { paymentId: string }) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const prepare = async () => {
    setBusy(true);
    try {
      const session = await createPaymentHandoff(paymentId);
      if (!session.handoffToken) {
        setMessage(session.state === 'verified' ? 'This test payment is already verified.' : 'No active payment handoff is available.');
        return;
      }
      setToken(session.handoffToken);
      setUrl(`${window.location.origin}/pay/handoff/${encodeURIComponent(session.handoffToken)}?lang=en`);
      setMessage('Mobile upload link created. Only transfer the exact amount shown on the staging order.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create the test handoff.');
    } finally {
      setBusy(false);
    }
  };
  const check = async () => {
    if (!token) return;
    setBusy(true);
    try {
      const status = await getPaymentHandoffStatus(token);
      setMessage(`Mobile handoff: ${status.state}. Payment: ${status.paymentStatus ?? 'not yet verified'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not check payment status.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="mb-8 rounded-2xl border-2 border-[#55766F] bg-[#FFF9EE] p-5 text-[#303532]" aria-label="Staging Store payment test">
    <h2 className="text-xl font-semibold">Staging only — EasySlip ฿10 test</h2>
    <p className="mt-2 text-sm">Order STG-STORE-A8937BDB · Pay exactly ฿10 to JOKO's registered receiving account. No products will be fulfilled. The QR below opens the secure mobile <strong>slip-upload page</strong>; it is not the bank payment QR.</p>
    <button type="button" onClick={prepare} disabled={busy || !!url} className="mt-4 rounded-xl bg-[#55766F] px-4 py-2 font-semibold text-white disabled:opacity-50">Generate mobile upload QR</button>
    {url && <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
      <div className="rounded-xl bg-white p-3"><QRCodeSVG value={url} size={176} includeMargin aria-label="Mobile payment slip upload QR" /></div>
      <div className="text-sm"><p>Scan this with your phone to open JOKO's temporary slip-upload page.</p>
        <a className="mt-2 block break-all font-semibold underline" href={url} target="_blank" rel="noreferrer">Open mobile upload page</a>
        <button type="button" onClick={check} disabled={busy} className="mt-3 rounded-lg border border-[#55766F] px-3 py-2">Check payment status</button>
      </div></div>}
    {message && <p className="mt-3 rounded-lg bg-white p-3 text-sm" role="status">{message}</p>}
  </section>;
}
