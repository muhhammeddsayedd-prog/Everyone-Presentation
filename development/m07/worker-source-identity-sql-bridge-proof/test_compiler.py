"""RAM-only composition/provenance/default-off tests; no SQL/Docker/ACL calls."""
from pathlib import Path
import importlib.util,json,subprocess,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker40_bridge_compiler_tests',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
UUID='00000000-0000-4000-8000-000000000001'
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.source,cls.concurrency,cls.callback,cls.plan=c.compile_source('.local/worker-source-identity-sql-bridge-compiled/controller-'+UUID+'.mjs')
 def test_finite_controller_and_callback_inverse_defaultoff_all_generated_JS_parses(self):
  self.assertFalse(self.plan['execution_enabled']);self.assertTrue(self.plan['original_admin_controller_inverse_byte_equal']);self.assertTrue(self.plan['callback_only_diagnostic_bridge_and_flag_changed'])
  self.assertIn("'.local/worker-source-identity-sql-bridge-once'",self.source);self.assertLess(self.source.index('report.dispatch_once_claim_created=true'),self.source.index('port = await import'))
  for text in(self.source,self.concurrency,self.callback,(HERE/'entry.mjs').read_text(),(HERE/'bridge.mjs').read_text()):
   p=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','--check'],input=text.encode(),capture_output=True,timeout=10);self.assertEqual(p.returncode,0,p.stderr[:200])
 def test_actual_production_SQL_caps_and_native_value_are_identical(self):
  before=c.module('worker40_admin_exact_library_for_test',c.ADMIN/'compiler.py');_,_,_,plan=before.compile_source('.local/worker-source-identity-sql-admin-compiled/controller-'+UUID+'.mjs')
  for key in('production_State_SQL_hashes','sql_contract_sha256','native_pin_value'):self.assertEqual(self.plan[key],plan[key])
  self.assertEqual(self.plan['bridge_bounds'],{'combined_output_bytes':33554432,'deadline_ms':30000,'same_Python_CLI_and_inherited_environment':True,'retry':False})
 def test_disabled_entry_refuses_before_ports_or_files(self):
  code="const m=await import("+json.dumps((HERE/'entry.mjs').as_uri())+");let called=false;try{await m.runCases(new Proxy({},{get(){called=true;throw Error('PORT')}}),{})}catch(e){if(e.message!=='WORKER40_BRIDGE_PROOF_DISABLED')throw e;}if(called)throw Error('READ_BEFORE_FLAG');";p=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',code],capture_output=True,timeout=10);self.assertEqual(p.returncode,0,p.stderr[:200])
 def test_old_literal_flags_only_and_new_namespace_refusal(self):
  a=b'export const EXECUTION_ENABLED=false;\nBODY';b=b'export const EXECUTION_ENABLED=true;\nBODY';self.assertEqual(c.flag(a),c.flag(b));self.assertNotEqual(c.sha(c.flag(a)),c.sha(c.flag(b+b'changed')))
  for raw in(a+b,b'export const EXECUTION_ENABLED = true;'):
   with self.assertRaises(ValueError):c.flag(raw)
  with self.assertRaises(ValueError):c.compile_source('.local/worker-source-identity-sql-admin-compiled/controller-'+UUID+'.mjs')
if __name__=='__main__':unittest.main()
