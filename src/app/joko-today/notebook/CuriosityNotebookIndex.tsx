import { ArrowRight, BookOpen, HelpCircle } from 'lucide-react';
import type { CuriosityEpisode, CuriosityLocalizedText } from '../../../platform/curiosity';
import { curiosityTopicLabel } from './curiosityPresentation';

interface CuriosityNotebookIndexProps {
  episodes: readonly CuriosityEpisode[];
  locale: string;
  defaultLocale: string;
  onOpen: (slug: string) => void;
}

type LanguageCode = 'en' | 'th' | 'zh';

const copy = {
  en: {
    eyebrow: 'The Curiosity Notebook',
    title: 'Questions worth wondering about.',
    intro: 'Jokomi keeps the questions. Some belong to JOKO; others can travel far beyond the bakery.',
    shared: 'Shared curiosity',
    local: 'About JOKO',
    answered: 'Answered',
    wondering: 'Still wondering',
    open: 'Open curiosity',
    empty: 'No curiosities have been published yet.',
  },
  th: {
    eyebrow: 'สมุดบันทึกความสงสัย',
    title: 'คำถามที่น่าหยุดคิดและสงสัย',
    intro: 'Jokomi เก็บคำถามไว้ บางคำถามเป็นเรื่องของ JOKO และบางคำถามก็เดินทางไปไกลกว่าเบเกอรี่ได้',
    shared: 'ความสงสัยที่ใช้ร่วมกัน',
    local: 'เกี่ยวกับ JOKO',
    answered: 'มีคำตอบแล้ว',
    wondering: 'ยังสงสัยอยู่',
    open: 'เปิดความสงสัยนี้',
    empty: 'ยังไม่มีความสงสัยที่เผยแพร่',
  },
  zh: {
    eyebrow: '好奇笔记本',
    title: '值得继续琢磨的问题。',
    intro: 'Jokomi 把问题收好。有些属于 JOKO，有些则可以走出烘焙坊，去更远的地方。',
    shared: '共享好奇',
    local: '关于 JOKO',
    answered: '已有答案',
    wondering: '还在好奇',
    open: '打开这个问题',
    empty: '还没有已发布的好奇问题。',
  },
} as const;

function text(value: CuriosityLocalizedText, locale: string, fallback: string): string {
  return value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? '';
}

export function CuriosityNotebookIndex({
  episodes,
  locale,
  defaultLocale,
  onOpen,
}: CuriosityNotebookIndexProps) {
  const language: LanguageCode = locale === 'th' || locale === 'zh' ? locale : 'en';
  const labels = copy[language];
  const published = episodes.filter((episode) => episode.status === 'published');

  return (
    <div className="mx-auto max-w-[68rem] overflow-hidden rounded-[2.35rem] border border-[#55766F]/15 bg-[#FBF7ED] shadow-xl">
      <header className="border-b border-[#55766F]/12 px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex items-center gap-2 text-[#466861]">
          <BookOpen className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em]">{labels.eyebrow}</p>
        </div>
        <h1 className="mt-4 max-w-3xl font-header text-4xl font-semibold leading-tight text-[#303532] sm:text-5xl">
          {labels.title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#303532]/70 sm:text-base">{labels.intro}</p>
      </header>

      <div className="grid gap-px bg-[#55766F]/10 sm:grid-cols-2">
        {published.map((episode) => (
          <button
            key={episode.id}
            type="button"
            onClick={() => onOpen(episode.slug)}
            className="group bg-[#FBF7ED] p-6 text-left transition hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#55766F] sm:p-8"
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#466861]/75">
              <span>{episode.scope === 'shared' ? labels.shared : labels.local}</span>
              <span aria-hidden="true">·</span>
              <span>{episode.answerStatus === 'answered' ? labels.answered : labels.wondering}</span>
            </div>
            <div className="mt-5 flex items-start gap-4">
              <HelpCircle className="mt-1 h-6 w-6 shrink-0 text-[#C76624]" strokeWidth={1.35} aria-hidden="true" />
              <div>
                <h2 className="font-header text-2xl font-semibold leading-snug text-[#303532] sm:text-[1.7rem]">
                  {text(episode.question, language, defaultLocale)}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#303532]/68">
                  {text(episode.summary, language, defaultLocale)}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {episode.topics.slice(0, 3).map((topic) => (
                  <span key={topic} className="rounded-full border border-[#55766F]/15 px-2.5 py-1 text-[10px] uppercase tracking-[0.08em] text-[#466861]/75">
                    {curiosityTopicLabel(topic, language)}
                  </span>
                ))}
              </div>
              <span className="inline-flex items-center gap-1.5 border-b border-[#C76624]/45 pb-0.5 text-sm font-medium text-[#A44F1D] group-hover:border-[#C76624]">
                {labels.open}<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </button>
        ))}
      </div>

      {published.length === 0 && (
        <p className="px-6 py-12 text-center text-sm italic text-[#303532]/60">{labels.empty}</p>
      )}
    </div>
  );
}

export default CuriosityNotebookIndex;
