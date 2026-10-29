"""Fixed read-only frame-vision observer. Root invokes only after the new app job.

Imports/offline validation do not access configuration, CLI, DB or providers.
"""
import datetime,hashlib,json,re,sys,uuid
from pathlib import Path
from release_foundation import ROOT,TARGET
from release_m04_casting import call as cli_call,private_write

WORKSPACE='e470aefd-e0f7-480c-bf0d-170cb2cb7069'
PROJECT='bd14d10f-b1c5-4d6a-8b4d-e5c48208433c'
SOURCE_SHA='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
SOURCE_SIZE=4316429
PROMPT_SHA='3c650e433d05e80abca3c880fc4bf86df215b5b504eb906cd98e01f00a442538'
STAGES=['prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate']
UUID=re.compile('[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}')
SQL='tools/sql/m03-frame-vision-app-readback.sql'
SQL_SHA='de702b6ba6e9e8e5437015ed394bf8271c52c7fc9f70693426cd069ebd3e2f69'
INTENT='.local/m03-frame-vision/app-job-intent.json'
BATCH='tracking/evidence/m03/remaining-app/real-batch-results.json'
BATCH_SHA='5a666c5c26e2bb93ae10c896836ace32c377ad347627246601c90d8fa5518e05'
BASELINE='tracking/evidence/m03/remaining-live-capture/2026-10-29T15-43-14-594675+00-00-bc9f137b.json'
BASELINE_SHA='4f08745279c442ef343e4a84ebf32d95b3481cdd67deb1d3f3b35dcaf63ee7ff'
SEALS={'tools/release_m04_casting.py':'ca855cda402566ebe8c6a78174a44dfcc9e878d7f0a320a6b7251a783ade2226',
 'tools/release_foundation.py':'02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'tools/release_m03_remaining.py':'5a608e480c7afb56a1b49c7a683c238d950301c589c1ff91348368f486995b7e',
 'tools/release_specs_read_operation.py':'a68be68c78bb20b59216e5aabd9b568bb0d46ef9fd35097ceb78392f85ad304e',
 'tools/provision_logo_verifier.py':'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
 'packages/integrations/src/openai-frames.ts':'4ecdd46fcc2e660390c7ec051c23afd5aa421ef0f752bf31013b91eb5803de86',
 'packages/integrations/src/prompts/frame-selection-v1.ts':'a37c19c7ccb5a84a3d46a44f7695aa3fcf1ea407a00ba161309a4ae3d5fa7811',
 'apps/worker/src/candidate-assets.ts':'c30867a9ff244f771dbfd4168964214cc229b1e7d0a4b208bc24e4d6afb89108',
 'apps/worker/src/candidate-stage-executor.ts':'e436a5f278af7ebcd8b3a49a8fb9f7fcaa3c66972120582b7b8913d12c0f68bd',
 'apps/worker/src/n8n-orchestrator.ts':'c5e95a1c00c65b8a71137efe100cd772bdd02880abb9f65b49672d235b075d58',
 'apps/worker/src/runtime-types.ts':'68c14e7d4b594651962ab5275d42ed902cda5593dc8f4f4ae4f61ff18512033c',
 'tools/build-candidate-wf02.mjs':'c64710c7cd3e98a2b71977761abf16ec4d8274b287da4b2b41550f8c3f8b64bd'}
ISSUES={'NO_AUDIO','TRANSCRIPTION_FAILED','EXTRACTION_FAILED','INSUFFICIENT_FRAMES','FRAME_SELECTION_UNAVAILABLE'}

def sha(value):return hashlib.sha256(value).hexdigest()
def require(value):
    if not value:raise ValueError('M03_VISION_METADATA_UNCONFIRMED')
def exact(value,keys):require(type(value)is dict and set(value)==set(keys))
def identifier(value):require(type(value)is str and UUID.fullmatch(value)is not None)
def digest(value,nullable=False):require(nullable and value is None or type(value)is str and re.fullmatch('[a-f0-9]{64}',value)is not None)
def integer(value,minimum=0,maximum=9007199254740991):require(type(value)is int and minimum<=value<=maximum)
def timestamp(value):
    require(type(value)is str and len(value)<=50)
    parsed=datetime.datetime.fromisoformat(value.replace('Z','+00:00'));require(parsed.tzinfo is not None);return parsed
def ids(value,maximum):
    require(type(value)is list and len(value)<=maximum and len(set(value))==len(value))
    for item in value:identifier(item)
def parse_intent(value):
    require(type(value)is dict and set(value)=={'job_id'}and isinstance(value['job_id'],str)and UUID.fullmatch(value['job_id']))
    return value
def frame_fingerprint(frames):
    return sha('\n\n'.join('\n'.join(str(frame[key])for key in('frame_asset_id','source_asset_id','timestamp_ms','width','height','sha256'))for frame in frames).encode())
def schema_fingerprint(source,frames):
    reasons=['Clear frontal source frame.','Clear wider source frame.','Clear profile source frame.','Clear distinct source framing.']
    schema={'type':'object','additionalProperties':False,'properties':{
      'schema_version':{'type':'string','enum':['1.0']},'source_asset_id':{'type':'string','enum':[source]},
      'selected_frames':{'type':'array','maxItems':3,'items':{'type':'object','additionalProperties':False,'properties':{
        'frame_asset_id':{'type':'string','enum':[frame['frame_asset_id']for frame in frames]},'reason':{'type':'string','enum':reasons}},'required':['frame_asset_id','reason']}},
      'insufficient_frames_reason':{'anyOf':[{'type':'string','enum':['Fewer than three clear, distinct source frames are available.']},{'type':'null'}]}},
      'required':['schema_version','source_asset_id','selected_frames','insufficient_frames_reason']}
    return sha(json.dumps(schema,separators=(',',':'),ensure_ascii=False).encode())
def validate(state,intent,expected_profiles,versions):
    parse_intent(intent)
    exact(state,{'observed_at','query_role','database','versions','job','source','preparation','selection','application','retained_profiles'})
    require(state['query_role']==state['database']=='postgres');observed=timestamp(state['observed_at'])
    require(type(versions)is list and len(versions)==21 and versions==sorted(set(versions))and versions[-2:]==['20261029174841','20261029180953'])
    require(all(type(v)is str and re.fullmatch('[0-9]{14}',v)for v in versions)and state['versions']==versions)
    job=state['job'];exact(job,{'id','kind','workspace_id','project_id','status','stage','input_sha256','source_asset_id','upload_id','target_candidate_id','created_at','n8n_execution_id','extraction_model','completed_stages','outbox'})
    for key in('id','source_asset_id','upload_id'):identifier(job[key])
    require(job['id']==intent['job_id']and job['kind']=='candidate_scan'and job['workspace_id']==WORKSPACE and job['project_id']==PROJECT
      and job['status']=='succeeded'and job['stage']=='apply_candidate'and job['target_candidate_id']is None and timestamp(job['created_at'])<=observed)
    digest(job['input_sha256']);require(type(job['n8n_execution_id'])is str and re.fullmatch('[0-9]{1,20}',job['n8n_execution_id'])and job['extraction_model']=='gpt-6.1-sol')
    require(type(job['completed_stages'])is list and len(job['completed_stages'])==5 and [v.get('stage')for v in job['completed_stages']]==STAGES)
    for row in job['completed_stages']:exact(row,{'stage','input_hash_matches'});require(row['input_hash_matches']is True)
    require(type(job['outbox'])is list and 5<=len(job['outbox'])<=32 and {v.get('stage')for v in job['outbox']}==set(STAGES))
    for row in job['outbox']:exact(row,{'stage','status','input_hash_matches'});require(row['status']=='delivered'and row['input_hash_matches']is True)
    source=state['source'];exact(source,{'asset_id','sha256','size_bytes','duration_ms','width','height','status','mime_type','declared_sha256','declared_size_bytes','upload_id','upload_status','upload_actor_bound','storage_object_exists','storage_size_bytes','private_path_bound'})
    require(source['asset_id']==job['source_asset_id']and source['upload_id']==job['upload_id']and source['sha256']==source['declared_sha256']==SOURCE_SHA
      and source['size_bytes']==source['declared_size_bytes']==source['storage_size_bytes']==SOURCE_SIZE and source['status']=='ready'and source['upload_status']=='completed'and source['mime_type']=='video/mp4')
    for key in('upload_actor_bound','storage_object_exists','private_path_bound'):require(source[key]is True)
    for key in('duration_ms','width','height'):integer(source[key],1,1800000)
    preparation=state['preparation'];exact(preparation,{'payload_id','attempt_id','result_schema','input_hash_matches','source_sha256','implementation_version','sampled_frames'})
    identifier(preparation['payload_id']);identifier(preparation['attempt_id'])
    require(preparation['result_schema']=='media-preparation.v1'and preparation['input_hash_matches']is True and preparation['source_sha256']==SOURCE_SHA and preparation['implementation_version']=='video-preparation.v1')
    frames=preparation['sampled_frames'];require(type(frames)is list and len(frames)==12)
    frame_ids=[]
    for index,frame in enumerate(frames):
        exact(frame,{'ordinal','frame_asset_id','source_asset_id','timestamp_ms','width','height','sha256','asset_sha256','asset_timestamp_ms','asset_width','asset_height','size_bytes','status','mime_type','source_and_job_match','storage_object_exists','registered_in_result'})
        identifier(frame['frame_asset_id']);digest(frame['sha256']);integer(frame['ordinal'],1,12);require(frame['ordinal']==index+1 and frame['source_asset_id']==source['asset_id']and frame['sha256']==frame['asset_sha256'])
        for key in('timestamp_ms','width','height'):integer(frame[key],0 if key=='timestamp_ms'else 1,source['duration_ms']-1 if key=='timestamp_ms'else 1280)
        require(frame['timestamp_ms']==frame['asset_timestamp_ms']and frame['width']==frame['asset_width']and frame['height']==frame['asset_height'])
        integer(frame['size_bytes'],3,2*1024*1024);require(frame['status']=='ready'and frame['mime_type']=='image/jpeg')
        for key in('source_and_job_match','storage_object_exists','registered_in_result'):require(frame[key]is True)
        frame_ids.append(frame['frame_asset_id'])
    ids(frame_ids,12)
    selection=state['selection'];exact(selection,{'payload_id','attempt_id','result_schema','input_hash_matches','source_asset_id','method','metadata','selected_frame_asset_ids'})
    identifier(selection['payload_id']);identifier(selection['attempt_id'])
    require(selection['result_schema']=='frame-selection-stage.v1'and selection['input_hash_matches']is True and selection['source_asset_id']==source['asset_id']and selection['method']=='openai_vision')
    metadata=selection['metadata'];exact(metadata,{'provider','sdk_version','requested_model','resolved_model','prompt_version','prompt_sha256','schema_sha256','input_sha256','frame_input_sha256','response_id_sha256','request_id_sha256','usage'})
    require(metadata['provider']=='openai'and metadata['sdk_version']=='7.45.1'and metadata['requested_model']==job['extraction_model']
      and type(metadata['resolved_model'])is str and re.fullmatch('gpt-6\\.1-sol(?:-[0-9]{4}-[0-9]{2}-[0-9]{2})?',metadata['resolved_model'])
      and metadata['prompt_version']=='frame_selection_vision_v1'and metadata['prompt_sha256']==PROMPT_SHA
      and metadata['input_sha256']==job['input_sha256']and metadata['frame_input_sha256']==frame_fingerprint(frames)and metadata['schema_sha256']==schema_fingerprint(source['asset_id'],frames))
    digest(metadata['response_id_sha256']);digest(metadata['request_id_sha256'],True)
    usage=metadata['usage']
    if usage is not None:
        exact(usage,{'input_tokens','output_tokens','total_tokens'})
        for value in usage.values():integer(value)
        require(usage['total_tokens']==usage['input_tokens']+usage['output_tokens'])
    selected=selection['selected_frame_asset_ids'];ids(selected,3);require(set(selected)<=set(frame_ids))
    application=state['application'];exact(application,{'candidate_id','candidate_media_id','source_asset_id','source_job_id','processing_issues','selected_frame_asset_ids','registered_frame_count','reviewed','source_kind','created_by_matches_job'})
    identifier(application['candidate_id']);identifier(application['candidate_media_id'])
    require(application['source_asset_id']==source['asset_id']and application['source_job_id']==job['id']and application['selected_frame_asset_ids']==selected
      and application['registered_frame_count']==12 and application['reviewed']is False and application['source_kind']=='scan'and application['created_by_matches_job']is True)
    issues=application['processing_issues'];require(type(issues)is list and len(issues)<=5 and all(type(v)is str and v in ISSUES for v in issues)and len(set(issues))==len(issues)
      and 'FRAME_SELECTION_UNAVAILABLE'not in issues and ('INSUFFICIENT_FRAMES'in issues)==(len(selected)<3))
    retained=state['retained_profiles'];require(type(retained)is list and len(retained)==len(expected_profiles)==9)
    require({row.get('job_id')for row in retained}=={row.get('job_id')for row in expected_profiles}and len({row.get('job_id')for row in retained})==9)
    for row in retained:
        exact(row,{'job_id','candidate_id','candidate_media_id','source_asset_id','source_sha256','facts_sha256','unarchived','selected_frame_asset_ids','frames'})
        for key in('job_id','candidate_id','candidate_media_id','source_asset_id'):identifier(row[key])
        digest(row['source_sha256']);digest(row['facts_sha256']);require(row['unarchived']is True);ids(row['selected_frame_asset_ids'],3)
        require(type(row['frames'])is list and 1<=len(row['frames'])<=12)
        for frame in row['frames']:
            exact(frame,{'asset_id','sha256','timestamp_ms','width','height','ready','source_and_job_match'});identifier(frame['asset_id']);digest(frame['sha256'])
            integer(frame['timestamp_ms'],0,1799999);integer(frame['width'],1,1280);integer(frame['height'],1,1280);require(frame['ready']is True and frame['source_and_job_match']is True)
        require(row==next(old for old in expected_profiles if old['job_id']==row['job_id']))
    require(job['id']not in{r['job_id']for r in retained}and application['candidate_id']not in{r['candidate_id']for r in retained})
    return state

def expected_profiles(batch,baseline):
    require(batch['result']=='passed_technical_processing'and batch['authorized_real_sources']==9 and baseline['result']=='captured'
      and batch['canonical_receipt']==BASELINE and batch['canonical_receipt_sha256']==BASELINE_SHA)
    require(type(batch['jobs'])is list and len(batch['jobs'])==9)
    result=[]
    for original in batch['jobs']:
        rows=[job for job in baseline['proof']['jobs']if job['job_id']==original['job_id']];require(len(rows)==1);job=rows[0];application=job['application']
        require(job['status']=='succeeded'and application['candidate_id']==original['candidate_id']and application['candidate_media_id']==original['candidate_media_id']
          and job['source_asset_id']==original['source_asset_id']and job['source']['sha256']==original['source_sha256'])
        result.append({'job_id':job['job_id'],'candidate_id':application['candidate_id'],'candidate_media_id':application['candidate_media_id'],
          'source_asset_id':job['source_asset_id'],'source_sha256':job['source']['sha256'],'facts_sha256':application['facts_sha256'],'unarchived':True,
          'selected_frame_asset_ids':application['selected_frame_asset_ids'],'frames':[{key:frame[key]for key in('asset_id','sha256','timestamp_ms','width','height','ready','source_and_job_match')}for frame in application['frames']]})
    return sorted(result,key=lambda row:row['job_id'])

def build_sql(template,intent):
    parse_intent(intent);require(type(template)is str and template.count('__M03_VISION_JOB_UUID__')==1)
    return template.replace('__M03_VISION_JOB_UUID__',intent['job_id'])

def checked_path(relative):
    from provision_logo_verifier import safe_path
    file=ROOT/relative;safe_path(file);require(file.resolve()==file and not file.is_symlink());return file

def sealed(relative,expected):
    value=checked_path(relative).read_bytes();require(sha(value)==expected);return value

def main(arguments=None):
    arguments=sys.argv[1:]if arguments is None else arguments;require(arguments==[])
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'result':'unconfirmed','read_only':True,
      'mutations_requested':False,'provider_called_by_observer':False,'storage_http_called_by_observer':False,'cloud_call_attempted':False,
      'harness_sha256':sha(Path(__file__).read_bytes()),'sql_template':SQL,'sql_template_sha256':SQL_SHA,
      'scope':'One app-created source-bound vision job and the original nine profile/frame/fact hashes. M04 observer separately owns old project pins and protected M02.',
      'boundary':'Metadata from canonical database and worker persisted actual-source SHA. This observer makes no S3 byte download, image quality, speech accuracy, full billed-usage or factual Reviewed claim.',
      'private_stage_payload_capture_needed':False,'hosting_deferred':True}
    try:
        intent_bytes=checked_path(INTENT).read_bytes();require(len(intent_bytes)<=4096);intent=parse_intent(json.loads(intent_bytes))
        report['intent_sha256']=sha(intent_bytes);report['job_id']=intent['job_id']
        require(checked_path('supabase/.temp/project-ref').read_text().strip()==TARGET)
        seals={SQL:SQL_SHA,BATCH:BATCH_SHA,BASELINE:BASELINE_SHA,**SEALS}
        for file,digest_value in seals.items():sealed(file,digest_value)
        old=expected_profiles(json.loads(sealed(BATCH,BATCH_SHA)),json.loads(sealed(BASELINE,BASELINE_SHA)))
        require(intent['job_id']not in{row['job_id']for row in old})
        manifest_bytes=checked_path('development/local-db/reviewed.json').read_bytes();manifest=json.loads(manifest_bytes)
        require(type(manifest.get('migrations'))is list and len(manifest['migrations'])==21)
        versions=[]
        for row in manifest['migrations']:
            require(re.fullmatch('supabase/migrations/[0-9]{14}_[a-z0-9_]+\\.sql',row['path'])and row['reviewed_by']and row['reviewed_at']);sealed(row['path'],row['sha256']);versions.append(Path(row['path']).name[:14])
        require(versions==sorted(set(versions))and versions[-2:]==['20261029174841','20261029180953'])
        report['manifest_sha256']=sha(manifest_bytes);report['source_seals']=seals
        query=build_sql(sealed(SQL,SQL_SHA).decode('utf8'),intent).encode();report['derived_query_sha256']=sha(query)
        query_file=checked_path('.local/m03-frame-vision/readback-'+uuid.uuid4().hex+'.sql');query_file.parent.mkdir(parents=True,exist_ok=True);private_write(query_file,query)
        require(sha(query_file.read_bytes())==report['derived_query_sha256'])
        report['cloud_call_attempted']=True
        result=cli_call(['db','query','--linked','--project-ref',TARGET,'--file',str(query_file),'--output-format','json'])
        require(result.returncode==0 and len(result.stdout.encode())<=2*1024*1024)
        response=json.loads(result.stdout);require(type(response)is dict and type(response.get('rows'))is list and len(response['rows'])==1);exact(response['rows'][0],{'m03_frame_vision'})
        state=validate(response['rows'][0]['m03_frame_vision'],intent,old,versions)
        for file,digest_value in seals.items():sealed(file,digest_value)
        require(checked_path(INTENT).read_bytes()==intent_bytes and checked_path('development/local-db/reviewed.json').read_bytes()==manifest_bytes
          and sha(query_file.read_bytes())==report['derived_query_sha256']and sha(Path(__file__).read_bytes())==report['harness_sha256'])
        report.update(result='captured',state=state,technical_vision_provider_success=True,original_nine_profiles_facts_frames_unchanged=True,sources_stable=True,
          selected_frames=[{key:frame[key]for key in('frame_asset_id','timestamp_ms','width','height','sha256','size_bytes')}for selected_id in state['selection']['selected_frame_asset_ids']for frame in state['preparation']['sampled_frames']if frame['frame_asset_id']==selected_id])
    except Exception:report['code']='M03_VISION_READONLY_CAPTURE_UNCONFIRMED'
    finally:
        folder=ROOT/'tracking/evidence/m03/frame-vision-app';folder.mkdir(parents=True,exist_ok=True)
        file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'.json')
        with file.open('x',encoding='utf8')as handle:json.dump(report,handle,indent=2);handle.write('\n')
        print(json.dumps({'result':report['result'],'receipt':file.relative_to(ROOT).as_posix(),'cloud_call_attempted':report['cloud_call_attempted'],
          'technical_vision_provider_success':report.get('technical_vision_provider_success',False),'original_nine_profiles_facts_frames_unchanged':report.get('original_nine_profiles_facts_frames_unchanged',False)}))
    return 0 if report['result']=='captured'else 1
if __name__=='__main__':
    try:sys.exit(main())
    except Exception:sys.stderr.write('Fixed vision observer stopped; private diagnostics suppressed.\n');sys.exit(1)
