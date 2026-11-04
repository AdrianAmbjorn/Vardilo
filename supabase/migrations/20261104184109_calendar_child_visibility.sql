alter table public.calendar_events
  add column visible_to_children boolean not null default true;

create policy calendar_events_child_visibility
  on public.calendar_events as restrictive for all to authenticated
  using (
    visible_to_children or exists (
      select 1 from public.family_members member
      where member.family_id = calendar_events.family_id
        and member.user_id = (select auth.uid())
        and member.role <> 'barn'
    )
  )
  with check (
    visible_to_children or (
      exists (
        select 1 from public.family_members member
        where member.family_id = calendar_events.family_id
          and member.user_id = (select auth.uid())
          and member.role <> 'barn'
      )
      and (responsible_member_id is null or exists (
        select 1 from public.family_members member
        where member.id = calendar_events.responsible_member_id
          and member.family_id = calendar_events.family_id
          and member.role <> 'barn'
      ))
      and (target_member_id is null or exists (
        select 1 from public.family_members member
        where member.id = calendar_events.target_member_id
          and member.family_id = calendar_events.family_id
          and member.role <> 'barn'
      ))
    )
  );

create policy notifications_calendar_child_visibility
  on public.notifications as restrictive for select to authenticated
  using (
    type <> 'calendar'
    or not (metadata ? 'event_id')
    or exists (
      select 1 from public.family_members member
      where member.id = notifications.recipient_member_id
        and member.user_id = (select auth.uid())
        and member.role <> 'barn'
    )
    or exists (
      select 1 from public.calendar_events event
      where event.id::text = notifications.metadata->>'event_id'
        and event.family_id = notifications.family_id
        and event.visible_to_children
    )
  );

notify pgrst, 'reload schema';

create or replace function public.respond_to_calendar_assignment(target_event_id uuid, response text)
returns public.calendar_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_event public.calendar_events;
begin
  if response is null or response not in ('accepted', 'declined') then
    raise exception 'Ogiltigt svar';
  end if;

  update public.calendar_events event
  set assignment_status = response, assignment_responded_at = now(), updated_at = now()
  from public.family_members member
  where event.id = target_event_id
    and event.responsible_member_id = member.id
    and event.family_id = member.family_id
    and member.user_id = (select auth.uid())
    and (event.visible_to_children or member.role <> 'barn')
    and event.assignment_status = 'pending'
  returning event.* into updated_event;

  if updated_event.id is null then
    raise exception 'Aktiviteten väntar inte på ditt svar';
  end if;

  return updated_event;
end;
$$;
