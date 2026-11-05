-- Transactional integration tests. All fixture data is rolled back.
begin;
do $$
declare actor_uid uuid:=gen_random_uuid(); family_a uuid:=gen_random_uuid(); family_b uuid:=gen_random_uuid(); actor_id uuid:=gen_random_uuid(); peer_id uuid:=gen_random_uuid(); outsider_id uuid:=gen_random_uuid(); data jsonb; state record; denied boolean; pinned_question text; pinned_solution text;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
 values(actor_uid,'riddle-test-'||actor_uid||'@test.vardilo.invalid',now(),'{"parent_managed_child":true}'::jsonb,'{}'::jsonb);
 insert into public.families(id,name) values(family_a,'Riddle test family A'),(family_b,'Riddle test family B');
 insert into public.family_members(id,family_id,user_id,display_name,role) values(actor_id,family_a,actor_uid,'Test child','barn'),(peer_id,family_a,null,'Test peer','familj'),(outsider_id,family_b,null,'Test outsider','familj');
 perform set_config('request.jwt.claim.sub',actor_uid::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor_uid,'role','authenticated')::text,true);
 perform set_config('vardilo.test_actor',actor_id::text,true);
 perform set_config('vardilo.test_peer',peer_id::text,true);
 perform set_config('vardilo.test_outsider',outsider_id::text,true);

 select * into state from vardilo_private.riddle_day('2026-11-05T20:59:59+01');
 assert not state.closed and state.closes_at='2026-11-05T21:00:00+01'::timestamptz,'winter cutoff';
 select * into state from vardilo_private.riddle_day('2026-07-05T21:00:00+02');
 assert state.closed and state.closes_at='2026-07-05T19:00:00Z'::timestamptz,'summer cutoff';
 select * into state from vardilo_private.riddle_day('2026-03-29T20:59:59+02'); assert not state.closed,'spring DST before cutoff';
 select * into state from vardilo_private.riddle_day('2026-10-25T21:00:00+01'); assert state.closed,'autumn DST cutoff';
 select * into state from vardilo_private.riddle_day('2026-11-05T23:59:59+01'); assert state.closed and state.puzzle_date=date '2026-11-05','before midnight';
 select * into state from vardilo_private.riddle_day('2026-11-06T00:00:00+01'); assert not state.closed and state.puzzle_date=date '2026-11-06','new day';

 perform vardilo_private.save_family_riddle_guess('2026-11-05','Min första gissning','2026-11-05T20:00:00+01');
 perform vardilo_private.save_family_riddle_guess('2026-11-05','Min ändrade gissning','2026-11-05T20:59:59+01');
 data:=vardilo_private.get_family_riddle('2026-11-05T20:59:59+01');
 assert data->>'own_guess'='Min ändrade gissning','own guess updated';
 assert data->>'solution' is null and data->>'explanation' is null and jsonb_array_length(data->'guesses')=0,'no early reveal';
 denied:=false;begin perform vardilo_private.save_family_riddle_guess('2026-11-05','För sent','2026-11-05T21:00:00+01');exception when raise_exception then denied:=sqlerrm like '%Tiden är ute%';end;assert denied,'reject exact cutoff';
 denied:=false;begin perform vardilo_private.save_family_riddle_guess('2026-11-05','Gårdagens svar','2026-11-06T00:00:00+01');exception when raise_exception then denied:=sqlerrm like '%ny kluring%';end;assert denied,'reject stale day';
 denied:=false;begin perform vardilo_private.save_family_riddle_guess('2026-11-05','   ','2026-11-05T20:00:00+01');exception when raise_exception then denied:=true;end;assert denied,'reject empty guess';
 data:=vardilo_private.get_family_riddle('2026-11-05T21:00:00+01');
 assert data->>'solution' is not null and jsonb_array_length(data->'guesses')=1,'reveal at cutoff';
 assert data->'guesses'->0->>'guess'='Min ändrade gissning','late save did not overwrite';
 pinned_question:=data->>'question'; pinned_solution:=data->>'solution';
 update vardilo_private.riddle_catalog set question='Edited test question',solution='Edited test solution' where id=(select riddle_id from vardilo_private.riddle_days where puzzle_date='2026-11-05');
 insert into vardilo_private.riddle_catalog(id,question,hint,solution,explanation) select max(id)+1,'New test question','Hint','Solution','Explanation' from vardilo_private.riddle_catalog;
 data:=vardilo_private.get_family_riddle('2026-11-05T21:01:00+01');
 assert data->>'question'=pinned_question and data->>'solution'=pinned_solution,'catalog additions and edits do not change an active day';
 data:=vardilo_private.get_previous_family_riddle('2026-11-06T20:59:59+01');
 assert data->>'puzzle_date'='2026-11-05' and (data->>'closed')::boolean and data->>'solution'=pinned_solution,'yesterday is revealed without revealing today';
 assert data->'guesses'->0->>'guess'='Min ändrade gissning','yesterday keeps family guesses';
 assert not has_function_privilege('authenticated','vardilo_private.get_previous_family_riddle(timestamptz)','EXECUTE'),'client cannot supply archive time';
 assert not has_function_privilege('anon','public.get_previous_family_riddle()','EXECUTE'),'archive requires authentication';

 data:=vardilo_private.get_family_riddle('2026-11-06T00:00:00+01');
 assert data->>'own_guess' is null and data->>'solution' is null,'new day clears own response and hides new solution';

 insert into public.family_daily_guesses(member_id,family_id,puzzle_date,guess) values(peer_id,family_a,'2000-01-01','old family guess'),(peer_id,family_a,'2099-01-01','future family guess'),(outsider_id,family_b,'2000-01-01','foreign family guess');
 assert not has_table_privilege('authenticated','public.family_daily_guesses','INSERT'),'no direct writes';
 assert not has_schema_privilege('authenticated','vardilo_private','USAGE'),'private helpers inaccessible';
 assert not has_function_privilege('anon','public.get_daily_family_riddle()','EXECUTE'),'anonymous access denied';
end;$$;
set local role authenticated;
do $$
begin
 assert not exists(select 1 from public.family_daily_guesses where member_id=current_setting('vardilo.test_outsider')::uuid),'foreign-family guesses hidden even after deadline';
 assert not exists(select 1 from public.family_daily_guesses where member_id=current_setting('vardilo.test_peer')::uuid and puzzle_date='2099-01-01'),'other guesses hidden before deadline';
 assert exists(select 1 from public.family_daily_guesses where member_id=current_setting('vardilo.test_peer')::uuid and puzzle_date='2000-01-01'),'family guesses visible after deadline';
 assert exists(select 1 from public.family_daily_guesses where member_id=current_setting('vardilo.test_actor')::uuid),'own guesses readable';
end;$$;
reset role;
rollback;
select 'PASS: Swedish cutoff, DST, midnight, answer visibility, save/update/late rejection, family RLS, daily snapshots, yesterday results and private helper isolation' as integration_tests;
