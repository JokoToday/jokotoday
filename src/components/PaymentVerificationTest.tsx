import { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileImage, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

type VerificationResult = {
  state: 'verified' | 'pending';
  message: string;
  isDuplicate?: boolean;
  matchedAccount?: {
    bankName?: string | null;
    bankShortCode?: string | null;
    nameTh?: string | null;
    nameEn?: string | null;
    type?: string | null;
    bankNumberMasked?: string | null;
  } | null;
  amountInSlip?: number | null;
  transRef?: string | null;
  transactionDate?: string | null;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PaymentVerificationTest() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const chooseFile = (nextFile: File | null) => {
    setResult(null);
    setError('');

    if (!nextFile) {
      setFile(null);
      return;
    }

    if (!ALLOWED_TYPES.has(nextFile.type)) {
      setFile(null);
      setError('Use a JPEG, PNG, GIF or WebP payment-slip image.');
      return;
    }

    if (nextFile.size <= 0 || nextFile.size > MAX_FILE_BYTES) {
      setFile(null);
      setError('The slip image must be 4 MB or smaller.');
      return;
    }

    setFile(nextFile);
  };

  const verifySlip = async () => {
    if (!file) return;

    setIsUploading(true);
    setError('');
    setResult(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Admin session expired. Please sign in again.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xvhualoeboobulwgmkla.supabase.co';
      const formData = new FormData();
      formData.append('image', file);
      formData.append('remark', 'JOKO-EASYSLIP-POC');

      const response = await fetch(`${supabaseUrl}/functions/v1/easyslip-payment-test`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const payload = await response.json().catch(() => null) as
        | VerificationResult
        | { error?: string; code?: string; message?: string }
        | null;

      if (!response.ok && response.status !== 202) {
        const message = payload && 'error' in payload
          ? payload.error || payload.message
          : null;
        throw new Error(message || 'EasySlip could not verify this slip.');
      }

      setResult(payload as VerificationResult);
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'EasySlip verification failed.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="joko-admin-paper-card max-w-3xl p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-[#55766F]/10 p-2.5 text-[#45645E]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="joko-admin-title text-xl font-semibold">EasySlip verification test</h2>
          <p className="mt-1 text-sm leading-6 text-[#303532]/65">
            Upload one real bank-slip image. The image is sent directly to the protected
            EasySlip test function and is not stored in JOKO Storage.
          </p>
        </div>
      </div>

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
        disabled={isUploading}
        className="joko-admin-secondary-button flex w-full items-center justify-center gap-2 border border-dashed border-[#55766F]/35 px-4 py-8 text-sm disabled:opacity-50"
      >
        <Upload className="h-5 w-5" />
        Choose payment slip
      </button>

      {file && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#55766F]/15 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <FileImage className="h-5 w-5 shrink-0 text-[#55766F]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#303532]">{file.name}</p>
              <p className="text-xs text-[#303532]/55">{formatBytes(file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void verifySlip()}
            disabled={isUploading}
            className="joko-admin-primary-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {isUploading ? 'Checking…' : 'Verify with EasySlip'}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {result?.state === 'pending' && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2 text-amber-800">
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            <div>
              <p className="text-sm font-semibold">Verification pending</p>
              <p className="mt-1 text-sm">{result.message}</p>
            </div>
          </div>
        </div>
      )}

      {result?.state === 'verified' && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start gap-2 text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Bank transaction verified</p>
              <p className="mt-1 text-sm">{result.message}</p>
              <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-emerald-900/55">Amount in slip</dt>
                  <dd className="font-semibold">฿{Number(result.amountInSlip || 0).toFixed(2)}</dd>
                </div>
                <div>
                  <dt className="text-emerald-900/55">Duplicate</dt>
                  <dd className="font-semibold">{result.isDuplicate ? 'YES — already seen' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-emerald-900/55">Matched receiving account</dt>
                  <dd className="font-semibold">
                    {result.matchedAccount
                      ? [result.matchedAccount.bankShortCode, result.matchedAccount.bankNumberMasked]
                          .filter(Boolean)
                          .join(' · ') || 'Matched'
                      : 'Not matched'}
                  </dd>
                </div>
                <div>
                  <dt className="text-emerald-900/55">Receiver</dt>
                  <dd className="font-semibold">
                    {result.matchedAccount?.nameEn || result.matchedAccount?.nameTh || '—'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-emerald-900/55">Transaction reference</dt>
                  <dd className="break-all font-mono text-xs font-semibold">{result.transRef || '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-[#303532]/50">
        Proof-of-concept only: this tool checks receiver matching and duplicate status. It does not
        change any JOKO order or payment state.
      </p>
    </div>
  );
}
