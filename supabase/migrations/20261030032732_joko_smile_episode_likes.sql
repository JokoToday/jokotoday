-- One heart per account/episode. Raw liker identities remain owner-only.
begin;
create table public.smile_episode_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  episode_id uuid not null references public.site_gallery_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);
create index smile_episode_likes_episode_idx on public.smile_episode_likes(episode_id);
alter table public.smile_episode_likes enable row level security;
create policy smile_likes_own_select on public.smile_episode_likes for select to authenticated
using (user_id = (select auth.uid()));
create policy smile_likes_own_insert on public.smile_episode_likes for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.site_gallery_items e where e.id = episode_id
  and e.site_key = 'joko-today' and e.category = 'joko-smile'
  and e.media_type = 'video' and e.is_published
));
create policy smile_likes_own_delete on public.smile_episode_likes for delete to authenticated
using (user_id = (select auth.uid()));
revoke all on public.smile_episode_likes from public, anon, authenticated;
grant select, insert, delete on public.smile_episode_likes to authenticated;

-- Narrow aggregate API deliberately counts all accounts, without exposing identities.
-- Definer lives outside exposed schemas, with fixed empty search_path and no input.
create schema if not exists smile_private;
revoke all on schema smile_private from public;
grant usage on schema smile_private to anon, authenticated;
create function smile_private.like_counts()
returns table (episode_id uuid, like_count bigint)
language sql stable security definer set search_path = ''
as $$
  select e.id, count(l.user_id) from public.site_gallery_items e
  left join public.smile_episode_likes l on l.episode_id = e.id
  where e.site_key = 'joko-today' and e.category = 'joko-smile'
    and e.media_type = 'video' and e.is_published
  group by e.id
$$;
revoke all on function smile_private.like_counts() from public;
grant execute on function smile_private.like_counts() to anon, authenticated;
create function public.get_smile_like_counts()
returns table (episode_id uuid, like_count bigint)
language sql stable security invoker set search_path = ''
as $$ select * from smile_private.like_counts() $$;
revoke all on function public.get_smile_like_counts() from public;
grant execute on function public.get_smile_like_counts() to anon, authenticated;
commit;
