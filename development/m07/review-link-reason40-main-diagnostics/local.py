"""Main-scoped private artifacts; frozen SQL/render/compare are delegated."""
from pathlib import Path
import importlib.util,json,os,sys
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
projection=module('reason40_main_private_context',HERE/'context.py');s=projection.base
file=projection.ACL/'local.py';s.need(s.sha(s.load(file))=='a8a5536a6c8364cf0ea349b7400c94a002c6f3a38fa6105eed55fe063223e596');prior=module('reason40_main_frozen_diagnostic_library',file)
def folder(c,run):
 s.need(str(__import__('uuid').UUID(run))==run);value=c.root/'.local/reason40-main-diagnostics'/run;s.need(value.resolve()==value and value.is_relative_to(c.root));return value
def write_private(c,run,name,value):
 s.need(name in('diagnostic.claim.json','diagnostic-poststate.json'));directory=folder(c,run)
 if name=='diagnostic.claim.json':directory.mkdir(parents=True,exist_ok=False)
 s.need(directory.is_dir());path=directory/name;data=prior.raw(value);s.need(len(data)<=s.MAXIMUM);guard=c.b.security()
 with guard.create(path)as stream:guard.verify_open(stream);stream.write(data);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 guard.verify(path);s.need(s.load(path)==data);return {'workspace':'Main','path':path.relative_to(c.root).as_posix(),'sha256':s.sha(data),'scope':'owned_diagnostic_rollback_poststate','canonical_checkpoint':False}
def dispatch(action,value):
 if action in('render','compare'):return prior.dispatch(action,value)
 s.need(action in('diagnostic_claim','diagnose'));c=prior.OwnedContext().bind(value['before'],value['system'],value['run']);expected=c.expected(value['before']);claim_value={'run':value['run'],'before_sha256':s.sha(prior.raw(value['before'])),'expected_sha256':s.sha(prior.raw(expected)),'dispatch_may_have_occurred':True,'automatic_retry':False}
 if action=='diagnostic_claim':return {'result':'claimed','claim':write_private(c,value['run'],'diagnostic.claim.json',claim_value)}
 claim=folder(c,value['run'])/'diagnostic.claim.json';c.b.security().verify(claim);s.need(json.loads(s.load(claim))==claim_value);observed=value['observed'];s.need(type(observed)is dict and set(observed)=={'state','reason_attribute','reference_attribute'})
 reference=write_private(c,value['run'],'diagnostic-poststate.json',{'run':value['run'],'system':value['system'],'scope':'owned_diagnostic_rollback_poststate','state':observed['state'],'reason_attribute':observed['reason_attribute'],'reference_attribute':observed['reference_attribute'],'canonical_checkpoint':False});diff,overflow=prior.differing_paths(expected,observed['state'])
 if not diff and not overflow:s.need(prior.raw(expected)==prior.raw(observed['state']));c.transition(value['before'],observed['state'])
 return {'result':'passed'if not diff and not overflow else'differs','difference_count':len(diff),'differences':diff,'truncated':overflow,'expected_sha256':s.sha(prior.raw(expected)),'observed_sha256':s.sha(prior.raw(observed['state'])),'private_poststate':reference,'commit_nonce_claimed':False}
if __name__=='__main__':
 try:
  s.need(len(sys.argv)==2 and sys.argv[1]in('render','compare','diagnostic_claim','diagnose'));data=sys.stdin.buffer.read(32*1024*1024+1);s.need(0<len(data)<=32*1024*1024);print(json.dumps(dispatch(sys.argv[1],json.loads(data)),sort_keys=True,separators=(',',':')))
 except Exception:print('{"result":"unconfirmed","safe_error_code":"REASON40_MAIN_DIAGNOSTIC_UNCONFIRMED"}',file=sys.stderr);sys.exit(1)
