-- Account-based Welcome Back cadence.
-- The server is the source of truth for whether a customer is returning after
-- the configured inactivity window. Browser storage is intentionally not used
-- for eligibility.

insert into public.cms_settings (setting_key, value)
values ('welcome_back_return_hours', '6')
on conflict (setting_key) do nothing;

create table if not exists public.customer_welcome_state (
  customer_id uuid primary key references auth.users(id) on delete cascade,
  last_visit_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.customer_welcome_state enable row level security;

-- This table is internal account state. Customers must not be able to read or
-- forge visit timestamps directly; the RPC below is the only public interface.
revoke all on table public.customer_welcome_state from public, anon, authenticated;

-- Bootstrap existing completed customer accounts from their latest known auth
-- sign-in. This lets established customers qualify naturally after rollout.
insert into public.customer_welcome_state (customer_id, last_visit_at, updated_at)
select
  p.id,
  u.last_sign_in_at,
  now()
from public.user_profiles p
join auth.users u on u.id = p.id
where p.role::text = 'customer'
  and p.profile_completed = true
  and u.last_sign_in_at is not null
on conflict (customer_id) do nothing;

create or replace function public.claim_welcome_back_visit()
returns table (
  show_welcome boolean,
  return_hours integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_previous_visit timestamptz;
  v_return_hours integer := 6;
  v_raw_hours text;
  v_inserted integer := 0;
  v_should_show boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- Only completed customer accounts participate. Staff/admin visits must not
  -- create or update customer welcome state.
  if not exists (
    select 1
    from public.user_profiles p
    where p.id = v_user_id
      and p.profile_completed = true
      and p.role::text = 'customer'
  ) then
    return query select false, v_return_hours;
    return;
  end if;

  select s.value
  into v_raw_hours
  from public.cms_settings s
  where s.setting_key = 'welcome_back_return_hours'
  limit 1;

  begin
    if v_raw_hours is not null and btrim(v_raw_hours) <> '' then
      v_return_hours := btrim(v_raw_hours)::integer;
    end if;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      v_return_hours := 6;
  end;

  -- Fail safely if the generic settings editor is used to enter an invalid
  -- operational value. The dedicated Admin control constrains the same range.
  if v_return_hours < 1 or v_return_hours > 720 then
    v_return_hours := 6;
  end if;

  -- First-ever visit for an account records state but never says "Welcome back".
  -- ON CONFLICT makes this race-safe across simultaneous devices/tabs.
  insert into public.customer_welcome_state (customer_id, last_visit_at, updated_at)
  values (v_user_id, v_now, v_now)
  on conflict (customer_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    return query select false, v_return_hours;
    return;
  end if;

  select s.last_visit_at
  into v_previous_visit
  from public.customer_welcome_state s
  where s.customer_id = v_user_id
  for update;

  v_should_show := v_previous_visit is not null
    and v_now - v_previous_visit >= make_interval(hours => v_return_hours);

  update public.customer_welcome_state
  set last_visit_at = v_now,
      updated_at = v_now
  where customer_id = v_user_id;

  return query select v_should_show, v_return_hours;
end;
$$;

revoke all on function public.claim_welcome_back_visit() from public, anon;
grant execute on function public.claim_welcome_back_visit() to authenticated;

comment on table public.customer_welcome_state is
  'Server-owned per-account visit state used by the returning-customer Welcome Back experience.';

comment on function public.claim_welcome_back_visit() is
  'Atomically records an authenticated customer homepage visit and returns whether the configured inactivity threshold was met.';
