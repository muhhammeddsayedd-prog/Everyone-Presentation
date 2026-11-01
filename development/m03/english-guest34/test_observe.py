from pathlib import Path
import copy,importlib.util,sys,unittest
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('guest_metadata',HERE/'observe.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
LINK='00000000-0000-4000-8000-000000000001'
def fixture():return [{'guest_link_metadata':{'database':'postgres','operator':'postgres','observed_at':'2026-10-31T21:00:00Z','read_only':True,'exact_history34':True,'english_enabled':True,'scope_match_count':1,'link_match_count':1,'link':{'review_link_id':LINK,'series_id':m.SERIES,'workspace_id':m.WORKSPACE,'row_version':1,'created_at':'2026-10-31T20:00:00Z','expires_at':'2026-11-30T20:00:00Z','revoked_at':None,'download_enabled':True,'current_ready_version_id':m.VERSION,'current_ready_version_no':1},'guest_session_rows':{'limit':100,'truncated':False,'count':2,'unexpired_row_count':1}}}]
class Tests(unittest.TestCase):
 def test_source_pins_and_read_only_projection(self):self.assertIn(b'limit 101',m.sources())
 def test_existing_protected_creator_import_bootstraps_and_restores_path_without_private_IO(self):
  before=list(sys.path);module=m.load_security_module();self.assertEqual(sys.path,before)
  self.assertTrue(callable(module.WindowsPrivateFiles.create));self.assertTrue(callable(module.WindowsPrivateFiles.verify))
 def test_before_after_pin_actual_link_and_observed_revocation_without_mutation(self):
  v=fixture();self.assertTrue(m.parse(v,'before')[1]);self.assertFalse(m.parse(v,'after',LINK)[1])
  v[0]['guest_link_metadata']['link']['revoked_at']='2026-10-31T20:59:00Z';self.assertTrue(m.parse(v,'after',LINK)[1]);self.assertFalse(m.parse(v,'before')[1])
 def test_duplicate_scope_wrong_link_or_private_extra_fields_are_rejected(self):
  for change in [lambda v:v.update(link_match_count=2),lambda v:v.update(scope_match_count=0),lambda v:v['link'].update(current_ready_version_id=LINK),lambda v:v['link'].update(token_digest='SYNTHETIC_PRIVATE'),lambda v:v['guest_session_rows'].update(count=101)]:
   v=fixture();change(v[0]['guest_link_metadata'])
   with self.assertRaises(ValueError):m.parse(v,'before')
  with self.assertRaises(ValueError):m.parse(fixture(),'after','00000000-0000-4000-8000-000000000002')
 def test_truncated_session_counts_are_unknown_not_false_totals(self):
  v=fixture();v[0]['guest_link_metadata']['guest_session_rows'].update(truncated=True,count=None,unexpired_row_count=None)
  self.assertTrue(m.parse(v,'before')[0]['guest_session_rows']['truncated'])
  v[0]['guest_link_metadata']['guest_session_rows']['count']=100
  with self.assertRaises(ValueError):m.parse(v,'before')
if __name__=='__main__':unittest.main()
