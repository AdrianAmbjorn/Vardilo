alter table public.family_list_items
  add column completed_by_member_id uuid references public.family_members(id) on delete set null;

create index family_list_items_completed_by_idx
  on public.family_list_items(completed_by_member_id)
  where completed_by_member_id is not null;

create function vardilo_private.attribute_list_item()
returns trigger language plpgsql set search_path = ''
as $$
declare
  actor uuid;
begin
  if (select auth.uid()) is null then return new; end if;
  select member.id into actor
  from public.family_members member
  join public.family_lists list on list.family_id = member.family_id
  where list.id = new.list_id and member.user_id = (select auth.uid());
  if actor is null then
    raise exception 'Du tillhör inte familjen för listan.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    new.created_by_member_id := actor;
    new.completed_by_member_id := case when new.completed then actor else null end;
  else
    if new.list_id is distinct from old.list_id then
      raise exception 'Listpunkten kan inte flyttas mellan listor.' using errcode = '42501';
    end if;
    -- Allow foreign-key cleanup when a member is removed.
    if new.created_by_member_id is not null then
      new.created_by_member_id := old.created_by_member_id;
    end if;
    if not new.completed then
      new.completed_by_member_id := null;
    elsif not old.completed then
      new.completed_by_member_id := actor;
    elsif new.completed_by_member_id is not null then
      new.completed_by_member_id := old.completed_by_member_id;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function vardilo_private.attribute_list_item() from public, anon, authenticated;

create trigger attribute_list_item
before insert or update on public.family_list_items
for each row execute function vardilo_private.attribute_list_item();

notify pgrst, 'reload schema';
