"""Fresh LOCAL paired OCI exports. No registry authentication/upload/cloud actions.

Reuses only reviewed local binary/OCI/subprocess/import-parser mechanisms.
The existing diagnostic controller, claims and contexts are never executed.
"""
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, re, sys

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
SOURCE_ROOT=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
RUN='8b559ebe-1b6c-4741-b371-9498c5855976'
SOURCE='0566342ec367efef328885aac513adeb5a942048ba01c88e1af63e4d636b6730'
PRIVATE=SOURCE_ROOT/'.local/worker-hosting'/RUN
CONTEXT=PRIVATE/'context'
EVIDENCE=ROOT/'tracking/evidence/m07/completion-worker'
PREFIX='vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/'
TAG='completion-8b559ebe'
HOST='npipe:////./pipe/dockerDesktopLinuxEngine'
BASE=SOURCE_ROOT/'development/m07/specs-diagnostic-worker38/build.py'
BASE_SHA='2548608d9bf12bea7b48b2535e208fc2e9d7452a6113531eaf64b685565834fc'
DOCKER=Path('C:/Program Files/Docker/Docker/resources/bin/docker.exe')
_base=None

def need(value):
 if not value:raise ValueError('COMPLETION_LOCAL_BUILD_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def load(file,maximum=16*1024**2):
 need(file.is_file()and not file.is_symlink()and file.resolve()==file and file.stat().st_nlink==1 and 0<file.stat().st_size<=maximum)
 return file.read_bytes()
def base():
 global _base
 need(sha(load(BASE))==BASE_SHA)
 if _base is None:
  spec=importlib.util.spec_from_file_location('completion_frozen_pure_build',BASE)
  _base=importlib.util.module_from_spec(spec);spec.loader.exec_module(_base)
 return _base
def kind_value(kind):need(kind in('native','daemon'));return kind
def artifact(kind,suffix):return PRIVATE/(kind_value(kind)+'-'+suffix)
def target(kind):return PREFIX+kind_value(kind)+':'+TAG
def manifest_value(runtime):
 need(type(runtime)is str and re.fullmatch('sha256:[a-f0-9]{64}',runtime))
 return {'schema_version':'1.0','transport':'vercel_sandbox','protocol':'eps-native-files-v1','image':PREFIX.removeprefix('vcr.vercel.com/')+'native@'+runtime,'region':'dub1','source_sha256':SOURCE}
def exclusive(file,value):
 need(not file.exists()and file.parent.resolve()==file.parent and not file.parent.is_symlink())
 raw=(json.dumps(value,sort_keys=True,indent=2)+'\n').encode()
 with file.open('xb')as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno())
def native_success():
 pointer=json.loads(load(artifact('native','export.success.json'),4096))
 receipt=ROOT/pointer['receipt'];need(receipt.parent==EVIDENCE and sha(load(receipt,2*1024**2))==pointer['sha256'])
 value=json.loads(load(receipt,2*1024**2));need(value['result']=='passed'and value['kind']=='native'and value['run']==RUN and value['source_sha256']==SOURCE)
 need(base().validate_archive(base().mechanisms().archive_proof(artifact('native','export.tar')))==value['archive'])
 return value
def context(kind):
 kind_value(kind);need(CONTEXT.is_dir()and CONTEXT.resolve()==CONTEXT and not CONTEXT.is_symlink())
 need(json.loads(load(PRIVATE/'owner.json',4096))=={'owner':'eps-worker-hosting-build','run':RUN,'source_sha256':SOURCE})
 seal_raw=load(CONTEXT/'apps/worker/native-source.json');seal=json.loads(seal_raw);rows=seal['files']
 need(seal['source_sha256']==SOURCE and len(rows)==165 and sha(json.dumps(rows,separators=(',',':'),ensure_ascii=False).encode())==SOURCE)
 expected={};previous='';hits=0
 patterns=[rb'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}',rb'sb_secret_[A-Za-z0-9_-]{8,}',rb'sbp_[A-Za-z0-9]{20,}',rb'sk-[A-Za-z0-9_-]{20,}',rb'npm_[A-Za-z0-9]{20,}',rb'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----']
 for row in rows:
  relative=row['path'];need(type(relative)is str and relative>previous and '..'not in relative and re.fullmatch(base().PATH_PATTERN,relative));previous=relative
  current=load(SOURCE_ROOT/relative);staged=load(CONTEXT/relative)
  need(len(current)==len(staged)==row['bytes']and sha(current)==sha(staged)==row['sha256'])
  hits+=sum(bool(re.search(pattern,staged))for pattern in patterns);expected[relative]=row['sha256']
 need(hits==0)
 for kind_name in ['daemon','native-sandbox']:
  expected['Dockerfile.'+kind_name]=expected['apps/worker/Dockerfile.'+kind_name]
  need(sha(load(CONTEXT/('Dockerfile.'+kind_name)))==expected['Dockerfile.'+kind_name])
 need(load(CONTEXT/'.dockerignore',4096)==b'.git\n.env*\n.local\nnode_modules\n**/node_modules\n')
 expected.update({'apps/worker/native-source.json':sha(seal_raw),'.dockerignore':sha(load(CONTEXT/'.dockerignore'))})
 manifest=CONTEXT/'apps/worker/native-sandbox-manifest.json'
 if kind=='native':need(not manifest.exists())
 else:
  native=native_success();raw=load(manifest,4096);need(json.loads(raw)==manifest_value(native['runtime_digest']))
  expected['apps/worker/native-sandbox-manifest.json']=sha(raw)
  dockerfile=load(CONTEXT/'Dockerfile.daemon').decode();instruction=base().mechanisms().base.IMPORT
  need(dockerfile.count(instruction)==1 and dockerfile.index('USER 1000:1000')<dockerfile.index(instruction))
 actual=set()
 for file in CONTEXT.rglob('*'):
  need(not file.is_symlink()and file.resolve().is_relative_to(CONTEXT))
  if file.is_file():actual.add(file.relative_to(CONTEXT).as_posix())
 need(actual==set(expected))
 return {'source_sha256':SOURCE,'file_count':len(rows),'source_bytes':sum(row['bytes']for row in rows),'context_files':len(actual),'source_seal_sha256':sha(seal_raw),'manifest_sha256':expected.get('apps/worker/native-sandbox-manifest.json'),'private_pattern_families':len(patterns),'private_pattern_hits':hits,'private_credentials_opened':False}
def environment():
 result={key:os.environ[key]for key in ['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG']if key in os.environ}
 result.update(PATH=str(DOCKER.parent),ProgramFiles='C:/Program Files',DOCKER_HOST=HOST,DOCKER_CONFIG=str(PRIVATE/'docker-client'),CI='1',NO_COLOR='1')
 return result
def command(kind):
 kind_value(kind);dockerfile='native-sandbox'if kind=='native'else'daemon'
 output='type=oci,dest='+str(artifact(kind,'export.tar'))+',name='+target(kind)+',oci-mediatypes=true,compression=zstd,compression-level=3,force-compression=true'
 result=[str(DOCKER),'--host',HOST,'buildx','build','--builder','default','--platform','linux/amd64','--file',str(CONTEXT/('Dockerfile.'+dockerfile)),'--metadata-file',str(artifact(kind,'export.metadata.json')),'--progress','plain','--output',output]
 if kind=='daemon':result+=['--no-cache']
 return result+[str(CONTEXT)]
def pins():
 b=base();b.mechanisms()
 for file in [b.DOCKER,b.PLUGIN]:b.vendor_binary_digest(file)
 result={str(BASE):BASE_SHA,**{str(SOURCE_ROOT/file):value for file,value in b.FROZEN.items()}}
 for file in [Path(__file__).resolve(),HERE/'test_build.py']:result[str(file)]=sha(load(file))
 result.update(docker_sha256=b.DOCKER_SHA,buildx_plugin_sha256=b.PLUGIN_SHA)
 return result
def export(kind):
 kind_value(kind);before=pins();source=context(kind)
 need(not any(artifact(kind,name).exists()for name in ['export.claim.json','export.tar','export.metadata.json','export.success.json']))
 config=PRIVATE/'docker-client';config.mkdir(exist_ok=True);need(config.resolve()==config and not config.is_symlink())
 if not(config/'config.json').exists():exclusive(config/'config.json',{'auths':{}})
 need(json.loads(load(config/'config.json',4096))=={'auths':{}})
 exclusive(artifact(kind,'export.claim.json'),{'purpose':'completion-local-OCI-export','run':RUN,'kind':kind,'source':source,'source_pins':before,'claimed_at':stamp(),'automatic_retry':False,'registry_push_requested':False})
 report={'schema_version':'1.0','observed_at':stamp(),'result':'unconfirmed','action':'local_oci_export','run':RUN,'kind':kind,'source_sha256':SOURCE,'source':source,'source_pins':before,'target':target(kind),'claim_retained':True,'raw_logs_or_credentials_persisted':False,'registry_credentials_refreshed':False,'registry_push_requested':False,'cloud_or_provider_called':False,'build_dependency_network_may_be_used':True,'worker_polling':False,'db_jobs_or_openai_n8n_calls':False}
 try:
  need(pins()==before and context(kind)==source)
  result=base().mechanisms().bounded(command(kind),environment(),1800,'completion_local_'+kind)
  report.update(normal_build_process_return_observed=True,exit_code=result['exit_code'],timed_out=result['timed_out'],output_limit_exceeded=result['output_limit_exceeded'],elapsed_seconds=result['elapsed_seconds'],stdout_bytes=len(result['stdout']),stderr_bytes=len(result['stderr']))
  need(result['exit_code']==0 and not result['timed_out']and not result['output_limit_exceeded'])
  gate=base().mechanisms().base.import_gate(result['stderr'],kind)
  archive=base().validate_archive(base().mechanisms().archive_proof(artifact(kind,'export.tar')))
  need(pins()==before and context(kind)==source)
  report.update(result='passed',runtime_digest=archive['runtime_digest'],archive=archive,production_import_gate=gate,source_revalidated_after_export=True)
 except Exception:report['failure_code']='COMPLETION_LOCAL_BUILD_UNCONFIRMED'
 EVIDENCE.mkdir(parents=True,exist_ok=True);receipt=EVIDENCE/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+kind+'-export.json');exclusive(receipt,report)
 if report['result']=='passed':exclusive(artifact(kind,'export.success.json'),{'receipt':receipt.relative_to(ROOT).as_posix(),'sha256':sha(load(receipt,2*1024**2))})
 return {'result':report['result'],'receipt':receipt.relative_to(ROOT).as_posix(),'runtime_digest':report.get('runtime_digest'),'registry_push_requested':False}
if __name__=='__main__':
 try:
  need(len(sys.argv)==2 and sys.argv[1]in('native','daemon'));result=export(sys.argv[1]);print(json.dumps(result),flush=True);need(result['result']=='passed')
 except Exception:print('COMPLETION_LOCAL_BUILD_UNCONFIRMED',flush=True);sys.exit(1)
