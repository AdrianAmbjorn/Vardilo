alter table public.family_tasks
  add column scheduled_date date,
  add column daily_series_id uuid,
  add column series_start date,
  add column series_end date,
  add constraint daily_task_period check (
    (scheduled_date is null and daily_series_id is null and series_start is null and series_end is null)
    or (scheduled_date is not null and daily_series_id is not null and series_start is not null and series_end is not null
      and assigned_member_id is not null and scheduled_date between series_start and series_end and series_end-series_start between 0 and 365)
  );
create unique index family_tasks_daily_day on public.family_tasks(daily_series_id,scheduled_date) where daily_series_id is not null;
create index family_tasks_assignee_date on public.family_tasks(assigned_member_id,scheduled_date);

create function vardilo_private.protect_daily_task_completion()
returns trigger language plpgsql set search_path = '' as $$
declare actor public.family_members;
begin
  if tg_op='INSERT' then
    if new.scheduled_date is not null and new.completed_at is not null then
      raise exception 'Dagliga uppgifter ska checkas av av barnet på rätt dag.' using errcode='42501';
    end if;
    return new;
  end if;
  if old.scheduled_date is not null then
    if new.assigned_member_id is distinct from old.assigned_member_id or new.scheduled_date is distinct from old.scheduled_date or new.daily_series_id is distinct from old.daily_series_id
      or new.series_start is distinct from old.series_start or new.series_end is distinct from old.series_end then
      raise exception 'Datumet för en daglig uppgift kan inte ändras.' using errcode='42501';
    end if;
    if old.completed_at is not null and (new.xp is distinct from old.xp or new.assigned_member_id is distinct from old.assigned_member_id) then
      raise exception 'Intjänade XP och ansvarig kan inte ändras i efterhand.' using errcode='42501';
    end if;
    if new.completed_at is distinct from old.completed_at then
      select * into actor from public.family_members where user_id=(select auth.uid()) and family_id=old.family_id;
      if actor.id is null or actor.role <> 'barn' or actor.id is distinct from old.assigned_member_id
        or old.scheduled_date <> (clock_timestamp() at time zone 'Europe/Stockholm')::date
        or old.completed_at is not null or new.completed_at is null then
        raise exception 'Bara barnet som fått uppgiften kan markera den klar, och bara på den aktuella dagen.' using errcode='42501';
      end if;
      new.completed_at:=clock_timestamp(); new.updated_at:=clock_timestamp();
    end if;
  elsif new.scheduled_date is not null then
    raise exception 'Skapa en ny daglig uppgift i stället.' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function vardilo_private.protect_daily_task_completion() from public,anon,authenticated;
create trigger protect_daily_task_completion before insert or update on public.family_tasks
for each row execute function vardilo_private.protect_daily_task_completion();

create function public.create_daily_tasks(p_title text,p_member_ids uuid[],p_xp integer,p_start date,p_end date,p_request_id uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare actor public.family_members; recipient uuid; series uuid; count_days integer; total integer:=0; existing integer;
begin
  select * into actor from public.family_members where user_id=(select auth.uid());
  if actor.id is null or actor.role='barn' then raise exception 'Dagliga uppgifter skapas av en vuxen.' using errcode='42501'; end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 200 or p_xp is null or p_xp not between 0 and 10000
    or p_start is null or p_end is null or p_end-p_start not between 0 and 365 or p_request_id is null
    or p_start<(clock_timestamp() at time zone 'Europe/Stockholm')::date then raise exception 'Kontrollera titel, XP och datum (högst 366 dagar).'; end if;
  if p_member_ids is null or cardinality(p_member_ids) not between 1 and 30 or exists(
    select 1 from unnest(p_member_ids) child_id where child_id is null or not exists(
      select 1 from public.family_members where id=child_id and family_id=actor.family_id and role='barn')) then
    raise exception 'Välj barn i din familj.' using errcode='42501'; end if;
  count_days:=p_end-p_start+1;
  foreach recipient in array (select array_agg(distinct id) from unnest(p_member_ids) id) loop
    -- The same request and child always produce the same series, making retries safe.
    series:=md5(p_request_id::text||recipient::text)::uuid;
    insert into public.family_tasks(family_id,title,assigned_member_id,xp,due_at,created_by,scheduled_date,daily_series_id,series_start,series_end)
    select actor.family_id,btrim(p_title),recipient,p_xp,((p_start+n)::timestamp+interval '12 hours') at time zone 'Europe/Stockholm',
      actor.user_id,p_start+n,series,p_start,p_end from generate_series(0,count_days-1)n
    on conflict(daily_series_id,scheduled_date) where daily_series_id is not null do nothing;
    get diagnostics existing=row_count; total:=total+existing;
  end loop;
  return total;
end $$;
revoke all on function public.create_daily_tasks(text,uuid[],integer,date,date,uuid) from public,anon;
grant execute on function public.create_daily_tasks(text,uuid[],integer,date,date,uuid) to authenticated;

-- A period creates just one assignment notification per child, rather than one per day.
-- Restrict the existing AFTER trigger; no other activity notifications change.
drop trigger trg_notify_tasks on public.family_tasks;
create trigger trg_notify_tasks after insert or update on public.family_tasks for each row
when (new.scheduled_date is null or new.scheduled_date=new.series_start)
execute function public.notify_family_activity();
