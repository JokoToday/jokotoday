import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Image as ImageIcon, Link2, Loader2, Trash2, UploadCloud } from 'lucide-react';
import {
  PRODUCT_IMAGE_ACCEPTED_TYPES,
  PRODUCT_IMAGE_MAX_BYTES,
  uploadProductImage,
} from '../lib/mediaService';

interface ProductMediaUploaderProps {
  productSlug: string;
  value: string;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

interface ImageInfo {
  width: number;
  height: number;
}

const MAX_MB = PRODUCT_IMAGE_MAX_BYTES / 1024 / 1024;

function inspectImage(file: File): Promise<ImageInfo> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const info = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(objectUrl);
      resolve(info);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read this image.'));
    };
    image.src = objectUrl;
  });
}

export function ProductMediaUploader({
  productSlug,
  value,
  onChange,
  onUploadingChange,
}: ProductMediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState('');
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [remoteImageError, setRemoteImageError] = useState(false);

  useEffect(() => () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  const resetSelection = () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setFile(null);
    setLocalPreview('');
    setImageInfo(null);
    setError('');
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const chooseFile = async (nextFile: File | null) => {
    setError('');
    setNotice('');
    if (!nextFile) return;

    if (!PRODUCT_IMAGE_ACCEPTED_TYPES.includes(nextFile.type as typeof PRODUCT_IMAGE_ACCEPTED_TYPES[number])) {
      setError('Use a JPG, WebP or PNG image.');
      return;
    }
    if (nextFile.size > PRODUCT_IMAGE_MAX_BYTES) {
      setError(`Image is too large. Maximum size is ${MAX_MB} MB.`);
      return;
    }

    try {
      const info = await inspectImage(nextFile);
      if (localPreview) URL.revokeObjectURL(localPreview);
      setFile(nextFile);
      setImageInfo(info);
      setLocalPreview(URL.createObjectURL(nextFile));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read this image.');
    }
  };

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    void chooseFile(event.target.files?.[0] || null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    void chooseFile(event.dataTransfer.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!productSlug.trim()) {
      setError('Enter the product URL slug before uploading its image.');
      return;
    }

    setUploading(true);
    onUploadingChange?.(true);
    setProgress(0);
    setError('');
    setNotice('');
    try {
      const result = await uploadProductImage(
        { file, productSlug },
        setProgress,
      );
      onChange(result.publicUrl);
      setNotice('Uploaded to JOKO Media. Save the product to keep this image.');
      resetSelection();
      setNotice('Uploaded to JOKO Media. Save the product to keep this image.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  const isIncompleteJokoMediaUrl = (() => {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.hostname === 'media.joko.today' && (url.pathname === '/' || url.pathname.endsWith('/'));
    } catch {
      return false;
    }
  })();

  const aspectRatio = imageInfo ? imageInfo.width / imageInfo.height : null;
  const isFourThree = aspectRatio ? Math.abs(aspectRatio - 4 / 3) <= 0.03 : true;
  const isRecommendedSize = imageInfo
    ? imageInfo.width >= 1800 && imageInfo.height >= 1350
    : true;

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Product image</h4>
          <p className="mt-1 text-xs text-gray-600">
            JOKO standard: 1800 × 1350 px · 4:3 · JPG/WebP preferred · max {MAX_MB} MB · metadata removed automatically
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-[#55766F]/20 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#55766F]">
          JOKO Media
        </span>
      </div>

      {value && (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="grid gap-4 p-3 sm:grid-cols-[160px_1fr] sm:items-center">
            {isIncompleteJokoMediaUrl || remoteImageError ? (
              <div className="flex h-32 w-full items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 text-center text-xs font-medium text-amber-800 sm:h-28">
                {isIncompleteJokoMediaUrl
                  ? 'This is a folder URL, not an image file.'
                  : 'This URL did not load as an image.'}
              </div>
            ) : (
              <img
                src={value}
                alt="Current product"
                className="h-32 w-full rounded-lg object-cover sm:h-28"
                onLoad={() => setRemoteImageError(false)}
                onError={() => setRemoteImageError(true)}
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current image</p>
              <p className="mt-1 truncate text-xs text-gray-600">{value}</p>
              {isIncompleteJokoMediaUrl && (
                <p className="mt-2 text-xs text-amber-700">
                  Upload an image to JOKO Media first. The generated URL will include the image filename.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <UploadCloud className="h-4 w-4" />
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setNotice('Image removed from the product form. Save the product to confirm.');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        className={`mt-4 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragActive ? 'border-[#55766F] bg-[#EEF5F2]' : 'border-gray-300 bg-white'
        }`}
      >
        {localPreview ? (
          <div className="grid gap-4 text-left sm:grid-cols-[180px_1fr] sm:items-center">
            <img src={localPreview} alt="Selected upload" className="h-36 w-full rounded-lg object-cover" />
            <div>
              <p className="truncate text-sm font-semibold text-gray-900">{file?.name}</p>
              {imageInfo && (
                <p className="mt-1 text-xs text-gray-600">
                  {imageInfo.width} × {imageInfo.height} px · {file ? (file.size / 1024 / 1024).toFixed(2) : '0'} MB
                </p>
              )}
              {(!isFourThree || !isRecommendedSize) && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {!isFourThree && <p>Recommended aspect ratio is 4:3.</p>}
                  {!isRecommendedSize && <p>Recommended master size is at least 1800 × 1350 px.</p>}
                  <p className="mt-1 text-amber-800">You can still upload this image.</p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void handleUpload()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#55766F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#45625D] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {uploading
                    ? progress === 0
                      ? 'Preparing image…'
                      : `Uploading ${progress}%`
                    : 'Upload to JOKO Media'}
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={resetSelection}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
              {uploading && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-[#55766F] transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mx-auto flex w-full max-w-md flex-col items-center rounded-xl px-4 py-5 text-gray-700 hover:bg-gray-50"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EEF5F2] text-[#55766F]">
              <ImageIcon className="h-5 w-5" />
            </span>
            <span className="mt-3 text-sm font-semibold">{value ? 'Drop a replacement image here' : 'Drop a product image here'}</span>
            <span className="mt-1 text-xs text-gray-500">or click to choose a file</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={PRODUCT_IMAGE_ACCEPTED_TYPES.join(',')}
          onChange={handleInput}
          className="hidden"
        />
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <details className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-gray-600">Advanced: use an existing image URL</summary>
        <label className="mt-3 block">
          <span className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-700">
            <Link2 className="h-3.5 w-3.5" />
            Image URL
          </span>
          <input
            type="url"
            value={value}
            onChange={(event) => {
              setRemoteImageError(false);
              onChange(event.target.value);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500"
            placeholder="https://media.joko.today/products/..."
          />
        </label>
      </details>
    </div>
  );
}
