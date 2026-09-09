import { useEffect, useState } from 'react';
import { BookOpen, RefreshCw, Save } from 'lucide-react';
import { getProducts, type CMSProduct } from '../lib/cmsService';
import {
  getNotebookContent,
  saveNotebookContentConfig,
  type NotebookContentConfigV1,
  type NotebookContentLocale,
  type NotebookContentText,
} from '../lib/notebookContent';

const LOCALES: Array<{ code: NotebookContentLocale; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'th', label: 'ไทย' },
  { code: 'zh', label: '中文' },
];

function LocalizedFields({
  label,
  value,
  multiline = false,
  onChange,
}: {
  label: string;
  value: NotebookContentText;
  multiline?: boolean;
  onChange: (next: NotebookContentText) => void;
}) {
  return (
    <fieldset className="rounded-xl border border-gray-200 p-4">
      <legend className="px-1 text-sm font-semibold text-gray-900">{label}</legend>
      <div className="grid gap-3 lg:grid-cols-3">
        {LOCALES.map(({ code, label: localeLabel }) => (
          <label key={code} className="block">
            <span className="text-xs font-medium text-gray-500">{localeLabel}</span>
            {multiline ? (
              <textarea
                value={value[code]}
                onChange={(event) => onChange({ ...value, [code]: event.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            ) : (
              <input
                value={value[code]}
                onChange={(event) => onChange({ ...value, [code]: event.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function NotebookContentManagement() {
  const [config, setConfig] = useState<NotebookContentConfigV1 | null>(null);
  const [products, setProducts] = useState<CMSProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [content, productList] = await Promise.all([getNotebookContent(), getProducts()]);
      setConfig(content.config);
      setProducts(productList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Notebook content.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await saveNotebookContentConfig(config);
      setNotice('Notebook content saved. The Homepage and Today notebook now read this shared content.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save Notebook content.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
    return <div className="py-16 text-center text-gray-500">Loading Notebook content…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
            <BookOpen className="h-5 w-5 text-primary-600" />
            Today / Homepage Notebook
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            One shared source controls the featured Notebook story on the public Homepage and the Today notebook page. Saving changes content only; it does not change products, inventory, pickup rules or orders.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save content'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div>
          <h3 className="font-semibold text-gray-900">1. Today</h3>
          <p className="mt-1 text-xs text-gray-500">The date and headline used by both the Homepage spread and the Today notebook.</p>
        </div>
        <label className="block max-w-xs">
          <span className="text-xs font-medium text-gray-600">Notebook date</span>
          <input type="date" value={config.date} onChange={(event) => setConfig({ ...config, date: event.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
        </label>
        <LocalizedFields label="Page eyebrow" value={config.today.eyebrow} onChange={(value) => setConfig({ ...config, today: { ...config.today, eyebrow: value } })} />
        <LocalizedFields label="Page title" value={config.today.title} onChange={(value) => setConfig({ ...config, today: { ...config.today, title: value } })} />
        <LocalizedFields label="Page subtitle / location" value={config.today.subtitle} onChange={(value) => setConfig({ ...config, today: { ...config.today, subtitle: value } })} />
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div>
          <h3 className="font-semibold text-gray-900">2. Notebook introduction</h3>
          <p className="mt-1 text-xs text-gray-500">Introductory copy shown beside the full Today notebook.</p>
        </div>
        <LocalizedFields label="Intro eyebrow" value={config.intro.eyebrow} onChange={(value) => setConfig({ ...config, intro: { ...config.intro, eyebrow: value } })} />
        <LocalizedFields label="Intro statement" value={config.intro.statement} multiline onChange={(value) => setConfig({ ...config, intro: { ...config.intro, statement: value } })} />
        <LocalizedFields label="Intro note" value={config.intro.note} multiline onChange={(value) => setConfig({ ...config, intro: { ...config.intro, note: value } })} />
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div>
          <h3 className="font-semibold text-gray-900">3. Person & featured bakery product</h3>
          <p className="mt-1 text-xs text-gray-500">Choose a real active CMS product. Its localized name, description and product image are used automatically unless an image override is supplied.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Person name</span>
            <input value={config.person.name} onChange={(event) => setConfig({ ...config, person: { ...config.person, name: event.target.value } })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Featured product</span>
            <select
              value={config.featuredProductSlug}
              onChange={(event) => setConfig({ ...config, featuredProductSlug: event.target.value, featuredProductImageUrl: '' })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {products.map((product) => <option key={product.id} value={product.slug}>{product.name_en}</option>)}
            </select>
          </label>
        </div>
        <LocalizedFields label="Person note" value={config.person.summary} multiline onChange={(value) => setConfig({ ...config, person: { ...config.person, summary: value } })} />
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Featured product image override (optional)</span>
          <input value={config.featuredProductImageUrl} onChange={(event) => setConfig({ ...config, featuredProductImageUrl: event.target.value })} placeholder="Leave blank to use the product CMS image" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div>
          <h3 className="font-semibold text-gray-900">4. Question</h3>
          <p className="mt-1 text-xs text-gray-500">The featured Question Intelligence prompt shared by Homepage and Notebook.</p>
        </div>
        <LocalizedFields label="Question title" value={config.question.title} onChange={(value) => setConfig({ ...config, question: { ...config.question, title: value } })} />
        <LocalizedFields label="Question summary" value={config.question.summary} multiline onChange={(value) => setConfig({ ...config, question: { ...config.question, summary: value } })} />
        <LocalizedFields label="Question" value={config.question.question} multiline onChange={(value) => setConfig({ ...config, question: { ...config.question, question: value } })} />
        <LocalizedFields label="Answer teaser" value={config.question.answerTeaser} multiline onChange={(value) => setConfig({ ...config, question: { ...config.question, answerTeaser: value } })} />
      </section>

      <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div>
          <h3 className="font-semibold text-gray-900">5. Scene</h3>
          <p className="mt-1 text-xs text-gray-500">Use a public image URL or a site-relative asset path. The same scene is rendered on the Homepage spread and in the full notebook.</p>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Scene image URL</span>
          <input value={config.scene.imageUrl} onChange={(event) => setConfig({ ...config, scene: { ...config.scene, imageUrl: event.target.value } })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <LocalizedFields label="Scene alternative text" value={config.scene.alt} multiline onChange={(value) => setConfig({ ...config, scene: { ...config.scene, alt: value } })} />
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>v1 scope:</strong> Today’s shared Notebook feature, person/product favourite, question and scene. The permanent Homepage structure, How it Works section and future Beyond discoveries remain source-controlled until they have real content contracts of their own.
      </div>
    </div>
  );
}
