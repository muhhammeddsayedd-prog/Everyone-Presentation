"""Observe unknown env1; dispatch only unattempted env2. No consumed file edits."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,types
HERE=Path(__file__).resolve().parent
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
BASE=MAIN/'development/m07/worker-compatible-daemon-release'
FROZEN={
 'anchors.py':'29082b95b2d003fd727d87e7e6a416171096e2d39da44056009c37c0090e0a43',
 'provider.py':'2a663f05af131099f199fd1b7e137be06571518a73985c3b3befc2e562995d1b',
 'controller.py':'003c5bdbe206fd2873da7276e7c78b8b9abf4422a9a9ea57b4826a54d9ccdd88',
 'startup.py':'e3ba87d90f92975a3b1d38370b089033cc987f26fb92cbf3b5a67e94460f1366',
 'registry.py':'5d4c46197109513bcd99c26c6d8d179837e34a3326c8797000d2d0db7e8d2b40'}
RUN='cd917d16-2d3d-4915-9d65-364d1edf4fe9'
PRIOR_ENV='a55fac74159fe0d7a50a11ef9b4beb1a894b8e5cd4e9aeb12f5170136e9be7ff'
PRIOR_ENV1='0c494b95601690aca8038afa779a862cbd1eec2c08c05763047af6aeb43ffe35'
KEYS=('EPS_NATIVE_MANIFEST_SHA256','EPS_DAEMON_SOURCE_SHA256','EPS_NATIVE_COMPATIBILITY_SHA256')
PROJECT='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1'
sha=lambda raw:hashlib.sha256(raw).hexdigest()

def need(value):
 if not value:raise ValueError('ENV_FORWARD_REFUSED')

def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

def libraries():
 for name,digest in FROZEN.items():
  file=BASE/name;need(file.is_file()and not file.is_symlink()and file.resolve()==file and file.stat().st_nlink==1 and sha(file.read_bytes())==digest)
 p=module('env_forward_frozen_provider',BASE/'provider.py')
 return p,p.a.library('controller.py')

def source_pins():
 result={}
 for file in sorted(HERE.iterdir()):
  if file.is_file()and file.suffix in('.py','.md','.json'):
   need(not file.is_symlink()and file.stat().st_nlink==1);result[file.name]=sha(file.read_bytes())
 need('forward.py'in result and 'controller.py'in result);return result

def created_response(value,action):
 # Official v10 single-object POST: {created: object, failed: []}, not envs[].
 need(type(value)is dict and value.get('failed')==[] and type(value.get('created'))is dict)
 row=value['created'];need(type(row.get('id'))is str and 0<len(row['id'])<=128)
 need(row.get('key')==action['key']and row.get('value')==action['body']['value']and row.get('type')=='plain'and row.get('target')==['production'])
 return {'normal_return_observed':True}

class Store:
 def __init__(self,p):
  need(p.inputs['run']==RUN);self.p=p;self.private=MAIN/'.local/worker-compatible-daemon-env-forward'/RUN
 def path(self,name):
  need(name in('owner.json','environment.claim.json','observed-adoption.json','remaining.claim.json','remaining.response.json','remaining.normal.json','remaining.readback.json','environment.normal.json'));return self.private/name
 def exists(self,name):return self.path(name).exists()
 def read(self,name):
  file=self.path(name);self.p.guard.verify(file);return json.loads(self.p.s.load(file))
 def hash(self,name):
  file=self.path(name);self.p.guard.verify(file);return sha(self.p.s.load(file))
 def check(self):need(self.read('owner.json')=={'purpose':'unknown_env1_observed_unattempted_env2_forward','run':RUN,'source_pins':source_pins()})
 def write(self,name,value):
  if not self.private.exists():
   self.private.mkdir(parents=True,exist_ok=False);need(self.private.resolve()==self.private and not self.private.is_symlink());self._create('owner.json',{'purpose':'unknown_env1_observed_unattempted_env2_forward','run':RUN,'source_pins':source_pins()})
  self.check();self._create(name,value)
 def _create(self,name,value):
  raw=(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n').encode();need(0<len(raw)<=16*1024**2)
  with self.p.guard.create(self.path(name))as stream:
   self.p.guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());self.p.guard.verify_open(stream)

def prior(p,c):
 need(p.hash('env.claim.json')==PRIOR_ENV and p.hash('env-1.claim.json')==PRIOR_ENV1)
 parent=p.read('env.claim.json');pins=p.pins();need(parent['pins']==pins and [a['key']for a in parent['actions']]==list(KEYS))
 actions=parent['actions'];need([a['method']for a in actions]==['PATCH','POST','POST'])
 current=parent['before']
 for index in(0,1):
  child=p.read('env-'+str(index)+'.claim.json');need(child['pins']==pins and child['before']==current and child['action']==actions[index]and child['parent_claim_sha256']==PRIOR_ENV)
  if index==0:
   need(c.normal(p,'env-0')is not None);proof=p.read('env-0.readback.json');need(proof['claim_sha256']==p.hash('env-0.claim.json'));p.e.preserved(current,proof['after'],actions[0]);current=proof['after']
 need(not p.exists('env-1.normal.json')and not p.exists('env-1.readback.json')and not p.exists('env-2.claim.json')and not p.exists('env.normal.json'))
 need(actions[2]['body']=={'key':KEYS[2],'value':p.bindings()['environment'][KEYS[2]],'type':'plain','target':['production']})
 return parent,current,actions

def complete_environment(p,c,store):
 need(not store.exists('environment.claim.json'))
 parent,after0,actions=prior(p,c);paused=c.accepted_db(p,'pause');need(paused==parent['paused'])
 one,two=p.environment(),p.environment();need(one==two and one!=after0);p.e.preserved(after0,one,actions[1])
 need(p.snapshot()==paused and p.pins()==parent['pins'])
 store.write('environment.claim.json',{'source_pins':source_pins(),'prior_env_claim':PRIOR_ENV,'prior_env1_claim':PRIOR_ENV1,'paused':paused,'observed_environment':one,'remaining_action':actions[2],'automatic_replay':False})
 store.write('observed-adoption.json',{'claim_sha256':store.hash('environment.claim.json'),'env1_as_observed_only':True,'env1_normal_return_observed':False,'env1_replayed':False,'after':one})
 need(p.snapshot()==paused and p.environment()==one and p.pins()==parent['pins']);prior(p,c);store.check()
 store.write('remaining.claim.json',{'source_pins':source_pins(),'environment_claim_sha256':store.hash('environment.claim.json'),'before':one,'action':actions[2],'automatic_replay':False})
 action=actions[2];endpoint='/v10/projects/'+PROJECT+'/env?teamId='+TEAM
 value=p.api('POST',endpoint,action['body'])
 store.write('remaining.response.json',{'claim_sha256':store.hash('remaining.claim.json'),'response':value})
 created_response(value,action);store.check()
 store.write('remaining.normal.json',{'claim_sha256':store.hash('remaining.claim.json'),'response_sha256':store.hash('remaining.response.json'),'normal_return_observed':True})
 after,again=p.environment(),p.environment();need(after==again);p.e.preserved(one,after,action);p.e.production(after,p.bindings()['environment'])
 need(p.snapshot()==paused and p.pins()==parent['pins']);prior(p,c)
 store.write('remaining.readback.json',{'claim_sha256':store.hash('remaining.claim.json'),'after':after})
 store.write('environment.normal.json',{'claim_sha256':store.hash('environment.claim.json'),'remaining_normal_sha256':store.hash('remaining.normal.json'),'normal_remaining_return_observed':True,'env1_normal_return_observed':False})
 accepted_environment(p,c,store)
 return {'result':'passed','env1_as_observed_only':True,'env1_normal_return_observed':False,'env1_replayed':False,'remaining_normal_return_observed':True,'two_equal_readbacks':True}

def accepted_environment(p,c,store):
 store.check();parent,_,actions=prior(p,c);claim=store.read('environment.claim.json');need(claim['source_pins']==source_pins()and claim['prior_env_claim']==PRIOR_ENV and claim['prior_env1_claim']==PRIOR_ENV1)
 observed=store.read('observed-adoption.json');need(observed['claim_sha256']==store.hash('environment.claim.json')and observed['env1_as_observed_only']is True and observed['env1_normal_return_observed']is False and observed['env1_replayed']is False and observed['after']==claim['observed_environment'])
 _,after0,_=prior(p,c);p.e.preserved(after0,observed['after'],actions[1])
 child=store.read('remaining.claim.json');need(child['source_pins']==source_pins()and child['environment_claim_sha256']==store.hash('environment.claim.json')and child['before']==observed['after']and child['action']==actions[2])
 response=store.read('remaining.response.json');need(response['claim_sha256']==store.hash('remaining.claim.json'));created_response(response['response'],actions[2])
 returned=store.read('remaining.normal.json');need(returned['claim_sha256']==store.hash('remaining.claim.json')and returned['response_sha256']==store.hash('remaining.response.json')and returned['normal_return_observed']is True)
 proof=store.read('remaining.readback.json');need(proof['claim_sha256']==store.hash('remaining.claim.json'));p.e.preserved(child['before'],proof['after'],actions[2])
 normal=store.read('environment.normal.json');need(normal=={'claim_sha256':store.hash('environment.claim.json'),'remaining_normal_sha256':store.hash('remaining.normal.json'),'normal_remaining_return_observed':True,'env1_normal_return_observed':False})
 one,two=p.environment(),p.environment();need(one==two==proof['after']and p.pins()==parent['pins']);p.e.production(one,p.bindings()['environment']);return one

class FuturePort:
 """Preserve old pins; append/require new seals only on genuinely future claims."""
 CLAIMS=('deploy.claim.json','pin.claim.json','resume.claim.json')
 def __init__(self,p,store):self.p=p;self.store=store
 def __getattr__(self,name):return getattr(self.p,name)
 def write(self,name,value):
  self.store.check()
  if name in self.CLAIMS:value={**value,'env_forward_source_pins':source_pins(),'env_forward_claim_sha256':self.store.hash('environment.claim.json')}
  return self.p.write(name,value)
 def read(self,name):
  value=self.p.read(name)
  if name in self.CLAIMS:
   self.store.check();need(value['env_forward_source_pins']==source_pins()and value['env_forward_claim_sha256']==self.store.hash('environment.claim.json'))
  return value

def functions(c,store):
 # Same immutable code objects, separate globals. Never mutate a frozen module.
 namespace=dict(c.__dict__);namespace['accepted_env']=lambda p,require_normal=True:accepted_environment(p,c,store)
 for name in('ready','db_phase','deploy'):
  original=getattr(c,name);namespace[name]=types.FunctionType(original.__code__,namespace,original.__name__,original.__defaults__,original.__closure__)
 return namespace

def save(p,action,value):
 folder=MAIN/'tracking/evidence/m07/worker-compatible-daemon-env-forward';folder.mkdir(parents=True,exist_ok=True);need(folder.resolve()==folder and not folder.is_symlink())
 record={'schema_version':'1.0','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'run':RUN,'action':action,'source_pins':source_pins(),'prior_env_claim_sha256':PRIOR_ENV,'prior_env1_claim_sha256':PRIOR_ENV1,'env1_normal_return_observed':False,'env1_replayed':False,'bindings':p.bindings(),'rollback_or_AT069_performed':False,**value}
 file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action.replace(':','-')+'.json')
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(record,ensure_ascii=False,indent=2)+'\n');stream.flush();os.fsync(stream.fileno())
 return {'result':value['result'],'receipt':file.relative_to(MAIN).as_posix()}
