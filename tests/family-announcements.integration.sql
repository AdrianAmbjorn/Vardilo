begin;
do $$ declare actor public.family_members; peer public.family_members; message_id uuid; prefix text:='https://fcm.googleapis.com/TEST-announcement-'||gen_random_uuid()::text; begin
 select a.* into actor from public.family_members a where a.role='admin' and a.user_id is not null and exists(select 1 from public.family_members p where p.family_id=a.family_id and p.id<>a.id and p.user_id is not null) limit 1;
 select * into peer from public.family_members where family_id=actor.family_id and id<>actor.id and user_id is not null limit 1;
 if peer.id is null then raise exception 'Linked actors required'; end if;
 perform set_config('announcement.actor',actor.id::text,true);perform set_config('announcement.family',actor.family_id::text,true);perform set_config('announcement.prefix',prefix,true);perform set_config('request.jwt.claim.sub',actor.user_id::text,true);
 insert into public.calendar_push_subscriptions(endpoint,user_id,p256dh,auth_key,created_at) values(prefix||'-author',actor.user_id,repeat('a',87),repeat('a',22),now()-interval '1 day'),(prefix||'-peer',peer.user_id,repeat('a',87),repeat('a',22),now()-interval '1 day');
end $$;
set local role authenticated;
do $$ declare message_id uuid; begin
 insert into public.family_chat_messages(family_id,member_id,body,announcement_title) values(current_setting('announcement.family')::uuid,current_setting('announcement.actor')::uuid,'TEST family news','TEST Nytt jobb!') returning id into message_id;
 perform set_config('announcement.message',message_id::text,true);
 begin insert into public.family_chat_messages(family_id,member_id,body,announcement_title) values(current_setting('announcement.family')::uuid,current_setting('announcement.actor')::uuid,'TEST invalid',' ');raise exception 'Empty announcement accepted';exception when check_violation then null;end;
end $$;
reset role;
do $$ declare n integer; begin
 select count(*) into n from public.notifications where metadata->>'message_id'=current_setting('announcement.message');
 if n<>(select count(*) from public.family_members where family_id=current_setting('announcement.family')::uuid) then raise exception 'Missing or duplicate family notices'; end if;
 if exists(select 1 from public.notifications where metadata->>'message_id'=current_setting('announcement.message') and (title<>'🎉 TEST Nytt jobb!' or metadata->>'action'<>'family_announcement' or family_id<>current_setting('announcement.family')::uuid)) then raise exception 'Incorrect announcement notification'; end if;
 select count(*) into n from public.claim_calendar_push() c join public.notifications notice on notice.id=c.notification_id where c.endpoint like current_setting('announcement.prefix')||'%' and notice.metadata->>'message_id'=current_setting('announcement.message');
 if n<>2 then raise exception 'Author/peer push missing'; end if;
end $$;
set local role authenticated;
delete from public.family_chat_messages where id=current_setting('announcement.message')::uuid;
reset role;
do $$ begin if exists(select 1 from public.notifications where metadata->>'message_id'=current_setting('announcement.message')) then raise exception 'Deleted announcement left queued notices'; end if; end $$;
rollback;
