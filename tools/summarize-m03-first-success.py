"""Derive bounded public metadata from the sealed fourth-job capture. No IO service."""
import datetime,hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CAPTURE='tracking/evidence/m03/live-capture/2026-10-29T11-44-13-156066+00-00-8b24096b.json'
SEAL='184bc12503a6949b48d2af4a7c3284600a6cb49737e9d813ad2afd44c0f4e116'
JOB='55415ff2-e049-468f-a0a1-7240fba350b0'
def main():
 data=(ROOT/CAPTURE).read_bytes();assert hashlib.sha256(data).hexdigest()==SEAL
 capture=json.loads(data);proof=capture['proof'];job=next(row for row in proof['jobs'] if row['job_id']==JOB)
 source=job['source'];transcript=job['transcription'];extraction=job['extraction'];application=job['application'];frames=application['frames']
 stages={'prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'}
 extraction_provider=next(row for row in job['providers'] if row['stage']=='extract_candidate')
 transcription_provider=next(row for row in job['providers'] if row['stage']=='transcribe_candidate')
 checks={'job_succeeded':job['status']=='succeeded',
  'five_stages_committed':len(job['completed_stages'])==5 and {row['stage'] for row in job['completed_stages']}==stages,
  'one_attempt_per_stage':set(job['stage_attempts'])==stages and all(value==1 for value in job['stage_attempts'].values()),
  'five_matching_deliveries':len(job['outbox'])==5 and {row['stage'] for row in job['outbox']}==stages and all(row['status']=='delivered' and row['input_hash_matches'] is True for row in job['outbox']),
  'original_ready_frozen_and_private':source['status']=='ready' and source['frozen_source_matches'] is True and source['private_path_bound'] is True,
  'private_original_transcript_preserved':transcript['missing_transcript'] is False and transcript['transcript_asset_ready_matches_reference'] is True and application['private_transcript_preserved'] is True,
  'source_chunk_bounds_valid':transcript['timestamp_precision_chunk'] is True and transcript['segment_bounds_valid'] is True,
  'four_populated_seven_unknown_fields':extraction['populated_fact_count']==4 and extraction['unknown_fact_count']==7,
  'four_grounded_evidence_locators':extraction['evidence_count']==4 and extraction['all_evidence_locators_grounded'] is True and extraction['all_populated_fields_have_evidence'] is True,
  'registered_frame_references_valid':len(frames)==12 and all(all(frame[key] is True for key in ['ready','within_source_duration','source_and_job_match','preparation_reference_matches']) for frame in frames),
  'three_selected_frames_pinned':sum(frame['selected'] is True for frame in frames)==3 and application['selected_frame_count']==3 and application['pinned_frames_registered'] is True and application['pinned_media_belongs_candidate'] is True and application['participation_media_is_this_media'] is True,
  'unreviewed_and_age_date_unknown':application['reviewed'] is False and application['age_as_of_unknown'] is True,
  'no_processing_issue_codes':application['processing_issue_count']==0,
  'protected_m02_checkpoint_unchanged':all(value is True for value in proof['protected_m02'].values())}
 assert all(checks.values())
 elapsed=round((datetime.datetime.fromisoformat(job['updated_at'])-datetime.datetime.fromisoformat(job['created_at'])).total_seconds()*1000)
 summary={'result':'canonical_pipeline_metadata_verified','observed_at':proof['observed_at'],'derived_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'scope':'First actual authorized Arabic-source app job completing the five-stage pipeline. Canonical metadata proof only; visual/playback and semantic accuracy are separate.',
  'capture':CAPTURE,'capture_sha256':SEAL,'job_id':JOB,'workspace_id':proof['workspace_id'],'project_id':proof['project_id'],
  'source_asset_id':source['asset_id'],'source_sha256':source['sha256'],'source_size_bytes':source['size_bytes'],'source_duration_ms':source['duration_ms'],
  'durable_created_to_terminal_update_ms':elapsed,'candidate_id':application['candidate_id'],'candidate_media_id':application['candidate_media_id'],
  'transcript_asset_id':transcript['transcript_asset_id'],'transcript_asset_sha256':transcript['transcript_asset_sha256'],'original_text_sha256':transcript['original_text_sha256'],
  'transcript_has_arabic':transcript['has_arabic'],'transcript_has_latin':transcript['has_latin'],'segment_count':transcript['segment_count'],
  'populated_fact_count':extraction['populated_fact_count'],'unknown_fact_count':extraction['unknown_fact_count'],'evidence_count':extraction['evidence_count'],
  'registered_frame_count':len(frames),'distinct_frame_sha256_count':len({frame['sha256'] for frame in frames}),'selected_frame_count':application['selected_frame_count'],
  'selected_frame_timestamps_ms':[frame['timestamp_ms'] for frame in frames if frame['selected']],
  'extraction_provider':{key:extraction_provider[key] for key in ['provider','sdk_version','requested_model','resolved_model','prompt_version','prompt_sha256','provider_schema_sha256','usage_input_tokens','usage_output_tokens','usage_total_tokens']},
  'transcription_provider':{'provider':transcription_provider['provider'],'sdk_version':transcription_provider['sdk_version'],'requested_model':transcription_provider['requested_model'],
   'public_capture_token_usage_absent':all(transcription_provider[key] is None for key in ['usage_input_tokens','usage_output_tokens','usage_total_tokens']),
   'owner_attested_committed_job_usage_seconds':20,'usage_seconds_provenance':'Root read the private committed app-job provider metadata; the fixed public SQL does not project seconds. This is separate from the direct service probe.'},
  'checks':checks,'historical_failed_app_jobs_retained':3,'third_failed_job_exact_cause_unknown':True,'third_failed_job_provider_invocation_unknown':True,
  'project_billing_complete':False,'visual_frame_quality_verified_by_this_summary':False,'playback_verified_by_this_summary':False,
  'factual_semantic_accuracy_verified_by_this_summary':False,'english_or_mixed_live_coverage_verified_by_this_summary':False,'whole_m03_acceptance_verified_by_this_summary':False,
  'cloud_provider_storage_or_browser_called_by_summary':False,'raw_private_content_recorded':False}
 file=ROOT/'tracking/evidence/m03/live-capture/first-success-metadata-summary.json';file.open('x',encoding='utf8').write(json.dumps(summary,indent=2)+'\n')
 print(json.dumps({'result':summary['result'],'summary':file.relative_to(ROOT).as_posix(),'checks_passed':len(checks),'cloud_called':False}))
if __name__=='__main__':main()
