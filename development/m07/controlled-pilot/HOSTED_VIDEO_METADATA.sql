-- Read-only metadata for the one owner-authorized hosted upload. No facts,
-- transcript, image bytes, storage paths, grants, credentials or source text.
begin read only;
set local statement_timeout='20s';
set local search_path='';
select jsonb_build_object(
 'read_only',current_setting('transaction_read_only')='on',
 'database',current_database(),'operator',current_user,
 'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'job',(select jsonb_build_object('id',id,'kind',kind,'status',status,'stage',stage,
   'attempt',attempt,'resource_id',resource_id,'workspace_id',workspace_id,
   'created_at',created_at,'updated_at',updated_at,'n8n_execution_id',n8n_execution_id,
   'progress_completed',progress_completed,'progress_total',progress_total)
   from eps.jobs where id='fa8593ca-80c2-4cb3-8bcc-0e357ffbf7f2'
    and workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa' and kind='candidate_scan'),
 'stages',(select jsonb_agg(jsonb_build_object(
   'stage',stage,'attempt_id',attempt_id,'input_hash',input_hash,'result_schema',result_schema,'created_at',created_at,
   'metadata',payload->'metadata','transcription_provider_metadata',payload->'provider_metadata',
   'audio_chunks_count',case when jsonb_typeof(payload->'audio_chunks')='array'then jsonb_array_length(payload->'audio_chunks')end,
   'sampled_frames_count',case when jsonb_typeof(payload->'sampled_frames')='array'then jsonb_array_length(payload->'sampled_frames')end,
   'selected_frames_count',case when jsonb_typeof(payload->'selected_frames')='array'then jsonb_array_length(payload->'selected_frames')end,
   'selection_method',payload->>'selection_method','media_implementation_version',payload->>'implementation_version',
   'ffmpeg_version',payload->>'ffmpeg_version','segment_count',payload->'segment_count',
   'manual_profile_required',payload->'manual_profile_required','provider_error_code',payload->>'provider_error_code'
 )order by created_at,stage)from eps.candidate_stage_payloads
 where job_id='fa8593ca-80c2-4cb3-8bcc-0e357ffbf7f2' and workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa')
)as hosted_video_metadata;
rollback;
