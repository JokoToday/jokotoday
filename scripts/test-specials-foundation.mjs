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
await db.exec(await readFile(path.join(root, 'supabase/migrations/20261011161020_joko_specials_catalogue_products_v1.sql'), 'utf8'));
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
      special_price_satang: 22001,
    }),
  /check constraint/,
  "invalid markdown rejected",
);
let result = await op("save_item", {
  ...base(),
  product_id: ids.product,
  special_price_satang: 11000,
  max_per_customer: 2,
});
batch = result.batch;
let item = result.item;
check(item.created_by, ids.admin, "offer creator is recorded without maker attestation");
check(item.quantity_available, 0, "offer creation does not allocate stock");
check(item.regular_price_satang, 22000, "reference price is server sourced");
await fails(
  () =>
    op("save_item", {
      ...base(),
      product_id: "10000000-0000-0000-0000-000000000003",
      special_price_satang: 100,
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
…7163 tokens truncated…n                      onChange={(event) => setEnabled(event.target.checked)}
                    />
                    {copy.enabled}
                  </label>
                )}
                <button
                  type="submit"
                  className="joko-admin-primary-button w-fit px-4 py-2"
                >
                  {copy.add}
                </button>
              </fieldset>
            </form>
          )}
          <div className="joko-admin-paper-card overflow-x-auto p-5">
            <table className="w-full text-left text-sm">
              <caption className="mb-3 text-left joko-admin-title text-xl">
                {copy.transfer}
              </caption>
              <thead>
                <tr>
                  {[
                    copy.product,
                    copy.allocated,
                    copy.available,
                    copy.held,
                    copy.sold,
                    "",
                  ].map((label) => (
                    <th key={label} className="px-2 py-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[#55766F]/15">
                    <td className="px-2 py-3">
                      {productName(
                        products.find(
                          (product) => product.id === item.product_id,
                        ),
                      )}
                    </td>
                    {[
                      item.quantity_allocated,
                      item.quantity_available,
                      item.quantity_held,
                      item.quantity_committed,
                    ].map((value, index) => (
                      <td key={index} className="px-2 py-3">
                        {value}
                      </td>
                    ))}
                    <td>
                      {batch.status === "draft" && (
                        <button
                          disabled={locked}
                          className="joko-admin-secondary-button px-2 py-1"
                          onClick={() => {
                            setEditItem(item);
                            setProductId(item.product_id);
                            setPrice(
                              (item.special_price_satang / 100).toFixed(2),
                            );
                            setCap(item.max_per_customer?.toString() || "");
                            setEnabled(item.is_enabled);
                          }}
                        >
                          {copy.edit}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form
            onSubmit={transfer}
            className="joko-admin-paper-card space-y-4 p-5"
          >
            <h2 className="joko-admin-title text-xl">{copy.transfer}</h2>
            <p className="text-sm">{copy.sourceHint}</p>
            <fieldset disabled={locked} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  {copy.product}
                  <select
                    required
                    className="joko-admin-field mt-1 w-full"
                    value={transferItemId}
                    onChange={(event) => {
                      setTransferItemId(event.target.value);
                      setIsolated(false);
                      setQuality(false);
                    }}
                  >
                    <option value="">—</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {productName(
                          products.find(
                            (product) => product.id === item.product_id,
                          ),
                        )}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  {copy.transfer}
                  <select
                    className="joko-admin-field mt-1 w-full"
                    value={direction}
                    onChange={(event) => {
                      setDirection(event.target.value as "in" | "out");
                      setIsolated(false);
                      setQuality(false);
                    }}
                  >
                    <option
                      value="in"
                      disabled={!["draft", "prepared", "live"].includes(batch.status)}
                    >
                      {copy.in}
                    </option>
                    <option value="out">{copy.out}</option>
                  </select>
                </label>
                <label className="text-sm">
                  {copy.quantity}
                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    className="joko-admin-field mt-1 w-full"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
              </div>
              <label className="block text-sm">
                {copy.source}
                <input
                  required
                  maxLength={500}
                  className="joko-admin-field mt-1 w-full"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                />
              </label>
              <label className="block text-sm">
                {copy.reason}
                <input
                  required
                  maxLength={1000}
                  className="joko-admin-field mt-1 w-full"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              {direction === "in" && (
                <div className="space-y-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      required
                      type="checkbox"
                      checked={isolated}
                      onChange={(event) => setIsolated(event.target.checked)}
                    />
                    {copy.isolated}
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      required
                      type="checkbox"
                      checked={quality}
                      onChange={(event) => setQuality(event.target.checked)}
                    />
                    {copy.quality}
                  </label>
                </div>
              )}
              <button
                type="submit"
                className="joko-admin-primary-button px-4 py-2"
              >
                {direction === "in" ? copy.in : copy.out}
              </button>
            </fieldset>
          </form>
          <div className="joko-admin-paper-card space-y-3 p-5">
            <p className="text-sm">{copy.leftover}</p>
            <div className="flex flex-wrap gap-2">
              {batch.status === "draft" && (
                <button
                  disabled={
                    locked ||
                    !items.some(
                      (item) => item.is_enabled && item.quantity_available > 0,
                    )
                  }
                  className="joko-admin-primary-button px-4 py-2"
                  onClick={() => void run("prepare", batchRequest())}
                >
                  {copy.prepare}
                </button>
              )}
              {["draft", "prepared", "live"].includes(batch.status) && (
                <>
                  <button
                    disabled={locked}
                    className="joko-admin-secondary-button px-4 py-2"
                    onClick={() => close("close")}
                  >
                    {copy.close}
                  </button>
                  <button
                    disabled={locked}
                    className="joko-admin-secondary-button px-4 py-2"
                    onClick={() => close("cancel")}
                  >
                    {copy.cancel}
                  </button>
                </>
              )}
            </div>
            <label className="block text-sm">
              {copy.reason}
              <input
                disabled={locked}
                maxLength={1000}
                className="joko-admin-field mt-1 w-full"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          </div>
          <div className="joko-admin-paper-card p-5">
            <h2 className="joko-admin-title mb-3 text-xl">{copy.history}</h2>
            {events.length === 0 && <p className="text-sm">{copy.noEvents}</p>}
            <ol className="space-y-3 text-sm">
              {events.map((event) => (
                <li
                  key={event.id}
                  className="border-b border-[#55766F]/15 pb-3"
                >
                  <p>
                    <strong>{event.event_type}</strong> ·{" "}
                    {bangkokInputValue(new Date(event.created_at)).replace(
                      "T",
                      " ",
                    )}
                    {event.quantity_delta
                      ? ` · ${event.quantity_delta > 0 ? "+" : ""}${event.quantity_delta}`
                      : ""}
                  </p>
                  <p>
                    {event.source_reference} · {event.reason}
                  </p>
                  <p className="break-all text-xs opacity-55">
                    {event.actor_id}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </>
      )}
      <SpecialsOperations batch={batches.find(b => b.id === batchId) || null} onChanged={() => { void loadSpecialsWorkspace().then(data => setBatches(data.batches)); }} />
    </section>
  );
}
