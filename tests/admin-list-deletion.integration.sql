begin;
do $$ declare f uuid; a uuid; p uuid; k uuid; l uuid; begin
 select id into f from public.families where name='audit-9b5589c25008';
 select user_id into a from public.family_members where family_id=f and role='admin' and user_id is not null limit 1;
 select user_id into p from public.family_members where family_id=f and role='förälder' and user_id is not null limit 1;
 select user_id into k from public.family_members where family_id=f and role='barn' and user_id is not null limit 1;
 if a is null or p is null or k is null then raise exception 'Isolated audit actors missing'; end if;
 perform set_config('list_test.admin',a::text,true);perform set_config('list_test.parent',p::text,true);perform set_config('list_test.child',k::text,true);
 perform set_config('request.jwt.claim.sub',a::text,true);
 insert into public.family_lists(family_id,name,category,created_by)values(f,'TEST admin-only delete','Mathandling',a)returning id into l;
 perform set_config('list_test.list',l::text,true);
end $$;
set local role authenticated;
do $$ declare n integer; begin
 perform set_config('request.jwt.claim.sub',current_setting('list_test.parent'),true);
 delete from public.family_lists where id=current_setting('list_test.list')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Parent deleted a list';end if;
 if not exists(select 1 from public.family_lists where id=current_setting('list_test.list')::uuid)then raise exception 'Parent lost read access';end if;
 perform set_config('request.jwt.claim.sub',current_setting('list_test.child'),true);
 delete from public.family_lists where id=current_setting('list_test.list')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Child deleted a list';end if;
 perform set_config('request.jwt.claim.sub',current_setting('list_test.admin'),true);
 delete from public.family_lists where id=current_setting('list_test.list')::uuid;get diagnostics n=row_count;if n<>1 then raise exception 'Admin could not delete test list';end if;
end $$;
rollback;
select 'PASS: parent/child denied, same-family admin allowed, rolled back' as result;
