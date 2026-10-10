import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import { boundedBody, verifyLineSignature } from '../_shared/notification-webhook-security.ts';
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  const secret = Deno.env.get('LINE_MESSAGING_CHANNEL_SECRET'); const context = Deno.env.get('LINE_PROVIDER_ID');
  const destination = Deno.env.get('LINE_OA_DESTINATION'); const url = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || !context || !destination || !url || !serviceKey || Deno.env.get('LINE_PROVIDER_MATCH_VERIFIED') !== 'true') return new Response(null, { status: 503 });
  let raw: Uint8Array;
  try { raw = await boundedBody(req); } catch { return new Response(null, { status: 413 }); }
  if (!await verifyLineSignature(raw, req.headers.get('x-line-signature'), secret)) return new Response(null, { status: 401 });
  let body: { destination?: unknown; events?: unknown };
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch { return new Response(null, { status: 400 }); }
  if (!body || typeof body !== 'object' || body.destination !== destination || !Array.isArray(body.events) || body.events.length > 100) return new Response(null, { status: 400 });
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // Persist verified evidence and dedupe before acknowledging, including verification requests.
  const { error } = await service.rpc('line_oa_webhook_v1', { p_context: context, p_destination: destination, p_events: body.events });
  if (error) { console.error('line_oa_webhook', 'durable_processing_failed'); return new Response(null, { status: 503 }); }
  return Response.json({ ok: true });
});
