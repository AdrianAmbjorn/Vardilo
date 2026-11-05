-- Creates the workflow and tightens write access. No existing request is changed or deleted here.
revoke update,delete on public.help_requests from public,anon,authenticated;
create policy help_request_own_insert on public.help_requests as restrictive for insert to authenticated
with check(claimed_by_member_id is null and claimed_at is null and completed_at is null and exists(
 select 1 from public.family_members me where me.user_id=(select auth.uid()) and me.id=created_by_member_id and me.family_id=help_requests.family_id
));
create function public.change_help_request(p_request_id uuid,p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare me public.family_members; item public.help_requests; helper_name text; requester_name text; notification_title text;
begin
 if auth.uid() is null then raise exception 'Logga in för att ändra hjälpärendet.'; end if;
 select * into me from public.family_members where user_id=auth.uid();
 if me.id is null then raise exception 'Ditt konto behöver vara kopplat till en familj.'; end if;
 select * into item from public.help_requests where id=p_request_id and family_id=me.family_id for update;
 if item.id is null then raise exception 'Hjälpärendet finns inte kvar. Listan har uppdaterats.'; end if;
 select * into me from public.family_members where user_id=auth.uid() and family_id=item.family_id;
 if me.id is null then raise exception 'Du kan inte ändra det här hjälpärendet.'; end if;
 case p_action
 when 'claim' then
  if item.completed_at is not null then raise exception 'Hjälpen är redan klar.'; end if;
  if item.claimed_by_member_id=me.id then return to_jsonb(item); end if;
  if item.claimed_by_member_id is not null then raise exception 'Någon annan hann ta ärendet. Listan har uppdaterats.'; end if;
  if item.created_by_member_id=me.id then raise exception 'Du kan markera din egen förfrågan som klar istället.'; end if;
  update public.help_requests set claimed_by_member_id=me.id,claimed_at=clock_timestamp() where id=item.id returning * into item;
 when 'release' then
  if item.completed_at is not null then raise exception 'Öppna det klara ärendet igen först.'; end if;
  if item.claimed_by_member_id is null then raise exception 'Ärendet är redan ledigt.'; end if;
  if item.claimed_by_member_id<>me.id and me.role<>'admin' then raise exception 'Bara den som hjälper eller Admin kan lämna tillbaka ärendet.'; end if;
  update public.help_requests set claimed_by_member_id=null,claimed_at=null where id=item.id returning * into item;
  notification_title:='Hjälpärendet är ledigt igen';
 when 'complete' then
  if me.id<>item.created_by_member_id and me.id is distinct from item.claimed_by_member_id and me.role<>'admin' then raise exception 'Bara den som ber om hjälp, den som hjälper eller Admin kan markera klart.'; end if;
  if item.completed_at is not null then return to_jsonb(item); end if;
  update public.help_requests set completed_at=clock_timestamp() where id=item.id returning * into item;
  select display_name into helper_name from public.family_members where id=item.claimed_by_member_id and family_id=item.family_id;
  select display_name into requester_name from public.family_members where id=item.created_by_member_id and family_id=item.family_id;
  notification_title:=case when helper_name is null then 'Hjälpen är klar' else helper_name||' hjälpte '||coalesce(requester_name,'en familjemedlem') end;
 when 'reopen' then
  if me.id<>item.created_by_member_id and me.id is distinct from item.claimed_by_member_id and me.role<>'admin' then raise exception 'Bara de berörda eller Admin kan öppna ärendet igen.'; end if;
  if item.completed_at is null then return to_jsonb(item); end if;
  update public.help_requests set completed_at=null where id=item.id returning * into item;
  notification_title:='Hjälpärendet har öppnats igen';
 when 'cancel' then
  if me.id<>item.created_by_member_id and me.role<>'admin' then raise exception 'Bara den som skapade ärendet eller Admin kan ta bort det.'; end if;
  delete from public.help_requests where id=item.id;
  return jsonb_build_object('id',item.id,'deleted',true);
 else raise exception 'Ogiltig ändring av hjälpärendet.';
 end case;
 if notification_title is not null then
  insert into public.notifications(family_id,recipient_member_id,type,title,body,href,metadata)
  select item.family_id,recipient.id,'help',notification_title,item.title,'/hjalp',jsonb_build_object('help_request_id',item.id,'action','help_'||p_action)
  from public.family_members recipient where recipient.family_id=item.family_id;
 end if;
 return to_jsonb(item);
end;$$;
revoke all on function public.change_help_request(uuid,text) from public,anon;
grant execute on function public.change_help_request(uuid,text) to authenticated;
