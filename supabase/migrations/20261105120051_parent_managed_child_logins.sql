create table public.family_child_logins (
  member_id uuid primary key references public.family_members(id) on delete cascade,
  child_user_id uuid not null unique references auth.users(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  parent_email text not null check (parent_email = lower(btrim(parent_email))),
  username text not null check (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  created_at timestamptz not null default now(),
  unique(parent_email, username),
  check(child_user_id <> guardian_user_id)
);
create index family_child_logins_guardian_idx on public.family_child_logins(guardian_user_id);
alter table public.family_child_logins enable row level security;
revoke all on public.family_child_logins from public, anon, authenticated;
grant select on public.family_child_logins to authenticated;
grant all on public.family_child_logins to service_role;
create policy parent_reads_own_child_logins on public.family_child_logins for select to authenticated
using (guardian_user_id = (select auth.uid()) and exists (
  select 1 from public.family_members child join public.family_members guardian on guardian.family_id = child.family_id
  join public.family_permissions permission on permission.family_member_id = guardian.id
  where child.id = member_id and child.role = 'barn' and guardian.user_id = (select auth.uid())
  and guardian.role in ('admin','förälder') and permission.can_manage_members
));

-- Invoker privileges: callable only by the trusted Edge Function's service role.
-- The membership update and login registration succeed or roll back together.
create function public.link_parent_managed_child(p_member_id uuid, p_child_user_id uuid, p_guardian_user_id uuid, p_parent_email text, p_username text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.family_members child
    join public.family_members guardian on guardian.family_id = child.family_id
    join public.family_permissions permission on permission.family_member_id = guardian.id
    where child.id = p_member_id and child.role = 'barn' and child.user_id is null
    and guardian.user_id = p_guardian_user_id and guardian.role in ('admin','förälder') and permission.can_manage_members
  ) then raise exception 'Not permitted'; end if;
  -- Auth identity/email are verified by the Edge Function before this service-only RPC.
  if p_child_user_id = p_guardian_user_id or exists(select 1 from public.family_members where user_id = p_child_user_id)
    then raise exception 'Invalid child account'; end if;
  update public.family_members set user_id = p_child_user_id where id = p_member_id and role = 'barn' and user_id is null;
  if not found then raise exception 'Child already linked'; end if;
  insert into public.family_child_logins(member_id,child_user_id,guardian_user_id,parent_email,username)
  values(p_member_id,p_child_user_id,p_guardian_user_id,p_parent_email,p_username);
end;
$$;
revoke all on function public.link_parent_managed_child(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.link_parent_managed_child(uuid,uuid,uuid,text,text) to service_role;
