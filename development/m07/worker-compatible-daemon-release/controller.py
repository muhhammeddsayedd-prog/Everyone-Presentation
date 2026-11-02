"""Fresh forward-only namespace; reuse exact State/claims/reconciliation functions."""
from pathlib import Path
import importlib.util,json,sys
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('compatible_controller_anchors',HERE/'anchors.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
old=a.library('controller.py');need=old.need
EXECUTION_ENABLED=True

def operate(action,p):
 need(EXECUTION_ENABLED and(action in old.a.PHASES or action in('readback:pause','readback:pin','readback:resume','readback:env','readback:deploy')))
 try:
  if action=='prepare':value=old.prepare(p)
  elif action in('pause','pin','resume'):value=old.db_phase(p,action)
  elif action=='env':value=old.environment(p)
  elif action=='deploy':value=old.deploy(p)
  elif action=='ready':value={'result':'passed',**old.ready(p,old.accepted_db(p,'pause'))}
  else:
   phase=action.split(':')[1];claim=p.read(phase+'.claim.json');need(claim['pins']==p.pins());returned=old.normal(p,phase)
   if phase in('pause','pin','resume'):value={'after_sha256':old.digest(old.accepted_db(p,phase,False)),'observed_applied':True}
   elif phase=='env':value=p.reconcile_environment(claim)
   else:value=p.reconcile_deployment(claim,returned)
   value.update(result='observed'if returned else'unconfirmed',read_only=True,normal_return_observed=returned is not None,normal_return_not_inferred=True)
 except Exception:value={'result':'unconfirmed','code':'COMPATIBLE_DAEMON_PHASE_UNCONFIRMED','claim_retained':True,'automatic_replay':False,'rollback_or_AT069_performed':False}
 return p.save(action,value)

def main():
 need(EXECUTION_ENABLED and len(sys.argv)==2);provider=a.module('compatible_daemon_provider',HERE/'provider.py');value=operate(sys.argv[1],provider.Provider());print(json.dumps(value));need(value['result']in('passed','prepared','submitted','observed'))
if __name__=='__main__':
 try:main()
 except Exception:print('COMPATIBLE_DAEMON_RELEASE_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
