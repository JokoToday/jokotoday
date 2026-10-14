import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
async function load(options={}) {
 let handler; const calls={refund:[],rpc:[]};
 const client={auth:{getUser:async token=>({data:{user:token==='valid'?{id:'admin'}:null},error:null})},from(table){const q={select(){return q;},eq(){return q;},single:async()=>({data:table==='user_profiles'?{role:options.role || 'admin'}:table==='specials_checkouts'?{inventory_state:options.inventory || 'released',financial_state:options.financial || 'refund_pending'}:{id:'tx',order_id:'10000000-0000-0000-0000-000000000001',payment_mode:'stripe_promptpay',amount_due:110,currency:'THB',provider_transaction_ref:'pi_fixture'},error:null})};return q;},rpc:async(name,args)=>{calls.rpc.push({name,args});return {error:options.rpcError?{}:null};}};
 class FakeStripe{paymentIntents={retrieve:async()=>({id:'pi_fixture',status:'succeeded',currency:options.currency || 'thb',amount_received:11000,metadata:{joko_payment_transaction_id:options.tx || 'tx'},livemode:false})};refunds={create:async(...args)=>{calls.refund.push(args);return {id:'pyr_fixture',status:'succeeded'};}};}
 const source=(await readFile('supabase/functions/specials-retry-stripe-refund/index.ts','utf8')).replace(/^import .*;\n/gm,'');
 new Function('createClient','Stripe','Deno',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText)(()=>client,FakeStripe,{env:{get:()=> 'fake'},serve:fn=>handler=fn});
 return {calls,invoke:async(token='valid')=>handler(new Request('https://test.invalid',{method:'POST',headers:token?{Authorization:`Bearer ${token}`,'Content-Type':'application/json'}:{},body:JSON.stringify({order_id:'10000000-0000-0000-0000-000000000001'})}))};
}
for(const [options,token,status] of [[{},null,401],[{},'bad',401],[{role:'customer'},'valid',403],[{role:'staff'},'valid',403],[{inventory:'committed'},'valid',409],[{financial:'refunded'},'valid',409],[{currency:'usd'},'valid',409],[{tx:'other'},'valid',409]]){const h=await load(options);eq((await h.invoke(token)).status,status);eq(h.calls.refund.length,0);eq(h.calls.rpc.length,0);}
let h=await load();const r=await h.invoke();eq(r.status,200);eq((await r.json()).livemode,false);eq(h.calls.refund[0][1].idempotencyKey,'joko-late-refund-pi_fixture');eq(h.calls.rpc[0].args.p_refund,'pyr_fixture');eq(h.calls.rpc[0].args.p_status,'succeeded');
h=await load({rpcError:true});eq((await h.invoke()).status,503);
console.log(`${checks} refund retry boundary assertions passed (isolated provider adapters).`);
