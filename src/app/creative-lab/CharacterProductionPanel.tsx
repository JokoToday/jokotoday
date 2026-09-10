import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { getStyleProfile, type ProjectCard } from './creativeLabModel';
import {
  defaultReferenceForAsset,
  generateCharacterCandidates,
  readCharacterProductionState,
  referenceFidelities,
  referenceFidelityLabels,
  referencePreserveLabels,
  referencePreserveOptions,
  referenceRoleLabels,
  referenceRoles,
  writeCharacterProductionState,
  type CharacterProjectReference,
  type CharacterProductionState,
  type CharacterReferencePreserve,
} from './characterGeneration';
import {
  deletePrototypeLibraryAsset,
  listPrototypeLibraryAssets,
  savePrototypeLibraryAsset,
  type PrototypeLibraryAsset,
} from './creativeLabLocalLibrary';

interface CharacterProductionPanelProps {
  project: ProjectCard;
}

export function CharacterProductionPanel({ project }: CharacterProductionPanelProps) {
  const character = project.character;
  const [state, setState] = useState<CharacterProductionState>(() => readCharacterProductionState(project.id));
  const [assets, setAssets] = useState<PrototypeLibraryAsset[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const reloadAssets = async () => {
    try {
      setAssets(await listPrototypeLibraryAssets());
      setError('');
    } catch {
      setError('Browser Library storage is unavailable.');
    } finally {
      setLoadingLibrary(false);
    }
  };

  useEffect(() => {
    void reloadAssets();
  }, []);

  useEffect(() => {
    writeCharacterProductionState(project.id, state);
  }, [project.id, state]);

  const referenceAssets = useMemo(() => state.references
    .map((reference) => ({
      reference,
      asset: assets.find((asset) => asset.id === reference.assetId),
    }))
    .filter((item): item is { reference: CharacterProjectReference; asset: PrototypeLibraryAsset } => Boolean(item.asset)), [assets, state.references]);

  const candidateAssets = useMemo(() => state.candidateAssetIds
    .map((id) => assets.find((asset) => asset.id === id))
    .filter((asset): asset is PrototypeLibraryAsset => Boolean(asset)), [assets, state.candidateAssetIds]);

  if (!character) return null;

  const updateReference = (assetId: string, patch: Partial<CharacterProjectReference>) => {
    setState((current) => ({
      ...current,
      references: current.references.map((reference) => reference.assetId === assetId ? { ...reference, ...patch } : reference),
    }));
  };

  const addReference = (asset: PrototypeLibraryAsset) => {
    setState((current) => {
      if (current.references.some((reference) => reference.assetId === asset.id) || current.references.length >= 4) return current;
      return { ...current, references: [...current.references, defaultReferenceForAsset(asset)] };
    });
    setPickerOpen(false);
  };

  const removeReference = (assetId: string) => {
    setState((current) => ({ ...current, references: current.references.filter((reference) => reference.assetId !== assetId) }));
  };

  const generate = async () => {
    setGenerating(true);
    setError('');
    setMessage('');
    try {
      const candidates = await generateCharacterCandidates({
        projectId: project.id,
        character,
        styleProfileId: project.styleProfile,
        references: state.references,
        assets,
        revisionNote: state.revisionNote,
      });
      setState((current) => ({ ...current, candidateAssetIds: candidates.map((candidate) => candidate.id) }));
      await reloadAssets();
      setMessage(`${candidates.length} new character candidates are ready for review.`);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Character Generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const approveCandidate = async (asset: PrototypeLibraryAsset) => {
    try {
      await savePrototypeLibraryAsset({
        ...asset,
        role: 'Character master',
        generation: asset.generation ? { ...asset.generation, status: 'approved' } : undefined,
      });
      await reloadAssets();
      setMessage(`${asset.name} is now marked as the Character master in this browser Library.`);
    } catch {
      setError('Could not approve that candidate.');
    }
  };

  const useCandidateAsReference = (asset: PrototypeLibraryAsset, revise = false) => {
    setState((current) => {
      const alreadyAttached = current.references.some((reference) => reference.assetId === asset.id);
      const references = alreadyAttached || current.references.length >= 4
        ? current.references
        : [...current.references, {
          assetId: asset.id,
          role: 'character_identity' as const,
          fidelity: 'very_close' as const,
          preserve: ['face', 'hair', 'silhouette', 'overall_feel'] as CharacterReferencePreserve[],
        }];
      return {
        ...current,
        references,
        revisionNote: revise
          ? `Refine from ${asset.name}. Preserve the character identity while applying the revision below.`
          : current.revisionNote,
      };
    });
    setMessage(revise ? 'Candidate attached as a reference. Add your revision note, then generate again.' : 'Candidate attached as a character identity reference.');
  };

  const discardCandidate = async (asset: PrototypeLibraryAsset) => {
    if (asset.generation?.status === 'approved') return;
    try {
      await deletePrototypeLibraryAsset(asset.id);
      setState((current) => ({
        ...current,
        candidateAssetIds: current.candidateAssetIds.filter((id) => id !== asset.id),
        references: current.references.filter((reference) => reference.assetId !== asset.id),
      }));
      await reloadAssets();
    } catch {
      setError('Could not discard that candidate.');
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-stone-200 bg-stone-50 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Character production</p>
          <h3 className="mt-1 font-serif text-2xl text-stone-950">Source Material → Generate → Review</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Build from the CharacterSpec, {getStyleProfile(project.styleProfile).title}, and reusable Library references. Reference images guide specific parts of the result; they do not replace the character contract or house style.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={state.references.length >= 4}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ImagePlus className="h-4 w-4" />Add from Library
        </button>
      </div>

      {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{error}</p>}
      {message && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700">{message}</p>}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-stone-800">Source Material</p>
            <p className="mt-1 text-[11px] text-stone-500">Up to 4 Library images. Every image gets a contextual role, fidelity and preserve contract.</p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-stone-500">{state.references.length}/4</span>
        </div>

        {referenceAssets.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-8 text-center">
            <ImagePlus className="mx-auto h-6 w-6 text-stone-300" />
            <p className="mt-3 text-sm font-semibold text-stone-700">No reference image attached yet</p>
            <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-stone-500">You can generate from the CharacterSpec alone, or add an Emma/character master, style drawing, pose, clothing or prop reference from the Library.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {referenceAssets.map(({ asset, reference }) => (
              <ReferenceEditor
                key={asset.id}
                asset={asset}
                reference={reference}
                onChange={(patch) => updateReference(asset.id, patch)}
                onRemove={() => removeReference(asset.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-7 rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="block flex-1">
            <span className="text-xs font-semibold text-stone-700">Revision / generation direction <span className="font-normal text-stone-400">optional</span></span>
            <textarea
              value={state.revisionNote}
              onChange={(event) => setState((current) => ({ ...current, revisionNote: event.target.value }))}
              rows={3}
              placeholder="e.g. Keep Emma's face and silhouette, but make the stance more relaxed."
              className="mt-2 w-full resize-none rounded-xl border border-stone-300 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-stone-500"
            />
          </label>
          <button
            type="button"
            disabled={generating || loadingLibrary}
            onClick={() => void generate()}
            className="inline-flex min-w-56 items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white disabled:bg-stone-300"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Generating…' : 'Generate 3 candidates'}
          </button>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-stone-400">Candidate generation is server-side. Browser references are sent only for this generation request; API credentials never enter the browser.</p>
      </div>

      <div className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-stone-800">Candidate Review</p>
            <p className="mt-1 text-[11px] text-stone-500">Generated candidates stay in the browser Library until production persistence is approved.</p>
          </div>
          {candidateAssets.length > 0 && <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Latest batch</span>}
        </div>

        {candidateAssets.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-5 text-xs leading-5 text-stone-500">No generated candidates yet.</div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {candidateAssets.map((asset) => (
              <CandidateCard
                key={asset.id}
                asset={asset}
                onApprove={() => void approveCandidate(asset)}
                onUseReference={() => useCandidateAsReference(asset)}
                onRevise={() => useCandidateAsReference(asset, true)}
                onDiscard={() => void discardCandidate(asset)}
              />
            ))}
          </div>
        )}
      </div>

      {pickerOpen && (
        <LibraryReferencePicker
          assets={assets}
          characterName={character.identity.name}
          selectedIds={state.references.map((reference) => reference.assetId)}
          onSelect={addReference}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </section>
  );
}

function ReferenceEditor({ asset, reference, onChange, onRemove }: {
  asset: PrototypeLibraryAsset;
  reference: CharacterProjectReference;
  onChange: (patch: Partial<CharacterProjectReference>) => void;
  onRemove: () => void;
}) {
  const togglePreserve = (value: CharacterReferencePreserve) => {
    const next = reference.preserve.includes(value)
      ? reference.preserve.filter((item) => item !== value)
      : [...reference.preserve, value];
    onChange({ preserve: next });
  };

  return (
    <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 lg:grid-cols-[160px_minmax(0,1fr)]">
      <AssetImage asset={asset} className="aspect-square w-full rounded-xl border border-stone-200 bg-stone-50 object-contain" />
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-stone-800">{asset.name}</p>
            <p className="mt-1 text-[11px] text-stone-500">Library: {asset.role}{asset.subjectName ? ` · ${asset.subjectName}` : ''}</p>
          </div>
          <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100" aria-label={`Remove ${asset.name} from source material`}><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-[11px] font-semibold text-stone-600">Use this image for</span>
            <select value={reference.role} onChange={(event) => onChange({ role: event.target.value as CharacterProjectReference['role'] })} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs">
              {referenceRoles.map((role) => <option key={role} value={role}>{referenceRoleLabels[role]}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-stone-600">Fidelity</span>
            <select value={reference.fidelity} onChange={(event) => onChange({ fidelity: event.target.value as CharacterProjectReference['fidelity'] })} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs">
              {referenceFidelities.map((fidelity) => <option key={fidelity} value={fidelity}>{referenceFidelityLabels[fidelity]}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-semibold text-stone-600">Preserve</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {referencePreserveOptions.map((value) => {
              const active = reference.preserve.includes(value);
              return (
                <button key={value} type="button" onClick={() => togglePreserve(value)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold ${active ? 'border-stone-800 bg-stone-900 text-white' : 'border-stone-300 bg-white text-stone-600'}`}>
                  {active && <Check className="h-3 w-3" />}{referencePreserveLabels[value]}
                </button>
              );
            })}
          </div>
        </div>

        <input value={reference.notes ?? ''} onChange={(event) => onChange({ notes: event.target.value })} placeholder="Reference-specific note…" className="mt-4 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-xs outline-none focus:border-stone-500" />
      </div>
    </div>
  );
}

function CandidateCard({ asset, onApprove, onUseReference, onRevise, onDiscard }: {
  asset: PrototypeLibraryAsset;
  onApprove: () => void;
  onUseReference: () => void;
  onRevise: () => void;
  onDiscard: () => void;
}) {
  const approved = asset.generation?.status === 'approved' || asset.role === 'Character master';
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <AssetImage asset={asset} className="aspect-[2/3] w-full bg-stone-50 object-contain" />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div><p className="text-xs font-semibold text-stone-800">{asset.name}</p><p className="mt-1 text-[10px] text-stone-400">{asset.generation?.model ?? 'Generated candidate'}</p></div>
          {approved && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">Master</span>}
        </div>
        <div className="mt-4 grid gap-2">
          <button type="button" disabled={approved} onClick={onApprove} className="rounded-lg bg-stone-900 px-3 py-2 text-[10px] font-semibold text-white disabled:bg-emerald-700">{approved ? 'Approved as master' : 'Approve as character master'}</button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onUseReference} className="rounded-lg border border-stone-300 px-2 py-2 text-[10px] font-semibold text-stone-600">Use as reference</button>
            <button type="button" onClick={onRevise} className="inline-flex items-center justify-center gap-1 rounded-lg border border-stone-300 px-2 py-2 text-[10px] font-semibold text-stone-600"><RefreshCw className="h-3 w-3" />Revise</button>
          </div>
          <button type="button" disabled={approved} onClick={onDiscard} className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[10px] font-semibold text-stone-400 hover:bg-stone-50 disabled:opacity-30"><Trash2 className="h-3 w-3" />Discard</button>
        </div>
      </div>
    </div>
  );
}

function LibraryReferencePicker({ assets, characterName, selectedIds, onSelect, onClose }: {
  assets: PrototypeLibraryAsset[];
  characterName: string;
  selectedIds: string[];
  onSelect: (asset: PrototypeLibraryAsset) => void;
  onClose: () => void;
}) {
  const ordered = useMemo(() => [...assets].sort((a, b) => {
    const aMatch = a.subjectName?.toLowerCase() === characterName.toLowerCase() ? 1 : 0;
    const bMatch = b.subjectName?.toLowerCase() === characterName.toLowerCase() ? 1 : 0;
    return bMatch - aMatch || b.createdAt.localeCompare(a.createdAt);
  }), [assets, characterName]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/45 p-4" role="dialog" aria-modal="true" aria-label="Choose reference from Library">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-stone-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-6">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Source Material</p><h3 className="mt-1 font-serif text-2xl text-stone-950">Choose from Library</h3></div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-stone-500 hover:bg-stone-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-sm leading-6 text-stone-600">Assets for {characterName} are shown first. A Library asset may be reused with a different contextual role in this particular generation.</p>
          {ordered.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
              <Plus className="mx-auto h-5 w-5 text-stone-300" /><p className="mt-3 text-sm font-semibold text-stone-700">The Library has no uploaded illustrations yet.</p><p className="mt-2 text-xs text-stone-500">Close this window, open Library, and use Upload illustration.</p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {ordered.map((asset) => {
                const selected = selectedIds.includes(asset.id);
                return (
                  <button key={asset.id} type="button" disabled={selected} onClick={() => onSelect(asset)} className={`overflow-hidden rounded-2xl border bg-white text-left ${selected ? 'border-emerald-300 opacity-60' : 'border-stone-200 hover:border-stone-500'}`}>
                    <AssetImage asset={asset} className="aspect-square w-full border-b border-stone-200 bg-stone-50 object-contain" />
                    <div className="p-3"><p className="truncate text-xs font-semibold text-stone-800">{asset.name}</p><p className="mt-1 text-[10px] leading-4 text-stone-500">{asset.role}{asset.subjectName ? ` · ${asset.subjectName}` : ''}</p>{selected && <p className="mt-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Already attached</p>}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssetImage({ asset, className }: { asset: PrototypeLibraryAsset; className: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(asset.blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [asset.blob]);
  return url ? <img src={url} alt={asset.name} className={className} /> : <div className={`${className} flex items-center justify-center`}><Loader2 className="h-4 w-4 animate-spin text-stone-300" /></div>;
}
