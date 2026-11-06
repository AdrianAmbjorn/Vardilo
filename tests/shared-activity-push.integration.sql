begin;
do $$ declare parent public.family_members; kid public.family_members; list_id uuid; item_id uuid; task_id uuid; assigned_task uuid; bad_child uuid; bad_list uuid; private_notice uuid; prefix text:='https://fcm.googleapis.com/TEST-activity-'||gen_random_uuid()::text; n integer; begin
 select p.* into parent from public.family_members p where p.role='admin' and p.user_id is not null and exists(select 1 from public.family_members c where c.family_id=p.family_id and c.role='barn' and c.user_id is not null) limit 1;
 select * into kid from public.family_members where family_id=parent.family_id and role='barn' and user_id is not null limit 1;
 if kid.id is null then raise exception 'Linked actors required'; end if;
 insert into public.calendar_push_subscriptions(endpoint,user_id,p256dh,auth_key,created_at) values(prefix||'-parent',parent.user_id,repeat('a',87),repeat('a',22),now()-interval '1 day'),(prefix||'-child',kid.user_id,repeat('a',87),repeat('a',22),now()-interval '1 day');
 perform set_config('request.jwt.claim.sub',parent.user_id::text,true);
 insert into public.family_lists(family_id,name,category,created_by) values(parent.family_id,'TEST push list','Mathandling',parent.user_id) returning id into list_id;
 insert into public.family_list_items(list_id,text) values(list_id,'TEST push item') returning id into item_id;
 insert into public.family_tasks(family_id,title,assigned_member_id,xp,created_by) values(parent.family_id,'TEST push completion',kid.id,0,parent.user_id) returning id into task_id;
 insert into public.family_tasks(family_id,title,assigned_member_id,xp,created_by) values(parent.family_id,'TEST new assignment push',kid.id,0,parent.user_id) returning id into assigned_task;
 perform set_config('request.jwt.claim.sub',kid.user_id::text,true);
 update public.family_list_items set completed=true where id=item_id;
 update public.family_tasks set completed_at=now() where id=task_id;
 -- Even a malformed/legacy child-directed completion notice must not be pushed to children.
 insert into public.notifications(family_id,recipient_member_id,type,title,metadata) values(parent.family_id,kid.id,'task','TEST forbidden child',jsonb_build_object('action','task_completed','entity_id',task_id,'actor_member_id',parent.id)) returning id into bad_child;
 insert into public.notifications(family_id,recipient_member_id,type,title,metadata) values(parent.family_id,parent.id,'system','TEST private budget',jsonb_build_object('action','budget_updated')) returning id into private_notice;
 insert into public.notifications(family_id,recipient_member_id,type,title,metadata) values(parent.family_id,kid.id,'system','TEST missing list',jsonb_build_object('action','list_created','entity_id',gen_random_uuid(),'actor_member_id',parent.id)) returning id into bad_list;
 select count(*) into n from public.claim_calendar_push() c join public.notifications notice on notice.id=c.notification_id where c.endpoint like prefix||'%' and notice.metadata->>'entity_id' in(list_id::text,item_id::text,task_id::text) and notice.id<>bad_child;
 if n<>4 then raise exception 'Expected list/new item/completed item/parent task pushes, got %',n; end if;
 if exists(select 1 from public.calendar_push_deliveries where notification_id in(bad_child,private_notice,bad_list) and endpoint like prefix||'%') then raise exception 'Wrong private/child recipient push'; end if;
 if not exists(select 1 from public.calendar_push_deliveries d join public.notifications notice on notice.id=d.notification_id where d.endpoint=prefix||'-child' and notice.metadata->>'task_id'=assigned_task::text) then raise exception 'New child assignment push missing'; end if;
 if exists(select 1 from public.claim_calendar_push() c join public.notifications notice on notice.id=c.notification_id where c.endpoint like prefix||'%' and notice.metadata->>'entity_id' in(list_id::text,item_id::text,task_id::text)) then raise exception 'Duplicate push claim'; end if;
end $$;
rollback;
