do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
  alter publication supabase_realtime add table public.notifications;
 end if;
end $$;
create index if not exists notifications_unread_chat_recipient on public.notifications(recipient_member_id) where type='chat' and read_at is null;
alter table public.member_home_preferences drop constraint known_home_sections;
alter table public.member_home_preferences add constraint known_home_sections
check(hidden_sections <@ array['countdown','xp','calendar','help','lists','wishlists','meals','tasks','chat']::text[] and array_position(hidden_sections,null) is null);
