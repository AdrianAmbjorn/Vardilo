-- Daily snapshots prevent a catalog expansion or edit from changing an active game.
create table vardilo_private.riddle_days (
 puzzle_date date primary key,
 riddle_id integer not null,
 question text not null,
 hint text not null,
 solution text not null,
 explanation text not null
);
alter table vardilo_private.riddle_days enable row level security;
revoke all on vardilo_private.riddle_days from public,anon,authenticated;

create function vardilo_private.riddle_for_day(p_date date)
returns vardilo_private.riddle_days language plpgsql volatile security invoker set search_path='' as $$
declare puzzle vardilo_private.riddle_days; catalog_size integer;
begin
 select * into puzzle from vardilo_private.riddle_days where puzzle_date=p_date;
 if found then return puzzle; end if;
 select count(*) into catalog_size from vardilo_private.riddle_catalog;
 if catalog_size=0 then raise exception 'Kluringen kunde inte hämtas.'; end if;
 insert into vardilo_private.riddle_days(puzzle_date,riddle_id,question,hint,solution,explanation)
 select p_date,id,question,hint,solution,explanation from vardilo_private.riddle_catalog
 order by id offset mod(mod(p_date-date '2026-01-01',catalog_size)+catalog_size,catalog_size) limit 1
 on conflict(puzzle_date) do nothing;
 select * into puzzle from vardilo_private.riddle_days where puzzle_date=p_date;
 return puzzle;
end;$$;
revoke all on function vardilo_private.riddle_for_day(date) from public,anon,authenticated;

-- Pin today and any already-played days before changing the selection implementation.
do $$ declare played_date date; begin
 for played_date in select distinct puzzle_date from public.family_daily_guesses union select (clock_timestamp() at time zone 'Europe/Stockholm')::date loop
  perform vardilo_private.riddle_for_day(played_date);
 end loop;
end;$$;

create or replace function vardilo_private.get_family_riddle(p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare me public.family_members; state record; puzzle vardilo_private.riddle_days; own_guess text; guesses jsonb; answer_count integer;
begin
 if auth.uid() is null then raise exception 'Logga in för att spela Dagens kluring.'; end if;
 select * into me from public.family_members where user_id=auth.uid();
 if me.id is null then raise exception 'Koppla ditt konto till en familj för att spela.'; end if;
 select * into state from vardilo_private.riddle_day(p_now);
 puzzle:=vardilo_private.riddle_for_day(state.puzzle_date);
 select guess into own_guess from public.family_daily_guesses where member_id=me.id and puzzle_date=state.puzzle_date and family_id=me.family_id;
 select count(*) into answer_count from public.family_daily_guesses where family_id=me.family_id and puzzle_date=state.puzzle_date;
 guesses:='[]'::jsonb;
 if state.closed then
  select coalesce(jsonb_agg(jsonb_build_object('member_id',m.id,'name',m.display_name,'guess',g.guess) order by g.created_at,m.id),'[]'::jsonb) into guesses
  from public.family_daily_guesses g join public.family_members m on m.id=g.member_id and m.family_id=g.family_id
  where g.family_id=me.family_id and g.puzzle_date=state.puzzle_date;
 end if;
 return jsonb_build_object('puzzle_date',state.puzzle_date,'server_now',p_now,'closes_at',state.closes_at,'closed',state.closed,
 'question',puzzle.question,'hint',puzzle.hint,'solution',case when state.closed then puzzle.solution else null end,
 'explanation',case when state.closed then puzzle.explanation else null end,'own_guess',own_guess,'answer_count',answer_count,'guesses',guesses);
end;$$;

create function vardilo_private.get_previous_family_riddle(p_now timestamptz)
returns jsonb language plpgsql volatile security invoker set search_path='' as $$
declare yesterday date;
begin
 yesterday:=(p_now at time zone 'Europe/Stockholm')::date-1;
 return vardilo_private.get_family_riddle((yesterday+time '21:00') at time zone 'Europe/Stockholm') || jsonb_build_object('server_now',p_now);
end;$$;
create function public.get_previous_family_riddle()
returns jsonb language sql volatile security definer set search_path='' as $$
 select vardilo_private.get_previous_family_riddle(clock_timestamp());
$$;
revoke all on function vardilo_private.get_previous_family_riddle(timestamptz) from public,anon,authenticated;
revoke all on function public.get_previous_family_riddle() from public,anon;
grant execute on function public.get_previous_family_riddle() to authenticated;
