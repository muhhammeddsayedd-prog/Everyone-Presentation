-- Committed synthetic queue fixture ONLY on the fingerprinted owned local target.
begin;
do $$ begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
    or to_regclass('eps.jobs') is null or not exists(select 1 from eps_local_guard.instance where id=1)
  then raise exception 'M02_OWNED_LOCAL_TARGET_REQUIRED'; end if;
  if to_regclass('eps_local_guard.m02_fixture') is not null
    or exists(select 1 from auth.users where id='7a111111-1111-4111-8111-111111111111')
    or exists(select 1 from public.projects where id='7b111111-1111-4111-8111-111111111111')
    or exists(select 1 from eps.workspaces where id='7c111111-1111-4111-8111-111111111111')
    or exists(select 1 from eps.jobs) or exists(select 1 from eps.outbox_events)
  then raise exception 'M02_LOCAL_FIXTURE_COLLISION_PRESERVE_DATA'; end if;
end $$;
create table eps_local_guard.m02_fixture(
  id integer primary key check(id=1), marker text not null check(marker='EPS M02 LOCAL DURABILITY V1'),
  principal_id uuid not null, project_id uuid not null, workspace_id uuid not null, input jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);
revoke all on eps_local_guard.m02_fixture from public,anon,authenticated,service_role,eps_api_owner,eps_jobs_owner,eps_jobs_dispatcher;
insert into auth.users(id) values('7a111111-1111-4111-8111-111111111111');
insert into public.projects(id,name) values('7b111111-1111-4111-8111-111111111111','EPS M02 LOCAL DURABILITY V1');
insert into public.project_memberships(project_id,principal_id,can_write) values('7b111111-1111-4111-8111-111111111111','7a111111-1111-4111-8111-111111111111',true);
insert into public.app_capability_grants(principal_id,capability)
  select '7a111111-1111-4111-8111-111111111111'::uuid,capability from unnest(array['projects.read','workspaces.read','workspaces.write','operations.retry']) capability;
insert into eps.workspaces(id,project_id) values('7c111111-1111-4111-8111-111111111111','7b111111-1111-4111-8111-111111111111');
insert into eps_local_guard.m02_fixture(id,marker,principal_id,project_id,workspace_id,input) values
 (1,'EPS M02 LOCAL DURABILITY V1','7a111111-1111-4111-8111-111111111111','7b111111-1111-4111-8111-111111111111','7c111111-1111-4111-8111-111111111111',
 '{"schema_version":"1.0","specs_id":"7d111111-1111-4111-8111-111111111111","source_hash":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","source_row_version":1,"workspace_row_version":1,"configuration":{"document_preparation_version":"synthetic-v1","model_version":"synthetic-v1","prompt_version":"synthetic-v1","result_schema_version":"synthetic-v1"}}');
select set_config('request.jwt.claim.sub','7a111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"7a111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
select set_config('eps.m02.input',(select jsonb_set(input,'{specs_id}','"7d222222-2222-4222-8222-222222222222"')::text from eps_local_guard.m02_fixture),true);
set local role eps_jobs_owner;
do $$ begin perform eps.m02_enqueue_specs_job('7c111111-1111-4111-8111-111111111111',current_setting('eps.m02.input')::jsonb,'m02-local-second'); end $$;
reset role;
commit;
