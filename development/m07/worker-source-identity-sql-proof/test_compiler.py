"""Default-off whole composition and exact SQL/source inverse checks only."""
from pathlib import Path
import importlib.util,json,subprocess,unittest
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker40_owned_compiler_tests',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
UUID='00000000-0000-4000-8000-000000000001'
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.source,cls.concurrency,cls.plan=c.compile_source('.local/worker-source-identity-sql-compiled/controller-'+UUID+'.mjs')
 def test_new_purpose_disabled_before_original_target_and_Docker_with_permanent_compile_claim(self):
  self.assertFalse(self.plan['execution_enabled']);self.assertTrue(self.plan['compiled_only']);self.assertFalse(self.plan['execution_dispatched']);self.assertTrue(self.plan['bootstrap_inverse_byte_equal']);self.assertTrue(self.plan['concurrency_projection']['exact_inverse_byte_equal'])
  self.assertLess(self.source.index("assert(worker40.EXECUTION_ENABLED"),self.source.index('const runId = randomUUID()'));self.assertLess(self.source.index('report.dispatch_once_claim_created=true'),self.source.index('port = await import'));self.assertIn("'--network', 'none'",self.source);self.assertIn('original_data_catalogue_and_global_roles_unchanged',self.source);self.assertIn('all_owned_resources_absent',self.source)
 def test_actual_generated_JS_sources_and_entry_parse_without_execution(self):
  for name,text in(('controller',self.source),('concurrency',self.concurrency),('entry',(HERE/'cases.mjs').read_text())):
   result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','--check'],input=text.encode(),capture_output=True,timeout=10);self.assertEqual(result.returncode,0,(name,result.stderr[:200]))
 def test_default_off_entry_refuses_before_any_port_or_private_source_read(self):
  code="const m=await import("+json.dumps((HERE/'cases.mjs').as_uri())+");let read=false;try{await m.runCases(new Proxy({},{get(){read=true;throw Error('PORT')}}),{})}catch(error){if(error.message!=='WORKER40_SQL_PROOF_DISABLED')throw error;}if(read)throw Error('PORT_BEFORE_FLAG');"
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',code],capture_output=True,timeout=10);self.assertEqual(result.returncode,0,result.stderr[:200])
 def test_actual_snapshot_checkpoint_config_and_managed_templates_parse(self):
  cfg=c.configuration();parse_sql(cfg['snapshot_sql']);parse_sql(cfg['checkpoint_sql']);system=c.l.m.literal('1234567890123456789');run=c.l.m.literal(UUID)
  for key,prefix in(('qualification_sql','WORKER39_OWNED'),('config_setup_sql','REASON40_FIXTURE'),('managed_fixture_sql','FORWARD')):
   text=cfg[key].replace('__'+prefix+'_SYSTEM_SQL__',system).replace('__'+prefix+'_RUN_SQL__',run);parse_sql(text);parse_plpgsql(text)
  self.assertEqual(cfg['native_pin_value'],c.l.NEW_NATIVE);self.assertEqual(cfg['owned_oauth_count_qualification'],{'canonical':3,'owned':2,'inverse_byte_equal':True})
 def test_unknown_controller_namespace_and_compile_ID_refuse(self):
  for relative in('.local/old-purpose/controller-'+UUID+'.mjs','.local/worker-source-identity-sql-compiled/controller-../escape.mjs'):
   with self.assertRaises(ValueError):c.compile_source(relative)
 def test_actual_reason_fixture_parses_and_only_inserts_new_link_before_real_revoke(self):
  program="const m=await import("+json.dumps((HERE/'cases.mjs').as_uri())+");process.stdout.write(m.reasonFixture("+json.dumps(UUID)+"));";result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',program],capture_output=True,timeout=10);self.assertEqual(result.returncode,0,result.stderr[:200]);sql=result.stdout.decode();parse_sql(sql);parse_plpgsql(sql)
  self.assertIn('public.eps_create_presentation_series',sql);self.assertIn('public.eps_revoke_review_link',sql);self.assertIn('insert into eps.review_links',sql);self.assertNotIn('update eps.review_gateway',sql);self.assertNotIn('delete from',sql.lower());self.assertNotIn('update eps.presentation_versions',sql.lower())
if __name__=='__main__':unittest.main()
