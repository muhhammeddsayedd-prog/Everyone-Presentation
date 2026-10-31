"""One exact read-only private source lookup. Never prints CLI/source payloads."""
from pathlib import Path
import datetime,hashlib,json,os,re,stat,subprocess,sys,threading,uuid

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse'
SOURCE_SHA='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
SQL=HERE/'inspect-source.sql'
SQL_SHA='cc57901a32244e97c571c8a37f8396d687e604ce3bf96bdf83ad2f58c2dacf33'
PRIVATE=ROOT/'.local/m03-english-component'
UUID=re.compile(r'^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$')
DIGEST=re.compile(r'^[a-f0-9]{64}$')
ENV_ALLOWED={'PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMW6432','SUPABASE_ACCESS_TOKEN'}
FORBIDDEN={'SUPABASE_PROJECT_ID','SUPABASE_PROJECT_REF','SUPABASE_API_URL','SUPABASE_WORKDIR','SUPABASE_DB_URL','DATABASE_URL','PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGPASSFILE','PGSERVICE','PGSERVICEFILE','PGOPTIONS','NODE_OPTIONS','NPM_CONFIG_NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE'}

def need(ok):
 if not ok:raise ValueError('ENGLISH_COMPONENT_SOURCE_UNCONFIRMED')

def sha(value):return hashlib.sha256(value).hexdigest()

def environment():
 need(not any(value for key,value in os.environ.items()if key.upper()in FORBIDDEN))
 return {key:value for key,value in os.environ.items()if key.upper()in ENV_ALLOWED}

def bounded(command):
 process=subprocess.Popen(command,cwd=ROOT,env=environment(),stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 buffers=[bytearray(),bytearray()];overflow=threading.Event()
 def drain(stream,index,limit):
  while chunk:=stream.read(4096):
   available=max(0,limit-len(buffers[index]));buffers[index].extend(chunk[:available])
   if len(chunk)>available:overflow.set();process.kill()
 threads=[threading.Thread(target=drain,args=(process.stdout,0,2*1024*1024)),threading.Thread(target=drain,args=(process.stderr,1,64*1024))]
 for thread in threads:thread.start()
 timeout=False
 try:process.wait(timeout=60)
 except subprocess.TimeoutExpired:timeout=True;process.kill();process.wait()
 for thread in threads:thread.join(timeout=3)
 need(not any(thread.is_alive()for thread in threads))
 return process.returncode,timeout,overflow.is_set(),bytes(buffers[0]),bytes(buffers[1])

def parse_source(payload):
 rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1 and type(rows[0])is dict and set(rows[0])=={'english_component_source'})
 value=rows[0]['english_component_source']
 need(type(value)is dict and set(value)=={'database','operator','history_count','match_count','source'})
 need(value['database']=='postgres'and value['operator']=='postgres'and value['history_count']in(33,34))
 need(type(value['match_count'])is int and value['match_count']==1)
 source=value['source'];need(type(source)is dict and set(source)=={'source_asset_id','source_sha256','candidate_media_id','transcript_asset_id','source_job_id','input_hash','original_text'})
 for key in('source_asset_id','candidate_media_id','transcript_asset_id','source_job_id'):
  need(type(source[key])is str and UUID.fullmatch(source[key]))
 need(source['source_sha256']==SOURCE_SHA and type(source['input_hash'])is str and DIGEST.fullmatch(source['input_hash']))
 text=source['original_text'];need(type(text)is str and 0<len(text)<=200000 and bool(text.strip()))
 text.encode('utf8','strict')
 source['original_sha256']=sha(text.encode('utf8'))
 return source

def snapshot_ok(path,expected):
 value=path.lstat();need(stat.S_ISREG(value.st_mode)and value.st_nlink==1 and path.resolve()==path)
 need(sha(path.read_bytes())==expected)

def main():
 need(len(sys.argv)==1 and(ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 source_bytes=SQL.read_bytes();need(sha(source_bytes)==SQL_SHA)
 need(source_bytes.rstrip().endswith(b'rollback;')and source_bytes.startswith(b'begin read only;'))
 need(not re.search(rb'(?im)^\s*(?:commit|insert|update|delete|create|alter|drop|grant|revoke)\b',source_bytes))
 prepared=json.loads((ROOT/'.local/m03-media-private/authorized-video-1.json').read_text(encoding='utf8'))
 need(prepared['original_filename']=='IMG_2850.MP4'and prepared['result']['source_sha256']==SOURCE_SHA)
 need(sha(Path('C:/Users/iway/Downloads/Videos/IMG_2850.MP4').read_bytes())==SOURCE_SHA)
 PRIVATE.mkdir(parents=True,exist_ok=True)
 with(PRIVATE/'source-lookup.claim.json').open('x',encoding='utf8')as stream:
  json.dump({'claimed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'sql_sha256':SQL_SHA,'automatic_retry':False},stream)
 directory=PRIVATE/str(uuid.uuid4());directory.mkdir();snapshot=directory/'source.sql'
 with snapshot.open('xb')as stream:stream.write(source_bytes)
 snapshot=snapshot.resolve();snapshot_ok(snapshot,SQL_SHA)
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(snapshot),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,stderr=bounded(command);snapshot_ok(snapshot,SQL_SHA)
 receipt={'evidence_kind':'actual_exact_source_read_only_lookup','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'case_alias':'permitted-arabic-introduction-01','target':TARGET,'sql_sha256':SQL_SHA,'read_only_rollback':True,'automatic_retry':False,'raw_cli_persisted':False,'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'source_confirmed':False}
 try:
  need(code==0 and not timeout and not overflow)
  source=parse_source(json.loads(stdout))
  with(PRIVATE/'source-binding.json').open('x',encoding='utf8',newline='\n')as stream:json.dump(source,stream,ensure_ascii=False)
  receipt['source_confirmed']=True
 except Exception:pass
 out=ROOT/'tracking/evidence/m03/english-component';out.mkdir(parents=True,exist_ok=True)
 path=out/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-source-read.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'source_confirmed':receipt['source_confirmed'],'receipt':path.relative_to(ROOT).as_posix(),'provider_called':False}))
 need(receipt['source_confirmed'])

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH_COMPONENT_SOURCE_UNCONFIRMED');sys.exit(1)
