create table public.member_savings_plans(
 member_id uuid primary key references public.family_members(id) on delete cascade,
 period text not null check(period in ('week','month')),
 allowance_cents bigint not null check(allowance_cents between 0 and 100000000),
 saving_cents bigint not null check(saving_cents between 0 and allowance_cents)
);
alter table public.member_savings_plans enable row level security;
revoke all on public.member_savings_plans from public,anon,authenticated;
grant select,insert,update,delete on public.member_savings_plans to authenticated;
grant all on public.member_savings_plans to service_role;
create policy own_child_savings on public.member_savings_plans for all to authenticated
using(exists(select 1 from public.family_members me where me.id=member_savings_plans.member_id and me.user_id=(select auth.uid()) and me.role='barn'))
with check(exists(select 1 from public.family_members me where me.id=member_savings_plans.member_id and me.user_id=(select auth.uid()) and me.role='barn'));
alter table public.member_home_preferences drop constraint known_home_sections;
alter table public.member_home_preferences add constraint known_home_sections check(hidden_sections <@ array['countdown','xp','calendar','help','lists','wishlists','budget','savings','meals','tasks','chat']::text[] and array_position(hidden_sections,null) is null);
