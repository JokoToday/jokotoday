const JOKO_CANONICAL_HOST = 'joko.today';
const JOKO_WWW_HOST = 'www.joko.today';

function isLocalHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function canonicalizeJokoOrigin(url: URL): string {
  if (url.hostname.toLowerCase() === JOKO_WWW_HOST) {
    url.hostname = JOKO_CANONICAL_HOST;
    url.protocol = 'https:';
    url.port = '';
  }
  return url.origin;
}

export function getCanonicalBrowserOrigin(): string {
  return canonicalizeJokoOrigin(new URL(window.location.href));
}

export function redirectToCanonicalJokoHost(): boolean {
  if (window.location.hostname.toLowerCase() !== JOKO_WWW_HOST) return false;

  const target = new URL(window.location.href);
  target.hostname = JOKO_CANONICAL_HOST;
  target.protocol = 'https:';
  target.port = '';
  window.location.replace(target.toString());
  return true;
}

export function getPublicAppUrl(): string {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim();

  if (!configuredUrl) return getCanonicalBrowserOrigin();

  try {
    const url = new URL(configuredUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('unsupported protocol');
    }

    // Never let a stale development VITE_APP_URL generate localhost auth links
    // from a publicly hosted build.
    if (isLocalHostname(url.hostname) && !isLocalHostname(window.location.hostname)) {
      console.warn('[app-url] Ignoring local VITE_APP_URL on a public host; using the current origin');
      return getCanonicalBrowserOrigin();
    }

    return canonicalizeJokoOrigin(url);
  } catch {
    console.error('[app-url] VITE_APP_URL is invalid; using the current origin');
    return getCanonicalBrowserOrigin();
  }
}
