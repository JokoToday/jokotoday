import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Palette, Plus, X } from 'lucide-react';
import {
  OTHER,
  emptyScene,
  getStyleProfile,
  makeProjectTitle,
  makeSceneBrief,
  recommendedStyleFor,
  sceneOptions,
  styleProfiles,
  subjectOptionsFor,
  type ProjectDraft,
  type SceneAnswers,
  type SceneFieldKey,
} from './creativeLabModel';

interface Props {
  onClose: () => void;
  onCreate: (draft: ProjectDraft) => void;
}

export function SceneBuilderWizard({ onClose, onCreate }: Props) {
  const [step, setStep] = useState(0);
  const [scene, setScene] = useState<SceneAnswers>({ ...emptyScene });
  const [styleProfile, setStyleProfile] = useState('');
  const [customValues, setCustomValues] = useState<Partial<Record<SceneFieldKey | 'styleProfile', string>>>({});

  const setField = (key: SceneFieldKey, value: string) => {
    setScene((current) => ({ ...current, [key]: value }));
    if (value !== OTHER) setCustomValues((current) => ({ ...current, [key]: '' }));
  };

  const resolvedScene = { ...scene };
  (Object.keys(resolvedScene) as SceneFieldKey[]).forEach((key) => {
    resolvedScene[key] = scene[key] === OTHER ? (customValues[key] ?? '').trim() : scene[key];
  });
  const resolvedStyle = styleProfile === OTHER ? (customValues.styleProfile ?? '').trim() : styleProfile;
  const recommendedStyle = recommendedStyleFor(resolvedScene.subjectType);
  const isPerson = resolvedScene.subjectType === 'Person';

  const canContinue = (() => {
    if (step === 0) return Boolean(resolvedScene.assetType && resolvedScene.purpose);
    if (step === 1) return Boolean(resolvedScene.subjectType && resolvedScene.subjectName);
    if (step === 2) return true;
    if (step === 3) return Boolean(resolvedScene.action || resolvedScene.storyBeat || resolvedScene.focusObject);
    return Boolean(resolvedStyle);
  })();

  const next = () => {
    if (!canContinue) return;
    if (step === 1 && !styleProfile) setStyleProfile(recommendedStyle);
    setStep((current) => Math.min(4, current + 1));
  };

  const field = (label: string, key: SceneFieldKey, options: string[], required = false) => (
    <ChoiceField
      label={label}
      value={scene[key]}
      customValue={customValues[key] ?? ''}
      options={options}
      required={required}
      onChange={(value) => setField(key, value)}
      onCustomChange={(value) => setCustomValues((current) => ({ ...current, [key]: value }))}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4" role="dialog" aria-modal="true" aria-label="Create a Creative Lab scene">
      <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-stone-200 bg-stone-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Scene Builder</p>
            <p className="mt-1 text-sm font-semibold text-stone-800">Step {step + 1} of 5</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-stone-500 hover:bg-stone-100" aria-label="Close Scene Builder">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 sm:p-8">
          <Progress step={step} />

          {step === 0 && (
            <Step title="What are we making?" note="Choose rather than prompt. Every structured field includes Other… when you need it.">
              <div className="grid gap-5 md:grid-cols-2">
                {field('Output', 'assetType', sceneOptions.assetType, true)}
                {field('Publication use', 'purpose', sceneOptions.purpose, true)}
              </div>
            </Step>
          )}

          {step === 1 && (
            <Step title="Who or what is this about?" note="Person projects reveal extra character direction from the Curious Community style system.">
              <div className="grid gap-5 md:grid-cols-2">
                {field('Subject type', 'subjectType', sceneOptions.subjectType, true)}
                {field('Who / subject', 'subjectName', subjectOptionsFor(resolvedScene.subjectType), true)}
              </div>

              {isPerson && (
                <div className="mt-7 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Character direction</p>
                  <p className="mt-1 text-sm leading-6 text-stone-600">Background informs the character; it must never become the caricature.</p>
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    {field('Gender / presentation', 'gender', sceneOptions.gender)}
                    {field('Age range', 'ageRange', sceneOptions.ageRange)}
                    {field('Ethnic / cultural background', 'ethnicBackground', sceneOptions.ethnicBackground)}
                    {field('Profession / role', 'profession', sceneOptions.profession)}
                    {field('Personality', 'personality', sceneOptions.personality)}
                    {field('Body / silhouette', 'bodySilhouette', sceneOptions.bodySilhouette)}
                    {field('Signature irregularity', 'signatureIrregularity', sceneOptions.signatureIrregularity)}
                  </div>
                </div>
              )}
            </Step>
          )}

          {step === 2 && (
            <Step title="Where are we?" note="Start broad, then get specific. Location is optional when it does not matter to the scene.">
              <div className="grid gap-5 md:grid-cols-2">
                {field('Country', 'country', sceneOptions.country)}
                {field('City', 'city', sceneOptions.city)}
                {field('Specific place', 'place', sceneOptions.place)}
                {field('Setting type', 'setting', sceneOptions.setting)}
              </div>
            </Step>
          )}

          {step === 3 && (
            <Step title="What is happening?" note="Direct the moment. Creative Lab writes the brief behind the scenes.">
              <div className="grid gap-5 md:grid-cols-2">
                {field('Action', 'action', sceneOptions.action)}
                {field('Object / focus', 'focusObject', sceneOptions.focusObject)}
                {field('Interaction', 'interaction', sceneOptions.interaction)}
                {field('Story beat / moment', 'storyBeat', sceneOptions.storyBeat)}
                {field('Mood', 'mood', sceneOptions.mood)}
              </div>
              <details className="mt-7 rounded-2xl border border-stone-200 bg-white p-5">
                <summary className="cursor-pointer text-sm font-semibold text-stone-800">+ Add more atmosphere</summary>
                <div className="mt-5 grid gap-5 md:grid-cols-3">
                  {field('Energy', 'energy', sceneOptions.energy)}
                  {field('Time of day', 'timeOfDay', sceneOptions.timeOfDay)}
                  {field('Weather / atmosphere', 'weather', sceneOptions.weather)}
                </div>
              </details>
            </Step>
          )}

          {step === 4 && (
            <Step title="How should it look?" note="Style is mandatory. Composition detail is optional.">
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(styleProfiles).map(([id, style]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStyleProfile(id)}
                    className={`rounded-2xl border p-5 text-left transition-all ${styleProfile === id ? 'border-stone-800 bg-white shadow-md' : 'border-stone-200 bg-white hover:border-stone-400'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Palette className="h-5 w-5 text-stone-500" />
                      {id === recommendedStyle && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Recommended</span>}
                    </div>
                    <p className="mt-4 font-semibold text-stone-800">{style.title}</p>
                    <p className="mt-2 text-xs leading-5 text-stone-500">{style.description}</p>
                  </button>
                ))}
                <button type="button" onClick={() => setStyleProfile(OTHER)} className={`rounded-2xl border p-5 text-left ${styleProfile === OTHER ? 'border-stone-800 bg-white shadow-md' : 'border-stone-200 bg-white'}`}>
                  <Plus className="h-5 w-5 text-stone-500" />
                  <p className="mt-4 font-semibold text-stone-800">Other…</p>
                </button>
              </div>

              {styleProfile === OTHER && (
                <input autoFocus value={customValues.styleProfile ?? ''} onChange={(event) => setCustomValues((current) => ({ ...current, styleProfile: event.target.value }))} placeholder="Name or describe the visual language…" className="mt-3 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm" />
              )}

              <details className="mt-7 rounded-2xl border border-stone-200 bg-white p-5">
                <summary className="cursor-pointer text-sm font-semibold text-stone-800">+ Add composition detail</summary>
                <div className="mt-5 grid gap-5 md:grid-cols-3">
                  {field('Framing', 'framing', sceneOptions.framing)}
                  {field('Viewpoint', 'viewpoint', sceneOptions.viewpoint)}
                  {field('Composition', 'composition', sceneOptions.composition)}
                </div>
              </details>

              <div className="mt-7 rounded-2xl border border-stone-300 bg-white p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Generated brief</p>
                <h3 className="mt-2 font-serif text-xl text-stone-900">{makeProjectTitle(resolvedScene)}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">{makeSceneBrief(resolvedScene)}</p>
                <p className="mt-4 text-xs font-semibold text-stone-700">Style: {resolvedStyle ? getStyleProfile(resolvedStyle).title : '—'}</p>
              </div>
            </Step>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-stone-200 bg-white px-5 py-4 sm:px-7">
          <button type="button" onClick={step === 0 ? onClose : () => setStep((current) => Math.max(0, current - 1))} className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2.5 text-xs font-semibold text-stone-700">
            {step > 0 && <ChevronLeft className="h-4 w-4" />}{step === 0 ? 'Cancel' : 'Back'}
          </button>
          {step < 4 ? (
            <button type="button" disabled={!canContinue} onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white disabled:bg-stone-300">Continue<ChevronRight className="h-4 w-4" /></button>
          ) : (
            <button type="button" disabled={!canContinue} onClick={() => onCreate({ scene: resolvedScene, styleProfile: resolvedStyle })} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white disabled:bg-stone-300"><Plus className="h-4 w-4" />Create scene</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="mb-8 grid grid-cols-5 gap-2">
      {['What', 'Who', 'Where', 'Moment', 'Look'].map((label, index) => (
        <div key={label}>
          <div className={`h-1.5 rounded-full ${index <= step ? 'bg-stone-800' : 'bg-stone-200'}`} />
          <p className="mt-2 text-[10px] font-semibold text-stone-600">{label}</p>
        </div>
      ))}
    </div>
  );
}

function Step({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return <section><h2 className="font-serif text-3xl text-stone-950">{title}</h2><p className="mt-2 text-sm leading-6 text-stone-500">{note}</p><div className="mt-6">{children}</div></section>;
}

function ChoiceField({ label, value, customValue, options, onChange, onCustomChange, required = false }: { label: string; value: string; customValue: string; options: string[]; onChange: (value: string) => void; onCustomChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-stone-700">{label}{required && <span className="ml-1 text-stone-400">*</span>}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-800 outline-none focus:border-stone-500">
        <option value="">Choose…</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {value === OTHER && <input autoFocus value={customValue} onChange={(event) => onCustomChange(event.target.value)} placeholder={`Enter ${label.toLowerCase()}…`} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-800 outline-none focus:border-stone-500" />}
    </label>
  );
}
