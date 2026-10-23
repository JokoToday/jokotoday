export const MAX_PHOTOS = 4;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export async function prepareRecipePhoto(file: File): Promise<Blob> {
  if (file.size === 0 || file.size > MAX_PHOTO_BYTES)
    throw new Error("Choose a photo up to 5 MB.");
  const heic =
    /\.(heic|heif)$/i.test(file.name) ||
    ["image/heic", "image/heif"].includes(file.type);
  if (!heic && !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Use JPEG, PNG, WebP or HEIC photos.");
  let source: Blob = file;
  if (heic) {
    const { heicTo } = await import("heic-to/csp");
    source = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
  }
  const bitmap = await createImageBitmap(source, {
    imageOrientation: "from-image",
  });
  try {
    if (bitmap.width * bitmap.height > 80000000)
      throw new Error(
        "This photo is too large to process. Choose a smaller photo.",
      );
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Photo processing is unavailable.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // Re-encoding pixels removes source EXIF/GPS metadata. Originals are never uploaded.
    let out: Blob | null = null;
    for (const quality of [0.86, 0.72, 0.58, 0.42]) {
      out = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/webp", quality),
      );
      if (out && out.type === "image/webp" && out.size <= 500 * 1024)
        return out;
    }
    throw new Error(
      "Could not compress this photo. Please choose a smaller image.",
    );
  } finally {
    bitmap.close();
  }
}
