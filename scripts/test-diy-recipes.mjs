import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import ts from "typescript";
import { pathToFileURL } from "node:url";
if (!process.env.PGLITE_MODULE)
  throw new Error(
    "Set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js (see CI).",
  );
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const source = await readFile("src/app/joko-today/diy/recipe/model.ts", "utf8");
const js = ts.transpile(source, {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2022,
});
const { parseRecipe, publishProblems, youtubeEmbed } = await import(
  `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
);
const recipe = JSON.parse(
  await readFile("public/templates/joko-recipe-v1.example.json", "utf8"),
);
let checks = 0;
function ok(condition, message) {
  assert.ok(condition, message);
  checks++;
}
parseRecipe(recipe);
checks++;
assert.throws(() => parseRecipe({ ...recipe, schema_version: "other" }));
checks++;
assert.throws(() => parseRecipe({ ...recipe, ingredients: "wrong" }));
checks++;
assert.throws(() =>
  parseRecipe({
    ...recipe,
    source: { ...recipe.source, url: "javascript:alert(1)" },
  }),
);
checks++;
assert.throws(() =>
  parseRecipe({
    ...recipe,
    hero: { ...recipe.hero, url: "https://user:pass@example.com/a" },
  }),
);
checks++;
assert.throws(() => parseRecipe({ ...recipe, title: { en: "missing" } }));
checks++;
assert.throws(() => parseRecipe({ ...recipe, extra: "discard me" }));
checks++;
ok(publishProblems(recipe).length > 0, "Unapproved image blocks publish");
ok(
  youtubeEmbed("https://evil.example/watch?v=Ka3n5qB2JrE") === null,
  "Embed allowlist",
);
ok(
  youtubeEmbed("https://youtu.be/Ka3n5qB2JrE")?.includes(
    "youtube-nocookie.com",
  ),
  "Official embed",
);
const db = new PGlite();
const sql = (s, p = []) => db.query(s, p);
const admin = "00000000-0000-4000-8000-000000000001",
  alice = "00000000-0000-4000-8000-000000000002",
  bob = "00000000-0000-4000-8000-000000000003";
await db.exec(
  `create role anon nologin; create role authenticated nologin; create schema auth; create schema storage; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth,public,storage to anon,authenticated; grant execute on function auth.uid() to anon,authenticated; create table user_profiles(id uuid primary key,role text,name text); grant select on user_profiles to authenticated; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,primary key(bucket_id,name)); alter table storage.objects enable row level security; grant select,insert,update,delete on storage.objects to anon,authenticated; insert into auth.users values('${admin}'),('${alice}'),('${bob}'); insert into user_profiles values('${admin}','admin','JOKO'),('${alice}','customer','Alice'),('${bob}','customer','Bob');`,
);
await db.exec("alter default privileges in schema public grant execute on functions to anon,authenticated");
await db.exec(
  await readFile(
    "supabase/migrations/20261023032148_joko_diy_recipes_comments_v1.sql",
    "utf8",
  ),
);
await db.exec(await readFile("supabase/migrations/20261023081302_joko_diy_recipe_rpc_privileges_v1.sql", "utf8"));
ok((await sql("select has_function_privilege('anon','public.diy_start_comment(uuid,text)','execute') as allowed")).rows[0].allowed === false, "Supabase default anon RPC grant revoked");
async function as(uid, role, fn) {
  await db.exec("reset role");
  await sql("select set_config('request.jwt.claim.sub',$1,false)", [uid ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
async function denied(fn, label) {
  await assert.rejects(fn, label);
  checks++;
}
const ready = structuredClone(recipe);
ready.hero = {
  ...ready.hero,
  url: "https://example.com/photo.webp",
  permission: "permitted",
  credit: "Test fixture",
};
let id;
await as(admin, "authenticated", async () => {
  id = (
    await sql(
      "insert into diy_recipe_drafts(slug,payload) values($1,$2) returning id",
      [ready.slug, ready],
    )
  ).rows[0].id;
  await sql("select diy_publish_recipe($1,1)", [id]);
  checks++;
});
await as(null, "anon", async () => {
  ok(
    (await sql("select * from diy_recipes")).rows.length === 1,
    "Public snapshot",
  );
  ok(
    (await sql("select payload from diy_recipes")).rows[0].payload.evidence
      .length === 0,
    "Editorial evidence omitted from public snapshot",
  );
  await denied(() => sql("select * from diy_recipe_drafts"), "Draft hidden");
});
await as(alice, "authenticated", async () => {
  ok(
    (await sql("select * from diy_recipe_drafts")).rows.length === 0,
    "Customer cannot read draft",
  );
  await denied(
    () => sql("select diy_publish_recipe($1,1)", [id]),
    "Customer cannot publish",
  );
});
await as(admin, "authenticated", async () => {
  await sql(
    "update diy_recipe_drafts set payload=jsonb_set(payload,'{title,en}','\"Unpublished edit\"') where id=$1",
    [id],
  );
  ok(
    (await sql("select payload from diy_recipes where id=$1", [id])).rows[0]
      .payload.title.en === ready.title.en,
    "Draft edits do not change public content",
  );
  await denied(
    () => sql("select diy_publish_recipe($1,1)", [id]),
    "Stale revision cannot publish",
  );
});
let cid;
await as(alice, "authenticated", async () => {
  cid = (
    await sql("select diy_start_comment($1,$2) id", [
      id,
      "My baking experience",
    ])
  ).rows[0].id;
  await denied(
    () =>
      sql("update diy_comment_submissions set status='approved' where id=$1", [
        cid,
      ]),
    "Cannot self-approve",
  );
});
const photo = `${alice}/${cid}/0.webp`;
await as(bob, "authenticated", async () => {
  ok(
    (await sql("select * from diy_comment_submissions")).rows.length === 0,
    "Other account cannot read submission",
  );
  await denied(
    () =>
      sql("insert into storage.objects(bucket_id,name) values($1,$2)", [
        "diy-comment-photos",
        photo,
      ]),
    "Other account cannot upload",
  );
  await denied(
    () => sql("select diy_finish_comment($1,$2)", [cid, []]),
    "Other account cannot submit",
  );
});
await as(alice, "authenticated", async () => {
  await sql("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "diy-comment-photos",
    photo,
  ]);
  await denied(
    () => sql("select diy_finish_comment($1,$2)", [cid, [photo, photo]]),
    "Duplicate paths rejected",
  );
  await sql("select diy_finish_comment($1,$2)", [cid, [photo]]);
  await denied(
    () => sql("select diy_moderate_comment($1,true,1)", [cid]),
    "Customer cannot approve",
  );
  ok(
    (await sql("select * from storage.objects")).rows.length === 1,
    "Owner sees own photo",
  );
});
await as(null, "anon", async () => {
  ok(
    (await sql("select * from diy_recipe_comments")).rows.length === 0,
    "Pending comments hidden",
  );
  ok(
    (await sql("select * from storage.objects")).rows.length === 0,
    "Pending photos hidden",
  );
});
await as(admin, "authenticated", async () => {
  await sql("select diy_moderate_comment($1,true,1)", [cid]);
});
await as(null, "anon", async () => {
  const rows = (await sql("select * from diy_recipe_comments")).rows;
  ok(
    rows.length === 1 && !("user_id" in rows[0]),
    "Approved snapshot has no account ID",
  );
  ok(
    (await sql("select * from storage.objects")).rows.length === 1,
    "Approved image readable",
  );
});
await as(alice, "authenticated", async () => {
  ok(
    (
      await sql(
        "update storage.objects set name=name where name=$1 returning name",
        [photo],
      )
    ).rows.length === 0,
    "Approved file cannot be replaced",
  );
  await sql("select diy_revise_comment($1,$2,2)", [cid, "Revised experience"]);
});
await as(null, "anon", async () => {
  ok(
    (await sql("select * from diy_recipe_comments")).rows.length === 0,
    "Edit hides old comment",
  );
  ok(
    (await sql("select * from storage.objects")).rows.length === 0,
    "Edit hides photos until reapproval",
  );
});
await as(admin, "authenticated", async () => {
  await denied(
    () => sql("select diy_moderate_comment($1,true,2)", [cid]),
    "Stale moderation blocked",
  );
  await sql("select diy_moderate_comment($1,false,3)", [cid]);
});
await as(bob, "authenticated", async () => {
  await sql("select diy_withdraw_comment($1)", [cid]);
});
await as(alice, "authenticated", async () => {
  ok(
    (await sql("select * from diy_comment_submissions")).rows.length === 1,
    "Other account cannot withdraw",
  );
  await sql("select diy_withdraw_comment($1)", [cid]);
  ok(
    (await sql("select * from diy_comment_submissions")).rows.length === 0,
    "Owner can withdraw",
  );
});
await db.close();
console.log(
  `PASS: ${checks} recipe import, publication, ownership, moderation and photo RLS assertions (isolated PostgreSQL).`,
);
