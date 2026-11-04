create extension if not exists pg_net;

create table public.calendar_push_subscriptions (
  endpoint text primary key check (length(endpoint) <= 2048),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{87}$'),
  auth_key text not null check (auth_key ~ '^[A-Za-z0-9_-]{22}$'),
  created_at timestamptz not null default now()
);

alter table public.calendar_push_subscriptions enable row level security;
revoke all on public.calendar_push_subscriptions from public, anon, authenticated;
grant select, insert, delete on public.calendar_push_subscriptions to authenticated;
grant all on public.calendar_push_subscriptions to service_role;

create policy calendar_push_owner on public.calendar_push_subscriptions
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index calendar_push_subscriptions_user on public.calendar_push_subscriptions(user_id);

create table public.calendar_push_deliveries (
  notification_id uuid references public.notifications(id) on delete cascade,
  endpoint text references public.calendar_push_subscriptions(endpoint) on delete cascade,
  attempted_at timestamptz not null default now(),
  attempts integer not null default 1,
  finished boolean not null default false,
  primary key (notification_id, endpoint)
);

alter table public.calendar_push_deliveries enable row level security;
revoke all on public.calendar_push_deliveries from public, anon, authenticated;
grant all on public.calendar_push_deliveries to service_role;
create index calendar_push_deliveries_endpoint on public.calendar_push_deliveries(endpoint);

create function public.calendar_push_config(worker_token text)
returns jsonb
language sql security definer set search_path = ''
as $$
  select case when worker_token <> '' and worker_token = (
    select decrypted_secret from vault.decrypted_secrets where name = 'vardilo_calendar_push_worker'
  ) then (
    select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'vardilo_calendar_push_vapid'
  ) end;
$$;

revoke all on function public.calendar_push_config(text) from public, anon, authenticated;
grant execute on function public.calendar_push_config(text) to service_role;

create function public.calendar_push_public_key()
returns text
language sql security definer set search_path = ''
as $$
  select decrypted_secret::jsonb->>'publicKey'
  from vault.decrypted_secrets where name = 'vardilo_calendar_push_vapid';
$$;

revoke all on function public.calendar_push_public_key() from public, anon;
grant execute on function public.calendar_push_public_key() to authenticated;

create function public.claim_calendar_push()
returns table(notification_id uuid, endpoint text, p256dh text, auth_key text)
language sql security invoker set search_path = ''
as $$
  with candidates as (
    select n.id, s.endpoint
    from public.notifications n
    join public.family_members m on m.id = n.recipient_member_id and m.family_id = n.family_id
    join public.calendar_push_subscriptions s on s.user_id = m.user_id and s.created_at <= n.created_at
    join public.calendar_events e on e.id::text = n.metadata->>'event_id' and e.family_id = n.family_id
    left join public.calendar_push_deliveries d on d.notification_id = n.id and d.endpoint = s.endpoint
    where n.type = 'calendar' and n.title = 'Kalenderpåminnelse'
      and n.created_at >= now() - interval '10 minutes'
      and n.read_at is null
      and case when pg_input_is_valid(n.metadata->>'starts_at', 'timestamp with time zone')
        then (n.metadata->>'starts_at')::timestamptz > now() else false end
      and e.reminder_minutes is not null and e.assignment_status <> 'declined'
      and e.responsible_member_id = m.id
      and (e.visible_to_children or m.role <> 'barn')
      and (e.audience_member_ids is null or m.id = any(e.audience_member_ids))
      and (d.notification_id is null or (not d.finished and d.attempts < 3 and d.attempted_at < now() - interval '2 minutes'))
    order by n.created_at
    limit 50
  ), claimed as (
    insert into public.calendar_push_deliveries as d (notification_id, endpoint)
    select candidates.id, candidates.endpoint from candidates
    on conflict on constraint calendar_push_deliveries_pkey do update
      set attempted_at = now(), attempts = d.attempts + 1
      where not d.finished and d.attempts < 3 and d.attempted_at < now() - interval '2 minutes'
    returning d.notification_id, d.endpoint
  )
  select c.notification_id, c.endpoint, s.p256dh, s.auth_key
  from claimed c
  join public.calendar_push_subscriptions s on s.endpoint = c.endpoint;
$$;

revoke all on function public.claim_calendar_push() from public, anon, authenticated;
grant execute on function public.claim_calendar_push() to service_role;

select cron.schedule(
  'vardilo-calendar-web-push', '* * * * *',
  $job$
  select net.http_post(
    url := settings.project_url || '/functions/v1/calendar-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-vardilo-push-token', settings.worker_token)
  )
  from (
    select
      (select decrypted_secret from vault.decrypted_secrets where name = 'vardilo_calendar_push_url') as project_url,
      (select decrypted_secret from vault.decrypted_secrets where name = 'vardilo_calendar_push_worker') as worker_token
  ) settings
  where settings.project_url is not null and settings.worker_token is not null;
  $job$
);

notify pgrst, 'reload schema';
