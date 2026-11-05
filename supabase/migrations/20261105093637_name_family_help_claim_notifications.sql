CREATE OR REPLACE FUNCTION public.notify_family_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  recipient uuid;
  actor uuid;
begin
  if tg_table_name = 'family_chat_messages' then
    if tg_op = 'INSERT' then
      insert into public.notifications (family_id, recipient_member_id, type, title, body, href, metadata)
      select new.family_id, fm.id, 'chat', 'Nytt meddelande', left(new.body, 120), '/chat', jsonb_build_object('message_id', new.id)
      from public.family_members fm
      where fm.family_id = new.family_id and fm.id <> new.member_id;
    end if;
    return new;
  end if;

  if tg_table_name = 'help_requests' then
    if tg_op = 'INSERT' then
      insert into public.notifications (family_id, recipient_member_id, type, title, body, href, metadata)
      select new.family_id, fm.id, 'help', 'Familjen behöver hjälp', new.title, '/hjalp', jsonb_build_object('help_request_id', new.id)
      from public.family_members fm
      where fm.family_id = new.family_id and fm.id <> new.created_by_member_id;
    elsif tg_op = 'UPDATE' and new.claimed_by_member_id is distinct from old.claimed_by_member_id and new.claimed_by_member_id is not null then
      insert into public.notifications (family_id, recipient_member_id, type, title, body, href, metadata)
      select new.family_id, member.id, 'help',
        coalesce((select nullif(helper.display_name, '') from public.family_members helper
          where helper.id = new.claimed_by_member_id and helper.family_id = new.family_id), 'En familjemedlem')
        || ' hjälper ' ||
        coalesce((select nullif(requester.display_name, '') from public.family_members requester
          where requester.id = new.created_by_member_id and requester.family_id = new.family_id), 'en familjemedlem'),
        new.title, '/hjalp',
        jsonb_build_object('help_request_id', new.id, 'claimed_by_member_id', new.claimed_by_member_id,
          'created_by_member_id', new.created_by_member_id, 'action', 'help_claimed')
      from public.family_members member
      where member.family_id = new.family_id;
    end if;
    return new;
  end if;

  if tg_table_name = 'family_tasks' then
    if tg_op = 'INSERT' and new.assigned_member_id is not null then
      insert into public.notifications (family_id, recipient_member_id, type, title, body, href, metadata)
      values (new.family_id, new.assigned_member_id, 'task', 'Ny uppgift', new.title, '/uppgifter', jsonb_build_object('task_id', new.id));
    elsif tg_op = 'UPDATE' and new.assigned_member_id is distinct from old.assigned_member_id and new.assigned_member_id is not null then
      insert into public.notifications (family_id, recipient_member_id, type, title, body, href, metadata)
      values (new.family_id, new.assigned_member_id, 'task', 'Ny uppgift till dig', new.title, '/uppgifter', jsonb_build_object('task_id', new.id));
    end if;
    return new;
  end if;

  if tg_table_name = 'calendar_events' then
    if new.responsible_member_id is not null and (tg_op = 'INSERT' or new.responsible_member_id is distinct from old.responsible_member_id) then
      insert into public.notifications (family_id, recipient_member_id, type, title, body, href, metadata)
      values (new.family_id, new.responsible_member_id, 'calendar', 'Du har fått ansvar', new.title, '/kalender', jsonb_build_object('event_id', new.id));
    end if;
    return new;
  end if;

  return new;
end;
$function$
