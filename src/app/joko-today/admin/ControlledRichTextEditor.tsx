import { useEffect, useMemo, useRef } from 'react';
import type {
  BuilderRichText,
  BuilderRichTextColor,
  BuilderRichTextMarks,
  BuilderRichTextRun,
} from '../../../platform/builder';
import { normalizeBuilderRichText } from '../../../platform/builder';

interface ControlledRichTextEditorProps {
  value: BuilderRichText;
  onChange: (value: BuilderRichText) => void;
  colors: {
    text: string;
    accent: string;
    turquoise: string;
  };
}

function signaturesEqual(a: BuilderRichText, b: BuilderRichText): boolean {
  return JSON.stringify(normalizeBuilderRichText(a)) === JSON.stringify(normalizeBuilderRichText(b));
}

function colorToRgb(color: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
  if (!match) return color.toLowerCase();
  return `rgb(${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)})`;
}

function createRunNode(run: BuilderRichTextRun, ownerDocument: Document, colors: ControlledRichTextEditorProps['colors']): Node {
  const text = ownerDocument.createTextNode(run.text);
  const marks = run.marks;
  if (!marks?.bold && !marks?.italic && !marks?.color) return text;

  const span = ownerDocument.createElement('span');
  if (marks.bold) span.style.fontWeight = '700';
  if (marks.italic) span.style.fontStyle = 'italic';
  if (marks.color) {
    span.dataset.jokoColor = marks.color;
    span.style.color = colors[marks.color];
  }
  span.appendChild(text);
  return span;
}

function appendRun(
  runs: BuilderRichTextRun[],
  text: string,
  marks: BuilderRichTextMarks,
) {
  if (!text) return;
  runs.push({
    text,
    ...(marks.bold || marks.italic || marks.color ? { marks } : {}),
  });
}

function serializeEditor(
  root: HTMLElement,
  colors: ControlledRichTextEditorProps['colors'],
): BuilderRichText {
  const runs: BuilderRichTextRun[] = [];
  const semanticColors: Array<[BuilderRichTextColor, string, string]> = (
    ['text', 'accent', 'turquoise'] as BuilderRichTextColor[]
  ).map((key) => [key, colors[key].toLowerCase(), colorToRgb(colors[key])]);

  const walk = (node: Node, inherited: BuilderRichTextMarks) => {
    if (node.nodeType === Node.TEXT_NODE) {
      appendRun(runs, node.textContent ?? '', inherited);
      return;
    }
    if (!(node instanceof HTMLElement)) return;

    const marks: BuilderRichTextMarks = { ...inherited };
    const tag = node.tagName.toLowerCase();
    if (tag === 'strong' || tag === 'b' || node.style.fontWeight === '700' || node.style.fontWeight === 'bold') marks.bold = true;
    if (tag === 'em' || tag === 'i' || node.style.fontStyle === 'italic') marks.italic = true;

    const dataColor = node.dataset.jokoColor as BuilderRichTextColor | undefined;
    if (dataColor && ['text', 'accent', 'turquoise'].includes(dataColor)) {
      marks.color = dataColor;
    } else {
      const rawColor = (node.getAttribute('color') || node.style.color || '').toLowerCase();
      const matched = semanticColors.find(([, hex, rgb]) => rawColor === hex || rawColor === rgb);
      if (matched) marks.color = matched[0];
    }

    if (tag === 'br') {
      appendRun(runs, '\n', inherited);
      return;
    }

    const isBlock = tag === 'div' || tag === 'p';
    if (isBlock && runs.length > 0 && !runs[runs.length - 1].text.endsWith('\n')) {
      appendRun(runs, '\n', inherited);
    }

    Array.from(node.childNodes).forEach((child) => walk(child, marks));
  };

  Array.from(root.childNodes).forEach((child) => walk(child, {}));
  const normalized = normalizeBuilderRichText(runs);
  if (normalized.length > 0) {
    const last = normalized[normalized.length - 1];
    if (last.text.endsWith('\n')) {
      return normalizeBuilderRichText([
        ...normalized.slice(0, -1),
        { ...last, text: last.text.replace(/\n+$/, '') },
      ]);
    }
  }
  return normalized;
}

export function ControlledRichTextEditor({ value, onChange, colors }: ControlledRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef<BuilderRichText>(value);
  const normalizedValue = useMemo(() => normalizeBuilderRichText(value), [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || signaturesEqual(lastEmittedRef.current, normalizedValue)) return;

    editor.replaceChildren();
    normalizedValue.forEach((run) => editor.appendChild(createRunNode(run, editor.ownerDocument, colors)));
    lastEmittedRef.current = normalizedValue;
  }, [normalizedValue, colors]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.childNodes.length > 0 || normalizedValue.length === 0) return;
    normalizedValue.forEach((run) => editor.appendChild(createRunNode(run, editor.ownerDocument, colors)));
    lastEmittedRef.current = normalizedValue;
  }, []);

  const emit = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const next = serializeEditor(editor, colors);
    lastEmittedRef.current = next;
    onChange(next);
  };

  const command = (name: string, commandValue?: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    editor.ownerDocument.execCommand(name, false, commandValue);
    emit();
  };

  const applyColor = (color: BuilderRichTextColor) => {
    command('foreColor', colors[color]);
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-[#55766F]/14 bg-white/65 p-1.5">
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('bold')} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#303532] hover:bg-[#EEF5F2]" title="Bold">B</button>
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => command('italic')} className="rounded-lg px-2.5 py-1.5 text-xs italic text-[#303532] hover:bg-[#EEF5F2]" title="Italic">I</button>
        <span className="mx-1 h-5 w-px bg-[#55766F]/14" />
        {(['text', 'accent', 'turquoise'] as BuilderRichTextColor[]).map((color) => (
          <button
            key={color}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => applyColor(color)}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold capitalize text-[#303532]/75 hover:bg-[#EEF5F2]"
            title={`Apply ${color} brand color`}
          >
            <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: colors[color] }} />
            {color}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Hero headline rich text"
        onInput={emit}
        onBlur={emit}
        className="min-h-28 whitespace-pre-wrap rounded-xl border border-[#55766F]/20 bg-white px-3 py-3 text-sm leading-6 text-[#303532] outline-none transition focus:border-[#55766F]/55 focus:ring-2 focus:ring-[#55766F]/12"
      />
      <p className="mt-2 text-[11px] leading-4 text-[#303532]/48">
        Select text, then apply bold, italic or a JOKO semantic color. Press Enter for a deliberate line break.
      </p>
    </div>
  );
}

export default ControlledRichTextEditor;
