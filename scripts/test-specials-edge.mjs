// Executes the actual Edge handlers with isolated auth, storage, RPC and provider adapters.
// No network requests, secrets, money or LINE recipients are used.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
let checks = 0;
const eq = (a,b) => { assert.deepEqual(a,b); checks++; };
async function load(name, options={}) {
  const calls={rpc:[],fetch:[],upload:[],remove:[]}; let handler;
  const role=options.role || 'customer';
  const client={
    auth:{getUser:async token=>({data:{user:token==='valid'?{id:'customer-id'}:null},error:null})},
    from(table){const q={select(){return q;},eq(){return q;},async single(){return q.maybeSingle();},async maybeSingle(){return {data:table==='user_profiles'?{role}:options.missingOrder?null:{order_id:'11111111-1111-1111-1111-111111111111',customer_id:'customer-id'},error:null};}};return q;},
    storage:{from:()=>({upload:async(...args)=>{calls.upload.push(args);return {error:null};},remove:async(...args)=>{calls.remove.push(args);return {error:null};}})},
    async rpc(name,args){calls.rpc.push({name,args});
      if(name==='specials_begin_verification_v1')return {data:{amount:65,order_number:'TEST-JT'},error:options.beginError?{message:'Hold expired'}:null};
      if(name==='specials_finish_verification_v1')return {data:{state:args.p_evidence.provider_success?'verified':'rejected'},error:null};
      if(args.p_action==='claim')return {data:{send:!options.suppressed,retry_key:'fixed-retry-key',message:'TEST ONLY'},error:options.claimError?{message:'claim failed'}:null};
      return {data:args.p_result,error:null};
    },
  };
  const env={SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake',SUPABASE_ANON_KEY:'fake',EASYSLIP_API_KEY:'fake-provider',LINE_MESSAGING_CHANNEL_ACCESS_TOKEN:'fake-line'};
  if(options.missingKey)delete env[options.missingKey];
  const fetchStub=async(url,init)=>{calls.fetch.push({url,init});
    if(url.includes('/functions/'))throw new Error('Simulated notification outage');
    if(options.transportError)throw new Error('Simulated transport timeout');
    return new Response(JSON.stringify(options.payload ?? {success:true,data:{rawSlip:{transRef:'fake-ref',date:'2026-10-12T10:00:00Z'},amountInSlip:65,matchedAccount:{bank:{shortCode:'KBANK'},bankNumber:'1234567890'},isDuplicate:false}}),{status:options.status || 200,headers:options.headers});
  };
  const source=(await readFile(`supabase/functions/${name}/index.ts`,'utf8')).replace(/^import .*;\n/gm,'');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  new Function('createClient','Deno','fetch',compiled)(()=>client,{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},fetchStub);
  return {calls,invoke:async(token='valid',invalidFile=false)=>{
    const headers=token?{Authorization:`Bearer ${token}`} : {};
    let body;
    if(name==='specials-verify-payment'){
      body=new FormData();body.set('order_id','11111111-1111-1111-1111-111111111111');
      body.set('slip',new File(['fake-slip'],'test.png',{type:invalidFile?'text/plain':'image/png'}));
    }else{headers['Content-Type']='application/json';body=JSON.stringify({batch_id:'11111111-1111-1111-1111-111111111111'});}
    const response=await handler(new Request('https://test.invalid',{method:'POST',headers,body}));
    return {status:response.status,body:await response.json()};
  }};
}
let h=await load('specials-verify-payment');eq((await h.invoke(null)).status,401);eq(h.calls.upload.length,0);
h=await load('specials-verify-payment');eq((await h.invoke('bad')).status,401);
h=await load('specials-verify-payment',{missingKey:'EASYSLIP_API_KEY'});eq((await h.invoke()).status,503);eq(h.calls.rpc.length,0);
h=await load('specials-verify-payment',{missingOrder:true});eq((await h.invoke()).status,404);eq(h.calls.fetch.length,0);
h=await load('specials-verify-payment');eq((await h.invoke('valid',true)).status,400);
h=await load('specials-verify-payment');eq((await h.invoke()).body.state,'verified');
eq(h.calls.fetch[0].init.body.get('matchAmount'),'65');eq(h.calls.fetch[0].init.body.get('checkDuplicate'),'true');
eq(h.calls.rpc[1].args.p_evidence.reference,'fake-ref');eq(h.calls.rpc[1].args.p_evidence.account_matched,true);
eq(h.calls.fetch.length,3); // Both notification outages preserve verified payment.
h=await load('specials-verify-payment',{beginError:true});eq((await h.invoke()).status,409);eq(h.calls.remove.length,1);eq(h.calls.fetch.length,0);
h=await load('specials-verify-payment',{status:400,payload:{success:false,error:{code:'INVALID_SLIP'}}});eq((await h.invoke()).body.state,'rejected');eq(h.calls.rpc[1].args.p_evidence.provider_success,false);
h=await load('specials-verify-payment',{transportError:true});eq((await h.invoke()).body.state,'verifying');eq(h.calls.rpc.length,1);
h=await load('specials-line-send');eq((await h.invoke()).status,403);eq(h.calls.fetch.length,0);
h=await load('specials-line-send',{role:'admin'});eq((await h.invoke()).body.status,'accepted');eq(h.calls.fetch[0].init.headers['X-Line-Retry-Key'],'fixed-retry-key');
h=await load('specials-line-send',{role:'admin',status:409,headers:{'x-line-accepted-request-id':'original-request'}});eq((await h.invoke()).body.status,'accepted');eq(h.calls.rpc[1].args.p_result.request_id,'original-request');
for(const [status,expected] of [[429,'uncertain'],[500,'uncertain'],[400,'failed']]){h=await load('specials-line-send',{role:'admin',status});eq((await h.invoke()).body.status,expected);}
h=await load('specials-line-send',{role:'admin',transportError:true});eq((await h.invoke()).status,503);eq(h.calls.rpc[1].args.p_result.status,'uncertain');
h=await load('specials-line-send',{role:'admin',suppressed:true});await h.invoke();eq(h.calls.fetch.length,0);
h=await load('specials-line-send',{role:'admin',claimError:true});eq((await h.invoke()).status,503);eq(h.calls.fetch.length,0);
console.log(`${checks} isolated payment/LINE Edge handler assertions passed (mock adapters; no real provider calls).`);
