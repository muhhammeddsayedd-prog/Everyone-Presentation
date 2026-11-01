"""Disabled fixed pre-deployment five-flag correction. No transport on import."""
from pathlib import Path
import datetime, importlib.util, json, os, re, sys, uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];APPLY_ENABLED=True
PURE_FALSE_SHA='a567fc8f3ca375089544ba95fc1d953a28beb72d1dc2886c486e0532e337ada6'
PRIVATE=ROOT/'.local/m07-worker38-forward-availability';PLAN=PRIVATE/'plan.json';CLAIM=PRIVATE/'apply.claim.json';RETURNED=PRIVATE/'apply.returned.json'
DEPLOY_CLAIM=ROOT/'.local/m07-specs-diagnostic-daemon38/deploy.claim.json'
CLI_PINS={'vc.js':'5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493',
 'commands-routing.js':'1314ff6bb482b556ac540e12bf87d899b15e2e30ed1c907e54d5b664dea5ba90',
 'commands-deployments.js':'5309d52278f46cf3cd7764690873038b4054c0b702ff885b9878a67ee6ff218a',
 'chunks/chunk-CJHVHB2F.js':'c9301bc282bed45b0d8b127bf70cbc951c9d2ccf00be71289b331560445d03a0',
 'chunks/chunk-OLAG7Y3P.js':'96356f41ba1d0a364761c04470e831dea6365ca51744f19d4dc710c728927b52',
 'chunks/chunk-2PYFJXKS.js':'f19e025f07602444e832f4096c829928959f5a315ab09048c66f8505277d189b'}

def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

f=module('availability38_pure_contract',HERE/'availability.py');need=f.need;s=f.s
a=module('availability38_normal_canonical_queries',s.HERE/'adoption.py')
m=module('availability38_public_environment_reads',s.HERE/'manifest.py')

def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':')).encode()
def same_admission(left,right):need(left==right and left['target']==s.TARGET)

def pins():
 raw=s.load(HERE/'availability.py');old=b'RENDER_ENABLED = False';armed=b'RENDER_ENABLED = True'
 need(raw.count(old)+raw.count(armed)==1 and s.sha(raw.replace(armed,old))==PURE_FALSE_SHA)
 value=a.source_pins()
 for name in ('availability.py','test_availability.py','README.md','driver.py','test_driver.py'):value[(HERE/name).relative_to(ROOT).as_posix()]=s.sha(s.load(HERE/name))
 for name,digest in CLI_PINS.items():need(s.sha(s.load(m.CLI.parent/name))==digest);value['cli/'+name]=digest
 need(s.sha(s.load(m.NODE,128*1024**2))=='9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de')
 return dict(sorted(value.items()))

def private_write(path,value):
 need(path.parent==PRIVATE);PRIVATE.mkdir(parents=True,exist_ok=True);guard=s.s.b.security()
 with guard.create(path)as stream:guard.verify_open(stream);stream.write((json.dumps(value,sort_keys=True)+'\n').encode());stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)

def private_read(path):s.s.b.security().verify(path);return json.loads(s.load(path))

def worker_projection(value,now):
 # The pinned CLI inspects the CURRENT production daemon. Its deploymentId is
 # the active production descriptor, independently read on each invocation.
 context=value['context'];row=value['daemon'];config=row['config'];counts=row['instances']
 need(context['project']['id']==s.PROJECT and context['project']['name']=='everyone-presentation-worker-pilot'
  and context['team']['id']==s.TEAM and context['team']['slug']=='muhammed-abdelrahman'and context['environment']=='production'
  and row['name']=='worker'and row['deploymentId']==f.OLD_DEPLOYMENT and value['scalingOverridden']is False)
 def image(raw):
  need(type(raw)is str and raw in(f.OLD_DAEMON,'muhammed-abdelrahman/everyone-presentation-worker-pilot/daemon@'+f.OLD_DAEMON,'vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/daemon@'+f.OLD_DAEMON));return {'digest':f.OLD_DAEMON}
 def time(raw):
  if type(raw)is int:return raw
  need(type(raw)is str);return int(datetime.datetime.fromisoformat(raw.replace('Z','+00:00')).timestamp()*1000)
 instances=[{'id':v['id'],'alive':v['alive'],'image':image(v['image']),'region':v['region'],'memory_mib':v['memoryMiB'],
  'started_at_ms':time(v['startedAt']),'last_checked_at_ms':time(v['lastCheckedAt']),'stopped_at_ms':None if v.get('stoppedAt')is None else time(v['stoppedAt'])}for v in counts['items']]
 need(config['resources']['requests']['memory']in('2Gi','2048Mi'))
 worker={'project_id':s.PROJECT,'team_id':s.TEAM,'daemon':'worker','environment':'production','deployment_id':row['deploymentId'],'status':row['status'],
  'requested_image':image(config['image']['requested']),'resolved_image':image(config['image']['resolved']),'configured_instances':config['instances'],
  'configured_override':config.get('configuredInstances'),'memory_mib':2048,'termination_grace_seconds':config['terminationGracePeriodSeconds'],
  **{key:counts[key]for key in('desired','ready','total')},'instances':instances}
 result={'observed_at':now.isoformat(),'project_id':s.PROJECT,'team_id':s.TEAM,'active_production_deployment_id':row['deploymentId'],'worker':worker}
 f.worker(result,now);return result

class Ports:
 def now(self):return datetime.datetime.now(datetime.timezone.utc)
 def pins(self):return pins()
 def admission(self):return a.admission('manifest')
 def snapshot(self):return a.read_snapshot()
 def dispatch_absent(self):return not DEPLOY_CLAIM.exists()
 def exists(self,path):return path.exists()
 def write(self,path,value):private_write(path,value)
 def read(self,path):return private_read(path)
 def hash(self,path):return s.sha(s.load(path))
 def query(self,sql):
  anchor='as worker38_availability;';need(sql.count(anchor)==1)
  return a.query(sql.replace(anchor,'as worker38_adoption;'))
 def worker(self):
  need(self.dispatch_absent());reader=s.s.module('availability38_bounded_read_cli',ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py')
  env={key:os.environ[key]for key in('SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG')if key in os.environ}
  env.update(PATH='',NODE_ENV='production',CI='1',VERCEL_TELEMETRY_DISABLED='1',VERCEL_CLI_USE_NATIVE_BINARY='0')
  command=[str(m.NODE),str(m.CLI),'daemons','inspect','worker','--project',s.PROJECT,'--json','--scope','muhammed-abdelrahman','--global-config',m.GLOBAL]
  code,timeout,overflow,stdout,_=reader.bounded(command,env);need(code==0 and timeout is False and overflow is False)
  return worker_projection(json.loads(stdout),self.now())
 def environment(self):return {'observed_at':stamp(),'project_id':s.PROJECT,'team_id':s.TEAM,'current':m.observe()}
 def pause_plan(self):return a.private_read(a.PRIVATE/'pause.plan.json')
 def pause(self):
  path=a.PRIVATE/'pause.claim.json';value=a.private_read(path);raw=s.load(path);need(json.loads(raw)==value)
  return raw,a.private_read(a.PRIVATE/'pause.returned.json')
 def save(self,phase,value):
  folder=ROOT/'tracking/evidence/m07/worker38-forward-availability';folder.mkdir(parents=True,exist_ok=True)
  path=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+phase+'.json')
  with path.open('x',encoding='utf8',newline='\n')as stream:json.dump({'schema_version':'1.0','observed_at':stamp(),'phase':phase,'target':s.TARGET,'project_id':s.PROJECT,
   'vercel_mutations':False,'daemon_deployment_or_rollback_performed':False,'source_pins':self.pins(),**value},stream,sort_keys=True,indent=2);stream.write('\n')
  return {'result':value['result'],'receipt':path.relative_to(ROOT).as_posix()}

def gate():need(APPLY_ENABLED and f.RENDER_ENABLED is True)
def observations(p):return [p.worker(),p.worker()],[p.environment(),p.environment()]

def prepare(p):
 gate();need(not p.exists(PLAN)and not p.exists(CLAIM)and p.dispatch_absent());sealed=p.pins();accepted=p.admission();before=p.snapshot();pause=p.pause_plan()
 s.phase_before(before,'pause',accepted['new_native_image_id']);need(pause['phase']=='pause'and pause['before']==before and pause['source_pins']==a.source_pins());same_admission(pause['admission'],accepted)
 workers,environments=observations(p);now=p.now();need(f.worker(workers[0],now)==f.worker(workers[1],now))
 for value in environments:f.fresh(value['observed_at'],now);f.environment(value['current']);need(value['current']['manifest_sha256']==s.OLD_MANIFEST)
 need(environments[0]['current']==environments[1]['current']and p.snapshot()==before and p.pins()==sealed and p.dispatch_absent())
 plan={'source_pins':sealed,'admission':accepted,'before':before,'environment_before':environments[0]['current'],'plan_id':str(uuid.uuid4())}
 p.write(PLAN,plan);return p.save('prepare',{'result':'prepared_before_pause','plan_sha256':p.hash(PLAN),'public_environment_values_saved':False})

def checked(p):
 plan=p.read(PLAN);need(plan['source_pins']==p.pins()and p.dispatch_absent());same_admission(plan['admission'],p.admission());return plan

def evidence(p,plan):
 raw,returned=p.pause();claim=json.loads(raw);need(claim['before']==plan['before']and claim['source_pins']==a.source_pins());same_admission(claim['admission'],plan['admission'])
 workers,environments=observations(p)
 return {'pause_claim_bytes':raw,'pause_returned':returned,'old_worker':workers,'environment_before':plan['environment_before'],
  'environment':environments,'new_manifest_sha256':plan['admission']['new_manifest_sha256'],'new_deployment_dispatch_claim_absent':p.dispatch_absent()}

def apply(p):
 gate();need(not p.exists(CLAIM)and not p.exists(RETURNED));plan=checked(p);before=p.snapshot();proof=evidence(p,plan);f.expected(before,proof,p.now())
 marker=str(uuid.uuid4());p.write(CLAIM,{'plan_sha256':p.hash(PLAN),'source_pins':plan['source_pins'],'before':before,'marker':marker,'dispatch_may_have_occurred':True,'automatic_retry':False})
 normal=False
 try:
  need(checked(p)==plan and p.snapshot()==before);proof=evidence(p,plan);sql=f.render(before,proof,marker,p.now())
  need(p.query(sql)=={'phase':'old_flags','marker':marker})
  p.write(RETURNED,{'claim_sha256':p.hash(CLAIM),'normal_return_marker_observed':True})
  normal=True
 except Exception:pass
 return finish(p,normal)

def finish(p,normal=None):
 gate();plan=checked(p);claim=p.read(CLAIM);need(claim['plan_sha256']==p.hash(PLAN)and claim['source_pins']==plan['source_pins']and claim['dispatch_may_have_occurred']is True and claim['automatic_retry']is False)
 if normal is None:normal=p.exists(RETURNED)and p.read(RETURNED)=={'claim_sha256':p.hash(CLAIM),'normal_return_marker_observed':True}
 verified=False
 try:
  first,second=p.snapshot(),p.snapshot();need(first==second);proof=evidence(p,plan);f.transition(claim['before'],first,proof,p.now());need(checked(p)==plan);verified=True
 except Exception:pass
 return p.save('readback',{'result':'passed'if normal and verified else'unconfirmed','normal_return_marker_observed':bool(normal),
  'two_equal_preserving_readbacks':verified,'claim_retained':True,'automatic_retry':False,'old_native_pin_retained':verified,'five_flags_restored':verified})

def main():
 gate();need(len(sys.argv)==2 and sys.argv[1]in('prepare','apply','readback'));p=Ports();value={'prepare':prepare,'apply':apply,'readback':finish}[sys.argv[1]](p);print(json.dumps(value))
if __name__=='__main__':
 try:main()
 except Exception:print('WORKER38_FORWARD_AVAILABILITY_UNCONFIRMED');sys.exit(1)
