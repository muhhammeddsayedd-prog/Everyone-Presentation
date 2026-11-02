"""NEW disabled forward worker rollout, one claim per actual mutation.

The provider adapter owns bounded normal transport; this file owns sequencing.
"""
from pathlib import Path
import copy,importlib.util,json,sys,uuid
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('completion39_controller_state',HERE/'state.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
ROLLOUT_ENABLED=False
need=s.need
DB_PHASES=('pause','pin','resume','unwind')

def normal(p,phase):
 file=phase+'.normal.json'
 if not p.exists(file):return None
 value=p.read(file);need(value['claim_sha256']==p.hash(phase+'.claim.json')and value['normal_return_observed']is True)
 return value

def accepted_db(p,state,phase):
 claim=p.read(phase+'.claim.json');need(claim['pins']==p.pins())
 one,two=p.snapshot(),p.snapshot();need(one==two);state.transition(claim['before'],one,phase)
 normal(p,phase)or need(False)
 return one

def accepted_environment(p):
 claim=p.read('env.claim.json');need(claim['pins']==p.pins());normal(p,'env')or need(False)
 value=p.env_proof(claim);p.e.production(value);return value

def check_ready(p,state,expected):
 deployment=p.read('deploy.claim.json');need(deployment['pins']==p.pins());returned=normal(p,'deploy');need(returned is not None)
 env=accepted_environment(p);proof=p.ready(returned['value']['url'],deployment['marker'])
 need(proof['new_deployment_ready']is True and proof['old_instances_absent']is True and proof['native_cleanup_confirmed']is True
  and proof['source_sha256']==s.SOURCE and proof['native_digest']==s.NATIVE and proof['daemon_digest']==s.DAEMON and proof['manifest_sha256']==s.MANIFEST)
 need(p.snapshot()==expected and p.environment()==env);return proof

def prepare(p,state):
 need(not p.exists('prepare.claim.json')and not p.exists('plan.json'))
 pins=p.pins();admission=p.admission('prepare');p.write('prepare.claim.json',{'pins':pins,'admission':admission,'provider_reads_only':True})
 first,second=p.snapshot(),p.snapshot();need(first==second);state.initial(first)
 before,again=p.environment(),p.environment();need(before==again);actions=p.e.actions(before)
 old,again=p.old_ready(),p.old_ready();need(old==again and p.inventory()==[old['instance_id']])
 checkpoint=p.checkpoint(first);need(p.snapshot()==first)
 output=p.output();need(p.pins()==pins and p.admission('prepare')==admission)
 plan={'purpose':'completion-worker-production39','pins':pins,'admission':admission,'checkpoint':checkpoint,'before':first,'environment':before,'environment_actions':actions,'old':old,'output':output,'marker':str(uuid.uuid4())}
 p.write('plan.json',plan)
 return {'result':'prepared','provider_mutations':False,'baseline_sha256':s.sha(json.dumps(first,sort_keys=True).encode()),'environment_metadata_sha256':s.sha(json.dumps(before,sort_keys=True).encode()),'old_instance_id':old['instance_id']}

def db_phase(p,state,phase):
 need(phase in DB_PHASES and not p.exists(phase+'.claim.json'))
 plan=p.read('plan.json');pins=p.pins();need(plan['pins']==pins)
 if phase=='pause':
  before=p.snapshot();state.initial(before);need(before==plan['before']);p.admission('pause');need(p.environment()==plan['environment']);p.old_matches(plan['old']);p.before_pause_availability(plan)
 else:
  before=accepted_db(p,state,'pin'if phase=='resume'else'pause')
  if phase in('pin','resume'):check_ready(p,state,before)
  else:
   # Any dispatch claim, including an unknown outcome, permanently closes the
   # pre-dispatch availability branch. This never deploys/rolls back anything.
   need(not p.exists('deploy.claim.json'));p.old_matches(plan['old']);p.unwind_environment(plan)
 marker=str(uuid.uuid4());sql=state.render(before,phase,marker)
 claim={'phase':phase,'pins':pins,'before':before,'marker':marker,'sql_sha256':s.sha(sql.encode()),'dispatch_may_have_occurred':True,'automatic_retry':False}
 p.write(phase+'.claim.json',claim)
 need(p.pins()==pins and p.snapshot()==before)
 returned=p.query(sql);need(returned=={'phase':phase,'marker':marker})
 p.write(phase+'.normal.json',{'claim_sha256':p.hash(phase+'.claim.json'),'normal_return_observed':True,'value':returned})
 after=accepted_db(p,state,phase);need(p.pins()==pins)
 return {'result':'passed','phase':phase,'normal_return_observed':True,'two_equal_readbacks':True,'after_sha256':s.sha(json.dumps(after,sort_keys=True).encode()),'only_future_frame_pin_changed':phase=='pin','five_flags_only':phase!='pin'}

def env_phase(p,state):
 need(not p.exists('env.claim.json'));plan=p.read('plan.json');pins=p.pins();need(plan['pins']==pins)
 paused=accepted_db(p,state,'pause');before=p.environment();need(before==plan['environment'])
 claim={'pins':pins,'paused':paused,'before':before,'actions':plan['environment_actions'],'dispatch_may_have_occurred':True,'automatic_retry':False};p.write('env.claim.json',claim)
 for index,action in enumerate(claim['actions']):
  current=p.environment();need(p.snapshot()==paused and p.pins()==pins)
  name='env-'+str(index);need(not p.exists(name+'.claim.json'));p.write(name+'.claim.json',{'pins':pins,'before':current,'action':action,'parent_claim_sha256':p.hash('env.claim.json'),'automatic_retry':False})
  result=p.update_environment(action);need(result['normal_return_observed']is True)
  p.write(name+'.normal.json',{'claim_sha256':p.hash(name+'.claim.json'),'normal_return_observed':True,'value':result})
  one,two=p.environment(),p.environment();need(one==two);p.e.preserved(current,one,action)
  need(p.snapshot()==paused)
 p.write('env.normal.json',{'claim_sha256':p.hash('env.claim.json'),'normal_return_observed':True})
 value=accepted_environment(p);need(p.snapshot()==paused)
 return {'result':'passed','normal_return_observed':True,'new_record_only_if_absent':'APP_ENV','public_mode_manifest_only':True,'same_ids_and_private_preview_metadata_preserved':True,'environment_sha256':s.sha(json.dumps(value,sort_keys=True).encode())}

def deploy(p,state):
 need(not p.exists('deploy.claim.json'));plan=p.read('plan.json');pins=p.pins();need(plan['pins']==pins)
 paused=accepted_db(p,state,'pause');env=accepted_environment(p);p.old_matches(plan['old']);need(p.output()==plan['output']);p.admission('deploy')
 claim={'pins':pins,'paused':paused,'environment':env,'output':plan['output'],'marker':plan['marker'],'old':plan['old'],'dispatch_may_have_occurred':True,'automatic_retry':False};p.write('deploy.claim.json',claim)
 need(p.snapshot()==paused and p.environment()==env and p.pins()==pins)
 value=p.deploy(plan['marker']);need(type(value)is dict and set(value)=={'url'})
 p.write('deploy.normal.json',{'claim_sha256':p.hash('deploy.claim.json'),'normal_return_observed':True,'value':value})
 return {'result':'submitted','normal_return_observed':True,'url':value['url'],'db_native_pin_retained':s.OLD_NATIVE,'five_configs_remain_paused':True,'ready_or_startup_claimed':False}

def operate(action,p,state):
 need(ROLLOUT_ENABLED);need(action in('prepare',*DB_PHASES,'env','deploy','ready')or action.startswith('readback:'))
 try:
  if action=='prepare':result=prepare(p,state)
  elif action in DB_PHASES:result=db_phase(p,state,action)
  elif action=='env':result=env_phase(p,state)
  elif action=='deploy':result=deploy(p,state)
  elif action=='ready':
   paused=accepted_db(p,state,'pause');proof=check_ready(p,state,paused)
   result={'result':'passed',**proof}
  else:
   phase=action.split(':')[1];need(phase in(*DB_PHASES,'env','deploy'));claim=p.read(phase+'.claim.json');need(claim['pins']==p.pins());returned=normal(p,phase)
   if phase in DB_PHASES:
    one,two=p.snapshot(),p.snapshot();need(one==two);state.transition(claim['before'],one,phase)
    result={'result':'passed'if returned else'unconfirmed','observed_applied':True,'after_sha256':s.sha(json.dumps(one,sort_keys=True).encode())}
   elif phase=='env':result={'result':'passed'if returned else'unconfirmed',**p.reconcile_environment(claim)}
   else:result={'result':'observed'if returned else'unconfirmed',**p.reconcile_deployment(claim,returned)}
   result.update(phase=phase,read_only=True,normal_return_observed=returned is not None,normal_return_not_inferred=True)
 except Exception:
  result={'result':'unconfirmed','code':'COMPLETION39_PHASE_UNCONFIRMED','claim_retained':True,'automatic_retry':False,'provider_rollback_or_AT069_performed':False}
 return p.save(action,result)

def main():
 need(ROLLOUT_ENABLED and len(sys.argv)==2)
 module=s.module('completion39_new_bounded_provider',HERE/'provider.py');p=module.Provider();value=operate(sys.argv[1],p,p.s);print(json.dumps(value))
 if value['result']not in('passed','prepared','submitted','observed'):raise ValueError('COMPLETION39_UNCONFIRMED')
if __name__=='__main__':
 try:main()
 except Exception:print('COMPLETION39_UNCONFIRMED');sys.exit(1)
