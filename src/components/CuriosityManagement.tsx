import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus, RefreshCw, Save, Send, Sparkles } from 'lucide-react';
import type {
  CuriosityAnswerStatus,
  CuriosityEpisode,
  CuriosityOrigin,
  CuriosityScope,
  CuriosityStatus,
} from '../platform/curiosity';
import {
  CuriosityPersistenceConflictError,
  initializeCuriosity,
  listAdminCuriosities,
  publishCuriosity,
  saveCuriosityDraft,
  type CuriosityAdminState,
} from '../lib/curiosityPersistenceService';

type Locale = 'en' | 'th' | 'zh';

const locales: Array<{ code: Locale; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'th', label: 'ไทย' },
  { code: 'zh', label: '中文' },
];

const statusOptions: CuriosityStatus[] = ['draft', 'researching', 'review', 'published', 'archived'];
const answerStatusOptions: CuriosityAnswerStatus[] = ['unanswered', 'partial', 'answered', 'still-wondering'];
const originOptions: CuriosityOrigin['type'][] = ['editorial', 'community', 'product', 'place', 'person', 'jokomi', 'system'];

function cloneEpisode(episode: CuriosityEpisode): CuriosityEpisode {
  return JSON.parse(JSON.stringify(episode)) as CuriosityEpisode;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function blankEpisode(): CuriosityEpisode {
  return {
    schemaVersion: 1,
    id: `curiosity-${window.crypto.randomUUID()}`,
    slug: '',
    status: 'draft',
    scope: 'shared',
    question: { en: '', th: '', zh: '' },
    summary: { en: '', th: '', zh: '' },
    answerStatus: 'unanswered',
    origin: { type: 'editorial' },
    topics: ['everyday-science'],
  };
}

function displayQuestion(episode: CuriosityEpisode): string {
  return episode.question.en || episode.question.th || episode.question.zh || 'Untitled curiosity';
}

function formatDate(value: string | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function CuriosityManagement() {
  const [items, setItems] = useState<CuriosityAdminState[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CuriosityEpisode | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const selected = useMemo(
    () => items.find((item) => item.curiosityId === selectedId) ?? null,
    [items, selectedId],
  );

  const load = async (preferredId?: string) => {
    setLoading(true);
    setError('');
    try {
      const next = await listAdminCuriosities();
      setItems(next);
      const nextId = preferredId && next.some((item) => item.curiosityId === preferredId)
        ? preferredId
        : selectedId && next.some((item) => item.curiosityId === selectedId)
          ? selectedId
          : next[0]?.curiosityId ?? null;
      setSelectedId(nextId);
      const state = next.find((item) => item.curiosityId === nextId);
      setDraft(state ? cloneEpisode(state.draft.document) : null);
      setIsNew(false);
      setDirty(false);
      setNotice(next.length ? 'Curiosity drafts loaded.' : 'No persistent Curiosities exist yet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Curiosity Admin.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const select = (item: CuriosityAdminState) => {
    if (dirty && !window.confirm('Discard your unsaved Curiosity changes?')) return;
    setSelectedId(item.curiosityId);
    setDraft(cloneEpisode(item.draft.document));
    setIsNew(false);
    setDirty(false);
    setError('');
    setNotice('');
  };

  const startNew = () => {
    if (dirty && !window.confirm('Discard your unsaved Curiosity changes?')) return;
    setSelectedId(null);
    setDraft(blankEpisode());
    setIsNew(true);
    setDirty(true);
    setError('');
    setNotice('New Curiosity draft. Nothing has been saved yet.');
  };

  const updateDraft = (patch: Partial<CuriosityEpisode>) => {
    setDraft((current) => current ? { ...current, ...patch } : current);
    setDirty(true);
  };

  const updateLocalized = (field: 'question' | 'summary' | 'shortAnswer' | 'fullAnswer', locale: Locale, value: string) => {
    setDraft((current) => {
      if (!current) return current;
      const existing = current[field] ?? { en: '', th: '', zh: '' };
      return { ...current, [field]: { ...existing, [locale]: value } };
    });
    setDirty(true);
  };

  const validate = (): string[] => {
    if (!draft) return ['No Curiosity is selected.'];
    const issues: string[] = [];
    if (!draft.slug.trim()) issues.push('Slug is required.');
    if (!/^[a-z0-9][a-z0-9-]*$/.test(draft.slug)) issues.push('Slug must use lowercase letters, numbers and hyphens only.');
    for (const locale of locales) {
      if (!draft.question[locale.code]?.trim()) issues.push(`${locale.label} question is required.`);
      if (!draft.summary[locale.code]?.trim()) issues.push(`${locale.label} summary is required.`);
    }
    if (!draft.topics.length) issues.push('At least one topic is required.');
    if (draft.answerStatus === 'answered' && !draft.shortAnswer && !draft.fullAnswer && !draft.steps?.length) {
      issues.push('Answered Curiosities need answer content.');
    }
    return issues;
  };

  const persist = async (): Promise<CuriosityAdminState | null> => {
    if (!draft || busy) return null;
    const issues = validate();
    if (issues.length) {
      setError(issues.join(' '));
      return null;
    }

    setBusy('saving');
    setError('');
    setNotice('');
    try {
      const normalized: CuriosityEpisode = {
        ...draft,
        slug: draft.slug.trim(),
        siteId: draft.scope === 'local' ? 'joko-today' : undefined,
        updatedAt: new Date().toISOString(),
      };
      const state = isNew
        ? await initializeCuriosity(normalized)
        : selected
          ? await saveCuriosityDraft(normalized, selected.lockVersion)
          : null;
      if (!state) throw new Error('Curiosity could not be saved.');
      setDraft(cloneEpisode(state.draft.document));
      setSelectedId(state.curiosityId);
      setIsNew(false);
      setDirty(false);
      await load(state.curiosityId);
      setNotice(`Draft saved at ${formatDate(state.draft.updatedAt)}. Nothing was published.`);
      return state;
    } catch (err) {
      if (err instanceof CuriosityPersistenceConflictError) {
        setError(err.message);
        setNotice('Reload the Curiosities before continuing.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not save Curiosity.');
      }
      return null;
    } finally {
      setBusy(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await persist();
  };

  const handlePublish = async () => {
    if (!draft || busy) return;
    let state = selected;
    if (dirty || isNew) state = await persist();
    if (!state) return;
    if (!window.confirm(`Publish “${displayQuestion(state.draft.document)}” as a new immutable revision?`)) return;

    setBusy('publishing');
    setError('');
    try {
      const publishedDocument: CuriosityEpisode = {
        ...state.draft.document,
        status: 'published',
        publishedAt: new Date().toISOString(),
      };
      let publishState = state;
      if (state.draft.document.status !== 'published' || !state.draft.document.publishedAt) {
        publishState = await saveCuriosityDraft(publishedDocument, state.lockVersion);
      }
      const result = await publishCuriosity(publishState.curiosityId, publishState.lockVersion);
      await load(result.curiosityId);
      setNotice(`Published revision ${result.published?.revisionNumber ?? ''}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not publish Curiosity.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-gray-900">Curiosities</h2>
            <p className="text-xs text-gray-500">{items.length} persistent records</p>
          </div>
          <button type="button" onClick={startNew} className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700">
            <Plus className="h-4 w-4" /> New
          </button>
        </div>

        <button type="button" onClick={() => void load()} disabled={loading || Boolean(busy)} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-700 disabled:text-gray-400">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Reload
        </button>

        <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <button key={item.curiosityId} type="button" onClick={() => select(item)} className={`w-full rounded-lg border p-3 text-left transition ${selectedId === item.curiosityId ? 'border-primary-300 bg-primary-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
              <p className="line-clamp-2 text-sm font-semibold text-gray-900">{displayQuestion(item.draft.document)}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                <span>{item.draft.document.status}</span>
                <span>· {item.wonderCount} wondered</span>
                {item.published && <span>· rev {item.published.revisionNumber}</span>}
              </div>
            </button>
          ))}
          {!loading && items.length === 0 && !error && <p className="py-6 text-center text-sm text-gray-500">No Curiosities yet.</p>}
        </div>
      </aside>

      <main className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary-700"><Sparkles className="h-4 w-4" /> Curiosity Editor</div>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">{draft ? displayQuestion(draft) : 'Choose a Curiosity'}</h2>
            {selected && <p className="mt-1 text-xs text-gray-500">Draft updated {formatDate(selected.draft.updatedAt)} · {selected.wonderCount} real wonder signals</p>}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void persist()} disabled={!draft || Boolean(busy) || !dirty} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-40">
              {busy === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft
            </button>
            <button type="button" onClick={() => void handlePublish()} disabled={!draft || Boolean(busy)} className="inline-flex items-center gap-2 rounded-lg bg-primary-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">
              {busy === 'publishing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish
            </button>
          </div>
        </div>

        {error && <div className="mb-5 flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
        {notice && <div className="mb-5 rounded-lg border border-primary-100 bg-primary-50 p-3 text-sm text-primary-800">{notice}</div>}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary-600" /></div>
        ) : draft ? (
          <form onSubmit={handleSubmit} className="space-y-7">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-sm font-medium text-gray-700">Status
                <select value={draft.status} onChange={(event) => updateDraft({ status: event.target.value as CuriosityStatus })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                  {statusOptions.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Answer state
                <select value={draft.answerStatus} onChange={(event) => updateDraft({ answerStatus: event.target.value as CuriosityAnswerStatus })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                  {answerStatusOptions.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Scope
                <select value={draft.scope} onChange={(event) => updateDraft({ scope: event.target.value as CuriosityScope })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                  <option value="shared">shared</option><option value="local">local / At JOKO</option>
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Origin
                <select value={draft.origin.type} onChange={(event) => updateDraft({ origin: { ...draft.origin, type: event.target.value as CuriosityOrigin['type'] } })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                  {originOptions.map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">Slug
                <input value={draft.slug} onChange={(event) => updateDraft({ slug: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
              <label className="text-sm font-medium text-gray-700">Topics (comma separated)
                <input value={draft.topics.join(', ')} onChange={(event) => updateDraft({ topics: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </label>
            </section>

            {locales.map(({ code, label }) => (
              <section key={code} className="rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900">{label}</h3>
                <div className="mt-4 space-y-4">
                  <label className="block text-sm font-medium text-gray-700">Question
                    <input value={draft.question[code] ?? ''} onChange={(event) => {
                      const value = event.target.value;
                      updateLocalized('question', code, value);
                      if (code === 'en' && isNew && !draft.slug) updateDraft({ slug: slugify(value) });
                    }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">Summary
                    <textarea rows={2} value={draft.summary[code] ?? ''} onChange={(event) => updateLocalized('summary', code, event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">Short answer
                    <textarea rows={4} value={draft.shortAnswer?.[code] ?? ''} onChange={(event) => updateLocalized('shortAnswer', code, event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">Full answer (optional)
                    <textarea rows={6} value={draft.fullAnswer?.[code] ?? ''} onChange={(event) => updateLocalized('fullAnswer', code, event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </label>
                </div>
              </section>
            ))}

            <div className="rounded-lg bg-gray-50 p-4 text-xs leading-5 text-gray-600">
              Sources, related Curiosities, Answer Guide, media and structured answer steps are preserved when editing an existing record. Dedicated editors for those fields are intentionally deferred to the next Admin refinement instead of exposing raw JSON here.
            </div>
          </form>
        ) : (
          <div className="flex min-h-64 items-center justify-center text-gray-500">Choose a Curiosity or create a new one.</div>
        )}
      </main>
    </div>
  );
}

export default CuriosityManagement;
