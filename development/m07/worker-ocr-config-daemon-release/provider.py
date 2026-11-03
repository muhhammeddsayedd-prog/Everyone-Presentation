"""Fresh current6o adapter; same reviewed normal CLI, custody and full State."""
from pathlib import Path
import datetime,importlib.util,json,os,re
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ocr_provider_anchors',HERE/'anchors.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
old=a.frozen('worker-compatible-daemon-release/provider.py');s=old.s;need=a.need
state=a.module('ocr_forward_state',HERE/'state.py');env=a.module('ocr_forward_environment',HERE/'environment.py')
def builder():
 return a.builder()
def validate_inputs(value):
 old.validate_inputs(value);need(value['run']!='cd917d16-2d3d-4915-9d65-364d1edf4fe9'and value['source']['source_sha256']!=a.BASELINE['daemon_source_sha256']and value['daemon']['digest']!=a.BASELINE['daemon_digest']);return value

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
  record={'schema_version':'1.0','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'purpose':a.PURPOSE,'run':self.inputs['run'],'action':action,'baseline':a.BASELINE,'bindings':self.bindings(),'DB_native_pin_preserved':a.BASELINE['native_digest'],'native_pin_mutation_performed':False,'rollback_or_AT069_performed':False,'cached_platform_health_metadata':self.cached_health,'fresh_application_heartbeat_claimed':False,'new_native_probe_claimed':False,**value}
  with p.open('x',encoding='utf8',newline='\n')as f:f.write(json.dumps(record,ensure_ascii=False,indent=2)+'\n');f.flush();os.fsync(f.fileno())
  return {'result':value['result'],'action':action,'receipt':p.relative_to(a.MAIN).as_posix()}
