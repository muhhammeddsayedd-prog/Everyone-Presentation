"""Root-executed fixed cached image build/push, no credential extraction.

Native and daemon have separate permanent claims. Raw progress/diagnostics stay
bounded in RAM. Metadata-only heartbeats let root observe a long operation.
"""
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, re, subprocess, sys, threading, time

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('english34_build_refresh',HERE/'refresh-vcr.py');refresh=importlib.util.module_from_spec(spec);spec.loader.exec_module(refresh)
RUN='4186fd1e-55c7-4ea5-956e-ad9ad92f64b1';SOURCE='b3489d64fb1bb207e0a1020fadac3db14490c94ba6d2aedf9c6a358ebb36f181';COUNT=160
DIRECTORY=ROOT/'.local/worker-hosting'/RUN;CONTEXT=DIRECTORY/'context';PRIVATE=ROOT/'.local/m03-english-image34'
HOST='npipe:////./pipe/dockerDesktopLinuxEngine';DEADLINE=1800
PREFIX='vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/'
TAG='english34-auth-4186fd1e'
REFRESH=ROOT/'tracking/evidence/m03/english-image34/2026-10-31T16-49-43-943508Z-vcr-refresh.json';REFRESH_SHA='c3ceb996843c7608877ed8c09c0356b0c6b94e58c1f56684ce4a54a1652cfbc5'
IMPORT="RUN --network=none /usr/local/bin/node --import tsx --input-type=module -e \"await import('./apps/worker/src/runtime-main.ts')\""

def need(value):
 if not value:raise ValueError('ENGLISH34_IMAGE_BUILD_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def exact_file(path,maximum=16*1024*1024):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and 0<path.stat().st_size<=maximum);return path.read_bytes()
def verify_context(kind):
 need(kind in('native','daemon')and CONTEXT.resolve()==CONTEXT and not CONTEXT.is_symlink())
 owner=json.loads(exact_file(DIRECTORY/'owner.json',4096));need(owner=={'owner':'eps-worker-hosting-build','run':RUN,'source_sha256':SOURCE})
 seal_raw=exact_file(CONTEXT/'apps/worker/native-source.json');seal=json.loads(seal_raw);need(set(seal)=={'source_sha256','files'}and seal['source_sha256']==SOURCE and type(seal['files'])is list and len(seal['files'])==COUNT)
 rows=seal['files'];need(sha(json.dumps(rows,separators=(',',':'),ensure_ascii=False).encode())==SOURCE)
 pattern=r'(?:package(?:-lock)?\.json|apps/(?:web|worker)/package\.json|apps/worker/Dockerfile\.(?:daemon|native-sandbox)|packages/(?:domain|jobs|integrations|central)/package\.json|(?:apps/worker/src|packages/(?:domain|jobs|integrations|central)/src|packages/templates/(?:src|versions))/[A-Za-z0-9_./-]+\.(?:ts|mjs|json)|contracts/json-schema/(?:specs-extraction|candidate-extraction|frame-selection|slide-wording)\.schema\.json|packages/templates/registry\.json|apps/web/public/fonts/IBMPlexSans(?:Arabic)?-(?:Regular\.woff2|Medium\.woff2|SemiBold\.woff2|LICENSE\.txt)|apps/web/public/brand/everyone-logotype(?:-white)?\.svg)'
 expected={};previous=''
 for row in rows:
  need(type(row)is dict and set(row)=={'path','bytes','sha256'}and type(row['path'])is str and row['path']>previous and re.fullmatch(pattern,row['path'])and '..'not in row['path']and type(row['bytes'])is int and re.fullmatch('[a-f0-9]{64}',row['sha256']))
  raw=exact_file(CONTEXT/row['path']);need(len(raw)==row['bytes']and sha(raw)==row['sha256']);previous=row['path'];expected[row['path']]=row['sha256']
 for name in ['daemon','native-sandbox']:
  expected['Dockerfile.'+name]=expected['apps/worker/Dockerfile.'+name];need(sha(exact_file(CONTEXT/('Dockerfile.'+name)))==expected['Dockerfile.'+name])
 expected['apps/worker/native-source.json']=sha(seal_raw)
 ignore=exact_file(CONTEXT/'.dockerignore',4096);need(ignore==b'.git\n.env*\n.local\nnode_modules\n**/node_modules\n');expected['.dockerignore']=sha(ignore)
 manifest=CONTEXT/'apps/worker/native-sandbox-manifest.json'
 if kind=='native':need(not manifest.exists())
 else:
  native=load_success('native');raw=exact_file(manifest,4096);value=json.loads(raw)
  need(value=={'schema_version':'1.0','transport':'vercel_sandbox','protocol':'eps-native-files-v1','image':PREFIX.removeprefix('vcr.vercel.com/')+'native@'+native['runtime_digest'],'region':'dub1','source_sha256':SOURCE});expected['apps/worker/native-sandbox-manifest.json']=sha(raw)
  dockerfile=exact_file(CONTEXT/'Dockerfile.daemon').decode('utf8');need(dockerfile.count(IMPORT)==1 and dockerfile.index('USER 1000:1000')<dockerfile.index(IMPORT))
 actual=set()
 for path in CONTEXT.rglob('*'):
  need(not path.is_symlink()and path.resolve().is_relative_to(CONTEXT))
  if path.is_file():actual.add(path.relative_to(CONTEXT).as_posix())
 need(actual==set(expected));return {'source_sha256':SOURCE,'file_count':COUNT,'context_files':len(actual),'source_seal_sha256':sha(seal_raw),'manifest_sha256':expected.get('apps/worker/native-sandbox-manifest.json')}
def load_success(kind):
 pointer=json.loads(exact_file(PRIVATE/(kind+'-build.success.json'),4096));need(set(pointer)=={'receipt','sha256'})
 relative=pointer['receipt'];need(type(relative)is str and relative.startswith('tracking/evidence/m03/english-image34/')and '..'not in relative and '\\'not in relative)
 raw=exact_file(ROOT/relative,1024*1024);need(sha(raw)==pointer['sha256']);value=json.loads(raw)
 need(value['result']=='passed'and value['kind']==kind and value['source_sha256']==SOURCE and value['run']==RUN and value['target']==PREFIX+kind+':'+TAG and re.fullmatch('sha256:[a-f0-9]{64}',value['runtime_digest']))
 return value
def source_pins():
 need(sha(exact_file(REFRESH,1024*1024))==REFRESH_SHA);value=json.loads(REFRESH.read_bytes());need(value['result']=='passed'and value['scoped_login_success']=={'engine':'docker','registry':'vcr.vercel.com','status':'success','username':'oidc','validForHours':12}and value['registry_read']['read_succeeded']is True)
 issued=datetime.datetime.fromisoformat(value['observed_at']);need(datetime.timedelta(0)<=datetime.datetime.now(datetime.timezone.utc)-issued<datetime.timedelta(hours=11))
 return {**refresh.sources(),'build_operator_sha256':sha(Path(__file__).read_bytes()),'refresh_receipt_sha256':REFRESH_SHA}
def environment():
 value=refresh.environment();value['DOCKER_HOST']=HOST;return value
def command(kind,metadata):
 need(kind in('native','daemon')and metadata==PRIVATE/(kind+'-build.metadata.json'))
 dockerfile='native-sandbox'if kind=='native'else'daemon';output='type=image,name='+PREFIX+kind+':'+TAG+',push=true,oci-mediatypes=true,compression=zstd,compression-level=3,force-compression=true'
 return [str(refresh.DOCKER),'--host',HOST,'buildx','build','--builder','default','--platform','linux/amd64','--file',str(CONTEXT/('Dockerfile.'+dockerfile)),'--metadata-file',str(metadata),'--progress','plain','--output',output,str(CONTEXT)]
def bounded(command,timeout,heartbeat=False):
 process=subprocess.Popen(command,cwd=ROOT,env=environment(),stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 buffers=[bytearray(),bytearray()];overflow=threading.Event()
 def collect(stream,index,limit):
  while chunk:=stream.read(4096):
   available=max(0,limit-len(buffers[index]));buffers[index].extend(chunk[:available])
   if len(chunk)>available:overflow.set();process.kill()
 threads=[threading.Thread(target=collect,args=(process.stdout,0,2*1024*1024)),threading.Thread(target=collect,args=(process.stderr,1,8*1024*1024))]
 for thread in threads:thread.start()
 start=time.monotonic();last=start;timed_out=False
 while process.poll()is None:
  elapsed=time.monotonic()-start
  if elapsed>=timeout:timed_out=True;process.kill();break
  if heartbeat and time.monotonic()-last>=30:
   print(json.dumps({'event':'image_build_push_progress','elapsed_seconds':round(elapsed),'stdout_bytes':len(buffers[0]),'stderr_bytes':len(buffers[1]),'raw_logs_persisted':False}),flush=True);last=time.monotonic()
  time.sleep(.2)
 try:process.wait(timeout=10)
 except subprocess.TimeoutExpired:need(False)
 for thread in threads:thread.join(timeout=5)
 need(all(not thread.is_alive()for thread in threads))
 return {'exit_code':process.returncode,'timed_out':timed_out,'output_limit_exceeded':overflow.is_set(),'stdout':bytes(buffers[0]),'stderr':bytes(buffers[1]),'process_id':process.pid,'elapsed_seconds':round(time.monotonic()-start,3)}
def import_gate(stderr,kind):
 if kind=='native':return None
 text=stderr.decode('utf8','replace');matches=re.findall(r'^#([0-9]+) \[[^\r\n]+\] '+re.escape(IMPORT)+r'\s*$',text,re.M);need(len(matches)==1);step=matches[0]
 need(re.search(r'^#'+step+r' DONE [0-9.]+s\s*$',text,re.M)and not re.search(r'^#'+step+r' CACHED\s*$',text,re.M))
 return {'user':'1000:1000','network':'none','step':'#'+step,'completed':True,'cached':False,'build_exit_code':0}
def inspect_remote(target,index_digest):
 result=bounded([str(refresh.DOCKER),'--host',HOST,'buildx','imagetools','inspect','--raw',target],45)
 need(result['exit_code']==0 and not result['timed_out']and not result['output_limit_exceeded']);raw=result['stdout']
 # Buildx may add one terminal newline when printing original registry bytes.
 need(index_digest in('sha256:'+sha(raw),'sha256:'+sha(raw[:-1])if raw.endswith(b'\n')else''))
 value=json.loads(raw);need(value.get('schemaVersion')==2)
 if value.get('mediaType')in('application/vnd.oci.image.index.v1+json','application/vnd.docker.distribution.manifest.list.v2+json'):
  manifests=value.get('manifests');need(type(manifests)is list and 1<=len(manifests)<=8)
  selected=[row for row in manifests if row.get('platform',{}).get('os')=='linux'and row.get('platform',{}).get('architecture')=='amd64'];need(len(selected)==1);runtime=selected[0]['digest']
 else:
  need(value.get('mediaType')in('application/vnd.oci.image.manifest.v1+json','application/vnd.docker.distribution.manifest.v2+json'));runtime=index_digest
 need(re.fullmatch('sha256:[a-f0-9]{64}',runtime));return {'index_digest':index_digest,'runtime_digest':runtime}
def progress(stderr):
 text=stderr.decode('utf8','replace');return {'completed_steps':len(set(re.findall(r'^#([0-9]+) DONE ',text,re.M))),'cached_steps':len(set(re.findall(r'^#([0-9]+) CACHED',text,re.M))),'errored_steps':len(set(re.findall(r'^#([0-9]+) ERROR',text,re.M))),'http_403_observed':bool(re.search(r'\b403 Forbidden\b',text)),'http_502_observed':bool(re.search(r'\b502 Bad Gateway\b',text))}
def write_exclusive(path,value):
 need(path.parent==PRIVATE and path.parent.resolve()==PRIVATE and not path.exists())
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True)+'\n');stream.flush();os.fsync(stream.fileno())
def main():
 need(len(sys.argv)==2 and sys.argv[1]in('native','daemon'));kind=sys.argv[1];pins=source_pins();source=verify_context(kind)
 PRIVATE.mkdir(parents=True,exist_ok=True);need(PRIVATE.resolve()==PRIVATE and not PRIVATE.is_symlink());claim=PRIVATE/(kind+'-build.claim.json');metadata=PRIVATE/(kind+'-build.metadata.json');need(not claim.exists()and not metadata.exists())
 target=PREFIX+kind+':'+TAG;write_exclusive(claim,{'kind':kind,'run':RUN,'source_sha256':SOURCE,'claimed_at':stamp(),'source_pins':pins,'source':source,'target':target,'dispatch_may_have_occurred':True,'automatic_build_or_push_retry':False})
 need(source_pins()==pins and verify_context(kind)==source)
 print(json.dumps({'event':'image_build_push_started','kind':kind,'source_sha256':SOURCE,'target':target,'deadline_seconds':DEADLINE,'raw_logs_persisted':False}),flush=True)
 result=bounded(command(kind,metadata),DEADLINE,True);passed=False;remote=None;gate=None;failure=None
 try:
  need(result['exit_code']==0 and not result['timed_out']and not result['output_limit_exceeded'])
  gate=import_gate(result['stderr'],kind);meta=json.loads(exact_file(metadata,2*1024*1024));index=meta.get('containerimage.digest');need(type(index)is str and re.fullmatch('sha256:[a-f0-9]{64}',index))
  first=inspect_remote(target,index);second=inspect_remote(target,index);need(first==second and source_pins()==pins and verify_context(kind)==source);remote=first;passed=True
 except Exception:failure='ENGLISH34_IMAGE_BUILD_OR_REMOTE_DIGEST_UNCONFIRMED'
 report={'schema_version':'1.0','observed_at':stamp(),'result':'passed'if passed else'unconfirmed','kind':kind,'run':RUN,'source_sha256':SOURCE,'source':source,'source_pins':pins,'target':target,'exit_code':result['exit_code'],'process_id':result['process_id'],'process_returned':True,'timed_out':result['timed_out'],'output_limit_exceeded':result['output_limit_exceeded'],'elapsed_seconds':result['elapsed_seconds'],'stdout_bytes':len(result['stdout']),'stderr_bytes':len(result['stderr']),'progress':progress(result['stderr']),'production_import_gate':gate,'index_digest':remote['index_digest']if remote else None,'runtime_digest':remote['runtime_digest']if remote else None,'remote_digest_independent_readback_equal':passed,'claim_retained':True,'automatic_build_or_push_retry':False,'raw_logs_or_credentials_persisted':False,'private_media_used':False,'worker_polling':False,'db_jobs_or_openai_n8n_calls':False,'native_boundary_or_job_acceptance':False,'failure_code':failure}
 directory=ROOT/'tracking/evidence/m03/english-image34';directory.mkdir(parents=True,exist_ok=True);path=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+kind+'-build-push.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(report,sort_keys=True,indent=2)+'\n')
 if passed:write_exclusive(PRIVATE/(kind+'-build.success.json'),{'receipt':path.relative_to(ROOT).as_posix(),'sha256':sha(path.read_bytes())})
 print(json.dumps({'result':report['result'],'receipt':path.relative_to(ROOT).as_posix(),'index_digest':report['index_digest'],'runtime_digest':report['runtime_digest'],'claim_retained':True}),flush=True);need(passed)
if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_IMAGE_BUILD_UNCONFIRMED',flush=True);sys.exit(1)
