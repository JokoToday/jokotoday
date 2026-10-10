import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import { equalSecret } from '../_shared/notification-webhook-security.ts';
import { renderPickupNotification, type PickupPayload } from '../_shared/customer-notification-templates.ts';
import { sendFrozenNotification } from '../_shared/customer-notification-providers.ts';
interface Claim { line_context: string | null; line_destination: string | null; delivery_id: string; event_id: string; lease_token: string; channel: 'email' | 'line'; language: string; payload: PickupPayload; recipient: string; provider_key: string; template_version: string; request_body: string | null }
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  const dispatchKey = Deno.env.get('JOKO_NOTIFICATION_DISPATCH_KEY');
  if (!dispatchKey || dispatchKey.length < 32 || !equalSecret(req.headers.get('Authorization') || '', `Bearer ${dispatchKey}`)) return new Response(null, { status: 401 });
  const url = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return new Response(null, { status: 503 });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const counts = { claimed: 0, sent: 0, suppressed: 0, failed: 0, email_ready: Boolean(Deno.env.get('RESEND_API_KEY')),
    line_ready: Boolean(Deno.env.get('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN') && Deno.env.get('LINE_PROVIDER_ID') && Deno.env.get('LINE_OA_DESTINATION') && Deno.env.get('LINE_PROVIDER_MATCH_VERIFIED') === 'true') };
  const started = Date.now();
  try {
    const exhausted = new Set<string>();
    // Alternate channels so a slow provider does not monopolize every Cron tick.
    for (let round = 0; round < 10 && Date.now() - started < 45000; round++) {
      for (const channel of ['email', 'line'] as const) {
        if (Date.now() - started >= 45000 || exhausted.has(channel)) continue;
        const credential = Deno.env.get(channel === 'email' ? 'RESEND_API_KEY' : 'LINE_MESSAGING_CHANNEL_ACCESS_TOKEN');
        // Missing configuration does not consume dedupe or retry allowances.
        if (!credential || (channel === 'line' && !counts.line_ready)) { exhausted.add(channel); continue; }
        const { data, error } = await service.rpc('notification_claim_v1', { p_channel: channel });
        if (error) throw new Error('claim_failed'); if (!data) { exhausted.add(channel); continue; }
        const claim = data as Claim; counts.claimed++;
        if (channel === 'line' && (claim.line_context !== Deno.env.get('LINE_PROVIDER_ID') || claim.line_destination !== Deno.env.get('LINE_OA_DESTINATION'))) {
          const { error: contextError } = await service.rpc('notification_finish_v1', { p_delivery: claim.delivery_id, p_token: claim.lease_token, p_outcome: 'pause_channel', p_provider_id: null, p_reason: 'line_context_mismatch' });
          if (contextError) throw new Error('finish_failed'); counts.failed++; exhausted.add(channel); continue;
        }
        let request: string;
        try { if (claim.template_version !== 'pickup-v1') throw new Error('unknown_template');
          request = claim.request_body || renderPickupNotification(claim.payload, claim.language, channel, claim.recipient);
        } catch {
          const { error: finishError } = await service.rpc('notification_finish_v1', { p_delivery: claim.delivery_id, p_token: claim.lease_token,
            p_outcome: 'permanent', p_provider_id: null, p_reason: 'template_invalid' });
          if (finishError) throw new Error('finish_failed'); counts.failed++; continue;
        }
        const { data: prepared, error: prepareError } = await service.rpc('notification_prepare_v1', { p_delivery: claim.delivery_id,
          p_token: claim.lease_token, p_recipient: claim.recipient, p_request: request });
        if (prepareError) throw new Error('prepare_failed'); if (!prepared) { counts.suppressed++; continue; }
        const result = await sendFrozenNotification(channel, prepared.request_body, prepared.provider_key, credential);
        const { data: finished, error: finishError } = await service.rpc('notification_finish_v1', { p_delivery: claim.delivery_id, p_token: claim.lease_token,
          p_outcome: result.outcome, p_provider_id: result.providerId, p_reason: result.reason, p_retry_after_seconds: result.retryAfterSeconds || 0 });
        // If persistence fails, leave the same frozen request for safe-key recovery.
        if (finishError || finished !== true) throw new Error('finish_failed');
        if (result.outcome === 'sent') counts.sent++; else counts.failed++;
        if (result.outcome === 'pause_channel') exhausted.add(channel);
      }
    }
    const { error: heartbeatError } = await service.rpc('notification_heartbeat_v1', { p_counts: counts });
    if (heartbeatError) throw new Error('heartbeat_failed');
    return Response.json({ ok: true, ...counts });
  } catch (error) {
    console.error('customer_notification_dispatch', error instanceof Error ? error.message : 'dispatch_failed');
    return Response.json({ ok: false, ...counts }, { status: 503 });
  }
});
