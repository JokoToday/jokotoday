import assert from 'node:assert/strict';
import { build } from 'esbuild';
const moduleFrom = async (name) => {
 const result=await build({entryPoints:[new URL(`../supabase/functions/_shared/${name}.ts`,import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm'});
 return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const {renderPickupNotification}=await moduleFrom('customer-notification-templates');
const {sendFrozenNotification}=await moduleFrom('customer-notification-providers');
const {verifyLineSignature,equalSecret,boundedBody}=await moduleFrom('notification-webhook-security');
for (const lang of ['en','th','zh']) for (const type of ['pickup_reminder','pickup_completed','pickup_not_collected']) {
 const payload={version:1,event_type:type,order_number:'JT-<123>',pickup_date:'2026-10-18',slot_start:'10:30:00',slot_end:'11:00:00',location:{name_en:'<script>alert(1)</script>',maps_url:'javascript:alert(1)'}};
 const email=JSON.parse(renderPickupNotification(payload,lang,'email','test@example.invalid'));
 assert.ok(!email.html.includes('<script>'));assert.ok(!email.html.includes('javascript:'));assert.ok(email.html.includes('10:30–11:00'));
 assert.ok(!email.text.includes('javascript:'));assert.ok(!email.text.includes('/q/'));
 const line=JSON.parse(renderPickupNotification(payload,lang,'line','U'+'1'.repeat(32)));
 assert.equal(line.messages[0].type,'flex');assert.ok(line.messages[0].altText.length<=400);
 assert.equal(line.messages[0].contents.footer.contents[0].action.uri,'https://joko.today/my-orders');
 const old=JSON.parse(renderPickupNotification({...payload,slot_start:null,slot_end:null},lang,'email','test@example.invalid'));
 assert.ok(!old.html.includes('10:30'));
}
let accepted=0;const requests=[];const seen=new Set();
const transport=async (_url,init)=>{
 requests.push({body:init.body,key:init.headers['X-Line-Retry-Key']});
 if(!seen.has(init.headers['X-Line-Retry-Key'])){seen.add(init.headers['X-Line-Retry-Key']);accepted++;throw new Error('accepted then timeout');}
 return new Response(null,{status:409,headers:{'x-line-accepted-request-id':'accepted-id'}});
};
const body='{"to":"test","messages":[]}';const key=crypto.randomUUID();
assert.equal((await sendFrozenNotification('line',body,key,'test-credential',transport)).outcome,'uncertain');
assert.equal((await sendFrozenNotification('line',body,key,'test-credential',transport)).outcome,'sent');
assert.equal(accepted,1);assert.deepEqual(requests[0],requests[1]);
for (const [status,outcome] of [[400,'permanent'],[401,'pause_channel'],[403,'pause_channel'],[409,'pause_channel'],[500,'uncertain'],[408,'uncertain']]) {
 assert.equal((await sendFrozenNotification('email','{}',key,'test',async()=>new Response(null,{status}))).outcome,outcome);
}
const rate=await sendFrozenNotification('email','{}',key,'test',async()=>new Response('{}',{status:429,headers:{'retry-after':'900'}}));
assert.equal(rate.outcome,'retryable');assert.equal(rate.retryAfterSeconds,900);
assert.equal((await sendFrozenNotification('line','{}',key,'test',async()=>new Response('{"message":"You have reached your monthly limit."}',{status:429}))).outcome,'pause_channel');
const raw=new TextEncoder().encode('{ "destination":"test", "events":[] }');
const hmac=await crypto.subtle.importKey('raw',new TextEncoder().encode('test-secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',hmac,raw));
const signature=Buffer.from(bytes).toString('base64');
assert.equal(await verifyLineSignature(raw,signature,'test-secret'),true);
assert.equal(await verifyLineSignature(new TextEncoder().encode('{"destination":"test","events":[]}'),signature,'test-secret'),false);
assert.equal(await verifyLineSignature(raw,signature,'wrong'),false);assert.equal(await verifyLineSignature(raw,null,'test-secret'),false);
assert.equal(equalSecret('same','same'),true);assert.equal(equalSecret('same','sane'),false);
assert.deepEqual(await boundedBody(new Request('https://example.invalid',{method:'POST',body:'abc'}),3),new TextEncoder().encode('abc'));
await assert.rejects(boundedBody(new Request('https://example.invalid',{method:'POST',body:'abcd'}),3),/body_too_large/);
console.log('PASS: EN/TH/ZH templates, safe links, LINE acceptance recovery, stable provider bytes/keys, rejection categories, backpressure, exact-byte HMAC and body limits');
