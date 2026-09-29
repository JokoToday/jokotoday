import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Eye, EyeOff } from 'lucide-react';
import {
  BuilderPageRenderer,
  builderSiteStyleToCssVariables,
  getBuilderComponentDefinition,
  normalizeBuilderSiteStyle,
  type BuilderAction,
  type BuilderDocument,
  type BuilderSection,
  type BuilderSiteIdentity,
  type HomepageBuilderProviders,
  type LocalizedText,
} from '../../../platform/builder';

interface HomepageControlledEditorProps {
  document: BuilderDocument;
  locale: string;
  site: BuilderSiteIdentity;
  providers: HomepageBuilderProviders;
  onAction?: (action: BuilderAction) => void;
  onDocumentChange: (document: BuilderDocument) => void;
}

const labelsByType: Record<BuilderSection['type'], string> = {
  'home.hero.v1': 'Bakery Hero',
  'home.top-liked.v1': 'Bakery Showcase',
  'home.category-grid.v1': 'Bakery Categories',
  'home.cta.v1': 'Closing CTA',
};

const localeNames: Record<string, string> = {
  en: 'English',
  th: 'Thai',
  zh: 'Chinese',
};

function localized(value: LocalizedText, locale: string, fallback: string): string {
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? '';
}

function withLocale(value: LocalizedText, locale: string, next: string): LocalizedText {
  return { ...value, [locale]: next };
}

export function HomepageControlledEditor({
  document,
  locale,
  site,
  providers,
  onAction,
  onDocumentChange,
}: HomepageControlledEditorProps) {
  const editableSections = useMemo(
    () => document.sections.filter(
      (section) =>
        section.type === 'home.hero.v1' ||
        section.type === 'home.top-liked.v1',
    ),
    [document.sections],
  );
  const [selectedId, setSelectedId] = useState(editableSections[0]?.id ?? '');
  const selected = useMemo(
    () => editableSections.find((section) => section.id === selectedId) ?? editableSections[0],
    [editableSections, selectedId],
  );

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const updateSection = (nextSection: BuilderSection) => {
    onDocumentChange({
      ...document,
      sections: document.sections.map((section) =>
        section.id === nextSection.id ? nextSection : section,
      ),
    });
  };

  const siteStyle = normalizeBuilderSiteStyle(document.siteStyle);

  return (
    <div className="grid min-h-[760px] grid-cols-1 overflow-hidden border-y border-[#55766F]/16 bg-[#F8F4EB] xl:grid-cols-[14rem_minmax(0,1fr)_20rem]">
      <aside className="border-b border-[#55766F]/14 bg-[#F4EFE5]/92 p-4 xl:border-b-0 xl:border-r">
        <p className="joko-admin-eyebrow">Homepage sections</p>
        <p className="mt-2 text-xs leading-5 text-[#303532]/55">
          The homepage structure is protected. Select a section to edit its content and presentation.
        </p>

        <div className="mt-4 space-y-2">
          {editableSections.map((section) => {
            const active = section.id === selected?.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setSelectedId(section.id)}
                className={[
                  'flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition',
                  active
                    ? 'border-[#55766F]/35 bg-[#D9ECE9] text-[#304B45] shadow-sm'
                    : 'border-[#55766F]/12 bg-white/55 text-[#303532] hover:bg-white',
                ].join(' ')}
              >
                <span className={[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  section.visible ? 'bg-[#C76624]/12 text-[#A95122]' : 'bg-gray-100 text-gray-400',
                ].join(' ')}>
                  {section.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{labelsByType[section.type]}</span>
                  <span className="mt-0.5 block text-[11px] text-[#303532]/45">
                    {section.visible ? 'Shown' : 'Hidden'}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 opacity-45" />
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-xl border border-[#55766F]/12 bg-white/45 p-3 text-xs leading-5 text-[#303532]/55">
          Only sections already wired to the live Experience are editable here. Pickup, How It Works, About and other operational sections remain connected to their dedicated CMS/data sources. Nothing in this panel is preview-only.
        </div>
      </aside>

      <main className="min-w-0 bg-[#E8EFEC] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#55766F]">Live draft canvas</p>
            <p className="mt-1 text-sm text-[#303532]/60">
              Changes update here immediately. Editing {localeNames[locale] ?? locale}.
            </p>
          </div>
          {selected && (
            <span className="rounded-full border border-[#55766F]/16 bg-white/75 px-3 py-1.5 text-xs font-semibold text-[#304B45]">
              Editing: {labelsByType[selected.type]}
            </span>
          )}
        </div>

        <div
          className="joko-home-shell max-h-[700px] overflow-auto rounded-2xl border border-[#55766F]/18 bg-white shadow-[0_18px_44px_rgba(48,75,69,.10)]"
          style={builderSiteStyleToCssVariables(siteStyle)}
        >
          <BuilderPageRenderer
            document={document}
            locale={locale}
            site={site}
            providers={providers}
            onAction={onAction}
            selectedSectionId={selected?.id}
            onSectionSelect={setSelectedId}
          />
        </div>
      </main>

      <aside className="border-t border-[#55766F]/14 bg-[#FFF9EE] p-4 xl:border-l xl:border-t-0">
        {selected ? (
          <SectionSettings
            section={selected}
            locale={locale}
            fallbackLocale={site.defaultLocale}
            onChange={updateSection}
          />
        ) : (
          <p className="text-sm text-[#303532]/55">Select a homepage section.</p>
        )}
      </aside>
    </div>
  );
}

function SectionSettings({
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

  const patchCommon = (
    patch: Partial<Pick<BuilderSection, 'visible'>>,
    designPatch?: Record<string, unknown>,
  ) => {
    onChange({
      ...section,
      ...patch,
      design: {
        ...section.design,
        ...(designPatch ?? {}),
      },
    } as BuilderSection);
  };

  const localeLabel = localeNames[locale] ?? locale;

  return (
    <div>
      <p className="joko-admin-eyebrow">Edit section</p>
      <h2 className="mt-1 text-xl font-semibold text-[#303532]">{labelsByType[section.type]}</h2>
      <p className="mt-1 text-xs text-[#303532]/50">Content language: {localeLabel}</p>

      <div className="mt-5">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#55766F]">Visibility</span>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {[true, false].map((visible) => (
            <button
              key={String(visible)}
              type="button"
              onClick={() => patchCommon({ visible })}
              className={[
                'inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold',
                section.visible === visible
                  ? 'border-[#55766F]/30 bg-[#D9ECE9] text-[#304B45]'
                  : 'border-[#55766F]/12 bg-white text-[#303532]/65',
              ].join(' ')}
            >
              {section.visible === visible && <Check className="h-4 w-4" />}
              {visible ? 'Shown' : 'Hidden'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {section.type === 'home.hero.v1' && (
          <>
            <TextArea
              label="Headline"
              value={localized(section.props.title, locale, fallbackLocale)}
              onChange={(next) => onChange({
                ...section,
                props: { ...section.props, title: withLocale(section.props.title, locale, next) },
              })}
            />
            <TextArea
              label="Subtitle"
              value={localized(section.props.subtitle, locale, fallbackLocale)}
              onChange={(next) => onChange({
                ...section,
                props: { ...section.props, subtitle: withLocale(section.props.subtitle, locale, next) },
              })}
            />
            <TextField
              label="Primary button"
              value={localized(section.props.primaryActionLabel, locale, fallbackLocale)}
              onChange={(next) => onChange({
                ...section,
                props: {
                  ...section.props,
                  primaryActionLabel: withLocale(section.props.primaryActionLabel, locale, next),
                },
              })}
            />
            <TextField
              label="Secondary button"
              value={localized(section.props.secondaryActionLabel, locale, fallbackLocale)}
              onChange={(next) => onChange({
                ...section,
                props: {
                  ...section.props,
                  secondaryActionLabel: withLocale(section.props.secondaryActionLabel, locale, next),
                },
              })}
            />
            <details className="rounded-xl border border-[#55766F]/12 bg-white/45 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-[#55766F]">Advanced</summary>
              <div className="mt-3">
                <TextField
                  label="Image alt text"
                  value={localized(section.props.mediaAlt, locale, fallbackLocale)}
                  onChange={(next) => onChange({
                    ...section,
                    props: { ...section.props, mediaAlt: withLocale(section.props.mediaAlt, locale, next) },
                  })}
                />
              </div>
            </details>
          </>
        )}

        {section.type === 'home.top-liked.v1' && (
          <>
            <TextField
              label="Section heading"
              value={localized(section.props.title, locale, fallbackLocale)}
              onChange={(next) => onChange({
                ...section,
                props: { ...section.props, title: withLocale(section.props.title, locale, next) },
              })}
            />
            <TextArea
              label="Intro"
              value={localized(section.props.subtitle, locale, fallbackLocale)}
              onChange={(next) => onChange({
                ...section,
                props: { ...section.props, subtitle: withLocale(section.props.subtitle, locale, next) },
              })}
            />
            <TextField
              label="Browse link"
              value={localized(section.props.browseLabel, locale, fallbackLocale)}
              onChange={(next) => onChange({
                ...section,
                props: { ...section.props, browseLabel: withLocale(section.props.browseLabel, locale, next) },
              })}
            />
          </>
        )}

        {section.type === 'home.category-grid.v1' && (
          <TextField
            label="Section heading"
            value={localized(section.props.title, locale, fallbackLocale)}
            onChange={(next) => onChange({
              ...section,
              props: { ...section.props, title: withLocale(section.props.title, locale, next) },
            })}
          />
        )}

        {section.type === 'home.cta.v1' && (
          <>
            <TextField
              label="Heading"
              value={localized(section.props.title, locale, fallbackLocale)}
              onChange={(next) => onChange({
                ...section,
                props: { ...section.props, title: withLocale(section.props.title, locale, next) },
              })}
            />
            <TextArea
              label="Body"
              value={localized(section.props.body, locale, fallbackLocale)}
              onChange={(next) => onChange({
                ...section,
                props: { ...section.props, body: withLocale(section.props.body, locale, next) },
              })}
            />
            <TextField
              label="Button"
              value={localized(section.props.actionLabel, locale, fallbackLocale)}
              onChange={(next) => onChange({
                ...section,
                props: {
                  ...section.props,
                  actionLabel: withLocale(section.props.actionLabel, locale, next),
                },
              })}
            />
          </>
        )}
      </div>

      <details className="mt-5 rounded-xl border border-[#55766F]/12 bg-[#F4EFE5]/70 p-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.08em] text-[#55766F]">
          Layout
        </summary>
        <div className="mt-3 space-y-3">
          <SelectField
            label="Width"
            value={section.design.width}
            options={definition.capabilities.widths}
            onChange={(next) => patchCommon({}, { width: next })}
          />
          <SelectField
            label="Spacing"
            value={section.design.spacing}
            options={definition.capabilities.spacings}
            onChange={(next) => patchCommon({}, { spacing: next })}
          />
        </div>
      </details>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#55766F]">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-xl border border-[#55766F]/18 bg-white px-3 py-2.5 text-sm text-[#303532] outline-none focus:border-[#55766F] focus:ring-2 focus:ring-[#55766F]/15"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#55766F]">{label}</span>
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full resize-y rounded-xl border border-[#55766F]/18 bg-white px-3 py-2.5 text-sm leading-6 text-[#303532] outline-none focus:border-[#55766F] focus:ring-2 focus:ring-[#55766F]/15"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#303532]/65">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-[#55766F]/18 bg-white px-3 py-2 text-sm text-[#303532]"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option.replace(/-/g, ' ')}</option>
        ))}
      </select>
    </label>
  );
}
