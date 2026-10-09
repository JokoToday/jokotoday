import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
let count = 0;
for (const file of [
  "supabase/tests/specials_foundation_fixture.sql",
  "supabase/migrations/20261008101347_joko_specials_inventory_foundation_v1.sql",
  "supabase/tests/specials_checkout_fixture.sql",
  "supabase/migrations/20261008110550_joko_specials_checkout_v1.sql",
])
  await db.exec(await readFile(file, "utf8"));
// Simulate the later regular migration replacing expiry, then apply the compatibility guard.
await db.exec(`
CREATE OR REPLACE FUNCTION public.expire_payment_transaction_v1(p_payment_transaction_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
 UPDATE public.payment_transactions SET status='expired' WHERE id=p_payment_transaction_id; RETURN '{"regular":true}'::jsonb;
END $$;
CREATE FUNCTION public.reactivate_expired_online_order_v1(p_order_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
 RETURN '{"regular":true}'::jsonb;
END $$;
CREATE FUNCTION public.expire_own_payment_transaction_v1(p_payment_transaction_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
 RETURN public.expire_payment_transaction_v1(p_payment_transaction_id);
END $$;
`);
await db.exec(await readFile("supabase/migrations/20261008213000_payment_handoff_v1.sql", "utf8"));
await db.exec(await readFile("supabase/migrations/20261009023000_stripe_promptpay_v1.sql", "utf8"));
await db.exec(await readFile("supabase/migrations/20261009025239_joko_specials_payment_compatibility_v1.sql", "utf8"));
// Deliberately configure regular checkout for Stripe throughout Specials tests.
await db.exec("UPDATE public.payment_settings SET payment_qr_mode='stripe_promptpay'");
const id = {
  admin: "00000000-0000-0000-0000-000000000001",
  customer: "00000000-0000-0000-0000-000000000002",
  staff: "00000000-0000-0000-0000-000000000003",
  loc: "20000000-0000-0000-0000-000000000001",
  product: "10000000-0000-0000-0000-000000000001",
};
const actor = async (role, uid = "") => {
  await db.exec("RESET ROLE");
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.exec(`SET ROLE ${role}`);
};
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const rpc = async (action, request) =>
  (
    await query("SELECT public.admin_specials_action_v1($1,$2,$3) r", [
      action,
      JSON.stringify(request),
      crypto.randomUUID(),
    ])
  )[0].r;
const eq = (a, b, label) => {
  assert.deepEqual(a, b, label);
  count++;
};
const fails = async (fn, rx, label) => {
  await assert.rejects(fn, rx, label);
  count++;
};
await actor("authenticated", id.admin);
const now = (
  await query(
    "SELECT clock_timestamp() t,(clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date::text AS business_day",
  )
)[0];
const plus = (n) =>
  new Date(new Date(now.t).getTime() + n * 60000).toISOString();
let { batch: b } = await rpc("save_batch", {
  title: "Specials",
  business_date: now.business_day,
  pickup_location_id: id.loc,
  sales_start_at: plus(-1),
  sales_end_at: plus(50),
  pickup_start_at: plus(-1),
  pickup_end_at: plus(80),
});
let { batch, item } = await rpc("save_item", {
  batch_id: b.id,
  expected_version: b.version,
  product_id: id.product,
  special_price_satang: 10000,
  max_per_customer: 3,
  made_by_joko_confirmed: true,
});
b = batch;
({ batch: b } = await rpc("transfer", {
  batch_id: b.id,
  expected_version: b.version,
  item_id: item.id,
  item_version: item.version,
  direction: "in",
  quantity: 6,
  source_reference: "Count 1",
  reason: "Isolated",
  physically_isolated: true,
  unallocated_and_good_quality: true,
}));
({ batch: b } = await rpc("prepare", {
  batch_id: b.id,
  expected_version: b.version,
}));
await fails(
  () => rpc("publish", { batch_id: b.id, expected_version: b.version }),
  /enabled payment/,
  "disabled until configured",
);
await rpc("settings", {
  enabled: true,
  qr_payload:
    "00020101021129370016A0000006770101110113006681234567853037645802TH6304823E",
  receiver_bank_code: "KBANK",
  receiver_bank_number: "1234567890",
  receiver_label: "JOKO",
});
({ batch: b } = await rpc("publish", {
  batch_id: b.id,
  expected_version: b.version,
}));
eq(b.status, "live", "published");
await actor("anon");
const cat = (await query("SELECT public.specials_catalog_v1() r"))[0].r;
eq(cat.items.length, 1, "public catalog");
await actor("postgres");
await query("UPDATE public.specials_batches SET sales_end_at=clock_timestamp()+interval '6 minutes' WHERE id=$1",[b.id]);
await actor("anon");
eq(Boolean((await query("SELECT public.specials_catalog_v1() r"))[0].r.batch),true,"Specials remains open with six minutes left");
await actor("postgres");
await query("UPDATE public.specials_batches SET sales_end_at=clock_timestamp()+interval '4 minutes' WHERE id=$1",[b.id]);
await actor("anon");
eq((await query("SELECT public.specials_catalog_v1() r"))[0].r,{},"catalog closes five minutes before sales end");
await actor("authenticated",id.customer);
await fails(()=>query("SELECT public.specials_checkout_v1($1,$2,$3)",[b.id,JSON.stringify([{item_id:item.id,quantity:1}]),crypto.randomUUID()]),/Checkout is closed/,"database enforces shorter cutoff");
await actor("postgres");
await query("UPDATE public.specials_batches SET sales_end_at=$1 WHERE id=$2",[plus(50),b.id]);

await actor("anon");
eq(cat.batch.notes_internal, undefined, "internal fields hidden");
await fails(
  () => query("SELECT * FROM public.specials_checkouts"),
  /permission denied/,
  "anonymous checkout hidden",
);
await actor("authenticated", id.customer);
const cart = [{ item_id: item.id, quantity: 2 }],
  key = crypto.randomUUID();
const checkout = async (c = cart, k = key) =>
  (
    await query("SELECT public.specials_checkout_v1($1,$2,$3) r", [
      b.id,
      JSON.stringify(c),
      k,
    ])
  )[0].r;
const { order_id: order } = await checkout();
await actor("postgres");
const deadlines = (await query("SELECT round(extract(epoch FROM c.payment_deadline-c.created_at)) AS hold_seconds, extract(epoch FROM c.verification_deadline-c.payment_deadline)::integer AS grace_seconds, (t.expires_at=c.payment_deadline) AS payment_matches, t.provider, t.payment_mode FROM public.specials_checkouts c JOIN public.payment_transactions t ON t.order_id=c.order_id WHERE c.order_id=$1",[order]))[0];
eq(Number(deadlines.hold_seconds),300,"Specials holds last exactly five minutes");
eq(deadlines.grace_seconds,120,"verification grace is two minutes");
eq(deadlines.payment_matches,true,"payment rail deadline matches stock deadline");
eq([deadlines.provider,deadlines.payment_mode],['easyslip','kshop_master'],"regular Stripe setting cannot change Specials rail");
const originalDeadlines = (await query("SELECT payment_deadline,verification_deadline FROM public.specials_checkouts WHERE order_id=$1",[order]))[0];
await actor("authenticated",id.customer);
eq((await checkout()).order_id, order, "idempotent checkout");
await actor("postgres");
eq((await query("SELECT payment_deadline,verification_deadline FROM public.specials_checkouts WHERE order_id=$1",[order]))[0],originalDeadlines,"checkout retries cannot extend deadlines");
await actor("authenticated",id.customer);
eq((await query("SELECT order_id FROM public.specials_checkouts WHERE order_id=$1",[order])).length,1,"customer lifecycle projection is readable for My Orders");
await fails(
  () => checkout([{ item_id: item.id, quantity: 1 }], key),
  /different request/,
  "key payload protected",
);
await fails(
  () => checkout(cart, crypto.randomUUID()),
  /existing checkout/,
  "one active hold",
);
await fails(
  () =>
    query("UPDATE public.orders SET status=$1 WHERE id=$2", [
      "picked_up",
      order,
    ]),
  /authorized Specials/,
  "direct staff/customer bypass blocked",
);
for (const sql of [
  "SELECT public.cancel_online_order($1)",
  "SELECT public.staff_record_order_payment_v2($1,'cash')",
  "SELECT * FROM public.confirm_order_pickup($1)",
])
  await fails(
    () => query(sql, [order]),
    /authorized Specials/,
    "legacy bypass blocked",
  );
const state = async (o = order) =>
  (await query("SELECT public.specials_customer_state_v1($1) r", [o]))[0].r;
eq((await state()).order.total_amount, 200, "server price");
eq((await state()).checkout.inventory_state, "held", "stock held");
await fails(
  () =>
    query("SELECT public.specials_finish_verification_v1($1,$2)", [
      crypto.randomUUID(),
      "{}",
    ]),
  /permission denied/,
  "customer cannot forge provider evidence",
);
await actor("authenticated", "00000000-0000-0000-0000-000000000004");
eq((await query("SELECT order_id FROM public.specials_checkouts WHERE order_id=$1",[order])).length,0,"different customer cannot read lifecycle projection");
await actor("authenticated", id.staff);
await fails(
  () => query("SELECT public.specials_customer_state_v1($1)", [order]),
  /not found/,
  "different customer blocked",
);
await fails(
  () =>
    query("SELECT * FROM public.specials_pickup_v1($1,$2)", [order, id.loc]),
  /Not authorized/,
  "unassigned desk blocked",
);
await actor("service_role");
const attempt = crypto.randomUUID();
await query("SELECT public.specials_begin_verification_v1($1,$2,$3,$4)", [
  order,
  id.customer,
  attempt,
  "private/file",
]);
await actor("authenticated", id.customer);
await fails(
  () => query("SELECT public.specials_customer_state_v1($1,true)", [order]),
  /Verification in progress/,
  "cannot cancel during verification",
);
await actor("service_role");
const evidence = {
  provider_success: true,
  reference: "bank-ref-1",
  amount: 200,
  paid_at: new Date().toISOString(),
  account_matched: true,
  bank_code: "KBANK",
  bank_number: "123-456-7890",
  duplicate: false,
};
const finish = async (a, e) =>
  (
    await query("SELECT public.specials_finish_verification_v1($1,$2) r", [
      a,
      JSON.stringify(e),
    ])
  )[0].r;
eq(
  (await finish(attempt, evidence)).state,
  "verified",
  "exact recipient and amount commit",
);
eq(
  (await finish(attempt, evidence)).state,
  "verified",
  "provider completion replay",
);
await actor("postgres");
let stock = (
  await query(
    "SELECT quantity_available,quantity_held,quantity_committed FROM public.specials_items WHERE id=$1",
    [item.id],
  )
)[0];
eq(
  stock,
  { quantity_available: 4, quantity_held: 0, quantity_committed: 2 },
  "stock conservation",
);
eq(
  (
    await query("SELECT count(*)::int n FROM public.order_notification_events")
  )[0].n,
  2,
  "notifications only after payment",
);
await actor("authenticated", id.admin);
await rpc("staff_location", {
  user_id: id.staff,
  location_id: id.loc,
  enabled: true,
});
await actor("authenticated", id.staff);
eq(
  (
    await query("SELECT * FROM public.specials_pickup_v1($1,$2)", [
      order,
      id.loc,
    ])
  )[0].status,
  "picked_up",
  "paid pickup",
);
eq(
  (
    await query("SELECT * FROM public.specials_pickup_v1($1,$2)", [
      order,
      id.loc,
    ])
  )[0].status,
  "picked_up",
  "pickup replay",
);
await actor("authenticated", id.customer);
await fails(
  () => checkout([{ item_id: item.id, quantity: 2 }], crypto.randomUUID()),
  /quantity limit/,
  "committed units count against cap",
);
const { order_id: late } = await checkout(
  [{ item_id: item.id, quantity: 1 }],
  crypto.randomUUID(),
);
await actor("service_role");
const lateAttempt = crypto.randomUUID();
await query("SELECT public.specials_begin_verification_v1($1,$2,$3,$4)", [
  late,
  id.customer,
  lateAttempt,
  "private/late",
]);
await actor("postgres");
await query(
  "UPDATE public.specials_checkouts SET payment_deadline=clock_timestamp()-interval '4 minutes',verification_deadline=clock_timestamp()-interval '1 minute' WHERE order_id=$1",
  [late],
);
await actor("service_role");
eq(
  (
    await finish(lateAttempt, {
      ...evidence,
      reference: "bank-ref-late",
      amount: 100,
    })
  ).state,
  "reconciliation_required",
  "late payment never reacquires stock",
);
await actor("postgres");
eq(
  (
    await query(
      "SELECT inventory_state,financial_state FROM public.specials_checkouts WHERE order_id=$1",
      [late],
    )
  )[0],
  { inventory_state: "released", financial_state: "reconciliation_required" },
  "late money tracked separately",
);
await actor("authenticated", id.admin);
const ann = await rpc("queue_line", { batch_id: b.id });
const ann2 = await rpc("queue_line", { batch_id: b.id });
eq(
  ann.announcement.retry_key,
  ann2.announcement.retry_key,
  "one announcement retry key",
);
await actor("service_role");
const line = async (action, result = {}) =>
  (
    await query("SELECT public.specials_line_action_v1($1,$2,$3) r", [
      action,
      b.id,
      JSON.stringify(result),
    ])
  )[0].r;
eq((await line("claim")).send, true, "LINE claim");
eq((await line("claim")).send, false, "LINE concurrent claim blocked");
await line("finish", { status: "uncertain", error: "timeout" });
eq(
  (await line("claim")).retry_key,
  ann.announcement.retry_key,
  "LINE retry key retained",
);
await line("finish", { status: "accepted", request_id: "accepted-1" });
eq((await line("claim")).status, "accepted", "accepted campaigns never resend");
await actor("authenticated", id.admin);
await rpc("refund_pending", {
  batch_id: b.id,
  reference: "bank-ref-late",
  reason: "Return confirmed transfer",
});
await actor("postgres");
eq(
  (
    await query(
      "SELECT financial_state FROM public.specials_checkouts WHERE order_id=$1",
      [late],
    )
  )[0].financial_state,
  "refund_pending",
  "refund intention is separate from actual refund",
);
await actor("authenticated", id.admin);
await rpc("refund", {
  batch_id: b.id,
  reference: "bank-ref-late",
  amount: 100,
  refund_reference: "refund-1",
  reason: "Actual transfer returned",
});
await actor("postgres");
eq(
  (
    await query(
      "SELECT financial_state FROM public.specials_checkouts WHERE order_id=$1",
      [late],
    )
  )[0].financial_state,
  "refunded",
  "actual refund recorded",
);
eq(
  (
    await query("SELECT stock_remaining FROM public.cms_products WHERE id=$1", [
      id.product,
    ])
  )[0].stock_remaining,
  20,
  "regular stock untouched",
);
// Whole-cart rollback and cancellation never leak stock or order rows.
await actor("authenticated", id.customer);
const beforeCart = await query("SELECT count(*)::int n FROM public.orders");
await fails(
  () =>
    checkout(
      [
        { item_id: item.id, quantity: 1 },
        { item_id: "99999999-0000-0000-0000-000000000000", quantity: 1 },
      ],
      crypto.randomUUID(),
    ),
  /sold out/,
  "all-cart atomic rejection",
);
eq(
  (await query("SELECT count(*)::int n FROM public.orders"))[0].n,
  beforeCart[0].n,
  "failed cart creates no order",
);
const { order_id: cancelOrder } = await checkout(
  [{ item_id: item.id, quantity: 1 }],
  crypto.randomUUID(),
);
await query("SELECT public.specials_customer_state_v1($1,true)", [cancelOrder]);
await query("SELECT public.specials_customer_state_v1($1,true)", [cancelOrder]);
eq(
  (await state(cancelOrder)).checkout.inventory_state,
  "released",
  "cancel replay releases exactly once",
);
// A verification grace hold survives the existing payment expiry worker.
const { order_id: grace } = await checkout(
  [{ item_id: item.id, quantity: 1 }],
  crypto.randomUUID(),
);
await actor("service_role");
const graceAttempt = crypto.randomUUID();
await query("SELECT public.specials_begin_verification_v1($1,$2,$3,$4)", [
  grace,
  id.customer,
  graceAttempt,
  "private/grace",
]);
await actor("postgres");
await query(
  "UPDATE public.specials_checkouts SET created_at=clock_timestamp()-interval '6 minutes',payment_deadline=clock_timestamp()-interval '1 minute',verification_deadline=clock_timestamp()+interval '1 minute' WHERE order_id=$1",
  [grace],
);
await query(
  "UPDATE specials_private.attempts SET registered_at=clock_timestamp()-interval '2 minutes' WHERE id=$1",
  [graceAttempt],
);
const gracePaid = (
  await query("SELECT clock_timestamp()-interval '3 minutes' t")
)[0].t;
await actor("service_role");
const payment = (
  await query("SELECT id FROM public.payment_transactions WHERE order_id=$1", [
    grace,
  ])
)[0];
await fails(
  () => query("SELECT public.reactivate_expired_online_order_v1($1)", [grace]),
  /authorized Specials workflow/, "regular reactivation cannot reopen Specials",
);
await fails(
  () => query("SELECT public.expire_own_payment_transaction_v1($1)", [payment.id]),
  /authorized Specials workflow/, "regular customer expiry cannot bypass Specials grace",
);
await actor("postgres");
await fails(
  () => query("INSERT INTO public.payment_handoff_sessions(payment_transaction_id,order_id,customer_id,token_hash,expires_at) VALUES($1,$2,$3,$4,clock_timestamp()+interval '5 minutes')", [payment.id,grace,id.customer,"specials-test"]),
  /Specials payment verification/, "privileged regular handoff creation blocked",
);
eq((await query("SELECT public.reactivate_expired_online_order_v1($1) r", [crypto.randomUUID()]))[0].r, {regular:true}, "regular reactivation branch preserved");
await actor("service_role");
await query("SELECT public.expire_payment_transaction_v1($1)", [payment.id]);
await actor("postgres");
eq(
  (
    await query(
      "SELECT inventory_state FROM public.specials_checkouts WHERE order_id=$1",
      [grace],
    )
  )[0].inventory_state,
  "verifying",
  "legacy sweep respects grace",
);
await actor("service_role");
eq(
  (
    await finish(graceAttempt, {
      ...evidence,
      reference: "grace-ref",
      amount: 100,
      paid_at: new Date(gracePaid).toISOString(),
    })
  ).state,
  "verified",
  "timely registered slip succeeds during grace",
);
// Pickup server enforces window and location, even for Admin.
await actor("postgres");
const original = (
  await query(
    "SELECT specials_pickup_snapshot FROM public.orders WHERE id=$1",
    [grace],
  )
)[0].specials_pickup_snapshot;
await query(
  "UPDATE public.orders SET specials_pickup_snapshot=jsonb_set(specials_pickup_snapshot,'{start_at}',to_jsonb(clock_timestamp()+interval '10 minutes')) WHERE id=$1",
  [grace],
);
await actor("authenticated", id.admin);
await fails(
  () =>
    query("SELECT * FROM public.specials_pickup_v1($1,$2)", [grace, id.loc]),
  /Outside same-day/,
  "future pickup blocked",
);
await fails(
  () =>
    query("SELECT * FROM public.specials_pickup_v1($1,$2)", [
      grace,
      "20000000-0000-0000-0000-000000000002",
    ]),
  /Wrong pickup/,
  "wrong location blocked",
);
await actor("postgres");
await query(
  "UPDATE public.orders SET specials_pickup_snapshot=$1 WHERE id=$2",
  [JSON.stringify(original), grace],
);
// Receipt references cannot be reused through the regular finalizer.
await actor("service_role");
await fails(
  () =>
    query(
      "SELECT public.finalize_verified_payment_v1($1,$2,$3,true,true,false)",
      [payment.id, "bank-ref-late", 100],
    ),
  /Specials payment/,
  "cross-rail reference reuse blocked",
);
await actor("authenticated", id.admin);
const config = (await query("SELECT public.specials_admin_details_v1() r"))[0].r
  .settings;
await fails(
  () =>
    rpc("settings", {
      ...config,
      qr_payload: config.qr_payload.slice(0, -1) + "0",
    }),
  /specials_static_merchant_qr/,
  "bad QR CRC rejected",
);
await actor("authenticated", id.customer);
await fails(
  () => query("SELECT public.specials_admin_details_v1()"),
  /Admin required/,
  "receiver configuration private",
);
await actor("service_role");
await fails(
  () => query("SELECT * FROM specials_private.checkout_snapshots"),
  /permission denied/,
  "service cannot read raw snapshots directly",
);

// Missing recipient evidence fails closed; amount mismatch enters the money ledger.
const other = "00000000-0000-0000-0000-000000000004";
await actor("authenticated", other);
const { order_id: mismatch } = await checkout(
  [{ item_id: item.id, quantity: 1 }],
  crypto.randomUUID(),
);
await actor("service_role");
const missingAttempt = crypto.randomUUID();
await query("SELECT public.specials_begin_verification_v1($1,$2,$3,$4)", [
  mismatch,
  other,
  missingAttempt,
  "private/missing",
]);
const missing = { ...evidence, reference: "missing-bank", amount: 100 };
delete missing.bank_code;
eq(
  (await finish(missingAttempt, missing)).state,
  "rejected",
  "missing receiver evidence fails closed",
);
await actor("postgres");
eq(
  (
    await query(
      "SELECT count(*)::int n FROM specials_private.receipts WHERE provider_ref='missing-bank'",
    )
  )[0].n,
  0,
  "wrong recipient is not JOKO money",
);
await actor("service_role");
const mismatchAttempt = crypto.randomUUID();
await query("SELECT public.specials_begin_verification_v1($1,$2,$3,$4)", [
  mismatch,
  other,
  mismatchAttempt,
  "private/amount",
]);
eq(
  (
    await finish(mismatchAttempt, {
      ...evidence,
      reference: "wrong-amount",
      amount: 99,
    })
  ).state,
  "reconciliation_required",
  "wrong amount tracked for reconciliation",
);
await actor("postgres");
eq(
  (
    await query(
      "SELECT amount FROM specials_private.receipts WHERE provider_ref='wrong-amount'",
    )
  )[0].amount,
  "99.00",
  "actual amount retained",
);
await actor("authenticated", other);
const { order_id: expiry } = await checkout(
  [{ item_id: item.id, quantity: 1 }],
  crypto.randomUUID(),
);
await actor("postgres");
await query(
  "UPDATE public.specials_checkouts SET payment_deadline=clock_timestamp()-interval '1 second' WHERE order_id=$1",
  [expiry],
);
const beforeExpiry = (
  await query(
    "SELECT quantity_available FROM public.specials_items WHERE id=$1",
    [item.id],
  )
)[0].quantity_available;
await actor("service_role");
await query("SELECT public.specials_sweep_v1()");
await query("SELECT public.specials_sweep_v1()");
await actor("postgres");
eq(
  (
    await query(
      "SELECT quantity_available FROM public.specials_items WHERE id=$1",
      [item.id],
    )
  )[0].quantity_available,
  beforeExpiry + 1,
  "expiry retry returns stock once",
);
// Updated receiver settings do not rewrite an existing checkout's immutable snapshot.
await actor("authenticated", other);
const { order_id: frozen } = await checkout(
  [{ item_id: item.id, quantity: 1 }],
  crypto.randomUUID(),
);
await actor("authenticated", id.admin);
await rpc("settings", { ...config, receiver_bank_number: "9999999999" });
await actor("service_role");
const frozenAttempt = crypto.randomUUID();
await query("SELECT public.specials_begin_verification_v1($1,$2,$3,$4)", [
  frozen,
  other,
  frozenAttempt,
  "private/frozen",
]);
eq(
  (
    await finish(frozenAttempt, {
      ...evidence,
      reference: "snapshot-ref",
      amount: 100,
      paid_at: new Date().toISOString(),
    })
  ).state,
  "verified",
  "receiver snapshot survives settings change",
);
// Closed sales reject new holds but retain already paid pickup rights.
await actor("authenticated", id.admin);
const live = (
  await query("SELECT version FROM public.specials_batches WHERE id=$1", [b.id])
)[0];
await rpc("close", {
  batch_id: b.id,
  expected_version: live.version,
  reason: "Sales closed",
});
await actor("authenticated", other);
await fails(
  () => checkout([{ item_id: item.id, quantity: 1 }], crypto.randomUUID()),
  /Checkout is closed/,
  "closed sale rejects new orders",
);
await actor("authenticated", id.staff);
eq(
  (
    await query("SELECT * FROM public.specials_pickup_v1($1,$2)", [
      frozen,
      id.loc,
    ])
  )[0].status,
  "picked_up",
  "closing sales preserves paid pickup",
);
// No-show is a fulfillment state, never a refund or stock return.
await actor("postgres");
await query(
  "UPDATE public.specials_batches SET pickup_end_at=clock_timestamp()-interval '1 second',sales_end_at=clock_timestamp()-interval '16 minutes',sales_start_at=clock_timestamp()-interval '40 minutes',pickup_start_at=clock_timestamp()-interval '30 minutes' WHERE id=$1",
  [b.id],
);
const noShowStock = (
  await query(
    "SELECT quantity_committed FROM public.specials_items WHERE id=$1",
    [item.id],
  )
)[0].quantity_committed;
await actor("service_role");
await query("SELECT public.specials_sweep_v1()");
await actor("postgres");
eq(
  (
    await query(
      "SELECT financial_state,fulfillment_state FROM public.specials_checkouts WHERE order_id=$1",
      [grace],
    )
  )[0],
  { financial_state: "verified", fulfillment_state: "no_show" },
  "no-show does not imply refund",
);
eq(
  (
    await query(
      "SELECT quantity_committed FROM public.specials_items WHERE id=$1",
      [item.id],
    )
  )[0].quantity_committed,
  noShowStock,
  "no-show stock remains committed",
);

await actor("postgres");
eq(
  (
    await query("SELECT loyalty_points_earned FROM public.orders WHERE id=$1", [
      order,
    ])
  )[0].loyalty_points_earned,
  0,
  "existing loyalty trigger neutralized for Specials",
);
// Regular transactions still follow the deployed Stripe selector and retain their deadline.
const regularOrder = crypto.randomUUID();
await query("INSERT INTO public.orders(id,customer_id,order_number,customer_name,customer_phone,total_amount) VALUES($1,$2,'REGULAR-TEST','Test','0812345678',100)",[regularOrder,id.customer]);
const regularPayment=(await query("INSERT INTO public.payment_transactions(order_id,customer_id,amount_due,expires_at) VALUES($1,$2,100,clock_timestamp()+interval '15 minutes') RETURNING provider,payment_mode,round(extract(epoch FROM expires_at-created_at)) AS seconds",[regularOrder,id.customer]))[0];
eq([regularPayment.provider,regularPayment.payment_mode,Number(regularPayment.seconds)],['stripe','stripe_promptpay',900],"regular Stripe selection and fifteen-minute deadline untouched");
const ts = await import("typescript");
const source = await readFile(
  "supabase/functions/_shared/kshop-master-qr.ts",
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { buildKShopMasterPayload } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const amountQr = buildKShopMasterPayload(config.qr_payload, 123.45);
eq(
  amountQr.includes("5406123.45"),
  true,
  "shared K SHOP generator embeds exact amount",
);
eq(amountQr.includes("010211"), true, "genuine static initiation preserved");
eq(
  amountQr.includes("29370016A00000067701011101130066812345678"),
  true,
  "merchant data preserved",
);
eq(
  amountQr.slice(-4),
  "15C9",
  "amount QR CRC matches independent golden fixture",
);
console.log(`${count} Specials checkout/payment/pickup/LINE assertions passed`);
await db.close();
