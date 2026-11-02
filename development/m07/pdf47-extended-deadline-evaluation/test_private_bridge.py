"""Pure SQL/parser and synthetic fake-guard custody tests; no native ACL/DB/provider."""
from pathlib import Path
import importlib.util,json,subprocess,tempfile,unittest
from pglast import parse_sql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('pdf47_extended_bridge',HERE/'private_bridge.py');bridge=importlib.util.module_from_spec(spec);spec.loader.exec_module(bridge)

class Tests(unittest.TestCase):
 def test_query_is_exact_prior_readonly_query_except_new_input_schema_stamp(self):
  prior=HERE.parent/'pdf47-low-effort-evaluation/private_bridge.py'
  original=bridge.module('retained_prior_query_for_pure_comparison',prior)
  self.assertEqual(bridge.SQL.replace('pdf47-extended-input.v1','pdf47-low-effort-input.v1'),original.SQL)
  self.assertEqual((bridge.HELPER_SHA,bridge.READER_SHA,bridge.TARGET),(original.HELPER_SHA,original.READER_SHA,original.TARGET))
  self.assertFalse(bridge.BRIDGE_ENABLED)
  self.assertNotIn('.local/pdf47-low-effort-evaluation',(HERE/'private_bridge.py').read_text())
 def test_exact_readonly_retained_source_query(self):
  statements=parse_sql(bridge.SQL);self.assertGreater(len(statements),3)
  self.assertIn('read only;',bridge.SQL);self.assertTrue(bridge.SQL.rstrip().endswith('rollback;'))
  for value in('47f86513-8999-4946-b5d9-f2fd6a18fd00','0fbc905f-c51e-472d-9d03-74664ee9ac86','a.sha256=j.input',"p.stage='prepare_document'",'p.input_hash=j.input_hash'):
   self.assertIn(value,bridge.SQL)
  for value in('auth.', 'insert ', 'update ', 'delete ', 'grant ', 'revoke ', 'http_'):
   self.assertNotIn(value,bridge.SQL.lower())
 def test_duplicate_and_input_identity_refuse(self):
  with self.assertRaises(ValueError):bridge.strict(b'{"x":1,"x":2}',100)
  with self.assertRaises(ValueError):bridge.validate_input({'input':'PRIVATE_CANARY'})
 def test_synthetic_private_custody_claim_is_exclusive_and_paths_closed(self):
  original_main,original_module=bridge.MAIN,bridge.module
  class FakeGuard:
   def create(self,path):return path.open('xb')
   def verify(self,path):self.assert_file(path)
   def verify_open(self,stream):self.assert_file(Path(stream.name))
   @staticmethod
   def assert_file(path):
    if not path.is_file()or path.is_symlink():raise ValueError('FAKE_PRIVATE_REFUSED')
  class FakeSecurity:
   WindowsPrivateFiles=FakeGuard
   @staticmethod
   def safe_path(path):
    if not path.resolve().is_relative_to(bridge.MAIN.resolve()):raise ValueError('FAKE_PATH_REFUSED')
  try:
   with tempfile.TemporaryDirectory()as directory:
    bridge.MAIN=Path(directory);bridge.module=lambda *_:FakeSecurity
    store=bridge.Store('00000000-0000-4000-8000-000000000001')
    for name in('../input.json','tokens.json','secrets.env'):
     with self.assertRaises(ValueError):store.path(name)
    store.write('dispatch.claim.json',{'request':{'run_id':store.run}})
    with self.assertRaises(FileExistsError):store.write('dispatch.claim.json',{'changed':True})
    store.persist_response({'response':{'private_text':'PRIVATE_RESPONSE_CANARY'},'provider_request_id':'req_synthetic','http_status':200})
    self.assertIn('PRIVATE_RESPONSE_CANARY',json.dumps(store.read('response.json',65536)))
    with self.assertRaises(FileExistsError):store.persist_response({'response':{},'provider_request_id':None,'http_status':None})
    store.persist({'result':{'private_text':'PRIVATE_RESULT_CANARY'},'metadata':{}})
    self.assertIn('PRIVATE_RESULT_CANARY',json.dumps(store.read('output.json',65536)))
  finally:bridge.MAIN,bridge.module=original_main,original_module
 def test_actual_defaultoff_bridge_refuses_before_stdin_or_private_initialization(self):
  result=subprocess.run([str(bridge.MAIN/'.venv-skills/Scripts/python.exe'),'-X','utf8','-B',str(HERE/'private_bridge.py')],input=b'PRIVATE_INVALID_CANARY',capture_output=True,check=False)
  self.assertEqual(result.returncode,1);self.assertEqual(json.loads(result.stdout),{'ok':False,'code':'PDF47_EXTENDED_PRIVATE_REFUSED'})
  self.assertNotIn(b'PRIVATE_INVALID_CANARY',result.stderr+result.stdout)
if __name__=='__main__':unittest.main()
