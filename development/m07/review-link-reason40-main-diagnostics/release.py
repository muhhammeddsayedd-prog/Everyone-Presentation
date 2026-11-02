"""Latest opt-in entry; no copied canonical transport or phase implementation."""
from pathlib import Path
import importlib.util,json,sys
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
projection=module('reason40_main_entry_context',HERE/'context.py');s=projection.base
file=projection.ACL/'release.py';s.need(s.sha(s.load(file))=='61fd7992aa96ab4afc6c3c43fb26a9e60c4abce9263cb15f833634ea6851eabb');prior=module('reason40_main_frozen_acl_entry',file)
READ_ENABLED=False
APPLY_ENABLED=False
class Release(prior.Release):
 def __init__(self,run,context=None):super().__init__(run,context or projection.Context())
 def enabled(self,apply=False):s.need(READ_ENABLED and prior.prior.r.READ_ENABLED and(not apply or APPLY_ENABLED and prior.prior.r.APPLY_ENABLED))
 def admission(self):
  value=super().admission();proof=json.loads(s.load(self.c.source/value['collector_validation']['path']));storage=proof['main_diagnostic_storage'];s.need(storage=={'workspace':'Main','existing_Main_guard':True,'no_ROOT_or_cache_manipulation':True,'no_new_IO_subprocess_port':True,'SQL_and_acceptance_unchanged':True});reference=proof['diagnostic_rollback']['private_poststate'];s.need(reference['workspace']=='Main'and reference['path'].startswith('.local/reason40-main-diagnostics/')and reference['scope']=='owned_diagnostic_rollback_poststate'and reference['canonical_checkpoint']is False)
  for file in sorted(HERE.iterdir()):
   if file.is_file():
    data=s.load(file);data=prior.prior.r.disabled_release_bytes(data)if file.name=='release.py'else data;s.need(proof['source_seals'][file.relative_to(self.c.source).as_posix()]==s.sha(data))
  return value
def main():
 s.need(len(sys.argv)==3 and sys.argv[1]in('prepare','apply','reconcile'));s.need(READ_ENABLED and(sys.argv[1]!='apply'or APPLY_ENABLED));operator=Release(sys.argv[2]);operator.enabled(sys.argv[1]=='apply');value=getattr(operator,sys.argv[1])();print(json.dumps({'result':value['result'],'receipt':prior.prior.r.save(sys.argv[1],value,operator.c.source)}));s.need(value['result']in('passed','prepared'))
if __name__=='__main__':
 try:main()
 except Exception:print('{"result":"unconfirmed","safe_error_code":"REASON40_MAIN_RELEASE_UNCONFIRMED"}',file=sys.stderr);sys.exit(1)
