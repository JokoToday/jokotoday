-- Homepage Builder persistence hardening
-- Align database validation with BuilderDocument v1 and keep revision content
-- immutable without blocking auth-user FK cleanup of published_by.

create or replace function private.assert_builder_localized_text_v1(
  p_value jsonb,
  p_field text,
  p_supported_locales text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_value jsonb;
  v_locale text;
begin
  if jsonb_typeof(p_value) is distinct from 'object' then
    raise exception '% must be a localized text object', p_field using errcode = '22023';
  end if;

  if jsonb_object_length(p_value) = 0 then
    raise exception '% must contain at least one locale', p_field using errcode = '22023';
  end if;

  for v_key, v_value in
    select key, value from jsonb_each(p_value)
  loop
    if btrim(v_key) = ''
      or jsonb_typeof(v_value) is distinct from 'string'
      or btrim(v_value #>> '{}') = ''
    then
      raise exception '% contains an empty locale key or non-empty string requirement violation', p_field
        using errcode = '22023';
    end if;
  end loop;

  foreach v_locale in array coalesce(p_supported_locales, array[]::text[])
  loop
    if btrim(v_locale) = ''
      or not (p_value ? v_locale)
      or jsonb_typeof(p_value -> v_locale) is distinct from 'string'
      or btrim(coalesce(p_value ->> v_locale, '')) = ''
    then
      raise exception '% is missing required Site locale %', p_field, v_locale
        using errcode = '22023';
    end if;
  end loop;
end;
$$;

create or replace function private.assert_builder_action_v1(
  p_value jsonb,
  p_field text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_type text;
begin
  if jsonb_typeof(p_value) is distinct from 'object' then
    raise exception '% must be a typed Builder action object', p_field using errcode = '22023';
  end if;

  v_type := coalesce(p_value ->> 'type', '');

  if v_type in ('commerce.openProducts', 'site.openHowItWorks') then
    return;
  end if;

  if v_type = 'commerce.browseCategory' then
    if jsonb_typeof(p_value -> 'categoryId') is distinct from 'string'
      or btrim(coalesce(p_value ->> 'categoryId', '')) = ''
    then
      raise exception '% category action requires a non-empty categoryId', p_field
        using errcode = '22023';
    end if;
    return;
  end if;

  raise exception '% contains unsupported action type %', p_field, v_type using errcode = '22023';
end;
$$;

create or replace function private.assert_builder_document_v1(
  p_document jsonb,
  p_page_key text,
  p_supported_locales text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_section jsonb;
  v_props jsonb;
  v_design jsonb;
  v_type text;
  v_id text;
  v_seen_ids text[] := array[]::text[];
  v_hero_count integer := 0;
  v_top_liked_count integer := 0;
  v_category_grid_count integer := 0;
  v_cta_count integer := 0;
begin
  if jsonb_typeof(p_document) is distinct from 'object' then
    raise exception 'Builder document must be a JSON object' using errcode = '22023';
  end if;

  if octet_length(p_document::text) > 1048576 then
    raise exception 'Builder document exceeds the 1 MiB limit' using errcode = '22023';
  end if;

  if p_page_key <> 'home' or p_document -> 'pageKey' is distinct from '"home"'::jsonb then
    raise exception 'Homepage Builder v1 only supports pageKey home' using errcode = '22023';
  end if;

  if p_document -> 'schemaVersion' is distinct from '1'::jsonb then
    raise exception 'Unsupported Builder schema version' using errcode = '22023';
  end if;

  if p_document -> 'registryVersion' is distinct from '1'::jsonb then
    raise exception 'Unsupported Component Registry version' using errcode = '22023';
  end if;

  if jsonb_typeof(p_document -> 'sections') is distinct from 'array' then
    raise exception 'Builder document sections must be an array' using errcode = '22023';
  end if;

  if jsonb_array_length(p_document -> 'sections') > 100 then
    raise exception 'Builder document contains too many sections' using errcode = '22023';
  end if;

  for v_section in
    select value from jsonb_array_elements(p_document -> 'sections')
  loop
    if jsonb_typeof(v_section) is distinct from 'object' then
      raise exception 'Builder section must be an object' using errcode = '22023';
    end if;

    if jsonb_typeof(v_section -> 'id') is distinct from 'string'
      or btrim(coalesce(v_section ->> 'id', '')) = ''
    then
      raise exception 'Builder section id must be a non-empty string' using errcode = '22023';
    end if;

    v_id := v_section ->> 'id';
    if v_id = any(v_seen_ids) then
      raise exception 'Builder section id must be unique: %', v_id using errcode = '22023';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_id);

    if jsonb_typeof(v_section -> 'type') is distinct from 'string' then
      raise exception 'Builder section type must be a string' using errcode = '22023';
    end if;
    v_type := v_section ->> 'type';

    if v_section -> 'version' is distinct from '1'::jsonb then
      raise exception 'Unsupported section version for %', v_type using errcode = '22023';
    end if;

    if jsonb_typeof(v_section -> 'visible') is distinct from 'boolean' then
      raise exception 'Section visibility must be boolean for %', v_type using errcode = '22023';
    end if;

    v_props := v_section -> 'props';
    v_design := v_section -> 'design';

    if jsonb_typeof(v_props) is distinct from 'object' then
      raise exception 'Section props must be an object for %', v_type using errcode = '22023';
    end if;

    if jsonb_typeof(v_design) is distinct from 'object' then
      raise exception 'Section design must be an object for %', v_type using errcode = '22023';
    end if;

    if coalesce(v_design ->> 'width', '') not in ('standard', 'wide') then
      raise exception 'Unsupported width for %', v_type using errcode = '22023';
    end if;

    case v_type
      when 'home.hero.v1' then
        v_hero_count := v_hero_count + 1;
        if v_hero_count > 1 then
          raise exception 'home.hero.v1 exceeds maxInstances=1' using errcode = '22023';
        end if;

        if coalesce(v_design ->> 'spacing', '') <> 'none' then
          raise exception 'Unsupported Hero spacing' using errcode = '22023';
        end if;
        if coalesce(v_design ->> 'layout', '') <> 'split-media-right' then
          raise exception 'Unsupported Hero layout' using errcode = '22023';
        end if;

        perform private.assert_builder_localized_text_v1(v_props -> 'title', 'hero.title', p_supported_locales);
        perform private.assert_builder_localized_text_v1(v_props -> 'subtitle', 'hero.subtitle', p_supported_locales);
        perform private.assert_builder_localized_text_v1(v_props -> 'primaryActionLabel', 'hero.primaryActionLabel', p_supported_locales);
        perform private.assert_builder_action_v1(v_props -> 'primaryAction', 'hero.primaryAction');
        perform private.assert_builder_localized_text_v1(v_props -> 'secondaryActionLabel', 'hero.secondaryActionLabel', p_supported_locales);
        perform private.assert_builder_action_v1(v_props -> 'secondaryAction', 'hero.secondaryAction');
        perform private.assert_builder_localized_text_v1(v_props -> 'mediaAlt', 'hero.mediaAlt', p_supported_locales);

      when 'home.top-liked.v1' then
        v_top_liked_count := v_top_liked_count + 1;
        if v_top_liked_count > 1 then
          raise exception 'home.top-liked.v1 exceeds maxInstances=1' using errcode = '22023';
        end if;

        if coalesce(v_design ->> 'spacing', '') not in ('compact', 'standard', 'spacious', 'extraSpacious') then
          raise exception 'Unsupported Most Loved spacing' using errcode = '22023';
        end if;
        if coalesce(v_design ->> 'variant', '') <> 'cards' then
          raise exception 'Unsupported Most Loved variant' using errcode = '22023';
        end if;

        perform private.assert_builder_localized_text_v1(v_props -> 'title', 'topLiked.title', p_supported_locales);
        perform private.assert_builder_localized_text_v1(v_props -> 'subtitle', 'topLiked.subtitle', p_supported_locales);
        perform private.assert_builder_localized_text_v1(v_props -> 'browseLabel', 'topLiked.browseLabel', p_supported_locales);
        perform private.assert_builder_action_v1(v_props -> 'browseAction', 'topLiked.browseAction');

      when 'home.category-grid.v1' then
        v_category_grid_count := v_category_grid_count + 1;
        if v_category_grid_count > 1 then
          raise exception 'home.category-grid.v1 exceeds maxInstances=1' using errcode = '22023';
        end if;

        if coalesce(v_design ->> 'spacing', '') not in ('compact', 'standard', 'spacious', 'extraSpacious') then
          raise exception 'Unsupported Category Grid spacing' using errcode = '22023';
        end if;
        if coalesce(v_design ->> 'layout', '') <> 'responsive-catalogue' then
          raise exception 'Unsupported Category Grid layout' using errcode = '22023';
        end if;

        perform private.assert_builder_localized_text_v1(v_props -> 'title', 'categoryGrid.title', p_supported_locales);

      when 'home.cta.v1' then
        v_cta_count := v_cta_count + 1;
        if v_cta_count > 1 then
          raise exception 'home.cta.v1 exceeds maxInstances=1' using errcode = '22023';
        end if;

        if coalesce(v_design ->> 'spacing', '') not in ('compact', 'standard', 'spacious', 'extraSpacious') then
          raise exception 'Unsupported CTA spacing' using errcode = '22023';
        end if;
        if coalesce(v_design ->> 'variant', '') <> 'brand-panel' then
          raise exception 'Unsupported CTA variant' using errcode = '22023';
        end if;
        if coalesce(v_design ->> 'alignment', '') <> 'center' then
          raise exception 'Unsupported CTA alignment' using errcode = '22023';
        end if;

        perform private.assert_builder_localized_text_v1(v_props -> 'title', 'cta.title', p_supported_locales);
        perform private.assert_builder_localized_text_v1(v_props -> 'body', 'cta.body', p_supported_locales);
        perform private.assert_builder_localized_text_v1(v_props -> 'actionLabel', 'cta.actionLabel', p_supported_locales);
        perform private.assert_builder_action_v1(v_props -> 'action', 'cta.action');

      else
        raise exception 'Unknown Builder section type: %', v_type using errcode = '22023';
    end case;
  end loop;
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
  v_supported_locales text[];
  v_page_id uuid;
begin
  if not private.current_user_is_admin() then
    raise exception 'Admin authorization required' using errcode = '42501';
  end if;

  select s.id, s.supported_locales
  into v_site_id, v_supported_locales
  from public.platform_sites s
  where s.site_key = p_site_key;

  if v_site_id is null then
    raise exception 'Unknown platform site' using errcode = '22023';
  end if;

  perform private.assert_builder_document_v1(p_document, p_page_key, v_supported_locales);

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
    1,
    1,
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
  v_supported_locales text[];
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

  select s.supported_locales into v_supported_locales
  from public.platform_sites s
  where s.id = v_page.site_id;

  perform private.assert_builder_document_v1(p_document, p_page_key, v_supported_locales);

  update public.platform_builder_pages
  set draft_document = p_document,
      schema_version = 1,
      registry_version = 1,
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
  v_supported_locales text[];
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

  select s.supported_locales into v_supported_locales
  from public.platform_sites s
  where s.id = v_page.site_id;

  perform private.assert_builder_document_v1(v_page.draft_document, p_page_key, v_supported_locales);

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
    1,
    1,
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

create or replace function private.reject_builder_revision_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Published Builder revisions are immutable' using errcode = '55000';
  end if;

  -- Permit only the referential cleanup performed by
  -- published_by REFERENCES auth.users(id) ON DELETE SET NULL.
  if old.published_by is not null
    and new.published_by is null
    and new.id is not distinct from old.id
    and new.page_id is not distinct from old.page_id
    and new.revision_number is not distinct from old.revision_number
    and new.document is not distinct from old.document
    and new.schema_version is not distinct from old.schema_version
    and new.registry_version is not distinct from old.registry_version
    and new.published_at is not distinct from old.published_at
    and new.restored_from_revision_id is not distinct from old.restored_from_revision_id
  then
    return new;
  end if;

  raise exception 'Published Builder revisions are immutable' using errcode = '55000';
end;
$$;

-- The old two-argument validator is no longer used. Removing it prevents stale
-- callers from bypassing Site-locale and full v1 contract validation.
drop function private.assert_builder_document_v1(jsonb, text);

-- Internal validation helpers are not callable by API roles.
revoke all on function private.assert_builder_localized_text_v1(jsonb, text, text[]) from public, anon, authenticated;
revoke all on function private.assert_builder_action_v1(jsonb, text) from public, anon, authenticated;
revoke all on function private.assert_builder_document_v1(jsonb, text, text[]) from public, anon, authenticated;
