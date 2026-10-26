alter table public.family_members
  alter column user_id drop not null;

alter table public.family_members
  add column if not exists family_role text;

alter table public.family_members
  drop constraint if exists family_members_family_role_check;

alter table public.family_members
  add constraint family_members_family_role_check check (
    family_role is null or family_role in (
      'mamma', 'pappa', 'bonusmamma', 'bonuspappa',
      'mormor', 'morfar', 'farmor', 'farfar',
      'moster', 'morbror', 'faster', 'farbror',
      'kusin', 'annan_nara_familj'
    )
  );

create or replace function public.add_family_member_for_current_user(
  member_name text,
  member_role text,
  member_family_role text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
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

  if normalized_role <> 'familj' then
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
  ) then
    raise exception 'You do not have permission to manage members';
  end if;

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
    false,
    false,
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
