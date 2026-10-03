function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function getPublicAppUrl(): string {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim();

  if (!configuredUrl) return window.location.origin;

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('unsupported protocol');
    }

    // Never let a stale development VITE_APP_URL generate localhost auth links
    // from a publicly hosted build.
    if (isLocalHostname(url.hostname) && !isLocalHostname(window.location.hostname)) {
      console.warn('[app-url] Ignoring local VITE_APP_URL on a public host; using the current origin');
      return window.location.origin;
    }

    return url.origin;
  } catch {
    console.error('[app-url] VITE_APP_URL is invalid; using the current origin');
    return window.location.origin;
  }
}
