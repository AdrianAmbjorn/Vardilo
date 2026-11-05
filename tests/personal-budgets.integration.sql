begin;
do $$ declare a public.family_members; u uuid:=gen_random_uuid(); b uuid; begin
 select * into a from public.family_members where role='admin' and user_id is not null limit 1;
 if a.id is null then raise exception 'An admin fixture context is required';end if;
 insert into auth.users(id,aud,role)values(u,'authenticated','authenticated');
 insert into public.family_members(family_id,user_id,display_name,role)values(a.family_id,u,'TEST second budget parent','förälder')returning id into b;
 perform set_config('budget_test.family',a.family_id::text,true);perform set_config('budget_test.parent1',a.id::text,true);perform set_config('budget_test.user1',a.user_id::text,true);perform set_config('budget_test.parent2',b::text,true);perform set_config('budget_test.user2',u::text,true);perform set_config('request.jwt.claim.sub',a.user_id::text,true);
end $$;
set local role authenticated;
do $$ declare common uuid; personal uuid; n integer;begin
 insert into public.family_budget_entries(family_id,month,title,kind,amount_cents,shared)values(current_setting('budget_test.family')::uuid,date '2098-01-01','TEST undecided expense','expense',10000,true)returning id into common;
 insert into public.family_budget_entries(family_id,month,title,kind,amount_cents,owner_member_id)values(current_setting('budget_test.family')::uuid,date '2098-01-01','TEST private expense','expense',5000,current_setting('budget_test.parent1')::uuid)returning id into personal;
 perform set_config('budget_test.common',common::text,true);perform set_config('budget_test.private1',personal::text,true);
 update public.family_budget_entries set member_id=current_setting('budget_test.parent1')::uuid where id=common;get diagnostics n=row_count;if n<>1 then raise exception 'Cannot choose payer after creating entry';end if;
 update public.family_budget_entries set member_id=null where id=common;
 perform public.save_budget_month(date '2098-01-01','save',true);
 if not exists(select 1 from public.family_budget_months where month=date '2098-01-01' and owner_member_id=current_setting('budget_test.parent1')::uuid and jsonb_array_length(snapshot->'entries')=1) then raise exception 'Private snapshot mixed with shared rows';end if;
 -- Saving the personal budget must not lock the family budget for the same month.
 update public.family_budget_entries set amount_cents=20000 where id=common;
 perform public.save_budget_month(date '2098-01-01','save',false);
 if not exists(select 1 from public.family_budget_months where family_id=current_setting('budget_test.family')::uuid and month=date '2098-01-01' and owner_member_id is null and jsonb_array_length(snapshot->'entries')=1) then raise exception 'Shared snapshot mixed with private rows';end if;
end $$;
reset role;do $$ begin perform set_config('request.jwt.claim.sub',current_setting('budget_test.user2'),true);end $$;
set local role authenticated;
do $$ declare n integer; row_id uuid;begin
 select count(*) into n from public.family_budget_entries where id=current_setting('budget_test.common')::uuid;if n<>1 then raise exception 'Second parent cannot read shared budget';end if;
 select count(*) into n from public.family_budget_entries where id=current_setting('budget_test.private1')::uuid;if n<>0 then raise exception 'Personal entry visible to another parent';end if;
 select count(*) into n from public.family_budget_months where month=date '2098-01-01' and owner_member_id=current_setting('budget_test.parent1')::uuid;if n<>0 then raise exception 'Private archive visible to another parent';end if;
 update public.family_budget_entries set amount_cents=1 where id=current_setting('budget_test.private1')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Another parent can change personal budget';end if;
 begin insert into public.family_budget_entries(family_id,month,title,kind,amount_cents,owner_member_id)values(current_setting('budget_test.family')::uuid,date '2098-02-01','TEST forbidden private write','expense',5000,current_setting('budget_test.parent1')::uuid);raise exception 'Another parent can insert into personal budget';exception when insufficient_privilege then null;end;
 insert into public.family_budget_entries(family_id,month,title,kind,amount_cents,owner_member_id)values(current_setting('budget_test.family')::uuid,date '2098-01-01','TEST private income','income',5000,current_setting('budget_test.parent2')::uuid);
 perform public.save_budget_month(date '2098-01-01','save',true);
 -- Either parent can reopen the shared budget without unlocking either personal budget.
 perform public.save_budget_month(date '2098-01-01','reopen',false);
 update public.family_budget_entries set member_id=current_setting('budget_test.parent2')::uuid where id=current_setting('budget_test.common')::uuid;
 insert into public.family_budget_entries(family_id,month,title,kind,amount_cents)values(current_setting('budget_test.family')::uuid,date '2098-01-01','TEST removable income','income',100)returning id into row_id;
 delete from public.family_budget_entries where id=row_id;get diagnostics n=row_count;if n<>1 then raise exception 'Cannot remove income';end if;
 insert into public.family_budget_entries(family_id,month,title,kind,amount_cents)values(current_setting('budget_test.family')::uuid,date '2098-01-01','TEST removable expense','expense',100)returning id into row_id;
 delete from public.family_budget_entries where id=row_id;get diagnostics n=row_count;if n<>1 then raise exception 'Cannot remove expense';end if;
end $$;
reset role;do $$ begin perform set_config('request.jwt.claim.sub',current_setting('budget_test.user1'),true);end $$;
set local role authenticated;
do $$ declare n integer;begin
 select count(*) into n from public.family_budget_months where month=date '2098-01-01' and owner_member_id=current_setting('budget_test.parent2')::uuid;if n<>0 then raise exception 'Second private archive leaked';end if;
 begin update public.family_budget_entries set amount_cents=1 where id=current_setting('budget_test.private1')::uuid;raise exception 'Reopening shared budget unlocked personal one';exception when insufficient_privilege then null;end;
end $$;
reset role;rollback;
select 'PASS: two parent identities, personal entries and archives isolated, shared budget visible to both, separate month locks, optional payer assigned later, income and expense deletion. Fixtures including the temporary auth identity rolled back.' as result;
