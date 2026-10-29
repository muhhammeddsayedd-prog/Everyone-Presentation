"""Fixed read-only M03 metadata observer. Run only when root requests capture.

No source/filename/fact/transcript/provider body/credential or raw diagnostic
escapes. Failed/partial jobs remain visible; capture is not an accuracy verdict.
Import and offline tests perform no network operation.
"""
import datetime,hashlib,json,math,re,sys,uuid
from release_foundation import ROOT,TARGET,call
SQL='tools/sql/m03-live-readback.sql'
SQL_SHA256='16434bad7d3c466bf7778d74afec946cfbef2f423b6d58a3eb152b12939a5456'
CLI_SHA256='02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751'
PROTECTED_BASELINE='tracking/evidence/m02/specs-protection/2026-10-29T07-41-19-350729+00-00-72ea632b-metadata.json'
PROTECTED_BASELINE_SHA256='ed1808fcaf6be97391439d27f98f34656f1b40cd711c03df94ae1879246b6351'
WORKSPACE='e470aefd-e0f7-480c-bf0d-170cb2cb7069'
PROJECT='bd14d10f-b1c5-4d6a-8b4d-e5c48208433c'
EVIDENCE=ROOT/'tracking/evidence/m03/live-capture'
STAGES=['prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate']
TOP=set('observed_at query_role database workspace_id project_id job_count configuration protected_m02 jobs'.split())
FIELDS=TOP|set(('enabled transcription_model extraction_model prompt_version schema_version media_implementation_version '
 'job_checkpoint_unchanged spec_checkpoint_unchanged manual_note_retained job_id input_sha256 source_asset_id upload_id batch_id '
 'status stage attempt_count row_version created_at updated_at n8n_execution_id error_code error_sha256 cancel_requested '
 'stage_attempts completed_stages attempt_id result_schema completed_at input_hash_matches stage_output_id attempts '
 'first_at last_at first_sequence last_sequence events heartbeats progress_events succeeded_events failed_events '
 'outbox outbox_id dispatch_generation delivered_at last_error_present source asset_id size_bytes sha256 duration_ms width height '
 'private_path_bound frozen_source_matches preparation payload_id payload_sha256 implementation_version ffmpeg_version_sha256 '
 'ffmpeg_version source_sha256_matches has_audio rotation_degrees audio_chunk_count sampled_frame_count warning_count '
 'providers ordinal provider sdk_version requested_model resolved_model prompt_sha256 schema_sha256 provider_schema_sha256 response_id_sha256 request_id_sha256 '
 'requested_model_matches_frozen usage_input_tokens usage_output_tokens usage_total_tokens transcription transcript_asset_id '
 'transcript_asset_sha256 transcript_asset_ready_matches_reference timestamp_precision_chunk original_text_sha256 segment_count has_arabic has_latin missing_transcript segment_bounds_valid '
 'extraction missing_extraction facts_sha256 populated_fact_count unknown_fact_count age_unknown height_unknown city_unknown '
 'uncertainty_count evidence_count all_evidence_locators_grounded all_populated_fields_have_evidence application candidate_media_id '
 'candidate_id private_transcript_preserved extracted_result_preserved age_as_of_unknown reviewed selected_frame_count '
 'registered_frame_count processing_issue_count has_no_audio_issue has_transcription_issue has_extraction_issue has_frame_shortfall_issue '
 'participation_id participation_media_is_this_media pinned_media_belongs_candidate pinned_frames_registered frames timestamp_ms ready selected '
 'within_source_duration source_and_job_match preparation_reference_matches').split())|set(STAGES)
ENUMS=set(('postgres queued running waiting_for_input succeeded failed cancelled pending leased delivered dead uploading ready '
 'quarantined archived open completed INPUT_CHANGED RESULT_INVALID DEPENDENCY_UNAVAILABLE SOURCE_UNREADABLE RETRY_EXHAUSTED '
 'JOB_CANCELLED STAGE_FAILED CAPABILITY_REQUIRED INPUT_HASH_MISMATCH UNRECOGNIZED openai media-preparation.v1 '
 'candidate-transcript-stage.v1 candidate-extraction-stage.v1 frame-selection-stage.v1 candidate-application.v1').split())|set(STAGES)
VERSION_KEYS=set('transcription_model extraction_model prompt_version schema_version media_implementation_version implementation_version ffmpeg_version sdk_version requested_model resolved_model'.split())
UUID=re.compile(r'[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}')
def require(value):
    if not value:raise ValueError('M03_LIVE_METADATA_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def validate(proof):
    require(isinstance(proof,dict) and set(proof)==TOP and proof['query_role']==proof['database']=='postgres')
    require(proof['workspace_id']==WORKSPACE and proof['project_id']==PROJECT)
    require(type(proof['job_count']) is int and 1<=proof['job_count']<=64 and isinstance(proof['jobs'],list) and len(proof['jobs'])==proof['job_count'])
    require(len({row.get('job_id') for row in proof['jobs']})==proof['job_count'])
    for job in proof['jobs']:require(isinstance(job,dict) and UUID.fullmatch(job.get('job_id','')) and job.get('status') in ('queued','running','waiting_for_input','succeeded','failed','cancelled') and job.get('stage') in STAGES)
    require(set(proof['protected_m02'])=={'job_checkpoint_unchanged','spec_checkpoint_unchanged','manual_note_retained'})
    def walk(value,key='',depth=0):
        require(depth<=14)
        if isinstance(value,dict):
            require(set(value)<=FIELDS)
            for name,child in value.items():walk(child,name,depth+1)
        elif isinstance(value,list):
            require(len(value)<=4096)
            for child in value:walk(child,key,depth+1)
        elif value is None or type(value) is bool:return
        elif type(value) in (int,float):require(math.isfinite(value) and 0<=value<=9007199254740991)
        elif isinstance(value,str):
            if key.endswith('sha256'):require(re.fullmatch(r'[a-f0-9]{64}',value))
            elif key=='n8n_execution_id':require(re.fullmatch(r'[A-Za-z0-9._:-]{1,200}',value))
            elif key.endswith('_id'):require(UUID.fullmatch(value))
            elif key.endswith('_at'):require(datetime.datetime.fromisoformat(value.replace('Z','+00:00')).tzinfo is not None)
            elif key in VERSION_KEYS:require(re.fullmatch(r'[A-Za-z0-9._:+~-]{1,200}',value))
            else:require(value in ENUMS)
        else:require(False)
    walk(proof);return proof
def summarize(proof):
    jobs=proof['jobs'];outcomes={status:sum(row['status']==status for row in jobs) for status in ['queued','running','waiting_for_input','succeeded','failed','cancelled']}
    summaries=[]
    for job in jobs:
        complete=job.get('completed_stages') or [];applied=job.get('application');extracted=job.get('extraction');transcript=job.get('transcription')
        summaries.append({'job_id':job['job_id'],'status':job['status'],
          'five_stages_committed':len(complete)==5 and {row.get('stage') for row in complete}==set(STAGES),
          'source_ready':bool(job.get('source') and job['source'].get('status')=='ready'),
          'provider_metadata_rows':len(job.get('providers') or []),
          'transcript_present':bool(transcript and transcript.get('missing_transcript') is False),
          'extraction_present':bool(extracted and extracted.get('missing_extraction') is False),
          'grounded_locators':None if not extracted else extracted.get('all_evidence_locators_grounded'),
          'candidate_media_applied':applied is not None,
          'partial_material':bool(applied and applied.get('processing_issue_count',0)>0)})
    return {'outcomes':outcomes,'jobs':summaries,'protected_m02_unchanged':all(value is True for value in proof['protected_m02'].values())}
def main():
    require(sys.argv[1:]==[])
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    sql=(ROOT/SQL).read_bytes();require(sha(sql)==SQL_SHA256 and sha((ROOT/'tools/release_foundation.py').read_bytes())==CLI_SHA256)
    require(sha((ROOT/PROTECTED_BASELINE).read_bytes())==PROTECTED_BASELINE_SHA256)
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'result':'unconfirmed','read_only':True,
      'workspace_id':WORKSPACE,'project_id':PROJECT,'sql_sha256':SQL_SHA256,'harness_sha256':sha((ROOT/'tools/capture-m03-live.py').read_bytes()),
      'protected_m02_baseline':PROTECTED_BASELINE,'protected_m02_baseline_sha256':PROTECTED_BASELINE_SHA256,
      'cloud_called':False,'provider_called':False,'storage_http_called':False,'mutations_requested':False,'raw_private_payloads_recorded':False,
      'scope':'Actual fixed-workspace candidate jobs: canonical metadata only. No semantic accuracy, native image bytes or billing completeness claim.',
      'n8n_boundary':'Database retains the last workflow execution ID only; stage events/outbox metadata do not enumerate five individual workflow IDs.',
      'native_image_boundary':'Preparation records implementation and FFmpeg metadata; configured immutable image is evidenced separately by activation/launch receipts.'}
    label=report['observed_at'].replace(':','-').replace('.','-')+'-'+uuid.uuid4().hex[:8];EVIDENCE.mkdir(parents=True,exist_ok=True)
    try:
        report['cloud_called']=True;response=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/SQL),'--output-format','json'])
        if response.returncode!=0:
            raw=(response.stdout+'\n'+response.stderr)[:2*1024*1024]
            report['sql_failure']={'scope_or_no_jobs':'M03_LIVE_FIXED_SCOPE_OR_JOB_COUNT_UNCONFIRMED' in raw,'syntax_error':'syntax error' in raw.lower(),'permission_denied':'permission denied' in raw.lower()}
        require(response.returncode==0 and len(response.stdout.encode())<=2*1024*1024)
        rows=json.loads(response.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={'m03_live'})
        proof=validate(rows[0]['m03_live']);summary=summarize(proof);report.update(proof=proof,summary=summary)
        report['result']='captured' if summary['protected_m02_unchanged'] else 'failed_protection_check'
    except Exception:report['code']='M03_LIVE_METADATA_UNCONFIRMED'
    finally:
        file=EVIDENCE/(label+'.json');file.open('x',encoding='utf8').write(json.dumps(report,indent=2)+'\n')
        print(json.dumps({'result':report['result'],'receipt':file.relative_to(ROOT).as_posix(),'summary':report.get('summary'),'sql_failure':report.get('sql_failure'),'raw_private_payloads_recorded':False}))
    return 0 if report['result']=='captured' else 1
if __name__=='__main__':
    try:sys.exit(main())
    except Exception:sys.stderr.write('Fixed M03 metadata capture stopped; private diagnostics suppressed.\n');sys.exit(1)
