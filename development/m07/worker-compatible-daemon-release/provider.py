"""Thin dual-source admission over the sealed provider; no new transport."""
from pathlib import Path
import copy,datetime,importlib.util,json,os,re
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('compatible_provider_anchors',HERE/'anchors.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
old=a.library('provider.py');s=old.s;need=old.need;MAIN=a.MAIN

def validate_inputs(value):
 need(type(value)is dict and type(value.get('native'))is dict and type(value.get('source'))is dict)
 native=value['native'];need(native.get('digest')==a.NATIVE_DIGEST and native.get('source_sha256')==a.NATIVE_SOURCE and native.get('graph_sha256')==a.NATIVE_GRAPH and native.get('manifest_sha256')==a.NATIVE_MANIFEST)
 need(native.get('export')==a.NATIVE_EXPORT and native.get('registry_copy')==a.NATIVE_COPY and native.get('ready')==a.NATIVE_READY and value.get('worker_sql_proof')==a.WORKER_PROOF)
 need(type(value.get('native_probe'))is dict and value['native_probe'].get('admitted')==a.NATIVE_ADMITTED)
 need(value['source'].get('native_graph_sha256')==a.NATIVE_GRAPH and value['source'].get('source_sha256')!=a.NATIVE_SOURCE)
 # Reuse only the old closed shape checker. Its one full-source equality is
 # projected in a validation COPY after the exact old native source was proved.
 # Actual inputs/bindings/copy/probe admission always retain the real old source.
 shape=copy.deepcopy(value);shape['native']['source_sha256']=shape['source']['source_sha256'];old.validate_inputs(shape)
 return value

def private_reference(guard,ref):
 file=MAIN/ref['path'];guard.verify(file);raw=s.load(file);need(s.sha(raw)==ref['sha256']);return json.loads(raw)

class Provider(old.Provider):
 def __init__(self):
  need(HERE.parents[2].resolve()==MAIN);self.l=old.module('compatible_daemon_original_libraries',a.OLD/'mechanisms.py').Libraries();self.guard=self.l.guard()
  file=MAIN/a.INPUT;self.guard.verify(file);raw=s.load(file);self.inputs=validate_inputs(json.loads(raw));self.input_ref={'path':file.relative_to(MAIN).as_posix(),'sha256':s.sha(raw)}
  self.private=MAIN/a.PRIVATE/self.inputs['run'];self.s=s.State(self.inputs['native']['digest']);self.e=old.e;self.o=a.module('compatible_daemon_observer',HERE/'startup.py');self.r=a.module('compatible_daemon_registry',HERE/'registry.py');self.cached_health=[]
 def pins(self):
  result=super().pins()
  for name,digest in a.FROZEN.items():file=a.OLD/name;need(s.sha(s.load(file))==digest);result[str(file)]=digest
  need(type(a.BUILD_WRAPPER_SHA)is str and re.fullmatch('[a-f0-9]{64}',a.BUILD_WRAPPER_SHA)and s.sha(s.load(a.BUILD_WRAPPER))==a.BUILD_WRAPPER_SHA);result[str(a.BUILD_WRAPPER)]=a.BUILD_WRAPPER_SHA
  need(s.sha(s.load(a.BUILD_ANCHORS))==a.BUILD_ANCHORS_SHA);result[str(a.BUILD_ANCHORS)]=a.BUILD_ANCHORS_SHA
  result.update(self.build().pins())
  for ref in(a.NATIVE_PROFILE,a.PROBE_INPUT,a.PROBE_REFS):private_reference(self.guard,ref);result[str(MAIN/ref['path'])]=ref['sha256']
  for file in sorted(HERE.iterdir()):
   if file.is_file()and file.suffix in('.py','.json','.md'):result[str(file)]=s.sha(s.load(file))
  return dict(sorted(result.items()))
 def _ensure(self):
  owner={'owner':a.PURPOSE,'run':self.inputs['run'],'project':old.PROJECT,'team':old.TEAM,'target':s.a.TARGET,'bindings':self.bindings()}
  if not self.private.exists():self.private.mkdir(parents=True,exist_ok=False);need(self.private.resolve()==self.private and not self.private.is_symlink());self._create('owner.json',owner)
  else:need(self.private.resolve()==self.private and not self.private.is_symlink()and self.read('owner.json')==owner)
 def write(self,name,value):
  if name=='plan.json':need(value['purpose']=='first_worker_separate_source_identity_release');value={**value,'purpose':a.PURPOSE}
  return super().write(name,value)
 def build(self):
  need(type(a.BUILD_WRAPPER_SHA)is str and s.sha(s.load(a.BUILD_WRAPPER))==a.BUILD_WRAPPER_SHA and s.sha(s.load(a.BUILD_ANCHORS))==a.BUILD_ANCHORS_SHA)
  return a.module('compatible_daemon_reviewed_build',a.BUILD_WRAPPER).Build(self.inputs,libraries=self.l)
 def historical_build(self):
  inputs=private_reference(self.guard,a.NATIVE_PROFILE);need(inputs['source']['source_sha256']==a.NATIVE_SOURCE)
  return a.library('build.py').Build(inputs,libraries=self.l)
 def registry_ports(self,kind):
  need(kind in('native','daemon'))
  return a.library('registry.py').Ports(self.historical_build())if kind=='native'else self.r.Ports(self.build())
 def retained_probe(self):
  inputs=private_reference(self.guard,a.PROBE_INPUT);refs=private_reference(self.guard,a.PROBE_REFS);need(set(refs)=={'receipt','plan','release'}and refs=={key:self.inputs['native_probe'][key]for key in refs}and self.inputs['native_probe']['admitted']==a.NATIVE_ADMITTED)
  need(inputs['source']['source_sha256']==a.NATIVE_SOURCE and inputs['native']['digest']==a.NATIVE_DIGEST and inputs['native']['ready']==a.NATIVE_READY)
  return a.library('native_probe.py').admit_reference(self.inputs['native_probe'],inputs,self.l,None)
 def admission(self,phase):
  need(self.o.OBSERVE_ENABLED is True);self.build().source_admission();source=self.build().context('daemon')
  need(all(source[key]==self.bindings()[key]for key in('daemon_source_sha256','native_source_sha256','native_graph_sha256','daemon_graph_sha256','native_manifest_sha256','native_compatibility_sha256')))
  native=self.build().accepted_export('native');daemon=self.build().accepted_export('daemon');need(native['runtime_digest']==a.NATIVE_DIGEST and native['source_sha256']==a.NATIVE_SOURCE and daemon['runtime_digest']==self.inputs['daemon']['digest'])
  for kind in('native','daemon'):
   copy_proof=old.read_ref(self.inputs[kind]['registry_copy']);ready_proof=old.read_ref(self.inputs[kind]['ready'])
   need(copy_proof['result']=='passed'and copy_proof['normal_copy_return_observed']is True and copy_proof['runtime_digest']==self.inputs[kind]['digest']and copy_proof['source_sha256']==self.inputs[kind]['source_sha256'])
   need(ready_proof['result']=='observed'and ready_proof['image']['runtime_digest']==self.inputs[kind]['digest'])
  for kind in('native','daemon'):
   ports=self.registry_ports(kind);claim=ports.read(kind+'-copy.claim.json');returned=self.r.normal(ports,kind+'-copy');need(claim['source_pins']==ports.pins()and returned is not None and returned['normal_copy_return_observed']is True and returned['runtime_digest']==self.inputs[kind]['digest'])
  probe=self.retained_probe();need(probe['cleanup_confirmed']is True and probe['source_sha256']==a.NATIVE_SOURCE and probe['image']==old.PREFIX+'native@'+a.NATIVE_DIGEST)
  proof=old.read_ref(self.inputs['worker_sql_proof']);need(proof['result']=='passed'and proof['sql_contract_sha256']==self.s.sql_contract_sha256()and proof['history_count']==40)
  for key in('full76_rows_preserved','full_nonnull_audit_reason_preserved','unknown_metadata_ACL_value_refused','full_reason_actual_hash_preimage_refused','actual_diagnostic_rollback_zero_difference','all_three_guarded_normal_nonces_and_equal_readbacks','cached_intake_waited_before_snapshot','fresh_intake_denied_after_pause','retry_lifecycle_not_hidden_by_pause','committed_intake_preimage_refused_before_updates','all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released'):need(proof[key]is True)
  need(proof['native_pin_value']==a.NATIVE_DIGEST and proof['cloud_called']is False and proof['provider_called']is False)
  helper=self.l.registry.helpers();helper.project_ready(self.api('GET',self.l.registry.API['repository']),self.api('GET',self.l.registry.API['images']),a.NATIVE_DIGEST)
  repo=self.api('GET',self.l.registry.API['daemon_repository']);helper.repository_metadata(repo,self.l.registry.DAEMON_REPO,'daemon')
  images=self.api('GET','/v1/vcr/repository/'+self.l.registry.DAEMON_REPO+'/images?projectId='+old.PROJECT+'&teamId='+old.TEAM+'&limit=50');need(type(images.get('images'))is list and len(images['images'])<=50)
  matches=[row for row in images['images']if row.get('manifestDigest')==self.inputs['daemon']['digest']];need(len(matches)==1 and matches[0].get('repositoryId')==self.l.registry.DAEMON_REPO and matches[0].get('kind')=='manifest'and matches[0].get('status')=='ready'and matches[0].get('architecture',matches[0].get('arch'))=='amd64'and matches[0].get('platform')=='linux')
  return {'bindings':self.bindings(),'canonical40':copy.deepcopy(s.a.APPLY),'functional_SQL40':copy.deepcopy(s.a.FUNCTIONAL),'collector_validation':copy.deepcopy(s.a.COLLECTOR),'current40_worker_SQL':copy.deepcopy(a.WORKER_PROOF),'retained_native_probe':copy.deepcopy(self.inputs['native_probe']),'native_reused':True,'new_native_probe_claimed':False,'checkpoint_is_not_restore_proof':True,'phase':phase}
 def ready(self,url,marker):
  value=super().ready(url,marker)
  need(value['native_cleanup_basis']=='new probe exact absence and deployed source boot global-idle assertion; no new client session inventory claimed')
  return {**value,'native_cleanup_basis':'retained admitted native3d probe exact absence plus new daemon boot global-idle assertion; no new probe or client-session inventory claimed','retained_native_probe_ref':copy.deepcopy(self.inputs['native_probe']['admitted']),'new_native_probe_claimed':False}
 def save(self,action,value):
  result={'schema_version':'1.0','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'action':action,'purpose':a.PURPOSE,'run':self.inputs['run'],'project_id':old.PROJECT,'team_id':old.TEAM,'target':s.a.TARGET,'bindings':self.bindings(),'cached_platform_health_metadata':self.cached_health,'fresh_application_heartbeat_claimed':False,'raw_cli_logs_persisted':False,'private_checkpoint_is_restore_proof':False,'rollback_or_AT069_performed':False,'retained_native_source_sha256':a.NATIVE_SOURCE,'new_native_build_probe_or_copy_claimed':False,**value}
  folder=MAIN/a.EVIDENCE;folder.mkdir(parents=True,exist_ok=True);need(folder.resolve()==folder and not folder.is_symlink());file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action.replace(':','-')+'.json')
  with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(result,ensure_ascii=False,indent=2)+'\n');stream.flush();os.fsync(stream.fileno())
  return {'result':value['result'],'action':action,'receipt':file.relative_to(MAIN).as_posix()}
