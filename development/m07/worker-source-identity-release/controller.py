"""Disabled new forward-only phase sequencing. Provider owns normal transports."""
from pathlib import Path
import hashlib,importlib.util,json,sys,uuid
HERE=Path(__file__).resolve().parent
EXECUTION_ENABLED=False
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
a=module('worker_identity_controller_anchors',HERE/'admission.py');need=a.need
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()
def normal(p,name):
 if not p.exists(name+'.normal.json'):return None
 value=p.read(name+'.normal.json');need(value['claim_sha256']==p.hash(name+'.claim.json')and value['normal_return_observed']is True);return value
def accepted_db(p,phase,require_normal=True):
 claim=p.read(phase+'.claim.json');need(claim['pins']==p.pins());one,two=p.snapshot(),p.snapshot();need(one==two);p.s.transition(claim['before'],one,phase)
 if require_normal:need(normal(p,phase)is not None)
 return one
def accepted_env(p,require_normal=True):
 claim=p.read('env.claim.json');need(claim['pins']==p.pins());current=claim['before']
 for i,action in enumerate(claim['actions']):
  child=p.read('env-'+str(i)+'.claim.json');need(child['before']==current and child['action']==action and child['pins']==p.pins())
  if require_normal:need(normal(p,'env-'+str(i))is not None)
  proof=p.read('env-'+str(i)+'.readback.json');need(proof['claim_sha256']==p.hash('env-'+str(i)+'.claim.json'));p.e.preserved(current,proof['after'],action);current=proof['after']
 one,two=p.environment(),p.environment();need(one==two==current);p.e.production(one,p.bindings()['environment'])
 if require_normal:need(normal(p,'env')is not None)
 return one
def ready(p,expected):
 claim=p.read('deploy.claim.json');need(claim['pins']==p.pins());returned=normal(p,'deploy');need(returned is not None);env=accepted_env(p)
 proof=p.ready(returned['value']['url'],claim['marker'])
 need(all(proof.get(key)is True for key in('new_deployment_ready','old_instances_absent','native_cleanup_confirmed','source_identities_verified'))and proof['bindings']==p.bindings())
 need(p.snapshot()==expected and p.environment()==env);return proof
def prepare(p):
 need(not p.exists('prepare.claim.json')and not p.exists('plan.json'));pins=p.pins();admission=p.admission('prepare')
 p.write('prepare.claim.json',{'pins':pins,'admission':admission,'provider_reads_only':True,'automatic_replay':False})
 first,second=p.snapshot(),p.snapshot();need(first==second);p.s.initial(first)
 before,again=p.environment(),p.environment();need(before==again);actions=p.e.actions(before,p.bindings()['environment'])
 old,again=p.old_ready(),p.old_ready();need(old==again and p.inventory()==[old['instance_id']]);checkpoint=p.checkpoint(first)
 need(p.snapshot()==first and p.environment()==before and p.pins()==pins and p.admission('prepare')==admission)
 plan={'purpose':'first_worker_separate_source_identity_release','pins':pins,'bindings':p.bindings(),'admission':admission,'before':first,'environment':before,'environment_actions':actions,'old':old,'checkpoint':checkpoint,'output':p.output(),'marker':str(uuid.uuid4())}
 p.write('plan.json',plan);return {'result':'prepared','provider_mutations':False,'before_sha256':digest(first),'checkpoint':checkpoint}
def db_phase(p,phase):
 need(phase in('pause','pin','resume')and not p.exists(phase+'.claim.json'));plan=p.read('plan.json');pins=p.pins();need(plan['pins']==pins and plan['bindings']==p.bindings())
 if phase=='pause':
  before=p.snapshot();p.s.initial(before);need(before==plan['before']and p.environment()==plan['environment']);p.old_matches(plan['old']);p.admission('pause')
 else:before=accepted_db(p,'pin'if phase=='resume'else'pause');ready(p,before)
 marker=str(uuid.uuid4());sql=p.s.render(before,phase,marker)
 p.write(phase+'.claim.json',{'phase':phase,'pins':pins,'before':before,'marker':marker,'sql_sha256':hashlib.sha256(sql.encode()).hexdigest(),'automatic_replay':False})
 need(p.pins()==pins and p.snapshot()==before);value=p.query(sql);need(value=={'phase':phase,'marker':marker})
 p.write(phase+'.normal.json',{'claim_sha256':p.hash(phase+'.claim.json'),'normal_return_observed':True,'value':value})
 after=accepted_db(p,phase);return {'result':'passed','phase':phase,'normal_return_observed':True,'two_equal_readbacks':True,'after_sha256':digest(after)}
def environment(p):
 need(not p.exists('env.claim.json'));plan=p.read('plan.json');pins=p.pins();need(plan['pins']==pins);paused=accepted_db(p,'pause');before=p.environment();need(before==plan['environment'])
 p.write('env.claim.json',{'pins':pins,'paused':paused,'before':before,'actions':plan['environment_actions'],'automatic_replay':False})
 for i,action in enumerate(plan['environment_actions']):
  name='env-'+str(i);need(not p.exists(name+'.claim.json')and p.snapshot()==paused and p.pins()==pins);current=p.environment()
  p.write(name+'.claim.json',{'pins':pins,'before':current,'action':action,'parent_claim_sha256':p.hash('env.claim.json'),'automatic_replay':False})
  value=p.update_environment(action);need(value['normal_return_observed']is True)
  p.write(name+'.normal.json',{'claim_sha256':p.hash(name+'.claim.json'),'normal_return_observed':True})
  one,two=p.environment(),p.environment();need(one==two);p.e.preserved(current,one,action);need(p.snapshot()==paused)
  p.write(name+'.readback.json',{'claim_sha256':p.hash(name+'.claim.json'),'after':one})
 p.write('env.normal.json',{'claim_sha256':p.hash('env.claim.json'),'normal_return_observed':True});value=accepted_env(p)
 return {'result':'passed','normal_return_observed':True,'environment_sha256':digest(value),'only_three_public_hash_settings':True}
def deploy(p):
 need(not p.exists('deploy.claim.json'));plan=p.read('plan.json');pins=p.pins();need(plan['pins']==pins);paused=accepted_db(p,'pause');env=accepted_env(p)
 p.old_matches(plan['old']);need(p.output()==plan['output']);p.admission('deploy')
 p.write('deploy.claim.json',{'pins':pins,'paused':paused,'environment':env,'output':plan['output'],'marker':plan['marker'],'old':plan['old'],'automatic_replay':False})
 need(p.snapshot()==paused and p.environment()==env and p.pins()==pins);value=p.deploy(plan['marker']);need(type(value)is dict and set(value)=={'url'})
 p.write('deploy.normal.json',{'claim_sha256':p.hash('deploy.claim.json'),'normal_return_observed':True,'value':value})
 return {'result':'submitted','normal_return_observed':True,'url':value['url'],'five_configs_paused':True,'db_native_pin_retained':a.OLD['native_digest'],'ready_claimed':False}
def operate(action,p):
 need(EXECUTION_ENABLED and(action in a.PHASES or action in('readback:pause','readback:pin','readback:resume','readback:env','readback:deploy')))
 try:
  if action=='prepare':value=prepare(p)
  elif action in('pause','pin','resume'):value=db_phase(p,action)
  elif action=='env':value=environment(p)
  elif action=='deploy':value=deploy(p)
  elif action=='ready':value={'result':'passed',**ready(p,accepted_db(p,'pause'))}
  else:
   phase=action.split(':')[1];claim=p.read(phase+'.claim.json');need(claim['pins']==p.pins());returned=normal(p,phase)
   if phase in('pause','pin','resume'):value={'after_sha256':digest(accepted_db(p,phase,False)),'observed_applied':True}
   elif phase=='env':value=p.reconcile_environment(claim)
   else:value=p.reconcile_deployment(claim,returned)
   value.update(result='observed'if returned else'unconfirmed',read_only=True,normal_return_observed=returned is not None,normal_return_not_inferred=True)
 except Exception:value={'result':'unconfirmed','code':'WORKER_IDENTITY_PHASE_UNCONFIRMED','claim_retained':True,'automatic_replay':False,'rollback_or_AT069_performed':False}
 return p.save(action,value)
def main():
 need(EXECUTION_ENABLED and len(sys.argv)==2)
 provider=module('worker_identity_new_provider',HERE/'provider.py');value=operate(sys.argv[1],provider.Provider());print(json.dumps(value));need(value['result']in('passed','prepared','submitted','observed'))
if __name__=='__main__':
 try:main()
 except Exception:print('WORKER_IDENTITY_RELEASE_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
