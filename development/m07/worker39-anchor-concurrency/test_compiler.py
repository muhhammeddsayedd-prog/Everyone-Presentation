"""Source-only gates for a fresh anchor-compatible owned proof. No SQL/Docker."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re,subprocess,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent

def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.c=module('worker39_anchor_compiler_test',HERE/'compiler.py');cls.source,cls.cfg=cls.c.compile_source('.local/worker39-anchor-concurrency-source/source-only.mjs')
 def test_nine_actual_sql_fragments_and_checkpoint_match_passed_fourth_receipt(self):
  c=self.c;proof=json.loads(c.load(c.PRIOR_PROOF));self.assertEqual(proof['result'],'passed');self.assertNotEqual(c.STATE_SHA,proof['sql_contract_sha256'])
  self.assertEqual(len(c.SQL_KEYS),9)
  for key in c.SQL_KEYS:self.assertEqual(self.cfg['hashes'][key],proof['query_source_hashes'][key],key)
  for key in('checkpoint_sql','qualification_sql'):self.assertEqual(self.cfg['hashes'][key],proof['query_source_hashes'][key],key)
  self.assertEqual(self.cfg['sql_contract_sha256'],c.STATE_SHA)
 def test_changed_sql_or_current_contract_is_denied_before_execution(self):
  c=self.c
  with patch.object(c,'STATE_SHA','0'*64):
   with self.assertRaises(ValueError):c.configuration()
  cfg=copy.deepcopy(self.cfg);cfg['prefix']+='-- changed\n'
  with self.assertRaises(ValueError):c.assert_preserved_sql(cfg)
  cfg=copy.deepcopy(self.cfg);cfg['pause_updates'][0]+='-- changed\n'
  with self.assertRaises(ValueError):c.assert_preserved_sql(cfg)
 def test_new_callbacks_only_change_execution_flag_and_contract_pin(self):
  c=self.c;old=c.load(c.PRIOR/'cases.mjs').decode().replace('\r\n','\n');new=c.load(HERE/'cases.mjs').decode().replace('\r\n','\n')
  flag=re.search(r'export const EXECUTION_ENABLED = (?:true|false);',new)[0]
  expected=old.replace('export const EXECUTION_ENABLED = true;',flag).replace(c.PRIOR_STATE_SHA,c.STATE_SHA)
  self.assertEqual(new,expected);self.assertEqual(c.sha(c.load(c.PRIOR/'compiler.py')),c.PRIOR_COMPILER_SHA)
  self.assertEqual(c.sha(c.load(c.PRIOR/'cases.mjs')),c.PRIOR_CASES_SHA)
 def test_new_purpose_and_claims_retain_ownership_and_cleanup_guards(self):
  text=self.source
  for marker in ['worker39-anchor-concurrency','worker39-anchor-processing-concurrency','eps.worker39anchor.run','eps-w39a-', 'all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','prior_fourth_passed_proof','sql_fragments_byte_identical_to_prior_proof']:
   self.assertIn(marker,text)
  self.assertNotIn("'.local/worker39-concurrency'",text)
  self.assertLess(text.index('assert(worker39.EXECUTION_ENABLED'),text.index('port.verifyLocalTarget()'))
 def test_actual_wire_and_observer_sql_parse(self):
  from pglast import parse_sql
  cfg=self.cfg
  for sql in [cfg['prefix']+'rollback;',cfg['snapshot_sql']+';',cfg['comparable_sql']+';','select '+cfg['lifecycle_sql']+';',cfg['checkpoint_sql'],*cfg['pause_updates'],*cfg['resume_updates'],*[cfg[key].replace('__WORKER39_CAPTURED_PREIMAGE_SQL__',"'{}'::jsonb")for key in('precondition_template','postcondition_template','full_postcondition_template')]]:parse_sql(sql)
  templates=re.findall(r'observer\.request\(`(.*?)`\)',(HERE/'cases.mjs').read_text(),re.S);self.assertEqual(len(templates),2)
  program="import fs from'node:fs';const p=JSON.parse(fs.readFileSync(0,'utf8'));const literal=t=>String.fromCharCode(39)+t.replaceAll(String.fromCharCode(39),String.fromCharCode(39,39))+String.fromCharCode(39);const out=[];for(const text of p.templates){const render=Function('blocked','blocker','configOnly','cfg','literal','b','return `'+text+'`');for(const branch of [true,false])out.push(render({pid:394},{pid:417},branch,{tables:p.tables},literal,{pid:512}));}process.stdout.write(JSON.stringify(out));"
  done=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',program],input=json.dumps({'templates':templates,'tables':cfg['tables']}).encode(),capture_output=True,timeout=10);self.assertEqual(done.returncode,0)
  for sql in json.loads(done.stdout):parse_sql(sql)

if __name__=='__main__':unittest.main()
