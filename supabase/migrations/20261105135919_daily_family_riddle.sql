create schema if not exists vardilo_private;
revoke all on schema vardilo_private from public,anon,authenticated;
create table vardilo_private.riddle_catalog (
 id integer primary key,
 question text not null,
 hint text not null,
 solution text not null,
 explanation text not null default ''
);
alter table vardilo_private.riddle_catalog enable row level security;
revoke all on vardilo_private.riddle_catalog from public,anon,authenticated;
insert into vardilo_private.riddle_catalog(id,question,hint,solution,explanation) values
(1,'Vad blir blötare ju mer det torkar?','Du hittar den ofta i badrummet.','En handduk.','Handduken suger upp vatten när den torkar något annat.'),
(2,'Vad är fullt av hål men kan ändå hålla kvar vatten?','Den kan hjälpa dig att diska.','En svamp.','Vattnet hålls kvar i svampens små hål.'),
(3,'Vad har tangenter men inga lås?','Det kan låta fint när du använder det.','Ett piano.','Pianot har tangenter som man spelar på.'),
(4,'Vad måste du knäcka innan du använder det?','Det kan bli frukost.','Ett ägg.','För att komma åt innehållet knäcker du skalet.'),
(5,'Jag visar städer, vägar och sjöar, men har inga hus, bilar eller vatten. Vad är jag?','Jag hjälper dig att hitta.','En karta.','En karta visar platser med symboler och linjer.'),
(6,'Jag svarar när du ropar, men har ingen mun. Vad är jag?','Du kan höra mig vid ett berg.','Ett eko.','Ljudet studsar tillbaka till dig.'),
(7,'Jag följer dig när solen skiner, men försvinner i mörkret. Vad är jag?','Titta på marken.','Din skugga.','Skuggan uppstår när du står i vägen för ljuset.'),
(8,'Vad har visare men pekar inte med fingrar?','Den hjälper dig att komma i tid.','En klocka.','Visarna visar vad klockan är.'),
(9,'Vad har tänder men kan inte bita?','Du använder den i håret.','En kam.','Kammens piggar kallas tänder.'),
(10,'Vad har en hals men inget huvud?','Du kan hälla ur den.','En flaska.','Den smala delen kallas flaskhals.'),
(11,'Vad har ett öga men kan inte se?','En tråd kan gå genom ögat.','En synål.','Hålet för tråden kallas nålsöga.'),
(12,'Vad har blad men är inget träd?','Du kan läsa den.','En bok.','Sidorna i en bok kallas också blad.'),
(13,'Vilken månad har minst 28 dagar?','Tänk på ordet minst.','Alla månader.','Varje månad har 28 dagar eller fler.'),
(14,'Två pappor och två söner delar på tre kakor. Alla får en var. Hur går det ihop?','En person har två roller.','Det är en farfar, hans son och hans barnbarn.','Pappan i mitten är både son och pappa.'),
(15,'Vilken veckodag var det igår, om det är fredag i övermorgon?','Börja med att ta reda på vilken dag det är idag.','Tisdag.','Om det är fredag i övermorgon är det onsdag idag. Då var det tisdag igår.'),
(16,'Vad kan gå genom ett fönster utan att glaset går sönder?','Det gör rummet ljusare.','Ljus.','Ljuset passerar genom glaset.'),
(17,'Vad har fyra ben men kan inte gå?','Du kan ställa tallriken på det.','Ett bord.','Bordsbenen står stilla.'),
(18,'Jag har massor av ord men säger aldrig något. Vad är jag?','Du kan slå upp vad ett ord betyder i mig.','En ordbok.','Du läser orden själv.'),
(19,'Jag tänker på ett tal. Jag dubblar det och lägger till 6. Då blir det 14. Vilket är talet?','Börja med att ta bort 6 från 14.','4.','4 gånger 2 är 8, och 8 plus 6 är 14.'),
(20,'Det ligger sex äpplen i en korg. Du tar två. Hur många äpplen har du?','Frågan är hur många du har, inte hur många som är kvar.','Två äpplen.','Du har de två äpplen som du tog.'),
(21,'I en låda ligger fem röda och fem blå strumpor. Hur många måste du ta i mörkret för att säkert få två i samma färg?','De två första kan ha olika färg.','Tre strumpor.','Den tredje måste ha samma färg som någon av de två första.'),
(22,'Vilket ord blir kortare när du lägger till tre bokstäver?','Lägg till bokstäverna a, r och e.','Ordet kort.','Kort plus are blir kortare.'),
(23,'Du springer om personen på andra plats i ett lopp. Vilken plats ligger du på nu?','Du tar platsen som personen hade.','Andra plats.','Den som ledde loppet ligger fortfarande före dig.'),
(24,'Vad kan resa runt jorden men sitter kvar i ett hörn?','Det kan sitta på ett brev.','Ett frimärke.','Frimärket följer med brevet.'),
(25,'Jag är lång när jag är ny och blir kortare medan jag lyser. Vad är jag?','Du kan tända mig på ett födelsedagskalas.','Ett stearinljus.','Stearinet förbrukas när ljuset brinner.'),
(26,'Vad blir större varje födelsedag men aldrig mindre?','Det handlar om dig, men inte om din längd.','Din ålder.','Du blir ett år äldre varje födelsedag.'),
(27,'Två syskon har samma föräldrar och föddes samma dag, men är inte tvillingar. Hur kan det vara så?','Det kan finnas ett syskon till.','De är två av tre trillingar.','De kan också vara två av ännu fler syskon födda samtidigt.'),
(28,'Ett elektriskt tåg kör norrut. Vinden blåser västerut. Åt vilket håll blåser tågets rök?','Tänk på hur tåget drivs.','Det kommer ingen rök.','Ett elektriskt tåg har ingen rök från ett ånglok.'),
(29,'En tupp sitter på ett tak. Åt vilket håll rullar ägget som den lägger?','Kan en tupp lägga ägg?','Inget håll – tuppar lägger inte ägg.','Det är hönor som lägger ägg.'),
(30,'Tre barn delar på tolv jordgubbar. Ett barn ger en av sina till ett annat barn. Hur många jordgubbar har barnen tillsammans nu?','Ingen jordgubbe har försvunnit.','Tolv jordgubbar.','Jordgubbarna har bytt ägare, men barnen har fortfarande tolv tillsammans.'),
(31,'Vad kan fylla ett rum utan att ta någon plats?','Du märker när det släcks.','Ljus.','Ljuset lyser upp rummet utan att fylla det med saker.');

create table public.family_daily_guesses (
 member_id uuid not null references public.family_members(id) on delete cascade,
 family_id uuid not null references public.families(id) on delete cascade,
 puzzle_date date not null,
 guess text not null check(length(btrim(guess)) between 1 and 200),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(member_id,puzzle_date)
);
create index family_daily_guesses_family_day_idx on public.family_daily_guesses(family_id,puzzle_date);
alter table public.family_daily_guesses enable row level security;
revoke all on public.family_daily_guesses from public,anon,authenticated;
grant select on public.family_daily_guesses to authenticated;
grant all on public.family_daily_guesses to service_role;
create policy riddle_guess_visibility on public.family_daily_guesses for select to authenticated using(exists(
 select 1 from public.family_members me where me.user_id=(select auth.uid()) and me.family_id=family_daily_guesses.family_id
 and (me.id=family_daily_guesses.member_id or (family_daily_guesses.puzzle_date+time '21:00') at time zone 'Europe/Stockholm'<=clock_timestamp())
));

-- Private time-parameterized helpers make cutoff boundaries testable. They are not exposed to clients.
create function vardilo_private.riddle_day(p_now timestamptz)
returns table(puzzle_date date, closes_at timestamptz, closed boolean)
language sql stable security invoker set search_path='' as $$
 select (p_now at time zone 'Europe/Stockholm')::date,
 (((p_now at time zone 'Europe/Stockholm')::date)+time '21:00') at time zone 'Europe/Stockholm',
 (p_now at time zone 'Europe/Stockholm')::time>=time '21:00';
$$;

create function vardilo_private.get_family_riddle(p_now timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare me public.family_members; state record; puzzle vardilo_private.riddle_catalog; catalog_size integer; own_guess text; guesses jsonb; answer_count integer;
begin
 if auth.uid() is null then raise exception 'Logga in för att spela Dagens kluring.'; end if;
 select * into me from public.family_members where user_id=auth.uid();
 if me.id is null then raise exception 'Koppla ditt konto till en familj för att spela.'; end if;
 select * into state from vardilo_private.riddle_day(p_now);
 select count(*) into catalog_size from vardilo_private.riddle_catalog;
 if catalog_size=0 then raise exception 'Dagens kluring kunde inte hämtas.'; end if;
 select * into puzzle from vardilo_private.riddle_catalog order by id offset mod(mod(state.puzzle_date-date '2026-01-01',catalog_size)+catalog_size,catalog_size) limit 1;
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

create function vardilo_private.save_family_riddle_guess(p_date date,p_guess text,p_now timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare me public.family_members; state record;
begin
 if auth.uid() is null then raise exception 'Logga in för att gissa.'; end if;
 select * into me from public.family_members where user_id=auth.uid();
 if me.id is null then raise exception 'Koppla ditt konto till en familj för att gissa.'; end if;
 select * into state from vardilo_private.riddle_day(p_now);
 if p_date is null or p_date<>state.puzzle_date then raise exception 'En ny kluring har börjat. Uppdatera och försök igen.'; end if;
 if state.closed then raise exception 'Tiden är ute! Gissningarna stängde kl. 21.00.'; end if;
 if p_guess is null or length(btrim(p_guess)) not between 1 and 200 then raise exception 'Skriv en gissning på 1–200 tecken.'; end if;
 insert into public.family_daily_guesses(member_id,family_id,puzzle_date,guess,created_at,updated_at)
 values(me.id,me.family_id,state.puzzle_date,btrim(p_guess),p_now,p_now)
 on conflict(member_id,puzzle_date) do update set guess=excluded.guess,updated_at=excluded.updated_at;
end;$$;

create function public.get_daily_family_riddle()
returns jsonb language sql volatile security definer set search_path='' as $$
 select vardilo_private.get_family_riddle(clock_timestamp());
$$;
create function public.save_daily_family_guess(p_puzzle_date date,p_guess text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
 perform vardilo_private.save_family_riddle_guess(p_puzzle_date,p_guess,clock_timestamp());
 return vardilo_private.get_family_riddle(clock_timestamp());
end;$$;
revoke all on function vardilo_private.riddle_day(timestamptz),vardilo_private.get_family_riddle(timestamptz),vardilo_private.save_family_riddle_guess(date,text,timestamptz) from public,anon,authenticated;
revoke all on function public.get_daily_family_riddle(),public.save_daily_family_guess(date,text) from public,anon;
grant execute on function public.get_daily_family_riddle(),public.save_daily_family_guess(date,text) to authenticated;
