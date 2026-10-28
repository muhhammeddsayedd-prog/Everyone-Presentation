begin read only;
do $$ declare fixture eps_local_guard.specs_local_fixture; working eps.roles; begin
 if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if;
 select * into strict fixture from eps_local_guard.specs_local_fixture where id=1 and marker='EPS SPECS LOCAL V1';
 select * into strict working from eps.roles where id=fixture.role_id and workspace_id=fixture.workspace_id;
 if (select count(*) from eps.roles where workspace_id=fixture.workspace_id)<>1
   or working.row_version<>2 or working.archived_at is not null or working.source_role is not null or working.spec_id is not null
   or not(working.headcount=3 and working.name='Concurrent rename' or working.headcount=2 and working.name='Synthetic manual role')
   or (select count(*) from eps.slots where role_id=working.id)<>3
   or (select count(*) from eps.slots where role_id=working.id and archived_at is null)<>working.headcount
   or exists(select 1 from eps.slots where role_id=working.id and provisional)
   or not exists(select 1 from eps.workspaces where id=fixture.workspace_id and row_version=21 and draft_revision=19 and has_unpublished_changes)
   or (select count(*) from eps.audit_events where principal_id=fixture.principal_id)<>2
   or (select count(*) from eps.idempotency_records where principal_id=fixture.principal_id)<>2
   or (select count(*) from eps.idempotency_records where principal_id=fixture.principal_id and operation='specs.create_role' and key='specs-local-create' and response->>'id'=working.id::text)<>1
   or not exists(select 1 from public.project_memberships where principal_id=fixture.principal_id and project_id=fixture.project_id and can_write and not active)
   or (select count(*) from eps.specs where workspace_id=fixture.workspace_id and row_version=1 and source_row_version=1 and source_text is null and source_asset_id is null and processing_job_id is null)<>1
 then raise exception 'SPECS_LOCAL_PERSISTED_EFFECTS_INVALID'; end if;
end $$;
select jsonb_build_object('manual_role_count',1,'slot_count_including_retired',3,'audits',2,'replay_records',2,'one_conflicting_mutation_applied',true,'source_submission_tested',false);
rollback;
