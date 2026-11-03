"""Fresh current6o adapter; same reviewed normal CLI, custody and full State."""
from pathlib import Path
import datetime,importlib.util,json,os,re
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ocr_provider_anchors',HERE/'anchors.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
old=a.frozen('worker-compatible-daemon-release/provider.py');s=old.s;need=a.need
state=a.module('ocr_forward_state',HERE/'state.py');env=a.module('ocr_forward_environment',HERE/'environment.py')

# These immutable observations admit availability, never the lost copy return.
DAEMON_READBACK={'path':'tracking/evidence/m07/worker-ocr-config-daemon-build/2026-11-03T00-35-04-076860Z-daemon-registry-readback.json','sha256':'11402e843162e461e80885cd9cd61e57241b76887ce6712a12312fde93d293f9'}
DAEMON_READY={'path':'tracking/evidence/m07/worker-ocr-config-daemon-build/2026-11-03T00-37-53-472573Z-daemon-registry-ready-observed.json','sha256':'07f303ff65eb74d0198052882d2881465a019d7b5c6df5ea112d7faee294d1fb'}
DAEMON_RUN='aa51ae63-6e81-45c9-8ba6-e0b1b9589a06';DAEMON_BUILD='56a41169-d8a3-4629-a7eb-baa64b23526c'
DAEMON_SOURCE='f8142f08baa37efcc160aea96c32b389dfd0a0ee5569f267642fc9ff396907b4'
DAEMON_DIGEST='sha256:ffb4ce64dbb5a9a1854e96e32063539c72025023fee504c189b8f775e029cd98'
COPY_CLAIM='e8b6ee85d4118a05d1798e877cd84042345afcff8c9ab131f25ad4e266a2f987'

def observed_admission():
 # Keep every old source/probe/SQL/live-platform check. ONLY daemon normal-copy
 # requirements are replaced by observed_daemon_artifact's explicit read path.
 file=a.COMPATIBLE/'provider.py';raw=s.load(file);need(s.sha(raw)==a.FROZEN['worker-compatible-daemon-release/provider.py'])
 text=raw.decode().replace('\r\n','\n');start=text.index(' def admission(self,phase):');end=text.index(' def ready(self,url,marker):',start);text='\n'.join(line[1:]for line in text[start:end].split('\n')if line)
 before=" for kind in('native','daemon'):";after=" for kind in('native',):";need(text.count(before)==2 and after not in text)
 projected=text.replace(before,after);need(projected.replace(after,before)==text)
 namespace=dict(old.__dict__);exec(compile(projected,str(HERE/'provider.py')+':observed-daemon-admission','exec'),namespace);return namespace['admission']
def builder():
 return a.builder()
def validate_inputs(value):
 old.validate_inputs(value);need(value['run']==DAEMON_RUN and value['build_run']==DAEMON_BUILD and value['source']['source_sha256']==value['daemon']['source_sha256']==DAEMON_SOURCE and value['daemon']['digest']==DAEMON_DIGEST and value['daemon']['registry_copy']==DAEMON_READBACK and value['daemon']['ready']==DAEMON_READY);return value

class Provider(old.Provider):
 def __init__(self):
  need(HERE.parents[2].resolve()==a.MAIN);builder()
  self.l=old.old.module('ocr_unchanged_normal_libraries',old.a.OLD/'mechanisms.py').Libraries();self.guard=self.l.guard();p=a.MAIN/a.INPUT;self.guard.verify(p);raw=s.load(p)
  self.inputs=validate_inputs(json.loads(raw));self.input_ref={'path':a.INPUT,'sha256':s.sha(raw)};self.private=a.MAIN/a.PRIVATE/self.inputs['run'];self.s=state.State(self.inputs['native']['digest']);self.e=env;self.o=old.a.module('ocr_inert_startup',old.HERE/'startup.py');self.r=a.module('ocr_daemon_registry',HERE/'registry.py');self.cached_health=[]
 def pins(self):
  result=super().pins()
  for ref in(a.READY,a.RESUME):old.old.read_ref(ref);result[str(a.MAIN/ref['path'])]=ref['sha256']
  builder();result[str(a.BUILD)]=a.BUILD_SHA;result[str(a.BUILD_ANCHORS)]=a.BUILD_ANCHORS_SHA
  for p in sorted(HERE.iterdir()):
   if p.is_file()and p.suffix in('.py','.md','.json'):result[str(p)]=s.sha(s.load(p))
  return dict(sorted(result.items()))
 def _ensure(self):
  owner={'owner':a.PURPOSE,'run':self.inputs['run'],'project':old.old.PROJECT,'team':old.old.TEAM,'target':s.a.TARGET,'baseline':a.BASELINE,'bindings':self.bindings()}
  if not self.private.exists():self.private.mkdir(parents=True,exist_ok=False);need(self.private.resolve()==self.private and not self.private.is_symlink());self._create('owner.json',owner)
  else:need(self.private.resolve()==self.private and not self.private.is_symlink()and self.read('owner.json')==owner)
 def write(self,name,value):
  if name=='plan.json':need(value['purpose']=='first_worker_separate_source_identity_release');value={**value,'purpose':a.PURPOSE}
  if re.fullmatch(r'env-[01]\.normal\.json',name):
   response=name.replace('.normal.','.response.');row=self.read(response);need(row['claim_sha256']==self.hash(name.replace('.normal.','.claim.')));self.e.response(row['response'],self.read(name.replace('.normal.','.claim.'))['action']);value={**value,'response_sha256':self.hash(response)}
  return old.old.Provider.write(self,name,value)
 def read(self,name):
  value=old.old.Provider.read(self,name)
  if re.fullmatch(r'env-[01]\.normal\.json',name):
   response=name.replace('.normal.','.response.');row=old.old.Provider.read(self,response);need(value['response_sha256']==self.hash(response)and row['claim_sha256']==self.hash(name.replace('.normal.','.claim.')));self.e.response(row['response'],old.old.Provider.read(self,name.replace('.normal.','.claim.'))['action'])
  return value
 def build(self):return builder().Build(self.inputs,libraries=self.l)
 def observed_daemon_artifact(self):
  need(self.inputs['run']==DAEMON_RUN and self.inputs['build_run']==DAEMON_BUILD and self.inputs['source']['source_sha256']==self.inputs['daemon']['source_sha256']==DAEMON_SOURCE and self.inputs['daemon']['digest']==DAEMON_DIGEST and self.inputs['daemon']['registry_copy']==DAEMON_READBACK and self.inputs['daemon']['ready']==DAEMON_READY)
  readback=old.old.read_ref(DAEMON_READBACK);ready=old.old.read_ref(DAEMON_READY)
  for row,action in((readback,'daemon-registry-readback'),(ready,'daemon-registry-ready-observed')):
   need(row['run']==DAEMON_RUN and row['build_run']==DAEMON_BUILD and row['source_sha256']==row['daemon_source_sha256']==DAEMON_SOURCE and row['native_source_sha256']==old.a.NATIVE_SOURCE)
   need(row['action']==action and row['read_only']is True and row['provider_mutations']is False and row['normal_copy_return_observed']is False and row['credentials_extracted']is False and row['raw_credentials_persisted']is False)
  need(readback['result']=='unconfirmed'and readback['runtime_digest']==DAEMON_DIGEST and readback['two_remote_reads_equal']is True and readback['normal_return_not_inferred']is True and readback['automatic_retry']is False)
  need(ready['result']=='observed'and ready['normal_observation_return_observed']is True and ready['two_current_ready_reads_equal']is True and ready['exact_digest_remote_readback']==DAEMON_READBACK and ready['original_copy_claim_sha256']==COPY_CLAIM and ready['original_copy_outcome']=='unknown'and ready['normal_copy_return_not_inferred']is True and ready['copy_replayed']is False and ready['observed_artifact_ready']is True)
  ports=self.registry_ports('daemon');pins=ports.pins();claim=ports.read('daemon-copy.claim.json');need(claim['source_pins']==pins and claim['automatic_retry']is False and claim['dispatch_may_have_occurred']is True and ports.hash('daemon-copy.claim.json')==COPY_CLAIM and not ports.exists('daemon-copy.normal.json'))
  exported=ports.exported('daemon');need(exported['runtime_digest']==DAEMON_DIGEST and exported['source_sha256']==DAEMON_SOURCE)
  first,second=ports.remote('daemon',exported),ports.remote('daemon',exported);need(first==second=={'index_digest':exported['archive']['index_digest'],'runtime_digest':DAEMON_DIGEST})
  first,second=ports.ready('daemon',exported),ports.ready('daemon',exported);need(first==second and first=={key:ready[key]for key in('image','repository_id','project_id','team_id','private_repository')}and first['image']['runtime_digest']==DAEMON_DIGEST and first['image']['status']=='ready'and first['private_repository']is True)
  need(ports.pins()==pins and ports.read('daemon-copy.claim.json')==claim and ports.hash('daemon-copy.claim.json')==COPY_CLAIM and not ports.exists('daemon-copy.normal.json'))
  return {'basis':'independently_observed_exact_artifact_availability','remote_readback':DAEMON_READBACK,'ready_observation':DAEMON_READY,'original_copy_claim_sha256':COPY_CLAIM,'original_copy_outcome':'unknown','normal_copy_return_observed':False,'copy_replayed':False,'read_only':True,'two_current_remote_reads_equal':True,'two_current_ready_reads_equal':True}
 def admission(self,phase):
  need(self.o.OBSERVE_ENABLED is True);evidence=self.observed_daemon_artifact();value=observed_admission()(self,phase);return{**value,'daemon_artifact_admission':evidence}
 def old_ready(self):
  ready=old.old.read_ref(a.READY);resume=old.old.read_ref(a.RESUME);need(ready['result']=='passed'and ready['deployment_id']==a.BASELINE['deployment_id']and ready['startup']['complete_window']is True and resume['result']=='passed'and resume['normal_return_observed']is True and resume['two_equal_readbacks']is True)
  need(resume['bindings']==ready['bindings']and all(ready['bindings'][k]==a.BASELINE[k]for k in('daemon_digest','daemon_source_sha256','native_digest','native_manifest_sha256','native_compatibility_sha256')))
  return self.healthy(self.inspect(a.BASELINE['deployment_id']),a.BASELINE['deployment_id'],a.BASELINE['daemon_digest'])
 def update_environment(self,action):
  need(action['method']=='PATCH'and action['key']in('EPS_DAEMON_SOURCE_SHA256','EPS_NATIVE_COMPATIBILITY_SHA256')and action['body']=={'value':self.bindings()['environment'][action['key']]})
  parent=self.read('env.claim.json');matches=[i for i,x in enumerate(parent['actions'])if x==action];need(len(matches)==1 and len(parent['actions'])==2);name='env-'+str(matches[0]);need(self.exists(name+'.claim.json')and not self.exists(name+'.response.json'))
  before=self.environment();row=self.e.selected(before['metadata'],action['key']);need(row is not None and row['id']==action['id'])
  value=self.api('PATCH','/v9/projects/'+old.old.PROJECT+'/env/'+action['id']+'?teamId='+old.old.TEAM,action['body'])
  self.write(name+'.response.json',{'claim_sha256':self.hash(name+'.claim.json'),'response':value})
  return self.e.response(value,action)
 def save(self,action,value):
  folder=a.MAIN/a.EVIDENCE;folder.mkdir(parents=True,exist_ok=True);need(folder.resolve()==folder and not folder.is_symlink());p=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action.replace(':','-')+'.json')
  record={'schema_version':'1.0','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'purpose':a.PURPOSE,'run':self.inputs['run'],'action':action,'baseline':a.BASELINE,'bindings':self.bindings(),'DB_native_pin_preserved':a.BASELINE['native_digest'],'native_pin_mutation_performed':False,'rollback_or_AT069_performed':False,'cached_platform_health_metadata':self.cached_health,'fresh_application_heartbeat_claimed':False,'new_native_probe_claimed':False,'daemon_original_copy_outcome':'unknown','daemon_normal_copy_return_observed':False,'daemon_copy_replayed':False,**value}
  with p.open('x',encoding='utf8',newline='\n')as f:f.write(json.dumps(record,ensure_ascii=False,indent=2)+'\n');f.flush();os.fsync(f.fileno())
  return {'result':value['result'],'action':action,'receipt':p.relative_to(a.MAIN).as_posix()}
