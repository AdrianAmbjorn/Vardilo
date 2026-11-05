begin;
do $$ declare parent public.family_members; child public.family_members; w uuid; item uuid; entry uuid;
begin
 select p.* into parent from public.family_members p where p.role='admin' and p.user_id is not null and exists(select 1 from public.family_members c where c.family_id=p.family_id and c.role='barn' and c.user_id is not null) limit 1;
 select * into child from public.family_members where family_id=parent.family_id and role='barn' and user_id is not null limit 1;
 if parent.id is null or child.id is null then raise exception 'Linked test actors required';end if;
 perform set_config('test.parent_user',parent.user_id::text,true);perform set_config('test.child_user',child.user_id::text,true);perform set_config('test.parent',parent.id::text,true);perform set_config('test.child',child.id::text,true);perform set_config('test.family',parent.family_id::text,true);
 insert into public.family_wishlists(family_id,member_id,title)values(parent.family_id,child.id,'TEST privacy list')returning id into w;
 insert into public.family_wishlist_items(wishlist_id,title,purchased)values(w,'TEST purchased surprise',true)returning id into item;
 insert into public.family_wishlist_reservations(item_id,reserved_by)values(item,parent.id);
 perform set_config('test.wishlist',w::text,true);perform set_config('test.item',item::text,true);perform set_config('request.jwt.claim.sub',parent.user_id::text,true);
end $$;
set local role authenticated;
do $$ declare row record; entry uuid; n integer; begin
 select * into row from public.get_wishlist_items(current_setting('test.wishlist')::uuid);if row.purchased is distinct from true then raise exception 'Parent cannot see purchase status';end if;
 insert into public.family_budget_entries(family_id,month,title,kind,amount_cents,member_id,shared)values(current_setting('test.family')::uuid,date '2099-01-01','TEST budget','expense',12345,current_setting('test.parent')::uuid,true)returning id into entry;perform set_config('test.budget',entry::text,true);
 select count(*) into n from public.family_budget_entries where id=entry;if n<>1 then raise exception 'Parent cannot read budget';end if;
 begin insert into public.family_budget_entries(family_id,month,title,kind,amount_cents,member_id)values(current_setting('test.family')::uuid,date '2099-01-01','TEST invalid member','expense',100,current_setting('test.child')::uuid);raise exception 'Child payer accepted';exception when insufficient_privilege then null;end;
 begin insert into public.family_budget_entries(family_id,month,title,kind,amount_cents,member_id)values(gen_random_uuid(),date '2099-01-01','TEST foreign family','expense',100,current_setting('test.parent')::uuid);raise exception 'Foreign family accepted';exception when insufficient_privilege then null;end;
 perform public.save_budget_month(date '2099-01-01','save');
 if not exists(select 1 from public.family_budget_months where family_id=current_setting('test.family')::uuid and month=date '2099-01-01' and saved_at is not null and jsonb_array_length(snapshot->'entries')>=1) then raise exception 'Archive snapshot missing';end if;
 begin update public.family_budget_entries set amount_cents=999 where id=entry;raise exception 'Saved budget changed';exception when insufficient_privilege then null;end;
 begin delete from public.family_budget_entries where id=entry;raise exception 'Saved row deleted';exception when insufficient_privilege then null;end;
 perform public.save_budget_month(date '2099-01-01','reopen');
 update public.family_budget_entries set amount_cents=999 where id=entry;
 perform public.save_budget_month(date '2099-01-01','save');
 if not exists(select 1 from public.family_budget_months m, jsonb_array_elements(m.snapshot->'entries') e where m.family_id=current_setting('test.family')::uuid and m.month=date '2099-01-01' and e->>'id'=entry::text and (e->>'amount_cents')::bigint=999) then raise exception 'Resaved snapshot wrong';end if;

end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('test.child_user'),true);end $$;
set local role authenticated;
do $$ declare row record; n integer; hidden boolean; begin
 select * into row from public.get_wishlist_items(current_setting('test.wishlist')::uuid);if row.purchased is distinct from false then raise exception 'Child received purchase status';end if;
 select count(*) into n from public.family_wishlist_reservations where item_id=current_setting('test.item')::uuid;if n<>0 then raise exception 'Child sees reservations';end if;
 begin select purchased into hidden from public.family_wishlist_items where id=current_setting('test.item')::uuid;raise exception 'Direct purchase column readable';exception when insufficient_privilege then null;end;
 begin update public.family_wishlist_items set purchased=false where id=current_setting('test.item')::uuid;raise exception 'Child can change purchase status';exception when insufficient_privilege then null;end;
 update public.family_wishlist_items set title='TEST edit without revealing status' where id=current_setting('test.item')::uuid;
 select count(*) into n from public.family_budget_months where family_id=current_setting('test.family')::uuid;if n<>0 then raise exception 'Child reads saved budget';end if;
 begin perform public.save_budget_month(date '2099-01-01','reopen');raise exception 'Child reopened budget';exception when insufficient_privilege then null;end;
 select count(*) into n from public.family_budget_entries where id=current_setting('test.budget')::uuid;if n<>0 then raise exception 'Child reads budget';end if;
 update public.family_budget_entries set amount_cents=1 where id=current_setting('test.budget')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Child updates budget';end if;
 begin insert into public.family_budget_entries(family_id,month,title,kind,amount_cents,member_id)values(current_setting('test.family')::uuid,date '2099-01-01','TEST child insert','expense',100,current_setting('test.parent')::uuid);raise exception 'Child inserts budget';exception when insufficient_privilege then null;end;
 insert into public.member_savings_plans(member_id,period,allowance_cents,saving_cents)values(current_setting('test.child')::uuid,'week',10000,2000) on conflict(member_id)do update set period=excluded.period,allowance_cents=excluded.allowance_cents,saving_cents=excluded.saving_cents;
 select count(*) into n from public.member_savings_plans where member_id=current_setting('test.child')::uuid and saving_cents=2000;if n<>1 then raise exception 'Child cannot persist savings plan';end if;
 begin update public.member_savings_plans set saving_cents=20000 where member_id=current_setting('test.child')::uuid;raise exception 'Saving exceeds allowance';exception when check_violation then null;end;
 begin insert into public.member_savings_plans(member_id,period,allowance_cents,saving_cents)values(current_setting('test.parent')::uuid,'week',10000,2000);raise exception 'Child writes another savings plan';exception when insufficient_privilege then null;end;
 delete from public.family_wishlists where id=current_setting('test.wishlist')::uuid;get diagnostics n=row_count;if n<>1 then raise exception 'Child cannot delete own wishlist';end if;
 select count(*) into n from public.notifications where metadata->>'wishlist_id'=current_setting('test.wishlist');if n<>0 then raise exception 'Child received reservation deletion notice';end if;

end $$;
reset role;
do $$ begin perform set_config('request.jwt.claim.sub',current_setting('test.parent_user'),true);end $$;
set local role authenticated;
do $$ declare n integer;begin
 select count(*) into n from public.notifications where metadata->>'wishlist_id'=current_setting('test.wishlist') and metadata->>'action'='wishlist_deleted';if n<>1 then raise exception 'Reserver did not receive one private deletion notice';end if;
 select count(*) into n from public.family_wishlist_reservations where item_id=current_setting('test.item')::uuid;if n<>0 then raise exception 'Obsolete reservation remains';end if;
 select count(*) into n from public.member_savings_plans where member_id=current_setting('test.child')::uuid;if n<>0 then raise exception 'Savings plan not private';end if;
end $$;
reset role;rollback;
select 'PASS: adult purchase visibility; child purchase/reservation privacy including direct API column; child can edit wish text; parent budget access; child and foreign-family budget writes denied. Saved archive locks/reopening verified; child savings persist privately; deletion notifies reserver privately. All fixtures rolled back.' as result;
