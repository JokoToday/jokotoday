-- Curiosity persistence, Admin publishing, and real wonder signals v1.
-- Draft content is private; public readers only receive immutable published revisions.

create table public.curiosities (
  id text primary key,
  site_id uuid not null references public.platform_sites(id) on delete restrict,
  slug text not null,
  schema_version integer not null default 1 check (schema_version = 1),
  scope text not null check (scope in ('shared', 'local')),
  answer_status text not null check (answer_status in ('unanswered', 'partial', 'answered', 'still-wondering')),
  origin_type text not null check (origin_type in ('editorial', 'community', 'product', 'place', 'person', 'jokomi', 'system')),
  topics text[] not null default '{}'::text[],
  draft_document jsonb not null,
  lock_version bigint not null default 1 check (lock_version > 0),
  draft_updated_at timestamptz not null default now(),
  draft_updated_by uuid references auth.users(id) on delete set null,
  published_revision_id uuid,
  published_at timestamptz,
  published_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint curiosities_site_slug_key unique (site_id, slug),
  constraint curiosities_id_format check (id ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint curiosities_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  constraint curiosities_topics_nonempty check (cardinality(topics) > 0),
  constraint curiosities_draft_object check (jsonb_typeof(draft_document) = 'object')
);

create table public.curiosity_revisions (
  id uuid primary key default gen_random_uuid(),
  curiosity_id text not null references public.curiosities(id) on delete cascade,
  revision_number bigint not null check (revision_number > 0),
  document jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id) on delete set null,
  constraint curiosity_revisions_number_key unique (curiosity_id, revision_number),
  constraint curiosity_revisions_document_object check (jsonb_typeof(document) = 'object')
);

alter table public.curiosities
  add constraint curiosities_published_revision_fkey
  foreign key (published_revision_id)
  references public.curiosity_revisions(id)
  on delete set null;

create table public.curiosity_wonders (
  id bigint generated always as identity primary key,
  curiosity_id text not null references public.curiosities(id) on delete cascade,
  reader_token uuid not null,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index curiosity_wonders_anonymous_key
  on public.curiosity_wonders (curiosity_id, reader_token)
  where user_id is null;

create unique index curiosity_wonders_authenticated_key
  on public.curiosity_wonders (curiosity_id, user_id)
  where user_id is not null;

create index curiosity_wonders_curiosity_idx
  on public.curiosity_wonders (curiosity_id, created_at);

create index curiosities_site_published_idx
  on public.curiosities (site_id, published_at desc)
  where published_revision_id is not null;

create index curiosities_topics_idx
  on public.curiosities using gin (topics);

alter table public.curiosities enable row level security;
alter table public.curiosity_revisions enable row level security;
alter table public.curiosity_wonders enable row level security;

revoke all on table public.curiosities from anon, authenticated;
revoke all on table public.curiosity_revisions from anon, authenticated;
revoke all on table public.curiosity_wonders from anon, authenticated;
revoke all on sequence public.curiosity_wonders_id_seq from anon, authenticated;

create or replace function private.prevent_curiosity_revision_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Published Curiosity revisions are immutable.' using errcode = '55000';
end;
$$;

create trigger curiosity_revisions_immutable_v1
before update or delete on public.curiosity_revisions
for each row execute function private.prevent_curiosity_revision_mutation_v1();

create or replace function private.assert_curiosity_document_v1(
  p_document jsonb,
  p_expected_id text,
  p_site_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_site_key text;
  v_locales text[];
  v_locale text;
  v_topic jsonb;
begin
  if p_document is null or jsonb_typeof(p_document) <> 'object' then
    raise exception 'Curiosity document must be a JSON object.' using errcode = '22023';
  end if;

  if octet_length(p_document::text) > 524288 then
    raise exception 'Curiosity document exceeds the 512 KiB limit.' using errcode = '22001';
  end if;

  select s.site_key, s.supported_locales
    into v_site_key, v_locales
  from public.platform_sites s
  where s.id = p_site_id;

  if v_site_key is null then
    raise exception 'Unknown Curiosity site.' using errcode = '22023';
  end if;

  if (p_document->>'schemaVersion')::integer <> 1 then
    raise exception 'Unsupported Curiosity schema version.' using errcode = '22023';
  end if;

  if nullif(btrim(p_document->>'id'), '') is null
     or p_document->>'id' !~ '^[a-z0-9][a-z0-9-]*$' then
    raise exception 'Curiosity id is invalid.' using errcode = '22023';
  end if;

  if p_expected_id is not null and p_document->>'id' <> p_expected_id then
    raise exception 'Curiosity document id does not match the stored id.' using errcode = '22023';
  end if;

  if nullif(btrim(p_document->>'slug'), '') is null
     or p_document->>'slug' !~ '^[a-z0-9][a-z0-9-]*$' then
    raise exception 'Curiosity slug is invalid.' using errcode = '22023';
  end if;

  if p_document->>'status' not in ('draft', 'researching', 'review', 'published', 'archived') then
    raise exception 'Curiosity status is invalid.' using errcode = '22023';
  end if;

  if p_document->>'scope' not in ('shared', 'local') then
    raise exception 'Curiosity scope is invalid.' using errcode = '22023';
  end if;

  if p_document->>'scope' = 'local' and p_document->>'siteId' <> v_site_key then
    raise exception 'Local Curiosity siteId must match the owning site.' using errcode = '22023';
  end if;

  if p_document->>'answerStatus' not in ('unanswered', 'partial', 'answered', 'still-wondering') then
    raise exception 'Curiosity answerStatus is invalid.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_document->'origin') <> 'object'
     or p_document#>>'{origin,type}' not in ('editorial', 'community', 'product', 'place', 'person', 'jokomi', 'system') then
    raise exception 'Curiosity origin is invalid.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_document->'question') <> 'object'
     or jsonb_typeof(p_document->'summary') <> 'object' then
    raise exception 'Curiosity question and summary must be localized objects.' using errcode = '22023';
  end if;

  foreach v_locale in array v_locales loop
    if nullif(btrim(p_document #>> array['question', v_locale]), '') is null then
      raise exception 'Curiosity question.% is required.', v_locale using errcode = '22023';
    end if;
    if nullif(btrim(p_document #>> array['summary', v_locale]), '') is null then
      raise exception 'Curiosity summary.% is required.', v_locale using errcode = '22023';
    end if;
  end loop;

  if p_document ? 'shortAnswer' then
    if jsonb_typeof(p_document->'shortAnswer') <> 'object' then
      raise exception 'Curiosity shortAnswer must be a localized object.' using errcode = '22023';
    end if;
    foreach v_locale in array v_locales loop
      if nullif(btrim(p_document #>> array['shortAnswer', v_locale]), '') is null then
        raise exception 'Curiosity shortAnswer.% is required when shortAnswer exists.', v_locale using errcode = '22023';
      end if;
    end loop;
  end if;

  if p_document ? 'fullAnswer' then
    if jsonb_typeof(p_document->'fullAnswer') <> 'object' then
      raise exception 'Curiosity fullAnswer must be a localized object.' using errcode = '22023';
    end if;
    foreach v_locale in array v_locales loop
      if nullif(btrim(p_document #>> array['fullAnswer', v_locale]), '') is null then
        raise exception 'Curiosity fullAnswer.% is required when fullAnswer exists.', v_locale using errcode = '22023';
      end if;
    end loop;
  end if;

  if jsonb_typeof(p_document->'topics') <> 'array'
     or jsonb_array_length(p_document->'topics') = 0 then
    raise exception 'Curiosity requires at least one topic.' using errcode = '22023';
  end if;

  for v_topic in select value from jsonb_array_elements(p_document->'topics') loop
    if jsonb_typeof(v_topic) <> 'string' or nullif(btrim(v_topic #>> '{}'), '') is null then
      raise exception 'Curiosity topics must be non-empty strings.' using errcode = '22023';
    end if;
  end loop;

  if p_document->>'answerStatus' = 'answered'
     and not (p_document ? 'shortAnswer')
     and not (p_document ? 'fullAnswer')
     and not (
       jsonb_typeof(p_document->'steps') = 'array'
       and jsonb_array_length(p_document->'steps') > 0
     ) then
    raise exception 'Answered Curiosity requires answer content.' using errcode = '22023';
  end if;

  if p_document ? 'steps'
     and (jsonb_typeof(p_document->'steps') <> 'array' or jsonb_array_length(p_document->'steps') = 0) then
    raise exception 'Curiosity steps must be a non-empty array when present.' using errcode = '22023';
  end if;

  if p_document->>'status' = 'published' then
    if nullif(btrim(p_document->>'publishedAt'), '') is null then
      raise exception 'Published Curiosity requires publishedAt.' using errcode = '22023';
    end if;
    perform (p_document->>'publishedAt')::timestamptz;
  end if;
end;
$$;

create or replace function private.curiosity_state_v1(p_curiosity_id text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exists', true,
    'curiosityId', c.id,
    'slug', c.slug,
    'lockVersion', c.lock_version,
    'draft', jsonb_build_object(
      'document', c.draft_document,
      'updatedAt', c.draft_updated_at,
      'updatedBy', c.draft_updated_by
    ),
    'published', case
      when r.id is null then null
      else jsonb_build_object(
        'revisionId', r.id,
        'revisionNumber', r.revision_number,
        'publishedAt', r.published_at,
        'publishedBy', r.published_by
      )
    end,
    'wonderCount', coalesce(w.wonder_count, 0)
  )
  from public.curiosities c
  left join public.curiosity_revisions r on r.id = c.published_revision_id
  left join lateral (
    select count(*)::bigint as wonder_count
    from public.curiosity_wonders cw
    where cw.curiosity_id = c.id
  ) w on true
  where c.id = p_curiosity_id;
$$;

create or replace function private.admin_list_curiosities_v1(p_site_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site_id uuid;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin role required.' using errcode = '42501';
  end if;

  select s.id into v_site_id
  from public.platform_sites s
  where s.site_key = p_site_key;

  if v_site_id is null then
    raise exception 'Unknown Curiosity site.' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(private.curiosity_state_v1(c.id) order by c.created_at desc, c.id)
    from public.curiosities c
    where c.site_id = v_site_id
  ), '[]'::jsonb);
end;
$$;

create or replace function private.admin_initialize_curiosity_v1(
  p_site_key text,
  p_document jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site_id uuid;
  v_curiosity_id text;
  v_existing_site_id uuid;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin role required.' using errcode = '42501';
  end if;

  select s.id into v_site_id
  from public.platform_sites s
  where s.site_key = p_site_key;

  if v_site_id is null then
    raise exception 'Unknown Curiosity site.' using errcode = '22023';
  end if;

  v_curiosity_id := p_document->>'id';
  perform private.assert_curiosity_document_v1(p_document, v_curiosity_id, v_site_id);

  select c.site_id into v_existing_site_id
  from public.curiosities c
  where c.id = v_curiosity_id;

  if v_existing_site_id is not null and v_existing_site_id <> v_site_id then
    raise exception 'Curiosity id already belongs to another site.' using errcode = '23505';
  end if;

  insert into public.curiosities (
    id, site_id, slug, schema_version, scope, answer_status, origin_type, topics,
    draft_document, draft_updated_by, created_by
  ) values (
    v_curiosity_id,
    v_site_id,
    p_document->>'slug',
    (p_document->>'schemaVersion')::integer,
    p_document->>'scope',
    p_document->>'answerStatus',
    p_document#>>'{origin,type}',
    array(select jsonb_array_elements_text(p_document->'topics')),
    p_document,
    (select auth.uid()),
    (select auth.uid())
  )
  on conflict (id) do nothing;

  return private.curiosity_state_v1(v_curiosity_id);
end;
$$;

create or replace function private.admin_save_curiosity_draft_v1(
  p_curiosity_id text,
  p_document jsonb,
  p_expected_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site_id uuid;
  v_lock_version bigint;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin role required.' using errcode = '42501';
  end if;

  select c.site_id, c.lock_version
    into v_site_id, v_lock_version
  from public.curiosities c
  where c.id = p_curiosity_id
  for update;

  if v_site_id is null then
    raise exception 'Curiosity not found.' using errcode = 'P0002';
  end if;

  if v_lock_version <> p_expected_lock_version then
    raise exception 'Curiosity draft changed in another Admin session.' using errcode = '40001';
  end if;

  perform private.assert_curiosity_document_v1(p_document, p_curiosity_id, v_site_id);

  update public.curiosities c
  set slug = p_document->>'slug',
      schema_version = (p_document->>'schemaVersion')::integer,
      scope = p_document->>'scope',
      answer_status = p_document->>'answerStatus',
      origin_type = p_document#>>'{origin,type}',
      topics = array(select jsonb_array_elements_text(p_document->'topics')),
      draft_document = p_document,
      lock_version = c.lock_version + 1,
      draft_updated_at = now(),
      draft_updated_by = (select auth.uid())
  where c.id = p_curiosity_id;

  return private.curiosity_state_v1(p_curiosity_id);
end;
$$;

create or replace function private.admin_publish_curiosity_v1(
  p_curiosity_id text,
  p_expected_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.curiosities%rowtype;
  v_revision_id uuid;
  v_revision_number bigint;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin role required.' using errcode = '42501';
  end if;

  select c.* into v_row
  from public.curiosities c
  where c.id = p_curiosity_id
  for update;
  if not found then
    raise exception 'Curiosity not found.' using errcode = 'P0002';
  end if;

  if v_row.lock_version <> p_expected_lock_version then
    raise exception 'Curiosity draft changed in another Admin session.' using errcode = '40001';
  end if;

  perform private.assert_curiosity_document_v1(v_row.draft_document, v_row.id, v_row.site_id);

  if v_row.draft_document->>'status' <> 'published'
     or nullif(btrim(v_row.draft_document->>'publishedAt'), '') is null then
    raise exception 'Save the Curiosity as published before publishing a revision.' using errcode = '22023';
  end if;

  select coalesce(max(r.revision_number), 0) + 1
    into v_revision_number
  from public.curiosity_revisions r
  where r.curiosity_id = v_row.id;

  insert into public.curiosity_revisions (
    curiosity_id, revision_number, document, published_by
  ) values (
    v_row.id, v_revision_number, v_row.draft_document, (select auth.uid())
  ) returning id into v_revision_id;
  update public.curiosities c
  set published_revision_id = v_revision_id,
      published_at = now(),
      published_by = (select auth.uid()),
      lock_version = c.lock_version + 1
  where c.id = v_row.id;

  return private.curiosity_state_v1(v_row.id);
end;
$$;

create or replace function private.get_published_curiosity_catalog_v1(
  p_site_key text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(r.document order by c.published_at desc, c.id), '[]'::jsonb)
  from public.platform_sites s
  join public.curiosities c on c.site_id = s.id
  join public.curiosity_revisions r on r.id = c.published_revision_id
  where s.site_key = p_site_key;
$$;
create or replace function private.curiosity_wonder_counts_v1(
  p_reader_token uuid
)
returns table(curiosity_id text, wonder_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, count(cw.id)::bigint
  from public.curiosities c
  left join public.curiosity_wonders cw on cw.curiosity_id = c.id
  where c.published_revision_id is not null
  group by c.id
  order by c.id;
$$;

create or replace function private.curiosity_wonder_state_v1(
  p_curiosity_id text,
  p_reader_token uuid
)
returns table(wonder_count bigint, wondered boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not exists (
    select 1 from public.curiosities c
    where c.id = p_curiosity_id and c.published_revision_id is not null
  ) then
    return query select 0::bigint, false;
    return;
  end if;
  return query
  select
    count(cw.id)::bigint,
    exists (
      select 1
      from public.curiosity_wonders mine
      where mine.curiosity_id = p_curiosity_id
        and (
          (v_user_id is not null and mine.user_id = v_user_id)
          or (mine.user_id is null and mine.reader_token = p_reader_token)
        )
    )
  from public.curiosity_wonders cw
  where cw.curiosity_id = p_curiosity_id;
end;
$$;

create or replace function private.curiosity_toggle_wonder_v1(
  p_curiosity_id text,
  p_reader_token uuid
)
returns table(wonder_count bigint, wondered boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_exists boolean;
begin
  perform c.id
  from public.curiosities c
  where c.id = p_curiosity_id
    and c.published_revision_id is not null
  for update;

  if not found then
    raise exception 'Published Curiosity not found.' using errcode = 'P0002';
  end if;
  select exists (
    select 1
    from public.curiosity_wonders cw
    where cw.curiosity_id = p_curiosity_id
      and (
        (v_user_id is not null and cw.user_id = v_user_id)
        or (cw.user_id is null and cw.reader_token = p_reader_token)
      )
  ) into v_exists;

  if v_exists then
    delete from public.curiosity_wonders cw
    where cw.curiosity_id = p_curiosity_id
      and (
        (v_user_id is not null and cw.user_id = v_user_id)
        or (cw.user_id is null and cw.reader_token = p_reader_token)
      );
  elsif v_user_id is not null then
    update public.curiosity_wonders cw
    set user_id = v_user_id
    where cw.curiosity_id = p_curiosity_id
      and cw.user_id is null
      and cw.reader_token = p_reader_token;

    if not found then
      insert into public.curiosity_wonders (curiosity_id, reader_token, user_id)
      values (p_curiosity_id, p_reader_token, v_user_id);
    end if;
  else
    insert into public.curiosity_wonders (curiosity_id, reader_token)
    values (p_curiosity_id, p_reader_token);
  end if;
  return query
  select
    count(cw.id)::bigint,
    exists (
      select 1
      from public.curiosity_wonders mine
      where mine.curiosity_id = p_curiosity_id
        and (
          (v_user_id is not null and mine.user_id = v_user_id)
          or (mine.user_id is null and mine.reader_token = p_reader_token)
        )
    )
  from public.curiosity_wonders cw
  where cw.curiosity_id = p_curiosity_id;
end;
$$;

-- Public SECURITY INVOKER wrappers keep the exposed API thin.
create or replace function public.get_published_curiosity_catalog_v1(p_site_key text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_published_curiosity_catalog_v1(p_site_key);
$$;

create or replace function public.curiosity_wonder_counts_v1(p_reader_token uuid)
returns table(curiosity_id text, wonder_count bigint)
language sql
security invoker
set search_path = ''
as $$
  select * from private.curiosity_wonder_counts_v1(p_reader_token);
$$;
create or replace function public.curiosity_wonder_state_v1(
  p_curiosity_id text,
  p_reader_token uuid
)
returns table(wonder_count bigint, wondered boolean)
language sql
security invoker
set search_path = ''
as $$
  select * from private.curiosity_wonder_state_v1(p_curiosity_id, p_reader_token);
$$;

create or replace function public.curiosity_toggle_wonder_v1(
  p_curiosity_id text,
  p_reader_token uuid
)
returns table(wonder_count bigint, wondered boolean)
language sql
security invoker
set search_path = ''
as $$
  select * from private.curiosity_toggle_wonder_v1(p_curiosity_id, p_reader_token);
$$;

create or replace function public.admin_list_curiosities_v1(p_site_key text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_list_curiosities_v1(p_site_key);
$$;

create or replace function public.admin_initialize_curiosity_v1(
  p_site_key text,
  p_document jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_initialize_curiosity_v1(p_site_key, p_document);
$$;
create or replace function public.admin_save_curiosity_draft_v1(
  p_curiosity_id text,
  p_document jsonb,
  p_expected_lock_version bigint
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_save_curiosity_draft_v1(
    p_curiosity_id,
    p_document,
    p_expected_lock_version
  );
$$;

create or replace function public.admin_publish_curiosity_v1(
  p_curiosity_id text,
  p_expected_lock_version bigint
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_publish_curiosity_v1(
    p_curiosity_id,
    p_expected_lock_version
  );
$$;

-- Default PUBLIC execute is revoked explicitly.
revoke all on function private.prevent_curiosity_revision_mutation_v1() from public, anon, authenticated;
revoke all on function private.assert_curiosity_document_v1(jsonb, text, uuid) from public, anon, authenticated;
revoke all on function private.curiosity_state_v1(text) from public, anon, authenticated;
revoke all on function private.admin_list_curiosities_v1(text) from public, anon, authenticated;
revoke all on function private.admin_initialize_curiosity_v1(text, jsonb) from public, anon, authenticated;
revoke all on function private.admin_save_curiosity_draft_v1(text, jsonb, bigint) from public, anon, authenticated;
revoke all on function private.admin_publish_curiosity_v1(text, bigint) from public, anon, authenticated;
revoke all on function private.get_published_curiosity_catalog_v1(text) from public, anon, authenticated;
revoke all on function private.curiosity_wonder_counts_v1(uuid) from public, anon, authenticated;
revoke all on function private.curiosity_wonder_state_v1(text, uuid) from public, anon, authenticated;
revoke all on function private.curiosity_toggle_wonder_v1(text, uuid) from public, anon, authenticated;

grant usage on schema private to anon, authenticated;

grant execute on function private.get_published_curiosity_catalog_v1(text) to anon, authenticated;
grant execute on function private.curiosity_wonder_counts_v1(uuid) to anon, authenticated;
grant execute on function private.curiosity_wonder_state_v1(text, uuid) to anon, authenticated;
grant execute on function private.curiosity_toggle_wonder_v1(text, uuid) to anon, authenticated;

grant execute on function private.admin_list_curiosities_v1(text) to authenticated;
grant execute on function private.admin_initialize_curiosity_v1(text, jsonb) to authenticated;
grant execute on function private.admin_save_curiosity_draft_v1(text, jsonb, bigint) to authenticated;
grant execute on function private.admin_publish_curiosity_v1(text, bigint) to authenticated;

revoke all on function public.get_published_curiosity_catalog_v1(text) from public, anon, authenticated;
revoke all on function public.curiosity_wonder_counts_v1(uuid) from public, anon, authenticated;
revoke all on function public.curiosity_wonder_state_v1(text, uuid) from public, anon, authenticated;
revoke all on function public.curiosity_toggle_wonder_v1(text, uuid) from public, anon, authenticated;
revoke all on function public.admin_list_curiosities_v1(text) from public, anon, authenticated;
revoke all on function public.admin_initialize_curiosity_v1(text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_save_curiosity_draft_v1(text, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.admin_publish_curiosity_v1(text, bigint) from public, anon, authenticated;
grant execute on function public.get_published_curiosity_catalog_v1(text) to anon, authenticated;
grant execute on function public.curiosity_wonder_counts_v1(uuid) to anon, authenticated;
grant execute on function public.curiosity_wonder_state_v1(text, uuid) to anon, authenticated;
grant execute on function public.curiosity_toggle_wonder_v1(text, uuid) to anon, authenticated;

grant execute on function public.admin_list_curiosities_v1(text) to authenticated;
grant execute on function public.admin_initialize_curiosity_v1(text, jsonb) to authenticated;
grant execute on function public.admin_save_curiosity_draft_v1(text, jsonb, bigint) to authenticated;
grant execute on function public.admin_publish_curiosity_v1(text, bigint) to authenticated;

comment on table public.curiosities is
  'Canonical Curiosity draft state. Public readers consume immutable published revisions through RPCs.';
comment on table public.curiosity_revisions is
  'Immutable published Curiosity revisions.';
comment on table public.curiosity_wonders is
  'Real I wondered that too signals keyed to stable Curiosity identity.';
