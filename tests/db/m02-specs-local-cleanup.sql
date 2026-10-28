-- Scope and source checks precede every DELETE. Unknown data is never removed.
begin;
set local application_name='eps_specs_cleanup_b';
set local lock_timeout='10s';
do $$ declare fixture eps_local_guard.specs_local_fixture; begin
 if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if;
 select * into strict fixture from eps_local_guard.specs_local_fixture where id=1 and marker='EPS SPECS LOCAL V1';
 perform 1 from eps.workspaces where id=fixture.workspace_id for update;
 if fixture.project_id<>'7b710000-0000-4000-8000-000000000001' or fixture.workspace_id<>'7c710000-0000-4000-8000-000000000001' or fixture.principal_id<>'7a720000-0000-4000-8000-000000000001'
   or (select count(*) from eps_local_guard.specs_local_fixture)<>1
   or not exists(select 1 from public.projects where id=fixture.project_id and name='Synthetic specs backfill fixture' and client_id is null and row_version=1 and archived_at is null)
   or (select count(*) from eps.workspaces where project_id=fixture.project_id)<>1
   or not exists(select 1 from eps.workspaces where id=fixture.workspace_id and project_id=fixture.project_id and logo_asset_id is null and archived_at is null and has_unpublished_changes and (row_version,draft_revision) in((19,17),(20,18),(21,19)))
   or exists(select 1 from eps.media_assets where origin_workspace_id=fixture.workspace_id)
   or exists(select 1 from eps.upload_sessions where workspace_id=fixture.workspace_id or principal_id=fixture.principal_id)
   or exists(select 1 from eps.jobs where workspace_id=fixture.workspace_id or requested_by=fixture.principal_id)
   or exists(select 1 from eps.user_workspace_preferences where workspace_id=fixture.workspace_id or principal_id=fixture.principal_id)
   or exists(select 1 from public.client_memberships where principal_id=fixture.principal_id)
 then raise exception 'SPECS_LOCAL_FIXTURE_OWNERSHIP_MISMATCH_PRESERVE_DATA'; end if;
 if to_regclass('eps.specs') is not null then
   perform 1 from eps.specs where workspace_id=fixture.workspace_id order by id for update;
   if (select count(*) from eps.specs where workspace_id=fixture.workspace_id)<>1
     or exists(select 1 from eps.specs where workspace_id=fixture.workspace_id and
       (source_asset_id is not null or source_text is not null or normalized_instructions is not null or source_extraction is not null
         or clarifications<>'[]'::jsonb or source_language_codes<>array[]::text[] or processing_job_id is not null or row_version<>1 or source_row_version<>1))
   then raise exception 'SPECS_LOCAL_SOURCE_PRESERVATION_REQUIRED'; end if;
   perform 1 from eps.roles where workspace_id=fixture.workspace_id order by id for update;
   perform 1 from eps.slots where workspace_id=fixture.workspace_id order by id for update;
   if (select count(*) from eps.roles where workspace_id=fixture.workspace_id)>1
     or exists(select 1 from eps.roles where workspace_id=fixture.workspace_id and
       (id is distinct from fixture.role_id or name not in('Synthetic manual role','Concurrent rename') or headcount is null or headcount not in(2,3) or row_version not in(1,2)
         or archived_at is not null or source_role is not null or spec_id is not null or requirements<>fixture.role_input->'requirements' or clarifications<>'[]'::jsonb or category is not null))
     or exists(select 1 from eps.slots where workspace_id=fixture.workspace_id and
       (role_id is distinct from fixture.role_id or ordinal not between 1 and 3 or sort_order<>ordinal-1 or label<>'Synthetic manual role '||ordinal::text
         or provisional or row_version not in(1,2) or archived_at is not null and ordinal<>3))
     or (select count(*) from eps.slots where workspace_id=fixture.workspace_id)>3
   then raise exception 'SPECS_LOCAL_UNKNOWN_ROLE_SLOT_PRESERVE_DATA'; end if;
 end if;
 if (select count(*) from public.project_memberships where project_id=fixture.project_id or principal_id=fixture.principal_id)>1
   or exists(select 1 from public.project_memberships where (project_id=fixture.project_id or principal_id=fixture.principal_id) and (project_id<>fixture.project_id or principal_id<>fixture.principal_id or not can_write))
   or (select count(*) from public.app_capability_grants where principal_id=fixture.principal_id) not in(0,3)
   or exists(select 1 from public.app_capability_grants where principal_id=fixture.principal_id and (not active or capability not in('projects.read','workspaces.read','workspaces.write')))
   or (select count(*) from eps.audit_events where principal_id=fixture.principal_id)>2
   or exists(select 1 from eps.audit_events where principal_id=fixture.principal_id and (action not in('specs.create_role','specs.update_role','specs.resize_role_slots') or resource_id is distinct from fixture.role_id))
   or (select count(*) from eps.idempotency_records where principal_id=fixture.principal_id)>2
   or exists(select 1 from eps.idempotency_records where principal_id=fixture.principal_id and not
     (operation='specs.create_role' and key='specs-local-create' or operation='specs.update_role' and key='specs-local-rename' or operation='specs.resize_role_slots' and key='specs-local-resize'))
 then raise exception 'SPECS_LOCAL_UNKNOWN_AUTH_AUDIT_PRESERVE_DATA'; end if;
 delete from eps.audit_events where principal_id=fixture.principal_id;
 delete from eps.idempotency_records where principal_id=fixture.principal_id;
 if to_regclass('eps.specs') is not null then
   delete from eps.slots where workspace_id=fixture.workspace_id;
   delete from eps.roles where workspace_id=fixture.workspace_id;
   delete from eps.specs where workspace_id=fixture.workspace_id;
 end if;
 delete from eps.workspaces where id=fixture.workspace_id;
 delete from public.project_memberships where project_id=fixture.project_id and principal_id=fixture.principal_id;
 delete from public.app_capability_grants where principal_id=fixture.principal_id;
 delete from public.projects where id=fixture.project_id;
 delete from auth.users where id=fixture.principal_id;
end $$;
drop table eps_local_guard.specs_local_fixture;
commit;
