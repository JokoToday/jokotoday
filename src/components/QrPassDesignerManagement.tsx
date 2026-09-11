import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { BrandedQRCard } from './BrandedQRCard';
import {
  DEFAULT_QR_PASS_CONFIG,
  getQrPassConfig,
  saveQrPassConfig,
  type QrPassConfig,
} from '../lib/qrPassConfig';

const PREVIEW_QR_VALUE = 'https://joko.today/';

const COLOR_FIELDS: Array<{
  key: keyof Pick<
    QrPassConfig,
    | 'cardBackground'
    | 'cardSurface'
    | 'borderColor'
    | 'qrBorderColor'
    | 'headingColor'
    | 'accentColor'
    | 'textColor'
    | 'mutedColor'
  >;
  label: string;
}> = [
  { key: 'cardBackground', label: 'Outer background' },
  { key: 'cardSurface', label: 'Card surface' },
  { key: 'borderColor', label: 'Card border' },
  { key: 'qrBorderColor', label: 'QR frame' },
  { key: 'headingColor', label: 'Heading' },
  { key: 'accentColor', label: 'Accent / VIP code' },
  { key: 'textColor', label: 'Customer name' },
  { key: 'mutedColor', label: 'Secondary text' },
];

const VISIBILITY_FIELDS: Array<{
  key: keyof Pick<
    QrPassConfig,
    | 'showTitle'
    | 'showSubtitle'
    | 'showCustomerName'
    | 'showShortCode'
    | 'showFooterMark'
    | 'showFooterText'
  >;
  label: string;
}> = [
  { key: 'showTitle', label: 'Show JOKO Pass title' },
  { key: 'showSubtitle', label: 'Show subtitle' },
  { key: 'showCustomerName', label: 'Show customer name' },
  { key: 'showShortCode', label: 'Show VIP short code' },
  { key: 'showFooterMark', label: 'Show two-dot footer mark' },
  { key: 'showFooterText', label: 'Show footer text' },
];

export function QrPassDesignerManagement() {
  const [draft, setDraft] = useState<QrPassConfig>({ ...DEFAULT_QR_PASS_CONFIG });
  const [savedConfig, setSavedConfig] = useState<QrPassConfig>({ ...DEFAULT_QR_PASS_CONFIG });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError('');
      const config = await getQrPassConfig();
      if (!cancelled) {
        setDraft(config);
        setSavedConfig(config);
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedConfig),
    [draft, savedConfig],
  );

  const updateDraft = <K extends keyof QrPassConfig>(key: K, value: QrPassConfig[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError('');
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    setError('');

    const logoPath = draft.logoUrl.trim();
    const validLogoPath = logoPath.startsWith('/')
      && !logoPath.startsWith('//')
      && !logoPath.includes('\\');

    if (!validLogoPath) {
      setError('Logo must use a bundled same-origin asset path beginning with /. External logo URLs are deferred to a later upload-backed version.');
      return;
    }

    setSaving(true);

    try {
      const normalized = await saveQrPassConfig(draft);
      setDraft(normalized);
      setSavedConfig(normalized);
      setSaved(true);
    } catch (saveError) {
      console.error('Could not save QR Pass configuration:', saveError);
      setError('Could not save the QR Pass configuration. Check your admin session and try again.');
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = () => {
    setDraft({ ...DEFAULT_QR_PASS_CONFIG });
    setSaved(false);
    setError('');
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-gray-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading QR Pass configuration…
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">QR Pass Designer</h1>
        <p className="mt-2 max-w-3xl text-gray-600">
          Change the customer QR Pass branding and visible sections without changing application code.
          The QR safety zone remains locked so design edits cannot reduce scan reliability.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-none" />
        <div>
          <p className="font-semibold">Protected QR zone</p>
          <p className="mt-0.5 leading-6">
            QR color, error correction, quiet zone and physical QR area are intentionally not editable in v1.
            Downloads remain 55 × 85 mm and use the same safe black-on-white QR treatment.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-6">
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="md:col-span-2 block">
                <span className="text-sm font-medium text-gray-800">Bundled logo asset path</span>
                <input
                  type="text"
                  value={draft.logoUrl}
                  onChange={(event) => updateDraft('logoUrl', event.target.value)}
                  placeholder="/JOKO.TODAY_logo.v0.4.webp"
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Use a same-origin bundled path beginning with /. External URLs and direct logo upload are deferred until we add a Storage-backed asset workflow that keeps PDF/PNG export reliable.
                </p>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-800">Logo size</span>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={60}
                    max={140}
                    step={5}
                    value={draft.logoScale}
                    onChange={(event) => updateDraft('logoScale', Number(event.target.value))}
                    className="w-full"
                  />
                  <span className="w-14 text-right text-sm font-semibold text-gray-700">{draft.logoScale}%</span>
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Text</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-gray-800">Title</span>
                <input
                  type="text"
                  maxLength={40}
                  value={draft.title}
                  onChange={(event) => updateDraft('title', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-800">Subtitle</span>
                <input
                  type="text"
                  maxLength={80}
                  value={draft.subtitle}
                  onChange={(event) => updateDraft('subtitle', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </label>
              <label className="md:col-span-2 block">
                <span className="text-sm font-medium text-gray-800">Footer text</span>
                <input
                  type="text"
                  maxLength={60}
                  value={draft.footerText}
                  onChange={(event) => updateDraft('footerText', event.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Visible sections</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {VISIBILITY_FIELDS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={(event) => updateDraft(key, event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Colors</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COLOR_FIELDS.map(({ key, label }) => (
                <label key={key} className="rounded-lg border border-gray-200 p-3">
                  <span className="block text-sm font-medium text-gray-800">{label}</span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      value={draft[key]}
                      onChange={(event) => updateDraft(key, event.target.value.toUpperCase())}
                      className="h-9 w-11 cursor-pointer rounded border border-gray-300 bg-white p-1"
                    />
                    <input
                      type="text"
                      value={draft[key]}
                      maxLength={7}
                      onChange={(event) => updateDraft(key, event.target.value.toUpperCase())}
                      className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 font-mono text-xs uppercase"
                    />
                  </div>
                </label>
              ))}
            </div>
          </section>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
              <span>{error}</span>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 flex-none" />
              Saved. Customer QR Passes will use this design on their next load.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || !dirty}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save QR Pass design'}
            </button>
            <button
              type="button"
              onClick={restoreDefaults}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Restore defaults in preview
            </button>
          </div>
          <p className="text-xs leading-5 text-gray-500">
            “Restore defaults” only changes the draft preview. Click “Save QR Pass design” to publish those defaults.
          </p>
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Live preview</h2>
              {dirty && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Unsaved</span>
              )}
            </div>
            <p className="text-sm text-gray-500">Dummy member data. The preview QR only opens joko.today.</p>
            <BrandedQRCard
              qrToken="admin-preview-only"
              qrValue={PREVIEW_QR_VALUE}
              customerName="Joe Example"
              shortCode="VIP123"
              config={draft}
            />
          </div>
        </aside>
      </form>
    </div>
  );
}

export default QrPassDesignerManagement;
