create extension if not exists pg_cron;
create schema if not exists vardilo_private;
revoke all on schema vardilo_private from public, anon, authenticated;

create function vardilo_private.deliver_calendar_reminders()
returns void
language sql
set search_path = ''
as $$
  with candidates as (
    select event.*, occurrence.starts_at as occurrence_start
    from public.calendar_events event
    join public.family_members recipient
      on recipient.id = event.responsible_member_id
      and recipient.family_id = event.family_id
    cross join lateral (
      select event.starts_at
      where not (
        event.recurrence_enabled and event.recurrence_end_date is not null
        and cardinality(event.recurrence_days) > 0
      )
      union all
      select (local_day.day + (event.starts_at at time zone 'Europe/Stockholm')::time)
        at time zone 'Europe/Stockholm'
      from (values
        ((now() at time zone 'Europe/Stockholm')::date),
        ((now() at time zone 'Europe/Stockholm')::date + 1)
      ) as local_day(day)
      where event.recurrence_enabled
        and local_day.day between (event.starts_at at time zone 'Europe/Stockholm')::date
          and event.recurrence_end_date
        and (extract(isodow from local_day.day)::integer - 1) = any(event.recurrence_days)
    ) occurrence
    where event.reminder_minutes is not null
      and event.assignment_status <> 'declined'
      and occurrence.starts_at >= event.starts_at
      and occurrence.starts_at > now()
      and occurrence.starts_at - make_interval(mins => event.reminder_minutes) <= now()
  )
  insert into public.notifications (id, family_id, recipient_member_id, type, title, body, href, metadata)
  select
    md5(concat_ws(':', 'vardilo-calendar-reminder', id, responsible_member_id, extract(epoch from occurrence_start)))::uuid,
    family_id, responsible_member_id, 'calendar', 'Kalenderpåminnelse', title, '/kalender',
    jsonb_build_object('event_id', id, 'starts_at', occurrence_start, 'reminder_minutes', reminder_minutes)
  from candidates
  on conflict (id) do nothing;
$$;

revoke all on function vardilo_private.deliver_calendar_reminders() from public, anon, authenticated;

select cron.schedule(
  'vardilo-calendar-reminders',
  '* * * * *',
  'select vardilo_private.deliver_calendar_reminders()'
);
