create table public.member_birthdays (
 member_id uuid primary key references public.family_members(id) on delete cascade,
 birth_date date not null check (birth_date >= date '1900-01-01'),
 updated_at timestamptz not null default now()
);
alter table public.member_birthdays enable row level security;
revoke all on public.member_birthdays from public,anon,authenticated;
grant select,insert,update,delete on public.member_birthdays to authenticated;
create policy birthday_owner_or_parent on public.member_birthdays for all to authenticated
using (exists(select 1 from public.family_members target join public.family_members me on me.family_id=target.family_id where target.id=member_id and me.user_id=(select auth.uid()) and (me.id=target.id or (target.role='barn' and me.role in ('admin','förälder')))))
with check (birth_date <= (now() at time zone 'Europe/Stockholm')::date and exists(select 1 from public.family_members target join public.family_members me on me.family_id=target.family_id where target.id=member_id and me.user_id=(select auth.uid()) and (me.id=target.id or (target.role='barn' and me.role in ('admin','förälder')))));
create function public.import_registered_birthday() returns trigger language plpgsql security definer set search_path='' as $$
declare value text; parsed date;
begin
 if new.user_id is null then return new; end if;
 select raw_user_meta_data->>'birth_date' into value from auth.users where id=new.user_id;
 if value ~ '^\d{4}-\d{2}-\d{2}$' and pg_input_is_valid(value,'date') then
  parsed:=value::date;
  if parsed between date '1900-01-01' and (now() at time zone 'Europe/Stockholm')::date then
   insert into public.member_birthdays(member_id,birth_date) values(new.id,parsed) on conflict(member_id) do nothing;
  end if;
 end if;
 return new;
end;$$;
revoke all on function public.import_registered_birthday() from public,anon,authenticated;
create trigger registered_birthday after insert or update of user_id on public.family_members for each row execute function public.import_registered_birthday();
create unique index birthday_notification_once on public.notifications(recipient_member_id,(metadata->>'birthday_member_id'),(metadata->>'birthday_date')) where metadata->>'action'='birthday';
create function public.deliver_family_birthdays() returns integer language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'Europe/Stockholm')::date; added integer;
begin
 if (now() at time zone 'Europe/Stockholm')::time < time '09:00' then return 0; end if;
 insert into public.notifications(family_id,recipient_member_id,type,title,body,href,metadata)
 select person.family_id,recipient.id,'system',case when person.id=recipient.id then 'Grattis på födelsedagen! 🎂' else person.display_name||' fyller år idag! 🎂' end,
 'Dags att fira tillsammans.','/notiser',jsonb_build_object('action','birthday','birthday_member_id',person.id,'birthday_date',today)
 from public.member_birthdays b join public.family_members person on person.id=b.member_id join public.family_members recipient on recipient.family_id=person.family_id
 where extract(month from b.birth_date)=extract(month from today)
 and least(extract(day from b.birth_date)::int,extract(day from (date_trunc('month',today)+interval '1 month - 1 day'))::int)=extract(day from today)
 on conflict do nothing;
 get diagnostics added=row_count; return added;
end;$$;
revoke all on function public.deliver_family_birthdays() from public,anon,authenticated;
grant execute on function public.deliver_family_birthdays() to service_role;
select cron.schedule('vardilo-family-birthdays','* * * * *','select public.deliver_family_birthdays()');
create policy gallery_own_insert on public.family_gallery_photos as restrictive for insert to authenticated with check(exists(select 1 from public.family_members me where me.user_id=(select auth.uid()) and me.id=uploaded_by_member_id and me.family_id=public.family_gallery_photos.family_id));
create policy gallery_own_delete on public.family_gallery_photos as restrictive for delete to authenticated using(exists(select 1 from public.family_members me where me.user_id=(select auth.uid()) and me.id=uploaded_by_member_id and me.family_id=public.family_gallery_photos.family_id));
notify pgrst,'reload schema';

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
        and exists(select 1 from public.family_members birthday_person where birthday_person.id::text=n.metadata->>'birthday_member_id' and birthday_person.family_id=m.family_id)))
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
