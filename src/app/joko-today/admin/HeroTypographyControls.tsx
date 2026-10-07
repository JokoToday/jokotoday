import { useState } from 'react';
import type { BuilderRichText, BuilderRichTextColor, BuilderRichTextMarks, HeroFontPreset, HeroTextAlign, HeroTextStyle, HeroTitleLineStyle } from '../../../platform/builder';
import { HERO_FONT_OPTIONS, heroFontFamily, normalizeBuilderRichText, splitHeroLines } from '../../../platform/builder';

const input = 'w-full rounded-lg border border-[#55766F]/20 bg-white px-2 py-2 text-xs text-[#303532]';
const ALIGNMENTS = ['left', 'center', 'right'] as const;

export function HeroStyleControls({
  label, value, onChange, min = 12, max = 108, defaultBold = false,
}: {
  label: string;
  value?: HeroTextStyle;
  onChange: (value: HeroTextStyle) => void;
  min?: number;
  max?: number;
  defaultBold?: boolean;
}) {
  const set = (patch: Partial<HeroTextStyle>) => onChange({ ...value, ...patch });
  return <div className="rounded-xl border border-[#55766F]/14 bg-[#FFF9EE]/70 p-3">
    <p className="mb-3 text-xs font-semibold text-[#304B45]">{label}</p>
    <div className="grid grid-cols-2 gap-2">
      <label className="text-xs text-[#304B45]">Font
        <select aria-label={`${label} font`} className={input} value={value?.font ?? 'inherit'}
          onChange={(event) => set({ font: event.target.value as HeroFontPreset })}>
          {HERO_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="text-xs text-[#304B45]">Size (px)
        <input aria-label={`${label} size`} className={input} type="number" min={min} max={max}
          placeholder="Theme default" value={value?.size ?? ''}
          onChange={(event) => set({ size: event.target.value ? Math.max(min, Math.min(max, Number(event.target.value))) : undefined })} />
      </label>
    </div>
    <label className="mt-3 block text-xs text-[#304B45]">Line spacing (× font size)
      <input aria-label={`${label} line spacing`} className={input} type="number" min={0.8} max={2.5} step={0.05}
        placeholder="Use existing spacing" value={value?.lineHeight ?? ''}
        onChange={(event) => set({ lineHeight: event.target.value
          ? Math.min(2.5, Math.max(0.8, Number(event.target.value))) : undefined })} />
      <span className="mt-1 block text-[11px] text-[#303532]/55">For example, 0.9 is compact; 1.5 is spacious.</span>
    </label>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={value?.bold ?? defaultBold}
        onChange={(event) => set({ bold: event.target.checked })} />Bold</label>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(value?.italic)}
        onChange={(event) => set({ italic: event.target.checked })} />Italic</label>
      <select aria-label={`${label} alignment`} className="rounded-lg border border-[#55766F]/20 bg-white px-2 py-1.5 text-xs"
        value={value?.align ?? 'left'} onChange={(event) => set({ align: event.target.value as HeroTextAlign })}>
        {ALIGNMENTS.map((align) => <option key={align} value={align}>{align}</option>)}
      </select>
    </div>
  </div>;
}

export function HeroLineStyleControls({ value, styles, onChange }: {
  value: BuilderRichText;
  styles?: readonly HeroTitleLineStyle[];
  onChange: (styles: HeroTitleLineStyle[]) => void;
}) {
  const lines = splitHeroLines(value);
  const edit = (index: number, patch: Partial<HeroTitleLineStyle>) => {
    const next = Array.from({ length: lines.length }, (_, line) => ({ ...styles?.[line] }));
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  return <div className="space-y-2 rounded-xl border border-[#55766F]/14 bg-white/65 p-3">
    <p className="text-xs font-semibold text-[#304B45]">Headline line sizing & alignment</p>
    <p className="text-[11px] text-[#303532]/60">Press Enter in the headline editor to create a line. Each line may have its own alignment, size and font. Word styles override line defaults.</p>
    {lines.slice(0, 12).map((line, index) => <div key={index} className="rounded-lg bg-[#F6F1E7] p-2">
      <p className="mb-2 truncate text-xs text-[#303532]/70">Line {index + 1}: {line.map((run) => run.text).join('') || '(empty)'}</p>
      <div className="grid grid-cols-3 gap-2">
        <select className={input} aria-label={`Line ${index + 1} font`}
          value={styles?.[index]?.font ?? 'inherit'}
          onChange={(event) => edit(index, { font: event.target.value as HeroFontPreset })}>
          {HERO_FONT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <input aria-label={`Line ${index + 1} size`} type="number" min={12} max={108} placeholder="Default"
          className={input} value={styles?.[index]?.size ?? ''}
          onChange={(event) => edit(index, { size: event.target.value ? Math.max(12, Math.min(108, Number(event.target.value))) : undefined })} />
        <select aria-label={`Line ${index + 1} alignment`} className={input}
          value={styles?.[index]?.align ?? 'left'} onChange={(event) => edit(index, { align: event.target.value as HeroTextAlign })}>
          {ALIGNMENTS.map((align) => <option key={align} value={align}>{align}</option>)}
        </select>
      </div>
    </div>)}
  </div>;
}

interface WordToken { text: string; marks?: BuilderRichTextMarks }
function tokensFromRuns(runs: BuilderRichText, locale: string): WordToken[] {
  // Unlike whitespace splitting, word segmentation works for Thai and Chinese.
  // Browsers without Intl.Segmenter keep the existing whitespace fallback.
  type Segment = { segment: string };
  const segmenterCtor = (Intl as unknown as {
    Segmenter?: new (lang: string, options: { granularity: 'word' }) => { segment: (text: string) => Iterable<Segment> };
  }).Segmenter;
  const segmenter = segmenterCtor ? new segmenterCtor(locale, { granularity: 'word' }) : null;
  return runs.flatMap((run) => {
    const pieces = segmenter
      ? Array.from(segmenter.segment(run.text), (entry) => entry.segment)
      : run.text.match(/\s+|[^\s]+/gu) || [];
    return pieces.map((text) => ({ text, marks: run.marks }));
  });
}

/** Click a word, not a DOM selection: reliable editing even across line breaks. */
export function HeroWordStyleEditor({ value, onChange, colors, locale }: {
  value: BuilderRichText;
  onChange: (value: BuilderRichText) => void;
  colors: { text: string; accent: string; turquoise: string };
  locale: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const tokens = tokensFromRuns(value, locale);
  const token = selected !== null ? tokens[selected] : undefined;
  const marks = token?.marks;
  const update = (patch: Partial<BuilderRichTextMarks>) => {
    if (selected === null || !token) return;
    const next = tokens.map((current, index) => index === selected
      ? { ...current, marks: { ...current.marks, ...patch } } : current);
    onChange(normalizeBuilderRichText(next));
  };
  return <div className="rounded-xl border border-[#55766F]/14 bg-[#FFF9EE]/75 p-3">
    <p className="text-xs font-semibold text-[#304B45]">Individual word styling</p>
    <p className="mt-1 text-[11px] text-[#303532]/60">Choose a word below, then set its font, size, bold, italic and brand color. Thai and Chinese words can also be selected. Line breaks stay intact.</p>
    <div className="my-3 flex flex-wrap items-center gap-y-1 rounded-lg border border-[#55766F]/12 bg-white p-2 text-sm leading-7">
      {tokens.map((entry, index) => /\s+/u.test(entry.text) && entry.text.trim() === ''
        ? <span key={index} className="whitespace-pre-wrap">{entry.text}</span>
        : <button type="button" key={index} onClick={() => setSelected(index)}
            aria-pressed={selected === index}
            className={`rounded-sm px-0.5 ${selected === index ? 'bg-[#F4CDAC] ring-1 ring-[#C76624]' : 'hover:bg-[#E2ECE6]'}`}
            style={{
              fontFamily: entry.marks?.font ? heroFontFamily(entry.marks.font) : undefined,
              fontSize: entry.marks?.size ? `${Math.min(24, entry.marks.size)}px` : undefined,
              fontStyle: entry.marks?.italic ? 'italic' : undefined,
              fontWeight: entry.marks?.bold === undefined ? undefined : entry.marks.bold ? 700 : 400,
              color: entry.marks?.color ? colors[entry.marks.color] : '#303532',
            }}>{entry.text}</button>)}
    </div>
    {token ? <div className="space-y-2">
      <p className="text-xs font-medium">Editing: <strong>{token.text}</strong></p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">Font
          <select aria-label="Selected word font" value={marks?.font ?? 'inherit'} className={input}
            onChange={(event) => update({ font: event.target.value as HeroFontPreset })}>
            {HERO_FONT_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs">Size (px)
          <input aria-label="Selected word size" type="number" min={12} max={108} value={marks?.size ?? ''} placeholder="Line size" className={input}
            onChange={(event) => update({ size: event.target.value ? Math.max(12, Math.min(108, Number(event.target.value))) : undefined })} />
        </label>
        <label className="text-xs">Color
          <select aria-label="Selected word color" className={input} value={marks?.color ?? 'text'}
            onChange={(event) => update({ color: event.target.value as BuilderRichTextColor })}>
            <option value="text">Charcoal</option><option value="accent">Orange</option><option value="turquoise">Turquoise</option>
          </select>
        </label>
        <div className="flex items-end gap-2 pb-1 text-xs">
          <label>Weight
            <select aria-label="Selected word weight" className={input}
              value={marks?.bold === undefined ? 'inherit' : marks.bold ? 'bold' : 'regular'}
              onChange={(event) => update({ bold: event.target.value === 'inherit' ? undefined : event.target.value === 'bold' })}>
              <option value="inherit">Inherit</option><option value="bold">Bold</option><option value="regular">Regular</option>
            </select>
          </label>
          <label>Style
            <select aria-label="Selected word style" className={input}
              value={marks?.italic === undefined ? 'inherit' : marks.italic ? 'italic' : 'normal'}
              onChange={(event) => update({ italic: event.target.value === 'inherit' ? undefined : event.target.value === 'italic' })}>
              <option value="inherit">Inherit</option><option value="italic">Italic</option><option value="normal">Normal</option>
            </select>
          </label>
        </div>
      </div>
      <button type="button" className="text-xs font-semibold text-[#A44F1D] underline" onClick={() => {
        if (selected === null) return;
        onChange(normalizeBuilderRichText(tokens.map((current, index) => index === selected ? { text: current.text } : current)));
      }}>Clear word overrides</button>
    </div> : <p className="text-[11px] text-[#303532]/50">Select any word above.</p>}
  </div>;
}
