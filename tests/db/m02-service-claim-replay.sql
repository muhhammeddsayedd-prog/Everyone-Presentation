-- Owned local13 + candidate14 only. Synthetic rows and all DDL are rolled back.
do $$ begin
 if current_setting('eps.service_claim_rehearsal',true) is distinct from 'rollback-only-v1'
  or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
  or exists(select 1 from auth.users where id::text like '7aad0000-%')
 then raise exception 'SERVICE_CLAIM_SYNTHETIC_ROLLBACK_REQUIRED'; end if;
end $$;
create function pg_temp.replay_assert(value boolean,label text) returns void language plpgsql as $$ begin
 if value is distinct from true then raise exception 'SERVICE_REPLAY_ASSERTION: %',label; end if;
end $$;
create function pg_temp.replay_expect(query text,expected text) returns void language plpgsql as $$ begin
 begin execute query; exception when others then
  if sqlerrm=expected or sqlstate=expected then return; end if;
  raise exception 'SERVICE_REPLAY_WRONG_ERROR expected %, got % / %',expected,sqlstate,sqlerrm;
 end; raise exception 'SERVICE_REPLAY_EXPECTED_ERROR_NOT_RAISED: %',expected;
end $$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until) values ('7aad0000-0000-4000-8000-000000000001',false,null,null);
insert into public.projects(id,name) values('7bad0000-0000-4000-8000-000000000001','Synthetic service claim');
insert into eps.workspaces(id,project_id) values('7cad0000-0000-4000-8000-000000000001','7bad0000-0000-4000-8000-000000000001');
insert into public.project_memberships(project_id,principal_id,can_write) values
 ('7bad0000-0000-4000-8000-000000000001','7aad0000-0000-4000-8000-000000000001',true);
insert into public.app_capability_grants(principal_id,capability)
 select '7aad0000-0000-4000-8000-000000000001'::uuid,c from unnest(array['projects.read','workspaces.read','workspaces.write','operations.retry']) c;
update eps.specs_pipeline_config set enabled=true,document_preparation_version='document-preparation.v1',model_version='synthetic-model',prompt_version='spec_extract_v1.0.0',result_schema_version='1.0' where id=1;
update eps.specs set source_text='Synthetic source actor.',source_row_version=2 where workspace_id='7cad0000-0000-4000-8000-000000000001';
create function pg_temp.replay_new_job() returns uuid language plpgsql as $$ declare spec eps.specs; body jsonb; job_id uuid:=gen_random_uuid(); workspace_version bigint; begin
 select * into strict spec from eps.specs where workspace_id='7cad0000-0000-4000-8000-000000000001';
 select row_version into strict workspace_version from eps.workspaces where id=spec.workspace_id;
 body:=jsonb_build_object('schema_version','1.0','specs_id',spec.id,'source_hash',encode(sha256(convert_to(spec.source_text,'UTF8')),'hex'),
  'source_row_version',spec.source_row_version,'workspace_row_version',workspace_version,'configuration',jsonb_build_object(
   'document_preparation_version','document-preparation.v1','model_version','synthetic-model','prompt_version','spec_extract_v1.0.0','result_schema_version','1.0'));
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,dedupe_key,correlation_id)
 values(job_id,spec.workspace_id,'7aad0000-0000-4000-8000-000000000001','specs_extract',spec.id,body,eps.jobs_hash_v1(body),encode(sha256(convert_to(job_id::text,'UTF8')),'hex'),'synthetic-service-replay');
 insert into eps.specs_source_inputs(job_id,workspace_id,spec_id,source_row_version,source_hash,input_hash,source_text)
 values(job_id,spec.workspace_id,spec.id,spec.source_row_version,body->>'source_hash',eps.jobs_hash_v1(body),spec.source_text);
 update eps.specs set processing_job_id=job_id where id=spec.id; return job_id;
end $$;
create function pg_temp.replay_claim(key_value text default 'synthetic-service-claim-one',encryption_value text default repeat('12',32)) returns jsonb language sql as $$
 select eps.claim_job_stage_replay(current_setting('eps.replay.input')::jsonb,key_value,'synthetic-key-v1',encryption_value)
$$;
do $$ declare job_id uuid; input jsonb; first_response jsonb; second_response jsonb; stored eps.job_stage_claim_replays; begin
 job_id:=pg_temp.replay_new_job();
 select jsonb_build_object('job_id',id,'stage',stage,'input_hash',input_hash) into input from eps.jobs where id=job_id;
 perform set_config('eps.replay.input',input::text,true);
 first_response:=pg_temp.replay_claim(); second_response:=pg_temp.replay_claim();
 perform pg_temp.replay_assert(first_response=second_response,'same key replays exact active token/attempt');
 perform pg_temp.replay_assert((select attempt=1 and (stage_attempts->>'prepare_document')::integer=1 from eps.jobs where id=job_id),'one claim side effect');
 select * into strict stored from eps.job_stage_claim_replays where idempotency_key='synthetic-service-claim-one';
 perform pg_temp.replay_assert(stored.expires_at=(first_response->>'lease_expires_at')::timestamptz
  and position(convert_to(first_response->>'lease_token','UTF8') in stored.encrypted_response)=0
  and position(convert_to(repeat('12',32),'UTF8') in stored.encrypted_response)=0,'ciphertext only and exact lease expiry');
 perform pg_temp.replay_expect($q$select pg_temp.replay_claim('synthetic-service-claim-one',repeat('13',32))$q$,'CLAIM_REPLAY_KEY_UNAVAILABLE');
 perform set_config('eps.replay.input',(input||'{"workflow_execution_id":"different"}'::jsonb)::text,true);
 perform pg_temp.replay_expect('select pg_temp.replay_claim()','IDEMPOTENCY_KEY_REUSED');
 perform set_config('eps.replay.input',input::text,true);
 update public.project_memberships set can_write=false where project_id='7bad0000-0000-4000-8000-000000000001';
 perform pg_temp.replay_expect('select pg_temp.replay_claim()','CAPABILITY_REQUIRED');
 update public.project_memberships set can_write=true where project_id='7bad0000-0000-4000-8000-000000000001';
 update eps.specs set source_row_version=source_row_version+1 where workspace_id='7cad0000-0000-4000-8000-000000000001';
 perform pg_temp.replay_expect('select pg_temp.replay_claim()','INPUT_CHANGED');
 update eps.specs set source_row_version=source_row_version-1 where workspace_id='7cad0000-0000-4000-8000-000000000001';
 update eps.jobs set cancel_requested_at=clock_timestamp() where id=job_id;
 perform pg_temp.replay_expect('select pg_temp.replay_claim()','STALE_STAGE_LEASE');
 update eps.jobs set cancel_requested_at=null,lease_expires_at=clock_timestamp()-interval '1 second' where id=job_id;
 perform pg_temp.replay_expect('select pg_temp.replay_claim()','STALE_STAGE_LEASE');
 update eps.job_stage_claim_replays set expires_at=clock_timestamp()-interval '1 second' where idempotency_key='synthetic-service-claim-one';
 job_id:=pg_temp.replay_new_job();
 select jsonb_build_object('job_id',id,'stage',stage,'input_hash',input_hash) into input from eps.jobs where id=job_id;
 perform set_config('eps.replay.input',input::text,true); second_response:=pg_temp.replay_claim('synthetic-service-claim-two');
 perform pg_temp.replay_assert((select encrypted_response is null from eps.job_stage_claim_replays where idempotency_key='synthetic-service-claim-one'),'bounded expiry ciphertext purge, tombstone retained');
 perform pg_temp.replay_assert(not has_function_privilege('authenticated','eps.claim_job_stage_replay(jsonb,text,text,text)','EXECUTE')
  and not has_function_privilege('anon','eps.claim_job_stage_replay(jsonb,text,text,text)','EXECUTE')
  and not has_table_privilege('eps_jobs_executor','eps.job_stage_claim_replays','SELECT,INSERT,UPDATE,DELETE')
  and has_function_privilege('eps_jobs_executor','eps.claim_job_stage_replay(jsonb,text,text,text)','EXECUTE'),'service execute only, browser/guest denied');
end $$;
select 'SERVICE_CLAIM_REPLAY_AND_SCOPE_PASSED';
