create policy family_tasks_child_insert
on public.family_tasks as restrictive for insert to authenticated
with check (
  exists (select 1 from public.family_members member
    where member.family_id = family_tasks.family_id
      and member.user_id = (select auth.uid()) and member.role <> 'barn')
);

create policy family_tasks_child_delete
on public.family_tasks as restrictive for delete to authenticated
using (
  exists (select 1 from public.family_members member
    where member.family_id = family_tasks.family_id
      and member.user_id = (select auth.uid()) and member.role <> 'barn')
);

create function vardilo_private.protect_child_task_updates()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  actor public.family_members;
begin
  select * into actor from public.family_members member
  where member.family_id = old.family_id and member.user_id = (select auth.uid());
  if actor.role = 'barn' then
    if old.assigned_member_id is distinct from actor.id
      or (to_jsonb(new) - 'completed_at' - 'updated_at') is distinct from
        (to_jsonb(old) - 'completed_at' - 'updated_at') then
      raise exception 'Du kan bara markera dina egna uppgifter som klara eller ångra dem.'
        using errcode = '42501';
    end if;
    new.completed_at := case when new.completed_at is null then null
      when old.completed_at is not null then old.completed_at else now() end;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function vardilo_private.protect_child_task_updates() from public, anon, authenticated;
create trigger protect_child_task_updates
before update on public.family_tasks for each row
execute function vardilo_private.protect_child_task_updates();
