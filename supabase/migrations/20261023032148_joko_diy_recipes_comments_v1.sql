-- Prepared for review; do not apply to production without release approval.
begin;
create schema if not exists diy_private;
revoke all on schema diy_private from public;
grant usage on schema diy_private to anon, authenticated;
create function diy_private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.user_profiles where id=(select auth.uid()) and role::text='admin');
$$;
revoke all on function diy_private.is_admin() from public;
grant execute on function diy_private.is_admin() to anon, authenticated;

create table public.diy_recipe_drafts (
 id uuid primary key default gen_random_uuid(), slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=120),
 payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'schema_version'='joko.recipe.v1' and octet_length(payload::text)<=524288),
 revision integer not null default 1, updated_at timestamptz not null default now()
);
create table public.diy_recipes (
 id uuid primary key references public.diy_recipe_drafts(id), slug text not null unique,
 payload jsonb not null, revision integer not null, updated_at timestamptz not null default now(), is_published boolean not null default true
);
alter table public.diy_recipe_drafts enable row level security;
alter table public.diy_recipes enable row level security;
create policy diy_drafts_admin on public.diy_recipe_drafts for all to authenticated using ((select diy_private.is_admin())) with check ((select diy_private.is_admin()));
create policy diy_recipes_public on public.diy_recipes for select to anon,authenticated using(is_published or (select diy_private.is_admin()));
create policy diy_recipes_admin on public.diy_recipes for all to authenticated using ((select diy_private.is_admin())) with check ((select diy_private.is_admin()));
revoke all on public.diy_recipe_drafts,public.diy_recipes from anon,authenticated;
grant select,insert,update on public.diy_recipe_drafts to authenticated;
grant select on public.diy_recipes to anon,authenticated;
grant insert,update on public.diy_recipes to authenticated;
create function diy_private.guard_draft() returns trigger language plpgsql set search_path = '' as $$
begin
 if new.payload->>'slug' is distinct from new.slug then raise exception 'Recipe slug does not match payload'; end if;
 if TG_OP='UPDATE' then
   if new.slug<>old.slug and exists(select 1 from public.diy_recipes where id=old.id) then raise exception 'Published recipe slugs cannot change'; end if;
   new.revision=old.revision+1; new.updated_at=now();
 end if;
 return new;
end $$;
create trigger diy_draft_revision before insert or update on public.diy_recipe_drafts for each row execute function diy_private.guard_draft();
create function public.diy_publish_recipe(recipe_id uuid, expected_revision integer) returns void language plpgsql security invoker set search_path = '' as $$
declare d public.diy_recipe_drafts; lang text; item jsonb;
begin
 if not diy_private.is_admin() then raise exception 'Admin required'; end if;
 select * into d from public.diy_recipe_drafts where id=recipe_id for update;
 if d.id is null or d.revision<>expected_revision then raise exception 'Recipe changed. Reload before publishing.'; end if;
 if d.payload->'hero'->>'permission' is distinct from 'permitted' or coalesce(d.payload->'hero'->>'url','') !~ '^https://' or btrim(coalesce(d.payload->'hero'->>'credit',''))='' or btrim(coalesce(d.payload->'source'->>'creator',''))='' or coalesce(d.payload->'source'->>'url','') !~ '^https://' then raise exception 'Approved image and original source required'; end if;
 if jsonb_typeof(d.payload->'ingredients') is distinct from 'array' or jsonb_typeof(d.payload->'method') is distinct from 'array' or jsonb_array_length(d.payload->'ingredients')=0 or jsonb_array_length(d.payload->'method')=0 then raise exception 'Ingredients and method required'; end if;
 foreach lang in array array['en','th','zh'] loop
   if btrim(coalesce(d.payload->'title'->>lang,''))='' or btrim(coalesce(d.payload->'intro'->>lang,''))='' or btrim(coalesce(d.payload->'hero'->'alt'->>lang,''))='' then raise exception 'Complete all three languages'; end if;
   for item in select value from jsonb_array_elements(d.payload->'ingredients') loop
     if btrim(coalesce(item->'name'->>lang,''))='' then raise exception 'Ingredient translations required'; end if;
   end loop;
   for item in select value from jsonb_array_elements(d.payload->'method') loop
     if btrim(coalesce(item->'title'->>lang,''))='' or btrim(coalesce(item->'instruction'->>lang,''))='' then raise exception 'Method translations required'; end if;
   end loop;
 end loop;
 for item in select value from jsonb_array_elements(d.payload->'issues') loop
   if item->>'blocking'='true' and item->>'resolved' is distinct from 'true' then raise exception 'Blocking issues remain'; end if;
 end loop;
 insert into public.diy_recipes(id,slug,payload,revision) values(d.id,d.slug,jsonb_set(d.payload,'{evidence}','[]'::jsonb),d.revision)
 on conflict(id) do update set payload=excluded.payload,revision=excluded.revision,updated_at=now(),is_published=true;
end $$;
revoke all on function public.diy_publish_recipe(uuid,integer) from public;
grant execute on function public.diy_publish_recipe(uuid,integer) to authenticated;

-- Owner submissions and approved public snapshots are separate, so pending text,
-- rejected photos and customer account IDs never leak through a public SELECT.
create table public.diy_comment_submissions (
 id uuid primary key default gen_random_uuid(), recipe_id uuid not null references public.diy_recipes(id),
 user_id uuid not null references auth.users(id) on delete cascade,
 author_name text not null, body text not null check(length(btrim(body)) between 1 and 3000),
 photos text[] not null default '{}' check(cardinality(photos)<=4),
 status text not null default 'uploading' check(status in ('uploading','pending','approved','rejected')),
 revision integer not null default 1, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index diy_comments_owner on public.diy_comment_submissions(user_id,created_at desc);
create index diy_comments_queue on public.diy_comment_submissions(status,created_at);
create table public.diy_recipe_comments (
 id uuid primary key references public.diy_comment_submissions(id) on delete cascade,
 recipe_id uuid not null references public.diy_recipes(id), author_name text not null, body text not null,
 photos text[] not null, created_at timestamptz not null
);
create index diy_public_comments_recipe on public.diy_recipe_comments(recipe_id,created_at desc);
alter table public.diy_comment_submissions enable row level security;
alter table public.diy_recipe_comments enable row level security;
create policy diy_submission_read on public.diy_comment_submissions for select to authenticated using(user_id=(select auth.uid()) or (select diy_private.is_admin()));
create policy diy_comment_public_read on public.diy_recipe_comments for select to anon,authenticated using(exists(select 1 from public.diy_recipes r where r.id=recipe_id and r.is_published));
revoke all on public.diy_comment_submissions,public.diy_recipe_comments from anon,authenticated;
grant select on public.diy_comment_submissions to authenticated;
grant select on public.diy_recipe_comments to anon,authenticated;

create table diy_private.comment_attempts(user_id uuid not null,created_at timestamptz not null default now());
create index diy_comment_attempts_user on diy_private.comment_attempts(user_id,created_at);
revoke all on diy_private.comment_attempts from public,anon,authenticated;

create function diy_private.start_comment(p_recipe uuid,p_body text) returns uuid language plpgsql security definer set search_path = '' as $$
declare new_id uuid; n text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from public.diy_recipes where id=p_recipe and is_published) then raise exception 'Recipe unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from diy_private.comment_attempts where user_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Please try again later'; end if;
 insert into diy_private.comment_attempts(user_id) values(auth.uid());
 select left(coalesce(nullif(btrim(name),''),'JOKO member'),80) into n from public.user_profiles where id=auth.uid();
 insert into public.diy_comment_submissions(recipe_id,user_id,author_name,body) values(p_recipe,auth.uid(),coalesce(n,'JOKO member'),p_body) returning id into new_id;
 return new_id;
end $$;
create function diy_private.finish_comment(p_id uuid,p_photos text[]) returns void language plpgsql security definer set search_path = '' as $$
declare c public.diy_comment_submissions; path text;
begin
 select * into c from public.diy_comment_submissions where id=p_id for update;
 if auth.uid() is null or c.user_id is distinct from auth.uid() or c.status<>'uploading' then raise exception 'Submission unavailable'; end if;
 if p_photos is null or cardinality(p_photos)>4 or (select count(distinct v) from unnest(p_photos) v)<>cardinality(p_photos) then raise exception 'Up to four unique photos'; end if;
 foreach path in array p_photos loop
   if path !~ ('^'||c.user_id::text||'/'||c.id::text||'/[0-3]\.webp$') or not exists(select 1 from storage.objects where bucket_id='diy-comment-photos' and name=path) then raise exception 'Photo upload incomplete'; end if;
 end loop;
 update public.diy_comment_submissions set photos=p_photos,status='pending',updated_at=now() where id=p_id;
end $$;
create function diy_private.moderate_comment(p_id uuid,p_approve boolean,p_revision integer) returns void language plpgsql security definer set search_path = '' as $$
declare c public.diy_comment_submissions;
begin
 if not diy_private.is_admin() then raise exception 'Admin required'; end if;
 select * into c from public.diy_comment_submissions where id=p_id for update;
 if c.id is null or c.status='uploading' or c.revision<>p_revision then raise exception 'Submission changed; reload'; end if;
 delete from public.diy_recipe_comments where id=p_id;
 if p_approve then
   if not exists(select 1 from public.diy_recipes where id=c.recipe_id and is_published) then raise exception 'Recipe unavailable'; end if;
   insert into public.diy_recipe_comments values(c.id,c.recipe_id,c.author_name,c.body,c.photos,c.created_at);
 end if;
 update public.diy_comment_submissions set status=case when p_approve then 'approved' else 'rejected' end,revision=revision+1,updated_at=now() where id=p_id;
end $$;
create function diy_private.revise_comment(p_id uuid,p_body text,p_revision integer) returns void language plpgsql security definer set search_path = '' as $$
declare c public.diy_comment_submissions;
begin
 select * into c from public.diy_comment_submissions where id=p_id for update;
 if auth.uid() is null or c.user_id is distinct from auth.uid() or c.revision<>p_revision then raise exception 'Submission changed; reload'; end if;
 delete from public.diy_recipe_comments where id=p_id;
 update public.diy_comment_submissions set body=p_body,status='pending',revision=revision+1,updated_at=now() where id=p_id;
end $$;
create function diy_private.withdraw_comment(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 delete from public.diy_comment_submissions where id=p_id and user_id=auth.uid();
end $$;
-- Explicit grants: no anonymous mutation, no default PUBLIC execute on definers.
revoke all on all functions in schema diy_private from public;
grant execute on function diy_private.is_admin() to anon,authenticated;
grant execute on function diy_private.start_comment(uuid,text),diy_private.finish_comment(uuid,text[]),diy_private.moderate_comment(uuid,boolean,integer),diy_private.revise_comment(uuid,text,integer),diy_private.withdraw_comment(uuid) to authenticated;
create function public.diy_start_comment(p_recipe uuid,p_body text) returns uuid language sql security invoker set search_path='' as $$ select diy_private.start_comment(p_recipe,p_body) $$;
create function public.diy_finish_comment(p_id uuid,p_photos text[]) returns void language sql security invoker set search_path='' as $$ select diy_private.finish_comment(p_id,p_photos) $$;
create function public.diy_moderate_comment(p_id uuid,p_approve boolean,p_revision integer) returns void language sql security invoker set search_path='' as $$ select diy_private.moderate_comment(p_id,p_approve,p_revision) $$;
create function public.diy_revise_comment(p_id uuid,p_body text,p_revision integer) returns void language sql security invoker set search_path='' as $$ select diy_private.revise_comment(p_id,p_body,p_revision) $$;
create function public.diy_withdraw_comment(p_id uuid) returns void language sql security invoker set search_path='' as $$ select diy_private.withdraw_comment(p_id) $$;
revoke all on function public.diy_start_comment(uuid,text),public.diy_finish_comment(uuid,text[]),public.diy_moderate_comment(uuid,boolean,integer),public.diy_revise_comment(uuid,text,integer),public.diy_withdraw_comment(uuid) from public;
grant execute on function public.diy_start_comment(uuid,text),public.diy_finish_comment(uuid,text[]),public.diy_moderate_comment(uuid,boolean,integer),public.diy_revise_comment(uuid,text,integer),public.diy_withdraw_comment(uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('diy-comment-photos','diy-comment-photos',false,524288,array['image/webp']);
create policy diy_photo_upload on storage.objects for insert to authenticated with check(
 bucket_id='diy-comment-photos' and exists(select 1 from public.diy_comment_submissions c where c.user_id=(select auth.uid()) and c.status='uploading' and name ~ ('^'||c.user_id::text||'/'||c.id::text||'/[0-3]\.webp$'))
);
-- Definer returns only an authorization boolean; anonymous callers must not
-- receive SELECT privileges on the private submissions table to evaluate RLS.
create function diy_private.can_read_photo(p_path text) returns boolean language sql stable security definer set search_path='' as $$
 select diy_private.is_admin()
 or exists(select 1 from public.diy_recipe_comments c join public.diy_recipes r on r.id=c.recipe_id and r.is_published where p_path=any(c.photos))
 or exists(select 1 from public.diy_comment_submissions c where c.user_id=(select auth.uid()) and p_path ~ ('^'||c.user_id::text||'/'||c.id::text||'/[0-3]\.webp$'));
$$;
revoke all on function diy_private.can_read_photo(text) from public;
grant execute on function diy_private.can_read_photo(text) to anon,authenticated;
create policy diy_photo_read on storage.objects for select to anon,authenticated using(bucket_id='diy-comment-photos' and diy_private.can_read_photo(name));
create policy diy_photo_admin_delete on storage.objects for delete to authenticated using(bucket_id='diy-comment-photos' and (select diy_private.is_admin()));
-- No UPDATE/upsert or owner DELETE: approved files cannot be swapped after review.
commit;
