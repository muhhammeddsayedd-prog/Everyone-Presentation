-- LOCAL ROLLBACK CANDIDATE PROOF ONLY: no n8n/provider, stage callback or restart claim.
-- Root inserts the exact reviewed candidate at the marker inside this transaction.
begin;
-- EPS_M02_CANDIDATE_SQL
do $$ begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
    or to_regclass('eps.jobs') is null or not exists(select 1 from eps_local_guard.instance where id=1)
  then raise exception 'M02_REVIEWED_LOCAL_CANDIDATE_REQUIRED'; end if;
  if exists(select 1 from auth.users where id in('6a111111-1111-4111-8111-111111111111','6a222222-2222-4222-8222-222222222222','6a333333-3333-4333-8333-333333333333'))
    or exists(select 1 from public.projects where id in('6b111111-1111-4111-8111-111111111111','6b222222-2222-4222-8222-222222222222'))
  then raise exception 'M02_FIXTURE_COLLISION_PRESERVE_DATA'; end if;
end $$;
create function pg_temp.m02_assert(condition boolean,label text) returns void language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'M02_ASSERTION: %',label; end if;
end $$;
create function pg_temp.m02_expect(query text,expected text) returns void language plpgsql as $$ begin
  begin execute query; exception when others then if sqlerrm=expected or sqlstate=expected then return; end if; raise exception 'M02_WRONG_ERROR expected %, got % / %',expected,sqlstate,sqlerrm; end;
  raise exception 'M02_EXPECTED_ERROR_NOT_RAISED: %',expected;
end $$;
create function pg_temp.m02_actor(principal uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub',principal::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',principal,'role','authenticated','is_anonymous',false)::text,true);
end $$;
create function pg_temp.m02_put(name text,value jsonb) returns void language plpgsql as $$ begin perform set_config(name,value::text,true); end $$;
create function pg_temp.m02_get(name text) returns jsonb language sql stable as $$ select current_setting(name)::jsonb $$;
create function pg_temp.m02_input(second_source boolean default false) returns jsonb language sql immutable as $$
  select jsonb_build_object('schema_version','1.0','specs_id',case when second_source then '6d222222-2222-4222-8222-222222222222' else '6d111111-1111-4111-8111-111111111111' end,
    'source_hash',repeat('a',64),'source_row_version',1,'workspace_row_version',1,'configuration',
    jsonb_build_object('document_preparation_version','synthetic-doc-v1','model_version','synthetic-model-v1','prompt_version','synthetic-prompt-v1','result_schema_version','synthetic-specs-v1'))
$$;
insert into auth.users(id) values('6a111111-1111-4111-8111-111111111111'),('6a222222-2222-4222-8222-222222222222'),('6a333333-3333-4333-8333-333333333333');
insert into public.projects(id,name) values('6b111111-1111-4111-8111-111111111111','Synthetic M02 jobs'),('6b222222-2222-4222-8222-222222222222','Synthetic M02 other project');
insert into public.project_memberships(project_id,principal_id,can_write) values
 ('6b111111-1111-4111-8111-111111111111','6a111111-1111-4111-8111-111111111111',true),
 ('6b111111-1111-4111-8111-111111111111','6a222222-2222-4222-8222-222222222222',false),
 ('6b222222-2222-4222-8222-222222222222','6a333333-3333-4333-8333-333333333333',true);
insert into public.app_capability_grants(principal_id,capability)
  select principal,capability from unnest(array['6a111111-1111-4111-8111-111111111111'::uuid,'6a333333-3333-4333-8333-333333333333'::uuid]) principal
    cross join unnest(array['projects.read','workspaces.read','workspaces.write','operations.retry']) capability;
insert into public.app_capability_grants(principal_id,capability) select '6a222222-2222-4222-8222-222222222222',capability from unnest(array['projects.read','workspaces.read']) capability;
insert into eps.workspaces(id,project_id) values('6c111111-1111-4111-8111-111111111111','6b111111-1111-4111-8111-111111111111'),('6c222222-2222-4222-8222-222222222222','6b222222-2222-4222-8222-222222222222');
select pg_temp.m02_assert((select count(*)=3 from pg_class where oid in('eps.jobs'::regclass,'eps.job_events'::regclass,'eps.outbox_events'::regclass) and relrowsecurity and relforcerowsecurity),'all queue tables force RLS');
select pg_temp.m02_assert(not has_table_privilege('authenticated','eps.jobs','SELECT') and not has_table_privilege('eps_jobs_dispatcher','eps.jobs','UPDATE'),'users and dispatcher lack direct table authority');
select pg_temp.m02_assert(not has_function_privilege('authenticated','eps.m02_enqueue_specs_job(uuid,jsonb,text)','EXECUTE') and not has_function_privilege('eps_api_owner','eps.m02_enqueue_specs_job(uuid,jsonb,text)','EXECUTE'),'generic enqueue is not exposed before validated submit_specs exists');

select pg_temp.m02_actor('6a111111-1111-4111-8111-111111111111');
set local role eps_jobs_owner;
select pg_temp.m02_put('eps.m02.job1',eps.m02_enqueue_specs_job('6c111111-1111-4111-8111-111111111111',pg_temp.m02_input(),'m02-enqueue-1'));
do $$ declare first jsonb:=pg_temp.m02_get('eps.m02.job1'); begin
  perform pg_temp.m02_assert(first->>'status'='queued' and not(first?'input') and not(first?'lease_token_digest'),'public projection contains no private job input or verifier');
  perform pg_temp.m02_assert(eps.m02_enqueue_specs_job('6c111111-1111-4111-8111-111111111111',pg_temp.m02_input(),'m02-enqueue-1')=first,'same key replays once');
  perform pg_temp.m02_assert(eps.m02_enqueue_specs_job('6c111111-1111-4111-8111-111111111111',pg_temp.m02_input(),'m02-enqueue-2')=first,'another key dedupes frozen source/configuration');
  perform pg_temp.m02_expect('select eps.m02_enqueue_specs_job(''6c111111-1111-4111-8111-111111111111'',pg_temp.m02_input(true),''m02-enqueue-1'')','IDEMPOTENCY_KEY_REUSED');
  perform pg_temp.m02_expect('select eps.m02_enqueue_specs_job(''6c111111-1111-4111-8111-111111111111'',pg_temp.m02_input()||''{"source_text":"do not put source bodies in jobs"}'',''m02-raw-source'')','INVALID_REQUEST');
end $$;
reset role;
select pg_temp.m02_assert((select count(*)=1 from eps.jobs) and (select count(*)=1 from eps.outbox_events) and (select count(*)=1 from eps.audit_events where action='jobs.enqueue'),'one job, outbox and creation audit');
select pg_temp.m02_assert((select input_hash=eps.jobs_hash_v1(input) and input_hash_version='eps.specs-input.pg-jsonb.v1' from eps.jobs),'database owns versioned frozen input fingerprint');

-- Force failure after job insertion, exercising rollback of the whole operation.
create function pg_temp.m02_break_outbox() returns trigger language plpgsql as $$ begin raise exception 'SYNTHETIC_OUTBOX_FAILURE'; end $$;
create trigger eps_test_m02_break_outbox before insert on eps.outbox_events for each row execute function pg_temp.m02_break_outbox();
set local role eps_jobs_owner;
select pg_temp.m02_expect('select eps.m02_enqueue_specs_job(''6c111111-1111-4111-8111-111111111111'',pg_temp.m02_input(true),''m02-atomic-failure'')','SYNTHETIC_OUTBOX_FAILURE');
reset role;
drop trigger eps_test_m02_break_outbox on eps.outbox_events;
drop function pg_temp.m02_break_outbox();
select pg_temp.m02_assert((select count(*)=1 from eps.jobs) and not exists(select 1 from eps.idempotency_records where key='m02-atomic-failure'),'failed outbox insertion leaves no job or replay record');

set local role authenticated;
select pg_temp.m02_actor('6a222222-2222-4222-8222-222222222222');
select pg_temp.m02_assert(public.eps_get_job((pg_temp.m02_get('eps.m02.job1')->>'id')::uuid)->>'id'=pg_temp.m02_get('eps.m02.job1')->>'id','owning readonly workspace permits status projection');
select pg_temp.m02_expect('select * from eps.jobs','42501');
select pg_temp.m02_expect('select eps.claim_job_outbox(1)','42501');
select pg_temp.m02_expect('select public.eps_cancel_job((pg_temp.m02_get(''eps.m02.job1'')->>''id'')::uuid,''{"row_version":1}'',''readonly-cancel'')','CAPABILITY_REQUIRED');
select pg_temp.m02_actor('6a333333-3333-4333-8333-333333333333');
do $$ begin perform set_config('eps.jobs.mode','dispatcher',true); end $$;
select pg_temp.m02_expect('select public.eps_get_job((pg_temp.m02_get(''eps.m02.job1'')->>''id'')::uuid)','RESOURCE_NOT_FOUND');
select pg_temp.m02_assert(public.eps_list_jobs()->'data'='[]'::jsonb,'forged mode cannot cross project scope');
reset role;

-- Lease credentials remain in transaction-local test memory, never SELECT output.
set local role eps_jobs_dispatcher;
select pg_temp.m02_expect('select * from eps.outbox_events','42501');
select pg_temp.m02_put('eps.m02.dispatch1',eps.claim_job_outbox(1)->'leases'->0);
select pg_temp.m02_assert(not(pg_temp.m02_get('eps.m02.dispatch1')->'envelope'?'lease_token') and not(pg_temp.m02_get('eps.m02.dispatch1')->'envelope'?'input'),'small n8n envelope excludes dispatcher credential/source');
reset role;
update eps.outbox_events set lease_expires_at=clock_timestamp()-interval '1 second' where id=(pg_temp.m02_get('eps.m02.dispatch1')->>'id')::uuid;
set local role eps_jobs_dispatcher;
select pg_temp.m02_put('eps.m02.dispatch2',eps.claim_job_outbox(1)->'leases'->0);
select pg_temp.m02_assert(pg_temp.m02_get('eps.m02.dispatch1')->>'lease_token'<>pg_temp.m02_get('eps.m02.dispatch2')->>'lease_token','expired lease is reclaimed with new credential');
select pg_temp.m02_expect('select eps.finish_job_outbox((pg_temp.m02_get(''eps.m02.dispatch1'')->>''id'')::uuid,pg_temp.m02_get(''eps.m02.dispatch1'')->>''lease_token'',true)','INVALID_TRANSITION');
do $$ begin perform eps.finish_job_outbox((pg_temp.m02_get('eps.m02.dispatch2')->>'id')::uuid,pg_temp.m02_get('eps.m02.dispatch2')->>'lease_token',false); end $$;
reset role;
select pg_temp.m02_assert((select status='pending' and delivered_at is null and lease_token_digest is null and available_at>clock_timestamp() from eps.outbox_events),'failed delivery delays retry without fabricating accepted dispatch');
update eps.outbox_events set available_at=clock_timestamp()-interval '1 second';
set local role eps_jobs_dispatcher;
select pg_temp.m02_put('eps.m02.dispatch3',eps.claim_job_outbox(1)->'leases'->0);
do $$ declare value jsonb:=pg_temp.m02_get('eps.m02.dispatch3'); begin
  perform pg_temp.m02_assert(eps.finish_job_outbox((value->>'id')::uuid,value->>'lease_token',true)->>'acknowledged'='true','explicit accepted acknowledgement changes delivery state');
  perform pg_temp.m02_assert(eps.finish_job_outbox((value->>'id')::uuid,value->>'lease_token',true)->>'acknowledged'='true','accepted acknowledgement is idempotent');
end $$;
reset role;
select pg_temp.m02_assert((select status='delivered' and delivered_at is not null from eps.outbox_events),'delivery records acceptance only, not processing success');

-- Append-only callback identities are constrained; callback execution is NOT
-- implemented in this slice and neither users nor dispatcher may append events.
insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)
  values((pg_temp.m02_get('eps.m02.job1')->>'id')::uuid,'6e111111-1111-4111-8111-111111111111','synthetic-event',1,'prepare_document','progress',repeat('c',64),'{}');
select pg_temp.m02_expect('insert into eps.job_events select job_id,attempt_id,''another-event'',sequence,stage,event_type,payload_digest,receipt,created_at from eps.job_events','23505');
select pg_temp.m02_expect('insert into eps.job_events select job_id,attempt_id,event_id,sequence+1,stage,event_type,payload_digest,receipt,created_at from eps.job_events','23505');

select pg_temp.m02_actor('6a111111-1111-4111-8111-111111111111');
update eps.jobs set status='failed',error='{"code":"DISPATCH_UNAVAILABLE","message":"The processing request could not be dispatched.","details":{},"retryable":true}',row_version=row_version+1 where id=(pg_temp.m02_get('eps.m02.job1')->>'id')::uuid;
set local role authenticated;
select pg_temp.m02_expect('select public.eps_retry_job((pg_temp.m02_get(''eps.m02.job1'')->>''id'')::uuid,''{"row_version":1}'',''m02-stale-retry'')','STALE_RESOURCE_VERSION');
select pg_temp.m02_expect('select public.eps_retry_job((pg_temp.m02_get(''eps.m02.job1'')->>''id'')::uuid,''{"row_version":2,"reason":42}'',''m02-invalid-reason'')','INVALID_REQUEST');
select pg_temp.m02_put('eps.m02.retried',public.eps_retry_job((pg_temp.m02_get('eps.m02.job1')->>'id')::uuid,'{"row_version":2,"reason":"Operator requested retry"}','m02-retry'));
select pg_temp.m02_expect('select public.eps_retry_job((pg_temp.m02_get(''eps.m02.job1'')->>''id'')::uuid,''{"row_version":2,"reason":null}'',''m02-retry'')','IDEMPOTENCY_KEY_REUSED');
select pg_temp.m02_put('eps.m02.cancelled',public.eps_cancel_job((pg_temp.m02_get('eps.m02.job1')->>'id')::uuid,'{"row_version":3,"reason":null}','m02-cancel'));
select pg_temp.m02_assert(public.eps_cancel_job((pg_temp.m02_get('eps.m02.job1')->>'id')::uuid,'{"row_version":3,"reason":null}','m02-cancel')=pg_temp.m02_get('eps.m02.cancelled'),'same cancellation key replays before revision check');
select pg_temp.m02_expect('select public.eps_cancel_job((pg_temp.m02_get(''eps.m02.job1'')->>''id'')::uuid,''{"row_version":3,"reason":""}'',''m02-cancel'')','IDEMPOTENCY_KEY_REUSED');
reset role;
set local role eps_jobs_dispatcher;
select pg_temp.m02_assert(eps.claim_job_outbox(10)->'leases'='[]'::jsonb,'cancelled queued generation is not dispatched');
reset role;
select pg_temp.m02_assert(exists(select 1 from eps.outbox_events where dispatch_generation=2 and status='dead'),'obsolete queued dispatch is explicitly Dead');

set local role eps_jobs_owner;
select pg_temp.m02_put('eps.m02.job2',eps.m02_enqueue_specs_job('6c111111-1111-4111-8111-111111111111',pg_temp.m02_input(true),'m02-enqueue-second'));
reset role;
update eps.outbox_events set attempt_count=5 where job_id=(pg_temp.m02_get('eps.m02.job2')->>'id')::uuid;
set local role eps_jobs_dispatcher;
select pg_temp.m02_assert(eps.claim_job_outbox(10)->'leases'='[]'::jsonb,'exhausted dispatch does not silently reset its budget');
reset role;
select pg_temp.m02_assert(exists(select 1 from eps.jobs where id=(pg_temp.m02_get('eps.m02.job2')->>'id')::uuid and status='failed' and error->>'code'='DISPATCH_UNAVAILABLE'),'exhausted current dispatch becomes visible retryable job failure');
update eps.jobs set stage_attempts='{"prepare_document":3}' where id=(pg_temp.m02_get('eps.m02.job2')->>'id')::uuid;
set local role authenticated;
select pg_temp.m02_expect('select public.eps_retry_job((pg_temp.m02_get(''eps.m02.job2'')->>''id'')::uuid,''{"row_version":2}'',''m02-budget-retry'')','INVALID_TRANSITION');
reset role;
update public.project_memberships set active=false where project_id='6b111111-1111-4111-8111-111111111111' and principal_id='6a111111-1111-4111-8111-111111111111';
set local role authenticated;
select pg_temp.m02_expect('select public.eps_cancel_job((pg_temp.m02_get(''eps.m02.job1'')->>''id'')::uuid,''{"row_version":3,"reason":null}'',''m02-cancel'')','RESOURCE_NOT_FOUND');
reset role;
select 'M02 candidate SQL role/atomic enqueue/dedupe/dispatch lease/retry/cancel assertions passed; rollback only; no two-session, restart, n8n, worker or provider acceptance claimed.' as result;
rollback;
