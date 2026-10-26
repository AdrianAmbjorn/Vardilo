create or replace function public.delete_family_member_for_current_user(
  target_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
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
  order by fm.created_at
  limit 1;

  if current_member_id is null then
    raise exception 'You do not have permission to manage family members';
  end if;

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

  delete from public.family_members
  where id = target_member_id
    and family_id = target_family_id;
end;
$$;

grant execute on function public.delete_family_member_for_current_user(uuid) to authenticated;
