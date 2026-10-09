// Isolated Postgres/PLpgSQL + RLS test. No connection to Supabase production.
// Install the pinned test runtime outside the repo, then point PGLITE_MODULE at
// its @electric-sql/pglite/dist/index.js; see docs/JOKO_SPECIALS_PHASE1.md.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const runtime = process.env.PGLITE_MODULE;
if (!runtime)
  throw new Error(
    "Set PGLITE_MODULE to the isolated pinned PGlite runtime (see docs/JOKO_SPECIALS_PHASE1.md).",
  );
const { PGlite } = await import(pathToFileURL(runtime).href);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const db = new PGlite();
await db.exec(
  await readFile(
    path.join(root, "supabase/tests/specials_foundation_fixture.sql"),
    "utf8",
  ),
);
const migration = (await readdir(path.join(root, "supabase/migrations"))).find(
  (name) => name.endsWith("_joko_specials_inventory_foundation_v1.sql"),
);
await db.exec(
  await readFile(path.join(root, "supabase/migrations", migration), "utf8"),
);
let assertions = 0;
const check = (actual, expected, label) => {
  assert.deepEqual(actual, expected, label);
  assertions++;
};
const ids = {
  admin: "00000000-0000-0000-0000-000000000001",
  customer: "00000000-0000-0000-0000-000000000002",
  staff: "00000000-0000-0000-0000-000000000003",
  productStaff: "00000000-0000-0000-0000-000000000004",
  product: "10000000-0000-0000-0000-000000000001",
  location: "20000000-0000-0000-0000-000000000001",
};
const actor = async (role, uid = "") => {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec(`SET ROLE ${role}`);
};
const op = async (action, request, key = crypto.randomUUID()) =>
  (
    await db.query(
      "SELECT public.admin_specials_action_v1($1,$2::jsonb,$3::uuid) AS result",
      [action, JSON.stringify(request), key],
    )
  ).rows[0].result;
const fails = async (fn, pattern, label) => {
  await assert.rejects(fn, pattern, label);
  assertions++;
};
// The real migration is applied unchanged. All time checks use the current
// Bangkok business day; fail explicitly if there is no same-day test window.
const now = (
  await db.query(
    "SELECT clock_timestamp() AS now, (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date::text AS today",
  )
).rows[0];
const current = new Date(now.now);
const plus = (minutes) =>
  new Date(current.getTime() + minutes * 60000).toISOString();
const request = {
  title: "Today’s Specials",
  business_date: now.today,
  pickup_location_id: ids.location,
  sales_start_at: plus(-1),
  sales_end_at: plus(50),
  pickup_start_at: plus(0),
  pickup_end_at: plus(80),
  notes_internal: "Private counted surplus",
};
if (
  new Date(plus(80)).toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  }) !== now.today
)
  throw new Error(
    "Run same-day tests at least 80 minutes before Bangkok midnight. No production time validation is bypassed.",
  );
await actor("authenticated", ids.admin);
const createKey = crypto.randomUUID();
let { batch } = await op("save_batch", request, createKey);
check(
  (await op("save_batch", request, createKey)).batch.id,
  batch.id,
  "same creation retry",
);
await fails(
  () => op("save_batch", { ...request, title: "Changed" }, createKey),
  /different request/,
  "key cannot be repurposed",
);
await fails(
  () => op(null, { batch_id: batch.id, expected_version: batch.version }),
  /Invalid Specials/,
  "null action rejected",
);
await fails(
  () => op("save_batch", { ...request, business_date: "2020-01-01" }),
  /today/,
  "future/past date rejected",
);
await fails(
  () =>
    op("save_batch", {
      ...request,
      pickup_location_id: "20000000-0000-0000-0000-000000000002",
    }),
  /active pickup/,
  "inactive location rejected",
);
await fails(
  () => op("save_batch", { ...request, sales_end_at: plus(2) }),
  /5-minute/,
  "short payment window rejected",
);
await fails(
  () => op("save_batch", { ...request, pickup_end_at: plus(55) }),
  /specials_batch_window/,
  "pickup buffer enforced",
);
const base = () => ({ batch_id: batch.id, expected_version: batch.version });
await fails(
  () =>
    op("save_item", {
      ...base(),
      product_id: ids.product,
      special_price_satang: 11000,
    }),
  /made by JOKO/,
  "provenance requires attestation",
);
await fails(
  () =>
    op("save_item", {
      ...base(),
      product_id: ids.product,
      special_price_satang: 22001,
      made_by_joko_confirmed: true,
    }),
  /check constraint/,
  "invalid markdown rejected",
);
let result = await op("save_item", {
  ...base(),
  product_id: ids.product,
  special_price_satang: 11000,
  made_by_joko_confirmed: true,
  max_per_customer: 2,
});
batch = result.batch;
let item = result.item;
check(item.quantity_available, 0, "offer creation does not allocate stock");
check(item.regular_price_satang, 22000, "reference price is server sourced");
await fails(
  () =>
    op("save_item", {
      ...base(),
      product_id: "10000000-0000-0000-0000-000000000003",
      special_price_satang: 100,
      made_by_joko_confirmed: true,
    }),
  /active catalogue/,
  "inactive product rejected",
);
const stock = {
  ...base(),
  item_id: item.id,
  direction: "in",
  quantity: 4,
  source_reference: "Mae Rim counted tray",
  reason: "Market closure",
  physically_isolated: true,
  unallocated_and_good_quality: true,
};
await fails(
  () => op("transfer", { ...stock, physically_isolated: false }),
  /Count, isolate/,
  "physical isolation required",
);
await fails(
  () => op("transfer", { ...stock, quantity: 1.5 }),
  /invalid input/,
  "fractional units rejected",
);
await fails(
  () => op("transfer", { ...stock, source_reference: "" }),
  /source\/destination/,
  "source record required",
);
const stockKey = crypto.randomUUID();
result = await op("transfer", stock, stockKey);
batch = result.batch;
item = result.item;
check(item.quantity_available, 4, "counted stock allocated");
check(
  (await op("transfer", stock, stockKey)).item.quantity_available,
  4,
  "duplicate transfer not applied twice",
);
await fails(
  () => op("transfer", stock),
  /Batch changed/,
  "stale stock command rejected",
);
await fails(
  () => op("transfer", { ...stock, ...base(), direction: "out", quantity: 5 }),
  /Only available/,
  "cannot release excess stock",
);
// Simulate future held/committed units in a rolled-back test transaction.
await actor("postgres", ids.admin);
await db.exec("BEGIN");
await db.query(
  "UPDATE public.specials_items SET quantity_available=2,quantity_held=1,quantity_committed=1 WHERE id=$1",
  [item.id],
);
await actor("authenticated", ids.admin);
await db.exec("SAVEPOINT release_check");
await fails(
  () => op("transfer", { ...stock, ...base(), direction: "out", quantity: 3 }),
  /Only available/,
  "held/committed units cannot be released",
);
await db.exec("ROLLBACK TO SAVEPOINT release_check");
const remaining = (
  await op("transfer", { ...stock, ...base(), direction: "out", quantity: 2 })
).item;
check(
  [
    remaining.quantity_available,
    remaining.quantity_held,
    remaining.quantity_committed,
  ],
  [0, 1, 1],
  "release only consumes available units",
);
await db.exec("ROLLBACK");
await actor("authenticated", ids.admin);
for (const role of ["customer", "staff", "productStaff"]) {
  await actor("authenticated", ids[role]);
  check(
    (await db.query("SELECT id FROM public.specials_batches")).rows.length,
    0,
    `${role} cannot read internal batches`,
  );
  check(
    (await db.query("SELECT id FROM public.specials_items")).rows.length,
    0,
    `${role} cannot read internal stock`,
  );
  check(
    (await db.query("SELECT id FROM public.specials_audit_events")).rows.length,
    0,
    `${role} cannot read audit`,
  );
  await fails(
    () => op("transfer", { ...stock, ...base() }),
    /Admin access/,
    `${role} cannot mutate`,
  );
  await fails(
    () => db.query("UPDATE public.specials_items SET quantity_available=99"),
    /permission denied/,
    `${role} cannot bypass RPC`,
  );
}
await actor("anon");
await fails(
  () => db.query("SELECT * FROM public.specials_batches"),
  /permission denied/,
  "anonymous has no internal read grant",
);
await fails(
  () => op("save_batch", request),
  /permission denied/,
  "anonymous has no RPC execution",
);
await actor("service_role");
await fails(
  () => db.query("UPDATE public.specials_audit_events SET reason='changed'"),
  /permission denied/,
  "service role has no ledger write grant",
);
await actor("authenticated", ids.admin);
await fails(
  () => db.query("UPDATE public.specials_items SET quantity_available=99"),
  /permission denied/,
  "even Admin direct writes denied",
);
result = await op("prepare", base());
batch = result.batch;
check(batch.status, "prepared", "reviewed batch remains private/prepared");
await fails(
  () => op("publish", base()),
  /Invalid Specials/,
  "no public publishing action",
);
await fails(
  () => op("save_batch", { ...request, ...base(), title: "New pickup" }),
  /Only a draft/,
  "prepared batch immutable",
);
// A second funded draft cannot become prepared while the first is open.
let second = (await op("save_batch", { ...request, title: "Second draft" }))
  .batch;
let secondResult = await op("save_item", {
  batch_id: second.id,
  expected_version: second.version,
  product_id: ids.product,
  special_price_satang: 10000,
  made_by_joko_confirmed: true,
});
second = secondResult.batch;
secondResult = await op("transfer", {
  ...stock,
  batch_id: second.id,
  expected_version: second.version,
  item_id: secondResult.item.id,
  quantity: 1,
});
second = secondResult.batch;
await fails(
  () =>
    op("prepare", { batch_id: second.id, expected_version: second.version }),
  /specials_one_prepared_batch/,
  "only one prepared batch",
);
result = await op("close", { ...base(), reason: "End of opportunity" });
batch = result.batch;
check(
  (
    await db.query(
      "SELECT quantity_available FROM public.specials_items WHERE id=$1",
      [item.id],
    )
  ).rows[0].quantity_available,
  4,
  "closing does not silently return stock",
);
await fails(
  () => op("transfer", { ...stock, ...base() }),
  /open preparation/,
  "cannot add stock to closed batch",
);
result = await op("transfer", {
  ...stock,
  ...base(),
  direction: "out",
  quantity: 4,
  source_reference: "Donation tray",
  reason: "Closeout",
});
batch = result.batch;
item = result.item;
check(item.quantity_allocated, 0, "explicit closeout reconciles allocation");
check(item.quantity_available, 0, "explicit closeout reconciles available");
await fails(
  () => op("prepare", base()),
  /today.*draft/,
  "closed batch cannot reopen",
);
await actor("postgres", ids.admin);
check(
  (
    await db.query(
      "SELECT stock_remaining FROM public.cms_products WHERE id=$1",
      [ids.product],
    )
  ).rows[0].stock_remaining,
  20,
  "regular production capacity untouched",
);
check(
  Number(
    (
      await db.query(
        "SELECT sum(quantity_delta) AS total FROM public.specials_audit_events WHERE item_id=$1",
        [item.id],
      )
    ).rows[0].total,
  ),
  0,
  "transfer ledger balances",
);
check(
  Number(
    (
      await db.query(
        "SELECT count(*) AS total FROM public.specials_audit_events WHERE operation_key=$1",
        [stockKey],
      )
    ).rows[0].total,
  ),
  1,
  "one audit record per transfer",
);
check(
  (
    await db.query(
      "SELECT count(*)::int AS total FROM public.specials_items WHERE quantity_allocated <> quantity_available+quantity_held+quantity_committed",
    )
  ).rows[0].total,
  0,
  "all inventory balances preserved",
);
// Date and money inputs use the real frontend helper source.
const ts = await import("typescript");
const helperSource = await readFile(
  path.join(root, "src/features/specials/time.ts"),
  "utf8",
);
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const timeHelpers = await import(
  `data:text/javascript;base64,${Buffer.from(helperJs).toString("base64")}`
);
check(
  timeHelpers.bangkokInputValue(new Date("2026-10-08T17:00:00Z")),
  "2026-10-09T00:00",
  "Bangkok midnight rolls date correctly",
);
check(
  timeHelpers.bangkokInstant("2026-10-08T18:00"),
  "2026-10-08T11:00:00.000Z",
  "Bangkok input does not depend on local timezone",
);
check(
  timeHelpers.priceToSatang("0.29"),
  29,
  "satang conversion avoids floating-point multiplication error",
);
check(timeHelpers.priceToSatang("110.50"), 11050, "exact two-decimal amount");
assert.throws(() => timeHelpers.priceToSatang("1.005"));
assertions++;
assert.throws(() => timeHelpers.priceToSatang("1e2"));
assertions++;
assert.throws(() => timeHelpers.bangkokInstant("2026-02-30T18:00"));
assertions++;
assert.throws(() => timeHelpers.bangkokInstant("2026-10-08T24:00"));
assertions++;
await db.close();
console.log(
  `Specials foundation: ${assertions} assertions passed (isolated Postgres; no production writes).`,
);
