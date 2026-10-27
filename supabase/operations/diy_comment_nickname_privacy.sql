-- Prepared for environments that already have the DIY comment system.
-- Existing pending and published author_name snapshots require a separate
-- audited remediation before publication; this only fixes new submissions.
create or replace function diy_private.start_comment(p_recipe uuid, p_body text)
returns uuid language plpgsql security definer set search_path to '' as $function$
declare new_id uuid; n text;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from public.diy_recipes where id=p_recipe and is_published) then raise exception 'Recipe unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from diy_private.comment_attempts where user_id=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Please try again later'; end if;
 insert into diy_private.comment_attempts(user_id) values(auth.uid());
 select coalesce(nullif(btrim(public_nickname),''),'JOKO member') into n from public.user_profiles where id=auth.uid();
 insert into public.diy_comment_submissions(recipe_id,user_id,author_name,body) values(p_recipe,auth.uid(),coalesce(n,'JOKO member'),p_body) returning id into new_id;
 return new_id;
end $function$;
