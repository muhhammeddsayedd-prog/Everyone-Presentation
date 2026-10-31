"""Fixed read-only on-call projection; import and unit tests perform no provider IO."""
from pathlib import Path
import copy,datetime,hashlib,importlib.util,json,os,re,stat,sys,uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse';SQL=HERE/'job-trace.sql'
SQL_SHA='676610be9ed40e8952be87d8e08b402e62848250825878322f1ddf6558adeceb'
READER=ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py'
READER_SHA='1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c'
WORKSPACE='86936940-b48d-497d-b1ff-8e0da0913afa'
JOBS={'fa8593ca-80c2-4cb3-8bcc-0e357ffbf7f2':'candidate_scan','35dcef5a-4717-4cdf-8cef-85f6940d0aec':'specs_extract','7ca22801-2040-40df-87fc-84a82fffb6c7':'presentation_render'}
STAGES={'candidate_scan':{'prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'},'specs_extract':{'prepare_document','extract_specs','apply_specs'},'presentation_render':{'prepare_presentation','render_presentation','validate_presentation','publish_presentation'}}
STATUSES={'queued','running','waiting_for_input','succeeded','failed','cancelled'}
ERRORS={'DEPENDENCY_UNAVAILABLE','SOURCE_UNREADABLE','UNSUPPORTED_FORMAT','RESULT_INVALID','EXTRACTION_REFUSED','PROVIDER_RATE_LIMITED','LEASE_EXPIRED','DISPATCH_UNAVAILABLE','INPUT_CHANGED','PROCESSING_FAILED','RETRY_EXHAUSTED','PDF_TEMPLATE_MISMATCH','PDF_ASSET_INVALID','PDF_OVERFLOW','PDF_RENDER_FAILED','PDF_VALIDATION_FAILED','PDF_ABORTED','PDF_BUDGET_EXCEEDED','JOB_CANCELLED','PDF_SOURCE_UNAVAILABLE','PDF_TEMPLATE_UNAVAILABLE','PDF_LAYOUT_OVERFLOW','PDF_INVALID','PDF_PAGE_COUNT_MISMATCH','PDF_LINKS_INVALID','PDF_OUTPUT_UNVERIFIED','SNAPSHOT_INVALID','PERMISSION_CHANGED','UNCLASSIFIED_ERROR'}
UUID=re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
FORBIDDEN=re.compile(r'\b(?:insert|update|delete|merge|create|alter|drop|grant|revoke|truncate|copy|call|do|execute|commit|vacuum|analyze|refresh|set_config|dblink|pg_sleep|lo_import|lo_export|pg_read_file|pg_write_file)\b',re.I)

def need(value):
 if not value:raise ValueError('OPERATOR_TRACE_UNCONFIRMED')
def exact(value,keys):need(type(value)is dict and set(value)==set(keys))
def identifier(value):return type(value)is str and UUID.fullmatch(value)is not None
def count(value):return type(value)is int and 0<=value<=9007199254740991
def timestamp(value):
 need(type(value)is str and len(value)<=40)
 parsed=datetime.datetime.fromisoformat(value.replace('Z','+00:00'));need(parsed.tzinfo is not None and parsed.utcoffset()==datetime.timedelta(0));return parsed
def nullable_time(value):
 if value is not None:timestamp(value)
def validate_sql(source):
 need(type(source)is bytes and len(source)<=24000)
 text=source.decode('utf8');code=re.sub(r'--[^\r\n]*','',text)
 need(not FORBIDDEN.search(code)and code.strip().startswith('begin isolation level repeatable read read only;')and code.rstrip().endswith('rollback;'))
 need(code.count('limit 100')==1 and code.count('limit 50')==1 and "set local search_path='';"in code and "set local statement_timeout='20s';"in code)
 need(not re.search(r'\b(?:payload|receipt|input_hash|dedupe_key|lease_token_digest|lease_expires_at)\b',code,re.I))
 need(hashlib.sha256(source).hexdigest()==SQL_SHA)
 return source
def bounded_array(parent,name,cap):
 rows=parent[name];total=parent[name+'_total'];truncated=parent[name+'_truncated']
 need(type(rows)is list and len(rows)<=cap and count(total)and type(truncated)is bool)
 need(len(rows)==min(total,cap)and truncated==(total>cap));return rows

def parse(payload):
 rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1);exact(rows[0],{'operator_job_trace'});value=rows[0]['operator_job_trace']
 exact(value,{'database','operator','observed_at','read_only','history_count','exact_history33','protected_m02_preserved','jobs'})
 need(value['database']=='postgres'and value['operator']=='postgres'and value['read_only']is True and value['history_count']==33 and type(value['history_count'])is int and value['exact_history33']is True and value['protected_m02_preserved']is True)
 observed=timestamp(value['observed_at']);need(type(value['jobs'])is list and len(value['jobs'])==3)
 need({job.get('id')for job in value['jobs']if type(job)is dict}==set(JOBS))
 for job in value['jobs']:
  exact(job,{'id','kind','workspace_id','resource_id','requested_by','request_id','status','stage','attempt','created_at','updated_at','workflow_execution_id','error_code','events_total','events_truncated','events','outbox','audit_total','audit_truncated','audit'})
  need(job['kind']==JOBS[job['id']]and job['workspace_id']==WORKSPACE and identifier(job['resource_id'])and identifier(job['requested_by']))
  need(job['request_id']is None or identifier(job['request_id']))
  need(job['status']in STATUSES and job['stage']in STAGES[job['kind']]and count(job['attempt']))
  need(timestamp(job['created_at'])<=timestamp(job['updated_at'])<=observed)
  need(job['workflow_execution_id']is None or type(job['workflow_execution_id'])is str and re.fullmatch(r'[0-9]{1,20}',job['workflow_execution_id']))
  need(job['error_code']is None or job['error_code']in ERRORS)
  events=bounded_array(job,'events',100);seen=set();previous=None
  for event in events:
   exact(event,{'attempt_id','sequence','stage','event_type','created_at'})
   need(identifier(event['attempt_id'])and count(event['sequence'])and event['sequence']>0 and event['stage']in STAGES[job['kind']]and event['event_type']in{'heartbeat','progress','succeeded','failed'})
   key=(event['attempt_id'],event['sequence']);need(key not in seen);seen.add(key)
   created=timestamp(event['created_at']);need(created<=observed and(previous is None or previous<=created));previous=created
  outbox=job['outbox'];exact(outbox,{'total','pending','leased','delivered','dead','delivery_attempts','last_created_at','last_delivered_at'})
  need(all(count(outbox[key])for key in('total','pending','leased','delivered','dead','delivery_attempts'))and sum(outbox[key]for key in('pending','leased','delivered','dead'))==outbox['total']and outbox['delivery_attempts']<=5*outbox['total'])
  for key in('last_created_at','last_delivered_at'):nullable_time(outbox[key]);need(outbox[key]is None or timestamp(outbox[key])<=observed)
  need((outbox['total']==0)==(outbox['last_created_at']is None)and(outbox['delivered']==0)==(outbox['last_delivered_at']is None))
  audit=bounded_array(job,'audit',50);seen=set();previous=None
  for entry in audit:
   exact(entry,{'id','resource_id','principal_id','request_id','declared_client','created_at'})
   need(identifier(entry['id'])and entry['id']not in seen and entry['resource_id']in(job['id'],job['resource_id'])and identifier(entry['principal_id']))
   seen.add(entry['id']);need(entry['request_id']is None or identifier(entry['request_id']));need(entry['declared_client']in{'browser','api','mcp'})
   created=timestamp(entry['created_at']);need(created<=observed and(previous is None or previous<=created));previous=created
 return copy.deepcopy(value)

def json_payload(text):
 def unique(pairs):
  value={}
  for key,item in pairs:need(key not in value);value[key]=item
  return value
 need(type(text)is str and len(text.encode('utf8'))<=256*1024)
 return json.loads(text,object_pairs_hook=unique)

def load_reader():
 need(hashlib.sha256(READER.read_bytes()).hexdigest()==READER_SHA)
 spec=importlib.util.spec_from_file_location('fixed_bounded_trace_reader',READER);reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader);return reader

def snapshot_sql(source,root=ROOT):
 """Dispatch consumes this exclusive owned copy, never the editable source path."""
 validate_sql(source);root=Path(root).resolve(strict=True);area=root/'.local/m07-operator-trace';area.mkdir(parents=True,exist_ok=True)
 for path in(root/'.local',area):need(path.is_dir()and not path.is_symlink()and path.resolve(strict=True)==path)
 run_id=str(uuid.uuid4());directory=area/run_id;directory.mkdir(mode=0o700)
 owner={'run_id':run_id,'purpose':'fixed-readonly-operator-query','query_sha256':SQL_SHA}
 for name,content in(('query.sql',source),('owner.json',(json.dumps(owner,sort_keys=True)+'\n').encode())):
  path=directory/name;descriptor=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(descriptor,'wb')as stream:stream.write(content);stream.flush();os.fsync(stream.fileno())
 snapshot={'run_id':run_id,'query_path':str(directory/'query.sql')};verify_snapshot(snapshot,root);return snapshot

def verify_snapshot(snapshot,root=ROOT):
 exact(snapshot,{'run_id','query_path'});need(identifier(snapshot['run_id']))
 root=Path(root).resolve(strict=True);directory=root/'.local/m07-operator-trace'/snapshot['run_id'];query=directory/'query.sql'
 need(snapshot['query_path']==str(query))
 for path in(root/'.local',directory.parent,directory):need(path.is_dir()and not path.is_symlink()and path.resolve(strict=True)==path)
 for path,maximum in((query,24000),(directory/'owner.json',4096)):
  info=path.lstat();need(stat.S_ISREG(info.st_mode)and info.st_nlink==1 and 0<info.st_size<=maximum and not path.is_symlink()and path.resolve(strict=True)==path)
 owner=json_payload((directory/'owner.json').read_text(encoding='utf8'));need(owner=={'run_id':snapshot['run_id'],'purpose':'fixed-readonly-operator-query','query_sha256':SQL_SHA})
 validate_sql(query.read_bytes());return query

def main():
 need(len(sys.argv)==2 and sys.argv[1]in{'preview','collect'});source=validate_sql(SQL.read_bytes())
 if sys.argv[1]=='preview':print(json.dumps({'read_only':True,'target':TARGET,'job_count':3,'query_sha256':hashlib.sha256(source).hexdigest(),'provider_reads':0}));return
 need((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET);reader=load_reader();environment=reader.environment();snapshot=snapshot_sql(source)
 query=verify_snapshot(snapshot)
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(query),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,stderr=reader.bounded(command,environment)
 verify_snapshot(snapshot)
 need(code==0 and not timeout and not overflow);projection=parse(json_payload(stdout))
 receipt={'schema_version':'1.0','evidence_kind':'actual_canonical_job_operator_projection','target':TARGET,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'read_only':True,'query_sha256':hashlib.sha256(source).hexdigest(),'query_snapshot':Path(snapshot['query_path']).relative_to(ROOT).as_posix(),'raw_cli_persisted':False,'metadata':projection,'at074_status':'partial_external_execution_history_unavailable'}
 out=ROOT/'tracking/evidence/m07/operator-trace';out.mkdir(parents=True,exist_ok=True)
 path=out/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+str(uuid.uuid4())[:8]+'-job-trace.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':'observed','receipt':path.relative_to(ROOT).as_posix(),'job_count':3,'protected_m02_preserved':projection['protected_m02_preserved'],'at074_status':receipt['at074_status']}))

if __name__=='__main__':
 try:main()
 except Exception:print('OPERATOR_TRACE_UNCONFIRMED');sys.exit(1)
