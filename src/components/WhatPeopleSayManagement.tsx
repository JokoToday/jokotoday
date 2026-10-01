import { useEffect, useState } from 'react';
import {
  ExternalLink,
  Loader2,
  MessageSquareQuote,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
  UploadCloud,
  Video,
  X,
} from 'lucide-react';
import {
  JOKO_SITE_KEY,
  adminDeleteExternalMention,
  adminListExternalMentions,
  adminSaveExternalMention,
  type ExternalContentType,
  type ExternalMention,
  type ExternalMentionDraft,
  type ExternalSourceType,
} from '../lib/aboutMediaService';
import { uploadGalleryImage } from '../lib/mediaService';

const SOURCE_OPTIONS: Array<{ value: ExternalSourceType; label: string }> = [
  { value: 'google_maps', label: 'Google Maps' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'rednote', label: 'RedNote / Xiaohongshu' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'other', label: 'Other' },
];

const CONTENT_OPTIONS: Array<{ value: ExternalContentType; label: string }> = [
  { value: 'review', label: 'Review / comment' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
  { value: 'post', label: 'Post / article' },
];

const emptyDraft = (): ExternalMentionDraft => ({
  site_key: JOKO_SITE_KEY,
  source_type: 'google_maps',
  content_type: 'review',
  author_name: null,
  title: null,
  excerpt: null,
  source_language: null,
  rating: null,
  source_url: '',
  embed_url: null,
  thumbnail_url: null,
  posted_at: null,
  sort_order: 0,
  show_on_homepage: false,
  is_published: false,
});

function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function sourceLabel(source: ExternalSourceType) {
  return SOURCE_OPTIONS.find((option) => option.value === source)?.label || source;
}

export function WhatPeopleSayManagement() {
  const [items, setItems] = useState<ExternalMention[]>([]);
  const [draft, setDraft] = useState<ExternalMentionDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await adminListExternalMentions());
    } catch (err) {
      console.error('What People Say Admin load failed', err);
      setError('Could not load external mentions. Apply the latest Supabase migration first if this is a new deployment.');
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
  };

  const startEdit = (item: ExternalMention) => {
    setEditingId(item.id);
    setDraft({
      site_key: item.site_key,
      source_type: item.source_type,
      content_type: item.content_type,
      author_name: item.author_name,
      title: item.title,
      excerpt: item.excerpt,
      source_language: item.source_language,
      rating: item.rating,
      source_url: item.source_url,
      embed_url: item.embed_url,
      thumbnail_url: item.thumbnail_url,
      posted_at: item.posted_at,
      sort_order: item.sort_order,
      show_on_homepage: item.show_on_homepage,
      is_published: item.is_published,
    });
    setError('');
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadThumbnail = async (file: File | null) => {
    if (!file) return;
    setUploadingThumb(true);
    setError('');
    try {
      const ticket = await uploadGalleryImage({ file, gallerySlot: 'social-proof' });
      setDraft((current) => ({ ...current, thumbnail_url: ticket.publicUrl }));
      setNotice('Thumbnail uploaded. Save the mention to keep it.');
    } catch (err) {
      console.error('External mention thumbnail upload failed', err);
      setError(err instanceof Error ? err.message : 'Could not upload thumbnail.');
    } finally {
      setUploadingThumb(false);
    }
  };

  const save = async () => {
    if (!draft.source_url.trim()) {
      setError('Add the original public source URL.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const normalized: ExternalMentionDraft = {
        ...draft,
        author_name: nullable(draft.author_name || ''),
        title: nullable(draft.title || ''),
        excerpt: nullable(draft.excerpt || ''),
        source_language: nullable(draft.source_language || ''),
        source_url: draft.source_url.trim(),
        embed_url: nullable(draft.embed_url || ''),
        thumbnail_url: nullable(draft.thumbnail_url || ''),
        rating: draft.rating === null || draft.rating === undefined || Number.isNaN(Number(draft.rating))
          ? null
          : Math.max(0, Math.min(5, Number(draft.rating))),
        posted_at: draft.posted_at || null,
        sort_order: Number.isFinite(Number(draft.sort_order)) ? Number(draft.sort_order) : 0,
      };

      await adminSaveExternalMention(normalized, editingId || undefined);
      await load();
      reset();
      setNotice('External mention saved.');
    } catch (err) {
      console.error('External mention save failed', err);
      setError(err instanceof Error ? err.message : 'Could not save external mention.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: ExternalMention) => {
    if (!window.confirm(`Delete this ${sourceLabel(item.source_type)} item?`)) return;
    setError('');
    try {
      await adminDeleteExternalMention(item.id);
      if (editingId === item.id) reset();
      await load();
    } catch (err) {
      console.error('External mention delete failed', err);
      setError(err instanceof Error ? err.message : 'Could not delete external mention.');
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(22rem,.8fr)_minmax(34rem,1.2fr)]">
      <section className="joko-admin-paper-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="joko-admin-eyebrow">{editingId ? 'Edit item' : 'New item'}</p>
            <h2 className="joko-admin-title mt-1 text-2xl font-semibold">What People Say</h2>
            <p className="mt-2 text-sm leading-6 text-[#303532]/62">
              Curate real third-party reviews, videos, images and posts. Keep the original public URL for provenance; add an embed URL only when the platform supports it.
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
              Source
              <select
                value={draft.source_type}
                onChange={(event) => setDraft((current) => ({ ...current, source_type: event.target.value as ExternalSourceType }))}
                className="joko-admin-field mt-1 w-full"
              >
                {SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-[#303532]">
              Content type
              <select
                value={draft.content_type}
                onChange={(event) => setDraft((current) => ({ ...current, content_type: event.target.value as ExternalContentType }))}
                className="joko-admin-field mt-1 w-full"
              >
                {CONTENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-[#303532]">
              Author / creator
              <input value={draft.author_name || ''} onChange={(event) => setDraft((current) => ({ ...current, author_name: nullable(event.target.value) }))} className="joko-admin-field mt-1 w-full" placeholder="@creator or reviewer" />
            </label>
            <label className="text-sm font-medium text-[#303532]">
              Source language
              <input value={draft.source_language || ''} onChange={(event) => setDraft((current) => ({ ...current, source_language: nullable(event.target.value) }))} className="joko-admin-field mt-1 w-full" placeholder="en, th, zh…" />
            </label>
          </div>

          <label className="block text-sm font-medium text-[#303532]">
            Title <span className="font-normal text-[#303532]/50">(optional)</span>
            <input value={draft.title || ''} onChange={(event) => setDraft((current) => ({ ...current, title: nullable(event.target.value) }))} className="joko-admin-field mt-1 w-full" />
          </label>

          <label className="block text-sm font-medium text-[#303532]">
            Quote / excerpt <span className="font-normal text-[#303532]/50">(keep it short and faithful to the original)</span>
            <textarea rows={4} value={draft.excerpt || ''} onChange={(event) => setDraft((current) => ({ ...current, excerpt: nullable(event.target.value) }))} className="joko-admin-field mt-1 w-full" />
          </label>

          <label className="block text-sm font-medium text-[#303532]">
            Original public URL *
            <input value={draft.source_url} onChange={(event) => setDraft((current) => ({ ...current, source_url: event.target.value }))} className="joko-admin-field mt-1 w-full" placeholder="https://…" />
          </label>

          <label className="block text-sm font-medium text-[#303532]">
            Embed URL <span className="font-normal text-[#303532]/50">(optional)</span>
            <input value={draft.embed_url || ''} onChange={(event) => setDraft((current) => ({ ...current, embed_url: nullable(event.target.value) }))} className="joko-admin-field mt-1 w-full" placeholder="https://…" />
            <p className="mt-1 text-xs text-[#303532]/48">Use the platform's official embed URL where available. Otherwise leave blank and the site will link to the original post.</p>
          </label>

          <div className="rounded-2xl border border-dashed border-[#55766F]/25 bg-[#DCE9EC]/28 p-4">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-[#3F665E] transition hover:bg-white/35">
              {uploadingThumb ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
              {uploadingThumb ? 'Uploading thumbnail…' : 'Upload thumbnail / screenshot'}
              <input type="file" accept="image/jpeg,image/webp,image/png" className="sr-only" disabled={uploadingThumb} onChange={(event) => void uploadThumbnail(event.target.files?.[0] || null)} />
            </label>
            {draft.thumbnail_url && <p className="mt-2 truncate text-center text-xs text-[#303532]/50">{draft.thumbnail_url}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-[#303532]">
              Rating
              <input type="number" min="0" max="5" step="0.1" value={draft.rating ?? ''} onChange={(event) => setDraft((current) => ({ ...current, rating: event.target.value === '' ? null : Number(event.target.value) }))} className="joko-admin-field mt-1 w-full" placeholder="5" />
            </label>
            <label className="text-sm font-medium text-[#303532]">
              Posted date
              <input type="date" value={draft.posted_at ? draft.posted_at.slice(0, 10) : ''} onChange={(event) => setDraft((current) => ({ ...current, posted_at: event.target.value ? new Date(`${event.target.value}T00:00:00Z`).toISOString() : null }))} className="joko-admin-field mt-1 w-full" />
            </label>
            <label className="text-sm font-medium text-[#303532]">
              Sort order
              <input type="number" value={draft.sort_order} onChange={(event) => setDraft((current) => ({ ...current, sort_order: Number(event.target.value) }))} className="joko-admin-field mt-1 w-full" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-[#55766F]/12 bg-white/35 px-3 py-2.5 text-sm">
              <input type="checkbox" checked={draft.show_on_homepage} onChange={(event) => setDraft((current) => ({ ...current, show_on_homepage: event.target.checked }))} />
              Show on homepage
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-[#55766F]/12 bg-white/35 px-3 py-2.5 text-sm">
              <input type="checkbox" checked={draft.is_published} onChange={(event) => setDraft((current) => ({ ...current, is_published: event.target.checked }))} />
              Published
            </label>
          </div>

          {error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {notice && !error && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}

          <button type="button" onClick={() => void save()} disabled={saving || uploadingThumb} className="joko-admin-primary-button inline-flex w-full items-center justify-center gap-2 px-4 py-3 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving…' : editingId ? 'Update item' : 'Add item'}
          </button>
        </div>
      </section>

      <section className="joko-admin-paper-card overflow-hidden">
        <div className="border-b border-[#55766F]/12 px-5 py-4 sm:px-6">
          <p className="joko-admin-eyebrow">External proof</p>
          <h2 className="joko-admin-title mt-1 text-2xl font-semibold">Curated sources</h2>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#55766F]" /></div>
        ) : items.length ? (
          <div className="divide-y divide-[#55766F]/10">
            {items.map((item) => (
              <article key={item.id} className="grid gap-4 p-4 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:p-5">
                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-[#E8E1D5]">
                  {item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" className="h-full w-full object-cover" />
                  ) : item.content_type === 'review' ? (
                    <div className="flex h-full items-center justify-center"><MessageSquareQuote className="h-8 w-8 text-[#55766F]/50" /></div>
                  ) : (
                    <div className="flex h-full items-center justify-center"><Video className="h-8 w-8 text-[#55766F]/50" /></div>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#DCE9EC]/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#3F665E]">{sourceLabel(item.source_type)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${item.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{item.is_published ? 'Published' : 'Draft'}</span>
                    {item.show_on_homepage && <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-700">Homepage</span>}
                  </div>
                  <h3 className="mt-2 truncate font-semibold text-[#303532]">{item.title || item.author_name || 'Untitled external mention'}</h3>
                  {item.excerpt && <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#303532]/58">{item.excerpt}</p>}
                  {item.rating !== null && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#A44F1D]"><Star className="h-3.5 w-3.5 fill-current" /> {item.rating.toFixed(1)}</p>
                  )}
                </div>

                <div className="flex gap-2 sm:flex-col">
                  <a href={item.source_url} target="_blank" rel="noreferrer" className="joko-admin-secondary-button inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs"><ExternalLink className="h-3.5 w-3.5" /> Open</a>
                  <button type="button" onClick={() => startEdit(item)} className="joko-admin-secondary-button inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                  <button type="button" onClick={() => void remove(item)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
            <MessageSquareQuote className="h-9 w-9 text-[#55766F]/35" />
            <p className="mt-3 text-sm text-[#303532]/58">No external mentions yet. Add a Google Maps review, TikTok, RedNote post or other real public source.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default WhatPeopleSayManagement;
