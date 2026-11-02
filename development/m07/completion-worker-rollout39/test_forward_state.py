"""Offline aggregate qualification/preservation; inherited SQL stays exact."""
from pathlib import Path
import copy,importlib.util,unittest,uuid
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
f=module('forward_state_test_target',HERE/'forward_state.py');fixtures=module('forward_state_test_fixtures',HERE/'test_controller.py')
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.state=f.State();cls.original=f.base.State()
 def fresh(self):
  value=fixtures.Ports(self.state).value;legacy=value['canonical']['base']['legacy'];legacy['job_count']+=1;legacy['kinds']['review_fit']=legacy['kinds'].get('review_fit',0)+1
  return value
 def test_accepts_fresh_aggregate_without_mutating_or_weakening_other_legacy_fields(self):
  value=self.fresh();before=copy.deepcopy(value)
  with self.assertRaises(ValueError):self.original.initial(value)
  self.assertEqual(self.state.initial(value),before);self.assertEqual(value,before)
  for key,replacement in [('unsupported_metadata_count',1),('job_count',-1),('kinds',{'unknown_kind':1})]:
   bad=copy.deepcopy(value);bad['canonical']['base']['legacy'][key]=replacement
   with self.assertRaises(ValueError):self.state.initial(bad)
  bad=copy.deepcopy(value);bad['canonical']['base']['protected_m02_integrity']=False
  with self.assertRaises(ValueError):self.state.initial(bad)
 def test_full_fresh_legacy_counts_remain_in_phase_comparison(self):
  before=self.fresh();after=copy.deepcopy(before)
  for row in after['canonical']['processing_config'].values():row['public']['enabled']=False
  self.assertTrue(self.state.transition(before,after,'pause'))
  after['canonical']['base']['legacy']['job_count']+=1;after['canonical']['base']['legacy']['kinds']['review_fit']+=1
  with self.assertRaises(ValueError):self.state.transition(before,after,'pause')
 def test_inherited_sql_exact_and_forward_contract_is_distinct(self):
  self.assertNotEqual(self.state.sql_contract_sha256(),f.BASE_SHA);self.assertEqual(self.state.sql_contract_sha256(),f.base.sha(f.base.load(HERE/'forward_state.py')))
  for method in('prefix','state_sql','comparable_sql'):self.assertEqual(getattr(self.state,method)(),getattr(self.original,method)())
  self.assertEqual(self.state.a.lifecycle_sql(),self.original.a.lifecycle_sql());self.assertEqual(self.state.a.config_sql(),self.original.a.config_sql())
  for phase in('pause','pin','resume','unwind'):
   before=fixtures.Ports(self.state).value
   if phase!='pause':
    for row in before['canonical']['processing_config'].values():row['public']['enabled']=False
   if phase=='resume':before['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']=f.base.NATIVE
   marker=str(uuid.uuid4());self.assertEqual(self.state.render(before,phase,marker),self.original.render(before,phase,marker))
if __name__=='__main__':unittest.main()
