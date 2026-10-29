-- Typed private payload validation and fenced commit. No facts/transcript in jobs.
grant execute on function eps.cast_facts(jsonb),eps.check_input(jsonb,text[]),eps.specs_stage_strings(jsonb) to eps_candidate_stage_owner;
create function eps.candidate_stage_asset_reference(p_ref jsonb,p_job eps.jobs,p_purpose text,p_attempt uuid) returns boolean
language sql volatile security definer set search_path='' as $$
 select exists(select 1 from eps.media_assets a where a.id::text=p_ref->>'asset_id' and a.origin_workspace_id=p_job.workspace_id
  and a.purpose=p_purpose and a.status='ready' and a.source_asset_id=p_job.input_asset_id and a.producing_job_id=p_job.id and a.producing_attempt_id=p_attempt
  and a.sha256=p_ref->>'sha256' and a.mime_type=p_ref->>'mime_type' and a.size_bytes::text=p_ref->>'size_bytes')
$$;
create function eps.candidate_validate_stage(p_job eps.jobs,p_schema text,p_payload jsonb) returns void
language plpgsql volatile security definer set search_path='' as $$
declare prepared eps.candidate_stage_payloads;transcribed eps.candidate_stage_payloads;ref jsonb;item jsonb;source eps.media_assets;duration bigint;ordinal bigint;metadata jsonb;begin
 perform eps.specs_stage_assert(jsonb_typeof(p_payload)='object' and octet_length(p_payload::text)<=393216 and p_payload->>'source_asset_id'=p_job.input_asset_id::text,'RESULT_INVALID');
 select * into strict source from eps.media_assets where id=p_job.input_asset_id;
 if p_job.stage='prepare_candidate' then
  perform eps.specs_stage_assert(p_schema='media-preparation.v1' and eps.specs_stage_shape(p_payload,
   array['source_asset_id','source_sha256','probe','audio_chunks','sampled_frames','warnings','implementation_version','ffmpeg_version'],
   array['source_asset_id','source_sha256','probe','audio_chunks','sampled_frames','warnings','implementation_version','ffmpeg_version'])
   and p_payload->>'source_sha256'~'^[a-f0-9]{64}$' and (p_job.input->'source_declared_sha256'='null' or p_payload->>'source_sha256'=p_job.input->>'source_declared_sha256')
   and p_payload->>'implementation_version'='video-preparation.v1' and length(p_payload->>'ffmpeg_version') between 1 and 500
   and jsonb_typeof(p_payload->'audio_chunks')='array' and jsonb_array_length(p_payload->'audio_chunks')<=16
   and jsonb_typeof(p_payload->'sampled_frames')='array' and jsonb_array_length(p_payload->'sampled_frames')<=12
   and eps.specs_stage_strings(p_payload->'warnings') and jsonb_array_length(p_payload->'warnings')<=100,'RESULT_INVALID');
  item:=p_payload->'probe';perform eps.specs_stage_assert(eps.specs_stage_shape(item,array['duration_ms','width','height','rotation_degrees','frame_rate','video_codec','audio_codec','has_audio','container','source_start_ms'])
   and eps.specs_stage_integer(item->'duration_ms',1,1800000) and eps.specs_stage_integer(item->'width',1,4096) and eps.specs_stage_integer(item->'height',1,4096)
   and item->>'rotation_degrees' in('0','90','180','270') and jsonb_typeof(item->'frame_rate')='number' and (item->>'frame_rate')::numeric between 0.001 and 120
   and jsonb_typeof(item->'has_audio')='boolean' and jsonb_typeof(item->'video_codec')='string' and length(item->>'video_codec') between 1 and 100
   and jsonb_typeof(item->'container')='string' and length(item->>'container') between 1 and 200 and eps.specs_stage_integer(item->'source_start_ms',0,1800000),'RESULT_INVALID');
  duration:=(item->>'duration_ms')::bigint;ordinal:=0;
  for ref in select value from jsonb_array_elements(p_payload->'audio_chunks') loop
   perform eps.specs_stage_assert(ref->>'index'=ordinal::text and eps.candidate_stage_asset_reference(ref,p_job,'audio',p_job.current_attempt_id)
    and eps.specs_stage_integer(ref->'start_ms',0,duration) and eps.specs_stage_integer(ref->'end_ms',1,duration)
    and (ref->>'end_ms')::bigint>(ref->>'start_ms')::bigint and (ref->>'end_ms')::bigint-(ref->>'start_ms')::bigint<=120000,'RESULT_INVALID');ordinal:=ordinal+1;
  end loop;
  for ref in select value from jsonb_array_elements(p_payload->'sampled_frames') loop
   perform eps.specs_stage_assert(exists(select 1 from eps.media_assets a where a.id::text=ref->>'frame_asset_id' and a.purpose='candidate_frame' and a.status='ready'
    and a.source_asset_id=source.id and a.producing_job_id=p_job.id and a.producing_attempt_id=p_job.current_attempt_id and a.output_stage='prepare_candidate'
    and a.sha256=ref->>'sha256' and a.source_timestamp_ms::text=ref->>'timestamp_ms' and a.width::text=ref->>'width' and a.height::text=ref->>'height'
    and a.source_timestamp_ms<duration) and ref->>'source_asset_id'=source.id::text and jsonb_typeof(ref->'quality')='object'
    and ref#>>'{quality,difference_hash}'~'^[a-f0-9]{16}$' and jsonb_typeof(ref#>'{quality,luminance}')='number'
    and jsonb_typeof(ref#>'{quality,contrast}')='number' and jsonb_typeof(ref#>'{quality,sharpness}')='number','RESULT_INVALID');
  end loop;
  perform eps.specs_stage_assert((select count(*)=count(distinct value->>'frame_asset_id') from jsonb_array_elements(p_payload->'sampled_frames')),'RESULT_INVALID');
  if source.status='ready' then perform eps.specs_stage_assert(source.sha256=p_payload->>'source_sha256' and source.duration_ms=duration and source.width=(item->>'width')::integer and source.height=(item->>'height')::integer,'RESULT_INVALID');
  else update eps.media_assets set status='ready',sha256=p_payload->>'source_sha256',width=(item->>'width')::integer,height=(item->>'height')::integer,duration_ms=duration where id=source.id and status='uploading';perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');end if;
 elsif p_job.stage='transcribe_candidate' then
  perform eps.specs_stage_assert(p_schema='candidate-transcript-stage.v1' and eps.specs_stage_shape(p_payload,
   array['source_asset_id','transcript_asset','original_transcript','languages','segment_count','timestamp_precision','missing_transcript_reason','provider_error_code','provider_metadata'],
   array['source_asset_id','transcript_asset','original_transcript','languages','segment_count','timestamp_precision','missing_transcript_reason','provider_metadata'])
   and p_payload->>'timestamp_precision'='chunk' and eps.specs_stage_strings(p_payload->'languages') and jsonb_array_length(p_payload->'languages')<=100
   and eps.specs_stage_integer(p_payload->'segment_count',0,1000) and jsonb_typeof(p_payload->'provider_metadata')='array' and jsonb_array_length(p_payload->'provider_metadata')<=16,'RESULT_INVALID');
  select * into strict prepared from eps.candidate_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='prepare_candidate';
  if p_payload->'original_transcript'='null' then
   perform eps.specs_stage_assert(p_payload->'transcript_asset'='null' and p_payload->'languages'='[]' and p_payload->>'segment_count'='0'
    and p_payload->>'missing_transcript_reason' in('NO_INTELLIGIBLE_AUDIO','TRANSCRIPTION_FAILED')
    and (not(p_payload?'provider_error_code') or p_payload->>'provider_error_code' in('TRANSCRIPTION_EMPTY','TRANSCRIPTION_RESULT_INVALID','OPENAI_ACCESS_DENIED','OPENAI_QUOTA_EXCEEDED','OPENAI_RATE_LIMITED','OPENAI_TIMEOUT','OPENAI_UNAVAILABLE','OPENAI_REQUEST_REJECTED'))
    and (not(coalesce(p_payload->>'provider_error_code','') in('OPENAI_RATE_LIMITED','OPENAI_TIMEOUT','OPENAI_UNAVAILABLE')) or coalesce((p_job.stage_attempts->>'transcribe_candidate')::integer,0)>=3),'RESULT_INVALID');
  else
   ref:=p_payload->'original_transcript';perform eps.specs_stage_assert(eps.specs_stage_shape(ref,array['source_asset_id','segments','original_text','languages','timestamp_precision'])
    and ref->>'source_asset_id'=source.id::text and ref->>'timestamp_precision'='chunk' and jsonb_typeof(ref->'original_text')='string'
    and length(ref->>'original_text') between 1 and 200000 and ref->'languages'=p_payload->'languages' and jsonb_typeof(ref->'segments')='array'
    and jsonb_array_length(ref->'segments')=(p_payload->>'segment_count')::integer and (p_payload->>'segment_count')::integer between 1 and 1000
    and p_payload->'missing_transcript_reason'='null' and eps.candidate_stage_asset_reference(p_payload->'transcript_asset',p_job,'transcript',p_job.current_attempt_id),'RESULT_INVALID');
   ordinal:=0;for item in select value from jsonb_array_elements(ref->'segments') loop
    perform eps.specs_stage_assert(eps.specs_stage_shape(item,array['index','start_ms','end_ms','text']) and item->>'index'=ordinal::text
     and eps.specs_stage_integer(item->'start_ms',0,source.duration_ms) and eps.specs_stage_integer(item->'end_ms',1,source.duration_ms)
     and (item->>'end_ms')::bigint>(item->>'start_ms')::bigint and jsonb_typeof(item->'text')='string' and length(btrim(item->>'text')) between 1 and 200000
     and exists(select 1 from jsonb_array_elements(prepared.payload->'audio_chunks') chunk where chunk->'start_ms'=item->'start_ms' and chunk->'end_ms'=item->'end_ms'),'RESULT_INVALID');ordinal:=ordinal+1;
   end loop;
  end if;
 elsif p_job.stage='extract_candidate' then
  perform eps.specs_stage_assert(p_schema='candidate-extraction-stage.v1' and eps.specs_stage_shape(p_payload,array['source_asset_id','result','metadata','manual_profile_required','provider_metadata','missing_extraction_reason','provider_error_code'],array['source_asset_id','result']),'RESULT_INVALID');
  select * into strict transcribed from eps.candidate_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='transcribe_candidate';
  if p_payload->'result'='null' then perform eps.specs_stage_assert(p_payload->'manual_profile_required'='true'
   and (transcribed.payload->'original_transcript'='null' or p_payload->>'missing_extraction_reason'='CANDIDATE_EXTRACTION_FAILED'
    and p_payload->>'provider_error_code' in('OPENAI_ACCESS_DENIED','OPENAI_QUOTA_EXCEEDED','OPENAI_RATE_LIMITED','OPENAI_TIMEOUT','OPENAI_UNAVAILABLE','OPENAI_REQUEST_REJECTED',
     'AI_REFUSAL','AI_RESULT_INVALID','AI_EVIDENCE_INVALID','AI_EVIDENCE_MISSING','AI_SOURCE_MISMATCH','AI_RESPONSE_INVALID','AI_RESPONSE_NOT_COMPLETE','AI_OUTPUT_UNEXPECTED'))
   and (not(coalesce(p_payload->>'provider_error_code','') in('OPENAI_RATE_LIMITED','OPENAI_TIMEOUT','OPENAI_UNAVAILABLE')) or coalesce((p_job.stage_attempts->>'extract_candidate')::integer,0)>=3),'RESULT_INVALID');
  else
   item:=p_payload->'result';perform eps.specs_stage_assert(eps.specs_stage_shape(item,array['schema_version','source_asset_id','facts','project_availability_statement','evidence','uncertainties'])
    and item->>'schema_version'='1.0' and item->>'source_asset_id'=source.id::text and jsonb_typeof(item->'evidence')='array' and jsonb_array_length(item->'evidence')<=1000
    and jsonb_typeof(item->'uncertainties')='array' and jsonb_array_length(item->'uncertainties')<=1000,'RESULT_INVALID');
   perform eps.cast_facts(item->'facts');
   -- Final apply independently verifies every field/quote against original segments.
   metadata:=p_payload->'metadata';perform eps.specs_stage_assert(metadata->>'provider'='openai' and metadata->>'sdk_version'='7.45.1'
    and metadata->>'requested_model'=p_job.input#>>'{configuration,extraction_model}' and metadata->>'input_sha256'=p_job.input_hash,'RESULT_INVALID');
  end if;
 elsif p_job.stage='select_frames' then
  perform eps.specs_stage_assert(p_schema='frame-selection-stage.v1' and eps.specs_stage_shape(p_payload,array['schema_version','source_asset_id','selected_frames','insufficient_frames_reason'])
   and p_payload->>'schema_version'='1.0' and jsonb_typeof(p_payload->'selected_frames')='array' and jsonb_array_length(p_payload->'selected_frames')<=3
   and (jsonb_array_length(p_payload->'selected_frames')=3 or length(btrim(p_payload->>'insufficient_frames_reason'))>0),'RESULT_INVALID');
  select * into strict prepared from eps.candidate_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='prepare_candidate';
  for ref in select value from jsonb_array_elements(p_payload->'selected_frames') loop
   perform eps.specs_stage_assert(eps.specs_stage_shape(ref,array['frame_asset_id','reason']) and length(btrim(ref->>'reason')) between 1 and 2000
    and exists(select 1 from jsonb_array_elements(prepared.payload->'sampled_frames') frame where frame->>'frame_asset_id'=ref->>'frame_asset_id'),'RESULT_INVALID');
  end loop;
  perform eps.specs_stage_assert((select count(*)=count(distinct value->>'frame_asset_id') from jsonb_array_elements(p_payload->'selected_frames')),'RESULT_INVALID');
 else perform eps.specs_stage_assert(p_schema='candidate-application.v1' and eps.specs_stage_shape(p_payload,array['source_asset_id']),'RESULT_INVALID');end if;
end $$;

create function eps.record_candidate_job_event(p_event jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;previous eps.job_events;event_receipt jsonb;digest_value text;event_attempt uuid;event_sequence bigint;at_value timestamptz;
 safe_error jsonb;attempts integer;payload_id uuid;next_stage text;application jsonb;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_event,array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash','result_schema','result','error'],array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash'])
  and octet_length(p_event::text)<=409600 and p_event->>'stage' in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate')
  and p_event->>'event_type' in('heartbeat','progress','succeeded','failed') and eps.specs_stage_integer(p_event->'sequence',1)
  and length(p_event->>'event_id') between 1 and 200 and p_event->>'lease_token'~'^[a-f0-9]{64}$' and p_event->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.candidate_stage_lock((p_event->>'job_id')::uuid);event_attempt:=(p_event->>'attempt_id')::uuid;event_sequence:=(p_event->>'sequence')::bigint;at_value:=clock_timestamp();
 digest_value:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into previous from eps.job_events where job_id=job.id and attempt_id=event_attempt and event_id=p_event->>'event_id';
 if found then perform eps.specs_stage_assert(previous.payload_digest=digest_value,'EVENT_ID_CONFLICT');return previous.receipt||'{"duplicate":true,"applied":false}'::jsonb;end if;
 perform eps.specs_stage_assert(not exists(select 1 from eps.job_events where job_id=job.id and attempt_id=event_attempt and sequence=event_sequence),'EVENT_SEQUENCE_CONFLICT');
 event_receipt:=jsonb_build_object('event_id',p_event->>'event_id','applied',false,'duplicate',false,'stale',false,'job_status',job.status);
 if job.status<>'running' or job.cancel_requested_at is not null or job.current_attempt_id<>event_attempt or job.stage<>p_event->>'stage' or job.lease_expires_at<=at_value then return event_receipt||'{"stale":true}'::jsonb;end if;
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_event->>'lease_token','UTF8')),'hex'),'LEASE_INVALID');
 perform eps.specs_stage_assert(job.input_hash=p_event->>'input_hash','INPUT_HASH_MISMATCH');
 if event_sequence<=job.last_event_sequence then return event_receipt||'{"stale":true}'::jsonb;end if;
 if not eps.candidate_stage_source_matches(job) then job.status:='waiting_for_input';safe_error:=eps.specs_stage_error('INPUT_CHANGED');
 elsif p_event->>'event_type'='heartbeat' then
  perform eps.specs_stage_assert(not(p_event?'result') and not(p_event?'result_schema') and coalesce(p_event->'error','null')='null');
  job.heartbeat_at:=at_value;job.lease_expires_at:=at_value+interval '90 seconds';
 elsif p_event->>'event_type'='progress' then
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_event->'result',array['progress_completed','progress_total'])
   and eps.specs_stage_integer(p_event#>'{result,progress_completed}',job.progress_completed) and (p_event#>'{result,progress_total}'='null' or eps.specs_stage_integer(p_event#>'{result,progress_total}',(p_event#>>'{result,progress_completed}')::bigint)),'INVALID_PROGRESS');
  job.progress_completed:=(p_event#>>'{result,progress_completed}')::bigint;job.progress_total:=(p_event#>>'{result,progress_total}')::bigint;
 elsif p_event->>'event_type'='failed' then
  perform eps.specs_stage_assert(not(p_event?'result') and eps.specs_stage_shape(p_event->'error',array['code','message','details','retryable'])
   and jsonb_typeof(p_event#>'{error,code}')='string' and length(p_event#>>'{error,code}') between 1 and 200
   and jsonb_typeof(p_event#>'{error,message}')='string' and length(p_event#>>'{error,message}') between 1 and 2000
   and jsonb_typeof(p_event#>'{error,details}')='object' and octet_length((p_event#>'{error,details}')::text)<=16384
   and jsonb_typeof(p_event#>'{error,retryable}')='boolean');
  safe_error:=eps.specs_stage_error(p_event#>>'{error,code}',(p_event#>>'{error,retryable}')::boolean,p_event#>'{error,details,retry_after_seconds}');
 else
  begin
   perform eps.candidate_validate_stage(job,p_event->>'result_schema',p_event->'result');
   if job.stage='apply_candidate' then application:=eps.apply_candidate_scan(job.id,event_attempt,p_event->>'lease_token',job.input_hash,p_event->'result');end if;
   insert into eps.candidate_stage_payloads(workspace_id,job_id,stage,attempt_id,input_hash,result_schema,payload)
    values(job.workspace_id,job.id,job.stage,event_attempt,job.input_hash,p_event->>'result_schema',p_event->'result') returning id into payload_id;
  exception when raise_exception then
   if sqlerrm in('RESULT_INVALID','INVALID_REQUEST','CANDIDATE_SCAN_INVALID') then safe_error:=eps.specs_stage_error('RESULT_INVALID');
   elsif sqlerrm in('INPUT_CHANGED','STALE_RESOURCE_VERSION') then job.status:='waiting_for_input';safe_error:=eps.specs_stage_error('INPUT_CHANGED');else raise;end if;
  end;
  if safe_error is null then
   job.completed_stages:=job.completed_stages||jsonb_build_array(jsonb_build_object('stage',job.stage,'attempt_id',event_attempt,'input_hash',job.input_hash,
    'result_schema',p_event->>'result_schema','result',jsonb_build_object('stage_output_id',payload_id),'completed_at',at_value));
   next_stage:=case job.stage when 'prepare_candidate' then 'transcribe_candidate' when 'transcribe_candidate' then 'extract_candidate' when 'extract_candidate' then 'select_frames' when 'select_frames' then 'apply_candidate' else null end;
   if next_stage is null then job.status:='succeeded';job.result:=application;
   else job.status:='queued';job.stage:=next_stage;job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value;job.progress_completed:=0;job.progress_total:=null;end if;
   job.lease_token_digest:=null;job.lease_expires_at:=null;
  end if;
 end if;
 if safe_error is not null then
  job.error:=safe_error;job.lease_token_digest:=null;job.lease_expires_at:=null;
  if job.status<>'waiting_for_input' then
   attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);
   if safe_error->'retryable'='true' and attempts<3 then job.status:='queued';job.dispatch_generation:=job.dispatch_generation+1;
    job.available_at:=at_value+make_interval(secs=>least(300,2*power(2,greatest(attempts-1,0)))::double precision);
   else job.status:='failed';end if;
  end if;
 end if;
 update eps.jobs set status=job.status,stage=job.stage,completed_stages=job.completed_stages,result=job.result,error=job.error,
  last_event_sequence=event_sequence,heartbeat_at=job.heartbeat_at,lease_expires_at=job.lease_expires_at,lease_token_digest=job.lease_token_digest,
  available_at=job.available_at,dispatch_generation=job.dispatch_generation,progress_completed=job.progress_completed,progress_total=job.progress_total,row_version=row_version+1,updated_at=at_value where id=job.id;
 if job.status='queued' then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)
  values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;
 event_receipt:=event_receipt||jsonb_build_object('applied',true,'job_status',job.status);
 insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)
  values(job.id,event_attempt,p_event->>'event_id',event_sequence,p_event->>'stage',p_event->>'event_type',digest_value,event_receipt);
 return event_receipt;
end $$;
