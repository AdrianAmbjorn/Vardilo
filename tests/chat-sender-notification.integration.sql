begin;
do $$ declare sender public.family_members; message_id uuid; notification_title text; notification_body text; begin
 select member.* into sender from public.family_members member join public.families f on f.id=member.family_id where f.name='audit-9b5589c25008' and member.role='admin' and member.user_id is not null limit 1;
 if sender.id is null then raise exception 'Synthetic fixture missing';end if;
 perform set_config('request.jwt.claim.sub',sender.user_id::text,true);
 insert into public.family_chat_messages(family_id,member_id,body)values(sender.family_id,sender.id,repeat('Test chat body ',30))returning id into message_id;
 select title,body into notification_title,notification_body from public.notifications where family_id=sender.family_id and metadata->>'message_id'=message_id::text limit 1;
 if notification_title is distinct from (sender.display_name||' skriver i chatten:') then raise exception 'Sender name missing';end if;
 if notification_body is distinct from repeat('Test chat body ',30) then raise exception 'Chat body truncated';end if;
end $$;
rollback;
select 'PASS: actual sender and full body; transaction rolled back' as result;
