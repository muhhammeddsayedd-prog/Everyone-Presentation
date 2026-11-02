"""New default-off continuation; env1 is never submitted or marked normal."""
from pathlib import Path
import importlib.util,json,sys
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('compatible_env_forward',HERE/'forward.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
EXECUTION_ENABLED=False

def operate(action,p,c,store):
 f.need(EXECUTION_ENABLED and action in('complete-env','deploy','ready','pin','resume','readback:deploy','readback:pin','readback:resume'))
 try:
  if action=='complete-env':value=f.complete_environment(p,c,store)
  else:
   f.accepted_environment(p,c,store);port=f.FuturePort(p,store);functions=f.functions(c,store)
   if action in('pin','resume'):value=functions['db_phase'](port,action)
   elif action=='deploy':value=functions['deploy'](port)
   elif action=='ready':value={'result':'passed',**functions['ready'](port,c.accepted_db(port,'pause'))}
   else:
    phase=action.split(':')[1];claim=port.read(phase+'.claim.json');f.need(claim['pins']==port.pins());returned=c.normal(port,phase)
    value={'after_sha256':c.digest(c.accepted_db(port,phase,False)),'observed_applied':True}if phase in('pin','resume')else port.reconcile_deployment(claim,returned)
    value.update(result='observed'if returned else'unconfirmed',read_only=True,normal_return_observed=returned is not None,normal_return_not_inferred=True)
  store.check()
 except Exception:value={'result':'unconfirmed','code':'ENV_FORWARD_UNCONFIRMED','claim_retained':True,'automatic_replay':False}
 return f.save(p,action,value)

def main():
 f.need(EXECUTION_ENABLED and len(sys.argv)==2);provider,c=f.libraries();p=provider.Provider();result=operate(sys.argv[1],p,c,f.Store(p));print(json.dumps(result));f.need(result['result']in('passed','submitted','observed'))
if __name__=='__main__':
 try:main()
 except Exception:print('ENV_FORWARD_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
