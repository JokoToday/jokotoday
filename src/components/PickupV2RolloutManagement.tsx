import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  getPickupV2CustomerEnabled,
  PICKUP_V2_CUSTOMER_ENABLED_KEY,
  setPickupV2CustomerEnabled,
} from '../lib/pickupV2Rollout';

export function PickupV2RolloutManagement() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setEnabled(await getPickupV2CustomerEnabled());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Pickup v2 rollout state.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const changeRollout = async (nextEnabled: boolean) => {
    const confirmed = window.confirm(
      nextEnabled
        ? 'Enable the Pickup v2 customer experience?\n\nOnly do this after the customer availability API, v2 order grants, Admin product configuration and cutover validation have all been completed.'
        : 'Disable the Pickup v2 customer experience?\n\nCustomers will return to the legacy pickup flow on their next checkout load.',
    );
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setNotice('');
    try {
      await setPickupV2CustomerEnabled(nextEnabled);
      setEnabled(nextEnabled);
      setNotice(nextEnabled
        ? 'Pickup v2 customer rollout is enabled.'
        : 'Pickup v2 customer rollout is disabled.');
    } catch (err) {
      console.error('Could not update Pickup v2 rollout setting:', err);
      setError(err instanceof Error ? err.message : 'Could not update Pickup v2 rollout setting.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Pickup v2 Customer Rollout</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-3xl">
            Control whether customers use the new concrete-date Pickup v2 flow. The setting is stored in Admin-backed CMS configuration rather than hard-coded in the application.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || saving}
          className="inline-flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}

      <div className={`rounded-2xl border p-5 sm:p-6 ${enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                Customer Pickup v2 is {enabled ? 'enabled' : 'disabled'}
              </p>
              <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                {enabled
                  ? 'Checkout may use materialized pickup dates, shared date inventory and the Pickup v2 order RPCs.'
                  : 'Checkout remains on the legacy customer pickup flow. A missing setting is also treated as disabled.'}
              </p>
              <p className="text-xs text-gray-400 mt-2 font-mono">{PICKUP_V2_CUSTOMER_ENABLED_KEY}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void changeRollout(!enabled)}
            disabled={loading || saving}
            className={`px-5 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
              enabled
                ? 'bg-white border border-red-200 text-red-700 hover:bg-red-50'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {saving ? 'Saving…' : enabled ? 'Disable Pickup v2' : 'Enable Pickup v2'}
          </button>
        </div>
      </div>

      <div className="mt-5 grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-950">Fail-closed rollout</p>
            <p className="text-xs text-blue-900 mt-1 leading-relaxed">
              If the setting does not exist, cannot be read, or is not a recognized true value, customers remain on the legacy flow. This switch does not create backend APIs or grant RPC permissions.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-950">Enable only at the controlled cutover</p>
            <p className="text-xs text-amber-900 mt-1 leading-relaxed">
              The availability API, customer v2 RPC grants, explicit product configuration, future inventory and readiness audit must pass first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
