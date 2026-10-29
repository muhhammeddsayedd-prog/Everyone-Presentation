-- Additive21: image-aware OpenAI frame-selection validation after exact20.
-- Preserve historical source/media, function attributes/ACLs, all configuration and runtime11.
-- No fixtures, keys, native image, provider execution, n8n or hosting changes.
-- Draft additive21, after reviewed M04 history20. No cloud/local apply is implied.
-- Three existing private function bodies and one safe technical-code CHECK change.
-- No columns/roles/ACL/config/key or original/selected media mutation. Vision metadata stays private.
set local search_path='';set local lock_timeout='3s';set local statement_timeout='30s';
do $baseline$
begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or (select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841']::text[]
 then raise exception 'FRAME_VISION_EXACT_REVIEWED_TWENTY_REQUIRED';end if;
 if not exists(select 1 from pg_proc p where p.oid='eps.candidate_validate_stage(eps.jobs,text,jsonb)'::regprocedure and p.proowner='eps_candidate_stage_owner'::regrole and p.prosecdef and p.provolatile='v' and not p.proleakproof and p.proconfig=array['search_path=""'] and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='589872c63d25ccb09c687a8d526de4fc2b9bdd1b920f6b29d2bdca5bc6c7dd4f')
  or not exists(select 1 from pg_proc p where p.oid='eps.get_candidate_stage_input(uuid,uuid,text)'::regprocedure and p.proowner='eps_candidate_stage_owner'::regrole and p.prosecdef and p.provolatile='v' and not p.proleakproof and p.proconfig=array['search_path=""'] and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='ada1115b9c21882720dfead385906a574074a6f8c2018423425bf1644d16dce4')
 then raise exception 'FRAME_VISION_PRIVATE_FUNCTION_BASELINE_CHANGED';end if;
end $baseline$;
do $forward$
declare definition text;old_text text;new_text text;before_validate jsonb;before_input jsonb;
begin
 select to_jsonb(p)-'prosrc' into before_validate from pg_proc p where p.oid='eps.candidate_validate_stage(eps.jobs,text,jsonb)'::regprocedure;
 select to_jsonb(p)-'prosrc' into before_input from pg_proc p where p.oid='eps.get_candidate_stage_input(uuid,uuid,text)'::regprocedure;
 definition:=replace(pg_get_functiondef('eps.candidate_validate_stage(eps.jobs,text,jsonb)'::regprocedure),E'\r\n',E'\n');
 old_text:=$old$eps.specs_stage_shape(p_payload,array['schema_version','source_asset_id','selected_frames','insufficient_frames_reason'])$old$;new_text:=$new$eps.specs_stage_shape(p_payload,array['schema_version','source_asset_id','selected_frames','insufficient_frames_reason','selection_method','metadata','provider_error_code'],array['schema_version','source_asset_id','selected_frames','insufficient_frames_reason'])$new$;
 old_text:=replace(old_text,E'\r\n',E'\n');new_text:=replace(new_text,E'\r\n',E'\n');
 if length(definition)-length(replace(definition,old_text,''))<>length(old_text)then raise exception 'FRAME_VISION_PAYLOAD_SHAPE_SEAM_CHANGED';end if;
 definition:=replace(definition,old_text,new_text);
 old_text:=$old$
 else perform eps.specs_stage_assert(p_schema='candidate-application.v1'$old$;new_text:=$new$
  if p_payload?'selection_method' then
   perform eps.specs_stage_assert(p_payload->>'selection_method' in('openai_vision','manual_required','no_frames') and p_payload?'metadata','RESULT_INVALID');
   if p_payload->>'selection_method'='openai_vision' then
    metadata:=p_payload->'metadata';
    perform eps.specs_stage_assert(eps.specs_stage_shape(metadata,array['provider','sdk_version','requested_model','resolved_model','request_id','response_id','prompt_version','prompt_sha256','schema_sha256','input_sha256','frame_input_sha256','usage'])
     and metadata->>'provider'='openai' and metadata->>'sdk_version'='7.45.1'
     and metadata->>'requested_model'=p_job.input#>>'{configuration,extraction_model}'
     and metadata->>'resolved_model'~'^[A-Za-z0-9._:-]{1,200}$' and metadata->>'response_id'~'^[A-Za-z0-9._:-]{1,200}$'
     and (metadata->'request_id'='null' or metadata->>'request_id'~'^[A-Za-z0-9._:-]{1,200}$')
     and metadata->>'prompt_version'='frame_selection_vision_v1' and metadata->>'prompt_sha256'='3c650e433d05e80abca3c880fc4bf86df215b5b504eb906cd98e01f00a442538'
     and metadata->>'schema_sha256'~'^[a-f0-9]{64}$' and metadata->>'input_sha256'=p_job.input_hash
     and metadata->>'frame_input_sha256'=(select encode(sha256(convert_to(string_agg((frame->>'frame_asset_id')||E'\n'||(frame->>'source_asset_id')||E'\n'||(frame->>'timestamp_ms')||E'\n'||(frame->>'width')||E'\n'||(frame->>'height')||E'\n'||(frame->>'sha256'),E'\n\n' order by ord),'UTF8')),'hex') from jsonb_array_elements(prepared.payload->'sampled_frames') with ordinality f(frame,ord))
     and not(p_payload?'provider_error_code') and jsonb_array_length(prepared.payload->'sampled_frames')>0,'RESULT_INVALID');
    if metadata->'usage'<>'null' then
     perform eps.specs_stage_assert(eps.specs_stage_shape(metadata->'usage',array['input_tokens','output_tokens','total_tokens'])
      and eps.specs_stage_integer(metadata#>'{usage,input_tokens}',0,9007199254740991) and eps.specs_stage_integer(metadata#>'{usage,output_tokens}',0,9007199254740991)
      and eps.specs_stage_integer(metadata#>'{usage,total_tokens}',0,9007199254740991)
      and (metadata#>>'{usage,total_tokens}')::bigint=(metadata#>>'{usage,input_tokens}')::bigint+(metadata#>>'{usage,output_tokens}')::bigint,'RESULT_INVALID');
    end if;
    for ref in select value from jsonb_array_elements(p_payload->'selected_frames') loop
     perform eps.specs_stage_assert(ref->>'reason' in('Clear frontal source frame.','Clear wider source frame.','Clear profile source frame.','Clear distinct source framing.'),'RESULT_INVALID');
    end loop;
    perform eps.specs_stage_assert(case when jsonb_array_length(p_payload->'selected_frames')=3 then p_payload->'insufficient_frames_reason'='null'
     else p_payload->>'insufficient_frames_reason'='Fewer than three clear, distinct source frames are available.' end,'RESULT_INVALID');
   elsif p_payload->>'selection_method'='manual_required' then
    perform eps.specs_stage_assert(p_payload->'metadata'='null' and p_payload->'selected_frames'='[]'
     and p_payload->>'insufficient_frames_reason'='Automatic frame review was unavailable; choose real source frames manually.'
     and p_payload->>'provider_error_code' in('AI_REFUSAL','AI_FRAME_RESULT_INVALID','AI_FRAME_REFERENCE_INVALID','AI_SOURCE_MISMATCH','AI_RESPONSE_NOT_COMPLETE','AI_OUTPUT_UNEXPECTED',
      'OPENAI_ACCESS_DENIED','OPENAI_QUOTA_EXCEEDED','OPENAI_RATE_LIMITED','OPENAI_TIMEOUT','OPENAI_UNAVAILABLE','OPENAI_REQUEST_REJECTED')
     and (p_payload->>'provider_error_code' not in('OPENAI_RATE_LIMITED','OPENAI_TIMEOUT','OPENAI_UNAVAILABLE') or coalesce((p_job.stage_attempts->>'select_frames')::integer,0)>=3),'RESULT_INVALID');
   else
    perform eps.specs_stage_assert(p_payload->'metadata'='null' and p_payload->'selected_frames'='[]' and jsonb_array_length(prepared.payload->'sampled_frames')=0
     and p_payload->>'insufficient_frames_reason'='No real source frames were prepared; manual material selection remains available.' and not(p_payload?'provider_error_code'),'RESULT_INVALID');
   end if;
  else
   -- Cached event ACK replay happens before this validator. Only a matching
   -- retained historical payload may use the old four-key contract here;
   -- a fresh callback cannot silently downgrade image review to heuristics.
   perform eps.specs_stage_assert(not(p_payload?'metadata') and not(p_payload?'provider_error_code')
    and exists(select 1 from eps.candidate_stage_payloads historical where historical.job_id=p_job.id and historical.input_hash=p_job.input_hash
     and historical.stage='select_frames' and historical.result_schema=p_schema and historical.payload=p_payload),'RESULT_INVALID');
  end if;
 else perform eps.specs_stage_assert(p_schema='candidate-application.v1'$new$;
 old_text:=replace(old_text,E'\r\n',E'\n');new_text:=replace(new_text,E'\r\n',E'\n');
 if length(definition)-length(replace(definition,old_text,''))<>length(old_text)then raise exception 'FRAME_VISION_VALIDATION_SEAM_CHANGED';end if;
 execute replace(definition,old_text,new_text);
 definition:=replace(pg_get_functiondef('eps.get_candidate_stage_input(uuid,uuid,text)'::regprocedure),E'\r\n',E'\n');
 old_text:=$old$'allow_partial_extraction',coalesce((job.stage_attempts->>'extract_candidate')::integer,0)>=3);$old$;new_text:=$new$'allow_partial_extraction',coalesce((job.stage_attempts->>'extract_candidate')::integer,0)>=3,
   'allow_partial_frame_selection',coalesce((job.stage_attempts->>'select_frames')::integer,0)>=3);$new$;
 old_text:=replace(old_text,E'\r\n',E'\n');new_text:=replace(new_text,E'\r\n',E'\n');
 if length(definition)-length(replace(definition,old_text,''))<>length(old_text)then raise exception 'FRAME_VISION_PARTIAL_INPUT_SEAM_CHANGED';end if;
 execute replace(definition,old_text,new_text);
 if (select to_jsonb(p)-'prosrc' from pg_proc p where p.oid='eps.candidate_validate_stage(eps.jobs,text,jsonb)'::regprocedure)is distinct from before_validate
  or (select to_jsonb(p)-'prosrc' from pg_proc p where p.oid='eps.get_candidate_stage_input(uuid,uuid,text)'::regprocedure)is distinct from before_input
 then raise exception 'FRAME_VISION_PRIVATE_FUNCTION_ATTRIBUTES_CHANGED';end if;
end $forward$;

-- Public readers receive only a fixed technical outcome, never provider detail.
do $public_issue_baseline$
begin
 if not exists(select 1 from pg_proc p where p.oid='eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)'::regprocedure
  and p.proowner='eps_candidate_apply_owner'::regrole and p.prosecdef and p.provolatile='v' and not p.proleakproof and p.proconfig=array['search_path=""']
  and encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='8eda11a2c488b1d99d1f5ca17350124a082be192ae24a57e63e24d0c15506770')
 then raise exception 'FRAME_VISION_APPLY_FUNCTION_BASELINE_CHANGED';end if;
 if not exists(select 1 from pg_constraint c where c.conrelid='eps.candidate_media'::regclass and c.conname='candidate_media_processing_issues_check'and c.contype='c'and c.convalidated
  and encode(sha256(convert_to(pg_get_constraintdef(c.oid),'UTF8')),'hex')='60cae19b6b16531e21d2b1f3b1c4c096b3c980e4d5bfd788953dee0bbbff76f2')
 then raise exception 'FRAME_VISION_PUBLIC_ISSUE_BASELINE_CHANGED';end if;
end $public_issue_baseline$;
alter table eps.candidate_media drop constraint candidate_media_processing_issues_check;
alter table eps.candidate_media add constraint candidate_media_processing_issues_check
 check(cardinality(processing_issues)<=5 and processing_issues<@array['NO_AUDIO','TRANSCRIPTION_FAILED','EXTRACTION_FAILED','INSUFFICIENT_FRAMES','FRAME_SELECTION_UNAVAILABLE']::text[]);
do $public_issue_forward$
declare definition text;old_text text;new_text text;before_apply jsonb;
begin
 select to_jsonb(p)-'prosrc'into before_apply from pg_proc p where p.oid='eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)'::regprocedure;
 definition:=replace(pg_get_functiondef('eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)'::regprocedure),E'\r\n',E'\n');
 old_text:=$old$ if cardinality(chosen_frames)<3 then issues:=array_append(issues,'INSUFFICIENT_FRAMES');end if;$old$;
 new_text:=old_text||E'\n'||$new$ if selected.payload->>'selection_method'='manual_required' then issues:=array_append(issues,'FRAME_SELECTION_UNAVAILABLE');end if;$new$;
 old_text:=replace(old_text,E'\r\n',E'\n');new_text:=replace(new_text,E'\r\n',E'\n');
 if length(definition)-length(replace(definition,old_text,''))<>length(old_text)then raise exception 'FRAME_VISION_PUBLIC_ISSUE_SOURCE_SEAM_CHANGED';end if;
 execute replace(definition,old_text,new_text);
 if(select to_jsonb(p)-'prosrc'from pg_proc p where p.oid='eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)'::regprocedure)is distinct from before_apply
 then raise exception 'FRAME_VISION_APPLY_FUNCTION_ATTRIBUTES_CHANGED';end if;
end $public_issue_forward$;
