"""Disabled LOCAL OCI exports for the fresh diagnostic graph. No registry client.

Imports are inert. Only Root may arm and run an export after source review.
Historical operators/claims remain untouched; only their pure mechanisms are used.
"""
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, re, stat, sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
BUILD_ENABLED=True
RUN='6503a124-b514-4dcd-91ae-08a868d69a17'
SOURCE='037dc5d9b41605808d8f35907a71be4aba6fc6666a824ad7316d823334f35c38'
COUNT=164;SOURCE_BYTES=1809018
CONTEXT=ROOT/'.local/worker-hosting'/RUN/'context'
PRIVATE=ROOT/'.local/specs-diagnostic-worker38'/RUN
EVIDENCE=ROOT/'tracking/evidence/m07/specs-diagnostic-worker38'
SCAN='tracking/evidence/m07/specs-diagnostic-worker38/2026-11-01T17-48-54-413Z-context.json'
SCAN_SHA='841e119f8f7c455bd129f3479a8fbcceb346444534b055acf53d8bab1712ab06'
PREFIX='vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/'
TAG='specs-diagnostic38-6503a124'
HOST='npipe:////./pipe/dockerDesktopLinuxEngine';DEADLINE=1800
DOCKER=Path('C:/Program Files/Docker/Docker/resources/bin/docker.exe')
PLUGIN=Path('C:/Program Files/Docker/Docker/resources/cli-plugins/docker-buildx.exe')
DOCKER_SHA='e768033e4b3f0dc760162f417a80360094644d16cd9fb12ad65c9d97508c076f'
PLUGIN_SHA='f2512b849418b860d1e497708ccdd4864e2377a97fe15d500af83381cf5f967e'
FROZEN={
 'development/m03/english-oci34/oci.py':'48fa22d83cb6f8643696a84358b5ba831852f93e6b920f7ef7f7a6808ae60758',
 'development/m03/english-image34/build-image-v2.py':'5562cf2d1e7d4b23f2b86e45ef75bc2f02a1744b80a5ba580814c751b53948a2',
 'development/m03/english-image34/build-image.py':'f1ced25d33bf039909289bc1be17ab42bbdf5d662e15c22c6460693a16045cd4',
 'development/m03/english-image34/refresh-vcr.py':'3104f3405c2fdd0ffd2e402098522ba2ba7d6720aaed13aedfb2923c33c73224',
 'development/m03/english-release34/native_admission.py':'cfaf0eafb51ee99961a7f3552c34090f377475be4a7a1d23d9c5582e050cb9cf',
 'tools/worker-hosting-build.mjs':'3f27ca1bf039579905763365c592b4d6e94754437753a3f645c4bad85e7bcb69'}
PATH_PATTERN=r'(?:package(?:-lock)?\.json|apps/(?:web|worker)/package\.json|apps/worker/Dockerfile\.(?:daemon|native-sandbox)|packages/(?:domain|jobs|integrations|central)/package\.json|(?:apps/worker/src|packages/(?:domain|jobs|integrations|central)/src|packages/templates/(?:src|versions))/[A-Za-z0-9_./-]+\.(?:ts|mjs|json)|contracts/json-schema/(?:specs-extraction|candidate-extraction|frame-selection|slide-wording)\.schema\.json|packages/templates/registry\.json|apps/web/public/fonts/IBMPlexSans(?:Arabic)?-(?:Regular\.woff2|Medium\.woff2|SemiBold\.woff2|LICENSE\.txt)|apps/web/public/brand/everyone-logotype(?:-white)?\.svg)'

def need(v):
 if not v:raise ValueError('DIAGNOSTIC38_LOCAL_BUILD_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def load(path,maximum=16*1024**2):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_nlink==1 and 0<path.stat().st_size<=maximum)
 return path.read_bytes()
def vendor_binary_digest(path):
 # Installed vendor hardlinks are a distinct finite profile. Source/context
 # files continue to require load()'s single-link invariant without exceptions.
 allowed={DOCKER:(DOCKER_SHA,1),PLUGIN:(PLUGIN_SHA,2)}
 need(path in allowed and path.is_absolute()and path.resolve()==path)
 expected,links=allowed[path];before=path.lstat()
 need(stat.S_ISREG(before.st_mode)and not path.is_symlink()and before.st_nlink==links and 0<before.st_size<=256*1024**2)
 raw=path.read_bytes();after=path.lstat()
 fields=('st_dev','st_ino','st_size','st_mtime_ns','st_nlink')
 need(tuple(getattr(before,k)for k in fields)==tuple(getattr(after,k)for k in fields)
  and len(raw)==before.st_size and sha(raw)==expected)
 return expected
def digest(v):need(type(v)is str and re.fullmatch('sha256:[a-f0-9]{64}',v));return v
def kind_value(v):need(v in('native','daemon'));return v
def target(kind):return PREFIX+kind_value(kind)+':'+TAG
def artifact(kind,suffix):return PRIVATE/(kind_value(kind)+'-'+suffix)

def mechanisms():
 for relative,pin in FROZEN.items():need(sha(load(ROOT/relative))==pin)
 spec=importlib.util.spec_from_file_location('diagnostic38_frozen_oci_mechanisms',ROOT/'development/m03/english-oci34/oci.py')
 m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 # Never call m.main, source_pins, context, load_success, refresh or old build.
 return m

def scan_rows():
 raw=load(ROOT/SCAN);need(sha(raw)==SCAN_SHA);v=json.loads(raw)
 need(v['schema_version']=='1.0'and v['result']=='passed_context_source_and_private_value_checks'
  and v['run']==RUN and v['source_sha256']==SOURCE and v['file_count']==COUNT and v['bytes']==SOURCE_BYTES)
 need(type(v['private_hits'])is int and v['private_hits']==0 and v['private_inputs']==10 and v['private_value_families']==14)
 for k in ['private_input_stable','source_and_context_exact','generated_dockerfiles_exact']:need(v[k]is True)
 for k in ['Docker_or_build_called','registry_or_provider_called','worker_deployed']:need(v[k]is False)
 rows=v['files'];need(type(rows)is list and len(rows)==COUNT and sha(json.dumps(rows,separators=(',',':'),ensure_ascii=False).encode())==SOURCE)
 previous=''
 for row in rows:
  need(type(row)is dict and set(row)=={'path','bytes','sha256'}and type(row['path'])is str and row['path']>previous and '..'not in row['path']and re.fullmatch(PATH_PATTERN,row['path']))
  need(type(row['bytes'])is int and 0<row['bytes']<=16*1024**2 and re.fullmatch('[a-f0-9]{64}',row['sha256']))
  previous=row['path']
 return rows

def manifest_value(runtime):
 return {'schema_version':'1.0','transport':'vercel_sandbox','protocol':'eps-native-files-v1','image':PREFIX.removeprefix('vcr.vercel.com/')+'native@'+digest(runtime),'region':'dub1','source_sha256':SOURCE}

def verify_context(kind):
 kind_value(kind);rows=scan_rows();need(CONTEXT.is_dir()and not CONTEXT.is_symlink()and CONTEXT.resolve()==CONTEXT)
 owner=json.loads(load(CONTEXT.parent/'owner.json',4096));need(owner=={'owner':'eps-worker-hosting-build','run':RUN,'source_sha256':SOURCE})
 raw=load(CONTEXT/'apps/worker/native-source.json');seal=json.loads(raw);need(seal=={'source_sha256':SOURCE,'files':rows})
 expected={'apps/worker/native-source.json':sha(raw)}
 for row in rows:
  current=load(ROOT/row['path']);staged=load(CONTEXT/row['path'])
  need(len(current)==len(staged)==row['bytes']and sha(current)==sha(staged)==row['sha256']);expected[row['path']]=row['sha256']
 for name in ['daemon','native-sandbox']:
  expected['Dockerfile.'+name]=expected['apps/worker/Dockerfile.'+name]
  need(sha(load(CONTEXT/('Dockerfile.'+name)))==expected['Dockerfile.'+name])
 ignore=load(CONTEXT/'.dockerignore',4096);need(ignore==b'.git\n.env*\n.local\nnode_modules\n**/node_modules\n');expected['.dockerignore']=sha(ignore)
 manifest=CONTEXT/'apps/worker/native-sandbox-manifest.json'
 if kind=='native':need(not manifest.exists())
 else:
  native=load_success('native');raw=load(manifest,4096);need(json.loads(raw)==manifest_value(native['runtime_digest']))
  expected['apps/worker/native-sandbox-manifest.json']=sha(raw)
  dockerfile=load(CONTEXT/'Dockerfile.daemon').decode();m=mechanisms()
  need(dockerfile.count(m.base.IMPORT)==1 and dockerfile.index('USER 1000:1000')<dockerfile.index(m.base.IMPORT))
 actual=[]
 for path in CONTEXT.rglob('*'):
  need(not path.is_symlink()and path.resolve().is_relative_to(CONTEXT))
  if path.is_file():actual.append(path.relative_to(CONTEXT).as_posix())
 need(set(actual)==set(expected)and len(actual)==len(expected))
 return {'source_sha256':SOURCE,'file_count':COUNT,'source_bytes':SOURCE_BYTES,'context_files':len(actual),'source_seal_sha256':expected['apps/worker/native-source.json'],'manifest_sha256':expected.get('apps/worker/native-sandbox-manifest.json')}

def source_pins():
 mechanisms();pins=dict(FROZEN);pins[SCAN]=SCAN_SHA
 for file in [HERE/'build.py',HERE/'test_build.py',HERE/'README.md']:pins[file.relative_to(ROOT).as_posix()]=sha(load(file))
 for path in [DOCKER,PLUGIN]:vendor_binary_digest(path)
 pins.update(docker_sha256=DOCKER_SHA,buildx_plugin_sha256=PLUGIN_SHA)
 return dict(sorted(pins.items()))

def environment(ambient=None):
 ambient=os.environ if ambient is None else ambient
 result={k:ambient[k]for k in ['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG']if k in ambient}
 # A fresh auth-free client configuration prevents default personal credential
 # discovery. Build dependencies may still use the Docker daemon's normal network.
 result.update(PATH=str(DOCKER.parent),ProgramFiles='C:/Program Files',DOCKER_HOST=HOST,DOCKER_CONFIG=str(PRIVATE/'docker-client'),CI='1',NO_COLOR='1')
 return result

def command(kind):
 kind_value(kind);dockerfile='native-sandbox'if kind=='native'else'daemon'
 output='type=oci,dest='+str(artifact(kind,'export.tar'))+',name='+target(kind)+',oci-mediatypes=true,compression=zstd,compression-level=3,force-compression=true'
 args=[str(DOCKER),'--host',HOST,'buildx','build','--builder','default','--platform','linux/amd64','--file',str(CONTEXT/('Dockerfile.'+dockerfile)),'--metadata-file',str(artifact(kind,'export.metadata.json')),'--progress','plain','--output',output]
 if kind=='daemon':args+=['--no-cache']
 return args+[str(CONTEXT)]

def exclusive(path,value):
 need(path.resolve()==path and not path.exists())
 path.parent.mkdir(parents=True,exist_ok=True);need(path.parent.resolve()==path.parent and not path.parent.is_symlink())
 raw=(json.dumps(value,sort_keys=True,indent=2)+'\n').encode()
 with path.open('xb')as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno())

def validate_archive(proof):
 need(type(proof)is dict and set(proof)=={'archive_sha256','archive_bytes','index_digest','runtime_digest','blobs_verified','compressed_blob_bytes','all_blob_sha256_and_descriptor_sizes_verified','all_blobs_reachable','layers_recompressed','legacy_manifest_used','external_descriptor_urls','blobs'})
 need(re.fullmatch('[a-f0-9]{64}',proof['archive_sha256'])and type(proof['archive_bytes'])is int and 0<proof['archive_bytes']<=4*1024**3)
 digest(proof['index_digest']);digest(proof['runtime_digest'])
 for k in ['all_blob_sha256_and_descriptor_sizes_verified','all_blobs_reachable']:need(proof[k]is True)
 for k in ['layers_recompressed','legacy_manifest_used','external_descriptor_urls']:need(proof[k]is False)
 need(type(proof['blobs'])is list and type(proof['blobs_verified'])is int and 1<=len(proof['blobs'])==proof['blobs_verified']<=256)
 names=[]
 for row in proof['blobs']:
  need(type(row)is dict and set(row)=={'digest','bytes'}and type(row['bytes'])is int and 0<row['bytes']<=1024**3)
  names.append(digest(row['digest']))
 need(names==sorted(set(names))and proof['runtime_digest']in names and proof['index_digest']in names and type(proof['compressed_blob_bytes'])is int and proof['compressed_blob_bytes']==sum(row['bytes']for row in proof['blobs']))
 return proof

def load_success(kind):
 pointer=json.loads(load(artifact(kind,'export.success.json'),4096));need(set(pointer)=={'receipt','sha256'})
 relative=pointer['receipt'];need(type(relative)is str and re.fullmatch(r'tracking/evidence/m07/specs-diagnostic-worker38/[A-Za-z0-9_.-]+-(?:native|daemon)-export\.json',relative))
 raw=load(ROOT/relative,2*1024**2);need(sha(raw)==pointer['sha256']);v=json.loads(raw)
 need(v['result']=='passed'and v['action']=='local_oci_export'and v['run']==RUN and v['source_sha256']==SOURCE and v['kind']==kind and v['target']==target(kind))
 need(v['source_pins']==source_pins()and v['source']['file_count']==COUNT and v['source']['source_sha256']==SOURCE)
 need(v['normal_build_process_return_observed']is True and v['exit_code']==0 and v['timed_out']is False and v['output_limit_exceeded']is False and v['source_revalidated_after_export']is True)
 validate_archive(v['archive']);need(v['runtime_digest']==v['archive']['runtime_digest'])
 need(validate_archive(mechanisms().archive_proof(artifact(kind,'export.tar')))==v['archive'])
 return v

class LocalPorts:
 def sources(self):return source_pins()
 def context(self,kind):return verify_context(kind)
 def exists(self,kind):return any(artifact(kind,suffix).exists()for suffix in ['export.claim.json','export.tar','export.metadata.json','export.success.json'])
 def claim(self,kind,value):
  exclusive(artifact(kind,'export.claim.json'),value)
  config=PRIVATE/'docker-client/config.json'
  if not config.exists():exclusive(config,{'auths':{}})
  need(json.loads(load(config,4096))=={'auths':{}})
 def run(self,kind):return mechanisms().bounded(command(kind),environment(),DEADLINE,'diagnostic38_local_'+kind)
 def archive(self,kind):return mechanisms().archive_proof(artifact(kind,'export.tar'))
 def save(self,kind,value):
  name=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+kind+'-export.json';path=EVIDENCE/name
  exclusive(path,value)
  if value['result']=='passed':exclusive(artifact(kind,'export.success.json'),{'receipt':path.relative_to(ROOT).as_posix(),'sha256':sha(load(path,2*1024**2))})
  return path.relative_to(ROOT).as_posix()

def export(kind,ports=None):
 need(BUILD_ENABLED);kind_value(kind);ports=LocalPorts()if ports is None else ports
 pins=ports.sources();source=ports.context(kind);need(not ports.exists(kind))
 ports.claim(kind,{'purpose':'specs-diagnostic38-local-OCI-export','kind':kind,'run':RUN,'source_sha256':SOURCE,'source':source,'source_pins':pins,'claimed_at':stamp(),'local_build_may_have_occurred':True,'automatic_retry':False,'registry_push_requested':False})
 report={'schema_version':'1.0','action':'local_oci_export','observed_at':stamp(),'result':'unconfirmed','kind':kind,'run':RUN,'source_sha256':SOURCE,'source':source,'source_pins':pins,'target':target(kind),'claim_retained':True,'automatic_retry':False,'normal_build_process_return_observed':False,'source_revalidated_after_export':False,'production_import_gate':None,'runtime_digest':None,'archive':None,'raw_logs_or_credentials_persisted':False,'Vercel_registry_push_or_control_plane_called':False,'build_dependency_network_may_be_used':True,'registry_push_requested':False,'worker_polling':False,'native_boundary_or_job_acceptance':False,'db_jobs_or_openai_n8n_calls':False}
 try:
  need(ports.sources()==pins and ports.context(kind)==source)
  result=ports.run(kind)
  report.update(normal_build_process_return_observed=True,exit_code=result['exit_code'],timed_out=result['timed_out'],output_limit_exceeded=result['output_limit_exceeded'],elapsed_seconds=result['elapsed_seconds'],stdout_bytes=len(result['stdout']),stderr_bytes=len(result['stderr']))
  need(result['exit_code']==0 and result['timed_out']is False and result['output_limit_exceeded']is False)
  gate=mechanisms().base.import_gate(result['stderr'],kind)
  proof=validate_archive(ports.archive(kind));need(ports.sources()==pins and ports.context(kind)==source)
  report.update(result='passed',archive=proof,runtime_digest=proof['runtime_digest'],production_import_gate=gate,source_revalidated_after_export=True)
 except Exception:report['failure_code']='DIAGNOSTIC38_LOCAL_BUILD_UNCONFIRMED'
 path=ports.save(kind,report)
 return {'result':report['result'],'receipt':path,'claim_retained':True,'registry_push_requested':False,'runtime_digest':report['runtime_digest']}

def main():
 need(BUILD_ENABLED and len(sys.argv)==2 and sys.argv[1]in('native','daemon'))
 result=export(sys.argv[1]);print(json.dumps(result,sort_keys=True));need(result['result']=='passed')

if __name__=='__main__':
 try:main()
 except Exception:print('DIAGNOSTIC38_LOCAL_BUILD_UNCONFIRMED');sys.exit(1)
