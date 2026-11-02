"""Synthetic custody/parser checks only; no real ACL, DB, provider or input read."""
from pathlib import Path
import importlib.util,json,subprocess,tempfile,unittest
from pglast import parse_sql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('budget32_bridge_tests',HERE/'private_bridge.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
def prepared():return{'schema_version':b.SCHEMA,'job_id':'47f86513-8999-4946-b5d9-f2fd6a18fd00','source_asset_id':'0fbc905f-c51e-472d-9d03-74664ee9ac86','configured_model':'gpt-6.1-sol','prepared_text_bytes':12807,'mapped_pages':24,'prepared_source_verified':True,
 'input':{'sourceAssetId':'0fbc905f-c51e-472d-9d03-74664ee9ac86','correlationId':'synthetic','inputHash':'9185702344c74088328b8c6dee0d78d47bd70cf60c78ad520499937bb74e9742','paragraphs':[{'index':i,'page':i%24+1,'text':'PRIVATE_CANARY'}for i in range(219)]}}
class Tests(unittest.TestCase):
 def test_exact_frozen_readonly_query_only_new_schema_stamp(self):
  self.assertEqual(b.SQL.replace(b.SCHEMA,'pdf47-streaming-input.v1'),b.base.SQL);parse_sql(b.SQL)
  self.assertFalse(b.BRIDGE_ENABLED);self.assertEqual(b.sha(b.BASE.read_bytes()),b.BASE_SHA)
  for text in('auth.','insert ','update ','delete ','grant ','revoke ','http_'):self.assertNotIn(text,b.SQL.lower())
  self.assertIn('repeatable read read only',b.SQL);self.assertTrue(b.SQL.rstrip().endswith('rollback;'))
 def test_new_schema_and_exact_retained_identity_do_not_accept_old_input_or_duplicate_keys(self):
  value=prepared();self.assertIs(b.validate_input(value),value)
  for field,new in(('schema_version','pdf47-streaming-input.v1'),('prepared_text_bytes',12806),('prepared_source_verified',False)):
   with self.assertRaises(ValueError):b.validate_input({**value,field:new})
  with self.assertRaises(ValueError):b.strict(b'{"x":1,"x":2}',100)
 def test_new_store_never_initializes_old_namespace_exclusive_claim_and_private_custody(self):
  main,module=b.MAIN,b.module
  class FakeGuard:
   def create(self,file):return file.open('xb')
   def verify(self,file):
    if not file.is_file()or file.is_symlink():raise ValueError('FAKE_REFUSED')
   def verify_open(self,stream):self.verify(Path(stream.name))
  class FakeSecurity:
   WindowsPrivateFiles=FakeGuard
   @staticmethod
   def safe_path(file):
    if not file.resolve().is_relative_to(b.MAIN.resolve()):raise ValueError('FAKE_PATH_REFUSED')
  try:
   with tempfile.TemporaryDirectory()as directory:
    b.MAIN=Path(directory);b.module=lambda *_:FakeSecurity;store=b.Store('00000000-0000-4000-8000-000000000001')
    self.assertFalse((b.MAIN/'.local/pdf47-streaming-evaluation').exists());store.write('input.json',prepared())
    with self.assertRaises(ValueError):store.claim({'run_id':store.run,'purpose':'one_retained_pdf47_streaming_evaluation'})
    store.claim({'run_id':store.run,'purpose':b.PURPOSE})
    with self.assertRaises(FileExistsError):store.claim({'run_id':store.run,'purpose':b.PURPOSE})
    for name in('../input.json','token.json','secrets.env'):
     with self.assertRaises(ValueError):store.path(name)
    value={'response':{'PRIVATE_RAW_CANARY':'content'},'observation':{'http_status':200}}
    store.persist_response(value);self.assertEqual(store.read('response.json',65536),value)
    with self.assertRaises(FileExistsError):store.persist_response(value)
    store.persist({'result':{'PRIVATE_RESULT_CANARY':True},'metadata':{}})
  finally:b.MAIN,b.module=main,module
 def test_inherited_file_caps_and_shapes_stay_closed(self):
  self.assertIs(b.Store.path,b.base.Store.path);self.assertIs(b.Store.write,b.base.Store.write)
  self.assertIs(b.Store.read,b.base.Store.read);self.assertIs(b.Store.persist_response,b.base.Store.persist_response);self.assertIs(b.Store.persist,b.base.Store.persist)
  self.assertIn('5*1024**2',b.BASE.read_text());self.assertIn('65536',b.BASE.read_text())
 def test_actual_disabled_bridge_refuses_before_stdin_or_private_initialization(self):
  result=subprocess.run([str(b.MAIN/'.venv-skills/Scripts/python.exe'),'-X','utf8','-B',str(HERE/'private_bridge.py')],input=b'PRIVATE_INVALID_CANARY',capture_output=True,timeout=10)
  self.assertEqual(result.returncode,1);self.assertEqual(json.loads(result.stdout),{'ok':False,'code':'PDF47_BUDGET32K_PRIVATE_REFUSED'})
  self.assertNotIn(b'PRIVATE_INVALID_CANARY',result.stdout+result.stderr)
if __name__=='__main__':unittest.main()
