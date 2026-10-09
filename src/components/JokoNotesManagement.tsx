import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import { uploadGalleryImage } from '../lib/mediaService';
import {
  JOKO_BUBBLE_PAGES,
  JOKO_NOTE_PAGES,
  JOKO_NOTES_SITE_KEY,
  adminDeleteJokoNote,
  adminListJokoNotes,
  adminSaveJokoNote,
  getJokoAccentPage,
  getJokoBubblePage,
  localizeJokoNote,
  type JokoAccentType,
  type JokoBubbleSize,
  type JokoNote,
  type JokoNoteDraft,
  type JokoNoteFontPreset,
  type JokoNoteImageLayout,
} from '../lib/jokoNotesService';
import { JokoNote as JokoNoteCard } from './JokoNote';

type LanguageCode = 'en' | 'th' | 'zh';

const FIRST_PAGE = JOKO_NOTE_PAGES[0];
const FIRST_PLACEMENT = FIRST_PAGE.placements[0];

const PAGE_OPTIONS = [
  { pageKey: 'home', label: 'Homepage' },
  ...JOKO_NOTE_PAGES.map((page) => ({ pageKey: page.pageKey, label: page.label })),
];

const EMPTY_DRAFT: JokoNoteDraft = {
  site_key: JOKO_NOTES_SITE_KEY,
  page_key: FIRST_PAGE.pageKey,
  placement_key: FIRST_PLACEMENT.placementKey,
  accent_type: 'note',
  bubble_size: 'medium',
  bubble_image_url: null,
  bubble_alt: null,
  title_en: null,
  title_th: null,
  title_zh: null,
  body_en: null,
  body_th: null,
  body_zh: null,
  image_url: null,
  image_alt_en: null,
  image_alt_th: null,
  image_alt_zh: null,
  link_url: null,
  font_preset: 'handwritten',
  heading_size: 22,
  body_size: 14,
  rotation: 2,
  image_layout: 'stacked',
  is_published: false,
};

function draftFromNote(note: JokoNote | null, pageKey: string): JokoNoteDraft {
  if (!note) {
    const notePage = JOKO_NOTE_PAGES.find((page) => page.pageKey === pageKey);
    if (notePage) {
      return {
        ...EMPTY_DRAFT,
        page_key: notePage.pageKey,
        placement_key: notePage.placements[0].placementKey,
      };
    }

    const bubblePage = JOKO_BUBBLE_PAGES.find((page) => page.pageKey === pageKey);
    if (bubblePage) {
      return {
        ...EMPTY_DRAFT,
        page_key: bubblePage.pageKey,
        placement_key: bubblePage.placements[0].placementKey,
        accent_type: 'bubble',
      };
    }

    return { ...EMPTY_DRAFT };
  }

  return {
    site_key: note.site_key,
    page_key: note.page_key,
    placement_key: note.placement_key,
    accent_type: note.accent_type || 'note',
    bubble_size: note.bubble_size || 'medium',
    bubble_image_url: note.bubble_image_url || null,
    bubble_alt: note.bubble_alt || null,
    title_en: note.title_en,
    title_th: note.title_th,
    title_zh: note.title_zh,
    body_en: note.body_en,
    body_th: note.body_th,
    body_zh: note.body_zh,
    image_url: note.image_url,
    image_alt_en: note.image_alt_en,
    image_alt_th: note.image_alt_th,
    image_alt_zh: note.image_alt_zh,
    link_url: note.link_url,
    font_preset: note.font_preset,
    heading_size: note.heading_size,
    body_size: note.body_size,
    rotation: note.rotation,
    image_layout: note.image_layout,
    is_published: note.is_published,
  };
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const BUBBLE_PREVIEW_WIDTH: Record<JokoBubbleSize, string> = {
  small: 'max-w-[11rem]',
  medium: 'max-w-[16rem]',
  large: 'max-w-[20rem]',
};

export function JokoNotesManagement() {
  const [notes, setNotes] = useState<JokoNote[]>([]);
  const [selectedPageKey, setSelectedPageKey] = useState(FIRST_PAGE.pageKey);
  const [previewLanguage, setPreviewLanguage] = useState<LanguageCode>('en');
  const [draft, setDraft] = useState<JokoNoteDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const existing = useMemo(
    () => notes.find((note) => note.page_key === selectedPageKey) || null,
    [notes, selectedPageKey],
  );

  const notePageDefinition = useMemo(
    () => JOKO_NOTE_PAGES.find((page) => page.pageKey === selectedPageKey),
    [selectedPageKey],
  );

  const bubblePageDefinition = useMemo(
    () => getJokoBubblePage(selectedPageKey),
    [selectedPageKey],
  );

  const accentPageDefinition = useMemo(
    () => getJokoAccentPage(selectedPageKey, draft.accent_type)
      || bubblePageDefinition
      || notePageDefinition
      || FIRST_PAGE,
    [selectedPageKey, draft.accent_type, bubblePageDefinition, notePageDefinition],
  );

  const noteSupported = Boolean(notePageDefinition);
  const bubbleSupported = Boolean(bubblePageDefinition);
  const pageLabel = notePageDefinition?.label || bubblePageDefinition?.label || selectedPageKey;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setNotes(await adminListJokoNotes());
    } catch (err) {
      console.error('Could not load Page Accents', err);
      setError(err instanceof Error ? err.message : 'Could not load Page Accents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setDraft(draftFromNote(existing, selectedPageKey));
  }, [existing, selectedPageKey]);

  useEffect(() => {
    setNotice('');
    setError('');
  }, [selectedPageKey]);

  const patch = (next: Partial<JokoNoteDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const changeAccentType = (accentType: JokoAccentType) => {
    const definition = getJokoAccentPage(selectedPageKey, accentType);
    if (!definition) return;
    patch({
      accent_type: accentType,
      page_key: selectedPageKey,
      placement_key: definition.placements[0].placementKey,
    });
    setNotice('');
    setError('');
  };

  const upload = async (file: File | null, kind: 'note' | 'bubble') => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const ticket = await uploadGalleryImage({
        file,
        gallerySlot: kind === 'bubble' ? 'page-accents' : 'joko-notes',
      });
      if (kind === 'bubble') {
        patch({ bubble_image_url: ticket.publicUrl });
        setNotice('Bubble illustration uploaded. Save the Page Accent to keep this change.');
      } else {
        patch({ image_url: ticket.publicUrl });
        setNotice('Note image uploaded. Save the Page Accent to keep this change.');
      }
    } catch (err) {
      console.error('Page Accent upload failed', err);
      setError(err instanceof Error ? err.message : 'Could not upload the image.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (draft.accent_type === 'note' && !draft.title_en && !draft.body_en && !draft.image_url) {
      setError('Add at least English note text or an image before saving.');
      return;
    }
    if (draft.accent_type === 'bubble' && !draft.bubble_image_url) {
      setError('Upload the bubble illustration before saving.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const normalized: JokoNoteDraft = {
        ...draft,
        title_en: nullable(draft.title_en || ''),
        title_th: nullable(draft.title_th || ''),
        title_zh: nullable(draft.title_zh || ''),
        body_en: nullable(draft.body_en || ''),
        body_th: nullable(draft.body_th || ''),
        body_zh: nullable(draft.body_zh || ''),
        image_url: nullable(draft.image_url || ''),
        image_alt_en: nullable(draft.image_alt_en || ''),
        image_alt_th: nullable(draft.image_alt_th || ''),
        image_alt_zh: nullable(draft.image_alt_zh || ''),
        bubble_image_url: nullable(draft.bubble_image_url || ''),
        bubble_alt: nullable(draft.bubble_alt || ''),
        link_url: nullable(draft.link_url || ''),
      };

      const wasPublished = existing?.is_published ?? false;
      const placementLabel = accentPageDefinition.placements.find(
        (placement) => placement.placementKey === draft.placement_key,
      )?.label || 'selected safe zone';

      await adminSaveJokoNote(normalized, existing?.id);
      await load();

      const accentLabel = draft.accent_type === 'bubble' ? 'Bubble' : 'JOKO Note';
      if (draft.is_published) {
        setNotice(`${accentLabel} published successfully on ${pageLabel} → ${placementLabel}.`);
      } else if (wasPublished) {
        setNotice(`Saved successfully. The ${accentLabel} is now unpublished and hidden from ${pageLabel}.`);
      } else {
        setNotice(`${accentLabel} saved successfully as a draft for ${pageLabel} → ${placementLabel}.`);
      }
    } catch (err) {
      console.error('Could not save Page Accent', err);
      setError(err instanceof Error ? err.message : 'Could not save Page Accent.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (!window.confirm('Delete this Page Accent? The page slot will simply disappear.')) return;

    setSaving(true);
    setError('');
    try {
      await adminDeleteJokoNote(existing.id);
      await load();
      setNotice('Page Accent deleted.');
    } catch (err) {
      console.error('Could not delete Page Accent', err);
      setError(err instanceof Error ? err.message : 'Could not delete Page Accent.');
    } finally {
      setSaving(false);
    }
  };

  const previewRecord: JokoNote = {
    id: existing?.id || 'preview',
    created_at: existing?.created_at || '',
    updated_at: existing?.updated_at || '',
    ...draft,
  };
  const preview = localizeJokoNote(previewRecord, previewLanguage);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(32rem,1fr)_minmax(24rem,.8fr)]">
      <section className="joko-admin-paper-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="joko-admin-eyebrow">Website personality</p>
            <h2 className="joko-admin-title mt-1 text-2xl font-semibold">Page Accents</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#303532]/62">
              Ordinary pages use one accent: either a personal JOKO Note or an illustrated brand bubble. The long Homepage is the deliberate exception: its existing Hero note can coexist with one lower-page bubble. Safe zones remain responsive and design-controlled.
            </p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="joko-admin-secondary-button inline-flex items-center gap-2 px-3 py-2 text-xs">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <label className="block text-sm font-medium text-[#303532]">
            Page
            <select
              value={selectedPageKey}
              onChange={(event) => setSelectedPageKey(event.target.value)}
              className="joko-admin-field mt-1 w-full max-w-md"
            >
              {PAGE_OPTIONS.map((page) => (
                <option key={page.pageKey} value={page.pageKey}>{page.label}</option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-[#303532]">Accent type</legend>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => changeAccentType('note')}
                disabled={!noteSupported}
                className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${draft.accent_type === 'note'
                  ? 'border-[#55766F] bg-[#CFE3DF]/55 shadow-sm'
                  : 'border-[#55766F]/14 bg-white/45 hover:border-[#55766F]/30'}`}
                aria-pressed={draft.accent_type === 'note'}
              >
                <span className="block font-semibold text-[#303532]">JOKO Note</span>
                <span className="mt-1 block text-xs leading-5 text-[#303532]/55">
                  Joe & Phuttan’s contextual editorial voice. Localized EN / TH / ZH.
                  {!noteSupported ? ' The Homepage Hero note remains managed in Homepage Builder.' : ''}
                </span>
              </button>

              <button
                type="button"
                onClick={() => changeAccentType('bubble')}
                disabled={!bubbleSupported}
                className={`rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${draft.accent_type === 'bubble'
                  ? 'border-[#C76624] bg-[#FFF2E8]/80 shadow-sm'
                  : 'border-[#55766F]/14 bg-white/45 hover:border-[#C76624]/35'}`}
                aria-pressed={draft.accent_type === 'bubble'}
              >
                <span className="block font-semibold text-[#303532]">Speech bubble</span>
                <span className="mt-1 block text-xs leading-5 text-[#303532]/55">
                  Single-language illustrated brand reaction. The artwork is intentionally not translated.
                  {!bubbleSupported ? ' No bubble safe zone is registered for this page yet.' : ''}
                </span>
              </button>
            </div>
          </fieldset>

          <div>
            <p className="text-sm font-medium text-[#303532]">Safe zone</p>
            <div className="mt-2 grid gap-2">
              {accentPageDefinition.placements.map((placement, index) => {
                const selected = draft.placement_key === placement.placementKey;
                return (
                  <button
                    key={placement.placementKey}
                    type="button"
                    onClick={() => patch({
                      page_key: selectedPageKey,
                      placement_key: placement.placementKey,
                    })}
                    className={`rounded-xl border px-3 py-3 text-left transition ${selected
                      ? 'border-[#55766F] bg-[#CFE3DF]/55 shadow-sm'
                      : 'border-[#55766F]/14 bg-white/45 hover:border-[#55766F]/30 hover:bg-white/65'}`}
                    aria-pressed={selected}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${selected
                        ? 'bg-[#55766F] text-white'
                        : 'bg-[#CFE3DF]/65 text-[#3F665E]'}`}>
                        {index + 1}
                      </span>
                      <span className="font-semibold text-[#303532]">{placement.label}</span>
                    </span>
                    <span className="mt-1.5 block pl-8 text-xs leading-5 text-[#303532]/52">
                      {placement.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-5 text-[#303532]/48">
              Changing accent type changes the available safe zones. Ordinary pages keep one Page Accent row. On the Homepage, this lower-page accent is separate from the existing Builder-owned Hero note.
            </p>
          </div>

          {draft.accent_type === 'note' ? (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                {(['en', 'th', 'zh'] as const).map((language) => (
                  <div key={language} className="rounded-2xl border border-[#55766F]/12 bg-white/45 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[#55766F]">
                      {language === 'en' ? 'English' : language === 'th' ? 'ไทย' : '中文'}
                    </p>
                    <label className="mt-3 block text-xs font-medium text-[#303532]">
                      Heading
                      <input
                        value={draft[`title_${language}` as keyof JokoNoteDraft] as string || ''}
                        onChange={(event) => patch({ [`title_${language}`]: event.target.value || null } as Partial<JokoNoteDraft>)}
                        className="joko-admin-field mt-1 w-full"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-medium text-[#303532]">
                      Note
                      <textarea
                        rows={5}
                        value={draft[`body_${language}` as keyof JokoNoteDraft] as string || ''}
                        onChange={(event) => patch({ [`body_${language}`]: event.target.value || null } as Partial<JokoNoteDraft>)}
                        className="joko-admin-field mt-1 w-full"
                      />
                    </label>
                    <label className="mt-3 block text-xs font-medium text-[#303532]">
                      Image alt
                      <input
                        value={draft[`image_alt_${language}` as keyof JokoNoteDraft] as string || ''}
                        onChange={(event) => patch({ [`image_alt_${language}`]: event.target.value || null } as Partial<JokoNoteDraft>)}
                        className="joko-admin-field mt-1 w-full"
                      />
                    </label>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-dashed border-[#55766F]/25 bg-[#DCE9EC]/28 p-4">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-[#3F665E] hover:bg-white/35">
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                    {uploading ? 'Uploading…' : 'Upload note image'}
                    <input type="file" accept="image/jpeg,image/webp,image/png" className="sr-only" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0] || null, 'note')} />
                  </label>
                  <p className="mt-2 text-center text-xs text-[#303532]/52">JPG, WebP or PNG. EXIF/GPS metadata is stripped before upload.</p>
                </div>
                <label className="block text-sm font-medium text-[#303532]">
                  Note image URL
                  <input value={draft.image_url || ''} onChange={(event) => patch({ image_url: event.target.value || null })} className="joko-admin-field mt-1 w-full" placeholder="https://…" />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="text-xs font-medium text-[#303532]">
                  Font
                  <select value={draft.font_preset} onChange={(event) => patch({ font_preset: event.target.value as JokoNoteFontPreset })} className="joko-admin-field mt-1 w-full">
                    <option value="handwritten">Handwritten</option>
                    <option value="display">JOKO display</option>
                    <option value="body">JOKO body</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-[#303532]">
                  Image layout
                  <select value={draft.image_layout} onChange={(event) => patch({ image_layout: event.target.value as JokoNoteImageLayout })} className="joko-admin-field mt-1 w-full">
                    <option value="stacked">Stacked</option>
                    <option value="portrait">Portrait</option>
                    <option value="tiny-sketch">Tiny sketch</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-[#303532]">
                  Heading px
                  <input type="number" min={16} max={32} value={draft.heading_size} onChange={(event) => patch({ heading_size: Number(event.target.value) })} className="joko-admin-field mt-1 w-full" />
                </label>
                <label className="text-xs font-medium text-[#303532]">
                  Body px
                  <input type="number" min={11} max={20} value={draft.body_size} onChange={(event) => patch({ body_size: Number(event.target.value) })} className="joko-admin-field mt-1 w-full" />
                </label>
                <label className="text-xs font-medium text-[#303532]">
                  Rotation
                  <input type="number" min={-6} max={6} value={draft.rotation} onChange={(event) => patch({ rotation: Number(event.target.value) })} className="joko-admin-field mt-1 w-full" />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-2xl border border-[#C76624]/16 bg-[#FFF2E8]/45 p-4">
                <p className="text-sm font-semibold text-[#303532]">Bubble artwork</p>
                <p className="mt-1 text-xs leading-5 text-[#303532]/55">
                  Upload the finished English illustration itself — for example “Oh my Good-ness.” The words are part of the artwork and remain the same in EN, TH and ZH versions of the site.
                </p>
                <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#C76624]/30 bg-white/55 px-4 py-5 text-sm font-semibold text-[#A95120] hover:bg-white/80">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  {uploading ? 'Uploading…' : 'Upload bubble illustration'}
                  <input type="file" accept="image/jpeg,image/webp,image/png" className="sr-only" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0] || null, 'bubble')} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-[#303532]">
                  Bubble image URL
                  <input value={draft.bubble_image_url || ''} onChange={(event) => patch({ bubble_image_url: event.target.value || null })} className="joko-admin-field mt-1 w-full" placeholder="https://…" />
                </label>
                <label className="block text-sm font-medium text-[#303532]">
                  Accessibility label
                  <input value={draft.bubble_alt || ''} onChange={(event) => patch({ bubble_alt: event.target.value || null })} className="joko-admin-field mt-1 w-full" placeholder="Oh my Good-ness." />
                </label>
              </div>

              <label className="block max-w-xs text-sm font-medium text-[#303532]">
                Bubble size
                <select value={draft.bubble_size} onChange={(event) => patch({ bubble_size: event.target.value as JokoBubbleSize })} className="joko-admin-field mt-1 w-full">
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </label>
            </>
          )}

          <label className="block text-sm font-medium text-[#303532]">
            Link URL <span className="font-normal text-[#303532]/50">(optional)</span>
            <input value={draft.link_url || ''} onChange={(event) => patch({ link_url: event.target.value || null })} className="joko-admin-field mt-1 w-full max-w-md" placeholder="/products" />
          </label>

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#55766F]/15 bg-[#FFF9EE]/70 p-4">
            <span>
              <span className="block text-sm font-semibold text-[#303532]">Published</span>
              <span className="mt-1 block text-xs text-[#303532]/52">Draft accents never appear on the public site.</span>
            </span>
            <input type="checkbox" checked={draft.is_published} onChange={(event) => patch({ is_published: event.target.checked })} className="h-5 w-5 accent-[#C76624]" />
          </label>

          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {notice && !error && (
            <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Page Accent updated</p>
                <p className="mt-0.5 leading-5">{notice}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void save()} disabled={saving || uploading} className="joko-admin-primary-button inline-flex items-center gap-2 px-5 py-3 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {existing ? 'Save Page Accent' : 'Create Page Accent'}
            </button>
            {existing && (
              <button type="button" onClick={() => void remove()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="joko-admin-paper-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="joko-admin-eyebrow">Real component</p>
            <h2 className="joko-admin-title mt-1 text-xl font-semibold">Preview</h2>
          </div>
          {draft.accent_type === 'note' && (
            <div className="flex gap-1 rounded-xl bg-[#DCE9EC]/55 p-1">
              {(['en', 'th', 'zh'] as const).map((language) => (
                <button key={language} type="button" onClick={() => setPreviewLanguage(language)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${previewLanguage === language ? 'bg-white text-[#303532] shadow-sm' : 'text-[#55766F]'}`}>
                  {language.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {draft.accent_type === 'note' ? (
          <div className="mt-8 mx-auto max-w-sm">
            <JokoNoteCard
              title={preview.title}
              body={preview.body}
              imageUrl={draft.image_url || undefined}
              imageAlt={preview.imageAlt}
              href={draft.link_url || undefined}
              interactive={false}
              fontPreset={draft.font_preset}
              headingSize={draft.heading_size}
              bodySize={draft.body_size}
              rotation={draft.rotation}
              imageLayout={draft.image_layout}
            />
          </div>
        ) : (
          <div className="mt-10 flex min-h-48 items-center justify-center rounded-3xl border border-[#55766F]/10 bg-[#DCE9EC]/18 p-6">
            {draft.bubble_image_url ? (
              <img
                src={draft.bubble_image_url}
                alt={draft.bubble_alt || 'Oh my Good-ness.'}
                className={`h-auto w-full object-contain ${BUBBLE_PREVIEW_WIDTH[draft.bubble_size]}`}
              />
            ) : (
              <p className="max-w-xs text-center text-sm leading-6 text-[#303532]/50">
                Upload the finished bubble illustration to preview it here.
              </p>
            )}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-[#55766F]/12 bg-[#CFE3DF]/35 p-4 text-sm leading-6 text-[#303532]/70">
          <p className="font-semibold text-[#303532]">Either / or rule</p>
          <p className="mt-1">
            Ordinary pages can publish one JOKO Note or one speech bubble, never both. The Homepage is the intentional exception: its existing Hero notebook note can coexist with one lower-page bubble because the two moments are separated by several sections of scrolling.
          </p>
          <p className="mt-2 text-xs text-[#303532]/50">
            Bubble safe zones currently registered: {JOKO_BUBBLE_PAGES.map((page) => page.label).join(', ')}.
          </p>
        </div>
      </section>
    </div>
  );
}

export default JokoNotesManagement;
