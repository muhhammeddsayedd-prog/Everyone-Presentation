-- Synthetic SQL authorization/state proof only. No file bytes are transferred,
-- no hosted Storage behavior or native/provider acceptance is inferred.
-- Parent owns one BEGIN/ROLLBACK and the local managed-Auth RLS simulation.
do $$ begin
 if current_user<>'postgres' or current_setting('eps.specs_assets_rehearsal',true) is distinct from 'rollback-only-v1'
  or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
  or exists(select 1 from auth.users where id::text like '7a9b0000-%')
  or exists(select 1 from public.projects where id::text like '7b9b0000-%')
  or exists(select 1 from eps.workspaces where id::text like '7c9b0000-%')
 then raise exception 'SPECS_ASSETS_SYNTHETIC_OWNED_ROLLBACK_REQUIRED'; end if;
end $$;
create function pg_temp.asset_assert(value boolean,label text) returns void language plpgsql as $$ begin
 if value is distinct from true then raise exception 'ASSET_ASSERTION: %',label; end if;
end $$;
create function pg_temp.asset_expect(query text,expected text) returns void language plpgsql as $$ begin
 begin execute query; exception when others then
  if sqlerrm=expected or sqlstate=expected then return; end if;
  raise exception 'ASSET_WRONG_ERROR expected %, got % / %',expected,sqlstate,sqlerrm;
 end; raise exception 'ASSET_EXPECTED_ERROR_NOT_RAISED: %',expected;
end $$;
-- Exact UTF16 offsets with Arabic/non-BMP values and the contractual scale.
-- This detects the former repeated-substring algorithm, not a tiny-only case.
set local statement_timeout='5s';
select pg_temp.asset_assert(eps.specs_utf16_length(chr(1575)||chr(1604)||chr(1593)||chr(1585)||chr(1576)||chr(1610)||chr(1577)||chr(128512))=9
 and eps.specs_utf16_length(repeat(chr(1593),1999998)||chr(128512))=2000000,'linear-scale Unicode UTF16 projection');
set local statement_timeout='60s';
insert into auth.users(id,is_anonymous,deleted_at,banned_until) values
 ('7a9b0000-0000-4000-8000-000000000001',false,null,null),('7a9b0000-0000-4000-8000-000000000002',false,null,null);
insert into public.projects(id,name) values('7b9b0000-0000-4000-8000-000000000001','Synthetic private file specs');
insert into eps.workspaces(id,project_id) values('7c9b0000-0000-4000-8000-000000000001','7b9b0000-0000-4000-8000-000000000001');
insert into public.project_memberships(project_id,principal_id,can_write) values
 ('7b9b0000-0000-4000-8000-000000000001','7a9b0000-0000-4000-8000-000000000001',true);
insert into public.app_capability_grants(principal_id,capability)
 select '7a9b0000-0000-4000-8000-000000000001'::uuid,c from unnest(array['projects.read','workspaces.read','workspaces.write','operations.retry']) c;
select pg_temp.asset_assert((select not uploads_enabled and not capabilities_enabled and not file_pipeline_enabled from eps.specs_asset_config where id=1),'all activation gates default false');
select pg_temp.asset_assert(not has_function_privilege('authenticated','eps.get_job_asset_access(jsonb)','EXECUTE')
 and not has_function_privilege('anon','eps.store_specs_preparation(jsonb)','EXECUTE')
 and not has_function_privilege('service_role','eps.reserve_job_output(jsonb)','EXECUTE')
 and not has_table_privilege('authenticated','eps.specs_verification_keys','SELECT')
 and not has_table_privilege('eps_specs_assets_executor','eps.specs_source_inputs','SELECT')
 and not has_schema_privilege('eps_specs_assets_owner','auth','USAGE')
 and not has_schema_privilege('eps_specs_assets_executor','auth','USAGE'),'execute-only/no Auth/table/key privilege');
select set_config('request.jwt.claim.sub','7a9b0000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"7a9b0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select pg_temp.asset_assert(not(public.eps_get_capabilities()#>'{upload_policy,available_purposes}'?'specs'),'default capabilities do not advertise files');
select pg_temp.asset_expect($q$select public.eps_reserve_specs_upload('{"workspace_id":"7c9b0000-0000-4000-8000-000000000001","purpose":"specs","filename":"brief.pdf","mime_type":"application/pdf","size_bytes":17}','synthetic-file-disabled')$q$,'FEATURE_NOT_IMPLEMENTED');
set local role postgres;
update eps.specs_asset_config set uploads_enabled=true,capabilities_enabled=true,file_pipeline_enabled=true where id=1;
update eps.specs_pipeline_config set enabled=true,document_preparation_version='document-preparation.v1',model_version='synthetic-model',prompt_version='spec_extract_v1.0.0',result_schema_version='1.0' where id=1;
-- Known synthetic key, never a real deployment secret or provider credential.
insert into eps.specs_verification_keys(key_id,secret,not_before) values('synthetic-specs-test',decode(repeat('12',32),'hex'),clock_timestamp()-interval '1 day');
create function pg_temp.asset_reserve(mime text,filename text,key_value text) returns jsonb language plpgsql as $$ declare value jsonb; begin
 execute 'set local role authenticated';
 value:=public.eps_reserve_specs_upload(jsonb_build_object('workspace_id','7c9b0000-0000-4000-8000-000000000001','purpose','specs','filename',filename,'mime_type',mime,'size_bytes',17),key_value);
 execute 'set local role postgres'; return value;
end $$;
create function pg_temp.asset_proof(item jsonb,checksum text) returns jsonb language plpgsql as $$ declare claims jsonb; raw bytea; issued bigint:=floor(extract(epoch from clock_timestamp()))::bigint; begin
 claims:=jsonb_build_object('schema_version','specs-original-verification.v1','audience','eps.specs-original-verification','purpose','specs','key_id','synthetic-specs-test',
  'verification_id',item->'verification_id','upload_id',item->'upload_id','asset_id',item#>'{asset,id}','principal_id',item->'principal_id','workspace_id',item->'workspace_id',
  'reservation_revision',item->'reservation_revision','bucket',item->'bucket','object_key',item->'object_key','size_bytes',17,'sha256',checksum,'mime_type',item->'expected_mime_type',
  'verified_format',case item->>'expected_mime_type' when 'application/pdf' then 'pdf' when 'text/plain' then 'utf8_text' else 'docx' end,'issued_at',issued,'expires_at',issued+120);
 raw:=convert_to(claims::text,'UTF8'); perform set_config('eps.asset.proof_raw',claims::text,true);
 return jsonb_build_object('payload',rtrim(translate(replace(encode(raw,'base64'),E'\n',''),'+/','-_'),'='),
  'mac',rtrim(translate(replace(encode(extensions.hmac(raw,decode(repeat('12',32),'hex'),'sha256'),'base64'),E'\n',''),'+/','-_'),'='));
end $$;
do $$ declare item jsonb; replay jsonb; proof jsonb; result jsonb; begin
 item:=pg_temp.asset_reserve('application/pdf','brief.pdf','synthetic-file-reserve-pdf');
 perform set_config('eps.asset.reservation',item::text,true); proof:=pg_temp.asset_proof(item,repeat('a',64));
 execute 'set local role authenticated';
 replay:=public.eps_reserve_specs_upload('{"workspace_id":"7c9b0000-0000-4000-8000-000000000001","purpose":"specs","filename":"brief.pdf","mime_type":"application/pdf","size_bytes":17}','synthetic-file-reserve-pdf');
 perform pg_temp.asset_assert(replay=item and item->>'spec_row_version'='1','exact reservation replay/current Spec version');
 perform pg_temp.asset_expect('select * from eps.specs_verification_keys','42501');
 perform pg_temp.asset_expect(format('select public.eps_finalize_specs_completion(%L,''{"actual_size_bytes":17,"start_processing":false}'',''synthetic-forged-completion'',''e30'',''AAAA'')',item->>'upload_id'),'ACCESS_DENIED');
 -- JSON accepts escaped NUL/unpaired UTF16 that JSONB rejects. The receipt
 -- boundary must convert them only inside its safe exception handler.
 perform set_config('eps.asset.bad_receipt',rtrim(translate(replace(encode(convert_to(replace(current_setting('eps.asset.proof_raw'),'synthetic-specs-test',E'bad\\u0000private'),'UTF8'),'base64'),E'\n',''),'+/','-_'),'='),true);
 perform pg_temp.asset_expect(format('select public.eps_finalize_specs_completion(%L,''{"actual_size_bytes":17,"start_processing":false}'',''synthetic-nul-completion'',current_setting(''eps.asset.bad_receipt''),%L)',item->>'upload_id',proof->>'mac'),'ACCESS_DENIED');
 perform set_config('eps.asset.bad_receipt',rtrim(translate(replace(encode(convert_to(replace(current_setting('eps.asset.proof_raw'),'synthetic-specs-test',E'bad\\ud800private'),'UTF8'),'base64'),E'\n',''),'+/','-_'),'='),true);
 perform pg_temp.asset_expect(format('select public.eps_finalize_specs_completion(%L,''{"actual_size_bytes":17,"start_processing":false}'',''synthetic-surrogate-completion'',current_setting(''eps.asset.bad_receipt''),%L)',item->>'upload_id',proof->>'mac'),'ACCESS_DENIED');

 result:=public.eps_finalize_specs_completion((item->>'upload_id')::uuid,'{"actual_size_bytes":17,"start_processing":false}','synthetic-file-complete-pdf',proof->>'payload',proof->>'mac');
 perform pg_temp.asset_assert(result->>'status'='ready' and result->'processing_job_id'='null' and result#>>'{asset,sha256}'=repeat('a',64),'server-proof-only Ready/no automatic submit');
 replay:=public.eps_prepare_specs_completion((item->>'upload_id')::uuid,'{"actual_size_bytes":17,"start_processing":false}','synthetic-file-new-complete-key');
 perform pg_temp.asset_assert(replay->'replay'=result,'completed new-key remembered replay');
 perform pg_temp.asset_expect(format('select public.eps_prepare_specs_completion(%L,''{"actual_size_bytes":17,"start_processing":true}'',''synthetic-file-new-complete-key'')',item->>'upload_id'),'INVALID_TRANSITION');
 replay:=public.eps_get_specs_upload((item->>'upload_id')::uuid); perform pg_temp.asset_assert(replay->>'status'='completed','closed reservation current projection');
 execute 'set local role postgres'; perform set_config('eps.asset.original',item#>>'{asset,id}',true);
end $$;
-- Closed/cancelled/expired sessions cannot mint or publish originals.
do $$ declare item jsonb; proof jsonb; begin
 item:=pg_temp.asset_reserve('text/plain','cancelled.txt','synthetic-file-cancel-reserve');
 execute 'set local role authenticated'; perform public.eps_cancel_specs_upload((item->>'upload_id')::uuid,'synthetic-file-cancel-key'); execute 'set local role postgres';
 proof:=pg_temp.asset_proof(item,repeat('b',64));
 execute 'set local role authenticated';
 perform pg_temp.asset_expect(format('select public.eps_finalize_specs_completion(%L,''{"actual_size_bytes":17,"start_processing":false}'',''synthetic-cancelled-finalize'',%L,%L)',item->>'upload_id',proof->>'payload',proof->>'mac'),'UPLOAD_EXPIRED');
 execute 'set local role postgres'; item:=pg_temp.asset_reserve('text/plain','expired.txt','synthetic-file-expired-reserve'); proof:=pg_temp.asset_proof(item,repeat('b',64));
 update eps.specs_upload_sessions set created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 second' where id=(item->>'upload_id')::uuid;
 execute 'set local role authenticated';
 perform pg_temp.asset_expect(format('select public.eps_finalize_specs_completion(%L,''{"actual_size_bytes":17,"start_processing":false}'',''synthetic-expired-finalize'',%L,%L)',item->>'upload_id',proof->>'payload',proof->>'mac'),'UPLOAD_EXPIRED');
 execute 'set local role postgres';
 perform set_config('request.jwt.claim.sub','7a9b0000-0000-4000-8000-000000000002',true);
 perform set_config('request.jwt.claims','{"sub":"7a9b0000-0000-4000-8000-000000000002","role":"authenticated"}',true);
 execute 'set local role authenticated'; perform pg_temp.asset_expect(format('select public.eps_get_specs_upload(%L)',item->>'upload_id'),'CAPABILITY_REQUIRED'); execute 'set local role postgres';
 perform set_config('request.jwt.claim.sub','7a9b0000-0000-4000-8000-000000000001',true);
 perform set_config('request.jwt.claims','{"sub":"7a9b0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
end $$;
-- Managed Storage catalog simulation only; trusted operation/header values are
-- test GUCs, not proof of deployed HTTP propagation or real object byte storage.
insert into storage.objects(bucket_id,name) select bucket,object_key from eps.media_assets where id=current_setting('eps.asset.original')::uuid;
select set_config('storage.operation','object.get_authenticated',true);
set local role authenticated;
select pg_temp.asset_assert((select count(*)=1 from storage.objects where bucket_id='eps-specs-assets'),'authorized original metadata read');
select set_config('storage.operation','object.list',true);
select pg_temp.asset_assert((select count(*)=0 from storage.objects where bucket_id='eps-specs-assets'),'listing is RLS-denied despite legitimate scope');
select set_config('storage.operation','object.get_authenticated',true);
set local role postgres;
create function pg_temp.asset_submit(asset uuid,key_value text) returns uuid language plpgsql as $$ declare spec_version bigint; ack jsonb; begin
 select row_version into strict spec_version from eps.specs where workspace_id='7c9b0000-0000-4000-8000-000000000001';
 execute 'set local role authenticated'; ack:=public.eps_submit_specs('7c9b0000-0000-4000-8000-000000000001',jsonb_build_object('source_asset_id',asset,'row_version',spec_version),key_value);
 execute 'set local role postgres'; return (ack->>'job_id')::uuid;
end $$;
create function pg_temp.asset_event(lease jsonb,kind text,result jsonb,schema_value text) returns jsonb language sql as $$
 select jsonb_build_object('event_id',gen_random_uuid()::text,'job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage',lease->'stage',
  'sequence',1,'event_type',kind,'input_hash',lease#>'{input,input_hash}','result',result,'result_schema',schema_value)
$$;
create function pg_temp.asset_lease(job_id uuid,stage_name text) returns jsonb language plpgsql as $$ declare digest text; value jsonb; begin
 select input_hash into strict digest from eps.jobs where id=job_id;
 execute 'set local role eps_jobs_executor'; value:=eps.claim_job_stage(jsonb_build_object('job_id',job_id,'stage',stage_name,'input_hash',digest));
 execute 'set local role postgres'; return value;
end $$;
create function pg_temp.asset_prepare(job_id uuid) returns jsonb language plpgsql as $$
declare lease jsonb; input_value jsonb; access_value jsonb; reserved jsonb; output_id uuid; result jsonb; payload text; paragraphs jsonb; digest text; completed jsonb; begin
 lease:=pg_temp.asset_lease(job_id,'prepare_document');
 execute 'set local role eps_jobs_executor'; input_value:=eps.get_specs_stage_input(job_id,(lease->>'attempt_id')::uuid,lease->>'lease_token'); execute 'set local role postgres';
 perform pg_temp.asset_assert(input_value->>'source_kind'='asset' and input_value->>'size_bytes'='17' and input_value->>'source_asset_id'=current_setting('eps.asset.original'),'actual retained file metadata handoff');
 paragraphs:=jsonb_build_array(jsonb_build_object('index',0,'page',case when input_value->>'mime_type'='application/pdf' then 1 else null end,'start',0,'end',17,'text','Synthetic actor A'));
 payload:=jsonb_build_object('schema_version','document-text-v1','sourceAssetId',input_value->'source_asset_id','sourceSha256',input_value->'source_sha256','text','Synthetic actor A','paragraphs',paragraphs,
  'extractionMethod',case input_value->>'mime_type' when 'application/pdf' then 'pdf_text' when 'text/plain' then 'plain_text' else 'docx_text' end,'warnings','[]'::jsonb)::text;
 digest:=encode(sha256(convert_to(payload,'UTF8')),'hex');
 perform set_config('eps.asset.scope',jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',input_value->'source_asset_id')::text,true);
 execute 'set local role eps_specs_assets_executor';
 perform pg_temp.asset_expect('select eps.get_job_asset_access(current_setting(''eps.asset.scope'')::jsonb||''{"attempt_id":"00000000-0000-4000-8000-000000000001"}'')','STALE_STAGE_LEASE');
 perform pg_temp.asset_expect('select eps.get_job_asset_access(current_setting(''eps.asset.scope'')::jsonb||''{"lease_token":"wrong-synthetic-lease"}'')','LEASE_INVALID');
 access_value:=eps.get_job_asset_access(jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',input_value->'source_asset_id'));
 execute 'set local role postgres'; perform set_config('eps.asset.read_grant',access_value::text,true);
 perform pg_temp.asset_assert(access_value->>'permission'='read' and access_value->>'sha256'=repeat('a',64),'lease scoped original grant');
 perform set_config('request.headers',jsonb_build_object('x-eps-asset-grant',access_value->>'grant_token')::text,true);
 perform set_config('request.jwt.claim.sub','',true); perform set_config('request.jwt.claims','{}',true);
 execute 'set local role anon';
 perform pg_temp.asset_assert(eps.specs_storage_capability(access_value->>'bucket',access_value->>'object_key','read')
  and not eps.specs_storage_capability(access_value->>'bucket','assets/unknown/original.pdf','read')
  and not eps.specs_storage_capability(access_value->>'bucket',access_value->>'object_key','write'),'exact live capability scope and operation');
 execute 'set local role postgres';
 update public.project_memberships set active=false where project_id='7b9b0000-0000-4000-8000-000000000001' and principal_id='7a9b0000-0000-4000-8000-000000000001';
 execute 'set local role anon'; perform pg_temp.asset_assert(not eps.specs_storage_capability(access_value->>'bucket',access_value->>'object_key','read'),'revoked requester invalidates live capability');
 execute 'set local role postgres'; update public.project_memberships set active=true where project_id='7b9b0000-0000-4000-8000-000000000001' and principal_id='7a9b0000-0000-4000-8000-000000000001';
 update eps.specs_asset_grants set revoked_at=clock_timestamp() where token_digest=encode(sha256(convert_to(access_value->>'grant_token','UTF8')),'hex');
 execute 'set local role anon'; perform pg_temp.asset_assert(not eps.specs_storage_capability(access_value->>'bucket',access_value->>'object_key','read'),'explicit grant revocation denied');
 execute 'set local role postgres'; update eps.specs_asset_grants set revoked_at=null where token_digest=encode(sha256(convert_to(access_value->>'grant_token','UTF8')),'hex');
 perform set_config('request.headers','{}',true);
 execute 'set local role anon'; perform pg_temp.asset_assert(not eps.specs_storage_capability(access_value->>'bucket',access_value->>'object_key','read'),'missing grant denied');
 execute 'set local role postgres';
 perform set_config('request.jwt.claim.sub','7a9b0000-0000-4000-8000-000000000001',true);
 perform set_config('request.jwt.claims','{"sub":"7a9b0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
 execute 'set local role eps_specs_assets_executor';
 reserved:=eps.reserve_job_output(jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','output_key','document_text','asset_kind','document_text',
  'filename','prepared-document.json','mime_type','application/json','expected_size_bytes',octet_length(payload),'parent_asset_id',input_value->'source_asset_id','time_offset_ms',null));
 output_id:=(reserved#>>'{asset,id}')::uuid;
 perform pg_temp.asset_assert(reserved#>>'{asset,status}'='uploading','new attempt-owned output reservation');
 perform pg_temp.asset_assert(eps.reserve_job_output(jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','output_key','document_text','asset_kind','document_text',
  'filename','prepared-document.json','mime_type','application/json','expected_size_bytes',octet_length(payload),'parent_asset_id',input_value->'source_asset_id','time_offset_ms',null))=reserved,'stable per-attempt output_key replay');
 completed:=eps.complete_job_output(jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',output_id,'sha256',digest,
  'actual_size_bytes',octet_length(payload),'width',null,'height',null,'duration_ms',null));
 perform pg_temp.asset_assert(completed->>'status'='ready','trusted output completion fixture');
 perform eps.store_specs_preparation(jsonb_build_object('job_id',job_id,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',output_id,'payload_utf8',payload));
 execute 'set local role postgres';
 result:=jsonb_build_object('source_asset_id',input_value->'source_asset_id','text_asset_id',output_id,'page_assets','[]'::jsonb,'paragraph_count',1,'extraction_method',payload::jsonb->>'extractionMethod','warnings','[]'::jsonb);
 execute 'set local role eps_jobs_executor';
 completed:=eps.record_job_event(pg_temp.asset_event(lease,'succeeded',result,'document-preparation.v1'));
 execute 'set local role postgres';
 perform pg_temp.asset_assert(completed->>'job_status'='queued','verified preparation queues extraction'); return result;
end $$;
create function pg_temp.asset_extract(job_id uuid,count_value bigint default null) returns void language plpgsql as $$
declare lease jsonb; input_value jsonb; result jsonb; metadata jsonb; receipt jsonb; begin
 lease:=pg_temp.asset_lease(job_id,'extract_specs'); execute 'set local role eps_jobs_executor';
 input_value:=eps.get_specs_stage_input(job_id,(lease->>'attempt_id')::uuid,lease->>'lease_token'); execute 'set local role postgres';
 perform pg_temp.asset_assert(input_value->>'source_kind'='asset' and input_value#>>'{paragraphs,0,text}'='Synthetic actor A','private prepared source/evidence handoff');
 result:=jsonb_build_object('schema_version','1.0','source_asset_id',input_value->'source_asset_id','source_language_codes','["en"]'::jsonb,'general_instructions','Synthetic instructions','clarifications','[]'::jsonb,
  'roles',jsonb_build_array(jsonb_build_object('source_role_key','synthetic-role','name','Actor','headcount',count_value,'category',null,'requirements',
   '{"age_range":null,"gender_requirement":null,"appearance_performance":null,"languages":[],"accents":[],"skills":[],"scene_references":[],"shoot_dates":[],"location":null,"availability_requirements":null,"other_instructions":null}'::jsonb,
   'evidence',jsonb_build_array(jsonb_build_object('asset_id',input_value->'source_asset_id','page',input_value#>'{paragraphs,0,page}','paragraph',0,'segment_index',null,'start_ms',null,'end_ms',null,'quote','Synthetic actor A')),'clarifications','[]'::jsonb)));
 metadata:=jsonb_build_object('provider','openai','sdk_version','7.45.1','requested_model',input_value#>'{configuration,model_version}','resolved_model',input_value#>'{configuration,model_version}','response_id','synthetic-response','request_id',null,
  'correlation_id',input_value->'correlation_id','input_sha256',lease#>'{input,input_hash}','prepared_source_sha256',eps.specs_document_prepared_hash((input_value->>'source_asset_id')::uuid,input_value->'paragraphs'),
  'prompt_version','spec_extract_v1.0.0','prompt_sha256','ab03fd026edb3d139fd93fdd51cb475474d6c4e3c8f6395b65014574e7e29eee','schema_version','1.0',
  'schema_sha256','e8ffee51eee20f687abbfc12c2476248ccb5a59c1122fde418bc89db3ff58085','provider_schema_sha256','d73a11450f2714c5649ab9a663f0a3483f68feefd1f482bc62575a9a608a1216','usage',null);
 execute 'set local role eps_jobs_executor'; receipt:=eps.record_job_event(pg_temp.asset_event(lease,'succeeded',jsonb_build_object('result',result,'metadata',metadata),'specs-extraction-stage.v1'));
 execute 'set local role postgres'; perform pg_temp.asset_assert(receipt->>'job_status'='queued','typed file extraction queues apply');
end $$;
create function pg_temp.asset_apply(job_id uuid) returns jsonb language plpgsql as $$ declare lease jsonb; input_value jsonb; receipt jsonb; begin
 lease:=pg_temp.asset_lease(job_id,'apply_specs'); execute 'set local role eps_jobs_executor';
 input_value:=eps.get_specs_stage_input(job_id,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 receipt:=eps.record_job_event(pg_temp.asset_event(lease,'succeeded',jsonb_build_object('specs_id',input_value->'specs_id','workspace_id',input_value->'workspace_id'),'specs-application.v1'));
 execute 'set local role postgres'; return receipt;
end $$;
do $$ declare job_id uuid; prepared jsonb; begin
 job_id:=pg_temp.asset_submit(current_setting('eps.asset.original')::uuid,'synthetic-file-first-submit'); perform set_config('eps.asset.first_job',job_id::text,true);
 prepared:=pg_temp.asset_prepare(job_id); perform pg_temp.asset_extract(job_id); perform pg_temp.asset_assert(pg_temp.asset_apply(job_id)->>'job_status'='succeeded','initial file application');
 perform pg_temp.asset_assert((select count(*)=1 from eps.roles where workspace_id='7c9b0000-0000-4000-8000-000000000001' and archived_at is null)
  and (select count(*)=1 from eps.slots where workspace_id='7c9b0000-0000-4000-8000-000000000001' and provisional and archived_at is null),'unknown headcount creates one provisional slot');
 perform pg_temp.asset_assert((select eps.specs_machine_baseline(s) from eps.specs s where workspace_id='7c9b0000-0000-4000-8000-000000000001'),'published machine baseline recognized');
 perform set_config('eps.asset.old_role',(select id::text from eps.roles where workspace_id='7c9b0000-0000-4000-8000-000000000001' and archived_at is null),true);
 perform set_config('eps.asset.old_slot',(select id::text from eps.slots where workspace_id='7c9b0000-0000-4000-8000-000000000001' and archived_at is null),true);
end $$;
create function pg_temp.asset_suppress() returns trigger language plpgsql as $$ begin return null; end $$;
-- Ordinary different-file correction: new retained input, old evidence and IDs
-- remain, only exact untouched generated facts may be retired/replaced.
do $$ declare item jsonb; proof jsonb; result jsonb; new_job uuid; begin
 item:=pg_temp.asset_reserve('application/vnd.openxmlformats-officedocument.wordprocessingml.document','brief.docx','synthetic-file-reserve-docx'); proof:=pg_temp.asset_proof(item,repeat('a',64));
 execute 'set local role authenticated'; result:=public.eps_finalize_specs_completion((item->>'upload_id')::uuid,'{"actual_size_bytes":17,"start_processing":false}','synthetic-file-complete-docx',proof->>'payload',proof->>'mac'); execute 'set local role postgres';
 perform set_config('eps.asset.original',item#>>'{asset,id}',true);
 new_job:=pg_temp.asset_submit((item#>>'{asset,id}')::uuid,'synthetic-file-replace-submit');
 perform pg_temp.asset_prepare(new_job); perform pg_temp.asset_extract(new_job,2);
 perform set_config('eps.asset.replace_job',new_job::text,true);
 execute 'create trigger synthetic_suppress_retirement before update on eps.slots for each row when (new.archived_at is not null) execute function pg_temp.asset_suppress()';
 perform pg_temp.asset_expect('select pg_temp.asset_apply(current_setting(''eps.asset.replace_job'')::uuid)','STAGE_STATE_INVALID');
 execute 'drop trigger synthetic_suppress_retirement on eps.slots';
 perform pg_temp.asset_assert((select archived_at is null and row_version=1 from eps.slots where id=current_setting('eps.asset.old_slot')::uuid)
  and (select stage='apply_specs' and status='queued' from eps.jobs where id=new_job),'suppressed archive rolls back callback/lease/facts');
 perform pg_temp.asset_assert(pg_temp.asset_apply(new_job)->>'job_status'='succeeded','untouched machine generation replaced');
 perform pg_temp.asset_assert((select archived_at is not null and row_version=2 and source_job_id=current_setting('eps.asset.first_job')::uuid from eps.roles where id=current_setting('eps.asset.old_role')::uuid)
  and (select archived_at is not null and row_version=2 from eps.slots where id=current_setting('eps.asset.old_slot')::uuid)
  and (select count(*)=2 from eps.slots where workspace_id='7c9b0000-0000-4000-8000-000000000001' and archived_at is null and not provisional)
  and (select count(*)=2 from eps.specs_source_inputs where workspace_id='7c9b0000-0000-4000-8000-000000000001'),'history/source provenance preserved; new slot identities');
end $$;
-- Current grant is invalid after the originating attempt ended; no public JWT
-- or stale capability can grant bytes under a newer lease/source pointer.
select set_config('request.jwt.claim.sub','',true); select set_config('request.jwt.claims','{}',true);
select set_config('request.headers',jsonb_build_object('x-eps-asset-grant',current_setting('eps.asset.read_grant')::jsonb->>'grant_token')::text,true);
set local role anon;
select pg_temp.asset_assert(not eps.specs_storage_capability('eps-specs-assets',current_setting('eps.asset.read_grant')::jsonb->>'object_key','read'),'terminal attempt capability denied');
select pg_temp.asset_expect('select * from eps.specs_file_preparations','42501');
set local role postgres;
select set_config('request.jwt.claim.sub','7a9b0000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"7a9b0000-0000-4000-8000-000000000001","role":"authenticated"}',true);
-- Same original but changed trusted configuration creates a distinct job; a
-- prior manual edit/version prevents publication without deleting any facts.
update eps.specs_pipeline_config set model_version='synthetic-model-2' where id=1;
do $$ declare job_id uuid; begin
 job_id:=pg_temp.asset_submit(current_setting('eps.asset.original')::uuid,'synthetic-file-manual-submit');
 -- Native extraction result metadata uses exact configured model below.
 perform set_config('eps.asset.manual_job',job_id::text,true);
 perform pg_temp.asset_prepare(job_id);
end $$;
update eps.specs_pipeline_config set model_version='synthetic-model' where id=1;
do $$ declare job_id uuid:=current_setting('eps.asset.manual_job')::uuid; role_id uuid; before_spec jsonb; before_roles jsonb; before_slots jsonb; result jsonb; begin
 perform pg_temp.asset_extract(job_id,3);
 select id into strict role_id from eps.roles where workspace_id='7c9b0000-0000-4000-8000-000000000001' and archived_at is null;
 execute 'set local role authenticated'; perform public.eps_update_role(role_id,'{"row_version":1,"name":"Human correction"}','synthetic-file-manual-edit'); execute 'set local role postgres';
 select to_jsonb(s) into before_spec from eps.specs s where workspace_id='7c9b0000-0000-4000-8000-000000000001';
 select jsonb_agg(to_jsonb(r) order by id) into before_roles from eps.roles r where workspace_id='7c9b0000-0000-4000-8000-000000000001';
 select jsonb_agg(to_jsonb(r) order by id) into before_slots from eps.slots r where workspace_id='7c9b0000-0000-4000-8000-000000000001';
 result:=pg_temp.asset_apply(job_id); perform pg_temp.asset_assert(result->>'job_status'='waiting_for_input','manual change preserved instead of overwrite');
 perform pg_temp.asset_assert((select to_jsonb(s)=before_spec from eps.specs s where workspace_id='7c9b0000-0000-4000-8000-000000000001')
  and (select jsonb_agg(to_jsonb(r) order by id)=before_roles from eps.roles r where workspace_id='7c9b0000-0000-4000-8000-000000000001')
  and (select jsonb_agg(to_jsonb(r) order by id)=before_slots from eps.slots r where workspace_id='7c9b0000-0000-4000-8000-000000000001')
  and exists(select 1 from eps.specs_stage_payloads p where p.job_id=current_setting('eps.asset.manual_job')::uuid and p.stage='extract_specs'),'manual fields/history/extraction retained');
end $$;
select pg_temp.asset_assert((select count(*)=3 from eps.specs_source_inputs where workspace_id='7c9b0000-0000-4000-8000-000000000001')
 and (select count(distinct source_asset_id)=2 from eps.specs_source_inputs where workspace_id='7c9b0000-0000-4000-8000-000000000001'),'same original/new config retained as distinct job');
-- Final metadata privacy assertion targets processing envelopes only. Ordinary
-- authorized Spec read/edit responses intentionally include source facts.
select pg_temp.asset_assert(not exists(select 1 from eps.jobs where workspace_id='7c9b0000-0000-4000-8000-000000000001' and (input::text like '%Synthetic actor A%' or completed_stages::text like '%Synthetic actor A%'))
 and not exists(select 1 from eps.outbox_events e join eps.jobs j on j.id=e.job_id where j.workspace_id='7c9b0000-0000-4000-8000-000000000001' and to_jsonb(e)::text like '%Synthetic actor A%'),'no raw preparation in public processing metadata');
select pg_temp.asset_assert((select secret=decode(repeat('12',32),'hex') from eps.specs_verification_keys where key_id='synthetic-specs-test'),'purpose-only synthetic key unchanged');
