-- Additive release hardening. Existing birth_date values and gallery objects are preserved.
alter table public.member_birthdays add column birthday_month smallint, add column birthday_day smallint;
update public.member_birthdays set birthday_month=extract(month from birth_date),birthday_day=extract(day from birth_date) where birth_date is not null;
alter table public.member_birthdays alter column birth_date drop not null;
alter table public.member_birthdays alter column birthday_month set not null,alter column birthday_day set not null;
alter table public.member_birthdays add constraint birthday_valid_day_month check(birthday_month between 1 and 12 and birthday_day between 1 and case when birthday_month=2 then 29 when birthday_month in (4,6,9,11) then 30 else 31 end);
create function public.normalize_birthday_parts() returns trigger language plpgsql set search_path='' as $$
begin
 if new.birth_date is not null and (new.birthday_month is null or new.birthday_day is null or (tg_op='UPDATE' and new.birth_date is distinct from old.birth_date)) then
 new.birthday_month:=extract(month from new.birth_date);new.birthday_day:=extract(day from new.birth_date);
 end if;return new;
end;$$;
revoke all on function public.normalize_birthday_parts() from public,anon,authenticated;
create trigger normalize_birthday_parts before insert or update on public.member_birthdays for each row execute function public.normalize_birthday_parts();
drop policy birthday_owner_or_parent on public.member_birthdays;
create policy birthday_owner_or_parent on public.member_birthdays for all to authenticated
using(exists(select 1 from public.family_members target join public.family_members me on me.family_id=target.family_id where target.id=member_id and me.user_id=(select auth.uid()) and (me.id=target.id or (target.role='barn' and me.role in ('admin','förälder')))))
with check((birth_date is null or birth_date <= (now() at time zone 'Europe/Stockholm')::date) and exists(select 1 from public.family_members target join public.family_members me on me.family_id=target.family_id where target.id=member_id and me.user_id=(select auth.uid()) and (me.id=target.id or (target.role='barn' and me.role in ('admin','förälder')))));
create or replace function public.import_registered_birthday() returns trigger language plpgsql security definer set search_path='' as $$
declare metadata jsonb; m integer; d integer; value text;
begin
 if new.user_id is null then return new;end if;
 select raw_user_meta_data into metadata from auth.users where id=new.user_id;
 if pg_input_is_valid(metadata->>'birthday_month','integer') and pg_input_is_valid(metadata->>'birthday_day','integer') then
 m:=(metadata->>'birthday_month')::integer;d:=(metadata->>'birthday_day')::integer;
 if m between 1 and 12 and d between 1 and 31 and pg_input_is_valid(format('2000-%s-%s',m,d),'date') then
 insert into public.member_birthdays(member_id,birthday_month,birthday_day) values(new.id,m,d) on conflict(member_id) do nothing;
 end if;
 else
 -- Compatibility with earlier registrations; never invent or discard an existing year.
 value:=metadata->>'birth_date';
 if value ~ '^\d{4}-\d{2}-\d{2}$' and pg_input_is_valid(value,'date') and value::date between date '1900-01-01' and (now() at time zone 'Europe/Stockholm')::date then
 insert into public.member_birthdays(member_id,birth_date)values(new.id,value::date)on conflict(member_id)do nothing;
 end if;end if;return new;
end;$$;
create or replace function public.sync_birthday_countdown() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.member_countdowns(member_id,kind,title,emoji,target_date,birthday_month,birthday_day)
 values(new.member_id,'birthday','Min födelsedag','🎂',make_date(2000,new.birthday_month,new.birthday_day),new.birthday_month,new.birthday_day)
 on conflict(member_id)do update set target_date=excluded.target_date,birthday_month=excluded.birthday_month,birthday_day=excluded.birthday_day,updated_at=now() where public.member_countdowns.kind='birthday';return new;
end;$$;
drop trigger birthday_countdown on public.member_birthdays;
create trigger birthday_countdown after insert or update of birthday_month,birthday_day,birth_date on public.member_birthdays for each row execute function public.sync_birthday_countdown();
create or replace function public.deliver_family_birthdays() returns integer language plpgsql security definer set search_path='' as $$
declare today date:=(now() at time zone 'Europe/Stockholm')::date;added integer;
begin
 if (now() at time zone 'Europe/Stockholm')::time < time '09:00' then return 0;end if;
 insert into public.notifications(family_id,recipient_member_id,type,title,body,href,metadata)
 select person.family_id,recipient.id,'system',case when person.id=recipient.id then 'Grattis på födelsedagen! 🎂' else person.display_name||' fyller år idag! 🎂' end,'Dags att fira tillsammans.','/notiser',jsonb_build_object('action','birthday','birthday_member_id',person.id,'birthday_date',today)
 from public.member_birthdays b join public.family_members person on person.id=b.member_id join public.family_members recipient on recipient.family_id=person.family_id
 where b.birthday_month=extract(month from today) and least(b.birthday_day,extract(day from(date_trunc('month',today)+interval '1 month - 1 day'))::int)=extract(day from today)
 on conflict do nothing;get diagnostics added=row_count;return added;
end;$$;
-- No anonymous UI needs privileged application functions. Trigger execution does not need client EXECUTE grants.
do $$ declare fn record;begin
 for fn in select p.oid::regprocedure signature,p.prorettype from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (p.prosecdef or p.prorettype='trigger'::regtype) loop
 execute format('revoke execute on function %s from public, anon',fn.signature);
 if fn.prorettype='trigger'::regtype then execute format('revoke execute on function %s from authenticated',fn.signature);end if;
 end loop;
end;$$;
-- A guardian acknowledgement is an attestation, not independent proof of legal guardianship.
alter table public.family_child_logins add column guardian_confirmed_at timestamptz,add column guardian_notice_version text;
create function public.link_child_with_guardian_ack(p_member_id uuid,p_child_user_id uuid,p_guardian_user_id uuid,p_parent_email text,p_username text,p_guardian_confirmed boolean) returns void language plpgsql set search_path='' as $$
begin
 if p_guardian_confirmed is distinct from true then raise exception 'Guardian confirmation required' using errcode='42501';end if;
 perform public.link_parent_managed_child(p_member_id,p_child_user_id,p_guardian_user_id,p_parent_email,p_username);
 update public.family_child_logins set guardian_confirmed_at=clock_timestamp(),guardian_notice_version='child-information-2026-11-06' where member_id=p_member_id and guardian_user_id=p_guardian_user_id;
end;$$;
revoke all on function public.link_child_with_guardian_ack(uuid,uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.link_child_with_guardian_ack(uuid,uuid,uuid,text,text,boolean) to service_role;
notify pgrst,'reload schema';
-- Retired features remain recoverable, but cannot receive new data from browser clients.
revoke insert on public.family_gallery_photos from authenticated;
drop policy if exists "gallery family can upload" on storage.objects;
revoke execute on function public.get_daily_family_riddle(),public.get_previous_family_riddle(),public.save_daily_family_guess(date,text) from public,anon,authenticated;
