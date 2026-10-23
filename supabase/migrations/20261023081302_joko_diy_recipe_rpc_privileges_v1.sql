-- Supabase public-schema default privileges can grant anon EXECUTE directly.
-- Revoking PUBLIC alone does not remove that direct role grant. Keep the
-- existing authenticated grants and private helper authorization unchanged.
begin;
revoke execute on function public.diy_publish_recipe(uuid,integer),
 public.diy_start_comment(uuid,text), public.diy_finish_comment(uuid,text[]),
 public.diy_moderate_comment(uuid,boolean,integer),
 public.diy_revise_comment(uuid,text,integer), public.diy_withdraw_comment(uuid)
 from anon;
commit;
