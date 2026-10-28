-- Synthetic SQL-only policy/state-machine fixtures. Parent owns BEGIN/ROLLBACK.
-- No provider output, service identity, HTTP, native executor or n8n acceptance.
do $$ begin
 if current_user<>'postgres' or current_setting('eps.specs_stages_candidate_rehearsal',true) is distinct from 'rollback-only-v1'
  or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
  or exists(select 1 from auth.users where id::text like '7a960000-%')
  or exists(select 1 from public.projects where id::text like '7b960000-%')
  or exists(select 1 from eps.workspaces where id::text like '7c960000-%')
  or exists(select 1 from pg_roles where rolname='eps_stage_test_auth_reader')
 then raise exception 'SPECS_STAGES_OWNED_ROLLBACK_FIXTURE_REQUIRED'; end if;
end $$;
create function pg_temp.stage_assert(value boolean,label text) returns void language plpgsql as $$ begin
 if value is distinct from true then raise exception 'STAGE_ASSERTION: %',label; end if;
end $$;
create function pg_temp.stage_expect(query text,expected text) returns void language plpgsql as $$ begin
 begin execute query; exception when others then
  if sqlerrm=expected or sqlstate=expected then return; end if;
  raise exception 'STAGE_WRONG_ERROR expected %, got % / %',expected,sqlstate,sqlerrm;
 end;
 raise exception 'STAGE_EXPECTED_ERROR_NOT_RAISED: %',expected;
end $$;
create function pg_temp.stage_status(query text,expected text,status_value integer) returns void language plpgsql as $$ declare detail_value text; begin
 begin execute query; exception when raise_exception then
  get stacked diagnostics detail_value=pg_exception_detail;
  perform pg_temp.stage_assert(sqlerrm=expected and (detail_value::jsonb->>'status')::integer=status_value,'error HTTP status '||expected); return;
 end;
 raise exception 'STAGE_EXPECTED_STATUS_NOT_RAISED';
end $$;
insert into auth.users(id,is_anonymous,deleted_at,banned_until) values
 ('7a960000-0000-4000-8000-000000000001',false,null,null),
 ('7a960000-0000-4000-8000-000000000002',true,null,null),
 ('7a960000-0000-4000-8000-000000000003',false,clock_timestamp(),null),
 ('7a960000-0000-4000-8000-000000000004',false,null,clock_timestamp()+interval '1 day'),
 ('7a960000-0000-4000-8000-000000000005',false,null,clock_timestamp()-interval '1 day');
-- The fixed local runner supplies managed-Auth RLS=true/policies0 inside its
-- owned rollback transaction when the local image baseline differs from cloud.
select pg_temp.stage_assert((select relrowsecurity from pg_class where oid='auth.users'::regclass)
 and not exists(select 1 from pg_policy where polrelid='auth.users'::regclass),'managed Auth RLS/policy simulation prerequisite');
create role eps_stage_test_auth_reader nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant authenticated to eps_stage_test_auth_reader with inherit true,set false,admin false;
-- The local image's postgres lacks the hosted column grant option. The already
-- admin-owned rollback session temporarily acts as the actual Auth table owner.
set local role supabase_auth_admin;
grant select(id) on auth.users to eps_stage_test_auth_reader;
set local role postgres;
set local role eps_stage_test_auth_reader;
select pg_temp.stage_assert((select count(*)=0 from auth.users where id::text like '7a960000-%'),'non-bypass Auth reader is RLS-denied');
select pg_temp.stage_expect('select eps.job_requester_active(''7a960000-0000-4000-8000-000000000001'')','42501');
set local role postgres;
select pg_temp.stage_assert(eps.job_requester_active('7a960000-0000-4000-8000-000000000001')
 and not eps.job_requester_active(null) and not eps.job_requester_active('7a960000-0000-4000-8000-000000000099')
 and not eps.job_requester_active('7a960000-0000-4000-8000-000000000002') and not eps.job_requester_active('7a960000-0000-4000-8000-000000000003')
 and not eps.job_requester_active('7a960000-0000-4000-8000-000000000004') and eps.job_requester_active('7a960000-0000-4000-8000-000000000005'),'private Auth boolean exact eligibility');
select pg_temp.stage_assert((select proowner='postgres'::regrole and prosecdef and provolatile='v' and proconfig=array['search_path=""']
 from pg_proc where oid='eps.job_requester_active(uuid)'::regprocedure),'only Auth helper postgres definer/path contract');
insert into public.projects(id,name) values('7b960000-0000-4000-8000-000000000001','Synthetic stage kernel');
insert into eps.workspaces(id,project_id,row_version,draft_revision) values
 ('7c960000-0000-4000-8000-000000000001','7b960000-0000-4000-8000-000000000001',8,7);
insert into public.project_memberships(project_id,principal_id,can_write) values
 ('7b960000-0000-4000-8000-000000000001','7a960000-0000-4000-8000-000000000001',true);
insert into public.app_capability_grants(principal_id,capability)
 select '7a960000-0000-4000-8000-000000000001'::uuid,capability from unnest(array['projects.read','workspaces.write','operations.retry']) capability;
-- Original CRLF/BOM, non-BMP and whitespace-only lines exercise JS-equivalent offsets.
update eps.specs set source_text=chr(65279)||E'Synthetic actor 😀\r\n  continued\r\n\r\n\t\r\nثلاثة ممثلين',source_row_version=2
 where workspace_id='7c960000-0000-4000-8000-000000000001';
create function pg_temp.stage_new_job(p_workspace uuid default '7c960000-0000-4000-8000-000000000001') returns uuid language plpgsql as $$ declare spec eps.specs; body jsonb; job_id uuid:=gen_random_uuid(); workspace_version bigint; begin
 select * into strict spec from eps.specs where workspace_id=p_workspace;
 select row_version into strict workspace_version from eps.workspaces where id=p_workspace;
 body:=jsonb_build_object('schema_version','1.0','specs_id',spec.id,'source_hash',encode(sha256(convert_to(spec.source_text,'UTF8')),'hex'),
  'source_row_version',spec.source_row_version,'workspace_row_version',workspace_version,'configuration',jsonb_build_object(
   'document_preparation_version','document-preparation.v1','model_version','synthetic-model','prompt_version','spec_extract_v1.0.0','result_schema_version','1.0'));
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,dedupe_key,correlation_id)
 values(job_id,spec.workspace_id,'7a960000-0000-4000-8000-000000000001','specs_extract',spec.id,body,eps.jobs_hash_v1(body),encode(sha256(convert_to(job_id::text,'UTF8')),'hex'),'synthetic-stage-test');
 insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key) values(job_id,'prepare_document',eps.jobs_hash_v1(body),1,job_id::text||':1');
 update eps.specs set processing_job_id=job_id where id=spec.id; return job_id;
end $$;
create function pg_temp.stage_event(lease jsonb,number bigint,kind text,body jsonb default null,schema_name text default null) returns jsonb language sql as $$
 select jsonb_build_object('event_id','synthetic-'||number,'job_id',lease->>'job_id','attempt_id',lease->>'attempt_id',
  'lease_token',lease->>'lease_token','stage',lease->>'stage','sequence',number,'event_type',kind,'input_hash',lease#>>'{input,input_hash}')
  ||case when body is null then '{}'::jsonb when kind='failed' then jsonb_build_object('error',body) else jsonb_build_object('result',body) end
  ||case when schema_name is null then '{}'::jsonb else jsonb_build_object('result_schema',schema_name) end
$$;
create function pg_temp.stage_claim() returns jsonb language plpgsql as $$ begin
 return eps.claim_job_stage(jsonb_build_object('job_id',current_setting('eps.stage.job'),'stage',current_setting('eps.stage.next'),'input_hash',current_setting('eps.stage.hash')));
end $$;
do $$ declare job_id uuid; begin
 job_id:=pg_temp.stage_new_job(); perform set_config('eps.stage.job',job_id::text,true);
 perform set_config('eps.stage.hash',(select input_hash from eps.jobs where id=job_id),true);
 perform set_config('eps.stage.next','prepare_document',true);
 perform set_config('eps.stage.original_spec',(select to_jsonb(s)::text from eps.specs s where s.processing_job_id=job_id),true);
 perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims','{}',true);
end $$;
-- Public roles never receive an executor or raw private-payload API.
select pg_temp.stage_assert(not has_function_privilege('authenticated','eps.claim_job_stage(jsonb)','EXECUTE')
 and not has_function_privilege('service_role','eps.record_job_event(jsonb)','EXECUTE')
 and not has_schema_privilege('eps_jobs_executor','auth','USAGE')
 and not has_schema_privilege('eps_specs_stage_owner','auth','USAGE') and not has_schema_privilege('eps_specs_apply_owner','auth','USAGE')
 and not has_column_privilege('eps_specs_stage_owner','auth.users','id','SELECT')
 and not has_column_privilege('eps_specs_apply_owner','auth.users','id','SELECT'),'executor and non-bypass owners have no Auth access');
select pg_temp.stage_status('select eps.specs_stage_assert(false,''RESOURCE_NOT_FOUND'')','RESOURCE_NOT_FOUND',404);
select pg_temp.stage_status('select eps.specs_stage_assert(false,''CAPABILITY_REQUIRED'')','CAPABILITY_REQUIRED',403);
select pg_temp.stage_status('select eps.specs_stage_assert(false,''LEASE_INVALID'')','LEASE_INVALID',403);
set local role authenticated;
select pg_temp.stage_expect('select eps.job_requester_active(''7a960000-0000-4000-8000-000000000001'')','42501');
select pg_temp.stage_expect('select pg_temp.stage_claim()','42501');
set local role service_role;
select pg_temp.stage_expect('select eps.job_requester_active(''7a960000-0000-4000-8000-000000000001'')','42501');
select pg_temp.stage_expect('select pg_temp.stage_claim()','42501');
set local role postgres;
set local role eps_specs_stage_owner;
do $$ begin
 perform eps.specs_stage_lock(current_setting('eps.stage.job')::uuid);
end $$;
select pg_temp.stage_expect('update eps.workspaces set row_version=row_version+1 where id=''7c960000-0000-4000-8000-000000000001''','42501');
select pg_temp.stage_expect('update eps.specs set row_version=row_version+1 where processing_job_id=current_setting(''eps.stage.job'')::uuid','42501');
set local role postgres;
set local role eps_jobs_executor;
select pg_temp.stage_expect('select eps.job_requester_active(''7a960000-0000-4000-8000-000000000001'')','42501');
select pg_temp.stage_expect('select * from eps.jobs','42501');
select pg_temp.stage_expect('select eps.specs_stage_lock(current_setting(''eps.stage.job'')::uuid)','42501');
do $$ declare lease jsonb; receipt jsonb; source jsonb; event jsonb; begin
 lease:=pg_temp.stage_claim(); perform set_config('eps.stage.lease',lease::text,true);
 perform pg_temp.stage_assert(lease->>'stage'='prepare_document' and lease->'already_completed'='false','first claim');
 source:=eps.get_specs_stage_input((lease->>'job_id')::uuid,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 perform pg_temp.stage_assert(source->>'source_kind'='pasted_text' and source->'source_asset_id'='null'
  and source->>'source_text'=chr(65279)||E'Synthetic actor 😀\r\n  continued\r\n\r\n\t\r\nثلاثة ممثلين'
  and source->>'input_hash'=current_setting('eps.stage.hash') and source->>'correlation_id'='synthetic-stage-test','scoped original handoff');
 perform pg_temp.stage_expect('select pg_temp.stage_claim()','JOB_ALREADY_RUNNING');
 event:=pg_temp.stage_event(lease,10,'progress','{"progress_completed":2,"progress_total":10}');
 receipt:=eps.record_job_event(event); perform pg_temp.stage_assert(receipt->'applied'='true','progress applied');
 receipt:=eps.record_job_event(event); perform pg_temp.stage_assert(receipt->'duplicate'='true' and receipt->'applied'='false','exact duplicate');
 perform set_config('eps.stage.event',event::text,true);
 perform pg_temp.stage_expect('select eps.record_job_event(current_setting(''eps.stage.event'')::jsonb||''{"result":{"progress_completed":3,"progress_total":10}}'')','EVENT_ID_CONFLICT');
 perform pg_temp.stage_expect('select eps.record_job_event(current_setting(''eps.stage.event'')::jsonb||''{"event_id":"other-same-sequence"}'')','EVENT_SEQUENCE_CONFLICT');
 receipt:=eps.record_job_event(pg_temp.stage_event(lease,20,'heartbeat')); perform pg_temp.stage_assert(receipt->'applied'='true','heartbeat');
 receipt:=eps.record_job_event(pg_temp.stage_event(lease,15,'progress','{"progress_completed":0,"progress_total":10}'));
 perform pg_temp.stage_assert(receipt->'stale'='true' and receipt->'applied'='false','older unused sequence ignored');
 event:=pg_temp.stage_event(lease,30,'succeeded','{"source_asset_id":null,"text_asset_id":null,"page_assets":[],"paragraph_count":2,"extraction_method":"plain_text","warnings":[]}','document-preparation.v1');
 receipt:=eps.record_job_event(event); perform pg_temp.stage_assert(receipt->>'job_status'='queued','prepare transition');
 receipt:=eps.record_job_event(event); perform pg_temp.stage_assert(receipt->'duplicate'='true','terminal event replay');
 perform set_config('eps.stage.next','extract_specs',true);
 lease:=pg_temp.stage_claim(); perform set_config('eps.stage.lease',lease::text,true);
 source:=eps.get_specs_stage_input((lease->>'job_id')::uuid,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 perform pg_temp.stage_assert(jsonb_array_length(source->'paragraphs')=2 and source#>>'{paragraphs,0,start}'='0'
  and source#>>'{paragraphs,0,end}'='31' and source#>>'{paragraphs,1,start}'='35','LF/UTF16 paragraph map');
 perform set_config('eps.stage.prepared',source::text,true);
end $$;
set local role postgres;
select pg_temp.stage_assert((select stage='extract_specs' and attempt=2 and progress_completed=0 and last_event_sequence=0
 and completed_stages#>>'{0,result,stage_output_id}' is not null and completed_stages::text not like '%Synthetic actor%'
 and input::text not like '%Synthetic actor%' from eps.jobs where id=current_setting('eps.stage.job')::uuid),'refs-only job metadata');
select pg_temp.stage_assert((select count(*)=2 from eps.outbox_events where job_id=current_setting('eps.stage.job')::uuid),'atomic next outbox');
select pg_temp.stage_assert((select eps.specs_stage_prepared_hash(paragraphs)='541a74ec53bed2d2911f39dcfcce8fc4373ec4c82c11861ffd51f683897fc0ef' from eps.specs_stage_payloads where job_id=current_setting('eps.stage.job')::uuid and stage='prepare_document'),'known exact JS adapter JSON fingerprint');
-- Exact adapter envelope, synthetic provider metadata, never a provider call.
create function pg_temp.stage_output() returns jsonb language plpgsql as $$
declare job eps.jobs; paragraphs jsonb; body jsonb; begin
 select * into strict job from eps.jobs where id=current_setting('eps.stage.job')::uuid;
 select p.paragraphs into strict paragraphs from eps.specs_stage_payloads p where p.job_id=job.id and stage='prepare_document';
 body:=jsonb_build_object('schema_version','1.0','source_asset_id',null,'source_language_codes',jsonb_build_array('en','ar'),
  'general_instructions','Synthetic instructions','clarifications','[]'::jsonb,'roles',jsonb_build_array(jsonb_build_object(
   'source_role_key','synthetic-role','name',null,'headcount',null,'category',null,'requirements',
   '{"age_range":null,"gender_requirement":null,"appearance_performance":null,"languages":[],"accents":[],"skills":[],"scene_references":[],"shoot_dates":[],"location":null,"availability_requirements":null,"other_instructions":null}'::jsonb,
   'evidence',jsonb_build_array(jsonb_build_object('asset_id',null,'page',null,'paragraph',0,'segment_index',null,'start_ms',null,'end_ms',null,'quote','Synthetic actor')),'clarifications','[]'::jsonb)));
 return jsonb_build_object('result',body,'metadata',jsonb_build_object('provider','openai','sdk_version','7.45.1','requested_model','synthetic-model','resolved_model','synthetic-model',
  'response_id','synthetic-response','request_id',null,'correlation_id',job.correlation_id,'input_sha256',job.input_hash,'prepared_source_sha256',eps.specs_stage_prepared_hash(paragraphs),
  'prompt_version','spec_extract_v1.0.0','prompt_sha256','ab03fd026edb3d139fd93fdd51cb475474d6c4e3c8f6395b65014574e7e29eee','schema_version','1.0',
  'schema_sha256','e8ffee51eee20f687abbfc12c2476248ccb5a59c1122fde418bc89db3ff58085','provider_schema_sha256','d73a11450f2714c5649ab9a663f0a3483f68feefd1f482bc62575a9a608a1216',
  'usage',jsonb_build_object('input_tokens',12,'output_tokens',8,'total_tokens',20)));
end $$;
do $$ begin perform set_config('eps.stage.output',pg_temp.stage_output()::text,true); end $$;
set local role eps_jobs_executor;
do $$ declare lease jsonb:=current_setting('eps.stage.lease')::jsonb; receipt jsonb; request jsonb; source jsonb; begin
 receipt:=eps.record_job_event(pg_temp.stage_event(lease,1,'succeeded',current_setting('eps.stage.output')::jsonb,'specs-extraction-stage.v1'));
 perform pg_temp.stage_assert(receipt->>'job_status'='queued','extract typed success');
 perform set_config('eps.stage.next','apply_specs',true); lease:=pg_temp.stage_claim(); perform set_config('eps.stage.lease',lease::text,true);
 source:=eps.get_specs_stage_input((lease->>'job_id')::uuid,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 request:=jsonb_build_object('specs_id',source->>'specs_id','workspace_id',source->>'workspace_id');
 receipt:=eps.record_job_event(pg_temp.stage_event(lease,1,'succeeded',request,'specs-application.v1'));
 perform pg_temp.stage_assert(receipt->>'job_status'='succeeded','initial apply succeeds');
 receipt:=eps.record_job_event(pg_temp.stage_event(lease,1,'succeeded',request,'specs-application.v1'));
 perform pg_temp.stage_assert(receipt->'duplicate'='true' and receipt->'applied'='false','apply exact replay');
 lease:=pg_temp.stage_claim(); perform pg_temp.stage_assert(lease->'already_completed'='true' and lease->>'lease_token'='','completed claim does not rerun');
end $$;
set local role postgres;
select pg_temp.stage_assert((select count(*)=1 from eps.roles where workspace_id='7c960000-0000-4000-8000-000000000001')
 and (select count(*)=1 from eps.slots where workspace_id='7c960000-0000-4000-8000-000000000001' and provisional and label='Slot 1')
 and (select row_version=9 and draft_revision=8 from eps.workspaces where id='7c960000-0000-4000-8000-000000000001'),'one initial role/provisional slot/draft revision');
select pg_temp.stage_assert((select count(*)=1 from eps.audit_events where principal_id='7a960000-0000-4000-8000-000000000001' and action='jobs.apply_specs')
 and (select count(*)=3 from eps.outbox_events where job_id=current_setting('eps.stage.job')::uuid),'one application effect and no terminal dispatch');
select pg_temp.stage_assert((select source_text=current_setting('eps.stage.original_spec')::jsonb->>'source_text'
 and source_row_version=2 and normalized_instructions='Synthetic instructions' and source_extraction->>'schema_version'='1.0'
 from eps.specs where processing_job_id=current_setting('eps.stage.job')::uuid),'original preserved and extraction retained');
do $$ begin perform set_config('eps.stage.positive_job',current_setting('eps.stage.job'),true); end $$;

-- Retried claims get a new attempt UUID/token; expired callbacks cannot publish.
do $$ declare job_id uuid; begin
 job_id:=pg_temp.stage_new_job(); perform set_config('eps.stage.job',job_id::text,true);
 perform set_config('eps.stage.hash',(select input_hash from eps.jobs where id=job_id),true);
 perform set_config('eps.stage.next','prepare_document',true);
end $$;
set local role eps_jobs_executor;
do $$ begin perform set_config('eps.stage.old_lease',pg_temp.stage_claim()::text,true); end $$;
set local role postgres;
update eps.jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=current_setting('eps.stage.job')::uuid;
set local role eps_jobs_executor;
select pg_temp.stage_assert(eps.recover_job_stages(1)->>'recovered'='1','expired stage requeued');
do $$ declare receipt jsonb; begin
 receipt:=eps.record_job_event(pg_temp.stage_event(current_setting('eps.stage.old_lease')::jsonb,1,'heartbeat'));
 perform pg_temp.stage_assert(receipt->'stale'='true','expired callback stale');
end $$;
set local role postgres;
update eps.jobs set available_at=clock_timestamp() where id=current_setting('eps.stage.job')::uuid;
set local role eps_jobs_executor;
do $$ declare lease jsonb; old_lease jsonb:=current_setting('eps.stage.old_lease')::jsonb; receipt jsonb; begin
 lease:=pg_temp.stage_claim(); perform set_config('eps.stage.lease',lease::text,true);
 perform pg_temp.stage_assert(lease->>'attempt_id'<>old_lease->>'attempt_id' and lease->>'lease_token'<>old_lease->>'lease_token','new fence after recovery');
 perform set_config('eps.stage.bad_event',(pg_temp.stage_event(lease,1,'heartbeat')||jsonb_build_object('lease_token',old_lease->>'lease_token'))::text,true);
 perform pg_temp.stage_expect('select eps.record_job_event(current_setting(''eps.stage.bad_event'')::jsonb)','LEASE_INVALID');
 receipt:=eps.record_job_event(pg_temp.stage_event(old_lease,1,'heartbeat'));
 perform pg_temp.stage_assert(receipt->'stale'='true','old attempt fenced');
 receipt:=eps.record_job_event(pg_temp.stage_event(lease,1,'failed','{"code":"PROVIDER_RATE_LIMITED","message":"DO NOT STORE THIS RAW PROVIDER BODY","details":{"credential":"DO NOT STORE","retry_after_seconds":12},"retryable":true}'));
 perform pg_temp.stage_assert(receipt->>'job_status'='queued','retryable error requeued');
end $$;
set local role postgres;
select pg_temp.stage_assert((select error->>'code'='PROVIDER_RATE_LIMITED' and error#>>'{details,retry_after_seconds}'='12'
 and error::text not like '%DO NOT STORE%' and available_at>=updated_at+interval '12 seconds' from eps.jobs where id=current_setting('eps.stage.job')::uuid),'safe error/hint persisted');
update eps.jobs set available_at=clock_timestamp() where id=current_setting('eps.stage.job')::uuid;
set local role eps_jobs_executor;
do $$ declare lease jsonb; receipt jsonb; begin
 lease:=pg_temp.stage_claim(); receipt:=eps.record_job_event(pg_temp.stage_event(lease,1,'failed','{"code":"DEPENDENCY_UNAVAILABLE","message":"private raw body","details":{},"retryable":true}'));
 perform pg_temp.stage_assert(receipt->>'job_status'='failed','three-attempt budget terminal');
end $$;
set local role postgres;
select pg_temp.stage_assert((select attempt=3 and error->>'code'='RETRY_EXHAUSTED' and error->'retryable'='false' from eps.jobs where id=current_setting('eps.stage.job')::uuid),'retry exhausted after stage3');

-- Current requester authority is checked on fresh commands, including duplicate
-- receipt reads. A callback identity field is never accepted as authorization.
do $$ declare job_id uuid; begin
 job_id:=pg_temp.stage_new_job(); perform set_config('eps.stage.job',job_id::text,true);
 perform set_config('eps.stage.hash',(select input_hash from eps.jobs where id=job_id),true);
end $$;
set local role eps_jobs_executor;
do $$ declare lease jsonb; event jsonb; begin
 lease:=pg_temp.stage_claim(); perform set_config('eps.stage.lease',lease::text,true);
 event:=pg_temp.stage_event(lease,1,'heartbeat'); perform eps.record_job_event(event);
 perform set_config('eps.stage.event',event::text,true);
 perform pg_temp.stage_expect('select eps.record_job_event(current_setting(''eps.stage.event'')::jsonb||''{"requested_by":"7a960000-0000-4000-8000-000000000001"}'')','INVALID_REQUEST');
end $$;
set local role postgres;
update public.project_memberships set active=false where principal_id='7a960000-0000-4000-8000-000000000001';
set local role eps_jobs_executor;
select pg_temp.stage_expect('select eps.record_job_event(current_setting(''eps.stage.event'')::jsonb)','CAPABILITY_REQUIRED');
select pg_temp.stage_expect('select eps.get_specs_stage_input((current_setting(''eps.stage.lease'')::jsonb->>''job_id'')::uuid,(current_setting(''eps.stage.lease'')::jsonb->>''attempt_id'')::uuid,current_setting(''eps.stage.lease'')::jsonb->>''lease_token'')','CAPABILITY_REQUIRED');
set local role postgres;
update public.project_memberships set active=true where principal_id='7a960000-0000-4000-8000-000000000001';
update eps.jobs set status='cancelled',cancel_requested_at=clock_timestamp(),lease_token_digest=null,lease_expires_at=null where id=current_setting('eps.stage.job')::uuid;
set local role eps_jobs_executor;
do $$ declare receipt jsonb; begin
 receipt:=eps.record_job_event(pg_temp.stage_event(current_setting('eps.stage.lease')::jsonb,2,'succeeded',
  '{"source_asset_id":null,"text_asset_id":null,"page_assets":[],"paragraph_count":2,"extraction_method":"plain_text","warnings":[]}','document-preparation.v1'));
 perform pg_temp.stage_assert(receipt->'stale'='true','cancel prevents publication');
 perform pg_temp.stage_expect('select pg_temp.stage_claim()','JOB_CANCELLED');
end $$;
set local role postgres;

-- Fresh output validation rejects guessed evidence/metadata and fake assets.
select pg_temp.stage_expect('select eps.specs_stage_extract(jsonb_set(current_setting(''eps.stage.output'')::jsonb->''result'',''{roles,0,evidence,0,quote}'',''"invented quotation"''),(current_setting(''eps.stage.prepared'')::jsonb)->''paragraphs'')','RESULT_INVALID');
select pg_temp.stage_expect('select eps.specs_stage_extract(jsonb_set(current_setting(''eps.stage.output'')::jsonb->''result'',''{roles,0,headcount}'',''0''),(current_setting(''eps.stage.prepared'')::jsonb)->''paragraphs'')','RESULT_INVALID');
select pg_temp.stage_expect('select eps.specs_stage_extract(jsonb_set(current_setting(''eps.stage.output'')::jsonb->''result'',''{source_asset_id}'',''"fake-asset"''),(current_setting(''eps.stage.prepared'')::jsonb)->''paragraphs'')','RESULT_INVALID');
do $$ declare blank text; reference jsonb; begin
 foreach blank in array array[' ',chr(160),chr(65279),chr(11)||chr(12)] loop
  reference:=jsonb_build_object('asset_id',null,'page',null,'paragraph',0,'segment_index',null,'start_ms',null,'end_ms',null,'quote',blank);
  perform set_config('eps.stage.blank_ref',reference::text,true);
  perform set_config('eps.stage.blank_paragraph',jsonb_build_array(jsonb_build_object('index',0,'page',null,'text','source'||blank||'text'))::text,true);
  perform pg_temp.stage_expect('select eps.specs_stage_reference(current_setting(''eps.stage.blank_ref'')::jsonb,current_setting(''eps.stage.blank_paragraph'')::jsonb)','RESULT_INVALID');
  perform set_config('eps.stage.blank_key',jsonb_set(current_setting('eps.stage.output')::jsonb->'result','{roles,0,source_role_key}',to_jsonb(blank))::text,true);
  perform pg_temp.stage_expect('select eps.specs_stage_extract(current_setting(''eps.stage.blank_key'')::jsonb,current_setting(''eps.stage.prepared'')::jsonb->''paragraphs'')','RESULT_INVALID');
 end loop;
 perform eps.specs_stage_reference(jsonb_set(reference,'{quote}','null'),current_setting('eps.stage.blank_paragraph')::jsonb);
 perform pg_temp.stage_assert(eps.specs_stage_nonblank(chr(133)) and eps.specs_stage_nonblank(chr(8203)),'ECMAScript excludes NEL and zero-width space');
end $$;
select pg_temp.stage_expect('select eps.specs_stage_metadata(jsonb_set(current_setting(''eps.stage.output'')::jsonb->''metadata'',''{prepared_source_sha256}'',to_jsonb(repeat(''d'',64))),j,(current_setting(''eps.stage.prepared'')::jsonb)->''paragraphs'') from eps.jobs j where id=current_setting(''eps.stage.job'')::uuid','RESULT_INVALID');
select pg_temp.stage_expect('select eps.specs_stage_metadata(jsonb_set(current_setting(''eps.stage.output'')::jsonb->''metadata'',''{prompt_sha256}'',to_jsonb(repeat(''a'',64))),j,(current_setting(''eps.stage.prepared'')::jsonb)->''paragraphs'') from eps.jobs j where id=current_setting(''eps.stage.positive_job'')::uuid','RESULT_INVALID');
select pg_temp.stage_expect('select eps.specs_stage_metadata(jsonb_set(current_setting(''eps.stage.output'')::jsonb->''metadata'',''{schema_sha256}'',to_jsonb(repeat(''b'',64))),j,(current_setting(''eps.stage.prepared'')::jsonb)->''paragraphs'') from eps.jobs j where id=current_setting(''eps.stage.positive_job'')::uuid','RESULT_INVALID');

-- Suppressed queue/event/payload writes must roll back job state and all sibling
-- effects. Fixed synthetic triggers are confined to this rolled-back fixture.
create function pg_temp.stage_suppress() returns trigger language plpgsql as $$ begin return null; end $$;
do $$ declare job_id uuid; begin
 job_id:=pg_temp.stage_new_job(); perform set_config('eps.stage.job',job_id::text,true);
 perform set_config('eps.stage.hash',(select input_hash from eps.jobs where id=job_id),true);
end $$;
set local role eps_jobs_executor;
do $$ begin perform set_config('eps.stage.lease',pg_temp.stage_claim()::text,true); end $$;
set local role postgres;
do $$ begin perform set_config('eps.stage.before',jsonb_build_object('job',(select to_jsonb(j) from eps.jobs j where id=current_setting('eps.stage.job')::uuid),
 'outbox',(select count(*) from eps.outbox_events),'events',(select count(*) from eps.job_events),'payloads',(select count(*) from eps.specs_stage_payloads))::text,true); end $$;
create trigger synthetic_suppress_stage_event before insert on eps.job_events for each row execute function pg_temp.stage_suppress();
set local role eps_jobs_executor;
select pg_temp.stage_expect('select eps.record_job_event(pg_temp.stage_event(current_setting(''eps.stage.lease'')::jsonb,1,''heartbeat''))','STAGE_STATE_INVALID');
set local role postgres;
drop trigger synthetic_suppress_stage_event on eps.job_events;
create trigger synthetic_suppress_stage_outbox before insert on eps.outbox_events for each row execute function pg_temp.stage_suppress();
set local role eps_jobs_executor;
select pg_temp.stage_expect('select eps.record_job_event(pg_temp.stage_event(current_setting(''eps.stage.lease'')::jsonb,1,''succeeded'',''{"source_asset_id":null,"text_asset_id":null,"page_assets":[],"paragraph_count":2,"extraction_method":"plain_text","warnings":[]}'',''document-preparation.v1''))','STAGE_STATE_INVALID');
set local role postgres;
drop trigger synthetic_suppress_stage_outbox on eps.outbox_events;
create trigger synthetic_suppress_stage_payload before insert on eps.specs_stage_payloads for each row execute function pg_temp.stage_suppress();
set local role eps_jobs_executor;
select pg_temp.stage_expect('select eps.record_job_event(pg_temp.stage_event(current_setting(''eps.stage.lease'')::jsonb,1,''succeeded'',''{"source_asset_id":null,"text_asset_id":null,"page_assets":[],"paragraph_count":2,"extraction_method":"plain_text","warnings":[]}'',''document-preparation.v1''))','STAGE_STATE_INVALID');
set local role postgres;
drop trigger synthetic_suppress_stage_payload on eps.specs_stage_payloads;
select pg_temp.stage_assert(current_setting('eps.stage.before')::jsonb=jsonb_build_object('job',(select to_jsonb(j) from eps.jobs j where id=current_setting('eps.stage.job')::uuid),
 'outbox',(select count(*) from eps.outbox_events),'events',(select count(*) from eps.job_events),'payloads',(select count(*) from eps.specs_stage_payloads)),'suppressed write rollback exact');

-- A second pristine workspace tests atomic publication failure. Private payload
-- copies below are deliberately synthetic SQL staging, not provider acceptance.
insert into public.projects(id,name) values('7b960000-0000-4000-8000-000000000002','Synthetic apply rollback');
insert into public.project_memberships(project_id,principal_id,can_write) values('7b960000-0000-4000-8000-000000000002','7a960000-0000-4000-8000-000000000001',true);
insert into eps.workspaces(id,project_id) values('7c960000-0000-4000-8000-000000000002','7b960000-0000-4000-8000-000000000002');
update eps.specs set source_text=current_setting('eps.stage.original_spec')::jsonb->>'source_text',source_row_version=2 where workspace_id='7c960000-0000-4000-8000-000000000002';
create function pg_temp.stage_prepare_apply(p_workspace uuid) returns uuid language plpgsql as $$ declare created_job_id uuid; fingerprint text; begin
 created_job_id:=pg_temp.stage_new_job(p_workspace); select input_hash into fingerprint from eps.jobs where id=created_job_id;
 insert into eps.specs_stage_payloads(job_id,stage,attempt_id,input_hash,result_schema,result,prepared_text,paragraphs)
 select created_job_id,p.stage,gen_random_uuid(),fingerprint,p.result_schema,
  case when p.stage='extract_specs' then jsonb_set(p.result,'{metadata,input_sha256}',to_jsonb(fingerprint)) else p.result end,p.prepared_text,p.paragraphs
 from eps.specs_stage_payloads p where p.job_id=current_setting('eps.stage.positive_job')::uuid;
 update eps.jobs set stage='apply_specs' where id=created_job_id;
 perform set_config('eps.stage.job',created_job_id::text,true); perform set_config('eps.stage.hash',fingerprint,true); perform set_config('eps.stage.next','apply_specs',true);
 perform set_config('eps.stage.workspace',p_workspace::text,true);
 perform set_config('eps.stage.spec',(select resource_id::text from eps.jobs where id=created_job_id),true); return created_job_id;
end $$;
create function pg_temp.stage_apply_event() returns jsonb language sql as $$
 select pg_temp.stage_event(current_setting('eps.stage.lease')::jsonb,1,'succeeded',jsonb_build_object('specs_id',current_setting('eps.stage.spec'),'workspace_id',current_setting('eps.stage.workspace')),'specs-application.v1')
$$;
create function pg_temp.stage_snapshot() returns jsonb language sql stable as $$
 select jsonb_build_object('workspaces',(select jsonb_agg(to_jsonb(v) order by id) from eps.workspaces v where id::text like '7c960000-%'),
  'specs',(select jsonb_agg(to_jsonb(v) order by id) from eps.specs v where workspace_id::text like '7c960000-%'),
  'roles',(select jsonb_agg(to_jsonb(v) order by id) from eps.roles v where workspace_id::text like '7c960000-%'),
  'slots',(select jsonb_agg(to_jsonb(v) order by id) from eps.slots v where workspace_id::text like '7c960000-%'),
  'jobs',(select jsonb_agg(to_jsonb(v) order by id) from eps.jobs v where workspace_id::text like '7c960000-%'),
  'outbox',(select jsonb_agg(to_jsonb(v) order by id) from eps.outbox_events v where job_id in(select id from eps.jobs where workspace_id::text like '7c960000-%')),
  'events',(select jsonb_agg(to_jsonb(v) order by job_id,attempt_id,event_id) from eps.job_events v where job_id in(select id from eps.jobs where workspace_id::text like '7c960000-%')),
  'audit',(select jsonb_agg(to_jsonb(v) order by id) from eps.audit_events v where principal_id='7a960000-0000-4000-8000-000000000001'),
  'payloads',(select jsonb_agg(to_jsonb(v) order by id) from eps.specs_stage_payloads v))
$$;
do $$ begin perform pg_temp.stage_prepare_apply('7c960000-0000-4000-8000-000000000002'); end $$;
set local role eps_jobs_executor;
do $$ begin perform set_config('eps.stage.lease',pg_temp.stage_claim()::text,true); end $$;
set local role postgres;
do $$ declare target record; original jsonb; begin
 for target in select * from (values('eps.roles','insert'),('eps.slots','insert'),('eps.specs','update'),('eps.workspaces','update'),('eps.audit_events','insert'),('eps.jobs','update')) entries(relation_name,operation) loop
  original:=pg_temp.stage_snapshot();
  execute format('create trigger synthetic_suppress_apply before %s on %s for each row execute function pg_temp.stage_suppress()',target.operation,target.relation_name);
  execute 'set local role eps_jobs_executor';
  perform pg_temp.stage_expect('select eps.record_job_event(pg_temp.stage_apply_event())',case when target.relation_name='eps.jobs' then 'STALE_STAGE_LEASE' else 'STAGE_STATE_INVALID' end);
  execute 'set local role postgres';
  execute format('drop trigger synthetic_suppress_apply on %s',target.relation_name);
  perform pg_temp.stage_assert(original=pg_temp.stage_snapshot(),'all apply effects rollback after suppressed '||target.relation_name);
 end loop;
end $$;
-- A manual edit after claim must become INPUT_CHANGED, retaining staged evidence.
create function pg_temp.stage_modify() returns trigger language plpgsql as $$ begin
 if tg_table_name='roles' then new.name:='Synthetic altered role';
 elsif tg_table_name='slots' then new.label:='Synthetic altered slot';
 elsif tg_table_name='specs' then new.normalized_instructions:='Synthetic altered normalized text';
 else new.draft_revision:=old.draft_revision+2; end if;
 return new;
end $$;
do $$ declare target record; original jsonb; begin
 for target in select * from (values('eps.roles','insert'),('eps.slots','insert'),('eps.specs','update'),('eps.workspaces','update')) entries(relation_name,operation) loop
  original:=pg_temp.stage_snapshot();
  execute format('create trigger synthetic_modify_apply before %s on %s for each row execute function pg_temp.stage_modify()',target.operation,target.relation_name);
  execute 'set local role eps_jobs_executor'; perform pg_temp.stage_expect('select eps.record_job_event(pg_temp.stage_apply_event())','STAGE_STATE_INVALID'); execute 'set local role postgres';
  execute format('drop trigger synthetic_modify_apply on %s',target.relation_name);
  perform pg_temp.stage_assert(original=pg_temp.stage_snapshot(),'altered apply fields rollback '||target.relation_name);
 end loop;
end $$;
-- Expiry between fact writes and final job transition must roll back all facts.
create function pg_temp.stage_expire() returns trigger language plpgsql security definer set search_path='' as $$ begin
 update eps.jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=current_setting('eps.stage.job')::uuid; return new;
end $$;
do $$ begin perform set_config('eps.stage.before',pg_temp.stage_snapshot()::text,true); end $$;
create trigger synthetic_expire_apply after insert on eps.audit_events for each row execute function pg_temp.stage_expire();
set local role eps_jobs_executor;
select pg_temp.stage_expect('select eps.record_job_event(pg_temp.stage_apply_event())','STALE_STAGE_LEASE');
set local role postgres;
drop trigger synthetic_expire_apply on eps.audit_events;
select pg_temp.stage_assert(current_setting('eps.stage.before')::jsonb=pg_temp.stage_snapshot(),'expiry after writes rolls back all effects');
update eps.workspaces set row_version=row_version+1,draft_revision=draft_revision+1 where id='7c960000-0000-4000-8000-000000000002';
set local role eps_jobs_executor;
do $$ declare receipt jsonb; begin
 receipt:=eps.record_job_event(pg_temp.stage_apply_event());
 perform pg_temp.stage_assert(receipt->>'job_status'='waiting_for_input','late apply preserves manual draft');
end $$;
set local role postgres;
select pg_temp.stage_assert(not exists(select 1 from eps.roles where workspace_id='7c960000-0000-4000-8000-000000000002')
 and (select source_extraction is null from eps.specs where workspace_id='7c960000-0000-4000-8000-000000000002')
 and (select count(*)=2 from eps.specs_stage_payloads where job_id=current_setting('eps.stage.job')::uuid)
 and (select error->>'code'='INPUT_CHANGED' from eps.jobs where id=current_setting('eps.stage.job')::uuid),'changed draft retains private extraction without facts');
-- Even edits predating submission are preserved under an unchanged frozen WS.
update eps.specs set normalized_instructions='Synthetic preexisting manual instructions' where workspace_id='7c960000-0000-4000-8000-000000000002';
do $$ begin perform pg_temp.stage_prepare_apply('7c960000-0000-4000-8000-000000000002'); end $$;
set local role eps_jobs_executor;
do $$ declare receipt jsonb; begin
 perform set_config('eps.stage.lease',pg_temp.stage_claim()::text,true); receipt:=eps.record_job_event(pg_temp.stage_apply_event());
 perform pg_temp.stage_assert(receipt->>'job_status'='waiting_for_input','preexisting manual facts preserve');
end $$;
set local role postgres;
select pg_temp.stage_assert((select normalized_instructions='Synthetic preexisting manual instructions' and source_extraction is null
 from eps.specs where workspace_id='7c960000-0000-4000-8000-000000000002'),'manual text unmodified');

-- Invalid schema/output is terminal rather than a success-shaped sample result.
do $$ declare job_id uuid; begin
 job_id:=pg_temp.stage_new_job(); perform set_config('eps.stage.job',job_id::text,true);
 perform set_config('eps.stage.hash',(select input_hash from eps.jobs where id=job_id),true); perform set_config('eps.stage.next','prepare_document',true);
end $$;
set local role eps_jobs_executor;
do $$ declare lease jsonb; receipt jsonb; begin
 lease:=pg_temp.stage_claim();
 receipt:=eps.record_job_event(pg_temp.stage_event(lease,1,'succeeded','{"source_asset_id":null,"text_asset_id":null,"page_assets":[],"paragraph_count":999,"extraction_method":"plain_text","warnings":[]}','document-preparation.v1'));
 perform pg_temp.stage_assert(receipt->>'job_status'='failed','invalid preparation fails');
end $$;
set local role postgres;
select pg_temp.stage_assert((select error->>'code'='RESULT_INVALID' and completed_stages='[]' from eps.jobs where id=current_setting('eps.stage.job')::uuid)
 and not exists(select 1 from eps.specs_stage_payloads where job_id=current_setting('eps.stage.job')::uuid),'invalid output never staged');

-- Schema-valid1001-slot extraction exceeds the same bounded domain allocation
-- budget as manual edits. Record a durable nonretryable RESULT_INVALID once.
insert into public.projects(id,name) values('7b960000-0000-4000-8000-000000000003','Synthetic bounded allocation');
insert into public.project_memberships(project_id,principal_id,can_write) values('7b960000-0000-4000-8000-000000000003','7a960000-0000-4000-8000-000000000001',true);
insert into eps.workspaces(id,project_id) values('7c960000-0000-4000-8000-000000000003','7b960000-0000-4000-8000-000000000003');
update eps.specs set source_text=current_setting('eps.stage.original_spec')::jsonb->>'source_text',source_row_version=2 where workspace_id='7c960000-0000-4000-8000-000000000003';
do $$ begin perform pg_temp.stage_prepare_apply('7c960000-0000-4000-8000-000000000003'); end $$;
update eps.specs_stage_payloads set result=jsonb_set(result,'{result,roles,0,headcount}','1001') where job_id=current_setting('eps.stage.job')::uuid and stage='extract_specs';
set local role eps_jobs_executor;
do $$ declare receipt jsonb; begin
 perform set_config('eps.stage.lease',pg_temp.stage_claim()::text,true);
 receipt:=eps.record_job_event(pg_temp.stage_apply_event());
 perform pg_temp.stage_assert(receipt->>'job_status'='failed' and receipt->'applied'='true','allocation invalid callback is durably failed');
 receipt:=eps.record_job_event(pg_temp.stage_apply_event()); perform pg_temp.stage_assert(receipt->'duplicate'='true','allocation failure exact replay');
 perform pg_temp.stage_assert(eps.recover_job_stages(100)->>'recovered'='0','terminal allocation failure does not recover/retry');
end $$;
set local role postgres;
select pg_temp.stage_assert((select error->>'code'='RESULT_INVALID' and error->'retryable'='false' from eps.jobs where id=current_setting('eps.stage.job')::uuid)
 and not exists(select 1 from eps.roles where workspace_id='7c960000-0000-4000-8000-000000000003')
 and not exists(select 1 from eps.slots where workspace_id='7c960000-0000-4000-8000-000000000003')
 and (select source_extraction is null and normalized_instructions is null and row_version=1 from eps.specs where workspace_id='7c960000-0000-4000-8000-000000000003')
 and (select count(*)=1 from eps.outbox_events where job_id=current_setting('eps.stage.job')::uuid)
 and (select count(*)=1 from eps.job_events where job_id=current_setting('eps.stage.job')::uuid)
 and (select count(*)=2 from eps.specs_stage_payloads where job_id=current_setting('eps.stage.job')::uuid),'bounded allocation preserves private staging and all facts without retry dispatch');
