-- Additive notification coverage. No historical notifications or user rows are rewritten.
create function vardilo_private.notify_shared_activity()
returns trigger language plpgsql security definer set search_path='' as $$
declare family uuid; actor public.family_members; caption text; detail text; destination text; action text;
begin
 if (select auth.uid()) is null then return new; end if;
 if tg_table_name='family_lists' then
  family:=new.family_id; caption:='skapade en lista'; detail:=new.name;
  destination:='/listor?lista='||new.id::text; action:='list_created';
 elsif tg_table_name='family_list_items' then
  select family_id into family from public.family_lists where id=new.list_id;
  if tg_op='INSERT' then caption:='lade till en listpunkt'; action:='list_item_added';
  elsif new.completed is true and old.completed is distinct from new.completed then caption:='bockade av en listpunkt'; action:='list_item_completed';
  else return new; end if;
  detail:=new.text; destination:='/listor?lista='||new.list_id::text;
 elsif tg_table_name='family_tasks' then
  if new.completed_at is null or old.completed_at is not null then return new; end if;
  family:=new.family_id; caption:='klarade en uppgift'; detail:=new.title; destination:='/uppgifter'; action:='task_completed';
 else return new; end if;
 select * into actor from public.family_members where family_id=family and user_id=(select auth.uid());
 if actor.id is null then return new; end if;
 insert into public.notifications(family_id,recipient_member_id,type,title,body,href,metadata)
 select family,m.id,case when tg_table_name='family_tasks' then 'task' else 'system' end,
 left(actor.display_name||' '||caption,200),left(detail,120),destination,
 jsonb_build_object('action',action,'entity_id',new.id,'actor_member_id',actor.id)
 from public.family_members m where m.family_id=family and m.id<>actor.id
 and (tg_table_name<>'family_tasks' or m.role in ('admin','förälder'));
 return new;
end $$;
revoke all on function vardilo_private.notify_shared_activity() from public,anon,authenticated;
create trigger notify_list_created after insert on public.family_lists for each row execute function vardilo_private.notify_shared_activity();
create trigger notify_list_item_activity after insert or update on public.family_list_items for each row execute function vardilo_private.notify_shared_activity();
create trigger notify_task_completed after update of completed_at on public.family_tasks for each row execute function vardilo_private.notify_shared_activity();
