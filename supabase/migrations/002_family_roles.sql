-- Family relationship categories used when role = 'familj'.
-- The display_name remains the person's actual name; family_role stores the relationship.

alter table public.family_members
  add column if not exists family_role text;

alter table public.family_members
  drop constraint if exists family_members_family_role_check;

alter table public.family_members
  add constraint family_members_family_role_check
  check (
    family_role is null
    or family_role in (
      'mamma',
      'pappa',
      'bonusmamma',
      'bonuspappa',
      'mormor',
      'morfar',
      'farmor',
      'farfar',
      'moster',
      'morbror',
      'faster',
      'farbror',
      'kusin',
      'annan_nara_familj'
    )
  );

create index if not exists family_members_family_role_idx
  on public.family_members(family_role);
