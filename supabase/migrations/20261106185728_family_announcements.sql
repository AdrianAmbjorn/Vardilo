alter table public.family_chat_messages add column announcement_title text;
alter table public.family_chat_messages add constraint announcement_title_valid check (announcement_title is null or length(btrim(announcement_title)) between 1 and 140);

create function vardilo_private.notify_family_announcement()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.announcement_title is null then return new; end if;
 -- Runs after trg_notify_chat: reuse its notifications rather than sending duplicates.
 update public.notifications set title='🎉 '||new.announcement_title,
 metadata=metadata||jsonb_build_object('action','family_announcement')
 where family_id=new.family_id and type='chat' and metadata->>'message_id'=new.id::text;
 insert into public.notifications(family_id,recipient_member_id,type,title,body,href,metadata)
 select new.family_id,m.id,'chat','🎉 '||new.announcement_title,left(new.body,120),'/chat',
 jsonb_build_object('message_id',new.id,'action','family_announcement')
 from public.family_members m where m.family_id=new.family_id and m.id=new.member_id;
 return new;
end $$;
revoke all on function vardilo_private.notify_family_announcement() from public,anon,authenticated;
create trigger zz_notify_family_announcement after insert on public.family_chat_messages for each row execute function vardilo_private.notify_family_announcement();

create or replace function public.claim_calendar_push()
returns table(notification_id uuid, endpoint text, p256dh text, auth_key text)
language sql security invoker set search_path = ''
as $$
  with candidates as (
    select n.id, s.endpoint
    from public.notifications n
    join public.family_members m on m.id = n.recipient_member_id and m.family_id = n.family_id
    join public.calendar_push_subscriptions s on s.user_id = m.user_id and s.created_at <= n.created_at
    left join public.calendar_events e on e.id::text = n.metadata->>'event_id' and e.family_id = n.family_id
    left join public.calendar_push_deliveries d on d.notification_id = n.id and d.endpoint = s.endpoint
    where n.created_at >= now() - interval '10 minutes' and n.read_at is null
      and ((n.type = 'calendar' and n.title = 'Kalenderpåminnelse'
        and case when pg_input_is_valid(n.metadata->>'starts_at', 'timestamp with time zone') then (n.metadata->>'starts_at')::timestamptz > now() else false end
        and e.reminder_minutes is not null and e.assignment_status <> 'declined'
        and e.responsible_member_id = m.id and (e.visible_to_children or m.role <> 'barn')
        and (e.audience_member_ids is null or m.id = any(e.audience_member_ids)))
      or (n.type='system' and n.metadata->>'action'='birthday'
        and n.metadata->>'birthday_date'=((now() at time zone 'Europe/Stockholm')::date)::text
        and exists(select 1 from public.family_members birthday_person where birthday_person.id::text=n.metadata->>'birthday_member_id' and birthday_person.family_id=m.family_id))
      or (n.type='chat' and exists(select 1 from public.family_chat_messages message
        where message.id::text=n.metadata->>'message_id' and message.family_id=m.family_id
          and (message.member_id<>m.id or message.announcement_title is not null))))
      and (d.notification_id is null or (not d.finished and d.attempts < 3 and d.attempted_at < now() - interval '2 minutes'))
    order by n.created_at
    limit 50
  ), claimed as (
    insert into public.calendar_push_deliveries as d (notification_id, endpoint)
    select candidates.id, candidates.endpoint from candidates
    on conflict on constraint calendar_push_deliveries_pkey do update
      set attempted_at = now(), attempts = d.attempts + 1
      where not d.finished and d.attempts < 3 and d.attempted_at < now() - interval '2 minutes'
    returning d.notification_id, d.endpoint
  )
  select c.notification_id, c.endpoint, s.p256dh, s.auth_key
  from claimed c
  join public.calendar_push_subscriptions s on s.endpoint = c.endpoint;
$$;

revoke all on function public.claim_calendar_push() from public,anon,authenticated;
grant execute on function public.claim_calendar_push() to service_role;
