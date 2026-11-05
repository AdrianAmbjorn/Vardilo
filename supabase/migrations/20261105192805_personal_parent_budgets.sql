alter table public.family_budget_entries add column owner_member_id uuid references public.family_members(id);
alter table public.family_budget_entries add constraint personal_budget_not_shared check(owner_member_id is null or not shared);
create index family_budget_owner on public.family_budget_entries(owner_member_id);
alter table public.family_budget_months add column owner_member_id uuid references public.family_members(id);
alter table public.family_budget_months drop constraint family_budget_months_pkey;
alter table public.family_budget_months add column id uuid not null default gen_random_uuid() primary key;
alter table public.family_budget_months add constraint budget_month_scope unique nulls not distinct(family_id,month,owner_member_id);
create index budget_month_owner on public.family_budget_months(owner_member_id);
drop policy parent_budget on public.family_budget_entries;
create policy parent_budget on public.family_budget_entries for all to authenticated
using(exists(select 1 from public.family_members me where me.family_id=family_budget_entries.family_id and me.user_id=(select auth.uid()) and me.role in ('admin','förälder') and (family_budget_entries.owner_member_id is null or family_budget_entries.owner_member_id=me.id)))
with check(exists(select 1 from public.family_members me where me.family_id=family_budget_entries.family_id and me.user_id=(select auth.uid()) and me.role in ('admin','förälder') and (family_budget_entries.owner_member_id is null or family_budget_entries.owner_member_id=me.id)));
drop policy parent_budget_archive on public.family_budget_months;
create policy parent_budget_archive on public.family_budget_months for select to authenticated
using(exists(select 1 from public.family_members me where me.family_id=family_budget_months.family_id and me.user_id=(select auth.uid()) and me.role in ('admin','förälder') and (family_budget_months.owner_member_id is null or family_budget_months.owner_member_id=me.id)));
create or replace function vardilo_private.validate_budget_member()
returns trigger language plpgsql set search_path='' as $$
begin
 if new.member_id is not null and not exists(select 1 from public.family_members where id=new.member_id and family_id=new.family_id and role in ('admin','förälder')) then raise exception 'Välj en förälder i samma familj.' using errcode='42501';end if;
 if new.owner_member_id is not null and (not exists(select 1 from public.family_members where id=new.owner_member_id and family_id=new.family_id and role in ('admin','förälder')) or (new.member_id is not null and new.member_id<>new.owner_member_id)) then raise exception 'En personlig budget tillhör en förälder i familjen.' using errcode='42501';end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.family_id is distinct from old.family_id or new.owner_member_id is distinct from old.owner_member_id or new.created_at is distinct from old.created_at) then raise exception 'Postens identitet och budget kan inte ändras.' using errcode='42501';end if;
 return new;
end $$;
create or replace function vardilo_private.lock_saved_budget()
returns trigger language plpgsql set search_path='' as $$
declare f uuid; m date; owner_id uuid;
begin
 if tg_op='DELETE' then f:=old.family_id;m:=old.month;owner_id:=old.owner_member_id;else f:=new.family_id;m:=new.month;owner_id:=new.owner_member_id;end if;
 if tg_op='UPDATE' and (new.month is distinct from old.month or new.owner_member_id is distinct from old.owner_member_id) then raise exception 'Flytta inte poster mellan månader eller budgetar.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(f::text||m::text||coalesce(owner_id::text,''),0));
 if exists(select 1 from public.family_budget_months where family_id=f and month=m and owner_member_id is not distinct from owner_id and saved_at is not null) then raise exception 'Månaden är sparad. Öppna den för redigering först.' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
drop function public.save_budget_month(date,text);
create function public.save_budget_month(p_month date,p_action text,p_personal boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare me public.family_members; snapshot_data jsonb; owner_id uuid;
begin
 select * into me from public.family_members where user_id=(select auth.uid()) and role in ('admin','förälder');
 if me.id is null then raise exception 'Budgeten är bara för föräldrar.' using errcode='42501';end if;
 if p_month is null or extract(day from p_month)<>1 or p_action not in ('save','reopen') or p_action is null or p_personal is null then raise exception 'Ogiltig månad eller åtgärd.';end if;
 owner_id:=case when p_personal then me.id else null end;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(me.family_id::text||p_month::text||coalesce(owner_id::text,''),0));
 if p_action='reopen' then update public.family_budget_months set saved_at=null where family_id=me.family_id and month=p_month and owner_member_id is not distinct from owner_id;return;end if;
 if exists(select 1 from public.family_budget_months where family_id=me.family_id and month=p_month and owner_member_id is not distinct from owner_id and saved_at is not null) then return;end if;
 select jsonb_build_object('entries',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'kind',e.kind,'amount_cents',e.amount_cents,'member_id',e.member_id,'shared',e.shared) order by e.created_at,e.id) from public.family_budget_entries e where e.family_id=me.family_id and e.month=p_month and e.owner_member_id is not distinct from owner_id),'[]'::jsonb),
 'parents',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name) order by p.created_at,p.id) from public.family_members p where p.family_id=me.family_id and p.role in ('admin','förälder') and (not p_personal or p.id=me.id)),'[]'::jsonb)) into snapshot_data;
 insert into public.family_budget_months(family_id,month,owner_member_id,saved_at,snapshot)values(me.family_id,p_month,owner_id,clock_timestamp(),snapshot_data)
 on conflict on constraint budget_month_scope do update set saved_at=excluded.saved_at,snapshot=excluded.snapshot;
end $$;
revoke all on function public.save_budget_month(date,text,boolean) from public,anon;
grant execute on function public.save_budget_month(date,text,boolean) to authenticated;
