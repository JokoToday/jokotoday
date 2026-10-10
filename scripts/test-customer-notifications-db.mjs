import assert from 'node:assert/strict';
process.on('uncaughtException',(err)=>{console.error(err.message,err.where || '',err.internalQuery || '');process.exit(1);});
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE to isolated @electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const rejects = async (sql, args, pattern) => assert.rejects(q(sql, args), pattern);
await db.exec(await readFile(new URL('../supabase/tests/pickup_windows_fixture.sql', import.meta.url), 'utf8'));
await db.exec(`CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
CREATE TABLE auth.identities(user_id uuid,provider text,provider_id text,identity_data jsonb);
CREATE TABLE public.payment_transactions(order_id uuid UNIQUE,status text,expires_at timestamptz);`);
const migrations = await readdir(new URL('../supabase/migrations/', import.meta.url));
for (const suffix of ['_pickup_windows_v1_foundation.sql', '_customer_notification_delivery_v1.sql']) {
  if(suffix==='_customer_notification_delivery_v1.sql')await db.exec(`INSERT INTO public.orders(id,order_number,total_amount,customer_name,customer_phone,created_at) VALUES('00000000-0000-4000-8000-000000000010','legacy-email',25,'Historical','000','2020-01-01');
INSERT INTO public.order_notification_events(order_id,notification_type,status,language,provider_message_id) VALUES('00000000-0000-4000-8000-000000000010','customer_confirmation','sent','en','legacy-provider-id');`);

  await db.exec(await readFile(new URL(`../supabase/migrations/${migrations.find((name) => name.endsWith(suffix))}`, import.meta.url), 'utf8'));
}
const admin='00000000-0000-4000-8000-000000000001',customer='00000000-0000-4000-8000-000000000002',location='00000000-0000-4000-8000-000000000003',schedule='00000000-0000-4000-8000-000000000004',date='00000000-0000-4000-8000-000000000005';
const lineUser='U'+'1'.repeat(32), destination='U'+'2'.repeat(32);
await db.exec(`INSERT INTO public.user_profiles VALUES('${admin}','admin','en'),('${customer}','customer','th');
INSERT INTO auth.users VALUES('${customer}','verified@example.invalid',now(),null,null);
INSERT INTO auth.identities VALUES('${customer}','custom:line','${lineUser}','{"sub":"${lineUser}"}');
INSERT INTO public.cms_pickup_locations(id,name_en,name_th) VALUES('${location}','Pickup place','สถานที่รับสินค้า');
INSERT INTO public.pickup_schedules(id,schedule_key,label_en,pickup_weekday,order_cutoff_days_before,order_cutoff_time) VALUES('${schedule}','sun','Sunday',0,2,'17:00');
INSERT INTO public.pickup_dates(id,schedule_id,pickup_date,order_cutoff_at,cancellation_cutoff_at) VALUES('${date}','${schedule}',timezone('Asia/Bangkok',now())::date+1,now()+interval '12 hours',now()+interval '12 hours');
INSERT INTO public.pickup_date_locations(pickup_date_id,location_id,pickup_open_time,pickup_close_time,pickup_slot_minutes) VALUES('${date}','${location}','09:00','13:00',30);`);
const actor = (id) => q("select set_config('request.jwt.claim.sub',$1,false)",[id]);
const setting = 'select public.admin_notification_setting_v1($1,$2,$3,$4,$5,$6)';
await actor(customer);
await rejects('select public.admin_notification_state_v1()',[],/Admin access/);
await actor(admin);
assert.equal((await q('select public.admin_notification_state_v1() result'))[0].result.settings.length,3);
await rejects(setting,['pickup_completed',true,true,false,15,1],/check constraint/);
await rejects(setting,['pickup_reminder',true,true,true,1440,1],/Verify LINE/);
await q('select public.notification_line_context_v1($1,$2)',['123',destination]);
const webhook = 'select public.line_oa_webhook_v1($1,$2,$3::jsonb) n';
const event = (id,type,time) => ({webhookEventId:id,type,timestamp:time,source:{type:'user',userId:lineUser}});
const tick=Date.now()-5000;
await q(webhook,['123',destination,JSON.stringify([event('follow','follow',tick)])]);
assert.equal((await q(webhook,['123',destination,JSON.stringify([event('follow','follow',tick)])]))[0].n,0);
await q(webhook,['123',destination,JSON.stringify([event('unfollow','unfollow',tick+1000),event('older','follow',tick-1000)])]);
assert.equal((await q('select friendship from private.line_oa_relationships_v1'))[0].friendship,'not_friend');
await q(webhook,['123',destination,JSON.stringify([event('same-time','follow',tick+1000)])]);
assert.equal((await q('select friendship from private.line_oa_relationships_v1'))[0].friendship,'unknown');
await q(webhook,['123',destination,JSON.stringify([event('newest','follow',tick+2000)])]);
await rejects(webhook,['wrong',destination,'[]'],/not verified/);
const sync='select public.line_oa_sync_v1($1,$2,$3,$4,$5,$6)';
await rejects(sync,[admin,lineUser,'123',destination,true,new Date().toISOString()],/Linked LINE identity/);
await q(webhook,['123',destination,JSON.stringify([event('sync-race-unfollow','unfollow',Date.now()-1000)])]);
await q(sync,[customer,lineUser,'123',destination,true,new Date(Date.now()-2000).toISOString()]);
assert.equal((await q('select friendship from private.line_oa_relationships_v1'))[0].friendship,'not_friend');
await q(sync,[customer,lineUser,'123',destination,true,new Date().toISOString()]);
assert.equal((await q('select source from private.line_oa_relationships_v1'))[0].source,'login_api');

await q(setting,['pickup_reminder',true,true,true,1440,1]);
await q(setting,['pickup_completed',true,true,true,0,1]);
await q(setting,['pickup_not_collected',true,true,true,15,1]);
await rejects(setting,['pickup_reminder',true,true,true,1440,1],/Refresh/);
const createOrder = async (number,createdAt=null,purchaseType='online') => (await q(`INSERT INTO public.orders(order_number,total_amount,customer_id,customer_name,customer_phone,pickup_date,pickup_date_id,pickup_location_id,created_at,purchase_type)
VALUES($1,25,$2,'Test','000',timezone('Asia/Bangkok',now())::date+1,$3,$4,coalesce($5::timestamptz,now()),$6) RETURNING id`,[number,customer,date,location,createdAt,purchaseType]))[0].id;
assert.equal((await q("select status,worker_owner,provider_message_id from public.order_notification_events where notification_type='customer_confirmation'"))[0].provider_message_id,'legacy-provider-id');
assert.equal((await q("select count(*)::int n from public.notification_deliveries d join public.order_notification_events e on e.id=d.event_id where e.worker_owner='legacy'"))[0].n,0);
await createOrder('historical','2020-01-01T00:00:00Z');
await createOrder('walk-in',null,'walk_in');
assert.equal((await q("select count(*)::int n from public.order_notification_events where worker_owner='unified'"))[0].n,0);
const order=await createOrder('new');
let rows=await q('select * from public.order_notification_events where order_id=$1',[order]);
assert.equal(rows.length,2);
const reminder=rows.find((row)=>row.notification_type==='pickup_reminder');
const missed=rows.find((row)=>row.notification_type==='pickup_not_collected');
await rejects('update public.order_notification_events set operation_revision=null where id=$1',[reminder.id],/check constraint/);
assert.equal(new Date(reminder.anchor_at)-new Date(reminder.scheduled_for),86400000);
assert.equal(new Date(missed.scheduled_for)-new Date(missed.anchor_at),900000);
assert.equal(new Date(reminder.anchor_at).toISOString().slice(11,16),'02:00');
assert.equal(new Date(missed.anchor_at).toISOString().slice(11,16),'06:00');
assert.equal((await q("select public.notification_claim_v1('email') result"))[0].result,null);
let control=(await q('select * from private.notification_control_v1'))[0];
await q('select public.admin_notification_pause_v1(false,false,false,$1)',[control.updated_at]);
// Simulate a due tick, preserving the independently tested anchor calculations.
await q("update public.order_notification_events set scheduled_for=now()-interval '1 minute',expires_at=now()+interval '1 day' where id=$1",[reminder.id]);
await q('update public.notification_deliveries set next_attempt_at=now() where event_id=$1',[reminder.id]);
const claim = async(channel) => (await q('select public.notification_claim_v1($1) result',[channel]))[0].result;
const prepare = (c,body) => q('select public.notification_prepare_v1($1,$2,$3,$4) result',[c.delivery_id,c.lease_token,c.recipient,body]);
const finish = async(c,outcome) => (await q('select public.notification_finish_v1($1,$2,$3,$4,$5) result',[c.delivery_id,c.lease_token,outcome,'provider-test',outcome]))[0].result;
let email=await claim('email'); assert.ok(email); assert.equal(email.language,'th');
assert.equal(await claim('email'),null); // Active lease cannot be claimed again.
const body=JSON.stringify({to:email.recipient,text:'Frozen first render'});
assert.ok((await prepare(email,body))[0].result);
await rejects('select public.notification_prepare_v1($1,$2,$3,$4)',[email.delivery_id,email.lease_token,email.recipient,'{"different":true}'],/differs/);
assert.equal(await finish(email,'uncertain'),true);
await q('update public.notification_deliveries set next_attempt_at=now() where id=$1',[email.delivery_id]);
let retry=await claim('email');assert.equal(retry.provider_key,email.provider_key);assert.equal(retry.request_body,body);
assert.equal(await finish(email,'sent'),false); // Fenced old token.
assert.ok((await prepare(retry,body))[0].result);assert.equal(await finish(retry,'sent'),true);
let line=await claim('line'); assert.equal(line.recipient,lineUser);assert.ok((await prepare(line,'{"to":"'+lineUser+'","messages":[]}'))[0].result);
assert.equal(await finish(line,'sent'),true);
assert.equal(await claim('email'),null);assert.equal(await claim('line'),null);
// Settings changes keep existing timing; no new channels are appended.
const dueBefore=(await q('select scheduled_for from public.order_notification_events where id=$1',[reminder.id]))[0].scheduled_for.toISOString();
await q(setting,['pickup_reminder',true,true,true,1080,2]);
assert.equal((await q('select scheduled_for from public.order_notification_events where id=$1',[reminder.id]))[0].scheduled_for.toISOString(),dueBefore);
// Pickup cancels missed-pickup and emits one thank-you even with repeated updates.
await q("update public.orders set status='picked_up',picked_up_at=now() where id=$1",[order]);
await q("update public.orders set status='picked_up' where id=$1",[order]);
assert.equal((await q("select count(*)::int n from public.order_notification_events where order_id=$1 and notification_type='pickup_completed'",[order]))[0].n,1);
assert.equal((await q('select event_state from public.order_notification_events where id=$1',[missed.id]))[0].event_state,'cancelled');
assert.ok((await claim('email')).payload.event_type==='pickup_completed');
// Verified recipient change after claim blocks external preparation.
const thankLine=await claim('line'); await q('delete from auth.identities where user_id=$1',[customer]);
assert.equal((await prepare(thankLine,'{}'))[0].result,null);
// No-pickup can send only when still uncollected; an accepted order with booking closed remains eligible.
const noPickupOrder=await createOrder('no-pickup');
await q("update public.pickup_dates set status='closed' where id=$1",[date]);
await q("update public.order_notification_events set scheduled_for=now()+interval '1 day' where order_id=$1 and notification_type='pickup_reminder'",[noPickupOrder]);
const noPickupEvent=(await q("select id from public.order_notification_events where order_id=$1 and notification_type='pickup_not_collected'",[noPickupOrder]))[0].id;
await q("update public.order_notification_events set scheduled_for=now()-interval '1 minute' where id=$1",[noPickupEvent]);
await q('update public.notification_deliveries set next_attempt_at=now() where event_id=$1',[noPickupEvent]);
const noPickupClaim=await claim('email');assert.equal(noPickupClaim.payload.event_type,'pickup_not_collected');
await q("update public.orders set status='picked_up',picked_up_at=now() where id=$1",[noPickupOrder]);
assert.equal((await prepare(noPickupClaim,'{}'))[0].result,null);
// Drain earlier immediate test intents through their normal fenced state path.
for(let i=0;i<10;i++){const pending=await claim('email');if(!pending)break;if((await prepare(pending,'{}'))[0].result)assert.equal(await finish(pending,'sent'),true);}
// A crashed request older than the safe key window becomes uncertain, never a fresh send.
const crashOrder=await createOrder('crash');
const crashEvent=(await q("select id from public.order_notification_events where order_id=$1 and notification_type='pickup_reminder'",[crashOrder]))[0].id;
await q("update public.order_notification_events set scheduled_for=now()-interval '1 minute',expires_at=now()+interval '1 day' where id=$1",[crashEvent]);
await q('update public.notification_deliveries set next_attempt_at=now() where event_id=$1',[crashEvent]);
const crash=await claim('email');assert.ok((await prepare(crash,'{}'))[0].result);
await q("update public.notification_deliveries set lease_expires_at=now()-interval '1 minute',first_request_at=now()-interval '24 hours' where id=$1",[crash.delivery_id]);
assert.equal(await claim('email'),null);
assert.equal((await q('select status from public.notification_deliveries where id=$1',[crash.delivery_id]))[0].status,'uncertain');
assert.equal(await finish(crash,'sent'),false);
// Expired unpaid payment suppresses fulfillment notices; booking closed does not.
const expiredOrder=await createOrder('expired');
await q("insert into public.payment_transactions values($1,'pending',now()-interval '1 minute')",[expiredOrder]);
const expiredEvent=(await q("select id from public.order_notification_events where order_id=$1 and notification_type='pickup_reminder'",[expiredOrder]))[0].id;
await q("update public.order_notification_events set scheduled_for=now()-interval '1 minute' where id=$1",[expiredEvent]);
await q('update public.notification_deliveries set next_attempt_at=now() where event_id=$1',[expiredEvent]);
assert.equal(await claim('email'),null);
assert.equal((await q("select reason from public.notification_deliveries where event_id=$1 and channel='email'",[expiredEvent]))[0].reason,'payment_expired');
// Honor provider backpressure; a later definite rejection cannot erase prior uncertainty.
const uncertainOrder=await createOrder('uncertain-later-rejection');
const uncertainEvent=(await q("select id from public.order_notification_events where order_id=$1 and notification_type='pickup_reminder'",[uncertainOrder]))[0].id;
await q("update public.order_notification_events set scheduled_for=now()-interval '1 minute',expires_at=now()+interval '1 day' where id=$1",[uncertainEvent]);
await q('update public.notification_deliveries set next_attempt_at=now() where event_id=$1',[uncertainEvent]);
const backedOff=await claim('email');assert.ok((await prepare(backedOff,'{}'))[0].result);
await q("select public.notification_finish_v1($1,$2,'retryable',null,'rate_limit',900)",[backedOff.delivery_id,backedOff.lease_token]);
assert.equal((await q("select next_attempt_at>=now()+interval '899 seconds' respected from public.notification_deliveries where id=$1",[backedOff.delivery_id]))[0].respected,true);
await q('update public.notification_deliveries set next_attempt_at=now() where id=$1',[backedOff.delivery_id]);
const ambiguous=await claim('email');await prepare(ambiguous,'{}');await finish(ambiguous,'uncertain');
await q('update public.notification_deliveries set next_attempt_at=now() where id=$1',[ambiguous.delivery_id]);
const laterReject=await claim('email');await prepare(laterReject,'{}');await finish(laterReject,'permanent');
assert.equal((await q('select status from public.notification_deliveries where id=$1',[laterReject.delivery_id]))[0].status,'uncertain');
// Reversing recorded pickup holds its thank-you before preparation.
const reversedOrder=await createOrder('reversed-pickup');
await q("update public.orders set status='picked_up',picked_up_at=now() where id=$1",[reversedOrder]);
await q("update public.orders set status='confirmed',picked_up_at=null where id=$1",[reversedOrder]);
assert.equal(await claim('email'),null);
assert.equal((await q("select held_reason from public.order_notification_events where order_id=$1 and notification_type='pickup_completed'",[reversedOrder]))[0].held_reason,'pickup_reversed_requires_review');
// Cancellation while HTTP is in flight retains uncertainty without an orphaned retry.
const inFlightOrder=await createOrder('in-flight-cancel');
const inFlightEvent=(await q("select id from public.order_notification_events where order_id=$1 and notification_type='pickup_reminder'",[inFlightOrder]))[0].id;
await q("update public.order_notification_events set scheduled_for=now()-interval '1 minute',expires_at=now()+interval '1 day' where id=$1",[inFlightEvent]);
await q('update public.notification_deliveries set next_attempt_at=now() where event_id=$1',[inFlightEvent]);
const inFlight=await claim('email');await prepare(inFlight,'{}');
await q("update public.orders set status='cancelled' where id=$1",[inFlightOrder]);
assert.equal(await finish(inFlight,'uncertain'),true);
const finalDisposition=(await q('select status,next_attempt_at from public.notification_deliveries where id=$1',[inFlight.delivery_id]))[0];
assert.equal(finalDisposition.status,'uncertain');assert.equal(finalDisposition.next_attempt_at,null);
// Execute façade tests under real roles, not only function privilege inspection.
await q('SET ROLE service_role'); assert.equal(await claim('email'),null); await q('RESET ROLE');
await actor(customer);await q('SET ROLE authenticated');
await rejects('select public.admin_notification_state_v1()',[],/Admin access/);
await rejects("select public.notification_claim_v1('email')",[],/permission denied/);
await rejects('select * from public.notification_deliveries',[],/permission denied/);
await q('RESET ROLE');await actor(admin);await q('SET ROLE authenticated');
assert.equal((await q('select public.admin_notification_state_v1() result'))[0].result.settings.length,3);
await q('RESET ROLE');
// Anonymous/customer roles cannot claim, finish or read raw recipient/request records.
for (const name of ['notification_claim_v1(text)','notification_finish_v1(uuid,uuid,text,text,text,integer)','line_oa_webhook_v1(text,text,jsonb)']) {
 assert.equal((await q("select has_function_privilege('authenticated',$1,'EXECUTE') allowed",['public.'+name]))[0].allowed,false);
}
assert.equal((await q("select has_table_privilege('authenticated','public.notification_deliveries','SELECT') allowed"))[0].allowed,false);
// Actual checkout RPC with enabled new policies preserves inventory and both legacy intents.
const product='00000000-0000-4000-8000-000000000020';
await db.exec(`INSERT INTO public.customers(id,email,name,phone,line_id) VALUES('${customer}','verified@example.invalid','Test','000','manual-contact');
INSERT INTO public.cms_settings(setting_key,value) VALUES('pickup_v2_customer_enabled','true');
INSERT INTO public.cms_products(id,slug,category_id,name_en,name_th,desc_en,desc_th,price) VALUES('${product}','test','${product}','Test product','ทดสอบ','','',25);
INSERT INTO public.product_date_inventory(pickup_date_id,product_id,capacity,reserved_quantity,capacity_source) VALUES('${date}','${product}',100,0,'date_override');`);
await actor(customer);
await q("update public.pickup_dates set status='open' where id=$1",[date]);
const checkout=(await q("select public.create_online_order_with_pickup_window_v1($1,$2,$3,$4::jsonb,null,'09:00','09:30',1) result",['ORD-1234567890999-TEST',date,location,JSON.stringify([{product_id:product,quantity:2}])])).at(0).result;
assert.equal(checkout.pickup_slot_start,'09:00:00');
assert.equal((await q('select reserved_quantity from public.product_date_inventory where product_id=$1',[product]))[0].reserved_quantity,2);
assert.equal((await q('select count(*)::int n from public.order_notification_events where order_id=$1',[checkout.id]))[0].n,4);
assert.equal((await q("select count(*)::int n from public.order_notification_events where order_id=$1 and worker_owner='legacy'",[checkout.id]))[0].n,2);
// Optional Cron script is validated with inert local extension mocks; no HTTP occurs.
await db.exec(`CREATE SCHEMA vault; CREATE SCHEMA cron; CREATE SCHEMA net;
CREATE TABLE vault.decrypted_secrets(name text,decrypted_secret text);
CREATE TABLE cron.job(jobname text,schedule text,command text);
CREATE FUNCTION cron.schedule(text,text,text) RETURNS bigint LANGUAGE plpgsql AS $$BEGIN INSERT INTO cron.job VALUES($1,$2,$3);RETURN 1;END;$$;
CREATE FUNCTION net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer) RETURNS bigint LANGUAGE sql AS $$SELECT 99::bigint;$$;
INSERT INTO vault.decrypted_secrets VALUES('joko_customer_notification_dispatch_url','https://aaaaaaaaaaaaaaaaaaaa.supabase.co/functions/v1/dispatch-customer-notifications'),('joko_customer_notification_dispatch_key','test-only-vault-key-test-only-vault-key');`);
await db.exec(await readFile(new URL('../supabase/operations/customer-notifications-cron-v1.sql',import.meta.url),'utf8'));
assert.equal((await q('select private.notification_cron_tick_v1() id'))[0].id,99);
await q('update private.notification_control_v1 set paused=true');
assert.equal((await q('select private.notification_cron_tick_v1() id'))[0].id,null);
assert.equal((await q('select command from cron.job'))[0].command,'SELECT private.notification_cron_tick_v1();');
assert.equal((await q("select has_function_privilege('authenticated','private.notification_cron_tick_v1()','EXECUTE') allowed"))[0].allowed,false);
console.log('PASS: notification migration, policy enrollment, Bangkok anchors, per-channel claims, frozen retry, fencing, pickup suppression, LINE replay/order and security grants');
await db.close();
