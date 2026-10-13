import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Install PGlite in a separate test workspace; no app dependency change required.
if (!process.env.PGLITE_MODULE) throw new Error('Set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const files = await readdir(new URL('../supabase/migrations/', import.meta.url));
const migration = files.find((name) => name.endsWith('_pickup_windows_v1_foundation.sql'));
await db.exec(await readFile(new URL('../supabase/tests/pickup_windows_fixture.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
const admin = '00000000-0000-4000-8000-000000000001';
const customer = '00000000-0000-4000-8000-000000000002';
const location = '00000000-0000-4000-8000-000000000003';
const schedule = '00000000-0000-4000-8000-000000000004';
const dateId = '00000000-0000-4000-8000-000000000005';
const product = '00000000-0000-4000-8000-000000000006';
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const actor = async (id) => q("select set_config('request.jwt.claim.sub',$1,false)", [id]);
const rejects = async (sql, params, expected) => assert.rejects(q(sql, params), expected);
await db.exec(`
INSERT INTO public.user_profiles VALUES('${admin}','admin','en'),('${customer}','customer','th');
INSERT INTO public.customers(id,email,name,phone,line_id) VALUES('${customer}','test@example.invalid','Test Customer','000000','contact');
INSERT INTO public.cms_pickup_locations(id,name_en,name_th) VALUES('${location}','Original location','สถานที่เดิม');
INSERT INTO public.pickup_schedules(id,schedule_key,label_en,pickup_weekday,order_cutoff_days_before,order_cutoff_time)
VALUES('${schedule}','test','Test Sunday',0,2,'17:00');
INSERT INTO public.pickup_schedule_locations(schedule_id,location_id) VALUES('${schedule}','${location}');
INSERT INTO public.pickup_dates(id,schedule_id,pickup_date,order_cutoff_at,cancellation_cutoff_at)
VALUES('${dateId}','${schedule}',current_date+7,now()+interval '6 days',now()+interval '6 days');
INSERT INTO public.cms_settings(setting_key,value) VALUES('pickup_v2_customer_enabled','true');
INSERT INTO public.cms_products(id,slug,category_id,name_en,name_th,desc_en,desc_th,price)
VALUES('${product}','test','${product}','Test product','ทดสอบ','','',25);
INSERT INTO public.product_date_inventory(pickup_date_id,product_id,capacity,reserved_quantity,capacity_source)
VALUES('${dateId}','${product}',100,0,'date_override');
`);
await actor(admin);
let stamp = (await q('select updated_at::text stamp from public.pickup_schedule_locations'))[0].stamp;
const hoursSql = "select public.admin_set_pickup_hours_v1($1,$2,$3,$4::time,$5::time,$6::smallint,$7::timestamptz) result";
await q(hoursSql, ['schedule', schedule, location, '09:00', '13:00', 30, stamp]);
await rejects(hoursSql, ['schedule', schedule, location, '09:00', '13:00', 30, stamp], /Refresh/);
await q('insert into public.pickup_date_locations(pickup_date_id,location_id) values($1,$2)', [dateId, location]);
assert.equal((await q('select pickup_open_time::text o from public.pickup_date_locations'))[0].o, '09:00:00');
await rejects("update public.pickup_date_locations set pickup_close_time='13:10'", [], /check constraint/);
await q('select public.admin_set_pickup_windows_required_v1(true)');
// Later recurring edits must not rewrite the materialized operation.
stamp = (await q('select updated_at::text stamp from public.pickup_schedule_locations'))[0].stamp;
await q(hoursSql, ['schedule', schedule, location, '08:00', '12:00', 30, stamp]);
assert.equal((await q('select pickup_open_time::text o from public.pickup_date_locations'))[0].o, '09:00:00');
await actor(customer);
await rejects("select public.create_online_order($1,$2,$3::jsonb)", ['ORD-1234567890199-TEST', 'any-day', JSON.stringify([{product_id: product, quantity: 1}])], /PICKUP_WINDOW_REQUIRED/);
await rejects(hoursSql, ['schedule', schedule, location, '10:00', '14:00', 30, stamp], /Admin authorization/);
const items = JSON.stringify([{ product_id: product, quantity: 2 }]);
const create = 'select public.create_online_order_with_pickup_window_v1($1,$2,$3,$4::jsonb,null,$5::time,$6::time,$7) result';
const params = ['ORD-1234567890123-TEST', dateId, location, items, '10:30', '11:00', 1];
await rejects('select public.create_online_order_v2($1,$2,$3,$4::jsonb)', params.slice(0, 4), /PICKUP_WINDOW_REQUIRED/);
await rejects(create, [...params.slice(0, 4), '09:05', '09:35', 1], /PICKUP_WINDOW_INVALID/);
await rejects(create, [...params.slice(0, 4), '10:30', '11:00', 99], /PICKUP_WINDOW_CHANGED/);
assert.equal((await q('select reserved_quantity from public.product_date_inventory'))[0].reserved_quantity, 0);
const order = (await q(create, params))[0].result;
assert.equal(order.pickup_slot_start, '10:30:00');
assert.equal(order.pickup_location_snapshot.name_en, 'Original location');
assert.equal(order.order_number, 'JT-1');
assert.equal((await q(create, params))[0].result.id, order.id);
assert.equal((await q('select reserved_quantity from public.product_date_inventory'))[0].reserved_quantity, 2);
assert.equal((await q('select count(*)::int n from public.order_notification_events'))[0].n, 2);
await rejects(create, [...params.slice(0, 4), '11:00', '11:30', 1], /window differs/);
// Retry remains valid after cutoff; snapshot survives renamed location/defaults.
await q("update public.pickup_dates set order_cutoff_at=now()-interval '1 minute'");
await q("update public.cms_pickup_locations set name_en='Renamed'");
assert.equal((await q(create, params))[0].result.pickup_location_snapshot.name_en, 'Original location');
await actor(admin);
stamp = (await q('select updated_at::text stamp from public.pickup_date_locations'))[0].stamp;
await rejects(hoursSql, ['date', dateId, location, '10:00', '14:00', 30, stamp], /active orders/);
await q('select public.admin_set_pickup_windows_required_v1(false)');
await q("update public.pickup_dates set order_cutoff_at=now()+interval '6 days'");
await actor(customer);
const oldStyle = (await q('select public.create_online_order_v2($1,$2,$3,$4::jsonb) result', ['ORD-1234567890124-TEST', dateId, location, items]))[0].result;
assert.equal(oldStyle.pickup_slot_start, null);
await q("update public.orders set status='confirmed' where id=$1", [oldStyle.id]);
assert.equal((await q('select pickup_slot_start from public.orders where id=$1', [oldStyle.id]))[0].pickup_slot_start, null);
assert.equal((await q("select has_function_privilege('anon','public.create_online_order_with_pickup_window_v1(text,uuid,uuid,jsonb,text,time,time,integer)','EXECUTE') allowed"))[0].allowed, false);
console.log('PASS: isolated PostgreSQL migration, validation, authorization, rollback, snapshot, idempotent retry, stock/outbox and historical-null integration');
await db.close();
