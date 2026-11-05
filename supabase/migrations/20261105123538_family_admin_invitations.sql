-- Profiles and relationships remain intact when an invitation is accepted.
create table public.family_invitations (
 id uuid primary key default gen_random_uuid(),
 family_id uuid not null references public.families(id) on delete cascade,
 member_id uuid not null references public.family_members(id) on delete cascade,
 email text not null check(email=lower(btrim(email)) and position('@' in email)>1),
 token_hash text not null unique,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz,
 accepted_by uuid references auth.users(id) on delete set null,
 revoked_at timestamptz
);
create index family_invitations_family_idx on public.family_invitations(family_id);
create index family_invitations_member_idx on public.family_invitations(member_id);
alter table public.family_invitations enable row level security;
revoke all on public.family_invitations from public,anon,authenticated;
grant select(id,family_id,member_id,email,created_by,created_at,expires_at,accepted_at,revoked_at) on public.family_invitations to authenticated;
grant all on public.family_invitations to service_role;
create policy admins_read_invitations on public.family_invitations for select to authenticated using(exists(
 select 1 from public.family_members me where me.family_id=family_invitations.family_id and me.user_id=(select auth.uid()) and me.role='admin'
));

create function public.create_family_invitation(p_member_id uuid,p_email text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.family_members; target public.family_members; secret text; invitation_id uuid;
begin
 if auth.uid() is null then raise exception 'Logga in först.'; end if;
 select * into actor from public.family_members where user_id=auth.uid();
 if actor.id is null or actor.role<>'admin' then raise exception 'Bara Admin får bjuda in medlemmar.'; end if;
 perform 1 from public.families where id=actor.family_id for update;
 if not exists(select 1 from public.family_members where id=actor.id and user_id=auth.uid() and role='admin') then raise exception 'Bara Admin får hantera medlemmar.'; end if;
 select * into target from public.family_members where id=p_member_id and family_id=actor.family_id;
 if target.id is null or target.user_id is not null or target.role='barn' then raise exception 'Välj en vuxen familjeprofil utan kopplat konto. Barn får en barninloggning.'; end if;
 if length(btrim(p_email))>254 or btrim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Ange en giltig e-postadress.'; end if;
 secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 update public.family_invitations set revoked_at=now() where member_id=target.id and accepted_at is null and revoked_at is null;
 insert into public.family_invitations(family_id,member_id,email,token_hash,created_by)
 values(actor.family_id,target.id,lower(btrim(p_email)),encode(sha256(convert_to(secret,'UTF8')),'hex'),auth.uid()) returning id into invitation_id;
 return jsonb_build_object('id',invitation_id,'token',secret);
end;$$;

create function public.revoke_family_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare actor public.family_members;
begin
 select * into actor from public.family_members where user_id=auth.uid();
 if actor.id is null or actor.role<>'admin' then raise exception 'Bara Admin får återkalla inbjudningar.'; end if;
 perform 1 from public.families where id=actor.family_id for update;
 if not exists(select 1 from public.family_members where id=actor.id and user_id=auth.uid() and role='admin') then raise exception 'Bara Admin får hantera medlemmar.'; end if;
 update public.family_invitations set revoked_at=now() where id=p_invitation_id and family_id=actor.family_id and accepted_at is null;
 if not found then raise exception 'Inbjudningen kunde inte återkallas.'; end if;
end;$$;

create function public.accept_family_invitation(p_token text)
returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.family_invitations; email_address text; confirmed timestamptz; child_account boolean;
begin
 if auth.uid() is null then raise exception 'Logga in för att acceptera inbjudningen.'; end if;
 if p_token !~ '^[a-f0-9]{64}$' then raise exception 'Inbjudningen är ogiltig.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select email,email_confirmed_at,coalesce((raw_app_meta_data->>'parent_managed_child')::boolean,false)
 into email_address,confirmed,child_account from auth.users where id=auth.uid();
 if confirmed is null or child_account then raise exception 'Använd ett bekräftat vuxenkonto.'; end if;
 select * into invitation from public.family_invitations where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if invitation.id is null or invitation.email<>lower(email_address) then raise exception 'Inbjudningen gäller en annan e-postadress eller är ogiltig.'; end if;
 perform 1 from public.families where id=invitation.family_id for update;
 select * into invitation from public.family_invitations where id=invitation.id for update;
 if invitation.accepted_by=auth.uid() then return invitation.family_id; end if;
 if invitation.accepted_at is not null or invitation.revoked_at is not null or invitation.expires_at<=now() then raise exception 'Inbjudningen har gått ut, återkallats eller redan använts.'; end if;
 if exists(select 1 from public.family_members where user_id=auth.uid()) then raise exception 'Ditt konto hör redan till en familj. Kontakta Admin.'; end if;
 update public.family_members set user_id=auth.uid() where id=invitation.member_id and family_id=invitation.family_id and user_id is null and role<>'barn';
 if not found then raise exception 'Familjeprofilen kan inte kopplas. Be Admin skapa en ny inbjudning.'; end if;
 update public.family_invitations set accepted_at=now(),accepted_by=auth.uid() where id=invitation.id;
 return invitation.family_id;
end;$$;

create function public.set_family_member_role(p_member_id uuid,p_role text,p_family_role text default null)
returns void language plpgsql security definer set search_path='' as $$
declare actor public.family_members; target public.family_members;
begin
 select * into actor from public.family_members where user_id=auth.uid();
 if actor.id is null or actor.role<>'admin' then raise exception 'Bara Admin får ändra roller.'; end if;
 if p_role not in ('admin','förälder','barn','familj') or p_role is null then raise exception 'Ogiltig roll.'; end if;
 perform 1 from public.families where id=actor.family_id for update;
 if not exists(select 1 from public.family_members where id=actor.id and user_id=auth.uid() and role='admin') then raise exception 'Bara Admin får hantera medlemmar.'; end if;
 select * into target from public.family_members where id=p_member_id and family_id=actor.family_id;
 if target.id is null then raise exception 'Familjemedlemmen kunde inte hittas.'; end if;
 if exists(select 1 from public.family_child_logins where member_id=target.id) and p_role<>'barn' then raise exception 'Ett föräldrahanterat barnkonto måste behålla barnrollen.'; end if;
 if target.role='admin' and target.user_id is not null and p_role<>'admin' and not exists(select 1 from public.family_members where family_id=actor.family_id and role='admin' and user_id is not null and id<>target.id) then raise exception 'Familjen måste ha minst en Admin med kopplat konto.'; end if;
 update public.family_members set role=p_role,family_role=case when p_role='barn' then null else coalesce(nullif(p_family_role,''),target.family_role,case when p_role='familj' then 'annan_nara_familj' else null end) end where id=target.id;
 update public.family_permissions set can_manage_family=p_role='admin',can_manage_members=p_role='admin',
 can_manage_calendar=p_role in ('admin','förälder'),can_create_events=p_role in ('admin','förälder'),can_manage_tasks=p_role in ('admin','förälder'),can_manage_lists=p_role in ('admin','förälder'),can_manage_wishlists=p_role in ('admin','förälder'),can_use_chat=true,can_upload_photos=p_role in ('admin','förälder') where family_member_id=target.id;
 update public.family_invitations set revoked_at=now() where member_id=target.id and accepted_at is null and revoked_at is null;
end;$$;

revoke all on function public.create_family_invitation(uuid,text),public.revoke_family_invitation(uuid),public.accept_family_invitation(text),public.set_family_member_role(uuid,text,text) from public,anon;
grant execute on function public.create_family_invitation(uuid,text),public.revoke_family_invitation(uuid),public.accept_family_invitation(text),public.set_family_member_role(uuid,text,text) to authenticated;

-- Administration is governed by the stored role, not a client-provided flag.
update public.family_permissions permission set can_manage_family=member.role='admin',can_manage_members=member.role='admin'
from public.family_members member where member.id=permission.family_member_id;

-- Parents retain management of their own child logins without member-administration permission.
drop policy parent_reads_own_child_logins on public.family_child_logins;
create policy parent_reads_own_child_logins on public.family_child_logins for select to authenticated using(guardian_user_id=(select auth.uid()) and exists(
 select 1 from public.family_members child join public.family_members guardian on guardian.family_id=child.family_id
 where child.id=member_id and child.role='barn' and guardian.user_id=(select auth.uid()) and guardian.role in ('admin','förälder')
));

create or replace function public.add_family_member_for_current_user(
  member_name text,
  member_role text,
  member_family_role text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_family_id uuid;
  current_member_id uuid;
  new_member_id uuid;
  normalized_role text := lower(trim(member_role));
  normalized_family_role text := nullif(lower(trim(member_family_role)), '');
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(member_name), '') is null then
    raise exception 'Member name is required';
  end if;

  if normalized_role not in ('admin', 'förälder', 'barn', 'familj') then
    raise exception 'Invalid member role';
  end if;

  if normalized_role = 'familj' and normalized_family_role is null then
    raise exception 'Family relationship is required';
  end if;

  if normalized_role = 'barn' then
    normalized_family_role := null;
  end if;

  select fm.id, fm.family_id
    into current_member_id, current_family_id
  from public.family_members fm
  where fm.user_id = current_user_id
  order by fm.created_at
  limit 1;

  if current_family_id is null then
    raise exception 'Family membership not found';
  end if;

  if not exists (
    select 1
    from public.family_permissions fp
    where fp.family_member_id = current_member_id
      and fp.can_manage_members = true
      and exists(select 1 from public.family_members actor where actor.id = current_member_id and actor.role = 'admin')
  ) then
    raise exception 'You do not have permission to manage members';
  end if;

  perform 1 from public.families where id=current_family_id for update;
  if not exists(select 1 from public.family_members where id=current_member_id and user_id=auth.uid() and role='admin') then raise exception 'Bara Admin får hantera medlemmar.'; end if;

  insert into public.family_members (
    family_id,
    user_id,
    display_name,
    role,
    family_role
  )
  values (
    current_family_id,
    null,
    trim(member_name),
    normalized_role,
    normalized_family_role
  )
  returning id into new_member_id;

  insert into public.family_permissions (
    family_member_id,
    can_manage_family,
    can_manage_members,
    can_manage_calendar,
    can_create_events,
    can_manage_tasks,
    can_manage_lists,
    can_manage_wishlists,
    can_use_chat,
    can_upload_photos
  )
  values (
    new_member_id,
    normalized_role = 'admin',
    normalized_role = 'admin',
    normalized_role in ('admin', 'förälder'),
    normalized_role in ('admin', 'förälder'),
    normalized_role in ('admin', 'förälder'),
    normalized_role in ('admin', 'förälder'),
    normalized_role in ('admin', 'förälder'),
    true,
    false
  );

  return new_member_id;
end;
$$;

grant execute on function public.add_family_member_for_current_user(text, text, text) to authenticated;

create or replace function public.add_family_member_for_current_user(member_name text, member_role text)
returns uuid language sql security invoker set search_path='' as $$
select public.add_family_member_for_current_user(member_name,member_role,case when member_role='familj' then 'annan_nara_familj' else null end);
$$;
revoke all on function public.add_family_member_for_current_user(text,text),public.add_family_member_for_current_user(text,text,text) from public,anon;
grant execute on function public.add_family_member_for_current_user(text,text) to authenticated;

create or replace function public.delete_family_member_for_current_user(
  target_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  current_member_id uuid;
  target_family_id uuid;
  target_role text;
  admin_count integer;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select fm.id, fm.family_id
    into current_member_id, target_family_id
  from public.family_members fm
  join public.family_permissions fp
    on fp.family_member_id = fm.id
  where fm.user_id = current_user_id
    and fp.can_manage_members = true
    and fm.role = 'admin'
  order by fm.created_at
  limit 1;

  if current_member_id is null then
    raise exception 'You do not have permission to manage family members';
  end if;

  perform 1 from public.families where id=target_family_id for update;
  if not exists(select 1 from public.family_members where id=current_member_id and user_id=auth.uid() and role='admin') then raise exception 'Bara Admin får hantera medlemmar.'; end if;

  if target_member_id = current_member_id then
    raise exception 'You cannot remove yourself from the family';
  end if;

  select fm.role
    into target_role
  from public.family_members fm
  where fm.id = target_member_id
    and fm.family_id = target_family_id;

  if target_role is null then
    raise exception 'Family member not found';
  end if;

  if target_role = 'admin' then
    select count(*)
      into admin_count
    from public.family_members fm
    where fm.family_id = target_family_id
      and fm.role = 'admin';

    if admin_count <= 1 then
      raise exception 'The last family admin cannot be removed';
    end if;
  end if;

  delete from public.family_wishlist_reservations where reserved_by=target_member_id;

  delete from public.family_members
  where id = target_member_id
    and family_id = target_family_id;
end;
$$;

grant execute on function public.delete_family_member_for_current_user(uuid) to authenticated;

revoke all on function public.delete_family_member_for_current_user(uuid) from public,anon;

create or replace function public.create_family_for_current_user(
  family_name text,
  member_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_family_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(family_name), '') is null then
    raise exception 'Family name is required';
  end if;

  if nullif(trim(member_name), '') is null then
    raise exception 'Member name is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text,0));

  if exists (
    select 1
    from public.family_members
    where user_id = current_user_id
  ) then
    select family_id
      into new_family_id
    from public.family_members
    where user_id = current_user_id
    order by created_at
    limit 1;

    return new_family_id;
  end if;

  insert into public.families (name)
  values (trim(family_name))
  returning id into new_family_id;

  insert into public.family_members (
    family_id,
    user_id,
    display_name,
    role
  )
  values (
    new_family_id,
    current_user_id,
    trim(member_name),
    'admin'
  );

  insert into public.family_permissions (
    family_member_id,
    can_manage_family,
    can_manage_members,
    can_manage_calendar,
    can_create_events,
    can_manage_tasks,
    can_manage_lists,
    can_manage_wishlists,
    can_use_chat,
    can_upload_photos
  )
  select
    fm.id,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true,
    true
  from public.family_members fm
  where fm.family_id = new_family_id
    and fm.user_id = current_user_id;

  return new_family_id;
end;
$$;

grant execute on function public.create_family_for_current_user(text, text) to authenticated;

revoke all on function public.create_family_for_current_user(text,text) from public,anon;

create or replace function public.link_parent_managed_child(p_member_id uuid, p_child_user_id uuid, p_guardian_user_id uuid, p_parent_email text, p_username text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.family_members child
    join public.family_members guardian on guardian.family_id = child.family_id
    where child.id = p_member_id and child.role = 'barn' and child.user_id is null
    and guardian.user_id = p_guardian_user_id and guardian.role in ('admin','förälder')
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
