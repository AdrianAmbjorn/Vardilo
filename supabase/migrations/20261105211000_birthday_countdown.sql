create function public.sync_birthday_countdown() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.member_countdowns(member_id,kind,title,emoji,target_date,birthday_month,birthday_day)
 values(new.member_id,'birthday','Min födelsedag','🎂',make_date(2000,extract(month from new.birth_date)::int,extract(day from new.birth_date)::int),extract(month from new.birth_date)::int,extract(day from new.birth_date)::int)
 on conflict(member_id) do update set target_date=excluded.target_date,birthday_month=excluded.birthday_month,birthday_day=excluded.birthday_day,updated_at=now()
 where public.member_countdowns.kind='birthday';
 return new;
end;$$;
revoke all on function public.sync_birthday_countdown() from public,anon,authenticated;
create trigger birthday_countdown after insert or update of birth_date on public.member_birthdays for each row execute function public.sync_birthday_countdown();
