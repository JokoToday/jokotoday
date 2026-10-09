import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';
import { uploadGalleryImage } from '../lib/mediaService';
import {
  JOKO_NOTE_PLACEMENTS,
  JOKO_NOTES_SITE_KEY,
  adminDeleteJokoNote,
  adminListJokoNotes,
  adminSaveJokoNote,
  localizeJokoNote,
  type JokoNote,
  type JokoNoteDraft,
  type JokoNoteFontPreset,
  type JokoNoteImageLayout,
} from '../lib/jokoNotesService';
import { JokoNote as JokoNoteCard } from './JokoNote';

type LanguageCode = 'en' | 'th' | 'zh';

const EMPTY_DRAFT: JokoNoteDraft = {
  site_key: JOKO_NOTES_SITE_KEY,
  page_key: JOKO_NOTE_PLACEMENTS[0].pageKey,
  placement_key: JOKO_NOTE_PLACEMENTS[0].placementKey,
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

function draftFromNote(note: JokoNote | null, pageKey: string, placementKey: string): JokoNoteDraft {
  if (!note) return { ...EMPTY_DRAFT, page_key: pageKey, placement_key: placementKey };
  return {
    site_key: note.site_key,
    page_key: note.page_key,
    placement_key: note.placement_key,
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

export function JokoNotesManagement() {
  const [notes, setNotes] = useState<JokoNote[]>([]);
  const [selectedPlacement, setSelectedPlacement] = useState(0);
  const [previewLanguage, setPreviewLanguage] = useState<LanguageCode>('en');
  const [draft, setDraft] = useState<JokoNoteDraft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const placement = JOKO_NOTE_PLACEMENTS[selectedPlacement];
  const existing = useMemo(
    () => notes.find((note) => note.page_key === placement.pageKey && note.placement_key === placement.placementKey) || null,
    [notes, placement],
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setNotes(await adminListJokoNotes());
    } catch (err) {
      console.error('Could not load JOKO Notes', err);
      setError(err instanceof Error ? err.message : 'Could not load JOKO Notes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setDraft(draftFromNote(existing, placement.pageKey, placement.placementKey));
    setNotice('');
    setError('');
  }, [existing, placement]);

  const patch = (next: Partial<JokoNoteDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const upload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const ticket = await uploadGalleryImage({ file, gallerySlot: 'joko-notes' });
      patch({ image_url: ticket.publicUrl });
      setNotice('Image uploaded. Save the note to keep this change.');
    } catch (err) {
      console.error('JOKO Note upload failed', err);
      setError(err instanceof Error ? err.message : 'Could not upload the note image.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft.title_en && !draft.body_en && !draft.image_url) {
      setError('Add at least English text or an image before saving.');
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
        link_url: nullable(draft.link_url || ''),
      };
      await adminSaveJokoNote(normalized, existing?.id);
      await load();
      setNotice(draft.is_published ? 'JOKO Note saved and published.' : 'JOKO Note saved as a draft.');
    } catch (err) {
      console.error('Could not save JOKO Note', err);
      setError(err instanceof Error ? err.message : 'Could not save JOKO Note.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing) return;
    if (!window.confirm('Delete this JOKO Note? The page slot will simply disappear.')) return;

    setSaving(true);
    setError('');
    try {
      await adminDeleteJokoNote(existing.id);
      await load();
      setNotice('JOKO Note deleted.');
    } catch (err) {
      console.error('Could not delete JOKO Note', err);
      setError(err instanceof Error ? err.message : 'Could not delete JOKO Note.');
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
            <p className="joko-admin-eyebrow">Editorial voice</p>
            <h2 className="joko-admin-title mt-1 text-2xl font-semibold">JOKO Notes</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#303532]/62">
              One quiet, contextual note per registered page slot. Notes add Joe & Phuttan’s voice; they must never carry information that customers need in order to complete a purchase.
            </p>
          </div>
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="joko-admin-secondary-button inline-flex items-center gap-2 px-3 py-2 text-xs">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="mt-6 space-y-5">
          <label className="block text-sm font-medium text-[#303532]">
            Page placement
            <select
              value={selectedPlacement}
              onChange={(event) => setSelectedPlacement(Number(event.target.value))}
              className="joko-admin-field mt-1 w-full"
            >
              {JOKO_NOTE_PLACEMENTS.map((item, index) => (
                <option key={`${item.pageKey}:${item.placementKey}`} value={index}>{item.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-[#303532]/50">{placement.description}</span>
          </label>

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
                <input type="file" accept="image/jpeg,image/webp,image/png" className="sr-only" disabled={uploading} onChange={(event) => void upload(event.target.files?.[0] || null)} />
              </label>
              <p className="mt-2 text-center text-xs text-[#303532]/52">JPG, WebP or PNG. EXIF/GPS metadata is stripped before upload.</p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[#303532]">
                Image URL
                <input value={draft.image_url || ''} onChange={(event) => patch({ image_url: event.target.value || null })} className="joko-admin-field mt-1 w-full" placeholder="https://…" />
              </label>
              <label className="block text-sm font-medium text-[#303532]">
                Link URL <span className="font-normal text-[#303532]/50">(optional)</span>
                <input value={draft.link_url || ''} onChange={(event) => patch({ link_url: event.target.value || null })} className="joko-admin-field mt-1 w-full" placeholder="/products" />
              </label>
            </div>
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

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#55766F]/15 bg-[#FFF9EE]/70 p-4">
            <span>
              <span className="block text-sm font-semibold text-[#303532]">Published</span>
              <span className="mt-1 block text-xs text-[#303532]/52">Draft notes never appear on the public site.</span>
            </span>
            <input type="checkbox" checked={draft.is_published} onChange={(event) => patch({ is_published: event.target.checked })} className="h-5 w-5 accent-[#C76624]" />
          </label>

          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {notice && !error && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void save()} disabled={saving || uploading} className="joko-admin-primary-button inline-flex items-center gap-2 px-5 py-3 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {existing ? 'Save JOKO Note' : 'Create JOKO Note'}
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
          <div className="flex gap-1 rounded-xl bg-[#DCE9EC]/55 p-1">
            {(['en', 'th', 'zh'] as const).map((language) => (
              <button key={language} type="button" onClick={() => setPreviewLanguage(language)} className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${previewLanguage === language ? 'bg-white text-[#303532] shadow-sm' : 'text-[#55766F]'}`}>
                {language.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

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

        <div className="mt-8 rounded-2xl border border-[#55766F]/12 bg-[#CFE3DF]/35 p-4 text-sm leading-6 text-[#303532]/70">
          <p className="font-semibold text-[#303532]">JOKO Notes rule</p>
          <p className="mt-1">A note may add warmth, context, recommendation or personality. Prices, stock, cutoffs, payment instructions and other essential information must remain in normal UI.</p>
        </div>
      </section>
    </div>
  );
}

export default JokoNotesManagement;
