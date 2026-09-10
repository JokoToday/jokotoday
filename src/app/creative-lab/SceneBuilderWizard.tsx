import { useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Palette, Plus, X } from 'lucide-react';
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
  type SceneAnswers,
  type SceneFieldKey,
} from './creativeLabModel';
import { getKnownCharacters, type KnownCharacterRecord } from './knownCharacterRegistry';
import {
  activityLibrary,
  makeLibrarySelection,
  makeSceneLibraryDirection,
  settingLibrary,
  type SceneAssemblyDraft,
  type SceneLibrarySelection,
  type SceneLibrarySelections,
  type SharedScenePreview,
  type SharedSceneTemplate,
  type SharedSceneVariant,
} from './sharedSceneLibraries';

interface Props {
  onClose: () => void;
  onCreate: (draft: SceneAssemblyDraft) => void;
}

const NEW_PERSON = 'New person…';
const personDirectionFields: SceneFieldKey[] = [
  'gender',
  'ageRange',
  'ethnicBackground',
  'profession',
  'personality',
  'bodySilhouette',
  'signatureIrregularity',
];
const activityFields: SceneFieldKey[] = ['action', 'interaction'];
const settingFields: SceneFieldKey[] = ['country', 'city', 'place', 'setting'];

function supportsSharedActivities(subjectType: string) {
  return subjectType === 'Person' || subjectType === 'Jokomi';
}

export function SceneBuilderWizard({ onClose, onCreate }: Props) {
  const [step, setStep] = useState(0);
  const [scene, setScene] = useState<SceneAnswers>({ ...emptyScene });
  const [styleProfile, setStyleProfile] = useState('');
  const [knownCharacters] = useState(() => getKnownCharacters());
  const [librarySelections, setLibrarySelections] = useState<SceneLibrarySelections>({});
  const [customValues, setCustomValues] = useState<Partial<Record<SceneFieldKey | 'styleProfile', string>>>({});

  const setField = (key: SceneFieldKey, value: string) => {
    setScene((current) => {
      const next = { ...current, [key]: value };
      if (key === 'subjectType') {
        next.subjectName = '';
        if (!supportsSharedActivities(value)) activityFields.forEach((fieldKey) => { next[fieldKey] = ''; });
      }
      return next;
    });

    if (key === 'subjectType') {
      setCustomValues((current) => ({ ...current, subjectName: '', subjectType: value === OTHER ? current.subjectType : '' }));
      setStyleProfile('');
      if (!supportsSharedActivities(value)) {
        setLibrarySelections((current) => {
          const next = { ...current };
          delete next.activity;
          return next;
        });
      }
      return;
    }

    if (value !== OTHER) setCustomValues((current) => ({ ...current, [key]: '' }));
  };

  const applyLibraryVariant = (template: SharedSceneTemplate, variant: SharedSceneVariant) => {
    const ownedFields = template.kind === 'activity' ? activityFields : settingFields;
    setScene((current) => {
      const next = { ...current };
      ownedFields.forEach((key) => { next[key] = ''; });
      return { ...next, ...variant.scenePatch };
    });
    setLibrarySelections((current) => ({ ...current, [template.kind]: makeLibrarySelection(template, variant) }));
  };

  const clearLibrarySelection = (kind: 'activity' | 'setting') => {
    const ownedFields = kind === 'activity' ? activityFields : settingFields;
    setScene((current) => {
      const next = { ...current };
      ownedFields.forEach((key) => { next[key] = ''; });
      return next;
    });
    setLibrarySelections((current) => {
      const next = { ...current };
      delete next[kind];
      return next;
    });
  };

  const resolvedScene = { ...scene };
  (Object.keys(resolvedScene) as SceneFieldKey[]).forEach((key) => {
    resolvedScene[key] = scene[key] === OTHER ? (customValues[key] ?? '').trim() : scene[key];
  });

  if (scene.subjectName === NEW_PERSON) {
    resolvedScene.subjectName = (customValues.subjectName ?? '').trim();
  }

  const resolvedStyle = styleProfile === OTHER ? (customValues.styleProfile ?? '').trim() : styleProfile;
  const isPerson = resolvedScene.subjectType === 'Person';
  const selectedCharacter = isPerson
    ? knownCharacters.find((character) => character.name === scene.subjectName)
    : undefined;
  const isNewPerson = isPerson && scene.subjectName === NEW_PERSON;
  const showActivityLibrary = supportsSharedActivities(resolvedScene.subjectType);
  const recommendedStyle = selectedCharacter?.spec.style.profileId ?? recommendedStyleFor(resolvedScene.subjectType);

  const effectiveScene: SceneAnswers = selectedCharacter
    ? personDirectionFields.reduce<SceneAnswers>((current, key) => ({ ...current, [key]: '' }), resolvedScene)
    : resolvedScene;

  const characterDirection = selectedCharacter
    ? `Character identity: inherit saved ${selectedCharacter.name} Character v${selectedCharacter.version} (${getStyleProfile(selectedCharacter.spec.style.profileId).title}). Do not redefine the character's core identity.`
    : '';
  const libraryDirection = makeSceneLibraryDirection(librarySelections);
  const generatedBrief = [makeSceneBrief(effectiveScene), characterDirection, libraryDirection].filter(Boolean).join(' ');

  const canContinue = (() => {
    if (step === 0) return Boolean(effectiveScene.assetType && effectiveScene.purpose);
    if (step === 1) return Boolean(effectiveScene.subjectType && effectiveScene.subjectName);
    if (step === 2) return true;
    if (step === 3) return Boolean(effectiveScene.action || effectiveScene.storyBeat || effectiveScene.focusObject || librarySelections.activity);
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

  const selectPerson = (value: string) => {
    setScene((current) => ({ ...current, subjectName: value }));
    setCustomValues((current) => ({ ...current, subjectName: '' }));
    const character = knownCharacters.find((candidate) => candidate.name === value);
    setStyleProfile(character?.spec.style.profileId ?? recommendedStyleFor('Person'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4" role="dialog" aria-modal="true" aria-label="Create a Creative Lab scene">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-stone-200 bg-stone-50 shadow-2xl">
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
            <Step title="Who or what is this about?" note="Saved characters bring their CharacterSpec with them. New people can still be defined for this scene only.">
              <div className="grid gap-5 md:grid-cols-2">
                {field('Subject type', 'subjectType', sceneOptions.subjectType, true)}
                {isPerson ? (
                  <PersonSubjectField
                    value={scene.subjectName}
                    customName={customValues.subjectName ?? ''}
                    knownCharacters={knownCharacters}
                    onChange={selectPerson}
                    onCustomNameChange={(value) => setCustomValues((current) => ({ ...current, subjectName: value }))}
                  />
                ) : (
                  field('Who / subject', 'subjectName', subjectOptionsFor(resolvedScene.subjectType), true)
                )}
              </div>

              {selectedCharacter && <InheritedCharacterCard character={selectedCharacter} />}

              {isNewPerson && (
                <div className="mt-7 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Character direction</p>
                  <p className="mt-1 text-sm leading-6 text-stone-600">This direction belongs to this scene only. Create a Character project when the person should become reusable canon.</p>
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
            <Step title="Where are we?" note="Choose an approved shared setting visually, or open the custom controls when the scene needs somewhere new.">
              <SharedVariantPicker
                title="Setting library"
                note="Settings are reusable environment templates. Pick the version whose composition feels right."
                templates={settingLibrary}
                selected={librarySelections.setting}
                onSelect={applyLibraryVariant}
                onClear={() => clearLibrarySelection('setting')}
              />
              <details className="mt-7 rounded-2xl border border-stone-200 bg-white p-5">
                <summary className="cursor-pointer text-sm font-semibold text-stone-800">+ Define or fine-tune the setting</summary>
                <p className="mt-2 text-xs leading-5 text-stone-500">Manual fields can refine a shared setting or define a new place without a library template.</p>
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {field('Country', 'country', sceneOptions.country)}
                  {field('City', 'city', sceneOptions.city)}
                  {field('Specific place', 'place', sceneOptions.place)}
                  {field('Setting type', 'setting', sceneOptions.setting)}
                </div>
              </details>
            </Step>
          )}

          {step === 3 && (
            <Step title="What is happening?" note={showActivityLibrary ? "Choose an approved shared activity visually, then add the story detail that makes this particular scene meaningful." : "Define the action and story detail for this scene. Shared body/activity templates are currently available for people and Jokomi."}>
              {showActivityLibrary && (
                <SharedVariantPicker
                  title="Activity library"
                  note="Activities are identity-neutral pose/action templates. The selected character keeps their own proportions and personality."
                  templates={activityLibrary}
                  selected={librarySelections.activity}
                  onSelect={applyLibraryVariant}
                  onClear={() => clearLibrarySelection('activity')}
                />
              )}

              <div className={`${showActivityLibrary ? 'mt-7' : ''} grid gap-5 md:grid-cols-3`}>
                {!showActivityLibrary && field('Action', 'action', sceneOptions.action)}
                {field('Object / focus', 'focusObject', sceneOptions.focusObject)}
                {!showActivityLibrary && field('Interaction', 'interaction', sceneOptions.interaction)}
                {field('Story beat / moment', 'storyBeat', sceneOptions.storyBeat)}
                {field('Mood', 'mood', sceneOptions.mood)}
              </div>

              {showActivityLibrary && (
                <details className="mt-7 rounded-2xl border border-stone-200 bg-white p-5">
                  <summary className="cursor-pointer text-sm font-semibold text-stone-800">+ Define or fine-tune the activity</summary>
                  <p className="mt-2 text-xs leading-5 text-stone-500">Manual action and interaction can refine a shared activity or define a new one.</p>
                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    {field('Action', 'action', sceneOptions.action)}
                    {field('Interaction', 'interaction', sceneOptions.interaction)}
                  </div>
                </details>
              )}

              <details className="mt-4 rounded-2xl border border-stone-200 bg-white p-5">
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
            <Step title="How should it look?" note="Style is mandatory. A saved character's governing style is selected automatically, but can still be changed for this scene.">
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
                      {id === recommendedStyle && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{selectedCharacter ? 'Inherited' : 'Recommended'}</span>}
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
                <h3 className="mt-2 font-serif text-xl text-stone-900">{makeProjectTitle(effectiveScene)}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">{generatedBrief}</p>
                <p className="mt-4 text-xs font-semibold text-stone-700">Style: {resolvedStyle ? getStyleProfile(resolvedStyle).title : '—'}</p>
                {(librarySelections.activity || librarySelections.setting) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {librarySelections.activity && <AssemblyChip selection={librarySelections.activity} />}
                    {librarySelections.setting && <AssemblyChip selection={librarySelections.setting} />}
                  </div>
                )}
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
            <button type="button" disabled={!canContinue} onClick={() => onCreate({ scene: effectiveScene, styleProfile: resolvedStyle, brief: generatedBrief, librarySelections })} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white disabled:bg-stone-300"><Plus className="h-4 w-4" />Create scene</button>
          )}
        </div>
      </div>
    </div>
  );
}

function SharedVariantPicker({ title, note, templates, selected, onSelect, onClear }: { title: string; note: string; templates: SharedSceneTemplate[]; selected?: SceneLibrarySelection; onSelect: (template: SharedSceneTemplate, variant: SharedSceneVariant) => void; onClear: () => void }) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Shared visual building blocks</p>
          <h3 className="mt-1 font-serif text-2xl text-stone-950">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">{note}</p>
        </div>
        {selected && <button type="button" onClick={onClear} className="text-xs font-semibold text-stone-500 hover:text-stone-900">Clear selection</button>}
      </div>

      <div className="mt-6 space-y-7">
        {templates.map((template) => (
          <div key={template.id}>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-stone-800">{template.name}</p>
                <p className="mt-1 text-xs text-stone-500">{template.description}</p>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">{template.category}</p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {template.variants.map((variant) => {
                const active = selected?.variantId === variant.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelect(template, variant)}
                    className={`group overflow-hidden rounded-2xl border text-left transition-all ${active ? 'border-stone-900 bg-stone-50 shadow-md' : 'border-stone-200 bg-white hover:border-stone-400 hover:shadow-sm'}`}
                  >
                    <VariantThumbnail preview={template.preview} version={variant.version} active={active} />
                    <div className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-stone-800">v{variant.version} · {variant.label}</p>
                        {active && <span className="inline-flex items-center gap-1 rounded-full bg-stone-900 px-2 py-1 text-[9px] font-semibold text-white"><Check className="h-2.5 w-2.5" />Selected</span>}
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-stone-500">{variant.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VariantThumbnail({ preview, version, active }: { preview: SharedScenePreview; version: number; active: boolean }) {
  const strokeClass = active ? 'text-stone-950' : 'text-stone-600';
  const offset = version === 2 ? 8 : version === 3 ? -8 : 0;
  return (
    <div className={`relative aspect-[16/9] overflow-hidden border-b border-stone-200 ${active ? 'bg-amber-50' : 'bg-stone-50'}`}>
      <svg viewBox="0 0 160 90" className={`h-full w-full ${strokeClass}`} aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
          {preview === 'sofa' && (
            <>
              <path d="M24 58 C25 49 31 46 40 46 H120 C129 46 135 49 136 58 V70 H24 Z" />
              <path d="M31 70 V77 M129 70 V77 M43 46 V67 M117 46 V67" opacity=".55" />
              <circle cx={80 + offset} cy={25 + (version === 3 ? 4 : 0)} r="7" />
              <path d={version === 1 ? `M${80 + offset} 32 V50` : version === 2 ? `M${80 + offset} 32 L${91 + offset} 47` : `M${80 + offset} 32 L${70 + offset} 49`} />
              <path d={version === 3 ? `M${70 + offset} 49 L${56 + offset} 60 M${70 + offset} 49 L${84 + offset} 61` : `M${80 + offset} 50 L${69 + offset} 62 M${80 + offset} 50 L${92 + offset} 62`} />
            </>
          )}
          {preview === 'walk' && (
            <>
              <path d="M25 70 H136" opacity=".35" />
              <circle cx={80 + offset} cy="22" r="7" />
              <path d={`M${80 + offset} 29 L${80 + offset + (version === 2 ? 7 : version === 3 ? -5 : 0)} 50`} />
              <path d={version === 1 ? `M${80 + offset} 35 L${68 + offset} 46 M${80 + offset} 35 L${92 + offset} 45` : `M${80 + offset} 35 L${66 + offset} 40 M${80 + offset} 35 L${95 + offset} 49`} />
              <path d={version === 3 ? `M${75 + offset} 50 L${60 + offset} 69 M${75 + offset} 50 L${95 + offset} 65` : `M${80 + offset} 50 L${65 + offset} 69 M${80 + offset} 50 L${98 + offset} 66`} />
            </>
          )}
          {preview === 'look' && (
            <>
              <circle cx={68 + offset} cy={24 + (version === 2 ? 12 : 0)} r="7" />
              <path d={version === 2 ? `M${68 + offset} 31 L${78 + offset} 52 L${65 + offset} 66 M${78 + offset} 52 L${92 + offset} 66` : `M${68 + offset} 31 L${78 + offset} 51 M${78 + offset} 51 L${70 + offset} 70 M${78 + offset} 51 L${91 + offset} 70`} />
              <circle cx="116" cy="50" r={version === 3 ? 10 : 4} />
              {version === 3 && <path d="M108 57 L99 67" />}
              <path d="M100 70 C108 60 121 60 130 70" opacity=".45" />
            </>
          )}
          {preview === 'market' && (
            <>
              <path d="M18 70 H142" opacity=".35" />
              <path d={version === 2 ? 'M20 37 H92 L84 48 H28 Z M104 45 H142' : version === 3 ? 'M24 42 H74 L67 50 H31 Z M106 43 H139' : 'M15 35 H62 L56 45 H22 Z M98 35 H145 L138 45 H105 Z'} />
              <path d="M28 48 V70 M80 48 V70 M110 45 V70 M136 45 V70" opacity=".65" />
              <path d={version === 3 ? 'M78 70 C90 54 101 53 107 70' : 'M69 70 C76 55 88 55 95 70'} opacity=".6" />
            </>
          )}
          {preview === 'temple' && (
            <>
              <path d="M31 70 H132" opacity=".35" />
              <path d={version === 2 ? 'M50 70 L80 34 L110 70 M57 62 H103 M63 54 H97 M69 46 H91' : 'M46 58 H114 L102 47 H58 Z M65 47 L80 25 L95 47 M80 25 V16'} />
              {version === 3 && <path d="M28 70 C45 58 55 58 72 70 M110 70 C124 58 132 58 143 70" opacity=".55" />}
            </>
          )}
          {preview === 'bakery' && (
            <>
              {version === 1 && <><rect x="36" y="23" width="88" height="49" rx="2" /><path d="M68 72 V46 H94 V72 M45 34 H115" /></>}
              {version === 2 && <><path d="M23 61 H137 V72 H23 Z M36 47 H124 V61 M48 47 V35 H112 V47" /><circle cx="62" cy="42" r="4" /><circle cx="80" cy="42" r="4" /><circle cx="98" cy="42" r="4" /></>}
              {version === 3 && <><path d="M20 70 H140" opacity=".35" /><path d="M44 70 C48 53 57 45 69 70 M91 70 C96 50 110 49 118 70" /><rect x="67" y="28" width="35" height="31" rx="2" opacity=".7" /></>}
            </>
          )}
        </g>
      </svg>
      <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-1 text-[9px] font-semibold text-stone-600 shadow-sm">v{version}</span>
    </div>
  );
}

function AssemblyChip({ selection }: { selection: SceneLibrarySelection }) {
  return <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[10px] font-semibold text-stone-600">{selection.kind === 'activity' ? 'Activity' : 'Setting'} · {selection.templateName} v{selection.version}</span>;
}

function PersonSubjectField({ value, customName, knownCharacters, onChange, onCustomNameChange }: { value: string; customName: string; knownCharacters: KnownCharacterRecord[]; onChange: (value: string) => void; onCustomNameChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-stone-700">Who / subject <span className="ml-1 text-stone-400">*</span></span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-800 outline-none focus:border-stone-500">
        <option value="">Choose…</option>
        {knownCharacters.length > 0 && (
          <optgroup label="Saved characters">
            {knownCharacters.map((character) => <option key={character.id} value={character.name}>{character.name}</option>)}
          </optgroup>
        )}
        <option value={NEW_PERSON}>{NEW_PERSON}</option>
      </select>
      {knownCharacters.length === 0 && <p className="mt-2 text-[11px] leading-5 text-stone-400">No saved characters in this prototype session yet.</p>}
      {value === NEW_PERSON && <input autoFocus value={customName} onChange={(event) => onCustomNameChange(event.target.value)} placeholder="Name this person…" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-800 outline-none focus:border-stone-500" />}
    </label>
  );
}

function InheritedCharacterCard({ character }: { character: KnownCharacterRecord }) {
  const spec = character.spec;
  const visualTraits = [...spec.visualIdentity.silhouettes, ...spec.visualIdentity.signatureTraits].slice(0, 4);
  const personality = spec.character.personality.slice(0, 3);

  return (
    <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Using saved character</p>
          <h3 className="mt-2 font-serif text-2xl text-stone-950">{character.name}</h3>
          <p className="mt-1 text-xs font-semibold text-stone-600">Character v{character.version} · {getStyleProfile(spec.style.profileId).title}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-emerald-700 shadow-sm">CharacterSpec inherited</span>
      </div>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">This scene inherits the saved identity, proportions, personality and signature traits. Scene Mode now only defines what {character.name} is doing here.</p>
      {(personality.length > 0 || visualTraits.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {[...personality, ...visualTraits].map((trait) => <span key={trait} className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[11px] text-stone-600">{trait}</span>)}
        </div>
      )}
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
  const hasExternalValue = Boolean(value && value !== OTHER && !options.includes(value));
  return (
    <label className="block">
      <span className="text-xs font-semibold text-stone-700">{label}{required && <span className="ml-1 text-stone-400">*</span>}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-800 outline-none focus:border-stone-500">
        <option value="">Choose…</option>
        {hasExternalValue && <option value={value}>{value}</option>}
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {value === OTHER && <input autoFocus value={customValue} onChange={(event) => onCustomChange(event.target.value)} placeholder={`Enter ${label.toLowerCase()}…`} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-stone-800 outline-none focus:border-stone-500" />}
    </label>
  );
}
