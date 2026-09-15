import { ArrowRight, BookOpen, HelpCircle, Sparkles } from 'lucide-react';
import type { CuriosityEpisode, CuriosityLocalizedText } from '../../../platform/curiosity';
import { curiosityTopicLabel } from './curiosityPresentation';
import CuriosityWonderButton from './CuriosityWonderButton';

interface CuriosityNotebookPageProps {
  episode: CuriosityEpisode;
  episodes: readonly CuriosityEpisode[];
  locale: string;
  defaultLocale: string;
  onOpen: (slug: string) => void;
  onWonderCountChange?: (curiosityId: string, count: number) => void;
}

type LanguageCode = 'en' | 'th' | 'zh';

const copy = {
  en: {
    notebook: 'The Curiosity Notebook',
    shared: 'Shared curiosity',
    local: 'About JOKO',
    inShort: 'In short',
    howItWorks: 'How it works',
    guide: 'Let’s ask',
    related: 'Related questions',
    next: 'This made Jokomi wonder…',
    sources: 'Sources',
    open: 'Open question',
    wondering: 'Still wondering…',
  },
  th: {
    notebook: 'สมุดบันทึกความสงสัย',
    shared: 'ความสงสัยที่ใช้ร่วมกัน',
    local: 'เกี่ยวกับ JOKO',
    inShort: 'สรุปสั้น ๆ',
    howItWorks: 'ทำงานอย่างไร',
    guide: 'ลองถาม',
    related: 'คำถามที่เกี่ยวข้อง',
    next: 'เรื่องนี้ทำให้ Jokomi สงสัยต่อว่า…',
    sources: 'แหล่งข้อมูล',
    open: 'เปิดคำถาม',
    wondering: 'ยังสงสัยอยู่…',
  },
  zh: {
    notebook: '好奇笔记本',
    shared: '共享好奇',
    local: '关于 JOKO',
    inShort: '简短回答',
    howItWorks: '怎样进行',
    guide: '我们来问问',
    related: '相关问题',
    next: '这又让 Jokomi 想知道…',
    sources: '资料来源',
    open: '打开问题',
    wondering: '还在好奇…',
  },
} as const;

function text(value: CuriosityLocalizedText | undefined, locale: string, fallback: string): string {
  if (!value) return '';
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? '';
}

export function CuriosityNotebookPage({
  episode,
  episodes,
  locale,
  defaultLocale,
  onOpen,
  onWonderCountChange,
}: CuriosityNotebookPageProps) {
  const language: LanguageCode = locale === 'th' || locale === 'zh' ? locale : 'en';
  const labels = copy[language];
  const answer = text(episode.fullAnswer ?? episode.shortAnswer, language, defaultLocale);
  const related = (episode.related ?? [])
    .map((relation) => episodes.find((candidate) => candidate.id === relation.curiosityId))
    .filter((candidate): candidate is CuriosityEpisode => Boolean(candidate && candidate.status === 'published'));
  const fallbackNext = episodes.find((candidate) => candidate.status === 'published' && candidate.id !== episode.id);
  const next = related[0] ?? fallbackNext;

  return (
    <article className="mx-auto max-w-[68rem] overflow-hidden rounded-[2.35rem] border border-[#55766F]/15 bg-[#FBF7ED] shadow-xl">
      <header className="relative overflow-hidden border-b border-[#55766F]/12 px-6 py-8 sm:px-10 sm:py-11">
        <div className="absolute -right-16 -top-24 h-52 w-52 rounded-full border border-[#55766F]/10" aria-hidden="true" />
        <div className="relative">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#466861]/80">
            <BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            <span>{labels.notebook}</span>
            <span aria-hidden="true">·</span>
            <span>{episode.scope === 'shared' ? labels.shared : labels.local}</span>
          </div>
          <div className="mt-5 flex items-start gap-4">
            <HelpCircle className="mt-2 h-7 w-7 shrink-0 text-[#C76624]" strokeWidth={1.25} aria-hidden="true" />
            <div>
              <h1 className="max-w-4xl font-header text-4xl font-semibold leading-tight text-[#303532] sm:text-5xl lg:text-6xl">
                {text(episode.question, language, defaultLocale)}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-[#303532]/70 sm:text-lg">
                {text(episode.summary, language, defaultLocale)}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="px-6 py-8 sm:px-10 sm:py-10">
          {episode.guide && (
            <p className="mb-5 text-sm italic text-[#466861]">
              {labels.guide} {text(episode.guide.name, language, defaultLocale)}
            </p>
          )}

          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C76624]">
              {episode.steps?.length ? labels.howItWorks : labels.inShort}
            </p>
            {answer ? (
              <p className="mt-3 max-w-3xl font-header text-2xl leading-9 text-[#303532] sm:text-3xl sm:leading-10">
                {answer}
              </p>
            ) : (
              <p className="mt-4 font-header text-2xl italic text-[#303532]/55">{labels.wondering}</p>
            )}
          </section>

          {episode.steps?.length ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {episode.steps.map((step, index) => (
                <div key={step.id} className="rounded-2xl border border-[#55766F]/12 bg-white/45 p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#304B45] text-sm font-semibold text-[#F4EFE5]">
                      {index + 1}
                    </span>
                    <h2 className="font-header text-xl font-semibold text-[#303532]">
                      {text(step.title, language, defaultLocale)}
                    </h2>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#303532]/68">
                    {text(step.body, language, defaultLocale)}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          <CuriosityWonderButton
            curiosityId={episode.id}
            locale={language}
            onCountChange={onWonderCountChange
              ? (count) => onWonderCountChange(episode.id, count)
              : undefined}
          />

          {episode.sources?.length ? (
            <section className="mt-10 border-t border-[#55766F]/12 pt-7">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#466861]">{labels.sources}</h2>
              <div className="mt-4 space-y-3">
                {episode.sources.map((source) => (
                  <p key={source.id} className="text-sm leading-6 text-[#303532]/68">
                    {text(source.title, language, defaultLocale)}{source.publisher ? ` — ${source.publisher}` : ''}
                  </p>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="border-t border-[#55766F]/12 bg-[#DCE9EC]/35 px-6 py-8 lg:border-l lg:border-t-0">
          <Sparkles className="h-5 w-5 text-[#C76624]" strokeWidth={1.4} aria-hidden="true" />
          <div className="mt-5 flex flex-wrap gap-2">
            {episode.topics.map((topic) => (
              <span key={topic} className="rounded-full border border-[#55766F]/18 bg-white/45 px-3 py-1 text-[10px] uppercase tracking-[0.1em] text-[#466861]">
                {curiosityTopicLabel(topic, language)}
              </span>
            ))}
          </div>

          {related.length > 0 && (
            <section className="mt-8">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#466861]">{labels.related}</h2>
              <div className="mt-4 space-y-4">
                {related.map((item) => (
                  <button key={item.id} type="button" onClick={() => onOpen(item.slug)} className="group block w-full text-left focus:outline-none focus:ring-2 focus:ring-[#55766F]">
                    <span className="block font-header text-lg font-semibold leading-6 text-[#303532] group-hover:text-[#A44F1D]">
                      {text(item.question, language, defaultLocale)}
                    </span>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#A44F1D]">
                      {labels.open}<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>

      {next && (
        <footer className="border-t border-[#55766F]/12 bg-white/25 px-6 py-7 sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#466861]/75">{labels.next}</p>
          <button type="button" onClick={() => onOpen(next.slug)} className="group mt-3 flex w-full items-center justify-between gap-5 text-left focus:outline-none focus:ring-2 focus:ring-[#55766F]">
            <span className="font-header text-2xl font-semibold leading-snug text-[#303532] group-hover:text-[#A44F1D]">
              {text(next.question, language, defaultLocale)}
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-[#C76624]" aria-hidden="true" />
          </button>
        </footer>
      )}
    </article>
  );
}

export default CuriosityNotebookPage;
