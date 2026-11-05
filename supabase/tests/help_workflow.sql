-- Isolated lifecycle and authorization checks; all fixtures are rolled back.
begin;
do $$
declare owner_uid uuid:=gen_random_uuid(); helper_uid uuid:=gen_random_uuid(); peer_uid uuid:=gen_random_uuid(); foreign_uid uuid:=gen_random_uuid(); family_a uuid:=gen_random_uuid(); family_b uuid:=gen_random_uuid(); owner_id uuid:=gen_random_uuid(); helper_id uuid:=gen_random_uuid(); peer_id uuid:=gen_random_uuid(); foreign_id uuid:=gen_random_uuid(); request_id uuid; data jsonb; denied boolean; notification_count integer;
begin
 insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values(owner_uid,'help-owner-'||owner_uid||'@test.vardilo.invalid','{}','{}'),(helper_uid,'help-helper-'||helper_uid||'@test.vardilo.invalid','{}','{}'),(peer_uid,'help-peer-'||peer_uid||'@test.vardilo.invalid','{}','{}'),(foreign_uid,'help-foreign-'||foreign_uid||'@test.vardilo.invalid','{}','{}');
 insert into public.families(id,name) values(family_a,'Help test family A'),(family_b,'Help test family B');
 insert into public.family_members(id,family_id,user_id,display_name,role) values(owner_id,family_a,owner_uid,'Test owner','förälder'),(helper_id,family_a,helper_uid,'Test helper','barn'),(peer_id,family_a,peer_uid,'Test peer','familj'),(foreign_id,family_b,foreign_uid,'Foreign admin','admin');
 insert into public.help_requests(family_id,title,created_by_member_id) values(family_a,'Test request',owner_id) returning id into request_id;
 perform set_config('request.jwt.claim.sub',helper_uid::text,true);
 data:=public.change_help_request(request_id,'claim');assert (data->>'claimed_by_member_id')::uuid=helper_id,'helper claims';
 perform set_config('request.jwt.claim.sub',peer_uid::text,true);
 denied:=false;begin perform public.change_help_request(request_id,'claim');exception when raise_exception then denied:=true;end;assert denied,'competing claim denied';
 denied:=false;begin perform public.change_help_request(request_id,'complete');exception when raise_exception then denied:=true;end;assert denied,'unrelated member cannot complete';
 denied:=false;begin perform public.change_help_request(request_id,'release');exception when raise_exception then denied:=true;end;assert denied,'unrelated member cannot release';
 perform set_config('request.jwt.claim.sub',foreign_uid::text,true);
 denied:=false;begin perform public.change_help_request(request_id,'complete');exception when raise_exception then denied:=true;end;assert denied,'foreign admin denied';
 perform set_config('request.jwt.claim.sub',helper_uid::text,true);
 data:=public.change_help_request(request_id,'complete');assert data->>'completed_at' is not null,'helper completes';
 select count(*) into notification_count from public.notifications where metadata->>'help_request_id'=request_id::text and metadata->>'action'='help_complete';
 assert notification_count=3,'completion visible to entire family';
 perform public.change_help_request(request_id,'complete');
 assert (select count(*) from public.notifications where metadata->>'help_request_id'=request_id::text and metadata->>'action'='help_complete')=notification_count,'repeat completion is idempotent';
 perform set_config('request.jwt.claim.sub',owner_uid::text,true);
 data:=public.change_help_request(request_id,'reopen');assert data->>'completed_at' is null,'owner reopens';
 denied:=false;begin perform public.change_help_request(request_id,'release');exception when raise_exception then denied:=true;end;assert denied,'only helper or admin can release';
 perform set_config('request.jwt.claim.sub',helper_uid::text,true);
 data:=public.change_help_request(request_id,'release');assert data->>'claimed_by_member_id' is null and data->>'claimed_at' is null,'helper releases';
 perform set_config('request.jwt.claim.sub',peer_uid::text,true);perform public.change_help_request(request_id,'claim');
 perform set_config('request.jwt.claim.sub',owner_uid::text,true);data:=public.change_help_request(request_id,'complete');assert data->>'completed_at' is not null,'owner confirms completion';
 assert not has_function_privilege('anon','public.change_help_request(uuid,text)','EXECUTE'),'anonymous denied';
 assert not has_table_privilege('authenticated','public.help_requests','UPDATE'),'no direct update bypass';
 assert not has_table_privilege('authenticated','public.help_requests','DELETE'),'no direct delete bypass';
 perform set_config('request.jwt.claim.sub',helper_uid::text,true);
 perform set_config('vardilo.test_owner',owner_id::text,true);perform set_config('vardilo.test_helper',helper_id::text,true);perform set_config('vardilo.test_family',family_a::text,true);
end;$$;
set local role authenticated;
do $$ declare denied boolean:=false; begin
 begin insert into public.help_requests(family_id,title,created_by_member_id) values(current_setting('vardilo.test_family')::uuid,'Forged owner',current_setting('vardilo.test_owner')::uuid);exception when insufficient_privilege then denied:=true;end;assert denied,'cannot forge requester';
 insert into public.help_requests(family_id,title,created_by_member_id) values(current_setting('vardilo.test_family')::uuid,'Own request',current_setting('vardilo.test_helper')::uuid);
end;$$;
reset role;
rollback;
select 'PASS: help claims, competing claims, completion, reopening, release, notifications and family/actor authorization' as integration_tests;
