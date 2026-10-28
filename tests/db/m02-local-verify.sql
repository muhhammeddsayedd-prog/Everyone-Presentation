begin read only;
do $$ begin
 if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
   or not exists(select 1 from eps_local_guard.m02_fixture where id=1 and marker='EPS M02 LOCAL DURABILITY V1')
   or (select count(*) from eps.jobs)<>5 or (select count(*) from eps.outbox_events where status='delivered')<>4
   or (select count(*) from eps.outbox_events where status='dead' and last_error->>'code'='DISPATCH_OBSOLETE' and lease_token_digest is null)<>1
   or (select count(*) from eps.jobs where workspace_id='7c111111-1111-4111-8111-111111111111' and status='queued' and row_version=1 and attempt=0 and current_attempt_id is null and lease_token_digest is null)<>3
   or (select count(*) from eps.jobs where resource_id='7d111111-1111-4111-8111-111111111111')<>1
   or (select count(*) from eps.jobs where status='cancelled' and row_version=2 and cancel_requested_at is not null)<>2
   or (select count(*) from eps.idempotency_records where principal_id='7a111111-1111-4111-8111-111111111111' and operation='jobs.enqueue')<>6
   or (select count(*) from eps.idempotency_records where principal_id='7a111111-1111-4111-8111-111111111111' and operation='jobs.cancel')<>2
   or (select count(*) from eps.audit_events where principal_id='7a111111-1111-4111-8111-111111111111' and action='jobs.enqueue')<>5
   or (select count(*) from eps.audit_events where principal_id='7a111111-1111-4111-8111-111111111111' and action='jobs.cancel')<>2
   or (select count(*) from eps.outbox_events where attempt_count=2)<>1
   or exists(select 1 from eps.outbox_events where status='delivered' and lease_token_digest is null or lease_expires_at is not null)
   or not exists(select 1 from eps.jobs job join eps.outbox_events event on event.job_id=job.id where job.resource_id='7d444444-4444-4444-8444-444444444444' and job.status='cancelled' and event.status='dead')
   or not exists(select 1 from eps.jobs job join eps.outbox_events event on event.job_id=job.id where job.resource_id='7d555555-5555-4555-8555-555555555555' and job.status='cancelled' and event.status='delivered')
   or exists(select 1 from eps.job_events)
   or has_table_privilege('eps_jobs_dispatcher','eps.jobs','UPDATE') or has_function_privilege('authenticated','eps.m02_enqueue_specs_job(uuid,jsonb,text)','EXECUTE')
 then raise exception 'M02_LOCAL_DURABILITY_ASSERTION_FAILED'; end if;
end $$;
select jsonb_build_object('jobs',5,'outbox',5,'enqueue_audits',5,'enqueue_replays',6,'cancel_effects',2,'stage_events',0,'providers_called',false,'stage_processing_tested',false);
rollback;
