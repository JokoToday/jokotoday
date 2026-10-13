import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import { authenticateRequest, handlePreflight, jsonResponse, rejectDisallowedOrigin } from '../_shared/order-notifications.ts';
import { boundedBody } from '../_shared/notification-webhook-security.ts';
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handlePreflight(req);
  if (req.method !== 'POST') return jsonResponse(req, 405, { error: 'Method not allowed' });
  const rejection = rejectDisallowedOrigin(req); if (rejection) return rejection;
  const auth = await authenticateRequest(req); if (!auth.ok) return auth.response;
  const context = Deno.env.get('LINE_PROVIDER_ID'); const destination = Deno.env.get('LINE_OA_DESTINATION');
  const loginChannel = Deno.env.get('LINE_LOGIN_CHANNEL_ID'); const url = Deno.env.get('SUPABASE_URL'); const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!context || !destination || !loginChannel || !url || !serviceKey || Deno.env.get('LINE_PROVIDER_MATCH_VERIFIED') !== 'true') return jsonResponse(req, 503, { error: 'LINE friendship sync unavailable' });
  let body: { provider_token?: unknown };
  try { body = JSON.parse(new TextDecoder().decode(await boundedBody(req, 8192))); } catch { return jsonResponse(req, 400, { error: 'Invalid request' }); }
  if (!body || typeof body.provider_token !== 'string' || body.provider_token.length < 1 || body.provider_token.length > 4096) return jsonResponse(req, 400, { error: 'LINE token required' });
  try {
    // LINE documents token verification using a query parameter. Never log the URL or token.
    const verifyUrl = new URL('https://api.line.me/oauth2/v2.1/verify'); verifyUrl.searchParams.set('access_token', body.provider_token);
    const verified = await fetch(verifyUrl, { signal: AbortSignal.timeout(10000) });
    if (!verified.ok) return jsonResponse(req, 401, { error: 'Invalid LINE token' });
    const tokenInfo = await verified.json() as { client_id?: unknown; expires_in?: unknown };
    if (tokenInfo.client_id !== loginChannel || typeof tokenInfo.expires_in !== 'number' || tokenInfo.expires_in <= 0) return jsonResponse(req, 401, { error: 'LINE token channel mismatch' });
    const headers = { Authorization: `Bearer ${body.provider_token}` };
    const profileResponse = await fetch('https://api.line.me/v2/profile', { headers, signal: AbortSignal.timeout(10000) });
    if (!profileResponse.ok) return jsonResponse(req, 401, { error: 'LINE identity unavailable' });
    const profile = await profileResponse.json() as { userId?: unknown };
    if (typeof profile.userId !== 'string') return jsonResponse(req, 401, { error: 'LINE identity unavailable' });
    // Observe before the friendship call, so a newer unfollow webhook wins a race.
    const observedAt = new Date().toISOString();
    const friendshipResponse = await fetch('https://api.line.me/friendship/v1/status', { headers, signal: AbortSignal.timeout(10000) });
    if (!friendshipResponse.ok) return jsonResponse(req, 503, { error: 'LINE friendship unavailable' });
    const friendship = await friendshipResponse.json() as { friendFlag?: unknown };
    if (typeof friendship.friendFlag !== 'boolean') return jsonResponse(req, 503, { error: 'LINE friendship unavailable' });
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await service.rpc('line_oa_sync_v1', { p_customer: auth.value.user.id, p_line_user: profile.userId,
      p_context: context, p_destination: destination, p_friend: friendship.friendFlag, p_observed_at: observedAt });
    if (error) return jsonResponse(req, 409, { error: 'LINE identity or context changed' });
    return jsonResponse(req, 200, { friendship: friendship.friendFlag ? 'friend' : 'not_friend' });
  } catch { return jsonResponse(req, 503, { error: 'LINE friendship sync unavailable' }); }
});
