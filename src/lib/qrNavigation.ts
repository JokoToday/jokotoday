const QR_TOKEN_PATH = /^\/q\/([^/?#]+)\/?$/;
const RELATIVE_QR_TOKEN_PATH = /^\/?q\/([^/?#]+)\/?$/;
const SHORT_CODE = /^[A-Za-z0-9]+$/;

export function normalizeQrLoginTarget(
  rawValue: string,
  currentOrigin: string
): string {
  const value = rawValue.trim();
  if (!value) {
    throw new Error('QR code is empty');
  }

  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value);

    if (url.origin !== currentOrigin) {
      throw new Error('QR code belongs to an unsupported website');
    }

    const match = url.pathname.match(QR_TOKEN_PATH);
    if (!match) {
      throw new Error('Unsupported JOKO TODAY QR path');
    }

    return `/q/${match[1]}`;
  }

  const relativeMatch = value.match(RELATIVE_QR_TOKEN_PATH);
  if (relativeMatch) {
    return `/q/${relativeMatch[1]}`;
  }

  if (!SHORT_CODE.test(value)) {
    throw new Error('Invalid JOKO TODAY QR code or VIP code');
  }

  return `/scan/${encodeURIComponent(value.toUpperCase())}`;
}
