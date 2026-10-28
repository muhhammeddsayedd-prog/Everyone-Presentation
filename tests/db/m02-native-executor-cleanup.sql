-- Only this run's fixed synthetic namespace. No CASCADE or Auth/cloud resets.
begin;
set local search_path='';
do $$ declare marker record; begin
 if current_user<>'postgres' or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
  or (select system_identifier::text from pg_control_system())<>'7701520506262638626'
  or coalesce(current_setting('eps.native_specs.fixture_run_id',true),'')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 then raise exception 'NATIVE_OWNED_CLEANUP_REQUIRED'; end if;
 if to_regclass('eps_local_guard.native_specs_fixture') is null then
  if exists(select 1 from auth.users where id::text like '7a980000-%') or exists(select 1 from public.projects where id::text like '7b980000-%')
   or exists(select 1 from eps.workspaces where id::text like '7c980000-%') or exists(select 1 from eps.jobs where id::text like '7f980000-%')
  then raise exception 'NATIVE_UNMARKED_NAMESPACE_PRESERVED'; end if;
 else
  perform eps_local_guard.native_specs_fixture_require();
  -- Block new FK dependants before the fresh identity digest and deletion.
  -- Existing identity rows are locked too, so changed grants/preferences are
  -- preserved rather than disappearing through deletion of their parent.
  perform 1 from auth.users where id='7a980000-0000-4000-8000-000000000001' for update;
  perform 1 from public.projects where id::text like '7b980000-%' order by id for update;
  perform 1 from public.project_memberships where principal_id='7a980000-0000-4000-8000-000000000001'
   or project_id::text like '7b980000-%' order by project_id,principal_id for update;
  perform 1 from public.client_memberships where principal_id='7a980000-0000-4000-8000-000000000001' order by client_id for update;
  perform 1 from public.app_capability_grants where principal_id='7a980000-0000-4000-8000-000000000001' order by capability for update;
  -- Resource locks precede child/job locks and every fresh validation/delete.
  perform 1 from eps.workspaces where id::text like '7c980000-%' or project_id::text like '7b980000-%' order by id for update;
  perform 1 from eps.specs where workspace_id::text like '7c980000-%' order by id for update;
  perform 1 from eps.jobs where workspace_id::text like '7c980000-%' order by id for update;
  perform 1 from eps.roles where workspace_id::text like '7c980000-%' order by id for update;
  perform 1 from eps.slots where workspace_id::text like '7c980000-%' order by id for update;
  perform 1 from eps.user_workspace_preferences where principal_id='7a980000-0000-4000-8000-000000000001'
   or workspace_id::text like '7c980000-%' order by principal_id,workspace_id for update;
  select * into strict marker from eps_local_guard.native_specs_fixture for update;
  perform eps_local_guard.native_specs_fixture_validate(false);
  if marker.verified_sha256 is not null and marker.verified_sha256 is distinct from eps_local_guard.native_specs_fixture_digest()
  then raise exception 'NATIVE_VERIFIED_FIXTURE_CHANGED_PRESERVED'; end if;
  delete from eps.job_events where job_id in(select id from eps.jobs where workspace_id::text like '7c980000-%');
  delete from eps.outbox_events where job_id in(select id from eps.jobs where workspace_id::text like '7c980000-%');
  delete from eps.specs_stage_payloads where job_id in(select id from eps.jobs where workspace_id::text like '7c980000-%');
  update eps.specs set processing_job_id=null,source_extraction_job_id=null where workspace_id::text like '7c980000-%';
  delete from eps.slots where workspace_id::text like '7c980000-%';
  delete from eps.roles where workspace_id::text like '7c980000-%';
  delete from eps.specs_source_inputs where workspace_id::text like '7c980000-%';
  delete from eps.jobs where workspace_id::text like '7c980000-%';
  delete from eps.idempotency_records where principal_id='7a980000-0000-4000-8000-000000000001';
  delete from eps.audit_events where principal_id='7a980000-0000-4000-8000-000000000001';
  delete from eps.specs where workspace_id::text like '7c980000-%';
  delete from eps.workspaces where id::text like '7c980000-%';
  delete from public.project_memberships where principal_id='7a980000-0000-4000-8000-000000000001';
  delete from public.app_capability_grants where principal_id='7a980000-0000-4000-8000-000000000001';
  delete from public.projects where id::text like '7b980000-%';
  delete from auth.users where id='7a980000-0000-4000-8000-000000000001';
  drop function eps_local_guard.native_specs_fixture_validate(boolean);
  drop function eps_local_guard.native_specs_fixture_digest();
  drop function eps_local_guard.native_specs_fixture_identity_digest();
  drop function eps_local_guard.native_specs_fixture_require();
  drop table eps_local_guard.native_specs_fixture;
 end if;
end $$;
select jsonb_build_object('cleaned',true);
commit;
