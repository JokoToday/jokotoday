import { useMemo, useState } from 'react';
import { CuriosityEmbed } from '../platform/curiosity/embed/CuriosityEmbed';
import { jokoTodayCuriosityFixture } from '../platform/curiosity/fixtures/jokoTodayCuriosityFixture';
import { buildCuriosityNotebookProof } from '../platform/curiosity/proof/buildCuriosityNotebookProof';
import { NotebookReader } from '../platform/notebook';

const locales = ['en', 'th', 'zh'] as const;

export default function CuriosityProofPage() {
  const episodes = jokoTodayCuriosityFixture.episodes;
  const [episodeId, setEpisodeId] = useState('curiosity-joko-ordering');
  const [locale, setLocale] = useState<(typeof locales)[number]>('en');

  const episode = episodes.find((item) => item.id === episodeId) ?? episodes[0];
  const notebookProof = useMemo(() => buildCuriosityNotebookProof(episode), [episode]);

  return (
    <main className="min-h-screen bg-stone-100 px-5 py-10 text-stone-900 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl space-y-10">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">JOKO TODAY · Phase 1B</p>
          <h1 className="max-w-4xl font-serif text-4xl leading-tight sm:text-5xl">Curiosity Engine proof surface</h1>
          <p className="max-w-3xl text-base leading-7 text-stone-600">
            One canonical Curiosity Episode rendered through two independent presentation paths: the existing Notebook reader and a reusable Curiosity embed.
          </p>
        </header>

        <section className="grid gap-4 rounded-3xl border border-stone-200 bg-white p-5 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Episode</span>
            <select
              value={episode.id}
              onChange={(event) => setEpisodeId(event.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm"
            >
              {episodes.map((item) => (
                <option key={item.id} value={item.id}>{item.question.en}</option>
              ))}
            </select>
          </label>

          <div className="flex gap-2" aria-label="Preview language">
            {locales.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                  locale === code ? 'bg-stone-900 text-white' : 'border border-stone-300 bg-white text-stone-600'
                }`}
              >
                {code}
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {['Canonical Episode', 'Notebook Adapter', 'Notebook Reader', 'Curiosity Embed'].map((label, index) => (
            <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">0{index + 1}</div>
              <div className="mt-2 font-medium">{label}</div>
            </div>
          ))}
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Presentation A</p>
            <h2 className="mt-1 font-serif text-3xl">Existing Notebook reader</h2>
          </div>
          <NotebookReader
            document={notebookProof.document}
            entries={notebookProof.entries}
            locale={locale}
            defaultLocale="en"
            hideDocumentMeta
          />
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Presentation B</p>
            <h2 className="mt-1 font-serif text-3xl">Reusable Curiosity embed</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <CuriosityEmbed episode={episode} locale={locale} variant="full" />
            <CuriosityEmbed episode={episode} locale={locale} variant="homepage-explainer" />
          </div>
        </section>

        <section className="rounded-3xl border border-dashed border-stone-300 bg-white/60 p-6 text-sm leading-6 text-stone-600">
          <strong className="text-stone-900">Proof boundary:</strong> this page reads static fixture data only. It does not write to Supabase, alter JOKO routes, replace current Notebook content, or affect the production homepage.
        </section>
      </div>
    </main>
  );
}
