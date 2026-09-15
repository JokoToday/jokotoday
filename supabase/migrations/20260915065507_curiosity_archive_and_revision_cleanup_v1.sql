-- Post-merge Curiosity hardening.
-- 1) Archiving a Curiosity retracts its published pointer without deleting revision history.
-- 2) Immutable revisions permit only FK-driven publisher nullification during user cleanup.

create or replace function private.prevent_curiosity_revision_mutation_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.id is not distinct from new.id
     and old.curiosity_id is not distinct from new.curiosity_id
     and old.revision_number is not distinct from new.revision_number
     and old.document is not distinct from new.document
     and old.published_at is not distinct from new.published_at
     and old.published_by is not null
     and new.published_by is null then
    return new;
  end if;

  raise exception 'Published Curiosity revisions are immutable.' using errcode = '55000';
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
      draft_updated_by = (select auth.uid()),
      published_revision_id = case
        when p_document->>'status' = 'archived' then null
        else c.published_revision_id
      end,
      published_at = case
        when p_document->>'status' = 'archived' then null
        else c.published_at
      end,
      published_by = case
        when p_document->>'status' = 'archived' then null
        else c.published_by
      end
  where c.id = p_curiosity_id;

  return private.curiosity_state_v1(p_curiosity_id);
end;
$$;

comment on function private.prevent_curiosity_revision_mutation_v1() is
  'Keeps Curiosity revisions immutable while allowing FK-driven published_by nullification when an auth user is removed.';
comment on function private.admin_save_curiosity_draft_v1(text, jsonb, bigint) is
  'Saves an Admin Curiosity draft; archived status retracts the public revision pointer while preserving immutable revision history.';
