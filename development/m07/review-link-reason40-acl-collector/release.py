"""Thin latest Context entry; inherited canonical phases/transport stay frozen."""
from pathlib import Path
import importlib.util,json,sys
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
projection=module('reason40_acl_entry_context',HERE/'context.py');s=projection.base
file=projection.TYPED/'release.py';s.need(s.sha(s.load(file))=='bbac9dc7a111a88492ef4ab492bfec13d1868bf41423119fbe2329156861eddf');prior=module('reason40_acl_typed_entry_library',file)
READ_ENABLED=False
APPLY_ENABLED=False
class Release(prior.Release):
 def __init__(self,run,context=None):super().__init__(run,context or projection.Context())
 def enabled(self,apply=False):s.need(READ_ENABLED and prior.r.READ_ENABLED and(not apply or APPLY_ENABLED and prior.r.APPLY_ENABLED))
 def admission(self):
  value=prior.r.Release.admission(self);proof=json.loads(s.load(self.c.source/value['collector_validation']['path']));shape=proof['acl_catalogue_projection'];diagnostic=proof['diagnostic_rollback']
  s.need(shape['same_six_key_text_array']==projection.typed.KEYS and shape['new_reason_acl_null']is True and shape['existing_reference_acl_preserved']is True and shape['shape_comparison_excludes_only']==['attname','attnum','attacl'])
  s.need(shape['state_sha256']==s.sha(self.c.state_sql().encode())and shape['checkpoint_sha256']==s.sha(self.c.checkpoint_sql().encode()))
  s.need(diagnostic['result']=='passed'and diagnostic['difference_count']==0 and diagnostic['differences']==[]and diagnostic['truncated']is False and diagnostic['expected_sha256']==diagnostic['observed_sha256']and diagnostic['rolled_back_preimage_exact']is True and diagnostic['commit_nonce_claimed']is False)
  for folder in(projection.TYPED,HERE):
   for file in sorted(folder.iterdir()):
    if file.is_file():
     relative=file.relative_to(self.c.source).as_posix();data=s.load(file);data=prior.r.disabled_release_bytes(data)if file.name=='release.py'and folder==HERE else data;s.need(proof['source_seals'][relative]==s.sha(data))
  return value
def main():
 s.need(len(sys.argv)==3 and sys.argv[1]in('prepare','apply','reconcile'));s.need(READ_ENABLED and(sys.argv[1]!='apply'or APPLY_ENABLED));operator=Release(sys.argv[2]);operator.enabled(sys.argv[1]=='apply');value=getattr(operator,sys.argv[1])();print(json.dumps({'result':value['result'],'receipt':prior.r.save(sys.argv[1],value,operator.c.source)}));s.need(value['result']in('passed','prepared'))
if __name__=='__main__':
 try:main()
 except Exception:print('{"result":"unconfirmed","safe_error_code":"REASON40_ACL_RELEASE_UNCONFIRMED"}',file=sys.stderr);sys.exit(1)
