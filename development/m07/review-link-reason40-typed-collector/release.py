"""Thin typed-Context entry. Frozen canonical orchestration remains library-only."""
from pathlib import Path
import importlib.util,json,sys
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('reason40_typed_context_entry',HERE/'context.py');typed=importlib.util.module_from_spec(spec);spec.loader.exec_module(typed);s=typed.base
file=typed.PRIOR/'release.py'
spec=importlib.util.spec_from_file_location('reason40_frozen_canonical_orchestration',file);r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
s.need(s.sha(r.disabled_release_bytes(s.load(file)))=='dcd522fd91f8643fd36cdfbd61434dd62614126e1005d3f644f5bfc314748f90')
READ_ENABLED=False
APPLY_ENABLED=False
class Release(r.Release):
 def __init__(self,run,context=None):super().__init__(run,context or typed.Context())
 def enabled(self,apply=False):s.need(READ_ENABLED and r.READ_ENABLED and(not apply or APPLY_ENABLED and r.APPLY_ENABLED))
 def query(self,sql,label):self.enabled(label=='apply');return super().query(sql,label)
 def prepare(self):self.enabled();return super().prepare()
 def apply(self):self.enabled(True);return super().apply()
 def reconcile(self):self.enabled();return super().reconcile()
 def admission(self):
  value=super().admission();proof=json.loads(s.load(self.c.source/value['collector_validation']['path']));projection=proof['typed_catalogue_projection']
  s.need(projection['only_six_key_deletion_operand_type_corrected']is True and projection['exact_keys']==typed.KEYS and projection['case_functions_changed_only_bridge_file_path']is True)
  s.need(projection['new_state_sha256']==s.sha(self.c.state_sql().encode())and projection['new_checkpoint_sha256']==s.sha(self.c.checkpoint_sql().encode()))
  for file in sorted(HERE.iterdir()):
   if file.is_file():
    relative=file.relative_to(self.c.source).as_posix();raw=s.load(file);raw=r.disabled_release_bytes(raw)if file.name=='release.py'else raw;s.need(proof['source_seals'][relative]==s.sha(raw))
  return value
def main():
 s.need(len(sys.argv)==3 and sys.argv[1]in('prepare','apply','reconcile'));s.need(READ_ENABLED and(sys.argv[1]!='apply'or APPLY_ENABLED));operator=Release(sys.argv[2]);operator.enabled(sys.argv[1]=='apply');value=getattr(operator,sys.argv[1])();print(json.dumps({'result':value['result'],'receipt':r.save(sys.argv[1],value,operator.c.source)}));s.need(value['result']in('passed','prepared'))
if __name__=='__main__':
 try:main()
 except Exception:print('{"result":"unconfirmed","safe_error_code":"REASON40_TYPED_RELEASE_UNCONFIRMED"}',file=sys.stderr);sys.exit(1)
