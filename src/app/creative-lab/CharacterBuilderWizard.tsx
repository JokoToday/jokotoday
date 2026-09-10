import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Palette, Plus, X } from 'lucide-react';
import {
  LET_LAB_DECIDE,
  NOT_IMPORTANT,
  OTHER,
  characterOptions,
  getStyleProfile,
  makeCharacterBrief,
  styleProfiles,
  type CharacterProjectDraft,
  type CharacterSpec,
  type CharacterStyleStrictness,
} from './creativeLabModel';

interface Props {
  onClose: () => void;
  onCreate: (draft: CharacterProjectDraft) => void;
}

type FieldKey =
  | 'characterType'
  | 'gender'
  | 'ageRange'
  | 'culturalBackground'
  | 'profession'
  | 'archetype'
  | 'emotionalBaseline'
  | 'proportionEmphasis'
  | 'posture'
  | 'faceShape'
  | 'eyes'
  | 'nose'
  | 'mouth'
  | 'hair'
  | 'hairTreatment'
  | 'glasses'
  | 'facialHair'
  | 'clothing'
  | 'clothingCharacter'
  | 'patternDetail'
  | 'primaryProp'
  | 'secondaryProp'
  | 'accentPlacement'
  | 'accentFamily'
  | 'outputType'
  | 'framing'
  | 'viewAngle'
  | 'background';

type MultiFieldKey = 'personality' | 'silhouettes' | 'signatureTraits' | 'professionCues' | 'cardText';

type FormState = Record<FieldKey, string> & {
  name: string;
  notes: string;
  styleProfile: string;
  strictness: CharacterStyleStrictness;
  personality: string[];
  silhouettes: string[];
  signatureTraits: string[];
  professionCues: string[];
  cardText: string[];
};

const emptyForm: FormState = {
  name: '',
  characterType: '',
  gender: '',
  ageRange: '',
  culturalBackground: '',
  profession: '',
  archetype: '',
  emotionalBaseline: '',
  proportionEmphasis: '',
  posture: '',
  faceShape: '',
  eyes: '',
  nose: '',
  mouth: '',
  hair: '',
  hairTreatment: '',
  glasses: '',
  facialHair: '',
  clothing: '',
  clothingCharacter: '',
  patternDetail: '',
  primaryProp: '',
  secondaryProp: '',
  accentPlacement: '',
  accentFamily: '',
  outputType: 'Character Card',
  framing: 'Full-body',
  viewAngle: '',
  background: 'Clean white space',
  notes: '',
  styleProfile: 'curious-community-v1',
  strictness: 'Strict',
  personality: [],
  silhouettes: [],
  signatureTraits: [],
  professionCues: [],
  cardText: ['Character name'],
};

export function CharacterBuilderWizard({ onClose, onCreate }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  const resolve = (key: string, value: string) => value === OTHER ? (customValues[key] ?? '').trim() : value;
  const resolveMulti = (key: string, values: string[]) => values
    .map((value) => value === OTHER ? (customValues[key] ?? '').trim() : value)
    .filter(Boolean);

  const spec = useMemo<CharacterSpec>(() => ({
    schemaVersion: 1,
    identity: {
      name: form.name.trim(),
      characterType: resolve('characterType', form.characterType),
      gender: resolve('gender', form.gender),
      ageRange: resolve('ageRange', form.ageRange),
      culturalBackground: resolve('culturalBackground', form.culturalBackground),
    },
    character: {
      profession: resolve('profession', form.profession),
      archetype: resolve('archetype', form.archetype),
      personality: resolveMulti('personality', form.personality),
      emotionalBaseline: resolve('emotionalBaseline', form.emotionalBaseline),
    },
    visualIdentity: {
      silhouettes: resolveMulti('silhouettes', form.silhouettes),
      proportionEmphasis: resolve('proportionEmphasis', form.proportionEmphasis),
      signatureTraits: resolveMulti('signatureTraits', form.signatureTraits),
      posture: resolve('posture', form.posture),
      face: {
        faceShape: resolve('faceShape', form.faceShape),
        eyes: resolve('eyes', form.eyes),
        nose: resolve('nose', form.nose),
        mouth: resolve('mouth', form.mouth),
        hair: resolve('hair', form.hair),
        hairTreatment: resolve('hairTreatment', form.hairTreatment),
        glasses: resolve('glasses', form.glasses),
        facialHair: resolve('facialHair', form.facialHair),
      },
    },
    wardrobe: {
      clothing: resolve('clothing', form.clothing),
      clothingCharacter: resolve('clothingCharacter', form.clothingCharacter),
      patternDetail: resolve('patternDetail', form.patternDetail),
      professionCues: resolveMulti('professionCues', form.professionCues),
    },
    props: {
      primary: resolve('primaryProp', form.primaryProp),
      secondary: resolve('secondaryProp', form.secondaryProp),
    },
    colour: {
      placement: resolve('accentPlacement', form.accentPlacement),
      accentFamily: resolve('accentFamily', form.accentFamily),
    },
    presentation: {
      outputType: resolve('outputType', form.outputType),
      framing: resolve('framing', form.framing),
      viewAngle: resolve('viewAngle', form.viewAngle),
      background: resolve('background', form.background),
      cardText: resolveMulti('cardText', form.cardText),
    },
    style: {
      profileId: resolve('styleProfile', form.styleProfile),
      profileVersion: 1,
      strictness: form.strictness,
    },
    notes: form.notes.trim(),
  // The custom values are intentionally part of this memo because Other… resolves through them.
  }), [form, customValues]);

  const canContinue = (() => {
    if (step === 0) return Boolean(spec.identity.name && spec.identity.characterType);
    if (step === 1) return spec.character.personality.length > 0;
    if (step === 2) return spec.visualIdentity.silhouettes.length > 0 && spec.visualIdentity.signatureTraits.length > 0;
    if (step === 3) return true;
    return Boolean(spec.presentation.outputType && spec.presentation.framing && spec.presentation.background && spec.style.profileId);
  })();

  const field = (label: string, key: FieldKey, options: string[], required = false) => (
    <ChoiceField
      label={label}
      value={form[key]}
      customValue={customValues[key] ?? ''}
      options={options}
      required={required}
      onChange={(value) => setForm((current) => ({ ...current, [key]: value }))}
      onCustomChange={(value) => setCustomValues((current) => ({ ...current, [key]: value }))}
    />
  );

  const multi = (label: string, key: MultiFieldKey, options: string[], max?: number) => (
    <MultiChoiceField
      label={label}
      values={form[key]}
      options={options}
      max={max}
      customValue={customValues[key] ?? ''}
      onChange={(values) => setForm((current) => ({ ...current, [key]: values }))}
      onCustomChange={(value) => setCustomValues((current) => ({ ...current, [key]: value }))}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4" role="dialog" aria-modal="true" aria-label="Create a Creative Lab character">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-stone-200 bg-stone-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Character Mode</p>
            <p className="mt-1 text-sm font-semibold text-stone-800">Step {step + 1} of 5</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-stone-500 hover:bg-stone-100" aria-label="Close Character Mode">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-8">
          <Progress step={step} />

          {step === 0 && (
            <Step title="Who is this?" note="Start with identity. Background can inform a character; it must never become the caricature.">
              <label className="block">
                <span className="text-xs font-semibold text-stone-700">Character name *</span>
                <input autoFocus value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Emma, Theo, Tech Nerd…" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm outline-none focus:border-stone-500" />
              </label>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {field('Character type', 'characterType', characterOptions.characterType, true)}
                {field('Gender / presentation', 'gender', characterOptions.gender)}
                {field('Age range', 'ageRange', characterOptions.ageRange)}
                {field('Ethnic / cultural background', 'culturalBackground', characterOptions.culturalBackground)}
              </div>
            </Step>
          )}

          {step === 1 && (
            <Step title="What kind of person are they?" note="Personality should shape the silhouette and posture, not become theatrical facial acting.">
              <div className="grid gap-5 md:grid-cols-2">
                {field('Profession / role', 'profession', characterOptions.profession)}
                {field('Archetype / social vibe', 'archetype', characterOptions.archetype)}
                {field('Default emotional tone', 'emotionalBaseline', characterOptions.emotionalBaseline)}
              </div>
              <div className="mt-6">{multi('Personality traits *', 'personality', characterOptions.personality, 4)}</div>
            </Step>
          )}

          {step === 2 && (
            <Step title="What makes them recognizable?" note="A character can combine several silhouette signals and several intentional irregularities. Choose the traits that make the person recognizable at a glance.">
              <div className="grid gap-7 md:grid-cols-2">
                {multi('Body / silhouette *', 'silhouettes', characterOptions.silhouette, 3)}
                {multi('Signature traits / irregularities *', 'signatureTraits', characterOptions.irregularity, 3)}
              </div>
              <div className="mt-7 grid gap-5 md:grid-cols-2">
                {field('Proportion emphasis', 'proportionEmphasis', characterOptions.proportionEmphasis)}
                {field('Posture / stance', 'posture', characterOptions.posture)}
              </div>
              <details className="mt-7 rounded-2xl border border-stone-200 bg-white p-5">
                <summary className="cursor-pointer text-sm font-semibold text-stone-800">+ Add face & head detail</summary>
                <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {field('Face shape', 'faceShape', characterOptions.faceShape)}
                  {field('Eyes', 'eyes', characterOptions.eyes)}
                  {field('Nose', 'nose', characterOptions.nose)}
                  {field('Mouth', 'mouth', characterOptions.mouth)}
                  {field('Hair / head treatment', 'hair', characterOptions.hair)}
                  {field('Hair colour treatment', 'hairTreatment', characterOptions.hairTreatment)}
                  {field('Glasses / face accessory', 'glasses', characterOptions.glasses)}
                  {field('Facial hair', 'facialHair', characterOptions.facialHair)}
                </div>
              </details>
            </Step>
          )}

          {step === 3 && (
            <Step title="What do they wear and carry?" note="Details should reveal identity. Props are character information, not decoration.">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {field('Clothing', 'clothing', characterOptions.clothing)}
                {field('Clothing character', 'clothingCharacter', characterOptions.clothingCharacter)}
                {field('Pattern / detail', 'patternDetail', characterOptions.patternDetail)}
                {field('Primary signature object', 'primaryProp', characterOptions.primaryProp)}
                {field('Secondary object', 'secondaryProp', characterOptions.secondaryProp)}
                {field('Accent colour placement', 'accentPlacement', characterOptions.accentPlacement)}
                {field('Accent colour family', 'accentFamily', characterOptions.accentFamily)}
              </div>
              <div className="mt-6">{multi('Profession cues', 'professionCues', characterOptions.professionCue, 3)}</div>
            </Step>
          )}

          {step === 4 && (
            <Step title="How should we present them?" note="Curious Community is the default house language for people. Final Style: Pass remains a human decision.">
              <div className="grid gap-5 md:grid-cols-2">
                {field('Character output type', 'outputType', characterOptions.outputType, true)}
                {field('Framing', 'framing', characterOptions.framing, true)}
                {field('View angle', 'viewAngle', characterOptions.viewAngle)}
                {field('Background treatment', 'background', characterOptions.background, true)}
              </div>
              <div className="mt-6">{multi('Text on character card', 'cardText', characterOptions.cardText, 3)}</div>

              <div className="mt-7">
                <p className="text-xs font-semibold text-stone-700">Style profile *</p>
                <div className="mt-2 grid gap-3 md:grid-cols-3">
                  {Object.entries(styleProfiles).map(([id, style]) => (
                    <button key={id} type="button" onClick={() => setForm((current) => ({ ...current, styleProfile: id }))} className={`rounded-2xl border p-4 text-left ${form.styleProfile === id ? 'border-stone-800 bg-white shadow-sm' : 'border-stone-200 bg-white'}`}>
                      <div className="flex items-center justify-between gap-2"><Palette className="h-4 w-4 text-stone-500" />{id === 'curious-community-v1' && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Default</span>}</div>
                      <p className="mt-3 text-sm font-semibold text-stone-800">{style.title}</p>
                      <p className="mt-1 text-[11px] leading-5 text-stone-500">{style.description}</p>
                    </button>
                  ))}
                  <button type="button" onClick={() => setForm((current) => ({ ...current, styleProfile: OTHER }))} className={`rounded-2xl border p-4 text-left ${form.styleProfile === OTHER ? 'border-stone-800 bg-white shadow-sm' : 'border-stone-200 bg-white'}`}><Plus className="h-4 w-4" /><p className="mt-3 text-sm font-semibold">Other…</p></button>
                </div>
                {form.styleProfile === OTHER && <input autoFocus value={customValues.styleProfile ?? ''} onChange={(event) => setCustomValues((current) => ({ ...current, styleProfile: event.target.value }))} placeholder="Name the custom style…" className="mt-3 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm" />}
              </div>

              <label className="mt-6 block">
                <span className="text-xs font-semibold text-stone-700">Style strictness</span>
                <select value={form.strictness} onChange={(event) => setForm((current) => ({ ...current, strictness: event.target.value as CharacterStyleStrictness }))} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm">
                  {characterOptions.strictness.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>

              <label className="mt-6 block">
                <span className="text-xs font-semibold text-stone-700">Anything unusual we should know? <span className="font-normal text-stone-400">optional</span></span>
                <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} placeholder="His awkwardness should be charming, not comic…" className="mt-2 w-full resize-none rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6" />
              </label>

              <div className="mt-7 rounded-2xl border border-stone-300 bg-white p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Character contract</p>
                <h3 className="mt-2 font-serif text-2xl text-stone-900">{spec.identity.name || 'Unnamed character'}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">{spec.identity.name && spec.identity.characterType ? makeCharacterBrief(spec) : 'Complete the required fields to build the character direction.'}</p>
                <p className="mt-4 text-xs font-semibold text-stone-700">Style: {spec.style.profileId ? getStyleProfile(spec.style.profileId).title : '—'} · {spec.style.strictness}</p>
              </div>
            </Step>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-stone-200 bg-white px-5 py-4 sm:px-7">
          <button type="button" onClick={step === 0 ? onClose : () => setStep((current) => Math.max(0, current - 1))} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-xs font-semibold text-stone-700">
            {step > 0 && <ChevronLeft className="h-4 w-4" />}{step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 4 ? (
            <button type="button" disabled={!canContinue} onClick={() => setStep((current) => Math.min(4, current + 1))} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white disabled:bg-stone-300">Continue<ChevronRight className="h-4 w-4" /></button>
          ) : (
            <button type="button" disabled={!canContinue} onClick={() => onCreate({ character: spec })} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white disabled:bg-stone-300"><Plus className="h-4 w-4" />Create character project</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return <div className="mb-8 grid grid-cols-5 gap-2">{['Identity', 'Personality', 'Visual', 'Wardrobe', 'Presentation'].map((label, index) => <div key={label}><div className={`h-1.5 rounded-full ${index <= step ? 'bg-stone-800' : 'bg-stone-200'}`} /><p className="mt-2 text-[10px] font-semibold text-stone-600">{label}</p></div>)}</div>;
}

function Step({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return <section><h2 className="font-serif text-3xl text-stone-950">{title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">{note}</p><div className="mt-6">{children}</div></section>;
}

function ChoiceField({ label, value, customValue, options, onChange, onCustomChange, required = false }: { label: string; value: string; customValue: string; options: string[]; onChange: (value: string) => void; onCustomChange: (value: string) => void; required?: boolean }) {
  return <label className="block"><span className="text-xs font-semibold text-stone-700">{label}{required && ' *'}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-stone-500"><option value="">Choose…</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>{value === OTHER && <input autoFocus value={customValue} onChange={(event) => onCustomChange(event.target.value)} placeholder={`Enter ${label.toLowerCase()}…`} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm" />}</label>;
}

function MultiChoiceField({ label, values, options, customValue, onChange, onCustomChange, max }: { label: string; values: string[]; options: string[]; customValue: string; onChange: (values: string[]) => void; onCustomChange: (value: string) => void; max?: number }) {
  const exclusiveValues = [LET_LAB_DECIDE, NOT_IMPORTANT, 'Nothing', 'No text'];
  const toggle = (option: string) => {
    if (values.includes(option)) return onChange(values.filter((value) => value !== option));
    if (exclusiveValues.includes(option)) return onChange([option]);
    const combinableValues = values.filter((value) => !exclusiveValues.includes(value));
    if (max && combinableValues.length >= max) return;
    onChange([...combinableValues, option]);
  };
  return <div><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-stone-700">{label}</p>{max && <p className="text-[10px] text-stone-400">choose up to {max}</p>}</div><div className="mt-2 flex flex-wrap gap-2">{options.map((option) => { const active = values.includes(option); return <button key={option} type="button" onClick={() => toggle(option)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium ${active ? 'border-stone-800 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600'}`}>{active && <Check className="h-3 w-3" />}{option}</button>; })}</div>{values.includes(OTHER) && <input autoFocus value={customValue} onChange={(event) => onCustomChange(event.target.value)} placeholder={`Enter another ${label.toLowerCase()}…`} className="mt-3 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm" />}</div>;
}

export const characterModeConventions = { NOT_IMPORTANT, LET_LAB_DECIDE };
