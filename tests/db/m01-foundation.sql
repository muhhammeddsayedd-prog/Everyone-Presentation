-- LOCAL SYNTHETIC TEST ONLY. Run through guarded reviewed-file local-postgres runner.
-- Every fixture and mutation rolls back. Never invoke via linked/cloud SQL.
begin;
do $$ begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
end $$;
create function pg_temp.assert_true(condition boolean,label text) returns void language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'ASSERTION_FAILED: %',label; end if;
end $$;
create function pg_temp.expect_error(query text,expected text) returns void language plpgsql as $$ begin
  begin execute query;
  exception when others then
    if sqlstate=expected or sqlerrm=expected then return; end if;
    raise exception 'WRONG_ERROR expected %, got % / %',expected,sqlstate,sqlerrm;
  end;
  raise exception 'EXPECTED_ERROR_NOT_RAISED: %',expected;
end $$;
create function pg_temp.assume_user(subject uuid,is_anonymous boolean default false) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub',coalesce(subject::text,''),true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated','is_anonymous',is_anonymous,'user_metadata',jsonb_build_object('role','admin'))::text,true);
end $$;

-- Identity fixtures use managed auth's actual UUID key, no names/emails/private data.
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');
insert into public.clients(id,name) values('10000000-0000-4000-8000-000000000001','Synthetic client');
insert into public.projects(id,client_id,name) values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Synthetic permitted project'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','Synthetic denied project'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','Synthetic second readable project');
insert into public.project_memberships(project_id,principal_id,can_write) values
 ('20000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',true),
 ('20000000-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111',false),
 ('20000000-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222',true);
insert into public.client_memberships(client_id,principal_id,can_write) values('10000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111',true);
insert into public.app_capability_grants(principal_id,capability)
 select '11111111-1111-4111-8111-111111111111'::uuid,x from unnest(array['projects.read','projects.write','workspaces.read','workspaces.write','settings.manage','cast.read','cast.review']) x;
insert into public.app_capability_grants(principal_id,capability)
 select '22222222-2222-4222-8222-222222222222'::uuid,x from unnest(array['projects.read','workspaces.read','workspaces.write']) x;
insert into public.app_capability_grants(principal_id,capability) values('33333333-3333-4333-8333-333333333333','cast.read');
insert into public.app_capability_grants(principal_id,capability)
 select '44444444-4444-4444-8444-444444444444'::uuid,x from unnest(array['projects.read','projects.write','workspaces.read','workspaces.write']) x;
insert into eps.workspaces(id,project_id) values('90000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002');
insert into eps.workspaces(id,project_id) values('90000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003');
-- Metadata fixtures only: these are not evidence of actual verified storage bytes.
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,status) values
 ('50000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000003','client_logo','synthetic-pinned.png','image/png','synthetic-private','synthetic/pinned',1,repeat('0',64),1,1,'ready'),
 ('50000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000003','client_logo','synthetic-unselected.png','image/png','synthetic-private','synthetic/unselected',1,repeat('0',64),1,1,'ready');

select pg_temp.assert_true(not exists(select 1 from pg_roles where rolname in ('eps_api_owner','eps_draft_owner') and (rolcanlogin or rolbypassrls)),'narrow owners have no login/bypass');
select pg_temp.assert_true(not pg_has_role('authenticated','eps_api_owner','MEMBER'),'users cannot assume function owner');
select pg_temp.assert_true(not has_function_privilege('anon','public.eps_get_capabilities()','EXECUTE'),'anonymous has no RPC execution');
select pg_temp.assert_true(not has_table_privilege('authenticated','eps.workspaces','SELECT'),'eps tables are private');
select pg_temp.assert_true(not has_table_privilege('authenticated','public.projects','UPDATE'),'canonical direct writes denied');
select pg_temp.assert_true(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='eps' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity)),'all eps tables force RLS');

set local role anon;
select pg_temp.expect_error('select public.eps_get_capabilities()','42501');
reset role;
set local role authenticated;
select pg_temp.assume_user(null);
select pg_temp.expect_error('select public.eps_get_capabilities()','AUTH_REQUIRED');
select pg_temp.assume_user('11111111-1111-4111-8111-111111111111');
select pg_temp.assert_true((public.eps_get_capabilities()->'upload_policy'->'available_purposes')='["client_logo"]'::jsonb,'implemented logo purpose is advertised for a normal writable scope; runtime readiness is separate');
select pg_temp.assert_true((select count(*)=2 from public.projects),'actual authenticated role RLS hides denied project');
select pg_temp.expect_error('select * from eps.workspaces','42501');
select pg_temp.expect_error('update public.projects set name=''forged''','42501');
select pg_temp.expect_error('select public.eps_get_project(''20000000-0000-4000-8000-000000000002'')','RESOURCE_NOT_FOUND');
select pg_temp.assert_true(jsonb_array_length(public.eps_list_projects('',null,1)->'data')=1,'bounded page size');
select pg_temp.assert_true(public.eps_list_projects('',null,1)->'page'->>'next_cursor'='20000000-0000-4000-8000-000000000001','cursor names last included item');
select pg_temp.assert_true(public.eps_list_projects('','20000000-0000-4000-8000-000000000001',1)->'data'->0->>'id'='20000000-0000-4000-8000-000000000003','next cursor skips inaccessible record');

select set_config('request.headers','{"x-eps-request-id":"synthetic-request-1","x-eps-client-type":"mcp","authorization":"Bearer SYNTHETIC_AUTH_NEVER_PERSIST","apikey":"SYNTHETIC_API_KEY_NEVER_PERSIST","arbitrary":"SYNTHETIC_EXTRA_NEVER_PERSIST"}',true);
select set_config('eps.test.workspace',public.eps_create_workspace('{"project_id":"20000000-0000-4000-8000-000000000001","initial_output":"selection"}','create-one')->>'id',true);
select pg_temp.assert_true(public.eps_create_workspace('{"project_id":"20000000-0000-4000-8000-000000000001","initial_output":"selection"}','create-one')->>'id'=current_setting('eps.test.workspace'),'same request/key returns same workspace');
select pg_temp.assert_true(public.eps_create_workspace('{"project_id":"20000000-0000-4000-8000-000000000001","initial_output":"shortlist"}','create-other-key')->>'id'=current_setting('eps.test.workspace'),'one active workspace across distinct keys');
select pg_temp.expect_error('select public.eps_create_workspace(''{"project_id":"20000000-0000-4000-8000-000000000001","initial_output":"shortlist"}'',''create-one'')','IDEMPOTENCY_KEY_REUSED');
select pg_temp.expect_error('select public.eps_create_workspace(''{"project_id":"20000000-0000-4000-8000-000000000001","initial_output":"selection","principal_id":"forged"}'',''forged'')','INVALID_REQUEST');
select set_config('request.headers',jsonb_build_object('x-eps-request-id',repeat('x',129),'x-eps-client-type','admin','authorization','Bearer SYNTHETIC_AUTH_NEVER_PERSIST')::text,true);
select public.eps_update_workspace(current_setting('eps.test.workspace')::uuid,'{"row_version":1,"active_output":"shortlist"}','view-one');
select pg_temp.assert_true((public.eps_get_workspace(current_setting('eps.test.workspace')::uuid)->>'row_version')::bigint=1,'view state does not mutate shared revision');
select public.eps_update_workspace(current_setting('eps.test.workspace')::uuid,'{"row_version":1,"logo_placement":"every_slide"}','placement-one');
select pg_temp.expect_error(format('select public.eps_update_workspace(%L,''{"row_version":1,"logo_placement":"cover"}'')',current_setting('eps.test.workspace')),'STALE_RESOURCE_VERSION');
select pg_temp.expect_error(format('select public.eps_update_workspace(%L,''{"row_version":2,"logo_asset_id":"99999999-9999-4999-8999-999999999999"}'')',current_setting('eps.test.workspace')),'RESOURCE_NOT_FOUND');
select public.eps_update_workspace(current_setting('eps.test.workspace')::uuid,'{"row_version":2,"logo_asset_id":"50000000-0000-4000-8000-000000000001"}','pin-authorized-logo');
select public.eps_update_project('20000000-0000-4000-8000-000000000001','{"row_version":1,"name":"Corrected canonical project","client_name":"Corrected canonical client","expected_client_row_version":1}','central-write');
select pg_temp.assert_true(public.eps_get_project('20000000-0000-4000-8000-000000000001')->>'client_name'='Corrected canonical client','fresh read returns central client edit');
select pg_temp.expect_error('select public.eps_update_project(''20000000-0000-4000-8000-000000000001'',''{"row_version":1,"name":"stale"}'')','STALE_RESOURCE_VERSION');

-- Contributor has workspace preparation authority and canonical write scope, but
-- no projects.write, cast.review or settings.manage grant. These are independent.
select pg_temp.assume_user('22222222-2222-4222-8222-222222222222');
select pg_temp.assert_true(not (public.eps_get_project('20000000-0000-4000-8000-000000000001')->>'can_edit')::boolean,'contributor cannot edit shared records');
select pg_temp.assert_true(public.eps_create_workspace('{"project_id":"20000000-0000-4000-8000-000000000001","initial_output":"selection"}','contributor-create')->>'id'=current_setting('eps.test.workspace'),'contributor can open/create workspace');
select public.eps_update_workspace(current_setting('eps.test.workspace')::uuid,jsonb_build_object('row_version',(public.eps_get_workspace(current_setting('eps.test.workspace')::uuid)->>'row_version')::bigint,'active_output','selection'),'contributor-output');
select public.eps_update_workspace(current_setting('eps.test.workspace')::uuid,jsonb_build_object('row_version',(public.eps_get_workspace(current_setting('eps.test.workspace')::uuid)->>'row_version')::bigint,'logo_placement','cover'),'contributor-prepare');
select public.eps_update_workspace(current_setting('eps.test.workspace')::uuid,jsonb_build_object('row_version',(public.eps_get_workspace(current_setting('eps.test.workspace')::uuid)->>'row_version')::bigint,'logo_asset_id','50000000-0000-4000-8000-000000000001'),'contributor-pin-existing');
select pg_temp.expect_error(format('select public.eps_update_workspace(%L,%L)',current_setting('eps.test.workspace'),jsonb_build_object('row_version',(public.eps_get_workspace(current_setting('eps.test.workspace')::uuid)->>'row_version')::bigint,'logo_asset_id','50000000-0000-4000-8000-000000000002')::text),'RESOURCE_NOT_FOUND');
select pg_temp.expect_error('select public.eps_update_project(''20000000-0000-4000-8000-000000000001'',''{"row_version":2,"name":"denied"}'')','CAPABILITY_REQUIRED');
select pg_temp.assert_true(not ((public.eps_get_capabilities()->'capabilities')?'cast.review'),'user_metadata admin does not grant factual review');
select pg_temp.expect_error('select public.eps_create_audience_preset(''{"label":"Denied","scope":"external","settings":{}}'',''denied-preset'')','CAPABILITY_REQUIRED');
select pg_temp.assume_user('11111111-1111-4111-8111-111111111111');
select pg_temp.assert_true(public.eps_get_workspace(current_setting('eps.test.workspace')::uuid)->>'active_output'='shortlist','another actor does not overwrite output preference');

select set_config('eps.test.preset',public.eps_create_audience_preset('{"key":"synthetic-custom","label":"Synthetic preset","scope":"external","settings":{}}','preset-create')->>'id',true);
select public.eps_update_audience_preset(current_setting('eps.test.preset')::uuid,'{"row_version":1,"label":"Corrected preset"}','preset-update');
select public.eps_archive_audience_preset(current_setting('eps.test.preset')::uuid,'{"row_version":2,"reason":"synthetic cleanup"}','preset-archive');
select pg_temp.assert_true(jsonb_array_length(public.eps_list_audience_presets('synthetic-custom')->'data')=0,'archived preset hidden');

select pg_temp.assume_user('44444444-4444-4444-8444-444444444444');
select set_config('eps.actor_id','11111111-1111-4111-8111-111111111111',true);
select pg_temp.assert_true((select count(*)=0 from public.projects),'custom actor GUC cannot forge project membership');
select pg_temp.expect_error('select public.eps_get_project(''20000000-0000-4000-8000-000000000001'')','RESOURCE_NOT_FOUND');
select pg_temp.expect_error(format('select public.eps_get_workspace(%L)',current_setting('eps.test.workspace')),'RESOURCE_NOT_FOUND');
select pg_temp.assume_user('33333333-3333-4333-8333-333333333333');
select pg_temp.expect_error('select public.eps_list_projects()','CAPABILITY_REQUIRED');
select pg_temp.assert_true((select count(*)=0 from public.projects),'library access grants no project access');
select pg_temp.assume_user('11111111-1111-4111-8111-111111111111',true);
select pg_temp.expect_error('select public.eps_get_capabilities()','AUTH_REQUIRED');
select pg_temp.assert_true((select count(*)=0 from public.projects),'anonymous JWT cannot use internal grants');

reset role;
select pg_temp.assert_true((select name='Corrected canonical client' and row_version=2 from public.clients where id='10000000-0000-4000-8000-000000000001'),'canonical client is sole mutable owner');
select pg_temp.assert_true((select draft_revision>0 from eps.workspaces where id='90000000-0000-4000-8000-000000000002'),'client edit invalidates other project draft without exposing it');
select pg_temp.assert_true((select count(*)=1 from eps.workspaces where project_id='20000000-0000-4000-8000-000000000001'),'one workspace physically persisted');
select pg_temp.assert_true((select count(*)>0 from eps.audit_events),'mutations append audit');
select pg_temp.assert_true(exists(select 1 from eps.audit_events where action='create_workspace' and request_id='synthetic-request-1' and client_type='mcp'),'bounded request/client labels recorded');
select pg_temp.assert_true(exists(select 1 from eps.audit_events where action='update_workspace' and request_id is null and client_type='api'),'invalid trace labels default safely');
select pg_temp.assert_true(not exists(select 1 from eps.audit_events a where to_jsonb(a)::text like '%SYNTHETIC_AUTH_NEVER_PERSIST%' or to_jsonb(a)::text like '%SYNTHETIC_API_KEY_NEVER_PERSIST%' or to_jsonb(a)::text like '%SYNTHETIC_EXTRA_NEVER_PERSIST%'),'auth keys and arbitrary headers never persisted');
update public.project_memberships set active=false where principal_id='11111111-1111-4111-8111-111111111111' and project_id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.assume_user('11111111-1111-4111-8111-111111111111');
select pg_temp.expect_error('select public.eps_create_workspace(''{"project_id":"20000000-0000-4000-8000-000000000001","initial_output":"selection"}'',''create-one'')','RESOURCE_NOT_FOUND');
select pg_temp.expect_error('select public.eps_update_project(''20000000-0000-4000-8000-000000000001'',''{"row_version":1,"name":"Corrected canonical project","client_name":"Corrected canonical client","expected_client_row_version":1}'',''central-write'')','RESOURCE_NOT_FOUND');
select pg_temp.expect_error(format('select public.eps_update_workspace(%L,''{"row_version":1,"logo_placement":"every_slide"}'',''placement-one'')',current_setting('eps.test.workspace')),'RESOURCE_NOT_FOUND');
reset role;
select 'M01 database authorization, persistence, revision, idempotency and ownership assertions passed; fixtures rolled back' as result;
rollback;
