import { ChangeEvent, DragEvent, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Image as ImageIcon, Loader2, UploadCloud } from 'lucide-react';
import {
  BRAND_LOGO_ACCEPTED_TYPES,
  BRAND_LOGO_MAX_BYTES,
  uploadBrandLogo,
} from '../../../lib/mediaService';

interface HomepageLogoUploaderProps {
  value: string;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

const MAX_MB = BRAND_LOGO_MAX_BYTES / 1024 / 1024;

export function HomepageLogoUploader({
  value,
  onChange,
  onUploadingChange,
}: HomepageLogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const clearPreview = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview('');
    setSelected(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = '';
  };

  const chooseFile = (file: File | null) => {
    setError('');
    setNotice('');
    if (!file) return;
    if (!BRAND_LOGO_ACCEPTED_TYPES.includes(file.type as typeof BRAND_LOGO_ACCEPTED_TYPES[number])) {
      setError('Use a JPG, WebP or PNG logo.');
      return;
    }
    if (file.size <= 0 || file.size > BRAND_LOGO_MAX_BYTES) {
      setError(`Logo files must be ${MAX_MB} MB or smaller.`);
      return;
    }
    clearPreview();
    setSelected(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    chooseFile(event.target.files?.[0] || null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    chooseFile(event.dataTransfer.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!selected) return;
    setUploading(true);
    onUploadingChange?.(true);
    setProgress(0);
    setError('');
    setNotice('');
    try {
      const result = await uploadBrandLogo(selected, setProgress);
      onChange(result.publicUrl);
      setNotice('Logo uploaded. Save the Homepage Draft to keep it, then Publish when ready.');
      clearPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logo upload failed.');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <section className="joko-admin-paper-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="joko-admin-eyebrow">Site identity</p>
          <h2 className="mt-1 text-xl font-semibold text-[#303532]">Logo</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#303532]/65">
            Used in the JOKO shell and Homepage Builder preview. WebP is preferred; keep transparent or cream-background artwork compact.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-[#55766F]/20 bg-[#EEF5F2] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-[#3F665E]">
          JOKO Media
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[240px_1fr]">
        <div className="rounded-[1.4rem] border border-[#55766F]/16 bg-[#F4EFE5] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#55766F]">Current logo</p>
          <div className="mt-3 flex min-h-28 items-center justify-center rounded-2xl bg-[#D9ECE9] p-4">
            <img src={preview || value} alt="JOKO TODAY logo preview" className="max-h-20 max-w-full object-contain mix-blend-multiply" />
          </div>
          <p className="mt-3 truncate text-xs text-[#303532]/55">{value}</p>
        </div>

        <div
          onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
          onDrop={handleDrop}
          className={`rounded-[1.5rem] border-2 border-dashed p-5 transition ${dragActive ? 'border-[#55766F] bg-[#EEF5F2]' : 'border-[#55766F]/25 bg-[#FFF9EE]/80'}`}
        >
          {selected ? (
            <div>
              <p className="text-sm font-semibold text-[#303532]">{selected.name}</p>
              <p className="mt-1 text-xs text-[#303532]/60">{(selected.size / 1024).toFixed(0)} KB</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleUpload()}
                  disabled={uploading}
                  className="joko-admin-primary-button inline-flex items-center gap-2 px-4 py-2.5 text-sm"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {uploading ? `Uploading ${progress}%` : 'Upload logo'}
                </button>
                <button
                  type="button"
                  onClick={clearPreview}
                  disabled={uploading}
                  className="joko-admin-secondary-button px-4 py-2.5 text-sm"
                >
                  Cancel
                </button>
              </div>
              {uploading && (
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#55766F]/12">
                  <div className="h-full rounded-full bg-[#55766F] transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex min-h-32 w-full flex-col items-center justify-center rounded-2xl text-[#303532]/75 transition hover:bg-white/50"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D9ECE9] text-[#55766F]">
                <ImageIcon className="h-5 w-5" />
              </span>
              <span className="mt-3 text-sm font-semibold">Drop a logo here or choose a file</span>
              <span className="mt-1 text-xs text-[#303532]/55">JPG · PNG · WebP · max {MAX_MB} MB</span>
            </button>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={BRAND_LOGO_ACCEPTED_TYPES.join(',')}
            onChange={handleInput}
            className="hidden"
          />

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default HomepageLogoUploader;
