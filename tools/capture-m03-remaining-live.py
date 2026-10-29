"""Fixed19 read-only two-workspace M03 observer; root runs after review.

Only allowlisted identifiers, hashes, technical measurements and usage metadata
can reach a public receipt. Old observers/receipts remain immutable. Import and
offline tests perform no CLI, database, provider, Storage or configuration call.
"""
import datetime,hashlib,json,math,re,sys,uuid
from release_foundation import ROOT,TARGET,call
SQL='tools/sql/m03-remaining-live-readback.sql'
SQL_SHA256='d92846579d62f748284595394d03be6dda33a9372ef487f226ff59ef771f4b49'
CLI_SHA256='02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751'
WORKSPACE='e470aefd-e0f7-480c-bf0d-170cb2cb7069'
OTHER_WORKSPACE='098d5b48-42a3-475b-b562-735c9eafce80'
SCOPES={WORKSPACE:'bd14d10f-b1c5-4d6a-8b4d-e5c48208433c',OTHER_WORKSPACE:'4b70c8ce-18bd-4a8c-b5a9-bc1156c06463'}
FIXED_JOB='fdc6e813-b074-4f8a-ba4d-2622a271bd81'
SOURCE_SHA256='f62a0fc95c1df06c08d92d73c749b992d58daecd4f66a0ef43ce9878d265d14a'
SOURCE_BYTES=37253969
D5='d5e665b3-dc23-4ead-858e-81abbce55743'
D5_MEDIA='26d210e8-f0cc-4f87-b9df-beb3dbca75d8'
D5_FRAMES=['e6285fb5-eb94-4fb0-90ab-27475cd51842','fde2909c-d113-4094-9e8b-ae4ffe4feef6','d1906651-1d9d-4954-9dbe-1b7da7a4eab3']
BASELINE='tracking/evidence/m03/remaining-activation/2026-10-29T14-32-31-436430Z-91a4e91f-frame-db-enable.json'
BASELINE_SHA256='3c93deec049be043027e8dcd2c2a83f162e4ad67847d4a5c3695c1b60f1473d7'
REUSE_BASELINE='tracking/evidence/m03/remaining-app/scanned-reuse-two-frames.json'
REUSE_BASELINE_SHA256='8662ecf7e13f7707c067aa8533ef4384a6ad672a6243e563cdf58ff9754b9841'
PROTECTED_BASELINE='tracking/evidence/m02/specs-protection/2026-10-29T07-41-19-350729+00-00-72ea632b-metadata.json'
PROTECTED_BASELINE_SHA256='ed1808fcaf6be97391439d27f98f34656f1b40cd711c03df94ae1879246b6351'
OLD_SEALS={'tools/capture-m03-live.py':'d54121365fdf41efb02fc0dce50566c3428c097a6f01c2544996e075f3e03677','tools/sql/m03-live-readback.sql':'16434bad7d3c466bf7778d74afec946cfbef2f423b6d58a3eb152b12939a5456'}
EVIDENCE=ROOT/'tracking/evidence/m03/remaining-live-capture'
CANDIDATE_STAGES=['prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate']
FRAME_STAGES=['extract_frames','apply_frames']
STAGES=CANDIDATE_STAGES+FRAME_STAGES
TOP=set('observed_at query_role database scopes job_count configuration frame_configuration protected_m02 candidate_rows_sha256 workspace_candidate_rows_sha256 participations jobs'.split())
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

FIELDS|=set(('scopes workspace_id project_id kind resource_id target_candidate_id correlation_sha256 candidate_rows_sha256 workspace_candidate_rows_sha256 '
 'participations selected_candidate_media_id selected_frame_asset_ids availability_sha256 frame_configuration native_image_id '
 'upload intent_count_for_source asset_count_for_source scan_job_count_for_source frame_outcome requested_count extracted_count '
 'unavailable_count unavailable_timestamps_ms warnings frame_asset_ids frame_geometry sample_aspect_ratio display_aspect_ratio '
 'numerator denominator frame_requests requested_timestamp_ms actual_timestamp_ms frame_asset_id unavailable frame_outputs '
 'initial_selected_frame_asset_ids processing_issues source_start_ms frame_rate').split())
ENUMS|=set(('candidate_scan frame_extract extract_frames apply_frames frame-extraction-stage.v1 frame-application.v1 '
 'NO_AUDIO TRANSCRIPTION_FAILED EXTRACTION_FAILED INSUFFICIENT_FRAMES FRAME_TIMESTAMP_SHARED FRAME_TIMESTAMP_UNAVAILABLE '
 'PROCESSING_FAILED INVALID_TRANSITION STALE_RESOURCE_VERSION STALE_STAGE_LEASE LEASE_INVALID').split())
JOB_FIELDS=set(('job_id kind workspace_id project_id input_sha256 source_asset_id resource_id upload_id batch_id target_candidate_id '
 'correlation_sha256 status stage attempt_count row_version created_at updated_at n8n_execution_id error_code error_sha256 cancel_requested '
 'configuration stage_attempts completed_stages attempts outbox source upload frame_outcome frame_geometry frame_requests frame_outputs '
 'initial_selected_frame_asset_ids preparation providers transcription extraction application').split())
ISSUES={'NO_AUDIO','TRANSCRIPTION_FAILED','EXTRACTION_FAILED','INSUFFICIENT_FRAMES'}
WARNINGS={'FRAME_TIMESTAMP_SHARED','FRAME_TIMESTAMP_UNAVAILABLE'}
MAXIMUM_BYTES=8*1024*1024
SCHEMAS={'media-preparation.v1','candidate-transcript-stage.v1','candidate-extraction-stage.v1','frame-selection-stage.v1','candidate-application.v1','frame-extraction-stage.v1','frame-application.v1'}
INTEGER_FIELDS=set(('ordinal row_version size_bytes duration_ms width height timestamp_ms first_sequence last_sequence '
 'events heartbeats progress_events succeeded_events failed_events dispatch_generation source_start_ms rotation_degrees numerator denominator').split())
BOOLEAN_FIELDS=set(('enabled job_checkpoint_unchanged spec_checkpoint_unchanged manual_note_retained cancel_requested '
 'input_hash_matches private_path_bound frozen_source_matches source_sha256_matches has_audio requested_model_matches_frozen '
 'transcript_asset_ready_matches_reference timestamp_precision_chunk has_arabic has_latin missing_transcript segment_bounds_valid '
 'missing_extraction age_unknown height_unknown city_unknown all_evidence_locators_grounded all_populated_fields_have_evidence '
 'private_transcript_preserved extracted_result_preserved age_as_of_unknown reviewed has_no_audio_issue has_transcription_issue '
 'has_extraction_issue has_frame_shortfall_issue participation_media_is_this_media pinned_media_belongs_candidate pinned_frames_registered '
 'ready selected within_source_duration source_and_job_match preparation_reference_matches last_error_present unavailable').split())

def require(value):
    if not value:raise ValueError('M03_REMAINING_LIVE_METADATA_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def count(value,maximum=9007199254740991):return type(value)is int and 0<=value<=maximum
def identifier(value):return isinstance(value,str)and UUID.fullmatch(value)is not None
def exact(value,keys):require(isinstance(value,dict)and set(value)==set(keys))

def validate(proof):
    exact(proof,TOP);require(proof['query_role']==proof['database']=='postgres')
    require(isinstance(proof['scopes'],list)and len(proof['scopes'])==2)
    for scope in proof['scopes']:exact(scope,{'workspace_id','project_id'})
    require({v['workspace_id']:v['project_id']for v in proof['scopes']}==SCOPES)
    require(count(proof['job_count'],64)and proof['job_count']>=1 and isinstance(proof['jobs'],list)and len(proof['jobs'])==proof['job_count'])
    require(len({j.get('job_id')for j in proof['jobs']})==proof['job_count'])
    exact(proof['protected_m02'],{'job_checkpoint_unchanged','spec_checkpoint_unchanged','manual_note_retained'})
    require(all(type(v)is bool for v in proof['protected_m02'].values()))
    require(isinstance(proof['participations'],list)and len(proof['participations'])<=256)
    for pool in proof['participations']:
        exact(pool,{'participation_id','workspace_id','candidate_id','row_version','selected_candidate_media_id','selected_frame_asset_ids','availability_sha256','facts_sha256'})
        require(pool['workspace_id']in SCOPES and isinstance(pool['selected_frame_asset_ids'],list)and len(pool['selected_frame_asset_ids'])<=3)
    for job in proof['jobs']:
        require(isinstance(job,dict)and set(job)<=JOB_FIELDS and identifier(job.get('job_id')))
        require(job.get('workspace_id')in SCOPES and job.get('project_id')==SCOPES[job['workspace_id']])
        require(job.get('kind')in ('candidate_scan','frame_extract')and job.get('status')in ('queued','running','waiting_for_input','succeeded','failed','cancelled'))
        stages=CANDIDATE_STAGES if job['kind']=='candidate_scan'else FRAME_STAGES
        require(job.get('stage')in stages and all(row.get('stage')in stages for row in job.get('completed_stages',[])))
        if job.get('frame_geometry')is not None:
            geometry=job['frame_geometry'];exact(geometry,{'sample_aspect_ratio','display_aspect_ratio','width','height'})
            require(all(count(geometry[k],1280)and geometry[k]>=1 for k in ('width','height')))
            for key in ('sample_aspect_ratio','display_aspect_ratio'):
                exact(geometry[key],{'numerator','denominator'});require(all(count(v,10000000)and v>=1 for v in geometry[key].values()))
        outcome=job.get('frame_outcome')
        if outcome is not None:
            require(job['kind']=='frame_extract'and job['status']=='succeeded')
            exact(outcome,{'candidate_media_id','source_asset_id','requested_count','extracted_count','unavailable_count','unavailable_timestamps_ms','warnings','frame_asset_ids'})
            require(identifier(outcome['candidate_media_id'])and identifier(outcome['source_asset_id']))
            require(count(outcome['requested_count'],10)and outcome['requested_count']>=1 and count(outcome['extracted_count'],10)and count(outcome['unavailable_count'],10))
            require(max(outcome['extracted_count'],outcome['unavailable_count'])<=outcome['requested_count'])
            require(isinstance(outcome['frame_asset_ids'],list)and len(outcome['frame_asset_ids'])==outcome['extracted_count']and len(set(outcome['frame_asset_ids']))==len(outcome['frame_asset_ids']))
            require(isinstance(outcome['unavailable_timestamps_ms'],list)and len(outcome['unavailable_timestamps_ms'])==outcome['unavailable_count']and all(count(v,1799999)for v in outcome['unavailable_timestamps_ms']))
            require(isinstance(outcome['warnings'],list)and len(outcome['warnings'])<=2 and all(v in WARNINGS for v in outcome['warnings']))
        application=job.get('application')
        if application is not None and 'processing_issues'in application:require(isinstance(application['processing_issues'],list)and len(application['processing_issues'])<=4 and all(v in ISSUES for v in application['processing_issues']))
    def walk(value,key='',depth=0):
        require(depth<=14)
        if value is not None:
            if key.endswith('sha256'):require(isinstance(value,str)and re.fullmatch(r'[a-f0-9]{64}',value))
            elif key.endswith('_ids'):require(isinstance(value,list)and all(identifier(v)for v in value))
            elif key.endswith('_id')and key not in ('native_image_id','n8n_execution_id'):require(identifier(value))
            elif key in INTEGER_FIELDS or key.endswith('_count')or key.endswith('_tokens'):
                minimum=-9007199254740991 if key in ('source_start_ms','rotation_degrees')else 0
                require(type(value)is int and minimum<=value<=9007199254740991)
            elif key in BOOLEAN_FIELDS:require(type(value)is bool)
            elif key=='frame_rate':require(type(value)in(int,float)and math.isfinite(value)and 0<=value<=120)
            elif key in ('status','stage','kind','provider','error_code','result_schema'):
                require(isinstance(value,str)and value in (SCHEMAS if key=='result_schema'else ENUMS))
        if isinstance(value,dict):
            require(set(value)<=FIELDS)
            for name,child in value.items():walk(child,name,depth+1)
        elif isinstance(value,list):
            require(len(value)<=4096)
            if key.endswith('_ids'):return  # The whole UUID array was checked above.
            for child in value:walk(child,key,depth+1)
        elif value is None or type(value)is bool:return
        elif type(value)in (int,float):
            minimum=-9007199254740991 if key in ('source_start_ms','rotation_degrees')else 0
            require(math.isfinite(value)and minimum<=value<=9007199254740991)
        elif isinstance(value,str):
            if key.endswith('sha256'):require(re.fullmatch(r'[a-f0-9]{64}',value))
            elif key=='native_image_id':require(re.fullmatch(r'sha256:[a-f0-9]{64}',value))
            elif key=='n8n_execution_id':require(re.fullmatch(r'[A-Za-z0-9._:-]{1,200}',value))
            elif key.endswith('_id')or key.endswith('_ids'):require(identifier(value))
            elif key.endswith('_at'):require(datetime.datetime.fromisoformat(value.replace('Z','+00:00')).tzinfo is not None)
            elif key in VERSION_KEYS:
                if key in ('transcription_model','extraction_model','requested_model','resolved_model'):
                    require(re.fullmatch(r'(?:gpt-transcribe|gpt-6\.1-sol)(?:-[0-9]{4}-[0-9]{2}-[0-9]{2})?',value))
                elif key=='ffmpeg_version':require(re.fullmatch(r'[0-9][A-Za-z0-9._:+~-]{0,99}',value))
                else:require(value in {'1.0','7.45.1','candidate-v1','candidate_extract_v1','transcription-original-language.v1','video-preparation.v1','frame-extraction.v1'})
            else:require(value in ENUMS)
        else:require(False)
    walk(proof);return proof

def summarize(proof,baseline_candidate_hash):
    unchanged=proof['candidate_rows_sha256']==baseline_candidate_hash
    jobs=proof['jobs'];rows=[]
    for job in jobs:
        stages=CANDIDATE_STAGES if job['kind']=='candidate_scan'else FRAME_STAGES
        complete=job.get('completed_stages')or [];outcome=job.get('frame_outcome');application=job.get('application')
        rows.append({'job_id':job['job_id'],'kind':job['kind'],'status':job['status'],
          'all_kind_stages_committed':len(complete)==len(stages)and {v.get('stage')for v in complete}==set(stages),
          'persisted_provider_metadata_count':len(job.get('providers')or []),'candidate_media_applied':application is not None,
          'partial_frame_result':bool(outcome and outcome['unavailable_count']>0),'shared_frame_result':bool(outcome and 'FRAME_TIMESTAMP_SHARED'in outcome['warnings'])})
    fixed=next((j for j in jobs if j['job_id']==FIXED_JOB),None);fixed_summary=None
    if fixed:
        source=fixed.get('source')or {};upload=fixed.get('upload')or {};prep=fixed.get('preparation')or {};app=fixed.get('application')or {}
        frames=[v for v in app.get('frames',[])if v.get('source_and_job_match')is True]
        fixed_summary={'job_id':FIXED_JOB,'status':fixed['status'],
          'source_matches_expected_sha_and_size':source.get('status')=='ready'and source.get('sha256')==SOURCE_SHA256 and source.get('size_bytes')==SOURCE_BYTES,
          'one_intent_asset_and_candidate_scan':all(upload.get(k)==1 for k in ('intent_count_for_source','asset_count_for_source','scan_job_count_for_source')),
          'twelve_ready_origin_frames':len(frames)==12 and all(v.get('ready')is True for v in frames)and prep.get('sampled_frame_count')==12,
          'three_initial_selected_real_frames':len(fixed.get('initial_selected_frame_asset_ids')or [])==3,
          'no_audio_and_no_persisted_provider_metadata':prep.get('has_audio')is False and 'NO_AUDIO'in app.get('processing_issues',[])and fixed.get('providers')==[]}
    def pool(candidate,workspace):return next((v for v in proof['participations']if v['candidate_id']==candidate and v['workspace_id']==workspace),None)
    d5_origin=pool(D5,WORKSPACE);d5_other=pool(D5,OTHER_WORKSPACE)
    manual_other=pool(fixed.get('target_candidate_id'),OTHER_WORKSPACE)if fixed else None
    return {'outcomes':{status:sum(j['status']==status for j in jobs)for status in ('queued','running','waiting_for_input','succeeded','failed','cancelled')},
      'jobs':rows,'fixed_resumed_job':fixed_summary,'protected_m02_unchanged':all(v is True for v in proof['protected_m02'].values()),
      'global_candidate_rows_unchanged_since_pre_job_baseline':unchanged,
      'manual_facts_retained_verified':True if unchanged and fixed and fixed['status']=='succeeded'and fixed.get('application')is not None else None,
      'd5_origin_three_frame_pin_retained':bool(d5_origin and d5_origin['selected_candidate_media_id']==D5_MEDIA and d5_origin['selected_frame_asset_ids']==D5_FRAMES),
      'd5_other_two_frame_pin_matches_saved_choice':bool(d5_other and d5_other['selected_candidate_media_id']==D5_MEDIA and d5_other['selected_frame_asset_ids']==D5_FRAMES[:2]),
      'manual_target_other_project_null_pin_retained':bool(manual_other and manual_other['selected_candidate_media_id']is None and manual_other['selected_frame_asset_ids']==[])}

def safe_sql_failure(stdout,stderr):
    raw=(stdout+'\n'+stderr)[:MAXIMUM_BYTES]
    return {'scope_or_job_count':'M03_REMAINING_LIVE_FIXED_SCOPE_OR_JOB_COUNT_UNCONFIRMED'in raw,
      'syntax_error':'syntax error'in raw.lower(),'permission_denied':'permission denied'in raw.lower(),
      'undefined_column':'does not exist'in raw.lower()and 'column'in raw.lower(),
      'ambiguous_column':'ambiguous'in raw.lower()and 'column'in raw.lower(),
      'cardinality_error':'more than one row'in raw.lower()}

def prerequisites():
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    seals={SQL:SQL_SHA256,'tools/release_foundation.py':CLI_SHA256,BASELINE:BASELINE_SHA256,
      REUSE_BASELINE:REUSE_BASELINE_SHA256,PROTECTED_BASELINE:PROTECTED_BASELINE_SHA256,**OLD_SEALS}
    for file,digest in seals.items():require(sha((ROOT/file).read_bytes())==digest)
    baseline=json.loads((ROOT/BASELINE).read_bytes());require(baseline['result']=='passed'and baseline['other_business_catalog_runtime_and_config_unchanged']is True)
    require(baseline['before']['data_sha256']['eps.candidates']==baseline['after']['data_sha256']['eps.candidates'])
    reuse=json.loads((ROOT/REUSE_BASELINE).read_bytes());require(reuse['candidate_id']==D5 and reuse['selected_media_id']==D5_MEDIA and reuse['selected_frame_count']==2 and reuse['persisted_after_reload']is True)
    return baseline['before']['data_sha256']['eps.candidates'],seals

def main():
    require(sys.argv[1:]==[]);baseline,seals=prerequisites()
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'result':'unconfirmed','read_only':True,
      'scope':'Actual fixed two-workspace candidate/frame job metadata, at most64 jobs; no semantic quality/provider billing completeness claim.',
      'sql_sha256':SQL_SHA256,'harness_sha256':sha((ROOT/'tools/capture-m03-remaining-live.py').read_bytes()),'source_seals':seals,
      'baseline_candidate_rows_sha256':baseline,'cloud_called':False,'provider_called':False,'storage_http_called':False,
      'mutations_requested':False,'raw_private_payloads_recorded':False,
      'retention_boundary':'Facts-only retention is not inferred if the entire candidate-row fingerprint changed. Current rows are not used as their own baseline.',
      'pin_baseline_boundary':'Original d5 triple is from prior8b24096b metadata; other-project first-two choice is owner-attested plus saved/reloaded browser summary. Manual target other-project null choice is owner-attested. Origin first-media autopin may legitimately change.',
      'provider_boundary':'Absent persisted metadata is not zero provider billing; historical failures may lack completed-stage usage.',
      'n8n_boundary':'Only last workflow execution ID is retained by jobs; stage events/outbox do not enumerate every execution.',
      'native_boundary':'SQL records PTS/dimensions/geometry/hashes, not image-byte quality; image launch and browser evidence remain separate.'}
    label=report['observed_at'].replace(':','-').replace('.','-')+'-'+uuid.uuid4().hex[:8];EVIDENCE.mkdir(parents=True,exist_ok=True)
    try:
        report['cloud_called']=True;response=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/SQL),'--output-format','json'])
        if response.returncode!=0:report['sql_failure']=safe_sql_failure(response.stdout,response.stderr)
        require(response.returncode==0 and len(response.stdout.encode())<=MAXIMUM_BYTES)
        rows=json.loads(response.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={'m03_remaining_live'})
        proof=validate(rows[0]['m03_remaining_live']);summary=summarize(proof,baseline);report.update(proof=proof,summary=summary)
        report['result']='captured'if summary['protected_m02_unchanged']else 'failed_protection_check'
    except Exception:report['code']='M03_REMAINING_LIVE_METADATA_UNCONFIRMED'
    finally:
        file=EVIDENCE/(label+'.json')
        with file.open('x',encoding='utf8')as handle:json.dump(report,handle,indent=2);handle.write('\n')
        print(json.dumps({'result':report['result'],'receipt':file.relative_to(ROOT).as_posix(),'summary':report.get('summary'),'sql_failure':report.get('sql_failure'),'raw_private_payloads_recorded':False}))
    return 0 if report['result']=='captured'else 1
if __name__=='__main__':
    try:sys.exit(main())
    except Exception:sys.stderr.write('Fixed remaining M03 metadata capture stopped; private diagnostics suppressed.\n');sys.exit(1)
