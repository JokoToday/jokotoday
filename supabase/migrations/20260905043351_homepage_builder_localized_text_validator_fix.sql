-- Homepage Builder localized-text validator compatibility fix
-- PostgreSQL does not provide jsonb_object_length(jsonb); use jsonb_each
-- existence to reject empty localized-text objects without changing semantics.

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

  if not exists (select 1 from jsonb_each(p_value)) then
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

revoke all on function private.assert_builder_localized_text_v1(jsonb, text, text[]) from public, anon, authenticated;
