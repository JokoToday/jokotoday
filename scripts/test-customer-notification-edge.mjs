import assert from 'node:assert/strict';
import { build } from 'esbuild';
const env = new Map(Object.entries({JOKO_NOTIFICATION_DISPATCH_KEY:'test-dispatch-key-'.repeat(3),SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-only-service-key',RESEND_API_KEY:'test-only-resend',LINE_MESSAGING_CHANNEL_SECRET:'test-line-secret',LINE_PROVIDER_ID:'123',LINE_OA_DESTINATION:'U'+'2'.repeat(32),LINE_PROVIDER_MATCH_VERIFIED:'true'}));
let handler;
globalThis.Deno={env:{get:(name)=>env.get(name)},serve:(fn)=>{handler=fn;}};
const load=async(name)=>{
 const result=await build({entryPoints:[new URL(`../supabase/functions/${name}/index.ts`,import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'mock-client',setup(builder){builder.onResolve({filter:/^npm:@supabase\/supabase-js/},()=>({path:'client',namespace:'mock'}));builder.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export function createClient(){return globalThis.__notificationTestClient;}'}));}}]});
 await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);return handler;
};
const originalFetch=globalThis.fetch;
try {
 const dispatch=await load('dispatch-customer-notifications');
 let available=true,frozen=null,accepted=0;const requests=[],finished=[];const key=crypto.randomUUID();
 const claim={delivery_id:crypto.randomUUID(),event_id:crypto.randomUUID(),lease_token:crypto.randomUUID(),channel:'email',language:'en',payload:{version:1,event_type:'pickup_reminder',order_number:'JT-TEST',pickup_date:'2026-10-18',location:{name_en:'Test place'}},recipient:'test@example.invalid',provider_key:key,template_version:'pickup-v1'};
 globalThis.__notificationTestClient={rpc:async(name,args)=>{
  if(name==='notification_claim_v1'){if(args.p_channel==='email'&&available){available=false;return{data:{...claim,request_body:frozen},error:null};}return{data:null,error:null};}
  if(name==='notification_prepare_v1'){frozen=args.p_request;return{data:{request_body:frozen,provider_key:key},error:null};}
  if(name==='notification_finish_v1'){finished.push(args);return{data:true,error:null};}
  if(name==='notification_heartbeat_v1')return{data:null,error:null};throw new Error(name);
 }};
 globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.resend.com/emails');requests.push({body:init.body,key:init.headers['Idempotency-Key']});
  if(accepted===0){accepted++;throw new Error('accepted but response lost');}return new Response('{"id":"accepted-once"}',{status:200});};
 assert.equal((await dispatch(new Request('https://example.invalid',{method:'POST'}))).status,401);assert.equal(requests.length,0);
 const req=()=>new Request('https://example.invalid',{method:'POST',headers:{Authorization:`Bearer ${env.get('JOKO_NOTIFICATION_DISPATCH_KEY')}`}});
 const first=await dispatch(req());assert.equal(first.status,200);assert.equal(finished.at(-1).p_outcome,'uncertain');
 available=true;claim.language='zh';claim.payload.location.name_en='Changed after first render';claim.lease_token=crypto.randomUUID();
 const second=await dispatch(req());assert.equal(second.status,200);assert.equal(finished.at(-1).p_outcome,'sent');assert.equal(accepted,1);assert.deepEqual(requests[0],requests[1]);
 // Missing credentials preserves pending work and makes no claim.
 env.delete('RESEND_API_KEY');available=true;const before=finished.length;await dispatch(req());assert.equal(finished.length,before);
 // LINE context mismatch pauses the channel before any provider request.
 env.set('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN','test-token');let lineAvailable=true;
 globalThis.__notificationTestClient={rpc:async(name,args)=>{if(name==='notification_claim_v1'){if(lineAvailable){lineAvailable=false;return{data:{...claim,channel:'line',line_context:'wrong',line_destination:env.get('LINE_OA_DESTINATION')},error:null};}return{data:null,error:null};}if(name==='notification_finish_v1'){assert.equal(args.p_outcome,'pause_channel');return{data:true,error:null};}return{data:null,error:null};}};
 const countBefore=requests.length;await dispatch(req());assert.equal(requests.length,countBefore);
 const webhook=await load('line-oa-webhook');let receipts=0;
 globalThis.__notificationTestClient={rpc:async(name,args)=>{assert.equal(name,'line_oa_webhook_v1');assert.equal(args.p_context,'123');receipts++;return{data:0,error:null};}};
 const raw=JSON.stringify({destination:env.get('LINE_OA_DESTINATION'),events:[]});
 const hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.get('LINE_MESSAGING_CHANNEL_SECRET')),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',hmac,new TextEncoder().encode(raw))).toString('base64');
 assert.equal((await webhook(new Request('https://example.invalid',{method:'POST',body:raw}))).status,401);assert.equal(receipts,0);
 assert.equal((await webhook(new Request('https://example.invalid',{method:'POST',body:raw,headers:{'x-line-signature':signature}}))).status,200);assert.equal(receipts,1);
 globalThis.__notificationTestClient={rpc:async()=>({data:null,error:{code:'test_durable_failure'}})};
 assert.equal((await webhook(new Request('https://example.invalid',{method:'POST',body:raw,headers:{'x-line-signature':signature}}))).status,503);
 env.set('SUPABASE_ANON_KEY','test-public-key');env.set('LINE_LOGIN_CHANNEL_ID','456');
 const friendshipSync=await load('sync-line-oa-friendship');let syncCalls=0,wrongChannel=false;
 globalThis.__notificationTestClient={auth:{getUser:async()=>({data:{user:{id:'trusted-customer'}},error:null})},rpc:async(name,args)=>{
  assert.equal(name,'line_oa_sync_v1');assert.equal(args.p_customer,'trusted-customer');assert.equal(args.p_line_user,'U'+'1'.repeat(32));assert.equal(args.p_friend,true);syncCalls++;return{data:null,error:null};
 }};
 globalThis.fetch=async(url)=>{const value=String(url);if(value.includes('/oauth2/v2.1/verify'))return new Response(JSON.stringify({client_id:wrongChannel?'wrong':'456',expires_in:100}));
  if(value.endsWith('/v2/profile'))return new Response(JSON.stringify({userId:'U'+'1'.repeat(32)}));
  if(value.endsWith('/friendship/v1/status'))return new Response('{"friendFlag":true}');throw new Error('unexpected external URL');};
 const syncReq=()=>new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer customer-jwt'},body:'{"provider_token":"test-line-token"}'});
 assert.equal((await friendshipSync(syncReq())).status,200);assert.equal(syncCalls,1);
 wrongChannel=true;assert.equal((await friendshipSync(syncReq())).status,401);assert.equal(syncCalls,1);
 console.log('PASS: dispatcher authorization, frozen retry through lost acceptance, missing credentials, LINE context mismatch, signed webhook verification, durable acknowledgment and trusted friendship synchronization');
} finally {globalThis.fetch=originalFetch;delete globalThis.Deno;delete globalThis.__notificationTestClient;}
