create table public.member_home_preferences (
  member_id uuid primary key references public.family_members(id) on delete cascade,
  hidden_sections text[] not null default '{}',
  constraint known_home_sections check (hidden_sections <@ array['countdown','xp','calendar','help','lists','meals','tasks','chat']::text[] and array_position(hidden_sections, null) is null)
);
alter table public.member_home_preferences enable row level security;
revoke all on public.member_home_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.member_home_preferences to authenticated;
grant all on public.member_home_preferences to service_role;
create policy own_home_preferences on public.member_home_preferences for all to authenticated
using (exists (select 1 from public.family_members me where me.id = member_id and me.user_id = (select auth.uid())))
with check (exists (select 1 from public.family_members me where me.id = member_id and me.user_id = (select auth.uid())));
