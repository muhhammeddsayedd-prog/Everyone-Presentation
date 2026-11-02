"""Synthetic local ACL/durability tests. No provider, listener or credential reads."""
from pathlib import Path
import importlib.util,json,unittest,uuid
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('temporary_oauth_private_test',HERE/'private_store.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Tests(unittest.TestCase):
 def setUp(self):self.run=str(uuid.uuid4());self.store=m.Store(self.run)
 def tearDown(self):
  target=self.store.root.resolve();self.assertTrue(target.is_relative_to(m.PRIVATE.resolve())and target.name==self.run)
  for file in target.iterdir():self.assertTrue(file.is_file()and not file.is_symlink()and file.resolve().parent==target);file.unlink()
  target.rmdir()
 def test_protected_first_write_and_immutable_generation_before_normal(self):
  s=self.store;claim=s.claim('refresh');self.assertEqual(s.inspect('refresh')['state'],'unknown_no_replay')
  with self.assertRaises(Exception):s.claim('refresh')
  with self.assertRaises(Exception):s.normal('refresh',claim,'generation-2.json')
  generation=s.persist('refresh',claim,{'access_token':'synthetic_private_access','refresh_token':'synthetic_private_refresh','token_type':'Bearer'});s.secure.verify(s.path(generation));self.assertEqual(s.read(generation)['tokens']['refresh_token'],'synthetic_private_refresh')
  with self.assertRaises(Exception):s.persist('refresh',claim,{'access_token':'changed','refresh_token':'changed','token_type':'Bearer'})
  self.assertEqual(s.normal('refresh',claim,generation),{'phase':'refresh','normal_return':True});self.assertEqual(s.inspect('refresh')['state'],'normal_return_recorded')
  with self.assertRaises(Exception):s.normal('refresh',claim,generation)
 def test_unknown_claim_survives_new_store_and_unsafe_paths_or_duplicates_deny(self):
  s=self.store;s.claim('logout');again=m.Store(self.run);self.assertEqual(again.inspect('logout')['state'],'unknown_no_replay')
  for name in('../escape.json','generation-0.json','token.env'):
   with self.assertRaises(ValueError):s.write_new(name,{})
  with self.assertRaises(ValueError):m.strict(b'{"token":"one","token":"two"}')
  self.assertEqual(s.inspect('exchange')['state'],'not_dispatched')
  with self.assertRaises(Exception):s.persist('exchange','wrong',{'access_token':'x','refresh_token':'y','token_type':'Bearer'})

if __name__=='__main__':unittest.main()
