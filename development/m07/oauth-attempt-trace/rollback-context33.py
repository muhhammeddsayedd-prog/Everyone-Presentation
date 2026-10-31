"""One reviewed complete-wire diagnostic. Final COMMIT is replaced by ROLLBACK.

No actor/claims are supplied. Only the controller's metadata and empty-identity
guard proof execute; original callbacks, provider requests and jobs are untouched.
"""
from pathlib import Path
import hashlib,importlib.util,json,os,sys,uuid

HERE=Path(__file__).resolve().parent
FILE=HERE/'release-context33.py'
PIN='b285eb25a716c1c04ff8212c55b1807a9a2adbac8acc8a41fadd521d41487ca9'
if hashlib.sha256(FILE.read_bytes()).hexdigest()!=PIN:raise ValueError('CONTEXT33_DIAGNOSTIC_SOURCE_UNCONFIRMED')
spec=importlib.util.spec_from_file_location('reviewed_context33',FILE)
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
CLAIM=c.PRIVATE/'rollback.claim.json'

def main():
 c.need(len(sys.argv)==1 and not CLAIM.exists())
 pins=c.sources();before=c.read_state();independent=c.read_state()
 c.check_before(before);c.check_before(independent);c.need(c.normalize(before)==c.normalize(independent))
 marker=str(uuid.uuid4());wire=c.render(before,marker)
 c.need(wire.count('commit;select')==1)
 diagnostic=wire.replace('commit;select','rollback;select',1)
 c.need('\ncommit;'not in diagnostic and 'rollback;select'in diagnostic)
 c.PRIVATE.mkdir(parents=True,exist_ok=True)
 with CLAIM.open('x',encoding='utf8',newline='\n')as stream:
  stream.write(json.dumps({'target':c.TARGET,'source_pins':pins,'marker':marker,'before':before,
   'wire_sha256':hashlib.sha256(diagnostic.encode()).hexdigest(),'rollback_only':True,'dispatch_may_have_occurred':True},sort_keys=True)+'\n')
  stream.flush();os.fsync(stream.fileno())
 fresh=c.read_state();c.check_before(fresh);c.need(c.normalize(fresh)==c.normalize(before)and c.sources()==pins)
 returned=False;error=None
 try:
  value=c.query(diagnostic,'rollback-wire')
  returned=value=={'version':c.VERSION,'marker':marker,'migration_sha256':c.MIGRATION_SHA}
 except Exception:error=c.LAST_ERROR
 first=second=None;preserved=False
 try:
  first=c.read_state();second=c.read_state();c.check_before(first);c.check_before(second)
  preserved=c.normalize(first)==c.normalize(before)==c.normalize(second)and c.sources()==pins
 except Exception:pass
 passed=returned and preserved
 receipt=c.save('rollback',{'result':'passed'if passed else'unconfirmed','source_pins':pins,
  'rollback_wire_sha256':hashlib.sha256(diagnostic.encode()).hexdigest(),'rollback_marker_observed':returned,
  'claim_retained':True,'automatic_retry':False,'no_acting_identity_supplied':True,
  'safe_dispatch_error':error,'before':before,'first':first,'second':second,'unchanged32_twice':preserved})
 print(json.dumps({'result':'passed'if passed else'unconfirmed','receipt':receipt,'unchanged32_twice':preserved,'safe_error':error}))
 c.need(passed)

if __name__=='__main__':
 try:main()
 except Exception:print('CONTEXT33_ROLLBACK_UNCONFIRMED');sys.exit(1)
