"""Actual inherited checker; guarded historical metadata reads, no SQL/provider."""
from pathlib import Path
import copy,importlib.util,json,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker_identity_actual_inherited_state',HERE/'state.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.state=m.State('sha256:'+'a'*64)
  cls.approved=json.loads((m.MAIN/m.a.APPLY['path']).read_bytes())
 def current(self):
  anchor=copy.deepcopy(self.approved['first']);base=anchor['canonical']['base']
  # Synthetic opaque SQL hash/count projections exercise the REAL inherited
  # admission, not an executed database query or a new factual audit reason.
  anchor['reason']['historical_nonnull']=1;base['data']['audit_events']['sha256']='f'*64
  return {'schema40':anchor,'lifecycle':dict.fromkeys(m.COUNTERS,0),'oauth_count_only':{'claims_count':base['data']['oauth_consent_claims']['count'],'full_sha256':base['oauth']['sha256'],'static_sha256':base['oauth_static_sha256'],'reconstructed_anchor_full_sha256':base['oauth']['sha256']}}
 def test_real_checker_accepts_full_audit_reason_projection_and_each_allowed_config_phase(self):
  value=self.current();self.assertIs(self.state.initial(value),value)
  for phase in('pause','pin','resume'):
   before=copy.deepcopy(value);expected=self.state.expected(before,phase)
   for table in m.CONFIG:value['schema40']['canonical']['processing_config'][table]['public']=copy.deepcopy(expected['schema40']['canonical']['processing_config'][table]['public'])
   self.assertTrue(self.state.transition(before,value,phase));self.assertEqual(value['schema40']['reason']['historical_nonnull'],1);self.assertEqual(value['schema40']['canonical']['base']['data']['audit_events']['sha256'],'f'*64)
 def test_real_checker_accepts_only_proven_count_growth_with_static_oauth_unchanged(self):
  value=self.current();value['schema40']['canonical']['base']['data']['oauth_consent_claims']['count']+=1;value['oauth_count_only']['claims_count']+=1
  value['schema40']['canonical']['base']['oauth']['sha256']='b'*64;value['oauth_count_only']['full_sha256']='b'*64
  self.assertIs(self.state.check(value),value)
  for key in('static_sha256','reconstructed_anchor_full_sha256'):
   changed=copy.deepcopy(value);changed['oauth_count_only'][key]='c'*64
   with self.assertRaises(ValueError):self.state.check(changed)
 def test_real_checker_refuses_catalogue_identity_or_fixed_configuration_drift(self):
  for key in('old_identities','remaining_catalogue'):
   value=self.current();value['schema40']['canonical']['project39'][key]['sha256']='0'*64
   with self.assertRaises(ValueError):self.state.check(value)
  value=self.current();value['schema40']['canonical']['processing_config']['specs_pipeline_config']['fixed_sha256']='0'*64
  with self.assertRaises(ValueError):self.state.check(value)
 def test_real_checker_refuses_existing_function_identity_and_role_authority_changes(self):
  for mode in('function','authority'):
   value=self.current()
   if mode=='authority':value['schema40']['authority']['roles']='0'*64
   else:
    function=next(iter(value['schema40']['functions']));value['schema40']['functions'][function]['identity']['proacl']=[]
   with self.assertRaises(ValueError):self.state.check(value)
if __name__=='__main__':unittest.main()
