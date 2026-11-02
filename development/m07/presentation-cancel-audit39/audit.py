"""One fixed canonical metadata read; never invokes generation or an acting role."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,re,sys,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
TARGET='pyibofyctwnqpvktepse';READER=ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py';GUARD=ROOT/'tools/provision_logo_verifier.py'
PINS={READER:'1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c',GUARD:'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c'}
def need(ok):
 if not ok:raise ValueError('PRESENTATION_CANCEL_AUDIT_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def main():
 need(len(sys.argv)==1 and(MAIN/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 for file,pin in PINS.items():need(sha(file.read_bytes())==pin)
 raw=(HERE/'audit.sql').read_bytes();text=raw.decode();import pglast;nodes=pglast.parse_sql(text)
 need([type(n.stmt).__name__ for n in nodes]==['TransactionStmt','VariableSetStmt','VariableSetStmt','VariableSetStmt','SelectStmt','TransactionStmt'])
 need(text.startswith('begin isolation level repeatable read read only;')and text.rstrip().endswith('rollback;')and not re.search(r'(?im)^\s*(?:commit|insert|update|delete|grant|revoke|create|alter|drop|explain|set\s+(?:local\s+)?role)\b',text))
 reader=module('cancel_audit_normal_reader',READER);sys.path.insert(0,str(ROOT/'tools'));security=module('cancel_audit_guard',GUARD);need(security.ROOT==ROOT)
 directory=ROOT/'.local/presentation-cancel-audit39'/str(uuid.uuid4());directory.mkdir(parents=True,exist_ok=False);guard=security.WindowsPrivateFiles();file=directory/'audit.sql'
 with guard.create(file)as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(file),'--output-format','json','--workdir',str(MAIN)]
 code,timeout,overflow,out,_stderr=reader.bounded(args,reader.environment());value=None
 if code==0 and not timeout and not overflow:
  payload=json.loads(out);rows=payload if type(payload)is list else payload.get('rows');need(type(rows)is list and len(rows)==1 and set(rows[0])=={'cancellation_metadata'});value=rows[0]['cancellation_metadata']
  need(value['database']==value['operator']==value['session_user']=='postgres'and value['read_only']is True and value['history_count']==39)
  for key in('versions','jobs'):need(value[key]['truncated']is False and value[key]['count']==len(value[key]['rows'])<=100)
  need(len(value['workspaces'])==2 and len(value['series'])==2 and all(len(value[k])<=100 for k in('configured_timeouts','function_metadata','activity','relevant_relation_locks')))
 receipt={'schema_version':'1.0','scope':'canonical39_after_owner_single_confirm_query_canceled_57014','result':'observed'if value else'unconfirmed','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'normal_cli':'Supabase2.122.0','read_only_rollback':True,'automatic_retry':False,'generate_or_confirm_or_retry_or_actor_simulation':False,'configuration_or_schema_or_session_cancellation_mutation':False,'raw_query_client_IP_principal_or_private_payload_output':False,'source_sha256':sha(Path(__file__).read_bytes()),'sql_sha256':sha(raw),'reader_sha256':PINS[READER],'guard_sha256':PINS[GUARD],'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'metadata':value,'limits':['57014 means query_canceled; the original native cancellation message was not retrieved by this query.','Configured role/function/database metadata is distinct from observing settings in the original PostgREST backend.','Current activity/lock absence cannot exclude a blocker during the earlier failed request.','No generation RPC, acting-role/JWT simulation, mutating EXPLAIN ANALYZE, cancellation, configuration change or retry performed.']}
 folder=ROOT/'tracking/evidence/m07/presentation-cancel-audit39';folder.mkdir(parents=True,exist_ok=True);output=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-cancellation-metadata.json')
 with output.open('x',encoding='utf8',newline='\n')as stream:json.dump(receipt,stream,sort_keys=True,indent=2);stream.write('\n')
 print(json.dumps({'result':receipt['result'],'receipt':output.relative_to(ROOT).as_posix(),'metadata':value}));need(value is not None)
if __name__=='__main__':
 try:main()
 except Exception:print('PRESENTATION_CANCEL_AUDIT_UNCONFIRMED');sys.exit(1)
