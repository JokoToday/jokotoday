-- Optional customer-saved address for future JOKO Store delivery checkout.
-- Profile RLS remains owner-scoped; no new public read policy is introduced.
alter table public.user_profiles
  add column default_delivery_address jsonb;

alter table public.user_profiles
  add constraint user_profiles_default_delivery_address_object_check
  check (
    default_delivery_address is null
    or (
      jsonb_typeof(default_delivery_address) = 'object'
      and octet_length(default_delivery_address::text) <= 4096
    )
  );

comment on column public.user_profiles.default_delivery_address is
  'Optional saved delivery address, readable and editable only under existing user profile RLS. Delivery checkout must validate required fields and snapshot the selected address onto the order.';
