begin;
do $$ declare adult public.family_members; kid public.family_members; other_id uuid; begin
 select a.* into adult from public.family_members a where a.role='admin' and a.user_id is not null and exists(select 1 from public.family_members c where c.family_id=a.family_id and c.role='barn' and c.user_id is not null) limit 1;
 select * into kid from public.family_members where family_id=adult.family_id and role='barn' and user_id is not null limit 1;
 if adult.id is null or kid.id is null then raise exception 'Missing linked actors for test';end if;
 insert into public.family_members(family_id,display_name,role) values(adult.family_id,'TEST daily task recipient','barn') returning id into other_id;
 perform set_config('vardilo.test_parent',adult.user_id::text,true);perform set_config('vardilo.test_child',kid.user_id::text,true);
 perform set_config('vardilo.test_kid',kid.id::text,true);perform set_config('vardilo.test_other',other_id::text,true);perform set_config('vardilo.test_family',adult.family_id::text,true);
 perform set_config('vardilo.test_request',gen_random_uuid()::text,true);perform set_config('request.jwt.claim.sub',adult.user_id::text,true);
end $$;
set local role authenticated;
do $$ declare n integer; d date:=(clock_timestamp() at time zone 'Europe/Stockholm')::date; begin
 n:=public.create_daily_tasks('TEST daily period',array[current_setting('vardilo.test_kid')::uuid,current_setting('vardilo.test_other')::uuid],20,d,d+1,current_setting('vardilo.test_request')::uuid);
 if n<>4 then raise exception 'Expected four daily rows, got %',n;end if;
 n:=public.create_daily_tasks('TEST daily period',array[current_setting('vardilo.test_kid')::uuid,current_setting('vardilo.test_other')::uuid],20,d,d+1,current_setting('vardilo.test_request')::uuid);
 if n<>0 then raise exception 'Retry was not idempotent';end if;
 begin update public.family_tasks set completed_at=now() where daily_series_id=md5(current_setting('vardilo.test_request')||current_setting('vardilo.test_kid'))::uuid and scheduled_date=d;raise exception 'Parent completed daily task';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('vardilo.test_child'),true);end $$;
set local role authenticated;
do $$ declare n integer; d date:=(clock_timestamp() at time zone 'Europe/Stockholm')::date; series uuid:=md5(current_setting('vardilo.test_request')||current_setting('vardilo.test_kid'))::uuid; begin
 begin perform public.create_daily_tasks('TEST child create',array[current_setting('vardilo.test_kid')::uuid],20,d,d,current_setting('vardilo.test_request')::uuid);raise exception 'Child created tasks';exception when insufficient_privilege then null;end;
 begin update public.family_tasks set completed_at=now() where daily_series_id=md5(current_setting('vardilo.test_request')||current_setting('vardilo.test_other'))::uuid and scheduled_date=d;raise exception 'Child completed other task';exception when insufficient_privilege then null;end;
 begin update public.family_tasks set completed_at=now() where daily_series_id=series and scheduled_date=d+1;raise exception 'Future task completed';exception when insufficient_privilege then null;end;
 update public.family_tasks set completed_at=now() where daily_series_id=series and scheduled_date=d;
 get diagnostics n=row_count;if n<>1 then raise exception 'Own completion failed';end if;
 update public.family_tasks set completed_at=now() where daily_series_id=series and scheduled_date=d;
 select sum(xp) into n from public.family_tasks where daily_series_id=series and completed_at is not null;
 if n<>20 then raise exception 'Duplicate XP: %',n;end if;
 begin update public.family_tasks set completed_at=null where daily_series_id=series and scheduled_date=d;raise exception 'Completed day cleared';exception when insufficient_privilege then null;end;
 begin update public.family_tasks set xp=2000 where daily_series_id=series and scheduled_date=d;raise exception 'XP changed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: multiple children, per-day rows, retry deduplication, parent/other-child/future restrictions, one XP award and immutable completion. All fixtures rolled back.' as result;
