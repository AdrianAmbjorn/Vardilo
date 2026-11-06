begin;
do $$ declare parent public.family_members; kid public.family_members; test_endpoint text:='https://fcm.googleapis.com/TEST-chat-'||gen_random_uuid()::text; message_id uuid; ids uuid[]; n integer; begin
 select a.* into parent from public.family_members a where a.role='admin' and a.user_id is not null and exists(select 1 from public.family_members c where c.family_id=a.family_id and c.role='barn' and c.user_id is not null) limit 1;
 select * into kid from public.family_members where family_id=parent.family_id and role='barn' and user_id is not null limit 1;
 if kid.id is null then raise exception 'Linked actors needed'; end if;
 insert into public.calendar_push_subscriptions(endpoint,user_id,p256dh,auth_key,created_at) values(test_endpoint,kid.user_id,repeat('a',87),repeat('a',22),now()-interval '1 day');
 insert into public.family_chat_messages(family_id,member_id,body) values(parent.family_id,parent.id,'TEST chat push') returning id into message_id;
 select array_agg(id) into ids from public.notifications where recipient_member_id=kid.id and type='chat' and metadata->>'message_id'=message_id::text;
 if cardinality(ids)<>1 then raise exception 'Recipient notification missing'; end if;
 select count(*) into n from public.claim_calendar_push() c where c.endpoint=test_endpoint and c.notification_id=any(ids);
 if n<>1 then raise exception 'Chat not claimable'; end if;
 if exists(select 1 from public.claim_calendar_push() c where c.endpoint=test_endpoint and c.notification_id=any(ids)) then raise exception 'Duplicate delivery'; end if;
 insert into public.family_chat_messages(family_id,member_id,body) values(parent.family_id,parent.id,'TEST already read') returning id into message_id;
 update public.notifications set read_at=now() where recipient_member_id=kid.id and metadata->>'message_id'=message_id::text;
 if exists(select 1 from public.claim_calendar_push() c join public.notifications n on n.id=c.notification_id where c.endpoint=test_endpoint and n.metadata->>'message_id'=message_id::text) then raise exception 'Read message pushed'; end if;
 insert into public.notifications(family_id,recipient_member_id,type,title,metadata) values(parent.family_id,kid.id,'chat','TEST invalid reference',jsonb_build_object('message_id',gen_random_uuid())) returning id into message_id;
 if exists(select 1 from public.claim_calendar_push() c where c.endpoint=test_endpoint and c.notification_id=message_id) then raise exception 'Missing message pushed'; end if;
end $$;
rollback;
