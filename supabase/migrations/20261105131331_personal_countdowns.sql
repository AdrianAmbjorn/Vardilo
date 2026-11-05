create table public.member_countdowns (
 member_id uuid primary key references public.family_members(id) on delete cascade,
 kind text not null check(kind in ('birthday','christmas','custom')),
 title text not null check(length(btrim(title)) between 1 and 60),
 emoji text not null check(emoji in ('🎂','🎄','🎉','🏖️','⚽','✨','🏡','🎁')),
 target_date date not null check(target_date >= date '1900-01-01' and target_date <= date '9999-12-31'),
 birthday_month smallint,
 birthday_day smallint,
 check((birthday_month is null)=(birthday_day is null)),
 check(birthday_month between 1 and 12 and birthday_day between 1 and 31 and (birthday_month not in (4,6,9,11) or birthday_day<=30) and (birthday_month<>2 or birthday_day<=29)),
 check(kind<>'birthday' or (birthday_month is not null and birthday_day is not null)),
 updated_at timestamptz not null default now()
);
alter table public.member_countdowns enable row level security;
revoke all on public.member_countdowns from public,anon,authenticated;
grant select,insert,update,delete on public.member_countdowns to authenticated;
grant all on public.member_countdowns to service_role;
create policy own_countdown on public.member_countdowns for all to authenticated
using(exists(select 1 from public.family_members me where me.id=member_id and me.user_id=(select auth.uid())))
with check(exists(select 1 from public.family_members me where me.id=member_id and me.user_id=(select auth.uid())));
