"""Default-off metadata-only current38 Specs observation. No IO on entry import."""
from pathlib import Path
import copy, datetime, hashlib, importlib.util, json, os, re, sys
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];READ_ENABLED=True
PROJECT_HELPER=ROOT/'development/m07/specs-worker38-test-project/project.py';PROJECT_FALSE_SHA='094fc2e948fbd3c14ba86d026340e24d00b8220b94e730964f49d7a5877ad4f5'
OLD_OBSERVER=ROOT/'development/m07/job-attempt-observability36-release/live_observer.py';OLD_SHA='6bac5273945f5ab9768ab51bfe0db0915224007feaeec581998010a42732ec84'
HISTORICAL='13699983-f4bb-4923-8ea4-f524a224e335';REVIEWED='25a3c924-7b6c-48e3-88ce-c72e72b99c6d';PROTECTED='b3f90268-147d-41d4-8875-2a6435df1496'
PRIVATE=ROOT/'.local/m07-specs-worker38-audit';BEFORE=PRIVATE/'before.json'
def need(v):
 if not v:raise ValueError('SPECS38_AUDIT_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
raw=PROJECT_HELPER.read_bytes();need(raw.count(b'APPLY_ENABLED = False')+raw.count(b'APPLY_ENABLED = True')==1 and sha(raw.replace(b'APPLY_ENABLED = True',b'APPLY_ENABLED = False'))==PROJECT_FALSE_SHA)
p=module('specs38_project_pure_admission',PROJECT_HELPER);s=p.s
need(sha(s.load(OLD_OBSERVER))==OLD_SHA);old=module('specs38_pure_hash_grouping',OLD_OBSERVER)
a=module('specs38_existing_read_transport',s.HERE/'adoption.py')
def identifier(v):p.identifier(v);return v
def timestamp(v):
 need(type(v)is str);value=datetime.datetime.fromisoformat(v.replace('Z','+00:00'));need(value.utcoffset()==datetime.timedelta(0));return value
def safe(v,maximum=200):return type(v)is str and re.fullmatch(r'[A-Za-z0-9._:-]{1,'+str(maximum)+'}',v)is not None
def literal(v):return s.s.b.literal(v)
def config():
 value=json.loads(s.load(HERE/'inputs.json'));need(set(value)=={'project_id','workspace_id','resume_receipt','worker_ready'})
 identifier(value['project_id']);identifier(value['workspace_id']);template=json.loads(s.load(PROJECT_HELPER.parent/'admission.template.json'))
 admitted=p.admit({**template,'resume_receipt':value['resume_receipt'],'worker_ready':value['worker_ready']})
 return value,admitted
def pins():
 out=p.sources();need(sha(s.load(OLD_OBSERVER))==OLD_SHA);out[OLD_OBSERVER.relative_to(ROOT).as_posix()]=OLD_SHA
 for name in ['audit.py','test_audit.py','README.md','inputs.template.json']:out[(HERE/name).relative_to(ROOT).as_posix()]=sha(s.load(HERE/name))
 return dict(sorted(out.items()))
def grouped(table,where,key='r.id::text',version='null'):return old.grouped(table,'r',where,key,version)
def whole(table,where):
 return "(select jsonb_build_object('count',count(*),'sha256',"+old.digest_sql("coalesce(string_agg(h,E'\\n'order by h),'')")+")from(select "+old.digest_sql('to_jsonb(r)')+' h from '+table+' r where '+where+')q)'

def protection_sql():
 ready="(select id from eps.presentation_versions where status='ready')";media='(select id from eps.candidate_media where candidate_id='+literal(REVIEWED)+'::uuid)'
 groups={'versions':grouped('presentation_versions',"r.status='ready'",version='r.id'),'slides':grouped('version_slides','r.version_id in'+ready,version='r.version_id'),
  'pins':grouped('presentation_version_assets','r.version_id in'+ready,"r.version_id::text||':'||r.asset_id::text",'r.version_id'),
  'raw':grouped('presentation_video_transcripts','r.version_id in'+ready,"r.version_id::text||':'||r.video_asset_id::text",'r.version_id'),
  'english':grouped('presentation_video_english_transcripts','r.version_id in'+ready,"r.version_id::text||':'||r.video_asset_id::text",'r.version_id'),
  'exports':grouped('presentation_exports',"r.status='ready'and r.version_id in"+ready,version='r.version_id'),
  'reviewed_media':grouped('candidate_media','r.candidate_id='+literal(REVIEWED)+'::uuid'),
  'reviewed_frames':grouped('candidate_media_frames','r.candidate_media_id in'+media,"r.candidate_media_id::text||':'||r.asset_id::text")}
 pinned='(select asset_id from eps.presentation_version_assets where version_id in'+ready+' union select pdf_asset_id from eps.presentation_versions where id in'+ready+' union select manifest_asset_id from eps.presentation_versions where id in'+ready+" union select pdf_asset_id from eps.presentation_exports where status='ready'and version_id in"+ready+' union select source_asset_id from eps.candidate_media where id in'+media+' union select transcript_asset_id from eps.candidate_media where id in'+media+' union select preview_asset_id from eps.candidate_media where id in'+media+' union select asset_id from eps.candidate_media_frames where candidate_media_id in'+media+')'
 groups['assets']=grouped('media_assets','r.id in'+pinned+' or r.source_asset_id in(select source_asset_id from eps.candidate_media where id in'+media+')')
 for table in ['jobs','job_events','job_stage_attempts','outbox_events','specs_stage_payloads','specs_source_inputs']:
  groups['historical_'+table]=whole('eps.'+table,('r.id='if table=='jobs'else'r.job_id=')+literal(HISTORICAL)+'::uuid')
 groups['reviewed']= "(select jsonb_build_object('candidate_id',id,'sha256',"+old.digest_sql('to_jsonb(c)')+",'is_reviewed',eps.cast_is_reviewed(c))from eps.candidates c where id="+literal(REVIEWED)+'::uuid)'
 groups['protected_m02']=old.digest_sql("snap.value#>'{state,protected_m02}'")
 return 'jsonb_build_object('+','.join(literal(key)+','+value for key,value in groups.items())+')'

def bounded_rows(sql):return "(select jsonb_build_object('total',count(*),'rows',coalesce(jsonb_agg(v order by ordinal)filter(where ordinal<=100),'[]'::jsonb))from("+sql+')q)'
def job_sql(job,workspace):
 identifier(job);identifier(workspace);need(job not in(HISTORICAL,PROTECTED))
 traces=bounded_rows("select row_number()over(order by attempt)ordinal,jsonb_build_object('job_id',job_id,'attempt_id',attempt_id,'stage',stage,'attempt',attempt,'stage_attempt',stage_attempt,'dispatch_generation',dispatch_generation,'correlation_id',correlation_id,'input_hash',input_hash,'workflow_execution_id',workflow_execution_id,'workflow_execution_ref_state',workflow_execution_ref_state,'claimed_at',claimed_at) v from eps.job_stage_attempts where job_id=j.id")
 events=bounded_rows("select row_number()over(order by created_at,attempt_id,sequence)ordinal,jsonb_build_object('attempt_id',attempt_id,'sequence',sequence,'stage',stage,'event_type',event_type,'created_at',created_at,'applied',receipt->'applied','stale',receipt->'stale','job_status',receipt->>'job_status')v from eps.job_events where job_id=j.id")
 box=bounded_rows("select row_number()over(order by created_at,id)ordinal,jsonb_build_object('id',id,'job_id',job_id,'stage',stage,'status',status,'attempt_count',attempt_count,'created_at',created_at,'delivered_at',delivered_at)v from eps.outbox_events where job_id=j.id")
 models="(select coalesce(jsonb_agg(jsonb_build_object('attempt_id',x.attempt_id,'source_bound',x.input_hash=j.input_hash and x.result#>>'{metadata,input_sha256}'=j.input_hash and x.result#>>'{metadata,correlation_id}'=j.correlation_id and exists(select 1 from eps.job_stage_attempts t where t.job_id=j.id and t.attempt_id=x.attempt_id and t.stage=x.stage),'provider',x.result#>>'{metadata,provider}','requested_model',x.result#>>'{metadata,requested_model}','resolved_model',x.result#>>'{metadata,resolved_model}','request_id',x.result#>>'{metadata,request_id}','response_id',x.result#>>'{metadata,response_id}','correlation_id',x.result#>>'{metadata,correlation_id}','usage',case when x.result#>'{metadata,usage}'='null'::jsonb then null else jsonb_build_object('input_tokens',x.result#>'{metadata,usage,input_tokens}','output_tokens',x.result#>'{metadata,usage,output_tokens}','total_tokens',x.result#>'{metadata,usage,total_tokens}')end)order by x.stage),'[]')from eps.specs_stage_payloads x where x.job_id=j.id and x.stage='extract_specs'and x.result_schema='specs-extraction-stage.v1')"
 code="case when j.error->>'code'~'^[A-Z][A-Z0-9_]{0,63}$'then j.error->>'code'when j.error is null then null else'UNCLASSIFIED'end"
 cause="case when j.error->>'code'='RETRY_EXHAUSTED'and j.error#>>'{details,cause_code}'~'^[A-Z][A-Z0-9_]{0,63}$'then j.error#>>'{details,cause_code}'end"
 return "(select jsonb_build_object('id',j.id,'workspace_id',j.workspace_id,'kind',j.kind,'status',j.status,'stage',j.stage,'attempt',j.attempt,'correlation_id',j.correlation_id,'workflow_execution_id',j.n8n_execution_id,'created_at',j.created_at,'updated_at',j.updated_at,'error_code',"+code+",'cause_code',"+cause+",'traces',"+traces+",'events',"+events+",'outbox',"+box+",'provider_metadata',"+models+")from eps.jobs j where j.id="+literal(job)+'::uuid and j.workspace_id='+literal(workspace)+"::uuid and j.kind='specs_extract')"

def sql(value,job=None):
 identifier(value['project_id']);identifier(value['workspace_id'])
 query="select jsonb_build_object('observed_at',clock_timestamp(),'snapshot',snap.value,'workspace_valid',exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id where w.id="+literal(value['workspace_id'])+'::uuid and p.id='+literal(value['project_id'])+'::uuid and p.name='+literal(p.NAME)+"and p.archived_at is null),'workspace_empty',not exists(select 1 from eps.roles where workspace_id="+literal(value['workspace_id'])+'::uuid),\'preservation\','+protection_sql()+",'job',"+('null'if job is None else job_sql(job,value['workspace_id']))+')as worker38_adoption from('+s.snapshot_sql()+' as value)snap'
 return "begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='45s';"+query+';rollback;'

def validate(value,admitted,before=False):
 need(type(value)is dict and set(value)=={'observed_at','snapshot','workspace_valid','workspace_empty','preservation','job'}and value['workspace_valid']is True);timestamp(value['observed_at'])
 snapshot=value['snapshot'];full=snapshot['state'];expected=admitted['resume']['first']['state']
 need(full['database']==full['operator']==full['session_user']=='postgres'and full['cli_role_safe']is True and len(full['history'])==38 and full['history']==expected['history']
  and full['protected_m02_integrity']is True and full['english']['flags']==['1.0']and s.s.static_schema(full)==s.s.static_schema(expected)
  and all(row['public']['enabled']is True for row in snapshot['config'].values())and snapshot['config']['frame_extraction_config']['public']['native_image_id']==p.NATIVE)
 if before:need(value['job']is None and value['workspace_empty']is True and all(type(n)is int and n==0 for n in snapshot['lifecycle'].values()))
 proof=value['preservation'];need(set(proof)==set('versions slides pins raw english exports reviewed_media reviewed_frames assets historical_jobs historical_job_events historical_job_stage_attempts historical_outbox_events historical_specs_stage_payloads historical_specs_source_inputs reviewed protected_m02'.split()))
 need(set(proof['reviewed'])=={'candidate_id','sha256','is_reviewed'}and proof['reviewed']['candidate_id']==REVIEWED and proof['reviewed']['is_reviewed']is True and re.fullmatch('[a-f0-9]{64}',proof['reviewed']['sha256'])and re.fullmatch('[a-f0-9]{64}',proof['protected_m02']))
 for key,group in proof.items():
  if key in('reviewed','protected_m02'):continue
  need(type(group)is dict and type(group['count'])is int and group['count']>=0)
  if key.startswith('historical_'):need(set(group)=={'count','sha256'}and re.fullmatch('[a-f0-9]{64}',group['sha256']))
  else:
   need(set(group)=={'count','rows'}and group['count']==len(group['rows'])<=10000)
   need(len({row['key']for row in group['rows']})==group['count'])
   for row in group['rows']:
    need(set(row)=={'key','version_id','sha256'}and re.fullmatch('[a-f0-9]{64}',row['sha256'])and type(row['key'])is str and len(row['key'].split(':'))in(1,2))
    for key in row['key'].split(':'):identifier(key)
    if row['version_id']is not None:identifier(row['version_id'])
 need(proof['versions']['count']>0 and proof['reviewed_media']['count']>0 and proof['historical_jobs']['count']==1)
 return value

def job_check(row,job,workspace,earliest):
 need(type(row)is dict and set(row)==set('id workspace_id kind status stage attempt correlation_id workflow_execution_id created_at updated_at error_code cause_code traces events outbox provider_metadata'.split())and row['id']==identifier(job)and row['workspace_id']==identifier(workspace)and row['kind']=='specs_extract'and row['status']in('queued','running','waiting_for_input','succeeded','failed','cancelled')and row['stage']in('prepare_document','extract_specs','apply_specs')and type(row['attempt'])is int and 0<=row['attempt']<=100)
 need(timestamp(row['created_at'])>=timestamp(earliest)and timestamp(row['updated_at'])>=timestamp(row['created_at']))
 for key in ['correlation_id','workflow_execution_id','error_code','cause_code']:need(row[key]is None or safe(row[key]))
 for key in ['traces','events','outbox']:
  group=row[key];need(set(group)=={'total','rows'}and type(group['total'])is int and len(group['rows'])==group['total']<=100)
 traces={}
 for item in row['traces']['rows']:
  need(set(item)==set('job_id attempt_id stage attempt stage_attempt dispatch_generation correlation_id input_hash workflow_execution_id workflow_execution_ref_state claimed_at'.split()))
  identifier(item['attempt_id']);need(item['job_id']==job and item['stage']in('prepare_document','extract_specs','apply_specs')and item['attempt_id']not in traces and type(item['attempt'])is int and 1<=item['attempt']<=100 and item['workflow_execution_ref_state']in('recorded','not_provided','invalid_omitted'))
  need(item['workflow_execution_id']is None or safe(item['workflow_execution_id']));need(safe(item['correlation_id'])and re.fullmatch('[a-f0-9]{64}',item['input_hash']));timestamp(item['claimed_at']);traces[item['attempt_id']]=item
 for item in row['events']['rows']:need(set(item)==set('attempt_id sequence stage event_type created_at applied stale job_status'.split())and item['attempt_id']in traces and item['stage']==traces[item['attempt_id']]['stage']and item['event_type']in('heartbeat','progress','succeeded','failed')and type(item['sequence'])is int and item['sequence']>0 and type(item['applied'])is bool and type(item['stale'])is bool and item['job_status']in('queued','running','waiting_for_input','succeeded','failed','cancelled'));timestamp(item['created_at'])
 for item in row['outbox']['rows']:
  identifier(item['id']);need(set(item)==set('id job_id stage status attempt_count created_at delivered_at'.split())and item['job_id']==job and item['stage']in('prepare_document','extract_specs','apply_specs')and item['status']in('pending','leased','delivered','dead')and type(item['attempt_count'])is int and item['attempt_count']>=0);timestamp(item['created_at'])
  if item['delivered_at']is not None:timestamp(item['delivered_at'])
 need(type(row['provider_metadata'])is list and len(row['provider_metadata'])<=1)
 for item in row['provider_metadata']:
  need(set(item)==set('attempt_id source_bound provider requested_model resolved_model request_id response_id correlation_id usage'.split()))
  need(item['attempt_id']in traces and traces[item['attempt_id']]['stage']=='extract_specs'and item['source_bound']is True and item['provider']=='openai'and item['correlation_id']==traces[item['attempt_id']]['correlation_id'])
  for key in ['requested_model','resolved_model','response_id','correlation_id']:need(safe(item[key]))
  need(item['request_id']is None or type(item['request_id'])is str and re.fullmatch('req_[A-Za-z0-9_-]{1,128}',item['request_id']))
  if item['usage']is not None:need(set(item['usage'])=={'input_tokens','output_tokens','total_tokens'}and all(type(n)is int and 0<=n<=9007199254740991 for n in item['usage'].values())and item['usage']['total_tokens']==item['usage']['input_tokens']+item['usage']['output_tokens'])
 return row

def preserve(before,after):
 oldproof=before['preservation'];new=after['preservation'];need(set(oldproof)==set(new))
 for key,value in oldproof.items():
  if key in('reviewed','protected_m02')or key.startswith('historical_'):need(new[key]==value)
  else:need(all({r['key']:r for r in new[key]['rows']}.get(row['key'])==row for row in value['rows']))
 return True

def private_write(path,value):
 PRIVATE.mkdir(parents=True,exist_ok=True);guard=s.s.b.security()
 with guard.create(path)as stream:stream.write((json.dumps(value,sort_keys=True)+'\n').encode());stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
def private_read(path):s.s.b.security().verify(path);return json.loads(s.load(path))
def main():
 need(READ_ENABLED and len(sys.argv)in(2,3)and sys.argv[1]in('before','after'));mode=sys.argv[1];need(len(sys.argv)==(2 if mode=='before'else 3));value,admitted=config();sealed=pins()
 if mode=='before':
  need(not BEFORE.exists());observed=validate(a.query(sql(value)),admitted,True);need(pins()==sealed);private_write(BEFORE,{'config':value,'admission':admitted,'pins':sealed,'observation':observed});summary={'result':'baseline_captured_before_specs','preservation':observed['preservation']}
 else:
  job=identifier(sys.argv[2]);need(job not in(HISTORICAL,PROTECTED));baseline=private_read(BEFORE);need(baseline['config']==value and baseline['admission']==admitted and baseline['pins']==sealed)
  observed=validate(a.query(sql(value,job)),admitted);job_check(observed['job'],job,value['workspace_id'],baseline['observation']['observed_at']);preserve(baseline['observation'],observed);need(pins()==sealed)
  summary={'result':'metadata_and_preservation_observed','job':observed['job'],'protectedM02_historical136_Reviewed_Ready_preserved':True,'usage_or_cost_inferred':False,'runtime_failure_diagnostic_not_durable_state':True}
 folder=ROOT/'tracking/evidence/m07/specs-worker38-audit';folder.mkdir(parents=True,exist_ok=True);path=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+mode+'.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:json.dump({'schema_version':'1.0','target':s.TARGET,'observed_at':observed['observed_at'],'source_pins':sealed,'config_references':{key:val for key,val in value.items()if key.endswith('receipt')or key=='worker_ready'},'read_only':True,'provider_processing_called':False,'raw_inputs_prompts_logs_credentials_saved':False,**summary},stream,sort_keys=True,indent=2);stream.write('\n')
 return {'result':summary['result'],'receipt':path.relative_to(ROOT).as_posix()}
if __name__=='__main__':
 try:print(json.dumps(main()))
 except Exception:print('SPECS38_AUDIT_UNCONFIRMED');sys.exit(1)
