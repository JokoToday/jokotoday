export function equalSecret(actual: string, expected: string): boolean {
  const a = new TextEncoder().encode(actual); const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let difference = 0; for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export async function verifyLineSignature(raw: Uint8Array, signature: string | null, secret: string): Promise<boolean> {
  if (!signature || !secret || !/^[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const decoded = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', key, decoded, new Uint8Array(raw));
  } catch { return false; }
}
export async function boundedBody(req: Request, limit = 131072): Promise<Uint8Array> {
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length;
    if (length > limit) { await reader.cancel(); throw new Error('body_too_large'); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  const all = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; } return all;
}
