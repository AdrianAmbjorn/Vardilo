begin;
do $$ declare parent public.family_members; child public.family_members; photo uuid; registered_user uuid:=gen_random_uuid(); registered_member uuid;
begin
 select p.* into parent from public.family_members p where p.role='admin' and p.user_id is not null and exists(select 1 from public.family_members c where c.family_id=p.family_id and c.role='barn' and c.user_id is not null) limit 1;
 select * into child from public.family_members where family_id=parent.family_id and role='barn' and user_id is not null limit 1;
 if parent.id is null or child.id is null then raise exception 'Actors required'; end if;
 perform set_config('birthday.parent_user',parent.user_id::text,true);perform set_config('birthday.child_user',child.user_id::text,true);perform set_config('birthday.parent',parent.id::text,true);perform set_config('birthday.child',child.id::text,true);perform set_config('birthday.family',parent.family_id::text,true);
 insert into public.family_gallery_photos(family_id,uploaded_by_member_id,image_url) values(parent.family_id,parent.id,'https://example.com/test.jpg') returning id into photo;
 perform set_config('birthday.photo',photo::text,true);
 insert into auth.users(id,aud,role,raw_user_meta_data)values(registered_user,'authenticated','authenticated','{"birth_date":"2000-02-29"}'::jsonb);
 insert into public.family_members(family_id,user_id,display_name,role)values(parent.family_id,registered_user,'TEST birthday registration','förälder')returning id into registered_member;
 if not exists(select 1 from public.member_birthdays where member_id=registered_member and birth_date=date '2000-02-29') then raise exception 'Registration date not imported';end if;
 if not exists(select 1 from public.member_countdowns where member_id=registered_member and birthday_month=2 and birthday_day=29 and kind='birthday') then raise exception 'Birthday countdown not initialized';end if;
 insert into public.calendar_push_subscriptions(endpoint,user_id,p256dh,auth_key,created_at)values('https://fcm.googleapis.com/TEST-'||registered_user,parent.user_id,repeat('a',87),repeat('a',22),now()-interval '1 day');
 perform set_config('birthday.endpoint','https://fcm.googleapis.com/TEST-'||registered_user,true);

 perform set_config('request.jwt.claim.sub',parent.user_id::text,true);
end $$;
set local role authenticated;
do $$ begin
 insert into public.member_birthdays(member_id,birth_date) values(current_setting('birthday.parent')::uuid,(now() at time zone 'Europe/Stockholm')::date-interval '20 years') on conflict(member_id) do update set birth_date=excluded.birth_date;
 insert into public.member_birthdays(member_id,birth_date) values(current_setting('birthday.child')::uuid,date '2015-02-28') on conflict(member_id) do update set birth_date=excluded.birth_date;
 begin update public.member_birthdays set birth_date=current_date+10 where member_id=current_setting('birthday.child')::uuid;raise exception 'Future birthday accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ declare n integer; before_count integer;begin
 perform public.deliver_family_birthdays();
 select count(*) into before_count from public.notifications where metadata->>'birthday_member_id'=current_setting('birthday.parent') and metadata->>'birthday_date'=((now() at time zone 'Europe/Stockholm')::date)::text;
 if (now() at time zone 'Europe/Stockholm')::time >= time '09:00' and before_count<>(select count(*) from public.family_members where family_id=current_setting('birthday.family')::uuid) then raise exception 'Family recipients missing';end if;
 perform public.deliver_family_birthdays();
 select count(*) into n from public.notifications where metadata->>'birthday_member_id'=current_setting('birthday.parent') and metadata->>'birthday_date'=((now() at time zone 'Europe/Stockholm')::date)::text;
 if n<>before_count then raise exception 'Duplicate birthday notices';end if;
 if (now() at time zone 'Europe/Stockholm')::time >= time '09:00' then
  if not exists(select 1 from public.claim_calendar_push() c join public.notifications notice on notice.id=c.notification_id where c.endpoint=current_setting('birthday.endpoint') and notice.metadata->>'birthday_member_id'=current_setting('birthday.parent')) then raise exception 'Birthday not claimable for push';end if;
  if exists(select 1 from public.claim_calendar_push() where endpoint=current_setting('birthday.endpoint')) then raise exception 'Push claimed twice without retry delay';end if;
 end if;
 perform set_config('request.jwt.claim.sub',current_setting('birthday.child_user'),true);
end $$;
set local role authenticated;
do $$ declare n integer;begin
 select count(*) into n from public.member_birthdays where member_id=current_setting('birthday.parent')::uuid;if n<>0 then raise exception 'Parent full DOB exposed';end if;
 update public.member_birthdays set birth_date=date '1990-01-01' where member_id=current_setting('birthday.parent')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Child changed parent birthday';end if;
 select count(*) into n from public.member_birthdays where member_id=current_setting('birthday.child')::uuid;if n<>1 then raise exception 'Own birthday unreadable';end if;
 delete from public.family_gallery_photos where id=current_setting('birthday.photo')::uuid;get diagnostics n=row_count;if n<>0 then raise exception 'Child deleted another uploader photo';end if;
 begin insert into public.family_gallery_photos(family_id,uploaded_by_member_id,image_url) values(current_setting('birthday.family')::uuid,current_setting('birthday.parent')::uuid,'https://example.com/forged.jpg');raise exception 'Uploader spoofed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'PASS: own/parent-child birthday access, private full dates, future date rejection, annual family notices deduplicated, gallery ownership enforced. Fixtures rolled back.' as result;
