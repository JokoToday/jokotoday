import {
  CHINESE_FONT_OPTIONS,
  EDITOR_DEFAULT_BUILDER_SITE_STYLE,
  ENGLISH_BODY_FONT_OPTIONS,
  ENGLISH_DISPLAY_FONT_OPTIONS,
  THAI_FONT_OPTIONS,
  type BuilderSiteStyle,
  type JokoFontChoice,
} from '../../../platform/builder';

interface HomepageBrandStyleEditorProps {
  value: BuilderSiteStyle;
  onChange: (value: BuilderSiteStyle) => void;
}

type TypographyNumberKey =
  | 'heroSize'
  | 'sectionHeadingSize'
  | 'bodySize'
  | 'navSize'
  | 'buttonSize'
  | 'labelSize';

const sizeFields: Array<{
  key: TypographyNumberKey;
  label: string;
  min: number;
  max: number;
}> = [
  { key: 'heroSize', label: 'Hero headline', min: 44, max: 88 },
  { key: 'sectionHeadingSize', label: 'Section headings', min: 26, max: 52 },
  { key: 'bodySize', label: 'Body text', min: 13, max: 21 },
  { key: 'navSize', label: 'Navigation', min: 12, max: 19 },
  { key: 'buttonSize', label: 'Buttons', min: 13, max: 20 },
  { key: 'labelSize', label: 'Small labels', min: 9, max: 15 },
];

export function HomepageBrandStyleEditor({
  value,
  onChange,
}: HomepageBrandStyleEditorProps) {
  const updateTypography = <K extends keyof BuilderSiteStyle['typography']>(
    key: K,
    nextValue: BuilderSiteStyle['typography'][K],
  ) => {
    onChange({
      ...value,
      typography: {
        ...value.typography,
        [key]: nextValue,
      },
    });
  };

  const updateColor = (key: keyof BuilderSiteStyle['colors'], nextValue: string) => {
    onChange({
      ...value,
      colors: {
        ...value.colors,
        [key]: nextValue.toUpperCase(),
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#303532]">Logo size</p>
            <p className="mt-1 text-xs text-[#303532]/55">One responsive scale for desktop and mobile.</p>
          </div>
          <span className="rounded-full bg-[#D9ECE9] px-3 py-1 text-sm font-semibold text-[#304B45]">
            {value.logoScale}%
          </span>
        </div>
        <input
          type="range"
          min={70}
          max={150}
          step={5}
          value={value.logoScale}
          onChange={(event) => onChange({ ...value, logoScale: Number(event.target.value) })}
          className="mt-4 w-full accent-[#C76624]"
        />
        <div className="mt-1 flex justify-between text-[11px] text-[#303532]/45">
          <span>70%</span>
          <span>150%</span>
        </div>
      </div>

      <div className="border-t border-[#55766F]/12 pt-5">
        <div className="mb-4">
          <p className="text-sm font-semibold text-[#303532]">Typography</p>
          <p className="mt-1 text-xs text-[#303532]/55">
            Shared semantic type roles keep the homepage consistent across sections.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FontSelect
            label="English display"
            value={value.typography.englishDisplayFont}
            options={ENGLISH_DISPLAY_FONT_OPTIONS}
            onChange={(next) => updateTypography('englishDisplayFont', next)}
          />
          <FontSelect
            label="English body / UI"
            value={value.typography.englishBodyFont}
            options={ENGLISH_BODY_FONT_OPTIONS}
            onChange={(next) => updateTypography('englishBodyFont', next)}
          />
          <FontSelect
            label="Thai"
            value={value.typography.thaiFont}
            options={THAI_FONT_OPTIONS}
            onChange={(next) => updateTypography('thaiFont', next)}
          />
          <FontSelect
            label="Chinese"
            value={value.typography.chineseFont}
            options={CHINESE_FONT_OPTIONS}
            onChange={(next) => updateTypography('chineseFont', next)}
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sizeFields.map((field) => (
            <label
              key={field.key}
              className="rounded-xl border border-[#55766F]/12 bg-white/55 p-3"
            >
              <span className="flex items-center justify-between gap-3 text-xs font-semibold text-[#303532]">
                {field.label}
                <span className="font-mono text-[#55766F]">{value.typography[field.key]} px</span>
              </span>
              <input
                type="range"
                min={field.min}
                max={field.max}
                value={value.typography[field.key]}
                onChange={(event) => updateTypography(field.key, Number(event.target.value))}
                className="mt-3 w-full accent-[#55766F]"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-[#55766F]/12 pt-5">
        <div className="mb-4">
          <p className="text-sm font-semibold text-[#303532]">Brand colours</p>
          <p className="mt-1 text-xs text-[#303532]/55">
            Core homepage ink, rust accent and mineral turquoise.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ColorField
            label="Text / ink"
            value={value.colors.ink}
            onChange={(next) => updateColor('ink', next)}
          />
          <ColorField
            label="Accent / rust"
            value={value.colors.accent}
            onChange={(next) => updateColor('accent', next)}
          />
          <ColorField
            label="Turquoise"
            value={value.colors.mineral}
            onChange={(next) => updateColor('mineral', next)}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange(EDITOR_DEFAULT_BUILDER_SITE_STYLE)}
        className="text-xs font-semibold text-[#55766F] underline decoration-[#55766F]/30 underline-offset-4 hover:text-[#304B45]"
      >
        Reset site identity to JOKO defaults
      </button>
    </div>
  );
}

function FontSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: JokoFontChoice;
  options: readonly { value: JokoFontChoice; label: string }[];
  onChange: (value: JokoFontChoice) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[#55766F]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as JokoFontChoice)}
        className="mt-1.5 w-full rounded-xl border border-[#55766F]/20 bg-white px-3 py-2.5 text-sm text-[#303532] outline-none focus:border-[#55766F] focus:ring-2 focus:ring-[#55766F]/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-xl border border-[#55766F]/12 bg-white/55 p-3">
      <span className="text-xs font-semibold text-[#303532]">{label}</span>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={value}
          maxLength={7}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            if (/^#[0-9A-F]{6}$/.test(next)) onChange(next);
          }}
          className="min-w-0 flex-1 rounded-lg border border-[#55766F]/18 bg-white px-2.5 py-2 font-mono text-xs uppercase text-[#303532]"
        />
      </div>
    </label>
  );
}
