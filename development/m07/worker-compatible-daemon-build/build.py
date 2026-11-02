"""Disabled daemon-only build. The existing native artifact keeps its own source."""
from pathlib import Path
import datetime,importlib.util,json,os,re,sys,uuid
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
a=module('compatible_daemon_fixed_native_anchors',HERE/'anchors.py');MAIN=a.MAIN
def need(value):
 if not value:raise ValueError('COMPATIBLE_DAEMON_BUILD_REFUSED')
import hashlib
sha=lambda raw:hashlib.sha256(raw).hexdigest()
need(sha((MAIN/a.OLD/'build.py').read_bytes())==a.BUILD_SHA)
need(sha((MAIN/a.OLD/'mechanisms.py').read_bytes())==a.MECHANISMS_SHA)
base=module('compatible_daemon_frozen_build_library',MAIN/a.OLD/'build.py')
BUILD_ENABLED=False

def native_dependency_rows(source,native_source,graph,previous_graph):
 """Complete native graph and dependency row equality, before and after reuse."""
 base.source_shape(source);need(source['source_sha256']!=a.SOURCE)
 need(native_source['source_sha256']==a.SOURCE and sha(base.compact(native_source['files']))==a.SOURCE)
 need(graph==previous_graph and sha(base.compact(graph))==a.GRAPH==source['native_graph_sha256'])
 old={row['path']:row for row in native_source['files']};new={row['path']:row for row in source['files']}
 for path in [*graph['build_inputs'],*(row['path']for row in graph['modules'])]:need(old.get(path)==new.get(path)and path in old)

def dual_identity(source,native_source,manifest_raw,descriptor,graphs,previous_graph):
 """Pure identity check; caller separately verifies every staged/current file."""
 native_dependency_rows(source,native_source,graphs['native'],previous_graph)
 need(sha(base.compact(graphs['daemon']))==source['daemon_graph_sha256'])
 need(sha(manifest_raw)==a.MANIFEST)
 manifest=json.loads(manifest_raw);need(manifest=={'schema_version':'1.0','transport':'vercel_sandbox','protocol':'eps-native-files-v1','image':base.PREFIX.removeprefix('vcr.vercel.com/')+'native@'+a.DIGEST,'region':'dub1','source_sha256':a.SOURCE})
 need(descriptor=={'schema_version':'1.0','daemon_source_sha256':source['source_sha256'],'native_source_sha256':a.SOURCE,'native_manifest_sha256':a.MANIFEST,'native_graph_sha256':a.GRAPH,'native_graph':graphs['native']})
 return {'daemon_source_sha256':source['source_sha256'],'native_source_sha256':a.SOURCE,'native_manifest_sha256':a.MANIFEST,'native_graph_sha256':a.GRAPH,'daemon_graph_sha256':source['daemon_graph_sha256'],'native_rebuilt':False}

class Build(base.Build):
 def __init__(self,inputs,libraries=None):
  need(type(inputs)is dict and set(inputs)in({'run','source'},{'run','build_run','source','native','daemon','native_probe','worker_sql_proof'}));super().__init__(inputs,libraries)
  need(self.source['native_graph_sha256']==a.GRAPH)
  if self.build_run is not None:need(str(uuid.UUID(self.build_run))==self.build_run and uuid.UUID(self.build_run).version==4 and self.build_run!=a.BUILD_RUN)
  self.private=MAIN/'.local/worker-compatible-daemon-build'/inputs['run']
 def pins(self):
  result=super().pins()
  need(result[str(MAIN/a.OLD/'build.py')]==a.BUILD_SHA and result[str(MAIN/a.OLD/'mechanisms.py')]==a.MECHANISMS_SHA)
  for file in sorted(HERE.iterdir()):
   if file.is_file():result[str(file)]=sha(base.load(file))
  result['retained_native_profile_sha256']=a.PROFILE['sha256']
  return dict(sorted(result.items()))
 def source_admission(self):
  profile=load_profile(self.l);need(profile['run']==self.inputs['run']and profile['source']==self.source)
  return super().source_admission()
 def retained_native(self):
  file=MAIN/a.PROFILE['path'];self.guard.verify(file);raw=base.load(file);need(sha(raw)==a.PROFILE['sha256'])
  inputs=json.loads(raw);need(set(inputs)=={'run','source'}and inputs['run']==a.RUN and inputs['source']['source_sha256']==a.SOURCE and inputs['source']['native_graph_sha256']==a.GRAPH)
  historical=base.Build({**inputs,'build_run':a.BUILD_RUN},self.l);native=historical.accepted_export('native')
  refs={key:base.reference(ref)for key,ref in [('export',a.EXPORT),('copy',a.COPY),('ready',a.READY),('probe',a.PROBE)]}
  need(all(refs['export'].get(key)==value for key,value in native.items()))
  need(native['runtime_digest']==a.DIGEST and native['source_sha256']==a.SOURCE)
  copy=refs['copy'];ready=refs['ready'];probe=refs['probe']
  need(copy['result']=='passed'and copy['normal_copy_return_observed']is True and copy['two_remote_reads_equal']is True and copy['runtime_digest']==a.DIGEST and copy['source_sha256']==a.SOURCE)
  need(ready['result']=='observed'and ready['private_repository']is True and ready['source_sha256']==a.SOURCE and ready['image']['runtime_digest']==a.DIGEST and ready['image']['status']=='ready'and ready['image']['architecture']=='amd64'and ready['image']['platform']=='linux')
  need(probe['result']=='passed'and probe['source_sha256']==a.SOURCE and probe['projection']['cleanup_confirmed']is True and probe['projection']['lock_released']is True and probe['projection']['native_tasks_passed']==9 and probe['projection']['named_resources_observed_and_absent']==10 and probe['projection']['image']==base.PREFIX.removeprefix('vcr.vercel.com/')+'native@'+a.DIGEST)
  previous=MAIN/'.local/worker-hosting'/a.BUILD_RUN
  provenance=json.loads(base.load(previous/'source-provenance.json'));need(provenance['run']==a.BUILD_RUN and provenance['source_sha256']==a.SOURCE and sha(base.compact(provenance['native_graph']))==a.GRAPH)
  return {'artifact':native,'source':inputs['source'],'native_graph':provenance['native_graph'],'build_run':a.BUILD_RUN,'input_run':a.RUN,'references':{'export':a.EXPORT,'copy':a.COPY,'ready':a.READY,'probe':a.PROBE},'historical_only':True,'native_rebuilt':False}
 def stage(self):
  need(BUILD_ENABLED);return super().stage()
 def accepted_stage(self):
  normal=self.read('stage.normal.json');claim=self.read('stage.claim.json')
  need(normal['claim_sha256']==self.hash('stage.claim.json')and normal['normal_return_observed']is True and claim['source_pins']==self.pins())
  value=normal['value']['build_run'];need(str(uuid.UUID(value))==value and uuid.UUID(value).version==4 and value!=a.BUILD_RUN)
  if self.build_run is None:self.build_run=value
  need(normal['value']['build_run']==self.build_run and self.build_run!=a.BUILD_RUN);return normal['value']
 def context(self,kind):
  base.kind_value(kind)
  if kind=='native':
   need(not self.exists('reuse-native.claim.json'));return super().context('native')
  self.accepted_stage();normal=self.read('reuse-native.normal.json');claim=self.read('reuse-native.claim.json')
  need(normal['claim_sha256']==self.hash('reuse-native.claim.json')and normal['normal_return_observed']is True and claim['source_pins']==self.pins())
  result=self._daemon_context();need(normal['value']['context']==result);return result
 def _daemon_context(self):
  retained=self.retained_native();directory=self.directory();root=directory/'context';need(root.resolve()==root and root.is_dir()and not root.is_symlink())
  need(json.loads(base.load(directory/'owner.json'))=={'owner':'eps-worker-hosting-build','run':self.build_run,'source_sha256':self.source['source_sha256']})
  expected={};hits=0
  for row in self.source['files']:
   raw=base.load(root/row['path']);need(len(raw)==row['bytes']and sha(raw)==row['sha256']and raw==base.load(MAIN/row['path']));expected[row['path']]=sha(raw)
   hits+=sum(bool(re.search(pattern,raw))for pattern in base.PATTERNS)
  need(hits==0)
  for name,value in [('daemon-source.json',{'source_sha256':self.source['source_sha256'],'files':self.source['files']}),('native-source.json',{'source_sha256':a.SOURCE,'files':retained['source']['files']})]:
   path='apps/worker/'+name;raw=base.load(root/path);need(json.loads(raw)==value);expected[path]=sha(raw)
  for name in('daemon','native-sandbox'):
   path='Dockerfile.'+name;raw=base.load(root/path);need(raw==base.load(root/'apps/worker'/path));expected[path]=sha(raw)
  raw=base.load(root/'.dockerignore');need(raw==b'.git\n.env*\n.local\nnode_modules\n**/node_modules\n');expected['.dockerignore']=sha(raw)
  provenance=json.loads(base.load(directory/'source-provenance.json'));need(set(provenance)=={'schema_version','run','source_sha256','native_graph','daemon_graph'}and provenance['schema_version']=='1.0'and provenance['run']==self.build_run and provenance['source_sha256']==self.source['source_sha256'])
  program="import fs from'node:fs';import path from'node:path';const m=await import("+json.dumps((MAIN/base.m.EMITTER).as_uri())+");const root=process.argv[1];const files=JSON.parse(fs.readFileSync(path.join(root,'apps/worker/daemon-source.json'))).files;const read=n=>fs.readFileSync(path.join(root,n));process.stdout.write(JSON.stringify({native:m.workerNativeGraph(files,read),daemon:m.workerDaemonGraph(files,read)}));"
  graphs=json.loads(self.local([str(self.l.registry.NODE),'--input-type=module','-e',program,str(root)])['stdout']);need(graphs=={'native':provenance['native_graph'],'daemon':provenance['daemon_graph']})
  manifest='apps/worker/native-sandbox-manifest.json';compat='apps/worker/native-compatibility.json';manifest_raw=base.load(root/manifest);descriptor_raw=base.load(root/compat)
  result=dual_identity(self.source,{'source_sha256':a.SOURCE,'files':retained['source']['files']},manifest_raw,json.loads(descriptor_raw),graphs,retained['native_graph'])
  expected[manifest]=sha(manifest_raw);expected[compat]=sha(descriptor_raw)
  actual=[]
  for file in root.rglob('*'):
   need(not file.is_symlink()and file.resolve().is_relative_to(root))
   if file.is_file():actual.append(file.relative_to(root).as_posix())
  need(set(actual)==set(expected))
  return {**result,'native_compatibility_sha256':sha(descriptor_raw),'file_count':len(self.source['files']),'private_pattern_families':len(base.PATTERNS),'private_pattern_hits':hits,'private_credentials_opened':False,'context_files':len(actual),'retained_native_references':retained['references']}
 def staged_native_graph(self):return json.loads(base.load(self.directory()/'source-provenance.json'))['native_graph']
 def reuse_native(self):
  need(BUILD_ENABLED);self.accepted_stage();before=self.source_admission();retained=self.retained_native();self.context('native')
  native_dependency_rows(self.source,{'source_sha256':a.SOURCE,'files':retained['source']['files']},self.staged_native_graph(),retained['native_graph'])
  def dispatch():
   value=self.emitter(['reuse-native',self.build_run,a.BUILD_RUN]);context=self._daemon_context()
   need(value=={k:context[k]for k in('daemon_source_sha256','native_source_sha256','native_manifest_sha256','native_compatibility_sha256','native_graph_sha256')})
   need(self.source_admission()==before and self.retained_native()==retained)
   return {'result':'passed','emitter':value,'context':context,'retained_native_references':retained['references'],'native_rebuilt':False}
  return base.once(self,'reuse-native',dispatch)
 def export(self,kind):need(BUILD_ENABLED and kind=='daemon');return super().export(kind)
 def accepted_export(self,kind):return self.retained_native()['artifact']if kind=='native'else super().accepted_export(kind)
 def manifest(self):need(False)
 def prepare_oci(self,kind):need(BUILD_ENABLED and kind=='daemon');return super().prepare_oci(kind)
 def export_readback(self,kind):need(BUILD_ENABLED and kind=='daemon');return super().export_readback(kind)
 def emit(self):need(BUILD_ENABLED);return super().emit()
 def save(self,action,value):
  folder=MAIN/'tracking/evidence/m07/worker-compatible-daemon-build';folder.mkdir(parents=True,exist_ok=True);file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
  raw=base.compact({'schema_version':'1.0','observed_at':base.stamp(),'run':self.inputs['run'],'build_run':self.build_run,'action':action,'source_sha256':self.source['source_sha256'],'daemon_source_sha256':self.source['source_sha256'],'native_source_sha256':a.SOURCE,'provider_called':False,'worker_deployed':False,**value})+b'\n'
  with file.open('xb')as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno())
  return {'path':file.relative_to(MAIN).as_posix(),'sha256':sha(base.load(file))}

def load_profile(libraries=None):
 need(a.FUTURE_DAEMON_PROFILE is not None)
 ref=a.FUTURE_DAEMON_PROFILE;need(type(ref)is dict and set(ref)=={'path','sha256'}and ref['path']=='.local/worker-compatible-daemon-build/build-inputs.json')
 need(type(ref['sha256'])is str and re.fullmatch('[a-f0-9]{64}',ref['sha256']))
 libraries=libraries or base.m.Libraries();file=MAIN/ref['path'];libraries.guard().verify(file);raw=base.load(file);need(sha(raw)==ref['sha256']);value=json.loads(raw)
 need(type(value)is dict and set(value)=={'run','source'});base.source_shape(value['source']);return value
def load_build(libraries=None):
 need(a.FUTURE_DAEMON_PROFILE is not None)
 libraries=libraries or base.m.Libraries();return Build(load_profile(libraries),libraries)
def main():
 need(BUILD_ENABLED and len(sys.argv)==2);build=load_build()
 action=sys.argv[1]
 if action=='stage':value=build.stage()
 elif action=='reuse-native':value=build.reuse_native()
 elif action=='daemon-export':value=build.export('daemon')
 elif action=='daemon-export-readback':value=build.export_readback('daemon')
 elif action=='daemon-oci':value=build.prepare_oci('daemon')
 else:need(action=='emit');value=build.emit()
 print(json.dumps({'result':'passed','action':action,'output':value}))
if __name__=='__main__':
 try:main()
 except Exception:print('COMPATIBLE_DAEMON_BUILD_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
