-- Fixed authorized project/workspace. IDs, hashes, technical counts/booleans,
-- bounded enum/version identifiers only. No names, filenames, facts or text.
begin isolation level repeatable read read only;
set local statement_timeout='20s';set local search_path='';set local timezone='UTC';
do $scope$begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
  array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500']::text[]
  or not exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id where w.id='e470aefd-e0f7-480c-bf0d-170cb2cb7069' and p.id='bd14d10f-b1c5-4d6a-8b4d-e5c48208433c' and w.archived_at is null and p.archived_at is null)
  or (select count(*) from eps.jobs where workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069' and kind='candidate_scan') not between 1 and 64
  or exists(select 1 from eps.jobs where workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069' and kind='candidate_scan' and (created_at<'2026-10-29T10:49:21Z' or input->>'project_id'<>'bd14d10f-b1c5-4d6a-8b4d-e5c48208433c'))
 then raise exception 'M03_LIVE_FIXED_SCOPE_OR_JOB_COUNT_UNCONFIRMED';end if;
end $scope$;
with jobs as(select * from eps.jobs where workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069' and kind='candidate_scan'),
payloads as(select p.* from eps.candidate_stage_payloads p join jobs j on j.id=p.job_id and j.input_hash=p.input_hash),
prepared as(select * from payloads where stage='prepare_candidate'),
transcribed as(select * from payloads where stage='transcribe_candidate'),
extracted as(select * from payloads where stage='extract_candidate'),
selected as(select * from payloads where stage='select_frames'),
refs as(select p.job_id,e.value->>'field_path' field_path,e.value->'source' locator from extracted p cross join lateral jsonb_array_elements(coalesce(p.payload#>'{result,evidence}','[]')) e(value)),
grounded as(select r.job_id,r.field_path,
 r.locator->>'asset_id'=j.input_asset_id::text and exists(select 1 from transcribed t cross join lateral jsonb_array_elements(coalesce(t.payload#>'{original_transcript,segments}','[]')) s(value)
  where t.job_id=j.id and s.value->'index'=r.locator->'segment_index' and s.value->'start_ms'=r.locator->'start_ms' and s.value->'end_ms'=r.locator->'end_ms'
   and nullif(btrim(r.locator->>'quote'),'') is not null and position(r.locator->>'quote' in s.value->>'text')>0) valid
 from refs r join jobs j on j.id=r.job_id),
provider_rows as(
 select t.job_id,'transcribe_candidate'::text stage,t.attempt_id,m.ordinal,m.value metadata from transcribed t cross join lateral jsonb_array_elements(coalesce(t.payload->'provider_metadata','[]')) with ordinality m(value,ordinal)
 union all select e.job_id,'extract_candidate',e.attempt_id,1,e.payload->'metadata' from extracted e where jsonb_typeof(e.payload->'metadata')='object'),
attempts as(select e.job_id,e.stage,e.attempt_id,min(e.created_at) first_at,max(e.created_at) last_at,min(e.sequence) first_sequence,max(e.sequence) last_sequence,
 count(*) events,count(*) filter(where e.event_type='heartbeat') heartbeats,count(*) filter(where e.event_type='progress') progress_events,
 count(*) filter(where e.event_type='succeeded') succeeded_events,count(*) filter(where e.event_type='failed') failed_events
 from eps.job_events e join jobs j on j.id=e.job_id group by e.job_id,e.stage,e.attempt_id)
select jsonb_build_object('observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
 'workspace_id','e470aefd-e0f7-480c-bf0d-170cb2cb7069','project_id','bd14d10f-b1c5-4d6a-8b4d-e5c48208433c',
 'job_count',(select count(*) from jobs),
 'configuration',(select jsonb_build_object('enabled',enabled,
  'transcription_model',case when transcription_model~'^[A-Za-z0-9._:+~-]{1,200}$' then transcription_model end,
  'extraction_model',case when extraction_model~'^[A-Za-z0-9._:+~-]{1,200}$' then extraction_model end,
  'prompt_version',prompt_version,'schema_version',schema_version,'media_implementation_version',media_implementation_version) from eps.candidate_asset_config where id),
 'protected_m02',jsonb_build_object(
  'job_checkpoint_unchanged',exists(select 1 from eps.jobs j where j.id='b3f90268-147d-41d4-8875-2a6435df1496' and j.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80' and j.status='waiting_for_input' and j.stage='apply_specs' and j.error->>'code'='INPUT_CHANGED' and j.row_version=7 and j.current_attempt_id='72ef4d43-7f0b-4e5b-9248-4e347b40c0ba' and j.stage_attempts='{"prepare_document":1,"extract_specs":1,"apply_specs":1}'::jsonb and (select jsonb_agg(v.value->>'stage' order by v.ordinal) from jsonb_array_elements(j.completed_stages) with ordinality v(value,ordinal))='["prepare_document","extract_specs"]'::jsonb),
  'spec_checkpoint_unchanged',exists(select 1 from eps.specs s where s.id='73a1a500-acfe-48cc-91ba-53a83b895118' and s.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80' and s.row_version=16 and s.source_row_version=9 and s.processing_job_id='b3f90268-147d-41d4-8875-2a6435df1496' and encode(sha256(convert_to(s.normalized_instructions,'UTF8')),'hex')='da8207eb46c2f43e524057238e1476d6261071b0bef2ae176adda174073b18af' and encode(sha256(convert_to(s.source_extraction::text,'UTF8')),'hex')='e33771fd7d806eb56b01f1143e05d48b5561df4bdec622996ca0ba52123df29f'),
  'manual_note_retained',exists(select 1 from eps.specs where id='73a1a500-acfe-48cc-91ba-53a83b895118' and position('Manual verification: preserve this instruction while extraction is pending.' in normalized_instructions)>0)),
 'jobs',(select coalesce(jsonb_agg(jsonb_build_object(
  'job_id',j.id,'input_sha256',j.input_hash,'source_asset_id',j.input_asset_id,'upload_id',j.resource_id,'batch_id',j.batch_id,
  'status',j.status,'stage',j.stage,'attempt_count',j.attempt,'row_version',j.row_version,'created_at',j.created_at,'updated_at',j.updated_at,
  'n8n_execution_id',case when j.n8n_execution_id~'^[A-Za-z0-9._:-]{1,200}$' then j.n8n_execution_id end,
  'error_code',case when j.error is null then null when j.error->>'code' in('INPUT_CHANGED','RESULT_INVALID','DEPENDENCY_UNAVAILABLE','SOURCE_UNREADABLE','RETRY_EXHAUSTED','JOB_CANCELLED','STAGE_FAILED','CAPABILITY_REQUIRED','INPUT_HASH_MISMATCH') then j.error->>'code' else 'UNRECOGNIZED' end,
  'error_sha256',case when j.error is not null then encode(sha256(convert_to(j.error::text,'UTF8')),'hex') end,
  'cancel_requested',j.cancel_requested_at is not null,
  'configuration',jsonb_build_object(
   'transcription_model',case when j.input#>>'{configuration,transcription_model}'~'^[A-Za-z0-9._:+~-]{1,200}$' then j.input#>>'{configuration,transcription_model}' end,
   'extraction_model',case when j.input#>>'{configuration,extraction_model}'~'^[A-Za-z0-9._:+~-]{1,200}$' then j.input#>>'{configuration,extraction_model}' end,
   'prompt_version',j.input#>>'{configuration,prompt_version}','schema_version',j.input#>>'{configuration,schema_version}','media_implementation_version',j.input#>>'{configuration,media_implementation_version}'),
  'stage_attempts',jsonb_build_object('prepare_candidate',coalesce(j.stage_attempts->'prepare_candidate','0'),'transcribe_candidate',coalesce(j.stage_attempts->'transcribe_candidate','0'),'extract_candidate',coalesce(j.stage_attempts->'extract_candidate','0'),'select_frames',coalesce(j.stage_attempts->'select_frames','0'),'apply_candidate',coalesce(j.stage_attempts->'apply_candidate','0')),
  'completed_stages',(select coalesce(jsonb_agg(jsonb_build_object('stage',v.value->>'stage','attempt_id',v.value->>'attempt_id','result_schema',v.value->>'result_schema','completed_at',v.value->'completed_at','input_hash_matches',v.value->>'input_hash'=j.input_hash,'stage_output_id',v.value#>>'{result,stage_output_id}') order by v.ordinal),'[]') from jsonb_array_elements(j.completed_stages) with ordinality v(value,ordinal)),
  'attempts',(select coalesce(jsonb_agg(jsonb_build_object('stage',a.stage,'attempt_id',a.attempt_id,'first_at',a.first_at,'last_at',a.last_at,'first_sequence',a.first_sequence,'last_sequence',a.last_sequence,'events',a.events,'heartbeats',a.heartbeats,'progress_events',a.progress_events,'succeeded_events',a.succeeded_events,'failed_events',a.failed_events) order by a.first_at,a.stage,a.attempt_id),'[]') from attempts a where a.job_id=j.id),
  'outbox',(select coalesce(jsonb_agg(jsonb_build_object('outbox_id',o.id,'stage',o.stage,'status',o.status,'dispatch_generation',o.dispatch_generation,'attempt_count',o.attempt_count,'input_hash_matches',o.input_hash=j.input_hash,'delivered_at',o.delivered_at,'last_error_present',o.last_error is not null) order by o.dispatch_generation),'[]') from eps.outbox_events o where o.job_id=j.id),
  'source',(select jsonb_build_object('asset_id',a.id,'status',a.status,'size_bytes',a.size_bytes,'sha256',a.sha256,'duration_ms',a.duration_ms,'width',a.width,'height',a.height,
   'private_path_bound',a.bucket='eps-candidate-assets' and a.object_key like 'assets/'||a.id::text||'/original.%',
   'frozen_source_matches',a.origin_workspace_id=j.workspace_id and a.size_bytes::text=j.input->>'source_size_bytes' and a.mime_type=j.input->>'source_mime_type' and (j.input->'source_declared_sha256'='null' or a.sha256=j.input->>'source_declared_sha256')) from eps.media_assets a where a.id=j.input_asset_id),
  'preparation',(select jsonb_build_object('payload_id',p.id,'attempt_id',p.attempt_id,'payload_sha256',encode(sha256(convert_to(p.payload::text,'UTF8')),'hex'),'implementation_version',p.payload->>'implementation_version',
   'ffmpeg_version_sha256',encode(sha256(convert_to(p.payload->>'ffmpeg_version','UTF8')),'hex'),
   'ffmpeg_version',case when split_part(p.payload->>'ffmpeg_version',' ',3)~'^[A-Za-z0-9._:+~-]{1,100}$' then split_part(p.payload->>'ffmpeg_version',' ',3) end,
   'source_sha256_matches',p.payload->>'source_sha256'=(select sha256 from eps.media_assets where id=j.input_asset_id),
   'duration_ms',p.payload#>'{probe,duration_ms}','width',p.payload#>'{probe,width}','height',p.payload#>'{probe,height}','has_audio',p.payload#>'{probe,has_audio}','rotation_degrees',p.payload#>'{probe,rotation_degrees}',
   'audio_chunk_count',jsonb_array_length(p.payload->'audio_chunks'),'sampled_frame_count',jsonb_array_length(p.payload->'sampled_frames'),'warning_count',jsonb_array_length(p.payload->'warnings')) from prepared p where p.job_id=j.id),
  'providers',(select coalesce(jsonb_agg(jsonb_build_object('stage',p.stage,'attempt_id',p.attempt_id,'ordinal',p.ordinal,
   'provider',case when p.metadata->>'provider'='openai' then 'openai' end,'sdk_version',case when p.metadata->>'sdk_version'='7.45.1' then '7.45.1' end,
   'requested_model',case when p.metadata->>'requested_model'~'^[A-Za-z0-9._:+~-]{1,200}$' then p.metadata->>'requested_model' end,
   'resolved_model',case when p.metadata->>'resolved_model'~'^[A-Za-z0-9._:+~-]{1,200}$' then p.metadata->>'resolved_model' end,
   'prompt_version',case when p.metadata->>'prompt_version'~'^[A-Za-z0-9._:+~-]{1,200}$' then p.metadata->>'prompt_version' end,
   'prompt_sha256',case when p.metadata->>'prompt_sha256'~'^[a-f0-9]{64}$' then p.metadata->>'prompt_sha256' end,
   'schema_sha256',case when p.metadata->>'schema_sha256'~'^[a-f0-9]{64}$' then p.metadata->>'schema_sha256' end,
   'provider_schema_sha256',case when p.metadata->>'provider_schema_sha256'~'^[a-f0-9]{64}$' then p.metadata->>'provider_schema_sha256' end,
   'input_sha256',case when p.metadata->>'input_sha256'~'^[a-f0-9]{64}$' then p.metadata->>'input_sha256' end,
   'response_id_sha256',case when p.metadata->>'response_id' is not null then encode(sha256(convert_to(p.metadata->>'response_id','UTF8')),'hex') end,
   'request_id_sha256',case when p.metadata->>'request_id' is not null then encode(sha256(convert_to(p.metadata->>'request_id','UTF8')),'hex') end,
   'input_hash_matches',case when p.stage='transcribe_candidate' then exists(select 1 from prepared prep cross join lateral jsonb_array_elements(prep.payload->'audio_chunks') chunk(value) where prep.job_id=j.id and (chunk.value->>'index')::integer+1=p.ordinal and chunk.value->>'sha256'=p.metadata->>'input_sha256') else p.metadata->>'input_sha256'=j.input_hash end,
   'requested_model_matches_frozen',p.metadata->>'requested_model'=j.input#>>array['configuration',case when p.stage='transcribe_candidate' then 'transcription_model' else 'extraction_model' end],
   'usage_input_tokens',case when p.metadata#>>'{usage,input_tokens}'~'^[0-9]{1,15}$' then (p.metadata#>>'{usage,input_tokens}')::bigint end,
   'usage_output_tokens',case when p.metadata#>>'{usage,output_tokens}'~'^[0-9]{1,15}$' then (p.metadata#>>'{usage,output_tokens}')::bigint end,
   'usage_total_tokens',case when p.metadata#>>'{usage,total_tokens}'~'^[0-9]{1,15}$' then (p.metadata#>>'{usage,total_tokens}')::bigint end) order by p.stage,p.ordinal),'[]') from provider_rows p where p.job_id=j.id),
  'transcription',(select jsonb_build_object('payload_id',t.id,'attempt_id',t.attempt_id,'payload_sha256',encode(sha256(convert_to(t.payload::text,'UTF8')),'hex'),
   'transcript_asset_id',t.payload#>>'{transcript_asset,asset_id}','transcript_asset_sha256',t.payload#>>'{transcript_asset,sha256}',
   'transcript_asset_ready_matches_reference',exists(select 1 from eps.media_assets a where a.id::text=t.payload#>>'{transcript_asset,asset_id}' and a.status='ready' and a.sha256=t.payload#>>'{transcript_asset,sha256}' and a.source_asset_id=j.input_asset_id and a.producing_job_id=j.id),
   'timestamp_precision_chunk',t.payload->>'timestamp_precision'='chunk',
   'original_text_sha256',case when t.payload#>>'{original_transcript,original_text}' is not null then encode(sha256(convert_to(t.payload#>>'{original_transcript,original_text}','UTF8')),'hex') end,
   'segment_count',t.payload->'segment_count','has_arabic',coalesce(t.payload#>>'{original_transcript,original_text}'~('['||chr(1536)||'-'||chr(1791)||']'),false),
   'has_latin',coalesce(t.payload#>>'{original_transcript,original_text}'~'[A-Za-z]',false),'missing_transcript',t.payload->'original_transcript'='null',
   'segment_bounds_valid',not exists(select 1 from jsonb_array_elements(coalesce(t.payload#>'{original_transcript,segments}','[]')) s(value) where (s.value->>'start_ms')::bigint<0 or (s.value->>'end_ms')::bigint<=(s.value->>'start_ms')::bigint or (s.value->>'end_ms')::bigint>(select duration_ms from eps.media_assets where id=j.input_asset_id))) from transcribed t where t.job_id=j.id),
  'extraction',(select jsonb_build_object('payload_id',e.id,'attempt_id',e.attempt_id,'payload_sha256',encode(sha256(convert_to(e.payload::text,'UTF8')),'hex'),'missing_extraction',e.payload->'result'='null',
   'facts_sha256',case when jsonb_typeof(e.payload#>'{result,facts}')='object' then encode(sha256(convert_to((e.payload#>'{result,facts}')::text,'UTF8')),'hex') end,
   'populated_fact_count',(select count(*) from jsonb_each(coalesce(e.payload#>'{result,facts}','{}')) f(key,value) where f.value<>'null' and f.value<>'[]'),
   'unknown_fact_count',(select count(*) from jsonb_each(coalesce(e.payload#>'{result,facts}','{}')) f(key,value) where f.value='null' or f.value='[]'),
   'age_unknown',e.payload#>'{result,facts,age_or_range}'='null','height_unknown',e.payload#>'{result,facts,height_measurements}'='null','city_unknown',e.payload#>'{result,facts,city}'='null',
   'uncertainty_count',jsonb_array_length(coalesce(e.payload#>'{result,uncertainties}','[]')),
   'evidence_count',(select count(*) from grounded g where g.job_id=j.id),'all_evidence_locators_grounded',(select coalesce(bool_and(g.valid),true) from grounded g where g.job_id=j.id),
   'all_populated_fields_have_evidence',not exists(select 1 from jsonb_each(coalesce(e.payload#>'{result,facts}','{}')) f(key,value) where f.value<>'null' and f.value<>'[]' and not exists(select 1 from refs r where r.job_id=j.id and r.field_path='facts.'||f.key))) from extracted e where e.job_id=j.id),
  'application',(select jsonb_build_object('candidate_media_id',m.id,'candidate_id',m.candidate_id,'transcript_asset_id',m.transcript_asset_id,'row_version',m.row_version,
   'original_text_sha256',case when m.original_transcript is not null then encode(sha256(convert_to(m.original_transcript,'UTF8')),'hex') end,
   'private_transcript_preserved',m.original_transcript is not distinct from (select t.payload#>>'{original_transcript,original_text}' from transcribed t where t.job_id=j.id),
   'extracted_result_preserved',m.extraction is not distinct from (select nullif(e.payload->'result','null') from extracted e where e.job_id=j.id),
   'facts_sha256',encode(sha256(convert_to(c.facts::text,'UTF8')),'hex'),'age_as_of_unknown',c.age_as_of is null,'reviewed',c.reviewed_facts_fingerprint is not null,
   'selected_frame_count',cardinality(m.selected_frame_asset_ids),'registered_frame_count',(select count(*) from eps.candidate_media_frames f where f.candidate_media_id=m.id),
   'processing_issue_count',cardinality(m.processing_issues),'has_no_audio_issue','NO_AUDIO'=any(m.processing_issues),'has_transcription_issue','TRANSCRIPTION_FAILED'=any(m.processing_issues),'has_extraction_issue','EXTRACTION_FAILED'=any(m.processing_issues),'has_frame_shortfall_issue','INSUFFICIENT_FRAMES'=any(m.processing_issues),
   'participation_id',w.id,'participation_media_is_this_media',w.selected_candidate_media_id=m.id,
   'pinned_media_belongs_candidate',w.selected_candidate_media_id is null or exists(select 1 from eps.candidate_media pin where pin.id=w.selected_candidate_media_id and pin.candidate_id=w.candidate_id),
   'pinned_frames_registered',not exists(select 1 from unnest(w.selected_frame_asset_ids) frame_id where not exists(select 1 from eps.candidate_media_frames f where f.candidate_media_id=w.selected_candidate_media_id and f.asset_id=frame_id)),
   'frames',(select coalesce(jsonb_agg(jsonb_build_object('asset_id',a.id,'sha256',a.sha256,'timestamp_ms',a.source_timestamp_ms,'width',a.width,'height',a.height,'ready',a.status='ready','selected',a.id=any(m.selected_frame_asset_ids),
    'within_source_duration',a.source_timestamp_ms>=0 and a.source_timestamp_ms<(select duration_ms from eps.media_assets where id=j.input_asset_id),
    'source_and_job_match',a.source_asset_id=j.input_asset_id and a.producing_job_id=j.id,
    'preparation_reference_matches',exists(select 1 from prepared p cross join lateral jsonb_array_elements(p.payload->'sampled_frames') f(value) where p.job_id=j.id and f.value->>'frame_asset_id'=a.id::text and f.value->>'sha256'=a.sha256 and (f.value->>'timestamp_ms')::bigint=a.source_timestamp_ms)) order by a.source_timestamp_ms,a.id),'[]') from eps.candidate_media_frames f join eps.media_assets a on a.id=f.asset_id where f.candidate_media_id=m.id))
   from eps.candidate_media m join eps.candidates c on c.id=m.candidate_id left join eps.workspace_candidates w on w.workspace_id=j.workspace_id and w.candidate_id=m.candidate_id and w.archived_at is null where m.source_job_id=j.id)
 ) order by j.created_at,j.id),'[]') from jobs j)
) as m03_live;
rollback;
