-- Run after34 ONLY in the owned transaction gated by test-target.sql. These
-- are executable regression definitions, not a receipt that SQL was executed.
set local role postgres;
do $$begin
 if current_database()!~'^eps_english34_[a-f0-9]{32}$'
 or current_database()<>'eps_english34_'||current_setting('eps.english34_test_run',true)
 or not exists(select 1 from pg_database where datname=current_database()
  and oid::text=current_setting('eps.english34_test_oid',true)and datdba='postgres'::regrole
  and shobj_description(oid,'pg_database')='eps-english34-owned:'||current_setting('eps.english34_test_run',true))
 then raise exception'ENGLISH34_OWNED_SYNTHETIC_DATABASE_REQUIRED';end if;
end$$;
create function pg_temp.english34_assert(p_condition boolean)returns void language plpgsql as $$
begin if p_condition is distinct from true then raise exception'ENGLISH34_REGRESSION_FAILED';end if;end$$;
create function pg_temp.english34_job(p_flag jsonb default '"1.0"'::jsonb)returns eps.jobs language plpgsql as $$
declare job eps.jobs;begin
 job.kind:='candidate_scan';job.input_asset_id:='8e340000-0000-4000-8000-000000000001';
 job.input:=jsonb_build_object('source_asset_id',job.input_asset_id,'configuration',jsonb_build_object('extraction_model','synthetic-model'));
 if p_flag is not null then job.input:=jsonb_set(job.input,'{configuration,english_transcript_version}',p_flag);end if;
 job.input_hash:=eps.candidate_job_hash(job.input);return job;
end$$;
create function pg_temp.english34_original()returns jsonb language sql as $$
 select jsonb_build_object('source_asset_id','8e340000-0000-4000-8000-000000000001','original_text',U&'\0645\0631\062D\0628\0627')
$$;
create function pg_temp.english34_payload()returns jsonb language sql as $$
 select jsonb_build_object('source_asset_id','8e340000-0000-4000-8000-000000000001','english_transcript',jsonb_build_object(
 'status','available','text','Hello.','source_sha256',encode(sha256(convert_to(pg_temp.english34_original()->>'original_text','UTF8')),'hex'),
 'metadata',jsonb_build_array(jsonb_build_object('provider','openai','task','transcript_english','sdk_version','7.45.1','requested_model','synthetic-model',
 'resolved_model',null,'request_id','req_synthetic','response_id','resp_synthetic','prompt_version','transcript-english.v1','input_sha256',repeat('a',64),'usage',null)),
 'failure_code',null))
$$;
create function pg_temp.english34_reject(p_job eps.jobs,p_schema text,p_payload jsonb,p_original jsonb)returns void language plpgsql as $$
begin
 begin perform eps.validate_candidate_english_transcript(p_job,p_schema,p_payload,p_original);raise exception'ENGLISH34_UNTRUSTED_RESULT_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'RESULT_INVALID'then raise;end if;end;
end$$;
-- Missing flag keeps the original v1 contract; new flags cannot masquerade as v1.
select eps.validate_candidate_english_transcript(pg_temp.english34_job(null),'candidate-extraction-stage.v1','{}',null);
select pg_temp.english34_reject(pg_temp.english34_job(null),'candidate-extraction-stage.v2','{}',null);
select pg_temp.english34_reject(pg_temp.english34_job(null),'candidate-extraction-stage.v1',pg_temp.english34_payload(),pg_temp.english34_original());
select pg_temp.english34_reject(pg_temp.english34_job(),'candidate-extraction-stage.v1',pg_temp.english34_payload(),pg_temp.english34_original());
select pg_temp.english34_reject(pg_temp.english34_job('"2.0"'),'candidate-extraction-stage.v2',pg_temp.english34_payload(),pg_temp.english34_original());
select eps.validate_candidate_english_transcript(pg_temp.english34_job('null'),'candidate-extraction-stage.v1','{}',null);
select pg_temp.english34_reject(pg_temp.english34_job('null'),'candidate-extraction-stage.v2',pg_temp.english34_payload(),pg_temp.english34_original());
-- Valid successful and partial/failure paths; no output is emitted by assertions.
select eps.validate_candidate_english_transcript(pg_temp.english34_job(),'candidate-extraction-stage.v2',pg_temp.english34_payload(),pg_temp.english34_original());
do $$declare payload jsonb:=pg_temp.english34_payload();begin
 payload:=jsonb_set(payload,'{english_transcript,status}','"unavailable"');payload:=jsonb_set(payload,'{english_transcript,text}','null');
 payload:=jsonb_set(payload,'{english_transcript,failure_code}','"ENGLISH_TRANSCRIPT_UNAVAILABLE"');
 perform eps.validate_candidate_english_transcript(pg_temp.english34_job(),'candidate-extraction-stage.v2',payload,pg_temp.english34_original());
 payload:=jsonb_set(payload,'{english_transcript,metadata}','[]');
 perform eps.validate_candidate_english_transcript(pg_temp.english34_job(),'candidate-extraction-stage.v2',payload,pg_temp.english34_original());
 payload:=jsonb_set(payload,'{english_transcript,status}','"not_provided"');payload:=jsonb_set(payload,'{english_transcript,source_sha256}','null');
 payload:=jsonb_set(payload,'{english_transcript,failure_code}','null');
 perform eps.validate_candidate_english_transcript(pg_temp.english34_job(),'candidate-extraction-stage.v2',payload,null);
 perform eps.validate_candidate_english_transcript(pg_temp.english34_job(),'candidate-extraction-stage.v2',payload,jsonb_set(pg_temp.english34_original(),'{original_text}',to_jsonb(U&'\00A0\FEFF'::text)));
end$$;
-- Helper-only source bound: normalization refusal preserves source SHA. Existing
-- transcribe-stage length limits are unchanged and remain an independent gate.
do $$declare original jsonb:=jsonb_set(pg_temp.english34_original(),'{original_text}',to_jsonb(repeat('x',200001)));payload jsonb:=pg_temp.english34_payload();begin
 payload:=jsonb_set(payload,'{english_transcript,status}','"unavailable"');payload:=jsonb_set(payload,'{english_transcript,text}','null');
 payload:=jsonb_set(payload,'{english_transcript,source_sha256}',to_jsonb(encode(sha256(convert_to(original->>'original_text','UTF8')),'hex')));
 payload:=jsonb_set(payload,'{english_transcript,metadata}','[]');payload:=jsonb_set(payload,'{english_transcript,failure_code}','"ENGLISH_TRANSCRIPT_UNAVAILABLE"');
 perform eps.validate_candidate_english_transcript(pg_temp.english34_job(),'candidate-extraction-stage.v2',payload,original);
end$$;
-- Asset, raw-source, frozen job, metadata identity, counts, unknown keys and usage.
do $$declare payload jsonb;path text[];value jsonb;job eps.jobs;begin
 for path,value in select p,v from(values
  (array['source_asset_id'],'"8e340000-0000-4000-8000-000000000099"'::jsonb),
  (array['english_transcript','source_sha256'],to_jsonb(repeat('b',64))),
  (array['english_transcript','text'],'null'::jsonb),
  (array['english_transcript','text'],to_jsonb('PRIVATE_SYNTHETIC'||chr(1))),
  (array['english_transcript','text'],to_jsonb(repeat('x',200001))),
  (array['english_transcript','failure_code'],'"ENGLISH_TRANSCRIPT_UNAVAILABLE"'::jsonb),
  (array['english_transcript','metadata'],'[]'::jsonb),
  (array['english_transcript','metadata','0','requested_model'],'"wrong-model"'::jsonb),
  (array['english_transcript','metadata','0','task'],'"candidate_extraction"'::jsonb),
  (array['english_transcript','metadata','0','provider'],'"unknown"'::jsonb),
  (array['english_transcript','metadata','0','sdk_version'],'"unknown"'::jsonb),
  (array['english_transcript','metadata','0','prompt_version'],'"unknown"'::jsonb),
  (array['english_transcript','metadata','0','input_sha256'],'"bad"'::jsonb),
  (array['english_transcript','metadata','0','request_id'],to_jsonb(E'PRIVATE_SYNTHETIC\n')),
  (array['english_transcript','metadata','0','response_id'],to_jsonb(repeat('x',201))),
  (array['english_transcript','metadata','0','prompt_sha256'],to_jsonb(repeat('c',64))),
  (array['english_transcript','metadata','0','schema_sha256'],to_jsonb(repeat('d',64))),
  (array['english_transcript','metadata','0','usage'],'{"input_tokens":-1,"output_tokens":0,"total_tokens":0}'::jsonb),
  (array['english_transcript','metadata','0','usage'],'{"input_tokens":0,"output_tokens":0,"total_tokens":0,"private":"PRIVATE_SYNTHETIC"}'::jsonb)
 )x(p,v)loop
  payload:=jsonb_set(pg_temp.english34_payload(),path,value);perform pg_temp.english34_reject(pg_temp.english34_job(),'candidate-extraction-stage.v2',payload,pg_temp.english34_original());
 end loop;
 payload:=pg_temp.english34_payload();payload:=jsonb_set(payload,'{english_transcript}',payload->'english_transcript'||'{"private":"PRIVATE_SYNTHETIC"}');
 perform pg_temp.english34_reject(pg_temp.english34_job(),'candidate-extraction-stage.v2',payload,pg_temp.english34_original());
 payload:=jsonb_set(pg_temp.english34_payload(),'{english_transcript,metadata}',(select jsonb_agg(pg_temp.english34_payload()#>'{english_transcript,metadata,0}')from generate_series(1,65)));
 perform pg_temp.english34_reject(pg_temp.english34_job(),'candidate-extraction-stage.v2',payload,pg_temp.english34_original());
 perform pg_temp.english34_reject(pg_temp.english34_job(),'candidate-extraction-stage.v2',pg_temp.english34_payload(),jsonb_set(pg_temp.english34_original(),'{source_asset_id}','"8e340000-0000-4000-8000-000000000099"'));
 job:=pg_temp.english34_job();job.input_hash:=repeat('f',64);
 perform pg_temp.english34_reject(job,'candidate-extraction-stage.v2',pg_temp.english34_payload(),pg_temp.english34_original());
end$$;
-- No public helper/table grants. Existing configuration remains disabled.
do $$declare principal text;routine regprocedure;begin
 foreach principal in array array['anon','authenticated','service_role']loop
  perform pg_temp.english34_assert(not has_table_privilege(principal,'eps.presentation_video_english_transcripts','SELECT,INSERT,UPDATE,DELETE'));
  foreach routine in array array['eps.validate_candidate_english_transcript(eps.jobs,text,jsonb,jsonb)'::regprocedure,
   'eps.capture_presentation_video_english_transcripts(uuid)'::regprocedure,'eps.presentation_video_english_transcript(uuid,uuid)'::regprocedure]loop
   perform pg_temp.english34_assert(not has_function_privilege(principal,routine,'EXECUTE'));
  end loop;
 end loop;
 perform pg_temp.english34_assert((select bool_and(english_transcript_version is null)from eps.candidate_asset_config));
 perform pg_temp.english34_assert((select relrowsecurity and relforcerowsecurity from pg_class where oid='eps.presentation_video_english_transcripts'::regclass));
end$$;
select'ENGLISH34_VALIDATOR_REGRESSIONS_PASSED_SYNTHETIC_ONLY';
