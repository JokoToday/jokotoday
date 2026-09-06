import { FormEvent, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SETTING_KEY = 'welcome_back_return_hours';
const DEFAULT_RETURN_HOURS = 6;
const MIN_RETURN_HOURS = 1;
const MAX_RETURN_HOURS = 720;

export function CustomerExperienceManagement() {
  const [returnHours, setReturnHours] = useState(String(DEFAULT_RETURN_HOURS));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loadSetting = async () => {
      setLoading(true);
      setError('');

      const { data, error: loadError } = await supabase
        .from('cms_settings')
        .select('value')
        .eq('setting_key', SETTING_KEY)
        .maybeSingle();

      if (loadError) {
        console.error('Could not load Welcome Back setting:', loadError);
        setError('Could not load the current Welcome Back setting.');
      } else {
        const parsed = Number(data?.value);
        const valid = Number.isInteger(parsed)
          && parsed >= MIN_RETURN_HOURS
          && parsed <= MAX_RETURN_HOURS;
        setReturnHours(String(valid ? parsed : DEFAULT_RETURN_HOURS));
      }

      setLoading(false);
    };

    void loadSetting();
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSaved(false);

    const parsed = Number(returnHours);
    if (
      !Number.isInteger(parsed)
      || parsed < MIN_RETURN_HOURS
      || parsed > MAX_RETURN_HOURS
    ) {
      setError(`Enter a whole number between ${MIN_RETURN_HOURS} and ${MAX_RETURN_HOURS} hours.`);
      return;
    }

    setSaving(true);
    const { error: saveError } = await supabase
      .from('cms_settings')
      .upsert({
        setting_key: SETTING_KEY,
        value: String(parsed),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'setting_key' });

    if (saveError) {
      console.error('Could not save Welcome Back setting:', saveError);
      setError('Could not save the Welcome Back setting.');
    } else {
      setReturnHours(String(parsed));
      setSaved(true);
    }
    setSaving(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Customer Experience</h1>
        <p className="text-gray-600 mt-2">
          Configure account-aware returning-customer experiences without changing application code.
        </p>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-primary-50 p-3 text-primary-700">
            <Clock3 className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">Welcome Back</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Show the personalized Welcome Back card when a signed-in customer returns after this many hours without a JOKO TODAY homepage visit.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading current setting…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-5">
            <label className="block">
              <span className="block text-sm font-medium text-gray-800">
                Show Welcome Back after
              </span>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="number"
                  min={MIN_RETURN_HOURS}
                  max={MAX_RETURN_HOURS}
                  step={1}
                  value={returnHours}
                  onChange={(event) => {
                    setReturnHours(event.target.value);
                    setSaved(false);
                    setError('');
                  }}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
                <span className="text-sm font-medium text-gray-700">hours</span>
              </div>
            </label>

            <p className="text-xs leading-5 text-gray-500">
              Default: {DEFAULT_RETURN_HOURS} hours. The setting applies to the customer account across browsers and devices. A customer's first visit records their account state but does not display “Welcome back”.
            </p>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{error}</span>
              </div>
            )}

            {saved && (
              <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4 flex-none" />
                Saved. New customer visits will use this threshold immediately.
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save Welcome Back timing'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

export default CustomerExperienceManagement;
