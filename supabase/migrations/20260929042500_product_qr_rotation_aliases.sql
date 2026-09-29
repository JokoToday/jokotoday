-- Product QR rotation + historical aliases
-- Keeps every previously issued public product code resolvable after a QR rotation.
-- Old codes are never recycled to another product.

create table if not exists public.cms_product_public_code_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.cms_products(id) on delete cascade,
  public_code text not null,
  replaced_at timestamptz not null default now(),
  replaced_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists cms_product_public_code_aliases_code_ci_unique
  on public.cms_product_public_code_aliases (upper(public_code));

create index if not exists cms_product_public_code_aliases_product_id_idx
  on public.cms_product_public_code_aliases (product_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cms_product_public_code_aliases_format'
      and conrelid = 'public.cms_product_public_code_aliases'::regclass
  ) then
    alter table public.cms_product_public_code_aliases
      add constraint cms_product_public_code_aliases_format
      check (public_code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$');
  end if;
end
$$;

comment on table public.cms_product_public_code_aliases is
  'Historical permanent product QR codes. Old printed /p/CODE links remain valid after the current product QR is rotated.';

comment on column public.cms_product_public_code_aliases.public_code is
  'Previously active public product code. Never recycle this code to another product.';

alter table public.cms_product_public_code_aliases enable row level security;

drop policy if exists "Product QR aliases are viewable by everyone"
  on public.cms_product_public_code_aliases;

create policy "Product QR aliases are viewable by everyone"
  on public.cms_product_public_code_aliases
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete, truncate, references, trigger
  on table public.cms_product_public_code_aliases
  from anon, authenticated;

grant select
  on table public.cms_product_public_code_aliases
  to anon, authenticated;

-- A current code may never reuse a historical alias.
create or replace function public.prevent_reuse_of_product_public_code_alias()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.public_code is null then
    return new;
  end if;

  new.public_code := upper(trim(new.public_code));

  if exists (
    select 1
    from public.cms_product_public_code_aliases a
    where upper(a.public_code) = upper(new.public_code)
  ) then
    raise exception 'Product public code % has already been used and cannot be recycled', new.public_code
      using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists cms_products_prevent_public_code_alias_reuse
  on public.cms_products;

create trigger cms_products_prevent_public_code_alias_reuse
before insert or update of public_code
on public.cms_products
for each row
execute function public.prevent_reuse_of_product_public_code_alias();

-- When an existing product code changes, archive the previous code automatically.
-- This keeps direct Admin/API updates safe as well as the JOKO Admin rotation UI.
create or replace function public.archive_rotated_product_public_code()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if old.public_code is not null
     and new.public_code is not null
     and upper(old.public_code) is distinct from upper(new.public_code) then
    insert into public.cms_product_public_code_aliases (
      product_id,
      public_code,
      replaced_at,
      replaced_by
    )
    values (
      new.id,
      upper(old.public_code),
      now(),
      auth.uid()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists cms_products_archive_rotated_public_code
  on public.cms_products;

create trigger cms_products_archive_rotated_public_code
after update of public_code
on public.cms_products
for each row
execute function public.archive_rotated_product_public_code();
