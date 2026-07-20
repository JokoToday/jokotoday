export function getPublicAppUrl(): string {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim();

  if (!configuredUrl) return window.location.origin;

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('unsupported protocol');
    }
    return url.origin;
  } catch {
    console.error('[app-url] VITE_APP_URL is invalid; using the current origin');
    return window.location.origin;
  }
}
