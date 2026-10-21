-- Staging correction for the Store foundation applied before the role helper.
create or replace function public.is_store_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.user_profiles
  where id = (select auth.uid()) and role = 'admin'::public.user_role
); $$;
revoke all on function public.is_store_admin() from public;
grant execute on function public.is_store_admin() to anon, authenticated;
drop policy if exists store_categories_public_read on public.store_categories;
drop policy if exists store_categories_admin_insert on public.store_categories;
drop policy if exists store_categories_admin_update on public.store_categories;
drop policy if exists store_categories_admin_delete on public.store_categories;
drop policy if exists store_assignments_public_read on public.store_product_assignments;
drop policy if exists store_assignments_admin_insert on public.store_product_assignments;
drop policy if exists store_assignments_admin_update on public.store_product_assignments;
drop policy if exists store_assignments_admin_delete on public.store_product_assignments;
create policy store_categories_public_read on public.store_categories for select to anon,authenticated using (is_active or (select public.is_store_admin()));
create policy store_categories_admin_insert on public.store_categories for insert to authenticated with check ((select public.is_store_admin()));
create policy store_categories_admin_update on public.store_categories for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create policy store_categories_admin_delete on public.store_categories for delete to authenticated using ((select public.is_store_admin()));
create policy store_assignments_public_read on public.store_product_assignments for select to anon,authenticated using (is_published or (select public.is_store_admin()));
create policy store_assignments_admin_insert on public.store_product_assignments for insert to authenticated with check ((select public.is_store_admin()));
create policy store_assignments_admin_update on public.store_product_assignments for update to authenticated using ((select public.is_store_admin())) with check ((select public.is_store_admin()));
create policy store_assignments_admin_delete on public.store_product_assignments for delete to authenticated using ((select public.is_store_admin()));
