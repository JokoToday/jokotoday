-- Homepage Builder persistence v1
-- Draft -> Preview -> Publish -> immutable revisions -> Restore-to-draft

create schema if not exists private;

create table public.platform_sites (
  id uuid primary key default gen_random_uuid(),
  site_key text not null unique,
  workspace_id uuid null,
  name text not null,
  default_locale text not null,
  supported_locales text[] not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_sites_site_key_format check (
    site_key = lower(site_key)
    and site_key ~ '^[a-z0-9][a-z0-9-]*$'
  ),
  constraint platform_sites_supported_locales_nonempty check (cardinality(supported_locales) > 0),
  constraint platform_sites_default_locale_supported check (default_locale = any(supported_locales))
);

create table public.platform_builder_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.platform_sites(id) on delete restrict,
  page_key text not null,
  schema_version integer not null check (schema_version > 0),
  registry_version integer not null check (registry_version > 0),
  draft_document jsonb not null,
  lock_version bigint not null default 1 check (lock_version > 0),
  draft_updated_at timestamptz not null default now(),
  draft_updated_by uuid null references auth.users(id) on delete set null,
  draft_source_revision_id uuid null,
  published_revision_id uuid null,
  published_at timestamptz null,
  published_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  constraint platform_builder_pages_page_key_format check (
    page_key = lower(page_key)
    and page_key ~ '^[a-z0-9][a-z0-9-]*$'
  ),
  constraint platform_builder_pages_draft_object check (jsonb_typeof(draft_document) = 'object'),
  constraint platform_builder_pages_site_page_unique unique (site_id, page_key)
);

create table public.platform_builder_page_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.platform_builder_pages(id) on delete restrict,
  revision_number bigint not null check (revision_number > 0),
  document jsonb not null,
  schema_version integer not null check (schema_version > 0),
  registry_version integer not null check (registry_version > 0),
  published_at timestamptz not null default now(),
  published_by uuid null references auth.users(id) on delete set null,
  restored_from_revision_id uuid null references public.platform_builder_page_revisions(id) on delete restrict,
  constraint platform_builder_revisions_document_object check (jsonb_typeof(document) = 'object'),
  constraint platform_builder_revisions_page_number_unique unique (page_id, revision_number)
);

alter table public.platform_builder_pages
  add constraint platform_builder_pages_draft_source_revision_fk
  foreign key (draft_source_revision_id)
  references public.platform_builder_page_revisions(id)
  on delete set null;

alter table public.platform_builder_pages
  add constraint platform_builder_pages_published_revision_fk
  foreign key (published_revision_id)
  references public.platform_builder_page_revisions(id)
  on delete restrict;

create index platform_builder_pages_site_page_idx
  on public.platform_builder_pages(site_id, page_key);

create index platform_builder_revisions_page_published_idx
  on public.platform_builder_page_revisions(page_id, published_at desc);

create or replace function private.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'::public.user_role
  );
$$;

create or replace function private.reject_builder_revision_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'Published Builder revisions are immutable' using errcode = '55000';
end;
$$;

create trigger platform_builder_revisions_immutable
before update or delete on public.platform_builder_page_revisions
for each row execute function private.reject_builder_revision_mutation();

create or replace function private.assert_builder_document_v1(
  p_document jsonb,
  p_page_key text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_document) <> 'object' then
    raise exception 'Builder document must be a JSON object' using errcode = '22023';
  end if;

  if octet_length(p_document::text) > 1048576 then
    raise exception 'Builder document exceeds the 1 MiB limit' using errcode = '22023';
  end if;

  if coalesce(p_document ->> 'pageKey', '') <> p_page_key then
    raise exception 'Builder document pageKey does not match requested page' using errcode = '22023';
  end if;

  if coalesce(p_document ->> 'schemaVersion', '') !~ '^[1-9][0-9]{0,8}$' then
    raise exception 'Builder document schemaVersion must be a positive integer' using errcode = '22023';
  end if;

  if coalesce(p_document ->> 'registryVersion', '') !~ '^[1-9][0-9]{0,8}$' then
    raise exception 'Builder document registryVersion must be a positive integer' using errcode = '22023';
  end if;

  if jsonb_typeof(p_document -> 'sections') <> 'array' then
    raise exception 'Builder document sections must be an array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_document -> 'sections') > 100 then
    raise exception 'Builder document contains too many sections' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.builder_page_state_v1(p_page_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'exists', true,
    'pageId', p.id,
    'siteKey', s.site_key,
    'pageKey', p.page_key,
    'lockVersion', p.lock_version,
    'draft', jsonb_build_object(
      'document', p.draft_document,
      'updatedAt', p.draft_updated_at,
      'updatedBy', p.draft_updated_by,
      'sourceRevisionId', p.draft_source_revision_id
    ),
    'published', case
      when r.id is null then null
      else jsonb_build_object(
        'revisionId', r.id,
        'revisionNumber', r.revision_number,
        'publishedAt', r.published_at,
        'publishedBy', r.published_by
      )
    end
  )
  from public.platform_builder_pages p
  join public.platform_sites s on s.id = p.site_id
  left join public.platform_builder_page_revisions r on r.id = p.published_revision_id
  where p.id = p_page_id;
$$;

create or replace function private.admin_get_builder_page_v1(
  p_site_key text,
  p_page_key text default 'home'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site_id uuid;
  v_page_id uuid;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select s.id into v_site_id
  from public.platform_sites s
  where s.site_key = p_site_key;

  if v_site_id is null then
    raise exception 'Unknown platform site' using errcode = '22023';
  end if;

  select p.id into v_page_id
  from public.platform_builder_pages p
  where p.site_id = v_site_id
    and p.page_key = p_page_key;

  if v_page_id is null then
    return jsonb_build_object(
      'exists', false,
      'siteKey', p_site_key,
      'pageKey', p_page_key
    );
  end if;

  return private.builder_page_state_v1(v_page_id);
end;
$$;

create or replace function private.admin_initialize_builder_page_v1(
  p_site_key text,
  p_page_key text,
  p_document jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_site_id uuid;
  v_page_id uuid;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  perform private.assert_builder_document_v1(p_document, p_page_key);

  select s.id into v_site_id
  from public.platform_sites s
  where s.site_key = p_site_key;

  if v_site_id is null then
    raise exception 'Unknown platform site' using errcode = '22023';
  end if;

  insert into public.platform_builder_pages (
    site_id,
    page_key,
    schema_version,
    registry_version,
    draft_document,
    draft_updated_by,
    created_by
  )
  values (
    v_site_id,
    p_page_key,
    (p_document ->> 'schemaVersion')::integer,
    (p_document ->> 'registryVersion')::integer,
    p_document,
    v_user_id,
    v_user_id
  )
  on conflict (site_id, page_key) do nothing;

  select p.id into v_page_id
  from public.platform_builder_pages p
  where p.site_id = v_site_id
    and p.page_key = p_page_key;

  return private.builder_page_state_v1(v_page_id);
end;
$$;

create or replace function private.admin_save_builder_draft_v1(
  p_site_key text,
  p_page_key text,
  p_document jsonb,
  p_expected_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_page public.platform_builder_pages%rowtype;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  perform private.assert_builder_document_v1(p_document, p_page_key);

  select p.* into v_page
  from public.platform_builder_pages p
  join public.platform_sites s on s.id = p.site_id
  where s.site_key = p_site_key
    and p.page_key = p_page_key
  for update of p;

  if not found then
    raise exception 'Builder page not found' using errcode = 'P0002';
  end if;

  if v_page.lock_version <> p_expected_lock_version then
    raise exception 'Builder draft changed in another session' using errcode = '40001';
  end if;

  update public.platform_builder_pages
  set draft_document = p_document,
      schema_version = (p_document ->> 'schemaVersion')::integer,
      registry_version = (p_document ->> 'registryVersion')::integer,
      lock_version = lock_version + 1,
      draft_updated_at = now(),
      draft_updated_by = v_user_id,
      draft_source_revision_id = null
  where id = v_page.id;

  return private.builder_page_state_v1(v_page.id);
end;
$$;

create or replace function private.admin_publish_builder_page_v1(
  p_site_key text,
  p_page_key text,
  p_expected_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_page public.platform_builder_pages%rowtype;
  v_revision_id uuid;
  v_revision_number bigint;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select p.* into v_page
  from public.platform_builder_pages p
  join public.platform_sites s on s.id = p.site_id
  where s.site_key = p_site_key
    and p.page_key = p_page_key
  for update of p;

  if not found then
    raise exception 'Builder page not found' using errcode = 'P0002';
  end if;

  if v_page.lock_version <> p_expected_lock_version then
    raise exception 'Builder draft changed in another session' using errcode = '40001';
  end if;

  perform private.assert_builder_document_v1(v_page.draft_document, p_page_key);

  select coalesce(max(r.revision_number), 0) + 1
  into v_revision_number
  from public.platform_builder_page_revisions r
  where r.page_id = v_page.id;

  insert into public.platform_builder_page_revisions (
    page_id,
    revision_number,
    document,
    schema_version,
    registry_version,
    published_by,
    restored_from_revision_id
  )
  values (
    v_page.id,
    v_revision_number,
    v_page.draft_document,
    v_page.schema_version,
    v_page.registry_version,
    v_user_id,
    v_page.draft_source_revision_id
  )
  returning id into v_revision_id;

  update public.platform_builder_pages
  set published_revision_id = v_revision_id,
      published_at = now(),
      published_by = v_user_id,
      lock_version = lock_version + 1,
      draft_source_revision_id = null
  where id = v_page.id;

  return private.builder_page_state_v1(v_page.id);
end;
$$;

create or replace function private.admin_restore_builder_revision_v1(
  p_site_key text,
  p_page_key text,
  p_revision_id uuid,
  p_expected_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_page public.platform_builder_pages%rowtype;
  v_revision public.platform_builder_page_revisions%rowtype;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select p.* into v_page
  from public.platform_builder_pages p
  join public.platform_sites s on s.id = p.site_id
  where s.site_key = p_site_key
    and p.page_key = p_page_key
  for update of p;

  if not found then
    raise exception 'Builder page not found' using errcode = 'P0002';
  end if;

  if v_page.lock_version <> p_expected_lock_version then
    raise exception 'Builder draft changed in another session' using errcode = '40001';
  end if;

  select r.* into v_revision
  from public.platform_builder_page_revisions r
  where r.id = p_revision_id
    and r.page_id = v_page.id;

  if not found then
    raise exception 'Builder revision not found for this page' using errcode = 'P0002';
  end if;

  update public.platform_builder_pages
  set draft_document = v_revision.document,
      schema_version = v_revision.schema_version,
      registry_version = v_revision.registry_version,
      lock_version = lock_version + 1,
      draft_updated_at = now(),
      draft_updated_by = v_user_id,
      draft_source_revision_id = v_revision.id
  where id = v_page.id;

  return private.builder_page_state_v1(v_page.id);
end;
$$;

create or replace function private.admin_list_builder_revisions_v1(
  p_site_key text,
  p_page_key text default 'home',
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page_id uuid;
  v_published_revision_id uuid;
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select p.id, p.published_revision_id
  into v_page_id, v_published_revision_id
  from public.platform_builder_pages p
  join public.platform_sites s on s.id = p.site_id
  where s.site_key = p_site_key
    and p.page_key = p_page_key;

  if v_page_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(item order by (item ->> 'revisionNumber')::bigint desc)
    from (
      select jsonb_build_object(
        'revisionId', r.id,
        'revisionNumber', r.revision_number,
        'publishedAt', r.published_at,
        'publishedBy', r.published_by,
        'restoredFromRevisionId', r.restored_from_revision_id,
        'isCurrent', r.id = v_published_revision_id
      ) as item
      from public.platform_builder_page_revisions r
      where r.page_id = v_page_id
      order by r.revision_number desc
      limit v_limit
    ) q
  ), '[]'::jsonb);
end;
$$;

create or replace function private.get_published_builder_page_v1(
  p_site_key text,
  p_page_key text default 'home'
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when r.id is null then jsonb_build_object(
      'exists', false,
      'siteKey', p_site_key,
      'pageKey', p_page_key
    )
    else jsonb_build_object(
      'exists', true,
      'siteKey', s.site_key,
      'pageKey', p.page_key,
      'revisionId', r.id,
      'revisionNumber', r.revision_number,
      'publishedAt', r.published_at,
      'document', r.document
    )
  end
  from public.platform_sites s
  left join public.platform_builder_pages p
    on p.site_id = s.id and p.page_key = p_page_key
  left join public.platform_builder_page_revisions r
    on r.id = p.published_revision_id
  where s.site_key = p_site_key;
$$;

-- Exposed RPC wrappers are SECURITY INVOKER. Privileged work remains in private.
create or replace function public.admin_get_builder_page_v1(
  p_site_key text,
  p_page_key text default 'home'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_get_builder_page_v1(p_site_key, p_page_key);
$$;

create or replace function public.admin_initialize_builder_page_v1(
  p_site_key text,
  p_page_key text,
  p_document jsonb
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_initialize_builder_page_v1(p_site_key, p_page_key, p_document);
$$;

create or replace function public.admin_save_builder_draft_v1(
  p_site_key text,
  p_page_key text,
  p_document jsonb,
  p_expected_lock_version bigint
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_save_builder_draft_v1(
    p_site_key,
    p_page_key,
    p_document,
    p_expected_lock_version
  );
$$;

create or replace function public.admin_publish_builder_page_v1(
  p_site_key text,
  p_page_key text,
  p_expected_lock_version bigint
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_publish_builder_page_v1(
    p_site_key,
    p_page_key,
    p_expected_lock_version
  );
$$;

create or replace function public.admin_restore_builder_revision_v1(
  p_site_key text,
  p_page_key text,
  p_revision_id uuid,
  p_expected_lock_version bigint
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_restore_builder_revision_v1(
    p_site_key,
    p_page_key,
    p_revision_id,
    p_expected_lock_version
  );
$$;

create or replace function public.admin_list_builder_revisions_v1(
  p_site_key text,
  p_page_key text default 'home',
  p_limit integer default 20
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_list_builder_revisions_v1(p_site_key, p_page_key, p_limit);
$$;

create or replace function public.get_published_builder_page_v1(
  p_site_key text,
  p_page_key text default 'home'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_published_builder_page_v1(p_site_key, p_page_key);
$$;

-- RLS is defense-in-depth. Direct writes remain unavailable; Admin writes use RPCs.
alter table public.platform_sites enable row level security;
alter table public.platform_builder_pages enable row level security;
alter table public.platform_builder_page_revisions enable row level security;

revoke all on table public.platform_sites from anon, authenticated;
revoke all on table public.platform_builder_pages from anon, authenticated;
revoke all on table public.platform_builder_page_revisions from anon, authenticated;

grant select on table public.platform_sites to authenticated;
grant select on table public.platform_builder_pages to authenticated;
grant select on table public.platform_builder_page_revisions to authenticated;

create policy platform_sites_admin_select
on public.platform_sites
for select
to authenticated
using ((select private.current_user_is_admin()));

create policy platform_builder_pages_admin_select
on public.platform_builder_pages
for select
to authenticated
using ((select private.current_user_is_admin()));

create policy platform_builder_revisions_admin_select
on public.platform_builder_page_revisions
for select
to authenticated
using ((select private.current_user_is_admin()));

-- Function privileges: default PUBLIC execute is revoked explicitly.
grant usage on schema private to authenticated, anon;

revoke all on function private.current_user_is_admin() from public, anon, authenticated;
grant execute on function private.current_user_is_admin() to authenticated;

revoke all on function private.admin_get_builder_page_v1(text, text) from public, anon, authenticated;
revoke all on function private.admin_initialize_builder_page_v1(text, text, jsonb) from public, anon, authenticated;
revoke all on function private.admin_save_builder_draft_v1(text, text, jsonb, bigint) from public, anon, authenticated;
revoke all on function private.admin_publish_builder_page_v1(text, text, bigint) from public, anon, authenticated;
revoke all on function private.admin_restore_builder_revision_v1(text, text, uuid, bigint) from public, anon, authenticated;
revoke all on function private.admin_list_builder_revisions_v1(text, text, integer) from public, anon, authenticated;

grant execute on function private.admin_get_builder_page_v1(text, text) to authenticated;
grant execute on function private.admin_initialize_builder_page_v1(text, text, jsonb) to authenticated;
grant execute on function private.admin_save_builder_draft_v1(text, text, jsonb, bigint) to authenticated;
grant execute on function private.admin_publish_builder_page_v1(text, text, bigint) to authenticated;
grant execute on function private.admin_restore_builder_revision_v1(text, text, uuid, bigint) to authenticated;
grant execute on function private.admin_list_builder_revisions_v1(text, text, integer) to authenticated;

revoke all on function private.get_published_builder_page_v1(text, text) from public, anon, authenticated;
grant execute on function private.get_published_builder_page_v1(text, text) to anon, authenticated;

revoke all on function public.admin_get_builder_page_v1(text, text) from public, anon, authenticated;
revoke all on function public.admin_initialize_builder_page_v1(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_save_builder_draft_v1(text, text, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.admin_publish_builder_page_v1(text, text, bigint) from public, anon, authenticated;
revoke all on function public.admin_restore_builder_revision_v1(text, text, uuid, bigint) from public, anon, authenticated;
revoke all on function public.admin_list_builder_revisions_v1(text, text, integer) from public, anon, authenticated;
revoke all on function public.get_published_builder_page_v1(text, text) from public, anon, authenticated;

grant execute on function public.admin_get_builder_page_v1(text, text) to authenticated;
grant execute on function public.admin_initialize_builder_page_v1(text, text, jsonb) to authenticated;
grant execute on function public.admin_save_builder_draft_v1(text, text, jsonb, bigint) to authenticated;
grant execute on function public.admin_publish_builder_page_v1(text, text, bigint) to authenticated;
grant execute on function public.admin_restore_builder_revision_v1(text, text, uuid, bigint) to authenticated;
grant execute on function public.admin_list_builder_revisions_v1(text, text, integer) to authenticated;
grant execute on function public.get_published_builder_page_v1(text, text) to anon, authenticated;

-- Register JOKO TODAY as the first Platform Site without hardcoding a generated UUID.
insert into public.platform_sites (
  site_key,
  name,
  default_locale,
  supported_locales,
  timezone
)
values (
  'joko-today',
  'JOKO TODAY',
  'en',
  array['en', 'th', 'zh']::text[],
  'Asia/Bangkok'
)
on conflict (site_key) do nothing;
