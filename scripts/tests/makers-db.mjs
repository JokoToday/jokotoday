// Isolated PostgreSQL test; never connects to Supabase or production.
// npm install --prefix /tmp/joko-makers-tests @electric-sql/pglite
// JOKO_TEST_PGLITE_MODULE=/tmp/joko-makers-tests/node_modules/@electric-sql/pglite/dist/index.js node scripts/tests/makers-db.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const { PGlite } = await import(
  process.env.JOKO_TEST_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const sql = (query) => db.exec(query);
const rows = async (query) => (await db.query(query)).rows;
const id = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
await sql(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.actor_id', true), '')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
CREATE TABLE user_profiles (id uuid PRIMARY KEY, role text, preferred_language text);
GRANT SELECT ON user_profiles TO authenticated;
CREATE TABLE cms_products (id uuid PRIMARY KEY, name_en text, name_th text, name_zh text, is_non_bakery boolean DEFAULT false, is_active boolean DEFAULT true, is_sold_out boolean DEFAULT false, price numeric);
ALTER TABLE cms_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_read ON cms_products FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON cms_products TO anon, authenticated;
CREATE TABLE payment_settings (id boolean PRIMARY KEY, online_promptpay_enabled boolean);
CREATE TABLE customers (id uuid PRIMARY KEY, status text, name text, phone text, email text, line_id text);
CREATE TABLE pickup_dates (id uuid PRIMARY KEY, schedule_id uuid, pickup_date date, status text, order_cutoff_at timestamptz);
CREATE TABLE pickup_schedules (id uuid PRIMARY KEY, is_active boolean, label_en text);
CREATE TABLE cms_pickup_locations (id uuid PRIMARY KEY, is_active boolean);
CREATE TABLE pickup_date_locations (pickup_date_id uuid, location_id uuid, is_active boolean);
CREATE TABLE product_schedule_capacity (schedule_id uuid, product_id uuid, is_active boolean);
CREATE TABLE product_date_inventory (pickup_date_id uuid, product_id uuid, capacity integer, reserved_quantity integer, capacity_source text, updated_at timestamptz);
CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid, order_number text UNIQUE, order_items jsonb, total_amount numeric, pickup_location_id uuid, pickup_date date, pickup_date_id uuid, status text, payment_status text, line_id text, customer_name text, customer_phone text, customer_email text, notes text, pickup_day text, purchase_type text, inventory_reserved boolean, updated_at timestamptz);
CREATE TABLE inventory_events (pickup_date_id uuid, product_id uuid, order_id uuid, event_type text, reserved_delta integer, actor_id uuid, reason text);
CREATE TABLE order_notification_events (order_id uuid, notification_type text, language text, UNIQUE(order_id, notification_type));
CREATE FUNCTION update_orders_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
INSERT INTO user_profiles VALUES ('${id(1)}', 'admin', 'en'), ('${id(2)}', 'customer', 'en'), ('${id(3)}', 'product_staff', 'en');
INSERT INTO payment_settings VALUES (true, true);
`);
await sql(
  await readFile(
    new URL(
      "../../supabase/migrations/20261009152636_joko_makers_v1.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
// Exercise the repository's real dated order RPC against minimal table fixtures.
const baseline = await readFile(
  new URL(
    "../../supabase/migrations/20260826030000_production_baseline.sql",
    import.meta.url,
  ),
  "utf8",
);
const start = baseline.indexOf(
  'CREATE OR REPLACE FUNCTION "public"."create_online_order_v2"',
);
const end = baseline.indexOf("$_$;", start) + 4;
assert.ok(start >= 0 && end > start);
await sql(baseline.slice(start, end));
await sql(`
INSERT INTO cms_makers (id,slug,name_en,name_th,is_published,is_ordering_enabled) VALUES
('${id(10)}','shop','Original maker','ผู้ผลิต',true,true), ('${id(11)}','draft','Draft','ร่าง',false,false);
INSERT INTO cms_products (id,name_en,name_th,price,product_origin,maker_id) VALUES
('${id(20)}','Bread','ขนมปัง',80,'joko',NULL), ('${id(21)}','Cake','เค้ก',150,'maker','${id(10)}'), ('${id(22)}','Draft cake','ร่าง',160,'maker','${id(11)}');
SET ROLE anon;
`);
assert.equal((await rows("SELECT * FROM cms_makers")).length, 1);
assert.equal((await rows("SELECT * FROM cms_products")).length, 2);
await assert.rejects(
  sql(
    "INSERT INTO cms_makers(slug,name_en,name_th) VALUES ('hack','Hack','Hack')",
  ),
  /permission denied/,
);
await sql(
  `RESET ROLE; SET test.actor_id = '${id(2)}'; SET ROLE authenticated;`,
);
await assert.rejects(
  sql(
    "INSERT INTO cms_makers(slug,name_en,name_th) VALUES ('hack','Hack','Hack')",
  ),
  /row-level security/,
);
await sql(
  `RESET ROLE; SET test.actor_id = '${id(3)}'; SET ROLE authenticated;`,
);
assert.equal((await rows("SELECT * FROM cms_products")).length, 3);
assert.equal((await rows("SELECT * FROM cms_makers")).length, 1);
await assert.rejects(
  sql(
    "INSERT INTO cms_makers(slug,name_en,name_th) VALUES ('staff','Staff','Staff')",
  ),
  /row-level security/,
);
await sql(
  `RESET ROLE; SET test.actor_id = '${id(1)}'; SET ROLE authenticated;`,
);
assert.equal((await rows("SELECT * FROM cms_makers")).length, 2);
await sql("UPDATE cms_makers SET intro_en = 'Edited' WHERE slug = 'draft'");
await sql(`RESET ROLE;
INSERT INTO customers VALUES ('${id(2)}','active','Customer','0123','a@example.com',NULL);
INSERT INTO pickup_schedules VALUES ('${id(30)}',true,'Sunday');
INSERT INTO pickup_dates VALUES ('${id(31)}','${id(30)}',current_date + 7,'open',now() + interval '6 days');
INSERT INTO cms_pickup_locations VALUES ('${id(32)}',true);
INSERT INTO pickup_date_locations VALUES ('${id(31)}','${id(32)}',true);
INSERT INTO product_date_inventory VALUES ('${id(31)}','${id(20)}',10,0,'manual',now()), ('${id(31)}','${id(21)}',10,0,'manual',now());
SET test.actor_id = '${id(2)}';
`);
let sequence = 0;
const order = (quantity = 1, reference) =>
  rows(
    `SELECT create_online_order_v2('${reference || `ORD-1234567890123-TEST${++sequence}`}','${id(31)}','${id(32)}','[{"product_id":"${id(20)}","quantity":1},{"product_id":"${id(21)}","quantity":${quantity}}]') AS result`,
  );
const reference = "ORD-1234567890123-MIXED";
const result = (await order(2, reference))[0].result;
assert.equal(result.total_amount, 380);
assert.equal(result.status, "pending");
assert.equal(result.order_items[1].maker_name_en, "Original maker");
assert.equal(result.order_items[0].maker_id, undefined);
assert.equal((await order(2, reference))[0].result.id, result.id);
assert.deepEqual(
  (
    await rows(
      "SELECT reserved_quantity FROM product_date_inventory ORDER BY product_id",
    )
  ).map((row) => row.reserved_quantity),
  [1, 2],
);
await assert.rejects(order(99), /Insufficient stock/);
assert.deepEqual(
  (
    await rows(
      "SELECT reserved_quantity FROM product_date_inventory ORDER BY product_id",
    )
  ).map((row) => row.reserved_quantity),
  [1, 2],
);
await sql(
  "UPDATE cms_makers SET name_en = 'Renamed', is_ordering_enabled = false WHERE slug = 'shop'",
);
assert.equal(
  (await rows(`SELECT order_items FROM orders WHERE id = '${result.id}'`))[0]
    .order_items[1].maker_name_en,
  "Original maker",
);
await assert.rejects(order(), /preview only/);
await sql(
  `UPDATE orders SET status = 'confirmed', payment_status = 'paid' WHERE id = '${result.id}'`,
);
await assert.rejects(
  sql(`UPDATE orders SET order_items = '[]' WHERE id = '${result.id}'`),
  /immutable/,
);
await sql(`UPDATE orders SET status = 'cancelled' WHERE id = '${result.id}'`);
await assert.rejects(
  sql(`UPDATE orders SET status = 'pending' WHERE id = '${result.id}'`),
  /preview only/,
);
await sql(
  "UPDATE cms_makers SET is_ordering_enabled = true WHERE slug = 'shop'; UPDATE payment_settings SET online_promptpay_enabled = false",
);
await assert.rejects(order(), /online payment/);
await sql(
  "UPDATE payment_settings SET online_promptpay_enabled = true; UPDATE pickup_dates SET order_cutoff_at = now() - interval '1 minute'",
);
await assert.rejects(order(), /cutoff/);
await sql(
  "UPDATE pickup_dates SET order_cutoff_at = now() + interval '1 day'; DELETE FROM product_date_inventory WHERE product_id = '" +
    id(21) +
    "'",
);
await assert.rejects(order(), /not offered/);
assert.equal(
  (await rows("SELECT count(*)::integer AS count FROM orders"))[0].count,
  1,
);
await db.close();
console.log(
  "PASS: Makers migration, role permissions, draft visibility, mixed basket pricing/reservations, retry idempotency, capacity/date/cutoff/payment guards, paused sales, immutable historical attribution.",
);
