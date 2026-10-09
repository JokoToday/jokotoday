import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Save, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  CUSTOMER_PAYMENT_PROVIDERS,
  getPaymentProvider,
  normalizePaymentProviderMode,
  type PaymentProviderMode,
} from '../lib/paymentProviders';

type PaymentSettingsRow = {
  online_promptpay_enabled: boolean;
  payment_window_minutes: number;
  payment_qr_mode: PaymentProviderMode;
};

export function PaymentSettingsManagement() {
  const [enabled, setEnabled] = useState(false);
  const [minutes, setMinutes] = useState(60);
  const [providerMode, setProviderMode] = useState<PaymentProviderMode>('kshop_master');
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
        setProviderMode(normalizePaymentProviderMode(row?.payment_qr_mode));
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
          payment_qr_mode: providerMode,
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

  const selectedProvider = getPaymentProvider(providerMode);
  const hiddenLegacyModeActive = !selectedProvider.adminVisible;

  return (
    <div className="joko-admin-paper-card max-w-3xl p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-[#55766F]/10 p-2.5 text-[#45645E]">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="joko-admin-title text-xl font-semibold">Customer Payment Provider</h2>
          <p className="mt-1 text-sm leading-6 text-[#303532]/65">
            Choose which payment provider new online orders use. Existing open payments keep the provider they were created with.
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
              <p className="text-sm font-semibold text-[#303532]">Online customer payments</p>
              <p className="mt-1 text-xs leading-5 text-[#303532]/55">
                When enabled, online orders receive an amount-specific QR and follow the selected provider’s confirmation flow.
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

          <fieldset>
            <legend className="text-sm font-semibold text-[#303532]">Payment provider</legend>
            <div className="mt-2 grid gap-3">
              {CUSTOMER_PAYMENT_PROVIDERS.map((provider) => {
                const selected = providerMode === provider.mode;
                return (
                  <label
                    key={provider.mode}
                    className={`cursor-pointer rounded-xl border p-4 transition ${
                      selected
                        ? 'border-[#55766F]/45 bg-[#CFE3DF]/28 shadow-sm'
                        : 'border-[#55766F]/15 bg-white/65 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="payment-provider"
                        value={provider.mode}
                        checked={selected}
                        onChange={() => {
                          setProviderMode(provider.mode);
                          setSaved(false);
                        }}
                        className="mt-1 h-4 w-4 accent-[#55766F]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-[#303532]">{provider.label}</span>
                          {provider.recommended && (
                            <span className="rounded-full bg-[#55766F]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#45645E]">
                              Direct bank
                            </span>
                          )}
                          {provider.fallback && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                              Fallback
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#303532]/58">{provider.description}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#303532]/55">
                          {provider.capabilities.requiresSlipUpload ? (
                            <span className="rounded-full bg-white/80 px-2 py-1">Slip verification</span>
                          ) : (
                            <span className="rounded-full bg-white/80 px-2 py-1">No slip</span>
                          )}
                          {provider.capabilities.supportsMobileHandoff && (
                            <span className="rounded-full bg-white/80 px-2 py-1">Mobile handoff</span>
                          )}
                          {provider.capabilities.autoConfirmsWithoutSlip && (
                            <span className="rounded-full bg-white/80 px-2 py-1">Webhook auto-confirm</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {hiddenLegacyModeActive && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                A hidden legacy payment mode is currently active: <strong>{selectedProvider.label}</strong>. It is retained for backwards compatibility but is no longer offered as a normal Admin choice. Select one of the supported providers above and save to leave this legacy mode.
              </p>
            </div>
          )}

          {enabled && !hiddenLegacyModeActive && (
            <div className="rounded-xl border border-[#55766F]/15 bg-[#CFE3DF]/18 p-4 text-sm leading-6 text-[#303532]/72">
              <strong>{selectedProvider.label}:</strong> {selectedProvider.description}
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
              Unpaid reservations expire after this window. Inventory is released automatically by the expiry process.
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
