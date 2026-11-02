"""Disabled fresh local build operations using the sealed normal OCI functions.

The final source is deliberately a required input. No archive, digest, build
directory or successful execution is manufactured during source preparation.
"""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,re,sys,tarfile,uuid
HERE=Path(__file__).resolve().parent;MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
BUILD_ENABLED=False
PREFIX='vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/'
HOST='npipe:////./pipe/dockerDesktopLinuxEngine'
DOCKER=Path('C:/Program Files/Docker/Docker/resources/bin/docker.exe')
PLUGIN=Path('C:/Program Files/Docker/Docker/resources/cli-plugins/docker-buildx.exe')
GIT=Path('C:/Program Files/Git/cmd/git.exe')
GIT_SHA='22fead8244ef3a7225fb800099a4e43eca8bcec0466774917669599c2f19a05a'
BINARIES={DOCKER:'e768033e4b3f0dc760162f417a80360094644d16cd9fb12ad65c9d97508c076f',PLUGIN:'f2512b849418b860d1e497708ccdd4864e2377a97fe15d500af83381cf5f967e'}
ARCHIVE_VALIDATOR='development/m07/specs-diagnostic-worker38/build.py'
ARCHIVE_VALIDATOR_SHA='2548608d9bf12bea7b48b2535e208fc2e9d7452a6113531eaf64b685565834fc'
PATTERNS=[rb'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}',rb'sb_secret_[A-Za-z0-9_-]{8,}',rb'sbp_[A-Za-z0-9]{20,}',rb'sk-[A-Za-z0-9_-]{20,}',rb'npm_[A-Za-z0-9]{20,}',rb'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----']

def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
m=module('worker_identity_local_mechanisms',HERE/'mechanisms.py');need=m.need;sha=m.sha;load=m.load
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def compact(value):return json.dumps(value,separators=(',',':'),ensure_ascii=False).encode()
def git_binary_pin():
 need(GIT==Path('C:/Program Files/Git/cmd/git.exe'));info=GIT.lstat();need(GIT.is_file()and not GIT.is_symlink()and GIT.resolve()==GIT and info.st_nlink==2 and info.st_size==46936);need(sha(GIT.read_bytes())==GIT_SHA);return GIT_SHA
def kind_value(kind):need(kind in('native','daemon'));return kind
def reference(value):
 need(type(value)is dict and set(value)=={'path','sha256'}and re.fullmatch(r'tracking/evidence/[A-Za-z0-9_./-]+\.json',value['path'])and'..'not in Path(value['path']).parts and re.fullmatch('[a-f0-9]{64}',value['sha256']));raw=load(MAIN/value['path']);need(sha(raw)==value['sha256']);return json.loads(raw)
def source_shape(value):
 need(type(value)is dict and set(value)=={'commit','tree','archive','source_sha256','files','native_graph_sha256','daemon_graph_sha256','quality'})
 need(all(type(value[key])is str and re.fullmatch('[a-f0-9]{40}',value[key])for key in('commit','tree'))and all(type(value[key])is str and re.fullmatch('[a-f0-9]{64}',value[key])for key in('source_sha256','native_graph_sha256','daemon_graph_sha256')))
 need(type(value['archive'])is dict and set(value['archive'])=={'path','sha256'}and re.fullmatch(r'\.local/[A-Za-z0-9_./-]+\.tar',value['archive']['path'])and'..'not in Path(value['archive']['path']).parts and re.fullmatch('[a-f0-9]{64}',value['archive']['sha256']))
 need(type(value['files'])is list and 0<len(value['files'])<=1000 and sha(compact(value['files']))==value['source_sha256']);previous=''
 for row in value['files']:
  need(type(row)is dict and list(row)==['path','sha256','bytes']and type(row['path'])is str and row['path']>previous and re.fullmatch(r'(?:package(?:-lock)?\.json|(?:apps|packages|contracts)/[A-Za-z0-9_./-]+)',row['path'])and not any(part in('','..','.')for part in row['path'].split('/'))and re.fullmatch('[a-f0-9]{64}',row['sha256'])and type(row['bytes'])is int and 0<row['bytes']<=16*1024**2);previous=row['path']
 return value
def quality_admission(value,source,read):
 need(value['result']=='passed'and value['reviewed_source_stable']is True and value['testable_graph_worktree_clean']is True and value['source_head_before']==value['source_head_after']and re.fullmatch('[a-f0-9]{40}',value['source_head_before']))
 rows=value['all_testable_source_files'];need(type(rows)is list and len(rows)==value['testable_source_file_count']);by_path={row['path']:row for row in rows};need(len(rows)==len(by_path))
 checks=value['checks'];need(type(checks)is list and {row['name']for row in checks}=={'typecheck','lint','test','production_guard'}and len(checks)==4)
 for row in checks:
  need(row['exit_code']==0 and row['signal']is None and row['timed_out']is False and row['output_limit_exceeded']is False and row['spawn_failed']is False and row['result']=='passed')
  if row['name']=='test':
   need(row['tests']==row['pass']and row['tests']>0 and all(row[key]==0 for key in('fail','cancelled','skipped','todo'))and row['suite_summaries']==6)
 for row in source['files']:
  raw=read(row['path']);need(len(raw)==row['bytes']and sha(raw)==row['sha256'])
  # Non-testable brand/font assets still bind the immutable Git archive below.
  if row['path']in by_path:
   entry=by_path[row['path']];need(entry['mode']=='100644'and hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==entry['git_blob'])
  elif row['path'].endswith(('.ts','.mjs','.json')):need(False)
 return {'ref':source['quality'],'tested_commit':value['source_head_before'],'selected_packed_source_bytes_equal':True,'carried_forward_to_exact_selected_bytes':value['source_head_before']!=source['commit'],'test_count':next(row['tests']for row in checks if row['name']=='test')}
def archive_admission(file,source,read):
 need(file.resolve()==file and not file.is_symlink()and file.is_file()and file.stat().st_nlink==1 and 0<file.stat().st_size<=512*1024**2)
 with file.open('rb')as stream:need(hashlib.file_digest(stream,'sha256').hexdigest()==source['archive']['sha256'])
 with tarfile.open(file,'r:')as tar:
  need(tar.pax_headers.get('comment')==source['commit']);members=tar.getmembers();need(len(members)<=25000)
  names=[row.name.rstrip('/')for row in members];need(len(names)==len(set(names)))
  index={row.name:row for row in members}
  for row in source['files']:
   item=index.get(row['path']);need(item is not None and item.isfile()and item.size==row['bytes']);handle=tar.extractfile(item);need(handle is not None);raw=handle.read(16*1024**2+1);need(len(raw)==row['bytes']and sha(raw)==row['sha256']and raw==read(row['path']))
 return {'path':source['archive']['path'],'sha256':source['archive']['sha256'],'commit':source['commit'],'selected_source_exact':True,'archive_extracted':False}
def once(p,phase,callback):
 need(not p.exists(phase+'.claim.json'));pins=p.pins();p.write(phase+'.claim.json',{'source_pins':pins,'automatic_retry':False,'dispatch_may_have_occurred':True})
 need(p.pins()==pins);value=callback();need(p.pins()==pins);p.write(phase+'.normal.json',{'claim_sha256':p.hash(phase+'.claim.json'),'normal_return_observed':True,'value':value});return value

class Build:
 def __init__(self,inputs,libraries=None):
  need(type(inputs)is dict and type(inputs['run'])is str and str(uuid.UUID(inputs['run']))==inputs['run']and uuid.UUID(inputs['run']).version==4);self.inputs=inputs;self.source=source_shape(inputs['source']);self.l=libraries or m.Libraries();self.guard=self.l.guard();self.private=MAIN/'.local/worker-source-identity-build'/inputs['run'];self.build_run=inputs.get('build_run')
 def file(self,name):need(re.fullmatch('[A-Za-z0-9_.-]+',name)and name not in('.','..'));return self.private/name
 def exists(self,name):return self.file(name).exists()
 def write(self,name,value):
  if not self.private.exists():self.private.mkdir(parents=True,exist_ok=False)
  need(self.private.resolve()==self.private and not self.private.is_symlink());raw=value if type(value)is bytes else compact(value)+b'\n';need(0<len(raw)<=16*1024**2)
  with self.guard.create(self.file(name))as stream:self.guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());self.guard.verify_open(stream)
 def read(self,name):file=self.file(name);self.guard.verify(file);return json.loads(load(file))
 def hash(self,name):file=self.file(name);self.guard.verify(file);return sha(load(file))
 def pins(self):
  result=self.l.pins();result['selected_build_profile_sha256']=sha(compact({'run':self.inputs['run'],'source':self.source}))
  # Later registry/native/controller arming and the separately owned SQL proof
  # do not change these local build mechanisms or the selected product bytes.
  for name in('build.py','mechanisms.py','test_build.py'):
   path=HERE/name;result[str(path)]=sha(load(path))
  need(sha(load(MAIN/ARCHIVE_VALIDATOR))==ARCHIVE_VALIDATOR_SHA);result[str(MAIN/ARCHIVE_VALIDATOR)]=ARCHIVE_VALIDATOR_SHA
  for file,digest in BINARIES.items():
   need(file.is_file()and not file.is_symlink()and file.resolve()==file and sha(file.read_bytes())==digest);result[str(file)]=digest
  result[str(GIT)]=git_binary_pin()
  return dict(sorted(result.items()))
 def source_admission(self):
  self.pins();self.guard.verify(MAIN/self.source['archive']['path']);read=lambda relative:load(MAIN/relative)
  tree=self.local([str(GIT),'--no-replace-objects','--no-pager','-C',str(MAIN),'show','-s','--format=%T',self.source['commit']])['stdout'].decode().strip();need(tree==self.source['tree'])
  return {'archive':archive_admission(MAIN/self.source['archive']['path'],self.source,read),'quality':quality_admission(reference(self.source['quality']),self.source,read)}
 def local(self,args,timeout=60,env=None):
  value=self.l.oci.bounded(args,env or self.l.environment(),timeout,'worker_identity_local_only');self.last_process={key:value[key]for key in('exit_code','timed_out','output_limit_exceeded','elapsed_seconds')};self.last_process.update(stdout_bytes=len(value['stdout']),stderr_bytes=len(value['stderr']));need(value['exit_code']==0 and not value['timed_out']and not value['output_limit_exceeded']);return value
 def emitter(self,args):return json.loads(self.local([str(self.l.registry.NODE),str(MAIN/m.EMITTER),*args])['stdout'])
 def stage(self):
  need(BUILD_ENABLED and self.build_run is None);before=self.source_admission()
  def dispatch():
   stage=self.emitter(['stage']);run=stage['directory'].split('/')[-1];need(str(uuid.UUID(run))==run and uuid.UUID(run).version==4 and stage['source_sha256']==self.source['source_sha256']and stage['file_count']==len(self.source['files']));self.build_run=run
   context=self.context('native');need(self.source_admission()==before);return {'build_run':run,'stage':stage,'source_admission':before,'context':context}
  return once(self,'stage',dispatch)
 def directory(self):
  if self.build_run is None:self.build_run=self.read('stage.normal.json')['value']['build_run']
  need(type(self.build_run)is str and str(uuid.UUID(self.build_run))==self.build_run and uuid.UUID(self.build_run).version==4);folder=MAIN/'.local/worker-hosting'/self.build_run;need(folder.resolve()==folder and folder.is_dir()and not folder.is_symlink());return folder
 def artifact(self,kind,suffix):return self.directory()/(kind_value(kind)+'-'+suffix)
 def context(self,kind):
  kind_value(kind);directory=self.directory();root=directory/'context';need(root.resolve()==root and root.is_dir()and not root.is_symlink())
  need(json.loads(load(directory/'owner.json'))=={'owner':'eps-worker-hosting-build','run':self.build_run,'source_sha256':self.source['source_sha256']})
  source={'source_sha256':self.source['source_sha256'],'files':self.source['files']};expected={row['path']:row['sha256']for row in self.source['files']};hits=0
  for row in self.source['files']:
   raw=load(root/row['path']);need(len(raw)==row['bytes']and sha(raw)==row['sha256']and raw==load(MAIN/row['path']));hits+=sum(bool(re.search(pattern,raw))for pattern in PATTERNS)
  need(hits==0)
  for name in('native-source.json','daemon-source.json'):file=root/'apps/worker'/name;raw=load(file);need(json.loads(raw)==source);expected['apps/worker/'+name]=sha(raw)
  for name in('daemon','native-sandbox'):relative='Dockerfile.'+name;raw=load(root/relative);need(raw==load(root/'apps/worker'/relative));expected[relative]=sha(raw)
  need(load(root/'.dockerignore')==b'.git\n.env*\n.local\nnode_modules\n**/node_modules\n');expected['.dockerignore']=sha(load(root/'.dockerignore'))
  provenance=json.loads(load(directory/'source-provenance.json'));need(set(provenance)=={'schema_version','run','source_sha256','native_graph','daemon_graph'}and provenance['schema_version']=='1.0'and provenance['run']==self.build_run and provenance['source_sha256']==self.source['source_sha256'])
  for name in('native','daemon'):need(sha(compact(provenance[name+'_graph']))==self.source[name+'_graph_sha256'])
  # The emitter rederives both graphs at every manifest/emit operation. This
  # independent read uses that same exported implementation against staged bytes.
  program="import fs from'node:fs';import path from'node:path';const m=await import("+json.dumps((MAIN/m.EMITTER).as_uri())+");const root=process.argv[1];const files=JSON.parse(fs.readFileSync(path.join(root,'apps/worker/daemon-source.json'))).files;const read=n=>fs.readFileSync(path.join(root,n));process.stdout.write(JSON.stringify({native:m.workerNativeGraph(files,read),daemon:m.workerDaemonGraph(files,read)}));"
  graphs=json.loads(self.local([str(self.l.registry.NODE),'--input-type=module','-e',program,str(root)])['stdout'])
  need(graphs['native']==provenance['native_graph']and graphs['daemon']==provenance['daemon_graph'])
  result={'daemon_source_sha256':self.source['source_sha256'],'native_source_sha256':self.source['source_sha256'],'file_count':len(self.source['files']),'native_graph_sha256':self.source['native_graph_sha256'],'daemon_graph_sha256':self.source['daemon_graph_sha256'],'private_pattern_families':len(PATTERNS),'private_pattern_hits':hits,'private_credentials_opened':False}
  manifest=root/'apps/worker/native-sandbox-manifest.json';compat=root/'apps/worker/native-compatibility.json'
  if kind=='native':need(not manifest.exists()and not compat.exists())
  else:
   native=self.accepted_export('native');raw=load(manifest);value=json.loads(raw);need(value=={'schema_version':'1.0','transport':'vercel_sandbox','protocol':'eps-native-files-v1','image':PREFIX.removeprefix('vcr.vercel.com/')+'native@'+native['runtime_digest'],'region':'dub1','source_sha256':self.source['source_sha256']});expected['apps/worker/native-sandbox-manifest.json']=sha(raw)
   descriptor=json.loads(load(compat));need(set(descriptor)=={'schema_version','daemon_source_sha256','native_source_sha256','native_manifest_sha256','native_graph_sha256','native_graph'}and descriptor=={'schema_version':'1.0','daemon_source_sha256':self.source['source_sha256'],'native_source_sha256':self.source['source_sha256'],'native_manifest_sha256':sha(raw),'native_graph_sha256':self.source['native_graph_sha256'],'native_graph':graphs['native']});expected['apps/worker/native-compatibility.json']=sha(load(compat));result.update(native_manifest_sha256=sha(raw),native_compatibility_sha256=sha(load(compat)))
  actual=[]
  for file in root.rglob('*'):
   need(not file.is_symlink()and file.resolve().is_relative_to(root))
   if file.is_file():actual.append(file.relative_to(root).as_posix())
  need(set(actual)==set(expected));result['context_files']=len(actual);return result
 def export(self,kind):
  need(BUILD_ENABLED);kind_value(kind);source=self.context(kind);self.source_admission();target=PREFIX+kind+':identity-'+self.inputs['run'];folder=self.directory()/'docker-client'
  if not folder.exists():folder.mkdir()
  config=folder/'config.json'
  if not config.exists():
   with config.open('xb')as stream:stream.write(b'{"auths":{}}\n');stream.flush();os.fsync(stream.fileno())
  need(json.loads(load(config))=={'auths':{}})
  def dispatch():
   for suffix in('export.tar','export.metadata.json'):need(not self.artifact(kind,suffix).exists())
   output='type=oci,dest='+str(self.artifact(kind,'export.tar'))+',name='+target+',oci-mediatypes=true,compression=zstd,compression-level=3,force-compression=true';dockerfile='native-sandbox'if kind=='native'else'daemon'
   command=[str(DOCKER),'--host',HOST,'buildx','build','--builder','default','--platform','linux/amd64','--file',str(self.directory()/'context'/('Dockerfile.'+dockerfile)),'--metadata-file',str(self.artifact(kind,'export.metadata.json')),'--progress','plain','--output',output]
   if kind=='daemon':command+=['--no-cache']
   environment={key:os.environ[key]for key in('SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG')if key in os.environ};environment.update(PATH=str(DOCKER.parent),ProgramFiles='C:/Program Files',DOCKER_HOST=HOST,DOCKER_CONFIG=str(folder),CI='1',NO_COLOR='1')
   result=self.local(command+[str(self.directory()/'context')],1800,environment);gate=self.l.oci.base.import_gate(result['stderr'],kind);archive=self.validate_archive(self.l.oci.archive_proof(self.artifact(kind,'export.tar')));need(self.context(kind)==source);self.source_admission()
   return {'result':'passed','kind':kind,'source_sha256':self.source['source_sha256'],'source':source,'runtime_digest':archive['runtime_digest'],'archive':archive,'production_import_gate':gate,'normal_build_process_return_observed':True,'source_revalidated_after_export':True,'registry_push_requested':False}
  value=once(self,kind+'-export',dispatch);return self.save(kind+'-export',value)
 def validate_archive(self,value):return module('worker_identity_exact_archive_validator',MAIN/ARCHIVE_VALIDATOR).validate_archive(value)
 def accepted_export(self,kind):
  name=kind_value(kind)+'-export';normal=self.read(name+'.normal.json');claim=self.read(name+'.claim.json');need(normal['claim_sha256']==self.hash(name+'.claim.json')and normal['normal_return_observed']is True and claim['source_pins']==self.pins());value=normal['value'];need(value['result']=='passed'and value['kind']==kind and value['source_sha256']==self.source['source_sha256']and value['normal_build_process_return_observed']is True and value['source_revalidated_after_export']is True)
  need(self.validate_archive(self.l.oci.archive_proof(self.artifact(kind,'export.tar')))==value['archive']);return value
 def manifest(self):
  need(BUILD_ENABLED);native=self.accepted_export('native');self.context('native')
  return once(self,'manifest',lambda:self.emitter(['manifest',self.build_run,PREFIX.removeprefix('vcr.vercel.com/')+'native@'+native['runtime_digest']]))
 def export_readback(self,kind):
  need(BUILD_ENABLED);name=kind_value(kind)+'-export';claim=self.read(name+'.claim.json');need(claim['source_pins']==self.pins());archive=self.validate_archive(self.l.oci.archive_proof(self.artifact(kind,'export.tar')));normal=self.read(name+'.normal.json')if self.exists(name+'.normal.json')else None
  if normal is not None:need(normal['claim_sha256']==self.hash(name+'.claim.json')and normal['normal_return_observed']is True and normal['value']['archive']==archive)
  return self.save(name+'-readback',{'result':'observed','read_only':True,'archive':archive,'normal_build_return_observed':normal is not None,'normal_return_not_inferred':True,'automatic_retry':False,'worker_or_provider_called':False})
 def prepare_oci(self,kind):
  need(BUILD_ENABLED);value=self.accepted_export(kind);folder=self.directory()/(kind+'-oci');need(not folder.exists())
  def dispatch():
   archive=self.l.oci.archive_proof(self.artifact(kind,'export.tar'),folder);need(self.validate_archive(archive)==value['archive']);return {'archive':archive,'folder':folder.relative_to(MAIN).as_posix(),'layers_recompressed':False}
  return once(self,kind+'-oci',dispatch)
 def emit(self):
  need(BUILD_ENABLED);daemon=self.accepted_export('daemon');self.context('daemon')
  def dispatch():
   value=self.emitter(['emit',self.build_run,PREFIX.removeprefix('vcr.vercel.com/')+'daemon@'+daemon['runtime_digest']]);folder=self.directory()/'deployment/.vercel';need(folder.resolve()==folder and not folder.is_symlink())
   file=folder/'project.json'
   with file.open('xb')as stream:stream.write(compact({'projectId':'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6','orgId':'team_gboXPxTevpCOZuaA8eY9PmR1','projectName':'everyone-presentation-worker-pilot'})+b'\n');stream.flush();os.fsync(stream.fileno())
   return value
  return once(self,'emit',dispatch)
 def save(self,action,value):
  folder=MAIN/'tracking/evidence/m07/worker-source-identity-release';folder.mkdir(parents=True,exist_ok=True);file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json');body={'schema_version':'1.0','observed_at':stamp(),'run':self.inputs['run'],'build_run':self.build_run,'action':action,'source_sha256':self.source['source_sha256'],'provider_called':False,'worker_deployed':False,**value}
  with file.open('xb')as stream:stream.write(compact(body)+b'\n');stream.flush();os.fsync(stream.fileno())
  return {'path':file.relative_to(MAIN).as_posix(),'sha256':sha(load(file))}
def main():
 need(BUILD_ENABLED and len(sys.argv)==2);libraries=m.Libraries();file=MAIN/'.local/worker-source-identity-release/build-inputs.json';libraries.guard().verify(file);inputs=json.loads(load(file));need(set(inputs)=={'run','source'});b=Build(inputs,libraries);action=sys.argv[1]
 if action=='stage':value=b.stage()
 elif action in('native-export','daemon-export'):value=b.export(action.split('-')[0])
 elif action in('native-export-readback','daemon-export-readback'):value=b.export_readback(action.split('-')[0])
 elif action=='manifest':value=b.manifest()
 elif action in('native-oci','daemon-oci'):value=b.prepare_oci(action.split('-')[0])
 else:need(action=='emit');value=b.emit()
 print(json.dumps({'result':'passed','action':action,'output':value}))
if __name__=='__main__':
 try:main()
 except Exception:print('WORKER_IDENTITY_LOCAL_BUILD_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
