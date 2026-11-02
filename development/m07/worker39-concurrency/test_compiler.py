"""Parser/source guards only. No Docker, database, provider or old main."""
from pathlib import Path
import importlib.util,json,re,subprocess,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker39_compiler_tests',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.source,cls.cfg=c.compile_source('.local/worker39-concurrency-source/synthetic-guard-test.mjs')
 def test_real_state4c_queries_and_all_five_update_blocks_parse(self):
  from pglast import parse_sql
  cfg=self.cfg;self.assertEqual(cfg['sql_contract_sha256'],c.STATE_SHA);self.assertNotIn('select',cfg['prefix'].lower());self.assertIn('in access exclusive mode',cfg['prefix']);self.assertIn('eps.project_creation_intents in share mode',cfg['prefix']);self.assertEqual(len(cfg['tables']),5)
  for sql in[cfg['prefix']+'rollback;',cfg['snapshot_sql']+';',cfg['comparable_sql']+';','select '+cfg['lifecycle_sql']+';',*cfg['pause_updates'],*cfg['resume_updates'],*[cfg[k].replace('__WORKER39_CAPTURED_PREIMAGE_SQL__',"'{}'::jsonb")for k in('precondition_template','postcondition_template','full_postcondition_template')]]:parse_sql(sql)
  self.assertEqual(len(cfg['pause_updates']),5);self.assertEqual(len(cfg['resume_updates']),5);self.assertIn('project_creation_intents',cfg['snapshot_sql'])
 def test_new_disabled_purpose_preserves_owned_bootstrap_cleanup_and_source_fences(self):
  text=self.source
  self.assertLess(text.index("assert(worker39.EXECUTION_ENABLED"),text.index('port.verifyLocalTarget()'));self.assertIn('--network',text);self.assertIn("'none'",text);self.assertIn('all_owned_resources_absent',text);self.assertIn('original_data_catalogue_and_global_roles_unchanged',text);self.assertIn('shared_lock_released',text)
  self.assertIn('worker39.runCases',text);self.assertNotIn("report.checkpoint = 'same-key-independent-session-race'",text);self.assertIn('all_preexisting_rows_except_explicit_fixture_config_setup_preserved',text);self.assertIn("version,statements,name)values('20261101223342'",text)
  self.assertRegex((HERE/'cases.mjs').read_text(),r'export const EXECUTION_ENABLED = (?:true|false);')
 def test_changed_current_contract_is_denied_before_configuration(self):
  with patch.object(c,'STATE_SHA','0'*64):
   with self.assertRaises(ValueError):c.configuration()
 def test_owned_fixture_adaptation_is_finite_and_production_rpcs_are_not_replaced(self):
  program="import fs from'node:fs';const m=await import("+json.dumps((HERE/'cases.mjs').as_uri())+");const p=JSON.parse(fs.readFileSync(0,'utf8'));const a=m.adaptFixture(Buffer.from(p.raw),p.identity,p.run);process.stdout.write(JSON.stringify({replacements:a.replacements.length,text:a.text,enabled:m.EXECUTION_ENABLED}));"
  raw=c.load(c.MAIN/c.FIXTURE).decode();value={'raw':raw,'identity':{'database':'project39','system_identifier':'7703000000000000000'},'run':'11111111-1111-4111-8111-111111111111'}
  done=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',program],input=json.dumps(value).encode(),capture_output=True,timeout=10);self.assertEqual(done.returncode,0);a=json.loads(done.stdout);self.assertIs(type(a['enabled']),bool);self.assertEqual(a['replacements'],5)
  self.assertIn("max(version)from supabase_migrations.schema_migrations)<>'20261101223342'",a['text']);self.assertIn('return public.eps_submit_specs(',a['text']);self.assertIn('result:=public.eps_retry_job(',a['text']);self.assertNotIn('create function public.eps_submit_specs',a['text'])
 def test_actual_snapshot_expressions_use_direct_psql_json_values_not_cli_wrappers(self):
  text=(HERE/'cases.mjs').read_text();snap=next(line.strip()for line in text.splitlines()if line.strip().startswith('const snap = async'))
  observed=re.search(r'const observed = ([^;]+);',text)[1]
  program="import assert from'node:assert/strict';const actual={canonical:{synthetic:true},intent_data:{count:0}};const only=r=>{assert.equal(r.length,1);return r[0];};const cfg={snapshot_sql:'select synthetic'};const control={request:async()=>[actual]};"+snap+"assert.deepEqual(await snap(),actual);const visible={rows:[actual]};assert.deepEqual("+observed+",actual);control.request=async()=>[{worker39_snapshot:actual}];assert.notDeepEqual(await snap(),actual);console.log('PASS_DIRECT_PSQL_JSON');"
  done=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',program],capture_output=True,timeout=10);self.assertEqual(done.returncode,0);self.assertIn(b'PASS_DIRECT_PSQL_JSON',done.stdout)
if __name__=='__main__':unittest.main()
