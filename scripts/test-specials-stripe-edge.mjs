// Actual Edge handlers and Stripe SDK signature validation; database and provider
// calls are isolated adapters. No provider credentials, network calls or money.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const {default: Stripe} = await import(process.env.STRIPE_MODULE || 'stripe');
let checks = 0;
const eq = (a,b) => { assert.deepEqual(a,b); checks++; };
const secret = 'isolated-webhook-fixture';
async function load(name, options={}) {
  let handler;
  const calls = {rpc:[],intent:[],refund:[],notifications:[],updates:[]};
  const payment = {id:'tx',order_id:'order',customer_id:'customer',provider:'stripe',payment_mode:'stripe_promptpay',amount_due:40,currency:'THB',status:'pending',expires_at:new Date(Date.now()+300000).toISOString(),provider_transaction_ref: options.bound === false ? null : 'pi_fixture',...options.payment};
  const order = {id:'order',order_number:'TEST-JT',customer_id:'customer',customer_email:'fixture@example.invalid',payment_status:'unpaid',status:'pending',order_type:'specials',...options.order};
  const client = {
    auth:{getUser:async token=>({data:{user:token==='valid'?{id:'customer'}:null},error:null})},
    from(table) {
      const q={select(){return q;},eq(){return q;},is(){return q;},in(){return q;},update(value){calls.updates.push({table,value});return q;},upsert(){return q;},then(resolve,reject){return Promise.resolve({error:null}).then(resolve,reject);},async maybeSingle(){return {data:table==='payment_transactions'?payment:table==='orders'?order:options.replay?{processed_at:'done',processing_result:'specials:verified'}:null,error:options.orderLookupError&&table==='orders'?{message:'lookup failed'}:null};}};
      return q;
    },
    async rpc(name,args) {calls.rpc.push({name,args});return {data:{state:options.finishState || 'verified'},error:options.rpcError?{message:'temporary database failure'}:null};},
  };
  class IsolatedStripe extends Stripe {
    constructor(key) {
      super(key);
      const intent={id:'pi_fixture',status:'requires_action',livemode:false,next_action:{promptpay_display_qr_code:{data:'isolated-qr',hosted_instructions_url:'https://payments.stripe.com/fixture'}}};
      this.paymentIntents.create=async (...args)=>{calls.intent.push(args);return intent;};
      this.paymentIntents.retrieve=async (...args)=>{calls.intent.push(args);return intent;};
      this.refunds.create=async (...args)=>{calls.refund.push(args);return {id:'re_fixture',status:options.refundStatus || 'pending'};};
    }
  }
  const env={SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake',STRIPE_SECRET_KEY:'sk_test_isolated_fixture',STRIPE_WEBHOOK_SECRET:secret};
  const source=(await readFile(`supabase/functions/${name}/index.ts`,'utf8')).replace(/^import .*;\n/gm,'');
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  new Function('Stripe','createClient','Deno','fetch',compiled)(IsolatedStripe,()=>client,{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},async(url)=>{calls.notifications.push(url);return new Response(null,{status:202});});
  return {calls, async intent(token='valid') {return handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({paymentTransactionId:'tx'})}));},async event(type='payment_intent.succeeded',overrides={},badSignature=false) {
    const object=type==='refund.updated'?{id:'re_fixture',object:'refund',payment_intent:'pi_fixture',status:'succeeded'}:{id:'pi_fixture',object:'payment_intent',metadata:{joko_payment_transaction_id:'tx'},currency:'thb',amount_received:4000};
    const payload=JSON.stringify({id:'evt_fixture',type,created:Math.floor(Date.now()/1000),data:{object:{...object,...overrides}}});
    const signature=Stripe.webhooks.generateTestHeaderString({payload,secret:badSignature?'incorrect':secret});
    return handler(new Request('https://test.invalid',{method:'POST',headers:{'stripe-signature':signature},body:payload}));
  }};
}
let h=await load('stripe-promptpay-intent',{bound:false});
eq((await h.intent('invalid')).status,401);eq(h.calls.intent.length,0);
h=await load('stripe-promptpay-intent',{payment:{customer_id:'other'}});eq((await h.intent()).status,403);
h=await load('stripe-promptpay-intent',{payment:{payment_mode:'kshop_master',provider:'easyslip'}});eq((await h.intent()).status,409);
h=await load('stripe-promptpay-intent',{payment:{expires_at:'2000-01-01'}});eq((await h.intent()).status,410);
h=await load('stripe-promptpay-intent',{payment:{amount_due:9}});eq((await h.intent()).status,422);
h=await load('stripe-promptpay-intent',{bound:false});eq((await h.intent()).status,200);eq(h.calls.intent[0][0].allowed_payment_method_types,['promptpay']);eq(h.calls.intent[0][0].amount,4000);eq(h.calls.intent[0][1].idempotencyKey,'joko-stripe-promptpay-tx');
h=await load('stripe-promptpay-intent');eq((await h.intent()).status,200);eq(h.calls.intent[0],['pi_fixture']);
h=await load('stripe-webhook');eq((await h.event('payment_intent.succeeded',{},true)).status,400);eq(h.calls.rpc.length,0);
h=await load('stripe-webhook');eq((await h.event()).status,200);eq(h.calls.rpc[0].name,'specials_finish_stripe_v1');eq(h.calls.notifications.length,2);eq(h.calls.refund.length,0);
for (const evidence of [{id:'pi_wrong'},{currency:'usd'},{amount_received:1}]) {h=await load('stripe-webhook');eq((await h.event('payment_intent.succeeded',evidence)).status,500);eq(h.calls.rpc.length,0);}
h=await load('stripe-webhook',{replay:true});eq((await h.event()).status,200);eq(h.calls.rpc.length,0);
h=await load('stripe-webhook',{finishState:'refund_required'});eq((await h.event()).status,200);eq(h.calls.refund[0][1].idempotencyKey,'joko-late-refund-pi_fixture');eq(h.calls.rpc[1].args.p_status,'pending');eq(h.calls.notifications.length,0);
h=await load('stripe-webhook');eq((await h.event('refund.updated')).status,200);eq(h.calls.rpc[0].name,'specials_stripe_refund_v1');eq(h.calls.rpc[0].args.p_status,'succeeded');
h=await load('stripe-webhook',{orderLookupError:true});eq((await h.event('refund.updated')).status,500);eq(h.calls.rpc.length,0);
h=await load('stripe-webhook',{rpcError:true});eq((await h.event()).status,500);eq(h.calls.updates.at(-1).value.processed_at,null);eq((await h.event()).status,500);eq(h.calls.rpc.length,2);
h=await load('stripe-webhook',{order:{order_type:'regular'}});eq((await h.event()).status,200);eq(h.calls.rpc[0].name,'finalize_verified_payment_v1');eq(h.calls.notifications.length,2);
h=await load('stripe-webhook',{order:{order_type:'regular',status:'cancelled'}});eq((await h.event()).status,200);eq(h.calls.refund.length,1);eq(h.calls.rpc[0].name,'expire_payment_transaction_v1');
console.log(`${checks} Stripe Edge assertions passed (actual SDK signatures; isolated provider/database adapters).`);
