create table public.family_budget_months(
 family_id uuid not null references public.families(id) on delete cascade,
 month date not null check(extract(day from month)=1),
 saved_at timestamptz,
 snapshot jsonb not null default '{"entries":[],"parents":[]}',
 primary key(family_id,month)
);
alter table public.family_budget_months enable row level security;
revoke all on public.family_budget_months from public,anon,authenticated;
grant select on public.family_budget_months to authenticated;
grant all on public.family_budget_months to service_role;
create policy parent_budget_archive on public.family_budget_months for select to authenticated
using(exists(select 1 from public.family_members me where me.family_id=family_budget_months.family_id and me.user_id=(select auth.uid()) and me.role in ('admin','förälder')));
create function vardilo_private.lock_saved_budget()
returns trigger language plpgsql set search_path='' as $$
declare f uuid; m date;
begin
 if tg_op='DELETE' then f:=old.family_id;m:=old.month;else f:=new.family_id;m:=new.month;end if;
 if tg_op='UPDATE' and new.month is distinct from old.month then raise exception 'Flytta inte poster mellan månader.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(f::text||m::text,0));
 if exists(select 1 from public.family_budget_months where family_id=f and month=m and saved_at is not null) then raise exception 'Månaden är sparad. Öppna den för redigering först.' using errcode='42501';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function vardilo_private.lock_saved_budget() from public,anon,authenticated;
create trigger lock_saved_budget before insert or update or delete on public.family_budget_entries for each row execute function vardilo_private.lock_saved_budget();
create function public.save_budget_month(p_month date,p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare me public.family_members; snapshot_data jsonb;
begin
 select * into me from public.family_members where user_id=(select auth.uid()) and role in ('admin','förälder');
 if me.id is null then raise exception 'Budgeten är bara för föräldrar.' using errcode='42501';end if;
 if p_month is null or extract(day from p_month)<>1 or p_action not in ('save','reopen') or p_action is null then raise exception 'Ogiltig månad eller åtgärd.';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(me.family_id::text||p_month::text,0));
 if p_action='reopen' then update public.family_budget_months set saved_at=null where family_id=me.family_id and month=p_month;return;end if;
 if exists(select 1 from public.family_budget_months where family_id=me.family_id and month=p_month and saved_at is not null) then return;end if;
 select jsonb_build_object('entries',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'title',e.title,'kind',e.kind,'amount_cents',e.amount_cents,'member_id',e.member_id,'shared',e.shared) order by e.created_at,e.id) from public.family_budget_entries e where e.family_id=me.family_id and e.month=p_month),'[]'::jsonb),
 'parents',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name) order by p.created_at,p.id) from public.family_members p where p.family_id=me.family_id and p.role in ('admin','förälder')),'[]'::jsonb)) into snapshot_data;
 insert into public.family_budget_months(family_id,month,saved_at,snapshot)values(me.family_id,p_month,clock_timestamp(),snapshot_data)
 on conflict(family_id,month)do update set saved_at=excluded.saved_at,snapshot=excluded.snapshot;
end $$;
revoke all on function public.save_budget_month(date,text) from public,anon;
grant execute on function public.save_budget_month(date,text) to authenticated;
