-- Notebook Reader v1.3 — quiet community reactions.
-- Reactions belong to semantic Notebook items, not rendered paper surfaces.

create table if not exists public.notebook_reactions (
  id bigint generated always as identity primary key,
  target_type text not null check (target_type in ('today', 'person', 'product', 'question')),
  target_id text not null check (char_length(target_id) between 1 and 160),
  reader_token uuid not null,
  user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint notebook_reactions_reader_target_key unique (target_type, target_id, reader_token)
);

create index if not exists notebook_reactions_recent_idx
  on public.notebook_reactions (created_at desc);

create index if not exists notebook_reactions_target_recent_idx
  on public.notebook_reactions (target_type, target_id, created_at desc);

alter table public.notebook_reactions enable row level security;
revoke all on table public.notebook_reactions from anon, authenticated;

create or replace function public.notebook_reaction_state(
  p_target_type text,
  p_target_id text,
  p_reader_token uuid
)
returns table(reaction_count bigint, reacted boolean)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_target_type not in ('today', 'person', 'product', 'question')
     or p_target_id is null
     or char_length(trim(p_target_id)) not between 1 and 160
     or p_reader_token is null then
    raise exception 'Invalid Notebook reaction target';
  end if;

  return query
    select
      count(*)::bigint,
      exists (
        select 1
        from public.notebook_reactions mine
        where mine.target_type = p_target_type
          and mine.target_id = p_target_id
          and mine.reader_token = p_reader_token
      )
    from public.notebook_reactions r
    where r.target_type = p_target_type
      and r.target_id = p_target_id;
end;
$$;

create or replace function public.notebook_toggle_reaction(
  p_target_type text,
  p_target_id text,
  p_reader_token uuid
)
returns table(reaction_count bigint, reacted boolean)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
begin
  if p_target_type not in ('today', 'person', 'product', 'question')
     or p_target_id is null
     or char_length(trim(p_target_id)) not between 1 and 160
     or p_reader_token is null then
    raise exception 'Invalid Notebook reaction target';
  end if;

  delete from public.notebook_reactions r
  where r.target_type = p_target_type
    and r.target_id = p_target_id
    and r.reader_token = p_reader_token;

  if not found then
    insert into public.notebook_reactions (target_type, target_id, reader_token, user_id)
    values (p_target_type, p_target_id, p_reader_token, auth.uid())
    on conflict (target_type, target_id, reader_token) do nothing;
  end if;

  return query
    select
      count(*)::bigint,
      exists (
        select 1
        from public.notebook_reactions mine
        where mine.target_type = p_target_type
          and mine.target_id = p_target_id
          and mine.reader_token = p_reader_token
      )
    from public.notebook_reactions r
    where r.target_type = p_target_type
      and r.target_id = p_target_id;
end;
$$;

create or replace function public.notebook_most_noticed(
  p_reader_token uuid,
  p_limit integer default 12,
  p_window_days integer default 14
)
returns table(
  target_type text,
  target_id text,
  reaction_count bigint,
  reacted boolean,
  last_reacted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_reader_token is null then
    raise exception 'Reader token is required';
  end if;

  return query
    select
      r.target_type,
      r.target_id,
      count(*)::bigint as reaction_count,
      exists (
        select 1
        from public.notebook_reactions mine
        where mine.target_type = r.target_type
          and mine.target_id = r.target_id
          and mine.reader_token = p_reader_token
      ) as reacted,
      max(r.created_at) as last_reacted_at
    from public.notebook_reactions r
    where r.created_at >= now() - make_interval(days => least(greatest(p_window_days, 1), 90))
    group by r.target_type, r.target_id
    order by reaction_count desc, last_reacted_at desc
    limit least(greatest(p_limit, 1), 50);
end;
$$;

revoke all on function public.notebook_reaction_state(text, text, uuid) from public;
revoke all on function public.notebook_toggle_reaction(text, text, uuid) from public;
revoke all on function public.notebook_most_noticed(uuid, integer, integer) from public;

grant execute on function public.notebook_reaction_state(text, text, uuid) to anon, authenticated;
grant execute on function public.notebook_toggle_reaction(text, text, uuid) to anon, authenticated;
grant execute on function public.notebook_most_noticed(uuid, integer, integer) to anon, authenticated;
