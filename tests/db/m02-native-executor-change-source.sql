-- Actual scoped submission RPC under a fixed SYNTHETIC authenticated fixture.
-- Runtime gateway sessions never receive or impersonate this fixture JWT.
-- Synthetic readiness exists only inside this transaction and is restored before
-- COMMIT; other sessions continue to see the unchanged disabled config.
begin;
set local search_path='';
select eps_local_guard.native_specs_fixture_require();
do $$ declare marker eps_local_guard.native_specs_fixture; source eps.specs; job eps.jobs;
 acknowledgement jsonb; old_config eps.specs_pipeline_config; new_job uuid; changed bigint;
begin
 select * into strict marker from eps_local_guard.native_specs_fixture;
 if marker.replacement_job_id is not null then
  if not exists(select 1 from eps.specs s join eps.jobs j on j.id=s.processing_job_id join eps.specs_source_inputs retained on retained.job_id=j.id
   where s.workspace_id='7c980000-0000-4000-8000-000000000003' and j.id=marker.replacement_job_id
    and retained.source_text=marker.corrected_text and s.source_text=retained.source_text and s.source_row_version=3
    and s.normalized_instructions='Synthetic manual facts retained')
  then raise exception 'NATIVE_PRIOR_CORRECTION_UNCONFIRMED'; end if;
 else
  select * into strict source from eps.specs where workspace_id='7c980000-0000-4000-8000-000000000003';
  select * into strict job from eps.jobs where id='7f980000-0000-4000-8000-000000000003';
  if job.status<>'running' or job.stage<>'apply_specs' or job.attempt<>3 or jsonb_array_length(job.completed_stages)<>2
   or not eps.specs_stage_source_matches(job) or source.source_row_version<>2 or source.processing_job_id<>job.id
   or source.row_version<>3 or source.normalized_instructions is distinct from 'Synthetic manual facts retained'
   or source.source_extraction is not null or source.source_extraction_job_id is not null
  then raise exception 'NATIVE_SOURCE_CHANGE_STATE_REFUSED'; end if;
  select * into strict old_config from eps.specs_pipeline_config where id=1;
  update eps.specs_pipeline_config set enabled=true,document_preparation_version='document-preparation.v1',
   model_version='synthetic-native-acceptance-model',prompt_version='spec_extract_v1.0.0',result_schema_version='1.0' where id=1;
  get diagnostics changed=row_count; if changed<>1 then raise exception 'NATIVE_SYNTHETIC_CONFIG_REFUSED'; end if;
  perform set_config('eps.native_specs.correction_input',jsonb_build_object('source_text',marker.corrected_text,'row_version',source.row_version)::text,true);
  perform set_config('request.jwt.claim.sub','7a980000-0000-4000-8000-000000000001',true);
  perform set_config('request.jwt.claims','{"sub":"7a980000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
  perform set_config('request.headers','{"x-eps-request-id":"native-synthetic-correction","x-eps-client-type":"api"}',true);
  execute 'set local role authenticated';
  acknowledgement:=public.eps_submit_specs('7c980000-0000-4000-8000-000000000003',current_setting('eps.native_specs.correction_input')::jsonb,'native-synthetic-correction-0001');
  execute 'set local role postgres';
  new_job:=(acknowledgement->>'job_id')::uuid;
  if acknowledgement->>'status'<>'queued' or acknowledgement->>'resource_id'<>source.id::text
   or not exists(select 1 from eps.jobs j join eps.specs_source_inputs retained on retained.job_id=j.id
    where j.id=new_job and j.workspace_id=source.workspace_id and j.resource_id=source.id
     and j.requested_by='7a980000-0000-4000-8000-000000000001' and retained.source_text=marker.corrected_text and retained.source_row_version=3)
  then raise exception 'NATIVE_CORRECTION_ACKNOWLEDGEMENT_REFUSED'; end if;
  update eps.specs_pipeline_config set enabled=old_config.enabled,document_preparation_version=old_config.document_preparation_version,
   model_version=old_config.model_version,prompt_version=old_config.prompt_version,result_schema_version=old_config.result_schema_version where id=1;
  get diagnostics changed=row_count; if changed<>1 then raise exception 'NATIVE_CONFIG_RESTORATION_REFUSED'; end if;
  update eps_local_guard.native_specs_fixture set replacement_job_id=new_job where run_id=marker.run_id and replacement_job_id is null;
  get diagnostics changed=row_count; if changed<>1 then raise exception 'NATIVE_CORRECTION_MARKER_REFUSED'; end if;
 end if;
end $$;
select eps_local_guard.native_specs_fixture_require();
select jsonb_build_object('source_changed',true);
commit;
