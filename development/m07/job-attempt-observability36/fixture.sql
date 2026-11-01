-- SYNTHETIC, UNEXECUTED, OWNED-LOCAL ONLY. Candidate and history35 already staged.
-- Tests the actual trigger under SQL; this is not an authenticated service claim test.
-- The future reviewed harness owns the outer transaction and MUST roll everything back.
do $$begin
 if current_user<>'postgres' or current_database()<>'postgres'
 or current_setting('eps.job_attempt_trace_candidate',true) is distinct from 'owned-local-source-only-v1'
 or to_regclass('eps.job_stage_attempts') is null
 or exists(select 1 from eps.jobs where id='a0740000-0000-4000-8000-000000000001')
 or exists(select 1 from auth.users where id='a0740000-0000-4000-8000-000000000002')
 or exists(select 1 from public.projects where id='a0740000-0000-4000-8000-000000000003')
 then raise exception 'ATTEMPT_TRACE_OWNED_EMPTY_FIXTURE_REQUIRED'; end if;
end$$;
create function pg_temp.trace_assert(value boolean,label text) returns void language plpgsql as $$begin
 if value is distinct from true then raise exception 'ATTEMPT_TRACE_ASSERT_FAILED: %',label;end if;
end$$;
select pg_temp.trace_assert(not exists(select 1 from eps.job_stage_attempts),'no historical backfill');
insert into auth.users(id,is_anonymous) values('a0740000-0000-4000-8000-000000000002',false);
insert into public.projects(id,name) values('a0740000-0000-4000-8000-000000000003','Synthetic trace project');
insert into eps.workspaces(id,project_id) values('a0740000-0000-4000-8000-000000000004','a0740000-0000-4000-8000-000000000003');
insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,dedupe_key,correlation_id)
values('a0740000-0000-4000-8000-000000000001','a0740000-0000-4000-8000-000000000004',
 'a0740000-0000-4000-8000-000000000002','specs_extract','a0740000-0000-4000-8000-000000000005',
 '{"private_synthetic_input":"sensitive-input-sentinel"}',repeat('a',64),repeat('b',64),'synthetic-074');
select pg_temp.trace_assert(not exists(select 1 from eps.job_stage_attempts),'enqueue is not claim');
update eps.jobs set status='running',attempt=1,current_attempt_id='a0740000-0000-4000-8000-000000000011',
 lease_token_digest=repeat('c',64),lease_expires_at=clock_timestamp()+interval'90 seconds',
 stage_attempts='{"prepare_document":1}',n8n_execution_id='synthetic-31686',row_version=row_version+1,updated_at=clock_timestamp()
where id='a0740000-0000-4000-8000-000000000001';
select pg_temp.trace_assert((select count(*)=1 and min(workflow_execution_id)='synthetic-31686' from eps.job_stage_attempts),'first claim');
-- Same-ID replay/update and heartbeats must not create another trace.
update eps.jobs set current_attempt_id=current_attempt_id,heartbeat_at=clock_timestamp(),row_version=row_version+1
where id='a0740000-0000-4000-8000-000000000001';
select pg_temp.trace_assert((select count(*)=1 from eps.job_stage_attempts),'same-ID duplicate');
insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)
values('a0740000-0000-4000-8000-000000000001','a0740000-0000-4000-8000-000000000011','synthetic-complete',1,
 'prepare_document','succeeded',repeat('d',64),'{"applied":true}');
update eps.jobs set status='queued',stage='extract_specs',lease_token_digest=null,lease_expires_at=null,
 dispatch_generation=2,row_version=row_version+1 where id='a0740000-0000-4000-8000-000000000001';
update eps.jobs set status='running',attempt=2,current_attempt_id='a0740000-0000-4000-8000-000000000012',
 lease_token_digest=repeat('e',64),lease_expires_at=clock_timestamp()+interval'90 seconds',
 stage_attempts='{"prepare_document":1,"extract_specs":1}',n8n_execution_id='synthetic-31687',
 row_version=row_version+1,updated_at=clock_timestamp() where id='a0740000-0000-4000-8000-000000000001';
select pg_temp.trace_assert((select array_agg(workflow_execution_id order by attempt)=array['synthetic-31686','synthetic-31687']
 from eps.job_stage_attempts),'prior execution survives stage advancement');
insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)
values('a0740000-0000-4000-8000-000000000001','a0740000-0000-4000-8000-000000000012','synthetic-failed',1,
 'extract_specs','failed',repeat('f',64),'{"applied":true}');
update eps.jobs set status='queued',lease_token_digest=null,lease_expires_at=null,dispatch_generation=3,
 row_version=row_version+1 where id='a0740000-0000-4000-8000-000000000001';
update eps.jobs set status='running',attempt=3,current_attempt_id='a0740000-0000-4000-8000-000000000013',
 lease_token_digest=repeat('e',64),lease_expires_at=clock_timestamp()+interval'90 seconds',
 stage_attempts='{"prepare_document":1,"extract_specs":2}',n8n_execution_id=null,
 row_version=row_version+1,updated_at=clock_timestamp() where id='a0740000-0000-4000-8000-000000000001';
select pg_temp.trace_assert((select stage_attempt=2 and workflow_execution_id is null and workflow_execution_ref_state='not_provided'
 from eps.job_stage_attempts where attempt=3),'retry/unknown ref explicit');
update eps.jobs set status='queued',lease_token_digest=null,lease_expires_at=null,dispatch_generation=4,
 row_version=row_version+1 where id='a0740000-0000-4000-8000-000000000001';
update eps.jobs set status='running',attempt=4,current_attempt_id='a0740000-0000-4000-8000-000000000014',
 lease_token_digest=repeat('e',64),lease_expires_at=clock_timestamp()+interval'90 seconds',
 stage_attempts='{"prepare_document":1,"extract_specs":3}',n8n_execution_id='sensitive-unsafe-ref?token=sentinel',
 row_version=row_version+1,updated_at=clock_timestamp() where id='a0740000-0000-4000-8000-000000000001';
select pg_temp.trace_assert((select workflow_execution_id is null and workflow_execution_ref_state='invalid_omitted'
 from eps.job_stage_attempts where attempt=4),'unsafe free text omitted');
select pg_temp.trace_assert(not exists(select 1 from eps.job_stage_attempts where to_jsonb(job_stage_attempts)::text like '%sensitive-%'),
 'no input or unsafe reference persisted');
-- Prove a trace and its job update roll back together, with no ON CONFLICT hiding it.
savepoint trace_claim_rollback;
update eps.jobs set attempt=5,current_attempt_id='a0740000-0000-4000-8000-000000000015',
 stage_attempts='{"prepare_document":1,"extract_specs":4}',row_version=row_version+1,updated_at=clock_timestamp()
where id='a0740000-0000-4000-8000-000000000001';
select pg_temp.trace_assert((select count(*)=5 from eps.job_stage_attempts),'uncommitted claim visible in own transaction');
rollback to savepoint trace_claim_rollback;
select pg_temp.trace_assert((select count(*)=4 from eps.job_stage_attempts)
 and(select attempt=4 from eps.jobs where id='a0740000-0000-4000-8000-000000000001'),'rolled-back claim absent');
do $$begin
 begin
  update eps.jobs set current_attempt_id='a0740000-0000-4000-8000-000000000016',row_version=row_version+1
  where id='a0740000-0000-4000-8000-000000000001';
 exception when others then
  if sqlerrm='ATTEMPT_TRACE_CLAIM_INVARIANT_REQUIRED' then return;end if;raise;
 end;
 raise exception 'ATTEMPT_TRACE_BAD_CLAIM_WAS_ACCEPTED';
end$$;
select pg_temp.trace_assert((select count(*)=4 from eps.job_stage_attempts),'invalid claim rolled back');
select pg_temp.trace_assert((select count(*)=2 from eps.job_events e join eps.job_stage_attempts a
 on a.job_id=e.job_id and a.attempt_id=e.attempt_id),'success/failure metadata joins exact attempts');
-- The established explicit presentation retry clears this stage's retry budget.
-- Its next claim has a new UUID/total attempt but may legitimately be stage_attempt1 again.
insert into eps.jobs(id,workspace_id,requested_by,kind,stage,resource_id,input,input_hash,input_hash_version,dedupe_key,correlation_id)
values('a0740000-0000-4000-8000-000000000006','a0740000-0000-4000-8000-000000000004',
 'a0740000-0000-4000-8000-000000000002','presentation_render','render_presentation','a0740000-0000-4000-8000-000000000007',
 '{}',repeat('7',64),'eps.presentation-job-input.cast-canonical.v1',repeat('8',64),'synthetic-074-manual-retry');
update eps.jobs set status='running',attempt=1,current_attempt_id='a0740000-0000-4000-8000-000000000021',
 lease_token_digest=repeat('9',64),lease_expires_at=clock_timestamp()+interval'90 seconds',
 stage_attempts='{"render_presentation":1}',n8n_execution_id='synthetic-render-before-reset',row_version=row_version+1,updated_at=clock_timestamp()
where id='a0740000-0000-4000-8000-000000000006';
update eps.jobs set status='failed',lease_token_digest=null,lease_expires_at=null,
 error='{"code":"PROCESSING_FAILED","retryable":false}',row_version=row_version+1
where id='a0740000-0000-4000-8000-000000000006';
-- The actual M05 public.eps_retry_job patch removes stage_attempts-stage. Exercise
-- that transition directly here; authenticated/domain retry coverage is separate.
update eps.jobs set status='queued',stage_attempts=stage_attempts-stage,error=null,
 dispatch_generation=dispatch_generation+1,row_version=row_version+1
where id='a0740000-0000-4000-8000-000000000006';
update eps.jobs set status='running',attempt=2,current_attempt_id='a0740000-0000-4000-8000-000000000022',
 lease_token_digest=repeat('9',64),lease_expires_at=clock_timestamp()+interval'90 seconds',
 stage_attempts='{"render_presentation":1}',n8n_execution_id='synthetic-render-after-reset',row_version=row_version+1,updated_at=clock_timestamp()
where id='a0740000-0000-4000-8000-000000000006';
select pg_temp.trace_assert((select array_agg(stage_attempt order by attempt)=array[1,1]
 and array_agg(attempt order by attempt)=array[1,2]
 and array_agg(workflow_execution_id order by attempt)=array['synthetic-render-before-reset','synthetic-render-after-reset']
 from eps.job_stage_attempts where job_id='a0740000-0000-4000-8000-000000000006'),
 'manual presentation reset/reclaim preserves both attempts');
select pg_temp.trace_assert(not has_table_privilege('anon','eps.job_stage_attempts','SELECT')
 and not has_table_privilege('authenticated','eps.job_stage_attempts','SELECT')
 and not has_table_privilege('service_role','eps.job_stage_attempts','SELECT')
 and not has_table_privilege('eps_jobs_executor','eps.job_stage_attempts','INSERT')
 and not has_table_privilege('eps_job_trace_owner','eps.jobs','SELECT')
 and not has_table_privilege('eps_job_trace_owner','eps.job_stage_attempts','SELECT')
 and not has_table_privilege('eps_job_trace_owner','eps.job_stage_attempts','UPDATE')
 and not has_table_privilege('eps_job_trace_owner','eps.job_stage_attempts','DELETE')
 and not has_schema_privilege('eps_job_trace_owner','eps','CREATE')
 and not has_function_privilege('authenticated','eps.capture_job_stage_attempt()','EXECUTE'), 'least privilege');
select pg_temp.trace_assert((select relrowsecurity and relforcerowsecurity from pg_class where oid='eps.job_stage_attempts'::regclass)
 and(select not rolcanlogin and not rolinherit and not rolsuper and not rolcreatedb and not rolcreaterole and not rolbypassrls
  from pg_roles where rolname='eps_job_trace_owner'),'forced RLS and safe owner');
set local role authenticated;
do $$begin
 begin perform 1 from eps.job_stage_attempts;exception when insufficient_privilege then return;end;
 raise exception 'ATTEMPT_TRACE_USER_READ_WAS_ACCEPTED';
end$$;
do $$begin
 begin perform eps.capture_job_stage_attempt();exception when insufficient_privilege then return;end;
 raise exception 'ATTEMPT_TRACE_PUBLIC_FUNCTION_WAS_ACCEPTED';
end$$;
set local role postgres;
set local role eps_job_trace_owner;
do $$begin
 begin
  insert into eps.job_stage_attempts(schema_version,job_id,attempt_id,kind,stage,attempt,stage_attempt,dispatch_generation,
   correlation_id,input_hash,workflow_execution_id,workflow_execution_ref_state,claimed_at,job_row_version)
  values('1.0','a0740000-0000-4000-8000-000000000001','a0740000-0000-4000-8000-000000000099','specs_extract','apply_specs',99,1,99,
   'synthetic-074',repeat('a',64),null,'not_provided',clock_timestamp(),99);
 exception when insufficient_privilege then return;end;
 raise exception 'ATTEMPT_TRACE_OUTSIDE_TRIGGER_INSERT_WAS_ACCEPTED';
end$$;
set local role postgres;
-- No COMMIT: outer owner must ROLLBACK the candidate, fixture, role and all rows.
