create policy family_chat_messages_sender_insert
on public.family_chat_messages as restrictive for insert to authenticated
with check (
  exists (
    select 1 from public.family_members member
    where member.id = family_chat_messages.member_id
      and member.family_id = family_chat_messages.family_id
      and member.user_id = (select auth.uid())
  )
);

create policy family_chat_messages_delete_own
on public.family_chat_messages for delete to authenticated
using (
  exists (
    select 1 from public.family_members member
    where member.id = family_chat_messages.member_id
      and member.family_id = family_chat_messages.family_id
      and member.user_id = (select auth.uid())
  )
);

create function vardilo_private.remove_deleted_chat_notifications()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.notifications
  where family_id = old.family_id and type = 'chat'
    and metadata @> jsonb_build_object('message_id', old.id);
  return old;
end;
$$;

revoke all on function vardilo_private.remove_deleted_chat_notifications() from public, anon, authenticated;

create trigger remove_deleted_chat_notifications
after delete on public.family_chat_messages
for each row execute function vardilo_private.remove_deleted_chat_notifications();
