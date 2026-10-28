-- Preserve unexpected data. Delete only this known synthetic fixture, no CASCADE.
begin;
do $$ declare fixture eps_local_guard.m02_fixture; begin
 if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if;
 select * into strict fixture from eps_local_guard.m02_fixture where id=1 and marker='EPS M02 LOCAL DURABILITY V1';
 perform 1 from eps.workspaces where id=fixture.workspace_id for update;
 if (select count(*) from eps_local_guard.m02_fixture)<>1
   or fixture.principal_id<>'7a111111-1111-4111-8111-111111111111' or fixture.project_id<>'7b111111-1111-4111-8111-111111111111' or fixture.workspace_id<>'7c111111-1111-4111-8111-111111111111'
   or not exists(select 1 from public.projects where id=fixture.project_id and name=fixture.marker and client_id is null and row_version=1 and archived_at is null)
   or (select count(*) from eps.workspaces where project_id=fixture.project_id)<>1
   or not exists(select 1 from eps.workspaces where id=fixture.workspace_id and project_id=fixture.project_id and row_version=1 and draft_revision=0 and logo_asset_id is null and archived_at is null)
   or (select count(*) from public.project_memberships where project_id=fixture.project_id or principal_id=fixture.principal_id)<>1
   or not exists(select 1 from public.project_memberships where project_id=fixture.project_id and principal_id=fixture.principal_id and can_write)
   or exists(select 1 from public.client_memberships where principal_id=fixture.principal_id)
   or (select count(*) from public.app_capability_grants where principal_id=fixture.principal_id)<>4
   or exists(select 1 from public.app_capability_grants where principal_id=fixture.principal_id and (not active or capability not in('projects.read','workspaces.read','workspaces.write','operations.retry')))
   or exists(select 1 from eps.user_workspace_preferences where workspace_id=fixture.workspace_id or principal_id=fixture.principal_id)
   or exists(select 1 from eps.media_assets where origin_workspace_id=fixture.workspace_id)
   or exists(select 1 from eps.upload_sessions where workspace_id=fixture.workspace_id or principal_id=fixture.principal_id)
   or exists(select 1 from eps.jobs where workspace_id<>fixture.workspace_id or requested_by<>fixture.principal_id
     or resource_id not in('7d111111-1111-4111-8111-111111111111','7d222222-2222-4222-8222-222222222222','7d333333-3333-4333-8333-333333333333','7d444444-4444-4444-8444-444444444444','7d555555-5555-4555-8555-555555555555')
     or not(status='queued' and row_version=1 or status='cancelled' and row_version=2 and resource_id in('7d444444-4444-4444-8444-444444444444','7d555555-5555-4555-8555-555555555555'))
     or kind<>'specs_extract' or input_asset_id is not null or batch_id is not null or result is not null or error is not null)
   or exists(select 1 from eps.job_events)
   or exists(select 1 from eps.outbox_events event where not exists(select 1 from eps.jobs job where job.id=event.job_id and job.workspace_id=fixture.workspace_id))
   or (select count(*) from eps.jobs)>5 or (select count(*) from eps.outbox_events)>5
   or exists(select 1 from eps.audit_events audit where audit.principal_id=fixture.principal_id and (audit.action not in('jobs.enqueue','jobs.cancel') or not exists(select 1 from eps.jobs job where job.id=audit.resource_id and job.workspace_id=fixture.workspace_id)))
   or (select count(*) from eps.audit_events where principal_id=fixture.principal_id)>7
   or exists(select 1 from eps.idempotency_records where principal_id=fixture.principal_id and not
     (operation='jobs.enqueue' and key in('m02-local-second','m02-local-enqueue-a','m02-local-enqueue-b','m02-local-restart','m02-local-cancel-prepare','m02-local-finish-prepare')
      or operation='jobs.cancel' and key in('m02-local-cancel-first','m02-local-finish-first')))
   or (select count(*) from eps.idempotency_records where principal_id=fixture.principal_id)>8
 then raise exception 'M02_FIXTURE_OWNERSHIP_MISMATCH_PRESERVE_DATA'; end if;
 if to_regclass('eps.specs') is not null then
   perform 1 from eps.specs where workspace_id=fixture.workspace_id order by id for update;
   if (select count(*) from eps.specs where workspace_id=fixture.workspace_id)<>1
     or exists(select 1 from eps.roles where workspace_id=fixture.workspace_id) or exists(select 1 from eps.slots where workspace_id=fixture.workspace_id)
     or exists(select 1 from eps.specs where workspace_id=fixture.workspace_id and
       (source_asset_id is not null or source_text is not null or normalized_instructions is not null or source_extraction is not null
         or clarifications<>'[]'::jsonb or source_language_codes<>array[]::text[] or processing_job_id is not null or row_version<>1 or source_row_version<>1))
   then raise exception 'M02_NONEMPTY_SPECS_PRESERVE_DATA'; end if;
   delete from eps.specs where workspace_id=fixture.workspace_id;
 end if;
 delete from eps.idempotency_records where principal_id=fixture.principal_id;
 delete from eps.audit_events where principal_id=fixture.principal_id;
 delete from eps.outbox_events where job_id in(select id from eps.jobs where workspace_id=fixture.workspace_id);
 delete from eps.jobs where workspace_id=fixture.workspace_id;
 delete from eps.workspaces where id=fixture.workspace_id;
 delete from public.project_memberships where project_id=fixture.project_id and principal_id=fixture.principal_id;
 delete from public.app_capability_grants where principal_id=fixture.principal_id;
 delete from public.projects where id=fixture.project_id;
 delete from auth.users where id=fixture.principal_id;
end $$;
drop table eps_local_guard.m02_fixture;
commit;
