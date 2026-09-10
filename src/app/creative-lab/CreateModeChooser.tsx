import { ArrowRight, Image, User, X } from 'lucide-react';

interface Props {
  onClose: () => void;
  onSelect: (mode: 'scene' | 'character') => void;
}

export function CreateModeChooser({ onClose, onSelect }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4" role="dialog" aria-modal="true" aria-label="Choose Creative Lab creation mode">
      <div className="w-full max-w-3xl rounded-3xl border border-stone-200 bg-stone-50 shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Create something</p>
            <h2 className="mt-1 font-serif text-2xl text-stone-950">Where should we start?</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-stone-500 hover:bg-stone-100" aria-label="Close create menu"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-4 p-5 sm:p-7 md:grid-cols-2">
          <button type="button" onClick={() => onSelect('scene')} className="group rounded-3xl border border-stone-200 bg-white p-6 text-left transition-all hover:border-stone-400 hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-stone-700"><Image className="h-5 w-5" /></div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Scene Mode</p>
            <h3 className="mt-1 font-serif text-2xl text-stone-900">Create a Scene</h3>
            <p className="mt-3 text-sm leading-6 text-stone-600">Direct a moment through Who, Where, Action, Object, Mood and Style. Creative Lab writes the working brief for you.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-stone-700">Build a scene <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
          </button>

          <button type="button" onClick={() => onSelect('character')} className="group rounded-3xl border border-stone-200 bg-white p-6 text-left transition-all hover:border-stone-400 hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-stone-700"><User className="h-5 w-5" /></div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Character Mode</p>
            <h3 className="mt-1 font-serif text-2xl text-stone-900">Create a Character</h3>
            <p className="mt-3 text-sm leading-6 text-stone-600">Define a reusable character through identity, personality, silhouette, intentional irregularity, clothing, props and the Curious Community style.</p>
            <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-stone-700">Build a character <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
          </button>
        </div>

        <div className="border-t border-stone-200 px-5 py-4 text-xs leading-5 text-stone-500 sm:px-7">
          Both paths create the same kind of Creative Lab project and enter the same review, style and Library workflow.
        </div>
      </div>
    </div>
  );
}
