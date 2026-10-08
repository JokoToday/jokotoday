import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';

type VerificationResult = {
  duplicate: boolean;
  amountInSlip: number;
  amountInOrder: number | null;
  amountMatched: boolean | null;
  accountMatched: boolean;
  matchedAccount: {
    bank: string | null;
    nameTh: string | null;
    nameEn: string | null;
    type: string | null;
    bankNumber: string | null;
  } | null;
  transactionReference: string | null;
  transactionDate: string | null;
  receiverBank: string | null;
};

export function EasySlipTestManagement() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [expectedAmount, setExpectedAmount] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const verify = async () => {
    if (!file) {
      inputRef.current?.click();
      return;
    }

    setChecking(true);
    setError('');
    setMessage('');
    setResult(null);

    try {
      const form = new FormData();
      form.append('image', file);
      if (expectedAmount.trim()) form.append('expectedAmount', expectedAmount.trim());

      const { data, error: invokeError } = await supabase.functions.invoke('easyslip-test', {
        body: form,
      });

      if (invokeError) throw invokeError;

      if (!data?.success) {
        setError(data?.message || 'EasySlip could not verify this slip.');
        return;
      }

      setResult(data.result as VerificationResult);
      setMessage(data.message || 'Bank slip verified successfully.');
    } catch (err) {
      console.error('EasySlip verification test failed', err);
      setError(err instanceof Error ? err.message : 'Could not verify this slip.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="joko-admin-paper-card p-5 sm:p-6">
      <div className="max-w-3xl">
        <p className="joko-admin-eyebrow">EasySlip proof of concept</p>
        <h2 className="joko-admin-title mt-1 text-2xl font-semibold">Payment Slip Verification</h2>
        <p className="mt-2 text-sm leading-6 text-[#303532]/65">
          Upload one genuine bank slip. The image is sent directly to the protected EasySlip test function and is not saved to JOKO storage.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_13rem]">
          <div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={(event) => {
                const next = event.target.files?.[0] || null;
                setFile(next);
                setResult(null);
                setError('');
                setMessage('');
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="joko-admin-secondary-button flex min-h-24 w-full items-center justify-center gap-3 px-4 py-4 text-sm"
            >
              <Upload className="h-5 w-5" />
              <span className="text-left">
                <span className="block font-semibold">{file ? 'Change slip image' : 'Upload payment slip'}</span>
                <span className="mt-1 block text-xs opacity-70">
                  {file ? `${file.name} · ${(file.size / 1024).toFixed(0)} KB` : 'JPEG, PNG, GIF or WebP · max 4 MB'}
                </span>
              </span>
            </button>
          </div>

          <label className="block">
            <span className="text-sm font-semibold text-[#303532]/75">Expected amount (optional)</span>
            <div className="mt-2 flex items-center rounded-xl border border-[#55766F]/20 bg-white px-3">
              <span className="text-sm text-[#303532]/55">฿</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={expectedAmount}
                onChange={(event) => setExpectedAmount(event.target.value)}
                placeholder="10.00"
                className="w-full bg-transparent px-2 py-3 text-sm outline-none"
              />
            </div>
          </label>
        </div>

        <button
          type="button"
          onClick={() => void verify()}
          disabled={checking || !file}
          className="joko-admin-primary-button mt-4 inline-flex items-center gap-2 px-5 py-3 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {checking ? 'Checking with EasySlip…' : 'Verify slip'}
        </button>

        {error && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-[#55766F]/18 bg-white">
            <div className="border-b border-[#55766F]/12 bg-[#EDF4F1] px-5 py-4">
              <div className="flex items-center gap-2 font-semibold text-[#304B45]">
                <CheckCircle2 className="h-5 w-5" />
                {message}
              </div>
            </div>
            <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2">
              <ResultRow label="Receiver matched" value={result.accountMatched ? 'YES' : 'NO'} />
              <ResultRow label="Duplicate" value={result.duplicate ? 'YES' : 'NO'} />
              <ResultRow label="Amount in slip" value={`฿${Number(result.amountInSlip || 0).toFixed(2)}`} />
              <ResultRow
                label="Expected amount matched"
                value={result.amountMatched == null ? 'Not tested' : result.amountMatched ? 'YES' : 'NO'}
              />
              <ResultRow label="Receiving bank" value={result.matchedAccount?.bank || result.receiverBank || '—'} />
              <ResultRow
                label="Registered receiver"
                value={result.matchedAccount?.nameEn || result.matchedAccount?.nameTh || '—'}
              />
              <ResultRow label="Account" value={result.matchedAccount?.bankNumber || '—'} />
              <ResultRow label="Transaction date" value={result.transactionDate || '—'} />
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[#303532]/45">Transaction reference</dt>
                <dd className="mt-1 break-all font-mono text-xs text-[#303532]/80">{result.transactionReference || '—'}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-[#303532]/45">{label}</dt>
      <dd className="mt-1 font-medium text-[#303532]/85">{value}</dd>
    </div>
  );
}
