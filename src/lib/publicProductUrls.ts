export const JOKO_PUBLIC_ORIGIN = 'https://joko.today';

export function getProductQrUrl(publicCode: string): string {
  const normalized = publicCode.trim().toUpperCase();
  return normalized
    ? `${JOKO_PUBLIC_ORIGIN}/p/${encodeURIComponent(normalized)}`
    : '';
}

export function getProductCanonicalUrl(slug: string): string {
  return `${JOKO_PUBLIC_ORIGIN}/products/${encodeURIComponent(slug.trim())}`;
}
