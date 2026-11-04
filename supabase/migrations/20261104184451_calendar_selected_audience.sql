alter table public.calendar_events add column audience_member_ids uuid[];

create policy calendar_selected_audience
  on public.calendar_events as restrictive for all to authenticated
  using (
    audience_member_ids is null
    or created_by = (select auth.uid())
    or exists (
      select 1 from public.family_members member
      where member.family_id = calendar_events.family_id
        and member.user_id = (select auth.uid())
        and member.id = any(calendar_events.audience_member_ids)
    )
  )
  with check (
    audience_member_ids is null or (
      created_by = (select auth.uid())
      and visible_to_children
      and cardinality(audience_member_ids) > 0
      and audience_member_ids <@ array(
        select member.id from public.family_members member
        where member.family_id = calendar_events.family_id
      )
      and (responsible_member_id is null or responsible_member_id = any(audience_member_ids))
      and (target_member_id is null or target_member_id = any(audience_member_ids))
    )
  );

create policy calendar_selected_audience_update
  on public.calendar_events as restrictive for update to authenticated
  using (audience_member_ids is null or created_by = (select auth.uid()));

create policy calendar_selected_audience_delete
  on public.calendar_events as restrictive for delete to authenticated
  using (audience_member_ids is null or created_by = (select auth.uid()));

create policy notifications_calendar_selected_audience
  on public.notifications as restrictive for select to authenticated
  using (
    type <> 'calendar' or not (metadata ? 'event_id') or exists (
      select 1 from public.calendar_events event
      where event.id = case when (notifications.metadata->>'event_id') ~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then (notifications.metadata->>'event_id')::uuid end
        and event.family_id = notifications.family_id
    )
  );

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
    and (event.audience_member_ids is null or member.id = any(event.audience_member_ids))
    and event.assignment_status = 'pending'
  returning event.* into updated_event;

  if updated_event.id is null then
    raise exception 'Aktiviteten väntar inte på ditt svar';
  end if;

  return updated_event;
end;
$$;

notify pgrst, 'reload schema';
