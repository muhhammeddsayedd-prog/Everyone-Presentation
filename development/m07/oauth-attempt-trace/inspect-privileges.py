"""Read-only effective OAuth coordinator permissions; no Auth row access."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,re,sys

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('attempt_reader',HERE/'inspect-attempt.py');base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
SQL=HERE/'inspect-privileges.sql'

def parse(payload):
 rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 base.need(type(rows)is list and len(rows)==1 and type(rows[0])is dict and set(rows[0])=={'oauth_privilege_metadata'})
 value=rows[0]['oauth_privilege_metadata'];base.need(type(value)is dict and set(value)=={'database','operator','observed_at','role','schema_usage','function_execute','session_select','registry_select','ledger','auth_schema','memberships','effective_role_users','policies','history_count'})
 base.need(value['database']=='postgres'and value['operator']=='postgres'and value['history_count']==32)
 base.need(type(value['role'])is dict and value['role'].get('name')=='eps_oauth_consent_owner')
 for key,fields in [('schema_usage',{'auth','eps','public'}),('function_execute',{'auth_uid','auth_jwt','browser_session','binding','binding_hash','authenticated_claim','authenticated_finish','anon_claim','anon_finish'}),('session_select',{'id','user_id','oauth_client_id','not_after'}),('registry_select',{'resource','client_id','enabled'})]:
  base.need(type(value[key])is dict and set(value[key])==fields and all(type(v)is bool for v in value[key].values()))
 base.need(type(value['policies'])is list and len(value['policies'])==3 and type(value['memberships'])is list and len(value['memberships'])<=20 and type(value['effective_role_users'])is list and len(value['effective_role_users'])<=20)
 # Query is fixed and metadata-only. Reject unexpected large or credential-like output.
 text=json.dumps(value);base.need(len(text)<=32768 and not re.search(r'(?i)(?:Bearer |sb_secret_|sbp_|sk-proj-|https?://)',text))
 return value

def main():
 base.need(len(sys.argv)==1 and(base.ROOT/'supabase/.temp/project-ref').read_text().strip()==base.TARGET)
 sql=SQL.read_bytes();base.need(sql.rstrip().endswith(b'rollback;')and b'read only;'in sql and not re.search(rb'(?im)^\s*(?:commit|insert|update|delete|grant|revoke|create|alter|drop)\b',sql))
 cmd=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',base.TARGET,'--file',str(SQL),'--output-format','json','--workdir',str(base.ROOT)]
 code,timeout,overflow,stdout,stderr=base.bounded(cmd,base.environment());metadata=None
 if code==0 and not timeout and not overflow:
  try:metadata=parse(json.loads(stdout))
  except Exception:pass
 receipt={'schema_version':'1.0','evidence_kind':'actual_oauth_coordinator_effective_privilege_read','target':base.TARGET,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sql_sha256':hashlib.sha256(sql).hexdigest(),'read_only_rollback':True,'automatic_retry':False,'raw_cli_persisted':False,'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'metadata':metadata,'safe_error':base.safe_errors(stdout,stderr)if metadata is None else None}
 out=base.ROOT/'tracking/evidence/m07/oauth-attempt-trace';out.mkdir(parents=True,exist_ok=True)
 path=out/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-coordinator-privileges.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':'passed'if metadata else'unconfirmed','receipt':path.relative_to(base.ROOT).as_posix(),'metadata':metadata,'safe_error':receipt['safe_error']}));base.need(metadata is not None)

if __name__=='__main__':
 try:main()
 except Exception:print('OAUTH_PRIVILEGE_METADATA_UNCONFIRMED');sys.exit(1)
