-- Reconcile admin authorization with the role-based Admin UI.
-- Public read policies remain unchanged; only authenticated admin-role users
-- may manage cutoff rules and holiday overrides.

drop policy if exists "Admins can manage all cutoff rules" on public.pickup_cutoff_rules;
create policy "Admins can manage all cutoff rules"
on public.pickup_cutoff_rules
for all
to authenticated
using (
  exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);

drop policy if exists "Admins can manage all overrides" on public.pickup_overrides;
create policy "Admins can manage all overrides"
on public.pickup_overrides
for all
to authenticated
using (
  exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.user_profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  )
);
