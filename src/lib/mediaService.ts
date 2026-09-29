import { supabase } from './supabase';

export const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const BRAND_LOGO_MAX_BYTES = 1024 * 1024;
export const PRODUCT_IMAGE_ACCEPTED_TYPES = ['image/jpeg', 'image/webp', 'image/png'] as const;
export const BRAND_LOGO_ACCEPTED_TYPES = PRODUCT_IMAGE_ACCEPTED_TYPES;

const PRODUCT_IMAGE_OUTPUT_QUALITY: Partial<Record<(typeof PRODUCT_IMAGE_ACCEPTED_TYPES)[number], number>> = {
  'image/jpeg': 0.92,
  'image/webp': 0.9,
};

const PRODUCT_IMAGE_EXTENSIONS: Record<(typeof PRODUCT_IMAGE_ACCEPTED_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/png': 'png',
};

export interface MediaUploadTicket {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  expiresIn: number;
}

interface UploadProductImageInput {
  file: File;
  productSlug: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode this image.'));
    };
    image.src = objectUrl;
  });
}

/**
 * Re-encodes product imagery before upload so EXIF/GPS and other source
 * metadata never leave the browser. Brand logos keep their original pixels.
 */
async function stripImageMetadata(file: File): Promise<File> {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('This browser could not prepare the image for upload.');
  }

  context.drawImage(image, 0, 0);

  const requestedType = file.type as (typeof PRODUCT_IMAGE_ACCEPTED_TYPES)[number];
  const quality = PRODUCT_IMAGE_OUTPUT_QUALITY[requestedType];
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, requestedType, quality);
  });

  canvas.width = 0;
  canvas.height = 0;

  if (!blob || blob.size <= 0) {
    throw new Error('Could not prepare a metadata-free image.');
  }

  if (!PRODUCT_IMAGE_ACCEPTED_TYPES.includes(blob.type as (typeof PRODUCT_IMAGE_ACCEPTED_TYPES)[number])) {
    throw new Error('This browser could not safely re-encode the selected image format.');
  }

  if (blob.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error('The metadata-free image is larger than 8 MB. Please use JPG or WebP.');
  }

  const outputType = blob.type as (typeof PRODUCT_IMAGE_ACCEPTED_TYPES)[number];
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'product-image';
  const fileName = `${baseName}.${PRODUCT_IMAGE_EXTENSIONS[outputType]}`;

  return new File([blob], fileName, {
    type: outputType,
    lastModified: Date.now(),
  });
}

async function requestUploadTicket(
  file: File,
  payload: Record<string, unknown>,
): Promise<MediaUploadTicket> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Your admin session has expired. Please sign in again.');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('JOKO Media is not configured for this environment.');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/joko-media-upload-url`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      ...payload,
    }),
  });

  const responsePayload = await response.json().catch(() => null) as
    | (Partial<MediaUploadTicket> & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(responsePayload?.error || 'Could not prepare the media upload.');
  }

  if (!responsePayload?.uploadUrl || !responsePayload.publicUrl || !responsePayload.objectKey) {
    throw new Error('The media upload service returned an invalid response.');
  }

  return {
    uploadUrl: responsePayload.uploadUrl,
    publicUrl: responsePayload.publicUrl,
    objectKey: responsePayload.objectKey,
    expiresIn: responsePayload.expiresIn || 300,
  };
}

function putFile(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    request.setRequestHeader('Content-Type', file.type);

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100);
        resolve();
        return;
      }
      reject(new Error(`R2 upload failed with status ${request.status}.`));
    };

    request.onerror = () => reject(new Error('Could not upload the image to JOKO Media.'));
    request.onabort = () => reject(new Error('Image upload was cancelled.'));
    request.send(file);
  });
}

export async function uploadProductImage(
  { file, productSlug }: UploadProductImageInput,
  onProgress?: (percent: number) => void,
): Promise<MediaUploadTicket> {
  if (!PRODUCT_IMAGE_ACCEPTED_TYPES.includes(file.type as typeof PRODUCT_IMAGE_ACCEPTED_TYPES[number])) {
    throw new Error('Use a JPG, WebP or PNG image.');
  }
  if (file.size <= 0 || file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error('Product images must be 8 MB or smaller.');
  }

  const slug = productSlug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('Enter a valid product URL slug before uploading an image.');
  }

  const sanitizedFile = await stripImageMetadata(file);

  const ticket = await requestUploadTicket(sanitizedFile, {
    assetKind: 'product',
    productSlug: slug,
  });
  await putFile(ticket.uploadUrl, sanitizedFile, onProgress);
  return ticket;
}

export async function uploadBrandLogo(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<MediaUploadTicket> {
  if (!BRAND_LOGO_ACCEPTED_TYPES.includes(file.type as typeof BRAND_LOGO_ACCEPTED_TYPES[number])) {
    throw new Error('Use a JPG, WebP or PNG logo.');
  }
  if (file.size <= 0 || file.size > BRAND_LOGO_MAX_BYTES) {
    throw new Error('Logo files must be 1 MB or smaller.');
  }

  const ticket = await requestUploadTicket(file, {
    assetKind: 'brand',
    brandSlot: 'site-logo',
  });
  await putFile(ticket.uploadUrl, file, onProgress);
  return ticket;
}
