create or replace function public.create_family_for_current_user(
  family_name text,
  member_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
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
