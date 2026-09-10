import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Trash2, Upload, X } from 'lucide-react';
import { styleProfiles } from './creativeLabModel';
import {
  deletePrototypeLibraryAsset,
  listPrototypeLibraryAssets,
  savePrototypeLibraryAsset,
  type PrototypeLibraryAsset,
  type PrototypeLibraryAssetKind,
  type PrototypeLibraryAssetRole,
} from './creativeLabLocalLibrary';

const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_FILE_SIZE = 20 * 1024 * 1024;

const kinds: PrototypeLibraryAssetKind[] = ['Character', 'Scene', 'Setting', 'Activity', 'Object', 'Reference'];
const roles: PrototypeLibraryAssetRole[] = [
  'Character master',
  'Character identity reference',
  'Style reference',
  'Pose / activity reference',
  'Setting reference',
  'Object / prop reference',
  'Supporting reference',
];

function defaultRoleFor(kind: PrototypeLibraryAssetKind): PrototypeLibraryAssetRole {
  if (kind === 'Character') return 'Character master';
  if (kind === 'Setting') return 'Setting reference';
  if (kind === 'Activity') return 'Pose / activity reference';
  if (kind === 'Object') return 'Object / prop reference';
  return 'Supporting reference';
}

function makeAssetId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `asset-${crypto.randomUUID()}`;
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface LibraryUploadPanelProps {
  query: string;
}

export function LibraryUploadPanel({ query }: LibraryUploadPanelProps) {
  const [assets, setAssets] = useState<PrototypeLibraryAsset[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState('');

  const reload = async () => {
    try {
      setStorageError('');
      setAssets(await listPrototypeLibraryAssets());
    } catch {
      setStorageError('Browser Library storage is unavailable. You can still use the rest of Creative Lab.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredAssets = useMemo(() => assets.filter((asset) => [
    asset.name,
    asset.kind,
    asset.subjectName,
    asset.role,
    asset.notes,
    asset.originalFileName,
    asset.styleProfileId ? styleProfiles[asset.styleProfileId]?.title : '',
  ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery)), [assets, normalizedQuery]);

  const removeAsset = async (asset: PrototypeLibraryAsset) => {
    if (!window.confirm(`Remove “${asset.name}” from this browser's Creative Lab Library?`)) return;
    try {
      await deletePrototypeLibraryAsset(asset.id);
      await reload();
    } catch {
      setStorageError('Could not remove that Library asset.');
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">External artwork</p>
          <h3 className="mt-1 font-serif text-xl text-stone-950">Bring finished illustrations into Creative Lab</h3>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-stone-500">Upload work created in ChatGPT, drawing apps or other creative tools. Classify it once so Character Generation, Scene Builder and future agents can reuse the same Library asset.</p>
        </div>
        <button type="button" onClick={() => setUploadOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm">
          <Upload className="h-4 w-4" />Upload illustration
        </button>
      </div>

      <p className="mt-3 text-[11px] leading-5 text-amber-700">Prototype: Library image files are stored only in this browser using IndexedDB. They are not written to Supabase yet.</p>
      {storageError && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{storageError}</p>}

      {!loading && filteredAssets.length > 0 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filteredAssets.map((asset) => (
            <div key={asset.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <AssetThumbnail asset={asset} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-stone-800">{asset.name}</p>
                    <p className="mt-1 text-[11px] text-stone-500">{asset.kind} · {asset.role}</p>
                  </div>
                  <button type="button" onClick={() => void removeAsset(asset)} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700" aria-label={`Remove ${asset.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {asset.subjectName && <p className="mt-3 text-xs font-medium text-stone-700">Subject: {asset.subjectName}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-stone-100 px-2 py-1 text-[9px] font-semibold text-stone-600">{asset.source === 'external-upload' ? 'External upload' : 'Creative Lab generation'}</span>
                  {asset.styleProfileId && styleProfiles[asset.styleProfileId] && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-semibold text-emerald-700">{styleProfiles[asset.styleProfileId].title}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && assets.length > 0 && filteredAssets.length === 0 && <p className="mt-5 text-xs text-stone-400">No Library artwork matches this search.</p>}
      {!loading && assets.length === 0 && !storageError && <p className="mt-5 text-xs text-stone-400">No Library artwork yet.</p>}

      {uploadOpen && <UploadIllustrationModal onClose={() => setUploadOpen(false)} onSaved={async () => { setUploadOpen(false); await reload(); }} />}
    </div>
  );
}

function AssetThumbnail({ asset }: { asset: PrototypeLibraryAsset }) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const nextUrl = URL.createObjectURL(asset.blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [asset.blob]);

  return (
    <div className="aspect-[4/3] overflow-hidden border-b border-stone-200 bg-white">
      {url ? <img src={url} alt={asset.name} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-stone-300"><ImagePlus className="h-8 w-8" /></div>}
    </div>
  );
}

function UploadIllustrationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PrototypeLibraryAssetKind>('Character');
  const [subjectName, setSubjectName] = useState('');
  const [role, setRole] = useState<PrototypeLibraryAssetRole>('Character master');
  const [styleProfileId, setStyleProfileId] = useState('curious-community-v1');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const chooseFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (!allowedTypes.includes(nextFile.type)) {
      setError('Please choose a PNG, JPEG or WebP image.');
      return;
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError('Please choose an image smaller than 20 MB.');
      return;
    }
    setError('');
    setFile(nextFile);
    const baseName = nextFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    if (!name) setName(baseName);
    if (!subjectName && kind === 'Character') setSubjectName(baseName);
  };

  const changeKind = (nextKind: PrototypeLibraryAssetKind) => {
    setKind(nextKind);
    setRole(defaultRoleFor(nextKind));
    if (nextKind !== 'Character') setStyleProfileId('');
    if (nextKind === 'Character' && !styleProfileId) setStyleProfileId('curious-community-v1');
  };

  const canSave = Boolean(file && name.trim() && role && (kind !== 'Character' || subjectName.trim()));

  const save = async () => {
    if (!file || !canSave) return;
    setSaving(true);
    setError('');
    try {
      await savePrototypeLibraryAsset({
        id: makeAssetId(),
        name: name.trim(),
        kind,
        subjectName: subjectName.trim() || undefined,
        role,
        styleProfileId: styleProfileId || undefined,
        notes: notes.trim() || undefined,
        source: 'external-upload',
        originalFileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        createdAt: new Date().toISOString(),
        blob: file,
      });
      await onSaved();
    } catch {
      setError('Could not save this image to browser Library storage.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/50 p-4" role="dialog" aria-modal="true" aria-label="Upload illustration to Creative Lab Library">
      <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-stone-200 bg-stone-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Library upload</p>
            <h2 className="mt-1 font-serif text-2xl text-stone-950">Import external illustration</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-stone-500 hover:bg-stone-100" aria-label="Close upload"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 md:grid-cols-[260px_minmax(0,1fr)]">
          <div>
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-stone-300 bg-white text-center hover:border-stone-500">
              {previewUrl ? <img src={previewUrl} alt="Upload preview" className="h-full w-full object-contain" /> : <div className="px-5"><ImagePlus className="mx-auto h-8 w-8 text-stone-400" /><p className="mt-3 text-sm font-semibold text-stone-700">Choose illustration</p><p className="mt-1 text-[11px] leading-5 text-stone-400">PNG, JPEG or WebP · max 20 MB</p></div>}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
            </label>
            {file && <p className="mt-2 break-all text-[10px] text-stone-400">{file.name}</p>}
          </div>

          <div className="space-y-4">
            <label className="block"><span className="text-xs font-semibold text-stone-700">Asset name *</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Emma master illustration" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm outline-none focus:border-stone-500" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="text-xs font-semibold text-stone-700">What is this? *</span><select value={kind} onChange={(event) => changeKind(event.target.value as PrototypeLibraryAssetKind)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm">{kinds.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="block"><span className="text-xs font-semibold text-stone-700">Library role *</span><select value={role} onChange={(event) => setRole(event.target.value as PrototypeLibraryAssetRole)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm">{roles.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>

            {kind === 'Character' && <label className="block"><span className="text-xs font-semibold text-stone-700">Character name *</span><input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Emma" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm" /></label>}
            {kind !== 'Character' && <label className="block"><span className="text-xs font-semibold text-stone-700">Subject / entity <span className="font-normal text-stone-400">optional</span></span><input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} placeholder="Sunday Walking Street, croissant, flower…" className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm" /></label>}

            <label className="block"><span className="text-xs font-semibold text-stone-700">Style profile <span className="font-normal text-stone-400">optional</span></span><select value={styleProfileId} onChange={(event) => setStyleProfileId(event.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm"><option value="">Unknown / not assigned</option>{Object.entries(styleProfiles).map(([id, style]) => <option key={id} value={id}>{style.title}</option>)}</select></label>
            <label className="block"><span className="text-xs font-semibold text-stone-700">Notes <span className="font-normal text-stone-400">optional</span></span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Created with ChatGPT; preferred front-view master…" className="mt-2 w-full resize-none rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm leading-5" /></label>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-[11px] leading-5 text-emerald-800">This metadata is the important part: the image becomes a reusable Creative Lab object rather than just an anonymous upload.</div>
            {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-stone-200 bg-white px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-stone-300 px-4 py-2.5 text-xs font-semibold text-stone-700">Cancel</button>
          <button type="button" disabled={!canSave || saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white disabled:bg-stone-300"><Upload className="h-4 w-4" />{saving ? 'Saving…' : 'Add to Library'}</button>
        </div>
      </div>
    </div>
  );
}
