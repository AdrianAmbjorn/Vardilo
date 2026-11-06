-- Correct creator attribution without rewriting or deleting existing menus.
drop trigger if exists trg_normalize_meal_menu_created_by on public.family_meal_menu;
create or replace function public.set_family_meal_menu_creator() returns trigger language plpgsql security invoker set search_path='' as $$
declare actor uuid;
begin
 if auth.uid() is not null then
  select id into actor from public.family_members where user_id=(select auth.uid()) and family_id=new.family_id;
  if actor is null then raise exception 'Du tillhör inte den här familjen.' using errcode='42501';end if;
  if tg_op='UPDATE' and old.family_id=new.family_id then new.created_by:=coalesce(old.created_by,actor);else new.created_by:=actor;end if;
 elsif new.created_by is not null and not exists(select 1 from public.family_members where id=new.created_by and family_id=new.family_id) then
  raise exception 'Menyförfattaren måste tillhöra familjen.' using errcode='23503';
 end if;
 return new;
end;$$;
revoke all on function public.set_family_meal_menu_creator() from public,anon,authenticated;
notify pgrst,'reload schema';
