"""Pure/fake-file and READ-ONLY actual path-guard tests. No DB/provider calls."""
from pathlib import Path
import copy,hashlib,importlib.util,json,subprocess,sys,tempfile,types,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
projection=module('test_main_diagnostic_context',HERE/'context.py');local=module('test_main_diagnostic_local',HERE/'local.py');compiler=module('test_main_diagnostic_compiler',HERE/'compiler.py');entry=module('test_main_diagnostic_entry',HERE/'release.py')
class Tests(unittest.TestCase):
 def test_actual_Main_guard_admits_exact_new_Main_path_and_rejects_sibling_without_write(self):
  c=projection.Context();file=c.root/'tools/provision_logo_verifier.py';self.assertEqual(hashlib.sha256(file.read_bytes()).hexdigest(),'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c');old=sys.path[:]
  try:sys.path.insert(0,str(file.parent));guard=module('test_existing_Main_private_guard',file)
  finally:sys.path[:]=old
  run='734df9f4-7bc5-405d-9548-fba3ef7fb439';expected=c.root/'.local/reason40-main-diagnostics'/run/'diagnostic.claim.json';sibling=(c.root.parent/'Everyone-Presentation-Studio-Production-Admission'/'.local/reason40-main-diagnostics'/run/'diagnostic.claim.json').resolve();self.assertNotEqual(sibling,expected);self.assertFalse(sibling.is_relative_to(c.root));self.assertFalse(expected.exists());guard.safe_path(expected)
  with self.assertRaises(Exception):guard.safe_path(sibling)
  self.assertFalse(expected.exists())
  for source in(c.source,c.root):self.assertEqual(local.folder(types.SimpleNamespace(root=c.root,source=source),run),expected.parent)
 def test_fresh_main_folder_claim_once_only_and_only_diagnostics_copied(self):
  with tempfile.TemporaryDirectory()as temporary:
   root=Path(temporary).resolve();main=root/'Main';source=root/'Source';main.mkdir();source.mkdir()
   class Guard:
    def create(self,path):return path.open('xb')
    def verify_open(self,stream):pass
    def verify(self,path):pass
   before={'synthetic':'before'};expected={'reason':{'shape_valid':True}};context=types.SimpleNamespace(root=main,source=source,b=types.SimpleNamespace(security=lambda:Guard()),bind=lambda*a:context,expected=lambda before:expected,transition=lambda a,b:None);value={'before':before,'run':'734df9f4-7bc5-405d-9548-fba3ef7fb439','system':'999111222333444555'}
   with patch.object(local.prior,'OwnedContext',return_value=context):
    claim=local.dispatch('diagnostic_claim',value);self.assertEqual(claim['claim']['workspace'],'Main');self.assertTrue((main/claim['claim']['path']).is_file());self.assertFalse((source/claim['claim']['path']).exists())
    with self.assertRaises(FileExistsError):local.dispatch('diagnostic_claim',value)
    result=local.dispatch('diagnose',{**value,'observed':{'state':expected,'reason_attribute':{'attacl':None},'reference_attribute':{'attacl':['retained']}}})
   self.assertEqual(result['result'],'passed');self.assertEqual(result['difference_count'],0);self.assertEqual(result['private_poststate']['workspace'],'Main');self.assertFalse(result['commit_nonce_claimed']);self.assertFalse(result['private_poststate']['canonical_checkpoint'])
 def test_sql_diagnostic_and_frozen_cases_are_byte_identical_except_bridge_URL(self):
  c=projection.Context();prior=projection.acl.Context();self.assertEqual(c.state_sql(),prior.state_sql());self.assertEqual(c.checkpoint_sql(),prior.checkpoint_sql());source,cfg,library,cases=compiler.compile_source('.local/reason40-main-store-source/offline.mjs');old=compiler.module('test_main_inverse_acl_compiler',projection.ACL/'compiler.py');_,oldcfg,_,oldcases=old.compile_source('.local/reason40-main-store-source/offline.mjs')
  self.assertEqual(projection.base.replace_once(cases,'new URL('+json.dumps((HERE/'local.py').as_uri())+')','new URL('+json.dumps((projection.ACL/'local.py').as_uri())+')'),oldcases)
  for key in('state_sql','checkpoint_sql','qualification_sql','config_setup_sql'):self.assertEqual(cfg[key],oldcfg[key])
  self.assertIn('eps.reason40main.run',source);self.assertFalse(library.exists())
  with patch.object(local.prior,'dispatch',return_value={'synthetic':'delegated'})as delegated:
   self.assertEqual(local.dispatch('render',{'sentinel':True}),{'synthetic':'delegated'});delegated.assert_called_once_with('render',{'sentinel':True})
  for text in(source,cases):self.assertEqual(subprocess.run(['C:/Program Files/nodejs/node.exe','--check','--input-type=module'],input=text.encode(),capture_output=True,timeout=10).returncode,0)
 def test_default_off_before_target_and_no_new_guard_or_port(self):
  script='const m=await import('+json.dumps((HERE/'cases.mjs').as_uri())+');if(m.EXECUTION_ENABLED)process.exit(8);try{await m.runCases({get system(){throw Error("touched");}},{});process.exit(9);}catch(e){if(e.code!=="ERR_ASSERTION"||!e.message.includes("DISABLED"))process.exit(7);}'
  self.assertEqual(subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',script],capture_output=True,timeout=10).returncode,0);self.assertEqual(subprocess.run([sys.executable,'-B',str(HERE/'release.py'),'prepare','48e88fe1-987e-4692-82dd-07ead832f0b6'],capture_output=True,timeout=10).returncode,1)
  self.assertFalse(entry.READ_ENABLED);self.assertFalse(entry.APPLY_ENABLED);text=(HERE/'local.py').read_text();self.assertNotIn('subprocess',text);self.assertNotIn('sys.modules',text);self.assertNotIn('ROOT =',text)

if __name__=='__main__':unittest.main()
