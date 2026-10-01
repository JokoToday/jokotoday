import { useEffect, useMemo, useState } from 'react';
import { Image as ImageIcon, Loader2, Pencil, Plus, Save, Trash2, UploadCloud, Video, X } from 'lucide-react';
import {
  JOKO_SITE_KEY,
  adminDeleteGalleryItem,
  adminListGalleryItems,
  adminSaveGalleryItem,
  type GalleryItem,
  type GalleryItemDraft,
  type GalleryMediaType,
} from '../lib/aboutMediaService';
import { uploadGalleryImage } from '../lib/mediaService';

const emptyDraft = (): GalleryItemDraft => ({
  site_key: JOKO_SITE_KEY,
  media_type: 'image',
  media_url: '',
  thumbnail_url: null,
  category: 'around-joko',
  title_en: null,
  title_th: null,
  title_zh: null,
  caption_en: null,
  caption_th: null,
  caption_zh: null,
  alt_en: null,
  alt_th: null,
  alt_zh: null,
  sort_order: 0,
  show_on_homepage: false,
  is_published: false,
});

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

export function GalleryManagement() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [draft, setDraft] = useState<GalleryItemDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort(),
    [items],
  );

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await adminListGalleryItems());
    } catch (err) {
      console.error('Gallery Admin load failed', err);
      setError('Could not load Gallery items. Apply the latest Supabase migration first if this is a new deployment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setError('');
    setNotice('');
    setUploadProgress(0);
  };

  const startEdit = (item: GalleryItem) => {
    setEditingId(item.id);
    setDraft({
      site_key: item.site_key,
      media_type: item.media_type,
      media_url: item.media_url,
      thumbnail_url: item.thumbnail_url,
      category: item.category,
      title_en: item.title_en,
      title_th: item.title_th,
      title_zh: item.title_zh,
      caption_en: item.caption_en,
      caption_th: item.caption_th,
      caption_zh: item.caption_zh,
      alt_en: item.alt_en,
      alt_th: item.alt_th,
      alt_zh: item.alt_zh,
      sort_order: item.sort_order,
      show_on_homepage: item.show_on_homepage,
      is_published: item.is_published,
    });
    setNotice('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const upload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError('');
    try {
      const ticket = await uploadGalleryImage({ file, gallerySlot: draft.category || 'around-joko' }, setUploadProgress);
      setDraft((current) => ({
        ...current,
        media_type: 'image',
        media_url: ticket.publicUrl,
        thumbnail_url: current.thumbnail_url || ticket.publicUrl,
      }));
      setNotice('Image uploaded. Save the item to publish or keep it as a draft.');
    } catch (err) {
      console.error('Gallery upload failed', err);
      setError(err instanceof Error ? err.message : 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft.media_url.trim()) {
      setError('Add an image/video URL or upload an image first.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const normalized: GalleryItemDraft = {
        ...draft,
        media_url: draft.media_url.trim(),
        thumbnail_url: nullable(draft.thumbnail_url || ''),
        category: draft.category.trim() || 'around-joko',
        title_en: nullable(draft.title_en || ''),
        title_th: nullable(draft.title_th || ''),
        title_zh: nullable(draft.title_zh || ''),
        caption_en: nullable(draft.caption_en || ''),
        caption_th: nullable(draft.caption_th || ''),
        caption_zh: nullable(draft.caption_zh || ''),
        alt_en: nullable(draft.alt_en || ''),
        alt_th: nullable(draft.alt_th || ''),
        alt_zh: nullable(draft.alt_zh || ''),
        sort_order: Number.isFinite(Number(draft.sort_order)) ? Number(draft.sort_order) : 0,
      };
      await adminSaveGalleryItem(normalized, editingId || undefined);
      await load();
      reset();
      setNotice('Gallery item saved.');
    } catch (err) {
      console.error('Gallery save failed', err);
      setError(err instanceof Error ? err.message : 'Could not save Gallery item.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: GalleryItem) => {
    if (!window.confirm(`Delete "${item.title_en || item.caption_en || 'this gallery item'}"?`)) return;
    setError('');
    try {
      await adminDeleteGalleryItem(item.id);
      if (editingId === item.id) reset();
      await load();
    } catch (err) {
      console.error('Gallery delete failed', err);
      setError(err instanceof Error ? err.message : 'Could not delete Gallery item.');
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(22rem,.8fr)_minmax(34rem,1.2fr)]">
      <section className="joko-admin-paper-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="joko-admin-eyebrow">{editingId ? 'Edit item' : 'New item'}</p>
            <h2 className="joko-admin-title mt-1 text-2xl font-semibold">Gallery media</h2>
            <p className="mt-2 text-sm leading-6 text-[#303532]/62">
              Upload real JOKO photos or add a hosted video URL. Homepage selection is controlled independently from the full Gallery page.
            </p>
          </div>
          {editingId && (
            <button type="button" onClick={reset} className="joko-admin-secondary-button inline-flex items-center gap-2 px-3 py-2 text-xs">
              <X className="h-4 w-4" /> Cancel
            </button>
          )}
        </div>

        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-[#303532]">
              Media type
              <select
                value={draft.media_type}
                onChange={(event) => setDraft((current) => ({ ...current, media_type: event.target.value as GalleryMediaType }))}
                className="joko-admin-field mt-1 w-full"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </label>
            <label className="text-sm font-medium text-[#303532]">
              Category
              <input
                list="gallery-categories"
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                className="joko-admin-field mt-1 w-full"
                placeholder="around-joko"
              />
              <datalist id="gallery-categories">
                {categories.map((category) => <option key={category} value={category} />)}
                <option value="bakery" />
                <option value="baking" />
                <option value="pickup" />
                <option value="products" />
                <option value="people" />
                <option value="behind-the-scenes" />
              </datalist>
            </label>
          </div>

          {draft.media_type === 'image' && (
            <div className="rounded-2xl border border-dashed border-[#55766F]/25 bg-[#DCE9EC]/28 p-4">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-[#3F665E] transition hover:bg-white/35">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
                {uploading ? `Uploading… ${uploadProgress}%` : 'Upload gallery image'}
                <input
                  type="file"
                  accept="image/jpeg,image/webp,image/png"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(event) => void upload(event.target.files?.[0] || null)}
                />
              </label>
              <p className="mt-2 text-center text-xs text-[#303532]/52">
                JPG, WebP or PNG. The browser strips EXIF/GPS metadata before upload.
              </p>
            </div>
          )}

          <label className="block text-sm font-medium text-[#303532]">
            Media URL
            <input
              value={draft.media_url}
              onChange={(event) => setDraft((current) => ({ ...current, media_url: event.target.value }))}
              className="joko-admin-field mt-1 w-full"
              placeholder="https://…"
            />
          </label>
          <label className="block text-sm font-medium text-[#303532]">
            Thumbnail URL <span className="font-normal text-[#303532]/50">(optional)</span>
            <input
              value={draft.thumbnail_url || ''}
              onChange={(event) => setDraft((current) => ({ ...current, thumbnail_url: event.target.value || null }))}
              className="joko-admin-field mt-1 w-full"
              placeholder="https://…"
            />
          </label>

          <LocalizedGalleryFields label="Title" values={[draft.title_en, draft.title_th, draft.title_zh]} onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} fieldKeys={['title_en', 'title_th', 'title_zh']} />
          <LocalizedGalleryFields label="Caption" values={[draft.caption_en, draft.caption_th, draft.caption_zh]} onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} fieldKeys={['caption_en', 'caption_th', 'caption_zh']} textarea />
          <LocalizedGalleryFields label="Alt text" values={[draft.alt_en, draft.alt_th, draft.alt_zh]} onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))} fieldKeys={['alt_en', 'alt_th', 'alt_zh']} />

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-[#303532]">
              Sort order
              <input
                type="number"
                value={draft.sort_order}
                onChange={(event) => setDraft((current) => ({ ...current, sort_order: Number(event.target.value) }))}
                className="joko-admin-field mt-1 w-full"
              />
            </label>
            <label className="flex items-center gap-2 self-end rounded-xl border border-[#55766F]/12 bg-white/35 px-3 py-2.5 text-sm">
              <input type="checkbox" checked={draft.show_on_homepage} onChange={(event) => setDraft((current) => ({ ...current, show_on_homepage: event.target.checked }))} />
              Homepage
            </label>
            <label className="flex items-center gap-2 self-end rounded-xl border border-[#55766F]/12 bg-white/35 px-3 py-2.5 text-sm">
              <input type="checkbox" checked={draft.is_published} onChange={(event) => setDraft((current) => ({ ...current, is_published: event.target.checked }))} />
              Published
            </label>
          </div>

          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {notice && !error && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

          <button type="button" onClick={() => void save()} disabled={saving || uploading} className="joko-admin-primary-button inline-flex w-full items-center justify-center gap-2 px-4 py-3 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving…' : editingId ? 'Update Gallery item' : 'Add Gallery item'}
          </button>
        </div>
      </section>

      <section className="joko-admin-paper-card overflow-hidden">
        <div className="border-b border-[#55766F]/12 px-5 py-4 sm:px-6">
          <p className="joko-admin-eyebrow">Gallery page</p>
          <h2 className="joko-admin-title mt-1 text-2xl font-semibold">Published & draft media</h2>
        </div>
        {loading ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#55766F]" /></div>
        ) : items.length ? (
          <div className="divide-y divide-[#55766F]/10">
            {items.map((item) => (
              <article key={item.id} className="grid gap-4 p-4 sm:grid-cols-[9rem_1fr_auto] sm:items-center sm:p-5">
                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[#E8E1D5]">
                  {item.media_type === 'image' ? (
                    <img src={item.thumbnail_url || item.media_url} alt={item.alt_en || item.title_en || 'Gallery'} className="h-full w-full object-cover" />
                  ) : item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Video className="h-8 w-8 text-[#55766F]/50" /></div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#DCE9EC]/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3F665E]">{item.category}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${item.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.is_published ? 'Published' : 'Draft'}
                    </span>
                    {item.show_on_homepage && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-700">Homepage</span>}
                  </div>
                  <h3 className="mt-2 truncate font-semibold text-[#303532]">{item.title_en || item.caption_en || 'Untitled Gallery item'}</h3>
                  <p className="mt-1 truncate text-xs text-[#303532]/50">{item.media_url}</p>
                </div>
                <div className="flex gap-2 sm:flex-col">
                  <button type="button" onClick={() => startEdit(item)} className="joko-admin-secondary-button inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button type="button" onClick={() => void remove(item)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <ImageIcon className="h-9 w-9 text-[#55766F]/35" />
            <p className="mt-3 text-sm text-[#303532]/58">No Gallery media yet. Add the first real JOKO moment on the left.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function LocalizedGalleryFields({
  label,
  values,
  fieldKeys,
  onChange,
  textarea = false,
}: {
  label: string;
  values: Array<string | null>;
  fieldKeys: Array<keyof GalleryItemDraft>;
  onChange: (key: keyof GalleryItemDraft, value: string | null) => void;
  textarea?: boolean;
}) {
  const languages = ['English', 'ไทย', '中文'];
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-[#303532]">{label}</p>
      <div className="grid gap-2 lg:grid-cols-3">
        {values.map((value, index) => (
          <label key={languages[index]} className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#303532]/50">
            {languages[index]}
            {textarea ? (
              <textarea rows={3} value={value || ''} onChange={(event) => onChange(fieldKeys[index], nullable(event.target.value))} className="joko-admin-field mt-1 w-full normal-case tracking-normal" />
            ) : (
              <input value={value || ''} onChange={(event) => onChange(fieldKeys[index], nullable(event.target.value))} className="joko-admin-field mt-1 w-full normal-case tracking-normal" />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

export default GalleryManagement;
