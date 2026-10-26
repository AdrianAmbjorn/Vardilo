create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  role text not null default 'familj',
  family_role text,
  created_at timestamptz not null default now(),
  constraint family_members_role_check check (role in ('admin', 'förälder', 'barn', 'familj')),
  constraint family_members_family_role_check check (
    family_role is null or family_role in (
      'mamma', 'pappa', 'bonusmamma', 'bonuspappa',
      'mormor', 'morfar', 'farmor', 'farfar',
      'moster', 'morbror', 'faster', 'farbror',
      'kusin', 'annan_nara_familj'
    )
  )
);

create index if not exists family_members_family_id_idx
  on public.family_members(family_id);

create index if not exists family_members_user_id_idx
  on public.family_members(user_id);

create unique index if not exists family_members_one_account_per_family_idx
  on public.family_members(family_id, user_id)
  where user_id is not null;

create table if not exists public.family_permissions (
  id uuid primary key default gen_random_uuid(),
  family_member_id uuid not null unique references public.family_members(id) on delete cascade,
  can_manage_family boolean not null default false,
  can_manage_members boolean not null default false,
  can_manage_calendar boolean not null default false,
  can_create_events boolean not null default false,
  can_manage_tasks boolean not null default false,
  can_manage_lists boolean not null default false,
  can_manage_wishlists boolean not null default false,
  can_use_chat boolean not null default false,
  can_upload_photos boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists family_permissions_member_id_idx
  on public.family_permissions(family_member_id);

create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_family_id
      and fm.user_id = auth.uid()
  );
$$;

grant execute on function public.is_family_member(uuid) to authenticated;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_permissions enable row level security;

drop policy if exists families_select_for_members on public.families;
create policy families_select_for_members
  on public.families
  for select
  to authenticated
  using (public.is_family_member(id));

drop policy if exists family_members_select_for_members on public.family_members;
create policy family_members_select_for_members
  on public.family_members
  for select
  to authenticated
  using (public.is_family_member(family_id));

drop policy if exists family_permissions_select_for_members on public.family_permissions;
create policy family_permissions_select_for_members
  on public.family_permissions
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.family_members fm
      where fm.id = family_permissions.family_member_id
        and public.is_family_member(fm.family_id)
    )
  );
