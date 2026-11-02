"""Default-off entry for the classified current baseline; inherited phases only."""
from pathlib import Path
import importlib.util,json,sys

HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
projection=module('reason40_qualified_forward_context',HERE/'proposal.py');s=projection.s
prior=module('reason40_qualified_frozen_main_release',HERE.parent/'review-link-reason40-main-diagnostics/release.py')
r=prior.prior.prior.r
s.need(s.sha(r.disabled_release_bytes(s.load(HERE.parent/'review-link-reason40-main-diagnostics/release.py')))=='e4ac245e426550a8dc5c83e88bd6783c17c6f599d10686557b1931dca703f160')
READ_ENABLED=True
APPLY_ENABLED=True
PROOF={'path':'tracking/evidence/m07/reason40-collector-validation/2026-11-02T15-57-52.741Z-bd221d39.json','sha256':'4b25872ffe84758d98acfce52c2d0b95da6476d05749bbef15b696ccdb90c3dd'}

def validate_proof(raw):
 s.need(s.sha(raw)==PROOF['sha256']);value=json.loads(raw)
 s.need(value['result']=='passed'and value['cloud_called']is False and value['provider_called']is False)
 s.need(all(value[key]is True for key in('all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')))
 fixture=value['forward_owned_fixture'];scope=value['forward_source_scope']
 s.need(fixture['claims_after']==fixture['claims_before']+1 and all(fixture[key]is True for key in('official0074_exact_source','one_synthetic_ledger_row_added','new_bucket_column_values_preserved_after40','storage_bucket_count_preserved_after40')))
 s.need(scope['SQL_guard_methods_inherited_unchanged']is True and scope['owned_current_identity_qualification_only']is True and scope['canonical_hardbound_five_scalar_baseline_claimed']is False and scope['historical_identity_equality_since39_claimed']is False)
 return value

class Release(prior.Release):
 def __init__(self,run,context=None):super().__init__(run,context if context is not None else projection.ProposedContext())
 def enabled(self,apply=False):
  s.need(READ_ENABLED and(not apply or APPLY_ENABLED));super().enabled(apply)
 def admission(self):
  value=super().admission();s.need(value['collector_validation']==PROOF)
  validate_proof(s.load(self.c.source/PROOF['path']))
  s.need(value['forward_baseline']['scope']==projection.SCOPE and value['forward_baseline']['historical_identity_equivalence_since39']is False)
  return value

def main(argv=None):
 args=sys.argv[1:]if argv is None else argv
 s.need(len(args)==2 and args[0]in('prepare','apply','reconcile'))
 s.need(READ_ENABLED and(args[0]!='apply'or APPLY_ENABLED))
 operator=Release(args[1]);operator.enabled(args[0]=='apply');value=getattr(operator,args[0])()
 print(json.dumps({'result':value['result'],'receipt':r.save(args[0],value,operator.c.source)}));s.need(value['result']in('passed','prepared'))

if __name__=='__main__':
 try:main()
 except Exception:print('{"result":"unconfirmed","safe_error_code":"REASON40_QUALIFIED_FORWARD_UNCONFIRMED"}',file=sys.stderr);sys.exit(1)
