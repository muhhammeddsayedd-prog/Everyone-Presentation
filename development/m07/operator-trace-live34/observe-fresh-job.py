"""One fixed read-only canonical34 job/event projection. Importing performs no IO."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,re,stat,sys,uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse';JOB='3cf25d3b-c1ec-4347-af3b-fa48f3f0f5e7';WORKSPACE='86936940-b48d-497d-b1ff-8e0da0913afa'
READER=ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py'
READER_SHA='1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c'
SQL=HERE/'fresh-job-query.sql'
SQL_SHA='8e3c75356e624b500cc60b93392393691f5e6ed23cbeca0ae0dcd56a03ddae23'
PINS={
 'tracking/evidence/m03/english-release34/2026-10-31T17-54-57-429822Z-enable-readback.json':'86144aa1ba2e6896e170ea7b0f74c7313cd46f21f9359480c24ae7c86ac14fec',
 'tracking/evidence/m03/english-name-review/2026-10-31-controlled-job-binding.json':'7e294cf3fb2a68f91401d2ecc4258645d4ea694143f6695aaa74de0c3a1ba88a',
 'tracking/evidence/m03/english-name-review/2026-10-31T17-58-54-734417Z-c95c23b3-a8aa-4d11-9602-c9b4f9ef8dbb-controlled-job.json':'53a5bd3791f64ea586f56b02f4c37bfd2f9c57cbd093ed570eba426deb3101f8'}
STAGES={'prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'}
UUID=re.compile(r'^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$')
def need(value):
 if not value:raise ValueError('FRESH_OPERATOR_JOB_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def exact(value,keys):need(type(value)is dict and set(value)==set(keys))
def count(value):return type(value)is int and 0<=value<=9007199254740991
def timestamp(value):
 need(type(value)is str and len(value)<=40)
 parsed=datetime.datetime.fromisoformat(value.replace('Z','+00:00'));need(parsed.tzinfo is not None and parsed.utcoffset()==datetime.timedelta(0));return parsed
def identifier(value):return type(value)is str and UUID.fullmatch(value)is not None
def parse(payload):
 rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1);exact(rows[0],{'fresh_operator_job'});value=rows[0]['fresh_operator_job']
 exact(value,{'database','operator','observed_at','read_only','exact_history34','english_enabled','candidate_apply_source_attributes_preserved','protected_m02_metadata_preserved','match_count','job','events_total','events_truncated','events','outbox'})
 need(value['database']=='postgres'and value['operator']=='postgres'and value['match_count']==1 and type(value['match_count'])is int)
 need(all(value[k]is True for k in ['read_only','exact_history34','english_enabled','candidate_apply_source_attributes_preserved','protected_m02_metadata_preserved']))
 observed=timestamp(value['observed_at']);job=value['job']
 exact(job,{'id','kind','workspace_id','status','stage','attempt','request_id','workflow_execution_id','created_at','updated_at'})
 need(job['id']==JOB and job['workspace_id']==WORKSPACE and job['kind']=='candidate_scan'and job['status']=='succeeded'and job['stage']=='apply_candidate'and count(job['attempt'])and job['attempt']>0)
 need(job['request_id']is None or identifier(job['request_id']))
 need(job['workflow_execution_id']is None or type(job['workflow_execution_id'])is str and re.fullmatch(r'[1-9][0-9]{0,15}',job['workflow_execution_id']))
 need(timestamp(job['created_at'])<=timestamp(job['updated_at'])<=observed)
 need(count(value['events_total'])and type(value['events_truncated'])is bool and type(value['events'])is list)
 need(len(value['events'])==min(value['events_total'],100)and value['events_truncated']==(value['events_total']>100))
 seen=set();previous=None
 for event in value['events']:
  exact(event,{'attempt_id','sequence','stage','event_type','created_at'})
  need(identifier(event['attempt_id'])and count(event['sequence'])and event['sequence']>0 and event['stage']in STAGES and event['event_type']in{'heartbeat','progress','succeeded','failed'})
  key=(event['attempt_id'],event['sequence']);need(key not in seen);seen.add(key)
  at=timestamp(event['created_at']);need(at<=observed and(previous is None or previous<=at));previous=at
 box=value['outbox'];exact(box,{'total','pending','leased','delivered','dead'})
 need(all(count(v)for v in box.values())and sum(box[k]for k in ['pending','leased','delivered','dead'])==box['total'])
 return value
def regular(file,digest):
 info=file.lstat();need(stat.S_ISREG(info.st_mode)and info.st_nlink==1 and not file.is_symlink()and file.resolve()==file)
 need(sha(file.read_bytes())==digest)
def source_bytes():
 regular(SQL,SQL_SHA);regular(READER,READER_SHA)
 for name,digest in PINS.items():regular(ROOT/name,digest)
 raw=SQL.read_bytes();code=re.sub(r'--[^\r\n]*','',raw.decode('utf8'))
 need(len(raw)<16000 and code.strip().startswith('begin isolation level repeatable read read only;')and code.rstrip().endswith('rollback;'))
 need(not re.search(r'\b(insert|update|delete|merge|create|alter|drop|grant|revoke|truncate|copy|call|do|execute|commit|vacuum|analyze|refresh|set_config|dblink|pg_sleep|receipt|payload|input_hash|lease_token_digest)\b',code,re.I))
 need(code.count('limit 100')==1)
 return raw
def main():
 need(len(sys.argv)==1 and(ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 raw=source_bytes();spec=importlib.util.spec_from_file_location('fresh_metadata_reader',READER);reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
 private=ROOT/'.local/m03-english-component';need(private.is_dir()and not private.is_symlink()and private.resolve()==private)
 claim=private/'at074-job-3cf25d3b-read.claim.json'
 with claim.open('x',encoding='utf-8',newline='\n')as stream:json.dump({'job_id':JOB,'query_sha256':SQL_SHA,'maximum_cli_queries':1,'automatic_retry':False},stream)
 area=private/('at074-'+str(uuid.uuid4()));area.mkdir(mode=0o700)
 query=area/'query.sql'
 with query.open('xb')as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno())
 regular(query,SQL_SHA)
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(query),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,stderr=reader.bounded(command,reader.environment());need(code==0 and not timeout and not overflow)
 value=parse(json.loads(stdout))
 receipt={'schema_version':'1.0','evidence_kind':'actual_new_english_job_bounded_durable_metadata_read','target':TARGET,'read_only':True,'automatic_retry':False,'maximum_cli_queries':1,'job_observation':value,'source_pins':{**PINS,'query_sha256':SQL_SHA,'reader_sha256':READER_SHA,'operator_sha256':sha(Path(__file__).read_bytes())},'raw_cli_or_payloads_persisted':False,'n8n_metadata_requested':False,'per_stage_workflow_execution_history_reconstructed':False,'AT074_status':'partial_pending_exact_latest_execution_metadata_and_remaining_failure_path'}
 folder=ROOT/'tracking/evidence/m07/operator-trace-live34';folder.mkdir(parents=True,exist_ok=True)
 file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-fresh-job-durable.json')
 with file.open('x',encoding='utf-8',newline='\n')as stream:json.dump(receipt,stream,indent=2);stream.write('\n')
 print(json.dumps({'receipt':file.relative_to(ROOT).as_posix(),'job_id':JOB,'workflow_execution_id':value['job']['workflow_execution_id'],'events_total':value['events_total'],'AT074_status':receipt['AT074_status']}))
if __name__=='__main__':
 try:main()
 except Exception:print('FRESH_OPERATOR_JOB_UNCONFIRMED');sys.exit(1)
