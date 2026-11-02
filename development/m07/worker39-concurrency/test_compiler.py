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
  self.assertLess(text.index("assert(worker39.EXECUTION_ENABLED"),text.index('port.verifyLocalTarget()'))
  for marker in ['--network',"'none'",'all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released','worker39.runCases','all_other_cloned_rows_preserved',"version,statements,name)values('20261101223342'"]:
   self.assertTrue(marker in text,'MISSING_OWNERSHIP_SOURCE_MARKER:'+marker)
  self.assertFalse("report.checkpoint = 'same-key-independent-session-race'"in text)
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
 def test_exact_three_source_fingerprints_and_only_two_direct_updates_plus_normal_trigger(self):
  from pglast import parse_sql,parse_plpgsql
  cfg=self.cfg;sql=cfg['qualification_sql'].replace('__WORKER39_OWNED_SYSTEM_SQL__',"'7703000000000000000'").replace('__WORKER39_OWNED_RUN_SQL__',"'11111111-1111-4111-8111-111111111111'");parse_sql(sql)
  body=re.search(r'do \$fixture_zero\$(.*?)\$fixture_zero\$;',sql,re.S)[1];parse_plpgsql('create function pg_temp.test_qualification()returns void language plpgsql as $test$'+body+';$test$;')
  self.assertEqual(len(cfg['qualification_rows']),3);self.assertEqual(sql.count('get diagnostics changed=row_count'),2);self.assertEqual(sql.count('lease_token_digest=null,lease_expires_at=null where id='),2)
  self.assertIn("'eb636d22-f702-4463-9a4d-63307ae6a835'::uuid",sql);self.assertIn("'0f489b6b-911d-4bbe-8462-088896a31bcd'::uuid",sql);self.assertIn("set status='cancelled'",sql);self.assertIn("set status='dead'",sql)
  self.assertTrue('q.original_row_hash=project39_proof.original_rows.row_hash'in self.source)
  self.assertNotIn('update eps.presentation_versions',sql);self.assertNotIn('disable trigger',sql.lower());self.assertNotIn('session_replication_role',sql);self.assertIn("t.failure_code='JOB_CANCELLED'and t.row_version=3",sql)
  self.assertIn("'bc990999ffdff03c65acfc57d238ae73aca292099b86e78261907b6c616fe72b'",sql);self.assertLess(sql.index("'eps.presentation_versions',t.id"),sql.index('update eps.jobs'))
  spec=importlib.util.spec_from_file_location('qualification_negative_tests',HERE/'qualification.py');q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q);raw=c.load(c.MAIN/'.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql')
  with patch.dict(q.ROWS[0],copy_sha256='0'*64):
   with self.assertRaises(ValueError):q.source_rows(raw)
  with self.assertRaises(ValueError):q.source_rows(raw+b'changed')
 def test_exact_chunked_checkpoint_has76_tables_and_bounded_function_arguments(self):
  from pglast import parse_sql,visitors
  cfg=self.cfg;self.assertEqual(c.sha(cfg['checkpoint_sql'].encode()),c.CHECKPOINT_SHA);self.assertEqual(len(cfg['checkpoint_tables']),76);self.assertIn(cfg['snapshot_sql'],cfg['checkpoint_sql'])
  class Functions(visitors.Visitor):
   def visit_FuncCall(inner,ancestors,node):
    if node.funcname[-1].sval=='jsonb_build_object':self.assertLessEqual(len(node.args or()),100)
  Functions()(parse_sql(cfg['checkpoint_sql']));text=(HERE/'cases.mjs').read_text();self.assertIn("ctx.sql('set session authorization postgres;' + cfg.checkpoint_sql)",text);self.assertNotIn('control.request(cfg.checkpoint_sql)',text);self.assertIn("catch { throw Error('WORKER39_EXACT_CHECKPOINT_VALIDATION_UNCONFIRMED'); }",text)
 def test_every_actual_lock_observer_select_renders_and_parses_for_both_branches(self):
  from pglast import parse_sql
  text=(HERE/'cases.mjs').read_text();templates=re.findall(r'observer\.request\(`(.*?)`\)',text,re.S);self.assertEqual(len(templates),2)
  program="import fs from'node:fs';const p=JSON.parse(fs.readFileSync(0,'utf8'));const literal=t=>String.fromCharCode(39)+t.replaceAll(String.fromCharCode(39),String.fromCharCode(39,39))+String.fromCharCode(39);const out=[];for(const text of p.templates){const render=Function('blocked','blocker','configOnly','cfg','literal','b','return `'+text+'`');for(const branch of [true,false])out.push(render({pid:394},{pid:417},branch,{tables:p.tables},literal,{pid:512}));}process.stdout.write(JSON.stringify(out));"
  done=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',program],input=json.dumps({'templates':templates,'tables':self.cfg['tables']}).encode(),capture_output=True,timeout=10);self.assertEqual(done.returncode,0);queries=json.loads(done.stdout);self.assertEqual(len(queries),4)
  for sql in queries:parse_sql(sql)
  self.assertIn('pid=394 and locktype',queries[0]);self.assertIn('pid=417 and relation',queries[0]);self.assertIn('pid=512 and granted',queries[-1]);self.assertNotEqual(queries[0],queries[1])
if __name__=='__main__':unittest.main()
