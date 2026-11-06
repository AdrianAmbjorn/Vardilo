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
          and (message.member_id<>m.id or message.announcement_title is not null)))
      or (n.type='system' and n.metadata->>'action'='list_created'
        and n.metadata->>'actor_member_id'<>m.id::text
        and exists(select 1 from public.family_lists list where list.id::text=n.metadata->>'entity_id' and list.family_id=m.family_id))
      or (n.type='system' and n.metadata->>'action' in ('list_item_added','list_item_completed')
        and n.metadata->>'actor_member_id'<>m.id::text
        and exists(select 1 from public.family_list_items item join public.family_lists list on list.id=item.list_id
          where item.id::text=n.metadata->>'entity_id' and list.family_id=m.family_id))
      or (n.type='task' and n.metadata->>'task_id' is not null
        and exists(select 1 from public.family_tasks task where task.id::text=n.metadata->>'task_id'
          and task.family_id=m.family_id and task.assigned_member_id=m.id and task.completed_at is null
          and task.created_by is distinct from m.user_id))
      or (n.type='task' and n.metadata->>'action'='task_completed' and m.role in ('admin','förälder')
        and n.metadata->>'actor_member_id'<>m.id::text
        and exists(select 1 from public.family_tasks task where task.id::text=n.metadata->>'entity_id'
          and task.family_id=m.family_id and task.completed_at is not null)))
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
