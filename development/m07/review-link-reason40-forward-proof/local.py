"""New guard probe only; render/compare/private diagnostics use the sealed library."""
from pathlib import Path
import importlib.util,json,sys
HERE=Path(__file__).resolve().parent;MAIN=HERE.parent/'review-link-reason40-main-diagnostics'
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
context=module('forward_owned_context_pin',MAIN/'context.py');s=context.base
file=MAIN/'local.py';s.need(s.sha(s.load(file))=='69bc50ab625e8d3b084090c2402d3886db98a69409461def04402148127ec08d');prior=module('forward_owned_frozen_main_bridge',file)
def dispatch(action,value):
 if action!='guard_current':return prior.dispatch(action,value)
 c=prior.prior.OwnedContext().bind(value['before'],value['system'],value['run'])
 try:c.check(value['observed'],False)
 except ValueError:return {'result':'refused','owned_synthetic_current_baseline_only':True,'canonical_hardbound_five_scalar_baseline_claimed':False}
 return {'result':'accepted','owned_synthetic_current_baseline_only':True,'canonical_hardbound_five_scalar_baseline_claimed':False}
if __name__=='__main__':
 try:
  s.need(len(sys.argv)==2 and sys.argv[1]in('guard_current','render','compare','diagnostic_claim','diagnose'));raw=sys.stdin.buffer.read(32*1024*1024+1);s.need(0<len(raw)<=32*1024*1024);print(json.dumps(dispatch(sys.argv[1],json.loads(raw)),sort_keys=True,separators=(',',':')))
 except Exception:print('{"result":"unconfirmed","safe_error_code":"FORWARD_LOCAL_BRIDGE_UNCONFIRMED"}',file=sys.stderr);sys.exit(1)
