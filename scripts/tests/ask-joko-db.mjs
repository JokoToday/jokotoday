import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contentFixture } from "./ask-joko-fixture.mjs";
const { PGlite } = await import(
  process.env.JOKO_TEST_PGLITE_MODULE || "@electric-sql/pglite"
);
const db = new PGlite();
const admin = "00000000-0000-4000-8000-000000000001";
const customer = "00000000-0000-4000-8000-000000000002";
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA private; CREATE SCHEMA auth;
    CREATE TABLE public.user_profiles(id uuid PRIMARY KEY, role text);
    INSERT INTO public.user_profiles VALUES ('${admin}','admin'), ('${customer}','customer');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE FUNCTION private.current_user_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id=auth.uid() AND role='admin') $$;`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261013030405_ask_joko_content_v1.sql",
      "utf8",
    ),
  );
  const role = async (r, id = "") => {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec(`SET ROLE ${r}`);
  };
  const scalar = async (sql, args = []) =>
    (await db.query(sql, args)).rows[0].result;
  const forbidden = async (sql, args = []) =>
    assert.rejects(
      db.query(sql, args),
      /permission denied|Admin access required/,
    );
  await role("anon");
  assert.equal(
    await scalar("SELECT public.get_published_ask_joko_v1() AS result"),
    null,
  );
  await forbidden("SELECT public.get_admin_ask_joko_v1()");
  await forbidden("SELECT * FROM private.ask_joko_content");
  await forbidden("SELECT public.save_ask_joko_draft_v1($1,0)", [
    contentFixture,
  ]);
  await role("authenticated", customer);
  await forbidden("SELECT public.get_admin_ask_joko_v1()");
  await forbidden("SELECT public.save_ask_joko_draft_v1($1,0)", [
    contentFixture,
  ]);
  await forbidden("SELECT public.publish_ask_joko_v1(0)");
  await forbidden("SELECT * FROM private.ask_joko_content");
  await role("authenticated", admin);
  let state = await scalar(
    "SELECT public.save_ask_joko_draft_v1($1,0) AS result",
    [contentFixture],
  );
  assert.equal(state.version, 1);
  assert.equal(state.draft.questions.length, 7);
  await assert.rejects(
    db.query("SELECT public.save_ask_joko_draft_v1($1,0)", [contentFixture]),
    /changed elsewhere/,
  );
  await role("anon");
  assert.equal(
    await scalar("SELECT public.get_published_ask_joko_v1() AS result"),
    null,
  );
  await role("authenticated", admin);
  state = await scalar("SELECT public.publish_ask_joko_v1(1) AS result");
  assert.equal(state.version, 2);
  await role("anon");
  const published = await scalar(
    "SELECT public.get_published_ask_joko_v1() AS result",
  );
  assert.equal(published.questions.length, 5);
  assert.equal(JSON.stringify(published).includes("SECRET_DRAFT"), false);
  assert.equal(JSON.stringify(published).includes("vegan-unverified"), false);
  await forbidden("UPDATE private.ask_joko_content SET published=null");
  await role("authenticated", admin);
  const edited = structuredClone(contentFixture);
  edited.questions[0].answer.en = "NEW_UNPUBLISHED_ANSWER";
  state = await scalar("SELECT public.save_ask_joko_draft_v1($1,2) AS result", [
    edited,
  ]);
  assert.equal(state.version, 3);
  await role("anon");
  assert.equal(
    JSON.stringify(
      await scalar("SELECT public.get_published_ask_joko_v1() AS result"),
    ).includes("NEW_UNPUBLISHED_ANSWER"),
    false,
  );
  await role("authenticated", admin);
  await assert.rejects(
    db.query("SELECT public.publish_ask_joko_v1(2)"),
    /changed elsewhere/,
  );
  const unsafe = structuredClone(edited);
  unsafe.questions[0].links[0].path = "javascript:alert(1)";
  await assert.rejects(
    db.query("SELECT public.save_ask_joko_draft_v1($1,3)", [unsafe]),
    /Invalid related page/,
  );
  const duplicate = structuredClone(edited);
  duplicate.questions.push(duplicate.questions[0]);
  await assert.rejects(
    db.query("SELECT public.save_ask_joko_draft_v1($1,3)", [duplicate]),
    /Invalid question/,
  );
  console.log(
    "PASS isolated PostgreSQL: anon/customer denials, private drafts, explicit publication, dietary verification, conflict checks and unsafe content rejection",
  );
} finally {
  await db.close();
}
