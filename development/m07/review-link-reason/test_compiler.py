"""Pure bootstrap/SQL rendering gates. No database, Docker or auth calls."""
from pathlib import Path
import importlib.util,json,re,subprocess,unittest
from pglast import parse_sql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('reason40_owned_compiler',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.text=c.compile_source('.local/review-link-reason40-source/source-only.mjs');cls.proof=(HERE/'proof.mjs').read_text(encoding='utf-8')
 def test_new_purpose_retains_exact_bootstrap_ownership_cleanup_and_old_rows(self):
  for marker in ['reason40-compatibility-proof','eps.reason40.run','eps-reason40-','review-link-reason40-owned-proof','--network\', \'none','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','all_owned_resources_absent','all_preexisting_old_column_rows_preserved']:
   self.assertIn(marker,self.text)
  self.assertNotIn("'eps.project39.run'",self.text)
  self.assertLess(self.text.index("assert(reason40.EXECUTION_ENABLED"),self.text.index('port.verifyLocalTarget()'))
  self.assertIn("const ACTOR = 'a4400000-0000-4000-8000-000000000001'",self.text)
  self.assertIn("case when r.table_name='eps.audit_events'then'(to_jsonb(t)-''reason'')'else'to_jsonb(t)'end",self.text)
  self.assertNotIn('where table_name not in',self.text)
 def test_disabled_generated_entry_refuses_before_local_target_or_docker(self):
  program=self.text[:self.text.index('if (process.argv[1] &&')]+"\nrunRace('D:/Everyone/Presentation/Everyone-Presentation-Studio').then(()=>process.exitCode=2).catch(error=>{if(error.message!=='REASON40_EXECUTION_DISABLED')throw error;process.stdout.write('DISABLED_BEFORE_TARGET');});"
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module'],input=program.encode(),capture_output=True,timeout=10)
  self.assertEqual(result.returncode,0,result.stderr.decode());self.assertEqual(result.stdout,b'DISABLED_BEFORE_TARGET')
 def test_actual_fixture_and_temporary_helpers_parse(self):
  self.assertEqual(len(parse_sql((HERE/'fixture.sql').read_text(encoding='utf-8'))),11)
  match=re.search(r'const TEMP=`(.*?)`;\nfunction acting',self.proof,re.S);self.assertIsNotNone(match)
  helpers=parse_sql(match[1]);self.assertEqual(len(helpers),5)
  self.assertTrue(all(type(node.stmt).__name__=='CreateFunctionStmt'for node in helpers))
 def test_actual_rendered_observer_select_and_bootstrap_javascript_parse(self):
  template=re.search(r'observer\.request\(`(.*?)`\)',self.proof,re.S);self.assertIsNotNone(template)
  program="const text="+json.dumps(template[1])+";const sql=Function('b','return `'+text+'`')({pid:417});process.stdout.write(sql);"
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',program],capture_output=True,timeout=10)
  self.assertEqual(result.returncode,0);parse_sql(result.stdout.decode());self.assertIn('pid=417;',result.stdout.decode())
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--check','--input-type=module'],input=self.text.encode(),capture_output=True,timeout=10)
  self.assertEqual(result.returncode,0,result.stderr.decode())

if __name__=='__main__':unittest.main()
