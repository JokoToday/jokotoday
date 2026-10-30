\set ON_ERROR_STOP on
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
insert into public.smile_episode_likes(user_id,episode_id) values('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
do $$begin
  begin
    insert into public.smile_episode_likes(user_id,episode_id) values('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
    raise exception 'duplicate allowed';
  exception when unique_violation then null; end;
  begin
    insert into public.smile_episode_likes(user_id,episode_id) values('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001');
    raise exception 'cross-user insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.smile_episode_likes(user_id,episode_id) values('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002');
    raise exception 'draft insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.smile_episode_likes(user_id,episode_id) values('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003');
    raise exception 'other site insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.smile_episode_likes(user_id,episode_id) values('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004');
    raise exception 'other category insert allowed';
  exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$begin
  if (select count(*) from public.smile_episode_likes) <> 0 then raise exception 'other user likes leaked'; end if;
end$$;
delete from public.smile_episode_likes where user_id='00000000-0000-0000-0000-000000000001';
insert into public.smile_episode_likes(user_id,episode_id) values('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001');
reset role;
set role anon;
do $$begin
  if (select like_count from public.get_smile_like_counts()) <> 2 then raise exception 'aggregate wrong'; end if;
  if (select count(*) from public.get_smile_like_counts()) <> 1 then raise exception 'unpublished or unrelated leaked'; end if;
  begin perform * from public.smile_episode_likes; raise exception 'anon identities leaked'; exception when insufficient_privilege then null; end;
end$$;
reset role;
update public.site_gallery_items set is_published=false where id='10000000-0000-0000-0000-000000000001';
set role anon;
do $$begin if (select count(*) from public.get_smile_like_counts())<>0 then raise exception 'unpublished count leaked'; end if; end$$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
delete from public.smile_episode_likes where episode_id='10000000-0000-0000-0000-000000000001';
do $$begin if (select count(*) from public.smile_episode_likes)<>0 then raise exception 'unlike failed'; end if; end$$;
reset role;
do $$begin if (select count(*) from public.smile_episode_likes)<>1 then raise exception 'cross-user delete succeeded'; end if; end$$;
select 'PASS: own-only reads/writes/deletes, duplicate guard, publication scope, anonymous aggregate privacy, unpublish and unlike';
