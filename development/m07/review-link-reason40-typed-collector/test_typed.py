"""Pure typed-context/source tests. No DB, Docker or provider calls."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re,subprocess,sys,unittest
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
t=module('test_typed_projection',HERE/'context.py');local=module('test_typed_owned',HERE/'local.py');compiler=module('test_typed_compiler',HERE/'compiler.py');entry=module('test_typed_entry',HERE/'release.py');fixtures=module('test_typed_fixture',t.PRIOR/'test_release.py')

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.c=t.Context();cls.old=t.base.Context();fixtures.TestRelease.c=cls.old
 def before(self):
  value=fixtures.TestRelease().before();value['canonical']['base'].update(database='project39',cli_role_safe=False,protected_m02_integrity=False,protected_m02={'synthetic_fixture':'only'});return value
 def test_exact_six_key_text_array_operator_and_inverse_full_queries(self):
  self.assertEqual(len(t.KEYS),6);self.assertEqual(len(set(t.KEYS)),6);self.assertEqual(t.base.replace_once(self.c.state_sql(),t.NEW,t.OLD),self.old.state_sql());self.assertEqual(t.base.replace_once(self.c.checkpoint_sql(),t.NEW,t.OLD),self.old.checkpoint_sql())
  self.assertIn('::text[]',t.NEW);self.assertNotIn(t.OLD,self.c.state_sql());parse_sql(self.c.state_sql());parse_sql(self.c.checkpoint_sql())
 def test_owned_qualification_and_render_change_only_same_operator(self):
  before=self.before();new=local.OwnedContext().bind(before,'999111222333444555','734df9f4-7bc5-405d-9548-fba3ef7fb439');old=local.old.OwnedContext().bind(before,new.system,new.run);marker='97c37609-4166-4fa8-bff8-a53bacda635e'
  left=new.render(before,marker);right=old.render(before,marker);self.assertEqual(left.count(t.NEW),2);self.assertEqual(left.replace(t.NEW,t.OLD),right);parse_sql(left);new.transition(before,new.expected(before))
  for body in re.findall(r'do \$reason40_assert\$(.*?)\$reason40_assert\$;',left,re.S):self.assertEqual(len(parse_plpgsql('create function pg_temp.check_typed()returns void language plpgsql as $body$'+body+'$body$;')),1)
  altered=copy.deepcopy(new.expected(before));altered['authority']['roles']='f'*64
  with self.assertRaises(ValueError):new.transition(before,altered)
 def test_private_case_projection_only_changes_exact_bridge_path_and_parses(self):
  source,cfg,case_path,cases=compiler.compile_source('.local/reason40-typed-collector-source/offline.mjs')
  frozen=(t.PRIOR/'local-cases.mjs').read_bytes();old="new URL('./local.py',import.meta.url)";new='new URL('+json.dumps((HERE/'local.py').as_uri())+')';self.assertEqual(t.base.replace_once(cases,new,old).encode(),frozen)
  self.assertEqual(cfg['typed_cases_sha256'],hashlib.sha256(cases.encode()).hexdigest());self.assertIn('eps.reason40typed.run',source);self.assertIn("'tracking/evidence/m07/reason40-collector-validation'",source)
  self.assertEqual(hashlib.sha256(cfg['qualification_sql'].encode()).hexdigest(),'9ca76b04b6061abb12908e89a6a0f7dbd22985525a89fab8b439a5a3c69e17fd');self.assertEqual(hashlib.sha256(cfg['config_setup_sql'].encode()).hexdigest(),'95e9f308dfebb14169f3f19a7354c927349ab239cf33f33463cc569773d81b04')
  for text in(source,cases):self.assertEqual(subprocess.run(['C:/Program Files/nodejs/node.exe','--check','--input-type=module'],input=text.encode(),capture_output=True,timeout=10).returncode,0)
  self.assertFalse(case_path.exists())
 def test_new_wrapper_and_canonical_entry_are_default_off_before_target(self):
  script='const m=await import('+json.dumps((HERE/'cases.mjs').as_uri())+');if(m.EXECUTION_ENABLED)process.exit(8);try{await m.runCases({get system(){throw Error("touched");}},{});process.exit(9);}catch(e){if(e.code!=="ERR_ASSERTION"||!e.message.includes("DISABLED"))process.exit(7);}'
  self.assertEqual(subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',script],capture_output=True,timeout=10).returncode,0)
  result=subprocess.run([sys.executable,'-B',str(HERE/'release.py'),'prepare','48e88fe1-987e-4692-82dd-07ead832f0b6'],capture_output=True,timeout=10);self.assertEqual(result.returncode,1);self.assertFalse(entry.READ_ENABLED);self.assertFalse(entry.APPLY_ENABLED);self.assertFalse(entry.r.READ_ENABLED);self.assertFalse(entry.r.APPLY_ENABLED)
 def test_canonical_wrapper_has_no_orchestration_copy_or_new_transport(self):
  for method in('write','read','snapshot','checkpoint','compare_checkpoints','render'):
   self.assertNotIn(method,entry.Release.__dict__)
  raw=(HERE/'release.py').read_bytes();self.assertEqual(entry.r.disabled_release_bytes(raw),raw);self.assertEqual(entry.Release('9ec89234-46aa-4d85-9554-f3c63bf046c1',context=self.c).c,self.c)

if __name__=='__main__':unittest.main()
