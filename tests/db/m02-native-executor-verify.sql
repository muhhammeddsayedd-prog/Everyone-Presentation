begin;
set local search_path='';
select eps_local_guard.native_specs_fixture_require();
select eps_local_guard.native_specs_fixture_validate(true);
do $$ begin
 if (select count(*) from eps.roles where workspace_id::text like '7c980000-%')<>2
  or (select count(*) from eps.slots where workspace_id::text like '7c980000-%')<>2
  or (select count(*) from eps.specs_stage_payloads p join eps.jobs j on j.id=p.job_id where j.workspace_id::text like '7c980000-%')<>8
  or (select count(*) from eps.outbox_events e join eps.jobs j on j.id=e.job_id where j.workspace_id::text like '7c980000-%')<>14
  or (select count(*) from eps.job_events e join eps.jobs j on j.id=e.job_id where j.workspace_id::text like '7c980000-%' and e.event_type='succeeded')<>11
  or (select count(*) from eps.audit_events where principal_id='7a980000-0000-4000-8000-000000000001' and action='jobs.apply_specs')<>2
  or (select count(*) from eps.idempotency_records where principal_id='7a980000-0000-4000-8000-000000000001')<>2
  or not exists(select 1 from eps.jobs where id='7f980000-0000-4000-8000-000000000004' and attempt=4 and stage_attempts='{"prepare_document":2,"extract_specs":1,"apply_specs":1}')
 then raise exception 'NATIVE_FINAL_COUNTS_OR_REPLAY_UNCONFIRMED'; end if;
 update eps_local_guard.native_specs_fixture set verified_sha256=eps_local_guard.native_specs_fixture_digest();
end $$;
select jsonb_build_object('verified',true,'generated_roles',2,'generated_slots',2,'successful_stage_callbacks',11,'private_stage_payloads',8);
commit;
