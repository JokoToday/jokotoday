import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Save, ShieldCheck, Type } from 'lucide-react';
import { BrandedQRCard } from './BrandedQRCard';
import { HomepageLogoUploader } from '../app/joko-today/admin/HomepageLogoUploader';
import {
  DEFAULT_QR_PASS_CONFIG,
  getQrPassConfig,
  saveQrPassConfig,
  type QrPassConfig,
  type QrPassTextRoleStyle,
} from '../lib/qrPassConfig';
import {
  JOKO_CHINESE_DISPLAY_FONT_OPTIONS,
  JOKO_DISPLAY_FONT_OPTIONS,
  JOKO_FONT_WEIGHT_OPTIONS,
  JOKO_THAI_DISPLAY_FONT_OPTIONS,
} from '../platform/builder';

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
  { key: 'headingColor', label: 'Brand / title' },
  { key: 'accentColor', label: 'Accent / VIP code' },
  { key: 'textColor', label: 'Customer name' },
  { key: 'mutedColor', label: 'Helper text' },
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
  { key: 'showTitle', label: 'Show card title' },
  { key: 'showSubtitle', label: 'Show helper subtitle' },
  { key: 'showCustomerName', label: 'Show customer name' },
  { key: 'showShortCode', label: 'Show VIP short code' },
  { key: 'showFooterMark', label: 'Show two-dot footer mark' },
  { key: 'showFooterText', label: 'Show footer text' },
];

type TypographyRole = keyof Pick<
  QrPassConfig['typography'],
  'title' | 'customerName' | 'shortCode' | 'helper'
>;

const ROLE_CONTROLS: Array<{
  key: TypographyRole;
  label: string;
  min: number;
  max: number;
}> = [
  { key: 'title', label: 'Card title / brand', min: 14, max: 34 },
  { key: 'customerName', label: 'Customer name', min: 18, max: 42 },
  { key: 'shortCode', label: 'Short code', min: 12, max: 28 },
  { key: 'helper', label: 'Small labels / helper text', min: 9, max: 20 },
];

function cloneDefaults(): QrPassConfig {
  return structuredClone(DEFAULT_QR_PASS_CONFIG);
}

export function QrPassDesignerManagement() {
  const [draft, setDraft] = useState<QrPassConfig>(cloneDefaults);
  const [savedConfig, setSavedConfig] = useState<QrPassConfig>(cloneDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
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

  const updateTypography = (patch: Partial<QrPassConfig['typography']>) => {
    setDraft((current) => ({
      ...current,
      typography: { ...current.typography, ...patch },
    }));
    setSaved(false);
    setError('');
  };

  const updateRole = (role: TypographyRole, patch: Partial<QrPassTextRoleStyle>) => {
    setDraft((current) => ({
      ...current,
      typography: {
        ...current.typography,
        [role]: { ...current.typography[role], ...patch },
      },
    }));
    setSaved(false);
    setError('');
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (mediaUploading) return;

    setSaved(false);
    setError('');
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
    setDraft(cloneDefaults());
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
    <div className="mx-auto max-w-[92rem] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="joko-admin-eyebrow">Customer identity</p>
        <h1 className="joko-admin-title mt-1 text-3xl font-semibold">QR Pass Editor</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#303532]/62">
          Control the appearance of the customer QR Pass with a constrained design system.
          Admin preview, customer card, PNG and PDF all use the same canonical renderer.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[#55766F]/18 bg-[#EEF5F2] px-4 py-3 text-sm text-[#304B45]">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-none" />
        <div>
          <p className="font-semibold">Protected QR zone</p>
          <p className="mt-0.5 leading-6">
            The QR stays black on white, uses high error correction, keeps its quiet zone and has a fixed minimum physical area.
            Logo and decorative controls can never overlap the QR. Export size is locked to 85 × 55 mm.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid gap-8 2xl:grid-cols-[minmax(0,1fr)_660px]">
        <div className="space-y-6">
          <section className="joko-admin-paper-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#303532]">Logo</h2>
            <p className="mt-1 text-sm leading-6 text-[#303532]/60">
              Reuses JOKO Media. Uploaded logos are stored in the existing brand-media workflow and remain export-safe.
            </p>
            <div className="mt-5">
              <HomepageLogoUploader
                compact
                value={draft.logoUrl}
                onChange={(logoUrl) => updateDraft('logoUrl', logoUrl)}
                onUploadingChange={setMediaUploading}
                successMessage="Logo uploaded. It is now in the QR Pass draft; save the QR Pass design to publish it."
              />
            </div>
            <label className="mt-5 block">
              <span className="text-sm font-medium text-[#303532]">Logo size</span>
              <div className="mt-2 flex items-center gap-3">
                <input
                  type="range"
                  min={60}
                  max={140}
                  step={5}
                  value={draft.logoScale}
                  onChange={(event) => updateDraft('logoScale', Number(event.target.value))}
                  className="w-full accent-[#C76624]"
                />
                <span className="w-14 text-right text-sm font-semibold text-[#303532]/70">{draft.logoScale}%</span>
              </div>
            </label>
          </section>

          <section className="joko-admin-paper-card p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-[#55766F]" />
              <h2 className="text-lg font-semibold text-[#303532]">Typography</h2>
            </div>
            <p className="mt-1 text-sm leading-6 text-[#303532]/60">
              Font families are selected by script so English, Thai and Chinese never depend on accidental browser fallback.
              Text roles then control safe weight and size.
            </p>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <label className="block">
                <span className="text-sm font-medium text-[#303532]">English</span>
                <select
                  value={draft.typography.englishFont}
                  onChange={(event) => updateTypography({
                    englishFont: event.target.value as QrPassConfig['typography']['englishFont'],
                  })}
                  className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"
                >
                  {JOKO_DISPLAY_FONT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-[#303532]">Thai</span>
                <select
                  value={draft.typography.thaiFont}
                  onChange={(event) => updateTypography({
                    thaiFont: event.target.value as QrPassConfig['typography']['thaiFont'],
                  })}
                  className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"
                >
                  {JOKO_THAI_DISPLAY_FONT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-[#303532]">Chinese</span>
                <select
                  value={draft.typography.chineseFont}
                  onChange={(event) => updateTypography({
                    chineseFont: event.target.value as QrPassConfig['typography']['chineseFont'],
                  })}
                  className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"
                >
                  {JOKO_CHINESE_DISPLAY_FONT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 space-y-4">
              {ROLE_CONTROLS.map(({ key, label, min, max }) => {
                const role = draft.typography[key];
                return (
                  <div key={key} className="rounded-2xl border border-[#55766F]/14 bg-white/65 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-[#303532]">{label}</span>
                      <span className="text-xs font-semibold text-[#303532]/55">{role.size}px</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                      <select
                        value={role.weight}
                        onChange={(event) => updateRole(key, {
                          weight: Number(event.target.value) as QrPassTextRoleStyle['weight'],
                        })}
                        className="w-full rounded-xl border px-3 py-2.5 text-sm"
                        aria-label={`${label} font weight`}
                      >
                        {JOKO_FONT_WEIGHT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label} ({option.value})
                          </option>
                        ))}
                      </select>
                      <input
                        type="range"
                        min={min}
                        max={max}
                        value={role.size}
                        onChange={(event) => updateRole(key, { size: Number(event.target.value) })}
                        className="w-full accent-[#C76624]"
                        aria-label={`${label} font size`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="joko-admin-paper-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#303532]">Text</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-[#303532]">Card title</span>
                <input
                  type="text"
                  maxLength={40}
                  value={draft.title}
                  onChange={(event) => updateDraft('title', event.target.value)}
                  className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-[#303532]">Helper subtitle</span>
                <input
                  type="text"
                  maxLength={80}
                  value={draft.subtitle}
                  onChange={(event) => updateDraft('subtitle', event.target.value)}
                  className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"
                />
              </label>
              <label className="md:col-span-2 block">
                <span className="text-sm font-medium text-[#303532]">Footer text</span>
                <input
                  type="text"
                  maxLength={60}
                  value={draft.footerText}
                  onChange={(event) => updateDraft('footerText', event.target.value)}
                  className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm"
                />
              </label>
            </div>
          </section>

          <section className="joko-admin-paper-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#303532]">Visible sections</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {VISIBILITY_FIELDS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 rounded-xl border border-[#55766F]/14 bg-white/65 px-3 py-3 text-sm text-[#303532]">
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={(event) => updateDraft(key, event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#C76624] focus:ring-[#C76624]"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="joko-admin-paper-card p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[#303532]">Colors</h2>
            <p className="mt-1 text-sm text-[#303532]/60">
              QR foreground/background colors are deliberately excluded.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COLOR_FIELDS.map(({ key, label }) => (
                <label key={key} className="rounded-xl border border-[#55766F]/14 bg-white/65 p-3">
                  <span className="block text-sm font-medium text-[#303532]">{label}</span>
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
                      className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 font-mono text-xs uppercase"
                    />
                  </div>
                </label>
              ))}
            </div>
          </section>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
              <span>{error}</span>
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 flex-none" />
              Saved. Customer QR Passes will use this design on their next load.
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving || mediaUploading || !dirty}
              className="joko-admin-primary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : mediaUploading ? 'Finish logo upload first' : 'Save QR Pass design'}
            </button>
            <button
              type="button"
              onClick={restoreDefaults}
              disabled={saving || mediaUploading}
              className="joko-admin-secondary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" />
              Restore defaults in preview
            </button>
          </div>
          <p className="text-xs leading-5 text-[#303532]/55">
            “Restore defaults” only changes the draft preview. Save explicitly to publish those defaults.
          </p>
        </div>

        <aside className="2xl:sticky 2xl:top-24 2xl:self-start">
          <div className="joko-admin-paper-card p-5 sm:p-6">
            <div className="mb-1 flex items-center justify-between gap-3">
              <div>
                <p className="joko-admin-eyebrow">85 × 55 mm</p>
                <h2 className="mt-1 text-lg font-semibold text-[#303532]">Live QR Pass preview</h2>
              </div>
              {dirty && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Unsaved</span>
              )}
            </div>
            <p className="mt-2 text-sm text-[#303532]/55">
              Dummy member data. The preview QR only opens joko.today. This is the same renderer used for customer PNG/PDF exports.
            </p>
            <BrandedQRCard
              qrToken="admin-preview-only"
              qrValue={PREVIEW_QR_VALUE}
              customerName="Joe Example"
              shortCode="VIP101"
              config={draft}
            />
          </div>
        </aside>
      </form>
    </div>
  );
}

export default QrPassDesignerManagement;
