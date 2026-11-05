create table public.family_budget_entries(
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 month date not null check(extract(day from month)=1),
 title text not null check(length(btrim(title)) between 1 and 160),
 kind text not null check(kind in ('income','expense')),
 amount_cents bigint not null check(amount_cents between 1 and 100000000000),
 member_id uuid not null references public.family_members(id),
 shared boolean not null default false,
 created_at timestamptz not null default now()
);
create index family_budget_month on public.family_budget_entries(family_id,month);
create index family_budget_member on public.family_budget_entries(member_id);
alter table public.family_budget_entries enable row level security;
revoke all on public.family_budget_entries from public,anon,authenticated;
grant select,insert,update,delete on public.family_budget_entries to authenticated;
grant all on public.family_budget_entries to service_role;
create policy parent_budget on public.family_budget_entries for all to authenticated
using(exists(select 1 from public.family_members me where me.family_id=family_budget_entries.family_id and me.user_id=(select auth.uid()) and me.role in ('admin','förälder')))
with check(exists(select 1 from public.family_members me where me.family_id=family_budget_entries.family_id and me.user_id=(select auth.uid()) and me.role in ('admin','förälder')));
create function vardilo_private.validate_budget_member()
returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.family_members where id=new.member_id and family_id=new.family_id and role in ('admin','förälder')) then raise exception 'Välj en förälder i samma familj.' using errcode='42501';end if;
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.family_id is distinct from old.family_id or new.created_at is distinct from old.created_at) then raise exception 'Postens identitet kan inte ändras.' using errcode='42501';end if;
 return new;
end $$;
revoke all on function vardilo_private.validate_budget_member() from public,anon,authenticated;
create trigger validate_budget_member before insert or update on public.family_budget_entries for each row execute function vardilo_private.validate_budget_member();
alter table public.member_home_preferences drop constraint known_home_sections;
alter table public.member_home_preferences add constraint known_home_sections check(hidden_sections <@ array['countdown','xp','calendar','help','lists','wishlists','budget','meals','tasks','chat']::text[] and array_position(hidden_sections,null) is null);
