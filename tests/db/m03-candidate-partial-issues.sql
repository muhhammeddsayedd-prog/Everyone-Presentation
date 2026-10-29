-- Real SQL behavior with synthetic stage metadata, no provider or media bytes.
create function pg_temp.partial_candidate(label text,failed_stage text) returns jsonb language plpgsql as $$
declare created jsonb;source uuid;lease jsonb;prepared jsonb;ref jsonb;original jsonb;receipt jsonb;selected jsonb;applied jsonb;expected text[];medium eps.candidate_media;begin
 created:=pg_temp.new_candidate_upload(label);source:=(created->>'asset_id')::uuid;
 lease:=pg_temp.kernel_claim();prepared:=pg_temp.candidate_prepare(lease,true,true);
 receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',prepared,'media-preparation.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='queued','partial case prepare');
 lease:=pg_temp.kernel_claim();
 if failed_stage='transcription' then
  original:='null'::jsonb;expected:=array['TRANSCRIPTION_FAILED'];
  receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',source,'transcript_asset',null,'original_transcript',null,'languages','[]'::jsonb,'segment_count',0,'timestamp_precision','chunk','missing_transcript_reason','TRANSCRIPTION_FAILED','provider_error_code','OPENAI_REQUEST_REJECTED','provider_metadata','[]'::jsonb),'candidate-transcript-stage.v1'));
 else
  expected:=array['EXTRACTION_FAILED'];ref:=pg_temp.candidate_output(lease,'transcript','transcript');
  original:=jsonb_build_object('source_asset_id',source,'original_text','نص محفوظ. Original transcript remains available after extraction refusal.','segments',jsonb_build_array(jsonb_build_object('index',0,'start_ms',0,'end_ms',1000,'text','نص محفوظ. Original transcript remains available after extraction refusal.')),'languages','["ar","en"]'::jsonb,'timestamp_precision','chunk');
  receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',source,'transcript_asset',ref,'original_transcript',original,'languages','["ar","en"]'::jsonb,'segment_count',1,'timestamp_precision','chunk','missing_transcript_reason',null,'provider_metadata','[]'::jsonb),'candidate-transcript-stage.v1'));
 end if;
 perform pg_temp.kernel_assert(receipt->>'job_status'='queued','partial transcript stage retained');
 lease:=pg_temp.kernel_claim();
 receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',source,'result',null,'manual_profile_required',true)
  ||case when failed_stage='extraction' then jsonb_build_object('missing_extraction_reason','CANDIDATE_EXTRACTION_FAILED','provider_error_code','AI_REFUSAL','metadata',null) else jsonb_build_object('provider_metadata',null) end,'candidate-extraction-stage.v1'));
 perform pg_temp.kernel_assert(receipt->>'job_status'='queued','partial extraction stage retained');
 selected:=jsonb_build_object('schema_version','1.0','source_asset_id',source,'selected_frames',(select jsonb_agg(jsonb_build_object('frame_asset_id',frame->'frame_asset_id','reason','Synthetic available frame') order by ordinal) from jsonb_array_elements(prepared->'sampled_frames') with ordinality item(frame,ordinal)),'insufficient_frames_reason',null);
 lease:=pg_temp.kernel_claim();receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',selected,'frame-selection-stage.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='queued','partial useful frames retained');
 lease:=pg_temp.kernel_claim();receipt:=eps.record_job_event(pg_temp.kernel_event(lease,'succeeded',jsonb_build_object('source_asset_id',source),'candidate-application.v1'));perform pg_temp.kernel_assert(receipt->>'job_status'='succeeded','useful partial media can complete honestly');
 select result into applied from eps.jobs where id=(lease->>'job_id')::uuid;
 select * into strict medium from eps.candidate_media where id=(applied->>'candidate_media_id')::uuid;
 perform pg_temp.kernel_assert(medium.processing_issues=expected and cardinality(medium.selected_frame_asset_ids)=3,'persisted exact safe partial code and three available frames');
 if failed_stage='extraction' then perform pg_temp.kernel_assert(medium.original_transcript=original->>'original_text' and medium.transcript_asset_id is not null,'extraction refusal keeps original transcript and asset');
 else perform pg_temp.kernel_assert(medium.original_transcript is null and medium.transcript_asset_id is null,'transcription failure remains explicit unknown');end if;
 perform pg_temp.kernel_assert((select facts->'name'='null'::jsonb and reviewed_at is null and age_as_of is null from eps.candidates where id=medium.candidate_id),'partial case does not invent supplied facts or confirmation');
 perform pg_temp.kernel_assert(eps.cast_media_dto(medium.id)->'processing_issues'=to_jsonb(expected),'casting DTO exposes fixed codes for useful partial result');
 perform pg_temp.kernel_assert((select completed_stages::text not like '%AI_REFUSAL%' and completed_stages::text not like '%original_transcript%' from eps.jobs where id=(lease->>'job_id')::uuid),'raw private diagnostics/transcript absent from public completion metadata');
 return applied;
end $$;
select pg_temp.partial_candidate('partial-transcription','transcription') is not null;
select pg_temp.partial_candidate('partial-extraction','extraction') is not null;
select pg_temp.kernel_assert(exists(select 1 from eps.candidate_media where processing_issues=array['NO_AUDIO','INSUFFICIENT_FRAMES']),'silent zero-frame cases expose both safe missing-material codes');
select pg_temp.kernel_assert((select processing_issues='{}'::text[] from eps.candidate_media where id=current_setting('eps.behavior.media')::uuid),'successful grounded media reports no fabricated failure');
select 'CANDIDATE_SAFE_PARTIAL_PROCESSING_ISSUES_PASSED';
