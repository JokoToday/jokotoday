export interface ProviderOutcome { outcome: 'sent' | 'retryable' | 'permanent' | 'uncertain' | 'pause_channel'; providerId: string | null; reason: string | null; retryAfterSeconds?: number }
export async function sendFrozenNotification(channel: 'email' | 'line', body: string, key: string, credential: string,
  transport: typeof fetch = fetch): Promise<ProviderOutcome> {
  const headers: Record<string, string> = { 'Authorization': `Bearer ${credential}`, 'Content-Type': 'application/json' };
  headers[channel === 'email' ? 'Idempotency-Key' : 'X-Line-Retry-Key'] = key;
  try {
    const response = await transport(channel === 'email' ? 'https://api.resend.com/emails' : 'https://api.line.me/v2/bot/message/push',
      { method: 'POST', headers, body, signal: AbortSignal.timeout(15000) });
    if (channel === 'line' && response.status === 409 && response.headers.get('x-line-accepted-request-id')) {
      return { outcome: 'sent', providerId: response.headers.get('x-line-accepted-request-id'), reason: 'acceptance_recovered' };
    }
    if (response.ok) {
      if (channel === 'line') return { outcome: 'sent', providerId: response.headers.get('x-line-request-id'), reason: null };
      // HTTP acceptance is authoritative even if a successful response body cannot be decoded.
      const payload = await response.json().catch(() => ({})) as { id?: unknown };
      return { outcome: 'sent', providerId: typeof payload.id === 'string' ? payload.id : null, reason: null };
    }
    if (response.status === 401 || response.status === 403 || response.status === 409) {
      return { outcome: 'pause_channel', providerId: null, reason: `provider_${response.status}` };
    }
    if (response.status === 429) {
      const payload = await response.json().catch(() => ({})) as { message?: unknown };
      const quota = channel === 'line' && typeof payload.message === 'string' && /monthly|quota|limit.*month/i.test(payload.message);
      const retryAfter = response.headers.get('retry-after');
      const delay = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) : Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000)) : 0;
      return { outcome: quota || delay > 604800 ? 'pause_channel' : 'retryable', providerId: null, reason: quota ? 'provider_quota' : 'provider_rate_limit', retryAfterSeconds: Number.isFinite(delay) ? Math.max(0, Math.min(delay, 604800)) : 0 };
    }
    // A server error can occur after acceptance; reuse identical bytes and key.
    if (response.status >= 500 || response.status === 408) return { outcome: 'uncertain', providerId: null, reason: `provider_${response.status}` };
    return { outcome: 'permanent', providerId: null, reason: `provider_${response.status}` };
  } catch {
    return { outcome: 'uncertain', providerId: null, reason: 'provider_network_outcome_unknown' };
  }
}
