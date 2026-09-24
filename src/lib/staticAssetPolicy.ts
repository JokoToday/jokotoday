export const JOKO_BAKERY_HERO_ASSET = '/assets/home-experience/joko-bakery-full-v2.webp';
export const JOKO_BRAND_LOGO_ASSET = '/assets/brand/joko-today-logo-v0.4.webp';

const LEGACY_STATIC_ASSET_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ['/storage/v1/object/public/assets/hero/joko-bakery-hero.png', JOKO_BAKERY_HERO_ASSET],
  ['/storage/v1/object/public/assets/logos/joko-today-logo.png', JOKO_BRAND_LOGO_ASSET],
];

/**
 * Permanent site chrome belongs in the deployed frontend, not Supabase Storage.
 * Keep this compatibility resolver while old CMS values may still exist in production.
 */
export function resolveStaticSiteAssetUrl(value: string | null | undefined, fallback = ''): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;

  const replacement = LEGACY_STATIC_ASSET_REPLACEMENTS.find(([legacyPath]) =>
    candidate.includes(legacyPath),
  );

  return replacement?.[1] ?? candidate;
}
