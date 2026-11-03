"""Default-off forward sequence; no native pin phase or consumed globals edits."""
from pathlib import Path
import hashlib,importlib.util,json,sys,types
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('ocr_controller_anchors',HERE/'anchors.py');a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
old=a.frozen('worker-source-identity-release/controller.py');need=a.need
EXECUTION_ENABLED=True
PHASES=('prepare','pause','env','deploy','ready','resume')
def phases():
 # Only resume's prerequisite is projected: native3d is already pinned, so it
 # accepts the new pause directly. Every other frozen phase code is unchanged.
 file=a.GENERIC/'controller.py';need(file.is_file()and not file.is_symlink()and file.stat().st_nlink==1 and 0<file.stat().st_size<=65536);raw=file.read_bytes();need(hashlib.sha256(raw).hexdigest()==a.FROZEN['worker-source-identity-release/controller.py'])
 source=raw.decode().replace('\r\n','\n');need(source.count('def db_phase(p,phase):')==1 and source.count('def environment(p):')==1);text=source[source.index('def db_phase(p,phase):'):source.index('def environment(p):')];before="accepted_db(p,'pin'if phase=='resume'else'pause')";need(text.count(before)==1)
 projected=text.replace(before,"accepted_db(p,'pause')",1);need(projected.replace("accepted_db(p,'pause')",before,1)==text)
 namespace=dict(old.__dict__);exec(compile(projected,str(HERE/'controller.py')+':resume-prerequisite','exec'),namespace)
 for name in('normal','accepted_db','accepted_env','ready','prepare','environment','deploy'):
  f=getattr(old,name);namespace[name]=types.FunctionType(f.__code__,namespace,f.__name__,f.__defaults__,f.__closure__)
 return namespace
def operate(action,p):
 need(EXECUTION_ENABLED and(action in PHASES or action in('readback:pause','readback:resume','readback:env','readback:deploy')));c=phases()
 try:
  if action=='prepare':value=c['prepare'](p)
  elif action in('pause','resume'):value=c['db_phase'](p,action)
  elif action=='env':value=c['environment'](p)
  elif action=='deploy':value=c['deploy'](p);value['db_native_pin_retained']=a.BASELINE['native_digest']
  elif action=='ready':value={'result':'passed',**c['ready'](p,c['accepted_db'](p,'pause'))}
  else:
   phase=action.split(':')[1];claim=p.read(phase+'.claim.json');need(claim['pins']==p.pins());returned=c['normal'](p,phase)
   if phase in('pause','resume'):value={'after_sha256':old.digest(c['accepted_db'](p,phase,False)),'observed_applied':True}
   elif phase=='env':value=p.reconcile_environment(claim)
   else:value=p.reconcile_deployment(claim,returned)
   value.update(result='observed'if returned else'unconfirmed',read_only=True,normal_return_observed=returned is not None,normal_return_not_inferred=True)
 except Exception:value={'result':'unconfirmed','code':'OCR_CONFIG_PHASE_UNCONFIRMED','claim_retained':True,'automatic_replay':False,'rollback_or_AT069_performed':False}
 return p.save(action,value)
def main():
 need(EXECUTION_ENABLED and len(sys.argv)==2);p=a.module('ocr_forward_provider',HERE/'provider.py').Provider();value=operate(sys.argv[1],p);print(json.dumps(value));need(value['result']in('prepared','passed','submitted','observed'))
if __name__=='__main__':
 try:main()
 except Exception:print('OCR_CONFIG_FORWARD_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
