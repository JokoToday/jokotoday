// project/src/lib/url.ts

export function getBaseUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Fallback for SSR / tests
  return process.env.NEXT_PUBLIC_SITE_URL || "";
}

export function buildUrl(path: string) {
  const base = getBaseUrl();
  if (!base) return path;
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
