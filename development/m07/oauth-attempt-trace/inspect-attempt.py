"""Fixed read-only native OAuth metadata. Existing CLI session stays private.

Never fetches a valid authorization-details URL or assumes an acting identity.
All stdout/stderr is bounded in RAM; only a validated safe projection is saved.
"""
from pathlib import Path
import datetime,hashlib,json,os,re,subprocess,sys,threading

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse'
SQL=HERE/'inspect-attempt.sql'
FORBIDDEN={'SUPABASE_PROJECT_ID','SUPABASE_PROJECT_REF','SUPABASE_API_URL','SUPABASE_WORKDIR','SUPABASE_DB_URL','DATABASE_URL','PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGPASSFILE','PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGSSLMODE','PGSSLROOTCERT','PGSSLCERT','PGSSLKEY','PGSSLNEGOTIATION','NODE_OPTIONS','NPM_CONFIG_NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE'}
UUID=re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
CALLBACK=re.compile(r'^http://(?:localhost|127\.0\.0\.1):[0-9]{1,5}/callback$')
SCOPE=re.compile(r'^(?:openid|profile|email|offline_access|phone|address)(?: (?:openid|profile|email|offline_access|phone|address))*$')

def need(ok):
 if not ok:raise ValueError('OAUTH_ATTEMPT_METADATA_UNCONFIRMED')

def environment():
 need(not any(v for k,v in os.environ.items()if k.upper()in FORBIDDEN))
 return {k:v for k,v in os.environ.items()if 'DEBUG'not in k.upper()}

def bounded(command,env):
 process=subprocess.Popen(command,cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 buffers=[bytearray(),bytearray()];overflow=threading.Event()
 def read(stream,index,limit):
  while chunk:=stream.read(4096):
   available=max(0,limit-len(buffers[index]));buffers[index].extend(chunk[:available])
   if len(chunk)>available:overflow.set();process.kill()
 threads=[threading.Thread(target=read,args=(process.stdout,0,256*1024)),threading.Thread(target=read,args=(process.stderr,1,64*1024))]
 for thread in threads:thread.start()
 timed_out=False
 try:process.wait(timeout=60)
 except subprocess.TimeoutExpired:timed_out=True;process.kill();process.wait()
 for thread in threads:thread.join(timeout=3)
 need(all(not thread.is_alive()for thread in threads))
 return process.returncode,timed_out,overflow.is_set(),*(bytes(value).decode('utf8','replace')for value in buffers)

def safe_errors(stdout,stderr):
 # Native MESSAGE_TEXT only. Discard DETAIL, CONTEXT, query and raw response.
 message='';status=None
 try:
  value=json.loads(stdout);error=value.get('error')if type(value)is dict else None
  if type(error)is dict and type(error.get('message'))is str:message=error['message']
 except Exception:pass
 if not message:message=stderr[:65536]
 match=re.search(r'(?i)unexpected status\s+(\d{3})\s*:',message)
 if match:status=int(match.group(1))
 start=message.find('{')
 if start>=0:
  try:
   nested=json.loads(message[start:])
   if type(nested)is dict and type(nested.get('message'))is str:message=nested['message']
  except Exception:pass
 native=re.search(r'(?i)ERROR:\s*([A-Z0-9]{5}):\s*([^\r\n]*)',message)
 states=[native.group(1).upper()]if native else sorted(set(re.findall(r'(?i)SQLSTATE[^a-z0-9]{0,8}([a-z0-9]{5})',message)))
 line=native.group(2)if native else message.splitlines()[0]if message else ''
 line=re.split(r'(?i)\\+[nr]|\b(?:LINE\s+\d+\s*:|DETAIL:|CONTEXT:|QUERY:|STATEMENT:)',line,maxsplit=1)[0]
 line=re.sub(r'(?i)https?://[^\s<>"\x27]+','[URL]',line)
 line=re.sub(r'(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b','[EMAIL]',line)
 line=re.sub(r'(?i)\bBearer\s+[^\s"\x27]+','Bearer [CREDENTIAL]',line)
 line=re.sub(r'[A-Za-z0-9_\-]{20,}','[LONG_VALUE]',line)
 line=' '.join(line.encode('ascii','replace').decode().split())[:240]
 return {'http_status':status,'sqlstates':states,'sanitized_native_error':line,'raw_cli_persisted':False}

def callback(value):return type(value)is str and(value=='[other]'or value=='https://claude.ai/api/mcp/auth_callback'or CALLBACK.fullmatch(value))

def parse(payload):
 rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1 and type(rows[0])is dict and set(rows[0])=={'oauth_attempt_metadata'})
 value=rows[0]['oauth_attempt_metadata']
 need(type(value)is dict and set(value)=={'database','operator','observed_at','window_start','window_end','limit','attempts','expected_clients','history_count'})
 need(value['database']=='postgres'and value['operator']=='postgres'and value['window_start']=='2026-10-31T12:30:00Z'and value['window_end']=='2026-10-31T12:46:00Z'and value['limit']==50)
 need(type(value['history_count'])is int and 29<=value['history_count']<=40)
 datetime.datetime.fromisoformat(value['observed_at'].replace('Z','+00:00'))
 need(type(value['attempts'])is list and len(value['attempts'])<=50 and type(value['expected_clients'])is list and len(value['expected_clients'])<=1)
 booleans={'client_is_expected','callback_matches_registered','callback_matches_expected','user_is_null','user_is_owner','resource_is_null','resource_matches_expected','claim_exists'}
 keys=booleans|{'client_id','created_at','expires_at','status','scope','callback','callback_class','enabled_registry_matches','enabled_client_registry_count','claim_outcome'}
 for row in value['attempts']:
  need(type(row)is dict and set(row)==keys and all(type(row[k])is bool for k in booleans))
  need(type(row['client_id'])is str and UUID.fullmatch(row['client_id'])and callback(row['callback']))
  need(row['status']in('pending','approved','denied','expired','[other]')and row['callback_class']in('claude_ai','http_loopback_callback','other')and row['claim_outcome']in(None,'claimed','consent_ready','redirect','uncertain','rejected'))
  need(type(row['scope'])is str and len(row['scope'])<=256 and(row['scope']=='[other]'or SCOPE.fullmatch(row['scope'])))
  for key in('created_at','expires_at'):datetime.datetime.fromisoformat(row[key].replace('Z','+00:00'))
  need(all(type(row[key])is int and 0<=row[key]<=100 for key in('enabled_registry_matches','enabled_client_registry_count')))
 for row in value['expected_clients']:
  need(type(row)is dict and set(row)=={'client_id','not_deleted','client_type','registration_type','token_endpoint_auth_method','grant_types','registered_callbacks','registered_expected_callback'})
  need(row['client_id']=='f2acafd5-d4b6-4176-b86c-067c57e45ecc'and type(row['not_deleted'])is bool and type(row['registered_expected_callback'])is bool)
  need(row['client_type']in('public','confidential','[other]')and row['registration_type']in('manual','dynamic','[other]')and row['token_endpoint_auth_method']in('none','client_secret_basic','client_secret_post','[other]'))
  need(type(row['grant_types'])is str and(row['grant_types']=='[other]'or re.fullmatch(r'(?:authorization_code|refresh_token)(?:,(?:authorization_code|refresh_token))*',row['grant_types'])))
  need(type(row['registered_callbacks'])is list and len(row['registered_callbacks'])<=32 and all(callback(uri)for uri in row['registered_callbacks']))
 return value

def main():
 need(len(sys.argv)==1 and(ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 sql=SQL.read_bytes();need(sql.rstrip().endswith(b'rollback;')and b'read only;'in sql and not re.search(rb'(?im)^\s*(?:commit|insert|update|delete|grant|revoke|create|alter|drop)\b',sql))
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(SQL),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,stderr=bounded(command,environment());metadata=None
 if code==0 and not timeout and not overflow:
  try:metadata=parse(json.loads(stdout))
  except Exception:pass
 receipt={'schema_version':'1.0','evidence_kind':'actual_native_oauth_attempt_safe_metadata_read','target':TARGET,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sql_sha256':hashlib.sha256(sql).hexdigest(),'read_only_rollback':True,'automatic_retry':False,'raw_cli_persisted':False,'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'metadata':metadata,'safe_error':safe_errors(stdout,stderr)if metadata is None else None}
 out=ROOT/'tracking/evidence/m07/oauth-attempt-trace';out.mkdir(parents=True,exist_ok=True)
 path=out/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-native-attempt-metadata.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':'passed'if metadata is not None else 'unconfirmed','receipt':path.relative_to(ROOT).as_posix(),'metadata':metadata,'safe_error':receipt['safe_error']}));need(metadata is not None)

if __name__=='__main__':
 try:main()
 except Exception:print('OAUTH_ATTEMPT_METADATA_UNCONFIRMED');sys.exit(1)
