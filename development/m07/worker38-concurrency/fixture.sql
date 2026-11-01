-- Synthetic LOCAL SQL setup only. Never executed by this source author.
-- The new parent proof also verifies the exact database name/OID/run marker.
-- No worker, storage object, provider, source file or stage is processed here.
set local role postgres;
do $worker38_fixture_target$begin
 if current_user<>'postgres'
 or current_database()!~'^eps_m07_r33_source_[a-f0-9]{32}$'
 or current_setting('eps.worker38.concurrency',true)is distinct from'owned-local-v1'
 or(pg_control_system()).system_identifier::text<>'7701520506262638626'
 or(select count(*)from supabase_migrations.schema_migrations)<>38
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261101110939'
 or to_regprocedure('public.eps_submit_specs(uuid,jsonb,text)')is null
 or to_regprocedure('public.eps_retry_job(uuid,jsonb,text)')is null
 or to_regnamespace('eps_worker38_conc')is not null
 or exists(select 1 from auth.users where id::text like'b9380001-%')
 or exists(select 1 from public.projects where id::text like'b9380002-%')
 or exists(select 1 from eps.workspaces where id::text like'b9380003-%')
 or exists(select 1 from eps.jobs where id::text like'b9380006-%')
 then raise exception'WORKER38_OWNED_EMPTY_FIXTURE_REQUIRED';end if;
end$worker38_fixture_target$;

insert into auth.users(id,is_anonymous,deleted_at,banned_until)
 values('b9380001-0000-4000-8000-000000000001',false,null,null);
insert into public.projects(id,name)values
 ('b9380002-0000-4000-8000-000000000001','Synthetic worker38 rollback intake'),
 ('b9380002-0000-4000-8000-000000000002','Synthetic worker38 commit-race intake');
insert into public.project_memberships(project_id,principal_id,can_write)values
 ('b9380002-0000-4000-8000-000000000001','b9380001-0000-4000-8000-000000000001',true),
 ('b9380002-0000-4000-8000-000000000002','b9380001-0000-4000-8000-000000000001',true);
insert into public.app_capability_grants(principal_id,capability)
 select'b9380001-0000-4000-8000-000000000001'::uuid,capability
 from unnest(array['projects.read','workspaces.read','workspaces.write','operations.read','operations.retry'])capability;
-- The actual workspace INSERT trigger creates each empty Spec. Do not seed or
-- replace its source, source version, roles, job reference or stored procedure.
insert into eps.workspaces(id,project_id)values
 ('b9380003-0000-4000-8000-000000000001','b9380002-0000-4000-8000-000000000001'),
 ('b9380003-0000-4000-8000-000000000002','b9380002-0000-4000-8000-000000000002');

-- Nonsecret synthetic version labels only; no real provider call is possible
-- in this database-only proof. The actual five existing singleton tables are
-- exercised, rather than replacement config tables or mirrored guard logic.
update eps.specs_pipeline_config set enabled=true,
 document_preparation_version='document-preparation.v1',model_version='synthetic-model',
 prompt_version='specs-v1',result_schema_version='1.0'where id=1;
update eps.candidate_asset_config set enabled=true,transcription_model='synthetic-transcription',
 extraction_model='synthetic-model',english_transcript_version='1.0'where id;
update eps.frame_extraction_config set enabled=true,
 native_image_id='sha256:795f8f7736594fb51cc0c304d85bae9d29f31861e606eec0c2a83806fff5d3b9',
 implementation_version='frame-extraction.v1'where id;
update eps.review_processing_config set enabled=true,model='synthetic-model',
 prompt_version='contextual_suggestion_v1',renderer_version='everyone-casting-fit-v1'where id;
update eps.presentation_processing_config set enabled=true,
 renderer_version='everyone-casting-pdf-v1',application_origin='http://127.0.0.1:3000'where id;

create schema eps_worker38_conc;
revoke all on schema eps_worker38_conc from public,anon,authenticated,service_role;
grant usage on schema eps_worker38_conc to authenticated;
create function eps_worker38_conc.actor()returns uuid language sql immutable security invoker set search_path=''as $$
 select'b9380001-0000-4000-8000-000000000001'::uuid
$$;
create function eps_worker38_conc.workspace(case_no integer)returns uuid language plpgsql immutable security invoker set search_path=''as $$begin
 if case_no=1 then return'b9380003-0000-4000-8000-000000000001'::uuid;
 elsif case_no=2 then return'b9380003-0000-4000-8000-000000000002'::uuid;
 else raise exception'WORKER38_FIXTURE_CASE_REQUIRED';end if;
end$$;
create function eps_worker38_conc.assert_true(condition boolean,label text)returns void language plpgsql security invoker set search_path=''as $$begin
 if condition is distinct from true then raise exception'WORKER38_ASSERTION:%',label;end if;
end$$;
create function eps_worker38_conc.set_actor()returns void language plpgsql security invoker set search_path=''as $$begin
 if current_user<>'authenticated'then raise exception'WORKER38_AUTHENTICATED_CALLER_REQUIRED';end if;
 perform set_config('request.jwt.claim.sub',eps_worker38_conc.actor()::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',eps_worker38_conc.actor(),
  'role','authenticated','is_anonymous',false)::text,true);
end$$;
create function eps_worker38_conc.submit(idempotency_key text,case_no integer default 1)returns jsonb language plpgsql security invoker set search_path=''as $$begin
 if current_user<>'authenticated'then raise exception'WORKER38_AUTHENTICATED_CALLER_REQUIRED';end if;
 -- This is the genuine intake RPC; no local copy of its config/permission rule.
 return public.eps_submit_specs(eps_worker38_conc.workspace(case_no),
  jsonb_build_object('source_text','Synthetic worker38 casting: one adult waiter. No personal data.'),idempotency_key);
end$$;
create function eps_worker38_conc.expect_submit_denied(idempotency_key text,case_no integer default 1)returns jsonb language plpgsql security invoker set search_path=''as $$begin
 begin
  perform eps_worker38_conc.submit(idempotency_key,case_no);
 exception when others then
  if sqlerrm='DEPENDENCY_UNAVAILABLE'then return jsonb_build_object('error_code','DEPENDENCY_UNAVAILABLE');end if;
  raise exception'WORKER38_WRONG_INTAKE_DENIAL:%/%',sqlstate,sqlerrm;
 end;
 raise exception'WORKER38_INTAKE_PAUSE_DENIAL_REQUIRED';
end$$;

-- Call only inside the later dedicated retry transaction, then ROLLBACK that
-- entire transaction. No failed/retry row enters the zero-work setup baseline.
create function eps_worker38_conc.seed_retry_rows()returns jsonb language plpgsql security invoker set search_path=''as $$
declare spec_id uuid;generic_input jsonb;begin
 if current_user<>'postgres'
 or current_database()!~'^eps_m07_r33_source_[a-f0-9]{32}$'
 or current_setting('eps.worker38.concurrency',true)is distinct from'owned-local-v1'
 or exists(select 1 from eps.specs_pipeline_config where enabled)
 or exists(select 1 from eps.candidate_asset_config where enabled)
 or exists(select 1 from eps.frame_extraction_config where enabled)
 or exists(select 1 from eps.review_processing_config where enabled)
 or exists(select 1 from eps.presentation_processing_config where enabled)
 or exists(select 1 from eps.jobs where id::text like'b9380006-%')
 then raise exception'WORKER38_OWNED_PAUSED_RETRY_FIXTURE_REQUIRED';end if;
 select id into strict spec_id from eps.specs where workspace_id=eps_worker38_conc.workspace(1);
 generic_input:=jsonb_build_object('schema_version','1.0','specs_id',spec_id,'source_hash',repeat('0',64),
  'source_row_version',1,'workspace_row_version',1,'configuration',jsonb_build_object(
  'document_preparation_version','document-preparation.v1','model_version','synthetic-model','prompt_version','specs-v1','result_schema_version','1.0'));
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,
  dedupe_key,status,stage,attempt,stage_attempts,error,correlation_id)values
 ('b9380006-0000-4000-8000-000000000001',eps_worker38_conc.workspace(1),eps_worker38_conc.actor(),'specs_extract',spec_id,
  generic_input,eps.jobs_hash_v1(generic_input),'eps.specs-input.pg-jsonb.v1',
  encode(sha256(convert_to('worker38-retry-generic','UTF8')),'hex'),'failed','extract_specs',2,'{"extract_specs":2}',
  '{"code":"DEPENDENCY_UNAVAILABLE","message":"Synthetic retry only","details":{},"retryable":true}','worker38-retry-generic'),
 ('b9380006-0000-4000-8000-000000000002',eps_worker38_conc.workspace(1),eps_worker38_conc.actor(),'presentation_render',
  'b9380008-0000-4000-8000-000000000002','{"synthetic_lifecycle_only":true}',repeat('2',64),'eps.presentation-job-input.cast-canonical.v1',
  encode(sha256(convert_to('worker38-retry-presentation','UTF8')),'hex'),'failed','prepare_presentation',3,'{"prepare_presentation":3}',
  '{"code":"DEPENDENCY_UNAVAILABLE","message":"Synthetic conservative lifecycle only","details":{},"retryable":false}','worker38-retry-presentation'),
 ('b9380006-0000-4000-8000-000000000003',eps_worker38_conc.workspace(1),eps_worker38_conc.actor(),'presentation_export',
  'b9380008-0000-4000-8000-000000000003','{"synthetic_lifecycle_only":true}',repeat('3',64),'eps.presentation-export-input.cast-canonical.v1',
  encode(sha256(convert_to('worker38-retry-export','UTF8')),'hex'),'failed','render_export',3,'{"render_export":3}',
  '{"code":"DEPENDENCY_UNAVAILABLE","message":"Synthetic conservative lifecycle only","details":{},"retryable":false}','worker38-retry-export');
 -- Presentation/export rows intentionally have no saved version/export. They
 -- prove conservative lifecycle counting, not actual retry eligibility, valid
 -- saved presentation lineage, rendering, or recovery acceptance.
 return jsonb_build_object('generic_job_id','b9380006-0000-4000-8000-000000000001',
  'presentation_job_id','b9380006-0000-4000-8000-000000000002',
  'export_job_id','b9380006-0000-4000-8000-000000000003',
  'presentation_export_scope','conservative_lifecycle_rows_only');
end$$;
create function eps_worker38_conc.retry_generic(idempotency_key text)returns jsonb language plpgsql security invoker set search_path=''as $$
declare result jsonb;begin
 if current_user<>'authenticated'then raise exception'WORKER38_AUTHENTICATED_CALLER_REQUIRED';end if;
 result:=public.eps_retry_job('b9380006-0000-4000-8000-000000000001',jsonb_build_object('row_version',1),idempotency_key);
 perform eps_worker38_conc.assert_true(result->>'status'='queued'and(result->>'row_version')::bigint=2,
  'actual generic retry queues despite paused processing configs');
 return result;
end$$;
revoke all on all functions in schema eps_worker38_conc from public,anon,authenticated,service_role;
grant execute on function eps_worker38_conc.actor(),eps_worker38_conc.workspace(integer),
 eps_worker38_conc.assert_true(boolean,text),eps_worker38_conc.set_actor(),eps_worker38_conc.submit(text,integer),
 eps_worker38_conc.expect_submit_denied(text,integer),eps_worker38_conc.retry_generic(text)to authenticated;

do $worker38_fixture_ready$begin
 perform eps_worker38_conc.assert_true((select count(*)=2 from eps.specs where workspace_id in(
  eps_worker38_conc.workspace(1),eps_worker38_conc.workspace(2))and row_version=1 and source_row_version=1
  and source_text is null and source_asset_id is null and processing_job_id is null),'actual initializer creates empty sources');
 perform eps_worker38_conc.assert_true((select count(*)=1 from eps.specs_pipeline_config where enabled)
  and(select count(*)=1 from eps.candidate_asset_config where enabled and english_transcript_version='1.0')
  and(select count(*)=1 from eps.frame_extraction_config where enabled)
  and(select count(*)=1 from eps.review_processing_config where enabled)
  and(select count(*)=1 from eps.presentation_processing_config where enabled),'all five actual singleton config rows enabled');
 perform eps_worker38_conc.assert_true(not exists(select 1 from eps.jobs where workspace_id in(
  eps_worker38_conc.workspace(1),eps_worker38_conc.workspace(2))),'setup creates no queue or provider work');
end$worker38_fixture_ready$;
select jsonb_build_object('worker38_fixture_ready_synthetic_only',true,'actor_id',eps_worker38_conc.actor(),
 'rollback_workspace_id',eps_worker38_conc.workspace(1),'commit_race_workspace_id',eps_worker38_conc.workspace(2));
