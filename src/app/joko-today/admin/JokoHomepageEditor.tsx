import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  JOKO_CHINESE_BODY_FONT_OPTIONS,
  JOKO_CHINESE_DISPLAY_FONT_OPTIONS,
  JOKO_DISPLAY_FONT_OPTIONS,
  JOKO_FONT_WEIGHT_OPTIONS,
  JOKO_THAI_BODY_FONT_OPTIONS,
  JOKO_THAI_DISPLAY_FONT_OPTIONS,
  getBuilderComponentDefinition,
  localizeRichText,
  resolveJokoHomepageBranding,
  richTextToPlainText,
  type BuilderAction,
  type BuilderDocument,
  type BuilderHomepageBranding,
  type BuilderRichText,
  type BuilderSection,
  type BuilderSiteIdentity,
  type HomepageBuilderProviders,
  type LocalizedText,
} from '../../../platform/builder';
import { HomepageLogoUploader } from './HomepageLogoUploader';
import { ControlledRichTextEditor } from './ControlledRichTextEditor';

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

type PreviewViewport = 'desktop' | 'tablet' | 'mobile';
type PreviewZoom = 'fit' | 'actual';

const PREVIEW_WIDTHS: Record<PreviewViewport, number> = {
  desktop: 1440,
  tablet: 768,
  mobile: 390,
};

const previewViewportLabels: Record<PreviewViewport, string> = {
  desktop: 'Desktop 1440',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

function localized(value: LocalizedText, locale: string, fallback: string): string {
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? '';
}

function withLocale(value: LocalizedText, locale: string, next: string): LocalizedText {
  return { ...value, [locale]: next };
}

function withLocaleRichText(
  value: Readonly<Record<string, BuilderRichText>> | undefined,
  locale: string,
  next: BuilderRichText,
): Readonly<Record<string, BuilderRichText>> {
  return { ...(value ?? {}), [locale]: next };
}

function FieldLabel({ children }: { children: ReactNode }) {
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
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

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
          value={draft}
          aria-label={`${label} hex value`}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            setDraft(next);
            if (/^#[0-9A-F]{6}$/.test(next)) onChange(next);
          }}
          onBlur={() => {
            if (!/^#[0-9A-F]{6}$/i.test(draft)) setDraft(value);
          }}
          className="min-w-0 flex-1 rounded-xl border border-[#55766F]/20 bg-white px-3 py-2 font-mono text-xs text-[#303532]/70"
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
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>('desktop');
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>('fit');
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [previewHostWidth, setPreviewHostWidth] = useState(0);
  const [previewContentHeight, setPreviewContentHeight] = useState(900);
  const [previewFrameDocument, setPreviewFrameDocument] = useState<Document | null>(null);
  const previewHostRef = useRef<HTMLDivElement | null>(null);
  const previewTopScrollRef = useRef<HTMLDivElement | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const branding = useMemo(() => resolveJokoHomepageBranding(document.branding), [document.branding]);
  const previewWidth = PREVIEW_WIDTHS[previewViewport];
  const previewScale = previewZoom === 'actual' || previewHostWidth === 0
    ? 1
    : Math.min(1, Math.max(0.2, (previewHostWidth - 2) / previewWidth));

  useEffect(() => {
    if (!document.sections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(document.sections[0]?.id ?? '');
    }
  }, [document.sections, selectedSectionId]);

  useEffect(() => {
    const host = previewHostRef.current;
    if (!host) return undefined;

    const measure = () => setPreviewHostWidth(host.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!previewFrameDocument) return undefined;

    previewFrameDocument.documentElement.lang = locale;
    previewFrameDocument.body.style.margin = '0';
    previewFrameDocument.body.style.background = '#ffffff';
    previewFrameDocument.body.style.minWidth = '0';

    const measure = () => {
      const root = previewFrameDocument.getElementById('joko-builder-preview-root');
      const nextHeight = Math.max(
        root?.scrollHeight ?? 0,
        previewFrameDocument.body.scrollHeight,
        previewFrameDocument.documentElement.scrollHeight,
        640,
      );
      setPreviewContentHeight(nextHeight);
    };

    const observer = new ResizeObserver(measure);
    const root = previewFrameDocument.getElementById('joko-builder-preview-root');
    if (root) observer.observe(root);
    observer.observe(previewFrameDocument.body);
    measure();

    return () => observer.disconnect();
  }, [previewFrameDocument, locale, document]);

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
    previewFrameRef.current?.contentDocument?.querySelector(`[data-builder-section="${CSS.escape(id)}"]`)
    ?? window.document.querySelector(`[data-builder-section="${CSS.escape(id)}"]`);

  const handlePreviewFrameLoad = () => {
    const frameDocument = previewFrameRef.current?.contentDocument ?? null;
    if (!frameDocument) return;

    const head = frameDocument.head;
    head.replaceChildren();

    const base = frameDocument.createElement('base');
    base.href = `${window.location.origin}/`;
    head.appendChild(base);

    window.document.head
      .querySelectorAll('link[rel="stylesheet"], style')
      .forEach((node) => head.appendChild(node.cloneNode(true)));

    setPreviewFrameDocument(frameDocument);
  };

  const editorGridClass = [
    'grid min-h-[44rem] border-y border-[#55766F]/16 bg-[#F7F3EA]',
    leftPanelCollapsed && rightPanelCollapsed
      ? 'xl:grid-cols-[3.25rem_minmax(0,1fr)_3.25rem]'
      : leftPanelCollapsed
        ? 'xl:grid-cols-[3.25rem_minmax(0,1fr)_21rem]'
        : rightPanelCollapsed
          ? 'xl:grid-cols-[19rem_minmax(0,1fr)_3.25rem]'
          : 'xl:grid-cols-[19rem_minmax(0,1fr)_21rem]',
  ].join(' ');

  const toolbarButtonClass = (active: boolean) => [
    'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
    active
      ? 'border-[#C76624]/40 bg-[#FFF1E5] text-[#9E4E1D]'
      : 'border-[#55766F]/16 bg-white/72 text-[#304B45]/72 hover:bg-white',
  ].join(' ');

  const syncPreviewScrollFromTop = () => {
    const top = previewTopScrollRef.current;
    const preview = previewHostRef.current;
    if (!top || !preview) return;
    if (Math.abs(preview.scrollLeft - top.scrollLeft) > 1) preview.scrollLeft = top.scrollLeft;
  };

  const syncPreviewScrollFromBottom = () => {
    const top = previewTopScrollRef.current;
    const preview = previewHostRef.current;
    if (!top || !preview) return;
    if (Math.abs(top.scrollLeft - preview.scrollLeft) > 1) top.scrollLeft = preview.scrollLeft;
  };

  return (
    <div className={editorGridClass}>
      <aside className="border-b border-[#55766F]/14 bg-[#FFF9EE]/92 p-4 xl:border-b-0 xl:border-r">
        {leftPanelCollapsed ? (
          <div className="sticky top-0 flex justify-center">
            <button
              type="button"
              onClick={() => setLeftPanelCollapsed(false)}
              className="rounded-xl border border-[#55766F]/16 bg-white px-3 py-2 text-lg text-[#304B45]"
              aria-label="Expand Site Identity panel"
              title="Expand Site Identity"
            >
              ›
            </button>
          </div>
        ) : (
        <div className="sticky top-0 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="joko-admin-eyebrow">Site identity</p>
              <h2 className="mt-1 text-lg font-semibold text-[#303532]">Brand & typography</h2>
            </div>
            <button
              type="button"
              onClick={() => setLeftPanelCollapsed(true)}
              className="rounded-lg border border-[#55766F]/14 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-[#304B45]/70 hover:bg-white"
              aria-label="Collapse Site Identity panel"
              title="Collapse Site Identity"
            >
              ‹
            </button>
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
              {branding.typography.displayFont === 'noto-sans' && (
                <div>
                  <FieldLabel>Noto Sans display weight</FieldLabel>
                  <select
                    value={branding.typography.displayWeight}
                    onChange={(event) => updateTypography({ displayWeight: Number(event.target.value) as BuilderHomepageBranding['typography']['displayWeight'] })}
                    className="w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2.5 text-sm"
                  >
                    {JOKO_FONT_WEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.value})</option>)}
                  </select>
                </div>
              )}
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
              {branding.typography.bodyFont === 'noto-sans' && (
                <div>
                  <FieldLabel>Noto Sans body weight</FieldLabel>
                  <select
                    value={branding.typography.bodyWeight}
                    onChange={(event) => updateTypography({ bodyWeight: Number(event.target.value) as BuilderHomepageBranding['typography']['bodyWeight'] })}
                    className="w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2.5 text-sm"
                  >
                    {JOKO_FONT_WEIGHT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.value})</option>)}
                  </select>
                </div>
              )}
              <div className="border-t border-[#55766F]/12 pt-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#55766F]">Thai</p>
                <div className="space-y-3">
                  <div>
                    <FieldLabel>Thai display font</FieldLabel>
                    <select
                      value={branding.typography.thaiDisplayFont}
                      onChange={(event) => updateTypography({ thaiDisplayFont: event.target.value as BuilderHomepageBranding['typography']['thaiDisplayFont'] })}
                      className="w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2.5 text-sm"
                    >
                      {JOKO_THAI_DISPLAY_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Thai body font</FieldLabel>
                    <select
                      value={branding.typography.thaiBodyFont}
                      onChange={(event) => updateTypography({ thaiBodyFont: event.target.value as BuilderHomepageBranding['typography']['thaiBodyFont'] })}
                      className="w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2.5 text-sm"
                    >
                      {JOKO_THAI_BODY_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="border-t border-[#55766F]/12 pt-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#55766F]">Chinese</p>
                <div className="space-y-3">
                  <div>
                    <FieldLabel>Chinese display font</FieldLabel>
                    <select
                      value={branding.typography.chineseDisplayFont}
                      onChange={(event) => updateTypography({ chineseDisplayFont: event.target.value as BuilderHomepageBranding['typography']['chineseDisplayFont'] })}
                      className="w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2.5 text-sm"
                    >
                      {JOKO_CHINESE_DISPLAY_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <FieldLabel>Chinese body font</FieldLabel>
                    <select
                      value={branding.typography.chineseBodyFont}
                      onChange={(event) => updateTypography({ chineseBodyFont: event.target.value as BuilderHomepageBranding['typography']['chineseBodyFont'] })}
                      className="w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2.5 text-sm"
                    >
                      {JOKO_CHINESE_BODY_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
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
        )}
      </aside>

      <main className="min-w-0 bg-[#E7EEEB] p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#55766F]">Live draft</p>
            <p className="mt-1 text-sm text-[#303532]/60">Click a section in the preview to edit it.</p>
          </div>
          <span className="rounded-full border border-[#55766F]/16 bg-white/70 px-3 py-1 text-xs text-[#304B45]">{locale.toUpperCase()}</span>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#55766F]/12 bg-white/48 p-1">
            {(['desktop', 'tablet', 'mobile'] as PreviewViewport[]).map((viewport) => (
              <button
                key={viewport}
                type="button"
                onClick={() => setPreviewViewport(viewport)}
                className={toolbarButtonClass(previewViewport === viewport)}
              >
                {previewViewportLabels[viewport]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 rounded-xl border border-[#55766F]/12 bg-white/48 p-1">
            <button
              type="button"
              onClick={() => setPreviewZoom('fit')}
              className={toolbarButtonClass(previewZoom === 'fit')}
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => setPreviewZoom('actual')}
              className={toolbarButtonClass(previewZoom === 'actual')}
            >
              100%
            </button>
          </div>
          <span className="text-[11px] font-medium text-[#304B45]/55">
            {previewWidth}px · {Math.round(previewScale * 100)}%
          </span>
        </div>

        <div
          ref={previewTopScrollRef}
          onScroll={syncPreviewScrollFromTop}
          className="mb-1 overflow-x-auto overflow-y-hidden rounded-lg bg-white/35"
          aria-label="Live draft horizontal scroll"
        >
          <div
            aria-hidden="true"
            style={{
              width: `${previewWidth * previewScale}px`,
              height: '1px',
            }}
          />
        </div>

        <div
          ref={previewHostRef}
          onScroll={syncPreviewScrollFromBottom}
          className="overflow-auto rounded-[1.5rem] border border-[#55766F]/18 bg-[#DCE7E4] p-2 shadow-[0_18px_46px_rgba(48,75,69,.08)]"
        >
          <div
            className="relative mx-auto"
            style={{
              width: `${previewWidth * previewScale}px`,
              height: `${previewContentHeight * previewScale}px`,
            }}
          >
            <iframe
              ref={previewFrameRef}
              title="JOKO Homepage live draft"
              srcDoc="<!doctype html><html><head></head><body><div id='joko-builder-preview-root'></div></body></html>"
              onLoad={handlePreviewFrameLoad}
              className="absolute left-0 top-0 border-0 bg-white"
              style={{
                width: `${previewWidth}px`,
                height: `${previewContentHeight}px`,
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
              }}
            />
            {previewFrameDocument?.getElementById('joko-builder-preview-root') && createPortal(
              <BuilderPageRenderer
                document={document}
                locale={locale}
                site={site}
                providers={providers}
                onAction={onAction}
                selectedSectionId={selectedSection?.id}
                onSectionSelect={setSelectedSectionId}
                onValidationError={(validationIssues) => onValidationError?.(validationIssues.map((issue) => `${issue.path}: ${issue.message}`))}
              />,
              previewFrameDocument.getElementById('joko-builder-preview-root')!,
            )}
          </div>
        </div>
      </main>

      <aside className="border-t border-[#55766F]/14 bg-[#FFF9EE]/94 p-4 xl:border-l xl:border-t-0">
        {rightPanelCollapsed ? (
          <div className="sticky top-0 flex justify-center">
            <button
              type="button"
              onClick={() => setRightPanelCollapsed(false)}
              className="rounded-xl border border-[#55766F]/16 bg-white px-3 py-2 text-lg text-[#304B45]"
              aria-label="Expand Edit Section panel"
              title="Expand Edit Section"
            >
              ‹
            </button>
          </div>
        ) : (
        <div className="sticky top-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#55766F]" />
              <p className="joko-admin-eyebrow">Edit section</p>
            </div>
            <button
              type="button"
              onClick={() => setRightPanelCollapsed(true)}
              className="rounded-lg border border-[#55766F]/14 bg-white/70 px-2.5 py-1.5 text-xs font-semibold text-[#304B45]/70 hover:bg-white"
              aria-label="Collapse Edit Section panel"
              title="Collapse Edit Section"
            >
              ›
            </button>
          </div>
          {selectedSection ? (
            <SectionEditor
              section={selectedSection}
              locale={locale}
              fallbackLocale={site.defaultLocale}
              branding={branding}
              onChange={(next) => updateSection(selectedSection.id, () => next)}
            />
          ) : (
            <p className="mt-4 text-sm text-[#303532]/55">Choose a homepage section.</p>
          )}
        </div>
        )}
      </aside>
    </div>
  );
}

function SectionEditor({
  section,
  locale,
  fallbackLocale,
  branding,
  onChange,
}: {
  section: BuilderSection;
  locale: string;
  fallbackLocale: string;
  branding: BuilderHomepageBranding;
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
          <div>
            <FieldLabel>Headline</FieldLabel>
            <ControlledRichTextEditor
              value={localizeRichText(
                props.titleRichText,
                locale,
                fallbackLocale,
                localized(props.title, locale, fallbackLocale),
              )}
              colors={branding.colors}
              onChange={(value) => patch({
                title: withLocale(props.title, locale, richTextToPlainText(value)),
                titleRichText: withLocaleRichText(props.titleRichText, locale, value),
              })}
            />
          </div>
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
