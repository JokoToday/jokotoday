import { useEffect, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  LayoutTemplate,
  Palette,
  SlidersHorizontal,
  Type,
} from 'lucide-react';
import {
  BuilderPageRenderer,
  JOKO_BODY_FONT_OPTIONS,
  JOKO_DISPLAY_FONT_OPTIONS,
  getBuilderComponentDefinition,
  resolveJokoHomepageBranding,
  type BuilderAction,
  type BuilderDocument,
  type BuilderHomepageBranding,
  type BuilderSection,
  type BuilderSiteIdentity,
  type HomepageBuilderProviders,
  type LocalizedText,
} from '../../../platform/builder';
import { HomepageLogoUploader } from './HomepageLogoUploader';

interface JokoHomepageEditorProps {
  document: BuilderDocument;
  locale: string;
  site: BuilderSiteIdentity;
  providers: HomepageBuilderProviders;
  onDocumentChange: (document: BuilderDocument) => void;
  onAction?: (action: BuilderAction) => void;
  onUploadingChange?: (uploading: boolean) => void;
  onValidationError?: (issues: string[]) => void;
}

const sectionLabels: Record<BuilderSection['type'], string> = {
  'home.hero.v1': 'Bakery Hero',
  'home.top-liked.v1': 'Bakery Showcase',
  'home.category-grid.v1': 'Bakery Categories',
  'home.cta.v1': 'Closing CTA',
};

function localized(value: LocalizedText, locale: string, fallback: string): string {
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? '';
}

function withLocale(value: LocalizedText, locale: string, next: string): LocalizedText {
  return { ...value, [locale]: next };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[#55766F]">{children}</label>;
}

function TextField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const className = 'w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2.5 text-sm text-[#303532] outline-none transition focus:border-[#55766F]/55 focus:ring-2 focus:ring-[#55766F]/12';
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {multiline ? (
        <textarea rows={4} className={className} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={className} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  unit = 'px',
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-xs font-semibold text-[#303532]/65">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[#C76624]"
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-10 w-12 rounded-lg border border-[#55766F]/20 bg-white p-1"
        />
        <input
          value={value}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            if (/^#[0-9A-F]{0,6}$/.test(next)) onChange(next);
          }}
          className="min-w-0 flex-1 rounded-xl border border-[#55766F]/20 bg-white px-3 py-2 font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function JokoHomepageEditor({
  document,
  locale,
  site,
  providers,
  onDocumentChange,
  onAction,
  onUploadingChange,
  onValidationError,
}: JokoHomepageEditorProps) {
  const firstSectionId = document.sections[0]?.id ?? '';
  const [selectedSectionId, setSelectedSectionId] = useState(firstSectionId);
  const branding = useMemo(() => resolveJokoHomepageBranding(document.branding), [document.branding]);

  useEffect(() => {
    if (!document.sections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(document.sections[0]?.id ?? '');
    }
  }, [document.sections, selectedSectionId]);

  const selectedSection = document.sections.find((section) => section.id === selectedSectionId) ?? document.sections[0];
  const hero = document.sections.find((section) => section.type === 'home.hero.v1');

  const updateBranding = (next: BuilderHomepageBranding) => {
    onDocumentChange({ ...document, branding: next });
  };

  const updateTypography = (patch: Partial<BuilderHomepageBranding['typography']>) => {
    updateBranding({
      ...branding,
      typography: { ...branding.typography, ...patch },
    });
  };

  const updateColors = (patch: Partial<BuilderHomepageBranding['colors']>) => {
    updateBranding({
      ...branding,
      colors: { ...branding.colors, ...patch },
    });
  };

  const updateSection = (id: string, updater: (section: BuilderSection) => BuilderSection) => {
    onDocumentChange({
      ...document,
      sections: document.sections.map((section) => section.id === id ? updater(section) : section),
    });
  };

  const updateLogo = (url: string) => {
    if (!hero) return;
    updateSection(hero.id, (section) => section.type === 'home.hero.v1'
      ? { ...section, props: { ...section.props, logoUrl: url } }
      : section);
  };

  const selectSection = (id: string) => {
    setSelectedSectionId(id);
    window.requestAnimationFrame(() => {
      documentRef(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const documentRef = (id: string) =>
    window.document.querySelector(`[data-builder-section="${CSS.escape(id)}"]`);

  return (
    <div className="grid min-h-[44rem] border-y border-[#55766F]/16 bg-[#F7F3EA] xl:grid-cols-[19rem_minmax(0,1fr)_21rem]">
      <aside className="border-b border-[#55766F]/14 bg-[#FFF9EE]/92 p-4 xl:border-b-0 xl:border-r">
        <div className="sticky top-0 space-y-5">
          <div>
            <p className="joko-admin-eyebrow">Site identity</p>
            <h2 className="mt-1 text-lg font-semibold text-[#303532]">Brand & typography</h2>
          </div>

          {hero?.type === 'home.hero.v1' && (
            <HomepageLogoUploader
              compact
              value={hero.props.logoUrl || '/assets/brand/joko-today-logo-v0.4.webp'}
              onChange={updateLogo}
              onUploadingChange={onUploadingChange}
            />
          )}

          <RangeField
            label="Logo size"
            value={branding.logoScale}
            min={70}
            max={150}
            unit="%"
            onChange={(logoScale) => updateBranding({ ...branding, logoScale })}
          />

          <details className="rounded-2xl border border-[#55766F]/14 bg-white/70 p-3" open>
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#303532]">
              <Type className="h-4 w-4 text-[#55766F]" />
              Typography
            </summary>
            <div className="mt-4 space-y-4">
              <div>
                <FieldLabel>English display font</FieldLabel>
                <select
                  value={branding.typography.displayFont}
                  onChange={(event) => updateTypography({ displayFont: event.target.value as BuilderHomepageBranding['typography']['displayFont'] })}
                  className="w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2.5 text-sm"
                >
                  {JOKO_DISPLAY_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>English body font</FieldLabel>
                <select
                  value={branding.typography.bodyFont}
                  onChange={(event) => updateTypography({ bodyFont: event.target.value as BuilderHomepageBranding['typography']['bodyFont'] })}
                  className="w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2.5 text-sm"
                >
                  {JOKO_BODY_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <p className="rounded-xl bg-[#EEF5F2] px-3 py-2 text-[11px] leading-5 text-[#304B45]/70">
                Thai uses Noto Sans Thai Looped. Chinese uses Noto Sans SC. These stay protected until additional tested font families are added.
              </p>
              <RangeField label="Hero headline" value={branding.typography.heroSize} min={42} max={88} onChange={(heroSize) => updateTypography({ heroSize })} />
              <RangeField label="Section headings" value={branding.typography.sectionHeadingSize} min={24} max={56} onChange={(sectionHeadingSize) => updateTypography({ sectionHeadingSize })} />
              <RangeField label="Body text" value={branding.typography.bodySize} min={14} max={20} onChange={(bodySize) => updateTypography({ bodySize })} />
              <RangeField label="Navigation" value={branding.typography.navSize} min={12} max={20} onChange={(navSize) => updateTypography({ navSize })} />
              <RangeField label="Buttons" value={branding.typography.buttonSize} min={13} max={20} onChange={(buttonSize) => updateTypography({ buttonSize })} />
              <RangeField label="Small labels" value={branding.typography.labelSize} min={9} max={15} onChange={(labelSize) => updateTypography({ labelSize })} />
            </div>
          </details>

          <details className="rounded-2xl border border-[#55766F]/14 bg-white/70 p-3">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#303532]">
              <Palette className="h-4 w-4 text-[#55766F]" />
              Brand colors
            </summary>
            <div className="mt-4 space-y-4">
              <ColorField label="Text" value={branding.colors.text} onChange={(text) => updateColors({ text })} />
              <ColorField label="Accent" value={branding.colors.accent} onChange={(accent) => updateColors({ accent })} />
              <ColorField label="Turquoise" value={branding.colors.turquoise} onChange={(turquoise) => updateColors({ turquoise })} />
            </div>
          </details>

          <div className="border-t border-[#55766F]/14 pt-4">
            <div className="mb-3 flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4 text-[#55766F]" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#55766F]">Homepage sections</p>
            </div>
            <div className="space-y-2">
              {document.sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => selectSection(section.id)}
                  className={[
                    'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition',
                    selectedSection?.id === section.id
                      ? 'border-[#C76624]/45 bg-[#FFF3E7] font-semibold text-[#303532]'
                      : 'border-[#55766F]/12 bg-white/65 text-[#303532]/75 hover:bg-white',
                  ].join(' ')}
                >
                  <span>{sectionLabels[section.type]}</span>
                  {section.visible ? <Eye className="h-4 w-4 text-[#55766F]" /> : <EyeOff className="h-4 w-4 text-[#303532]/35" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="min-w-0 bg-[#E7EEEB] p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#55766F]">Live draft</p>
            <p className="mt-1 text-sm text-[#303532]/60">Click a section in the preview to edit it.</p>
          </div>
          <span className="rounded-full border border-[#55766F]/16 bg-white/70 px-3 py-1 text-xs text-[#304B45]">{locale.toUpperCase()}</span>
        </div>
        <div className="overflow-hidden rounded-[1.5rem] border border-[#55766F]/18 bg-white shadow-[0_18px_46px_rgba(48,75,69,.08)]">
          <BuilderPageRenderer
            document={document}
            locale={locale}
            site={site}
            providers={providers}
            onAction={onAction}
            selectedSectionId={selectedSection?.id}
            onSectionSelect={setSelectedSectionId}
            onValidationError={(validationIssues) => onValidationError?.(validationIssues.map((issue) => `${issue.path}: ${issue.message}`))}
          />
        </div>
      </main>

      <aside className="border-t border-[#55766F]/14 bg-[#FFF9EE]/94 p-4 xl:border-l xl:border-t-0">
        <div className="sticky top-0">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#55766F]" />
            <p className="joko-admin-eyebrow">Edit section</p>
          </div>
          {selectedSection ? (
            <SectionEditor
              section={selectedSection}
              locale={locale}
              fallbackLocale={site.defaultLocale}
              onChange={(next) => updateSection(selectedSection.id, () => next)}
            />
          ) : (
            <p className="mt-4 text-sm text-[#303532]/55">Choose a homepage section.</p>
          )}
        </div>
      </aside>
    </div>
  );
}

function SectionEditor({
  section,
  locale,
  fallbackLocale,
  onChange,
}: {
  section: BuilderSection;
  locale: string;
  fallbackLocale: string;
  onChange: (section: BuilderSection) => void;
}) {
  const definition = getBuilderComponentDefinition(section.type);
  const setVisible = (visible: boolean) => onChange({ ...section, visible } as BuilderSection);
  const setDesign = (patch: Record<string, string>) => onChange({
    ...section,
    design: { ...section.design, ...patch },
  } as BuilderSection);

  const editorHeader = (
    <>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#303532]">{sectionLabels[section.type]}</h2>
          <p className="mt-1 text-xs text-[#303532]/50">Editing {locale.toUpperCase()} content</p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(!section.visible)}
          className={[
            'rounded-full px-3 py-1 text-xs font-semibold',
            section.visible ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500',
          ].join(' ')}
        >
          {section.visible ? 'Shown' : 'Hidden'}
        </button>
      </div>
      <div className="my-4 h-px bg-[#55766F]/12" />
    </>
  );

  const advanced = (
    <details className="mt-5 rounded-xl border border-[#55766F]/12 bg-white/60 p-3">
      <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-[#55766F]">Advanced layout</summary>
      <div className="mt-3 grid gap-3">
        <div>
          <FieldLabel>Width</FieldLabel>
          <select value={section.design.width} onChange={(event) => setDesign({ width: event.target.value })} className="w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2 text-sm">
            {definition.capabilities.widths.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Spacing</FieldLabel>
          <select value={section.design.spacing} onChange={(event) => setDesign({ spacing: event.target.value })} className="w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2 text-sm">
            {definition.capabilities.spacings.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </div>
    </details>
  );

  if (section.type === 'home.hero.v1') {
    const props = section.props;
    const patch = (next: Partial<typeof props>) => onChange({ ...section, props: { ...props, ...next } });
    return (
      <div>
        {editorHeader}
        <div className="space-y-4">
          <TextField label="Headline" multiline value={localized(props.title, locale, fallbackLocale)} onChange={(value) => patch({ title: withLocale(props.title, locale, value) })} />
          <TextField label="Subtitle" multiline value={localized(props.subtitle, locale, fallbackLocale)} onChange={(value) => patch({ subtitle: withLocale(props.subtitle, locale, value) })} />
          <TextField label="Primary button" value={localized(props.primaryActionLabel, locale, fallbackLocale)} onChange={(value) => patch({ primaryActionLabel: withLocale(props.primaryActionLabel, locale, value) })} />
          <TextField label="Secondary button" value={localized(props.secondaryActionLabel, locale, fallbackLocale)} onChange={(value) => patch({ secondaryActionLabel: withLocale(props.secondaryActionLabel, locale, value) })} />
          <details className="rounded-xl border border-[#55766F]/12 bg-white/60 p-3">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.12em] text-[#55766F]">Accessibility</summary>
            <div className="mt-3"><TextField label="Hero image alt text" value={localized(props.mediaAlt, locale, fallbackLocale)} onChange={(value) => patch({ mediaAlt: withLocale(props.mediaAlt, locale, value) })} /></div>
          </details>
        </div>
        {advanced}
      </div>
    );
  }

  if (section.type === 'home.top-liked.v1') {
    const props = section.props;
    const patch = (next: Partial<typeof props>) => onChange({ ...section, props: { ...props, ...next } });
    return (
      <div>
        {editorHeader}
        <div className="space-y-4">
          <TextField label="Section title" value={localized(props.title, locale, fallbackLocale)} onChange={(value) => patch({ title: withLocale(props.title, locale, value) })} />
          <TextField label="Intro" multiline value={localized(props.subtitle, locale, fallbackLocale)} onChange={(value) => patch({ subtitle: withLocale(props.subtitle, locale, value) })} />
          <TextField label="Browse link" value={localized(props.browseLabel, locale, fallbackLocale)} onChange={(value) => patch({ browseLabel: withLocale(props.browseLabel, locale, value) })} />
        </div>
        {advanced}
      </div>
    );
  }

  if (section.type === 'home.category-grid.v1') {
    const props = section.props;
    const patch = (next: Partial<typeof props>) => onChange({ ...section, props: { ...props, ...next } });
    return (
      <div>
        {editorHeader}
        <TextField label="Section title" value={localized(props.title, locale, fallbackLocale)} onChange={(value) => patch({ title: withLocale(props.title, locale, value) })} />
        {advanced}
      </div>
    );
  }

  const props = section.props;
  const patch = (next: Partial<typeof props>) => onChange({ ...section, props: { ...props, ...next } });
  return (
    <div>
      {editorHeader}
      <div className="space-y-4">
        <TextField label="Title" value={localized(props.title, locale, fallbackLocale)} onChange={(value) => patch({ title: withLocale(props.title, locale, value) })} />
        <TextField label="Body" multiline value={localized(props.body, locale, fallbackLocale)} onChange={(value) => patch({ body: withLocale(props.body, locale, value) })} />
        <TextField label="Button label" value={localized(props.actionLabel, locale, fallbackLocale)} onChange={(value) => patch({ actionLabel: withLocale(props.actionLabel, locale, value) })} />
      </div>
      {advanced}
    </div>
  );
}

export default JokoHomepageEditor;
