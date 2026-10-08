import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Save, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

type PaymentQrMode = 'promptpay_legacy' | 'kshop_easyslip';

type PaymentSettingsRow = {
  online_promptpay_enabled: boolean;
  payment_window_minutes: number;
  payment_qr_mode: PaymentQrMode;
};

export function PaymentSettingsManagement() {
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const [qrMode, setQrMode] = useState<PaymentQrMode>('promptpay_legacy');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data, error: loadError } = await supabase
          .from('payment_settings')
          .select('online_promptpay_enabled, payment_window_minutes, payment_qr_mode')
          .eq('id', true)
          .maybeSingle();

        if (loadError) throw loadError;
        if (cancelled) return;

        const row = data as PaymentSettingsRow | null;
        setEnabled(Boolean(row?.online_promptpay_enabled));
        setMinutes(Number(row?.payment_window_minutes) || 60);
        setQrMode(row?.payment_qr_mode === 'kshop_easyslip' ? 'kshop_easyslip' : 'promptpay_legacy');
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load payment settings.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    const nextMinutes = Math.round(Number(minutes));
    if (!Number.isFinite(nextMinutes) || nextMinutes < 5 || nextMinutes > 1440) {
      setError('Payment window must be between 5 and 1,440 minutes.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSaved(false);

      const { error: saveError } = await supabase
        .from('payment_settings')
        .update({
          online_promptpay_enabled: enabled,
          payment_window_minutes: nextMinutes,
          payment_qr_mode: qrMode,
          updated_at: new Date().toISOString(),
        })
        .eq('id', true);

      if (saveError) throw saveError;
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save payment settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="joko-admin-paper-card max-w-3xl p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-[#55766F]/10 p-2.5 text-[#45645E]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="joko-admin-title text-xl font-semibold">Online QR payment rollout</h2>
          <p className="mt-1 text-sm leading-6 text-[#303532]/65">
            Controls the customer-facing QR + EasySlip payment flow. K SHOP merchant QR is the preferred business-account route; the original personal PromptPay generator remains available as a fallback.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-[#55766F]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading payment settings…
        </div>
      ) : (
        <div className="space-y-5">
          <label className="flex items-start justify-between gap-4 rounded-xl border border-[#55766F]/15 bg-white/70 p-4">
            <div>
              <p className="text-sm font-semibold text-[#303532]">Customer online QR payment</p>
              <p className="mt-1 text-xs leading-5 text-[#303532]/55">
                When enabled, unpaid online orders receive an amount-specific QR and bank-slip upload flow.
              </p>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => {
                setEnabled(event.target.checked);
                setSaved(false);
              }}
              className="mt-1 h-5 w-5 accent-[#55766F]"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-[#303532]">QR payment mode</span>
            <select
              value={qrMode}
              onChange={(event) => {
                setQrMode(event.target.value as PaymentQrMode);
                setSaved(false);
              }}
              className="joko-admin-field mt-2 w-full max-w-md"
            >
              <option value="kshop_easyslip">K SHOP merchant QR via EasySlip</option>
              <option value="promptpay_legacy">Legacy personal PromptPay (fallback)</option>
            </select>
            <p className="mt-1 text-xs leading-5 text-[#303532]/50">
              K SHOP routes payment to the registered merchant/business account. Legacy PromptPay remains available so we can revert instantly if K SHOP testing fails.
            </p>
          </label>

          {enabled && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {qrMode === 'kshop_easyslip'
                  ? 'K SHOP mode requires the EasySlip application to be linked to the registered K SHOP merchant account.'
                  : 'Legacy PromptPay uses the existing server-side PROMPTPAY_ID secret and is retained only as a fallback.'}
              </p>
            </div>
          )}

          <label className="block max-w-xs">
            <span className="text-sm font-semibold text-[#303532]">Payment window</span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={5}
                max={1440}
                step={5}
                value={minutes}
                onChange={(event) => {
                  setMinutes(Number(event.target.value));
                  setSaved(false);
                }}
                className="joko-admin-field w-32"
              />
              <span className="text-sm text-[#303532]/60">minutes</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[#303532]/50">
              Unpaid reservations expire after this window. Inventory is released automatically by the expiry job.
            </p>
          </label>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              Payment settings saved.
            </div>
          )}

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="joko-admin-primary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save payment settings'}
          </button>
        </div>
      )}
    </div>
  );
}
