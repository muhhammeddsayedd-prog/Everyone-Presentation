"""Offline owned-adapter tests; no SQL/Docker/provider calls."""
from pathlib import Path
import copy,importlib.util,json,subprocess,unittest
from pglast import parse_sql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('test_reason40_local_adapter',HERE/'local.py');local=importlib.util.module_from_spec(spec);spec.loader.exec_module(local);s=local.s
spec=importlib.util.spec_from_file_location('test_reason40_local_compiler',HERE/'local-compiler.py');compiler=importlib.util.module_from_spec(spec);spec.loader.exec_module(compiler)
spec=importlib.util.spec_from_file_location('test_reason40_release_fixture',HERE/'test_release.py');fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)

class TestLocal(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.base=s.Context();fixture.TestRelease.c=cls.base
 def before(self):
  value=fixture.TestRelease().before();base=value['canonical']['base'];base.update(database='project39',cli_role_safe=False,protected_m02_integrity=False,protected_m02={'synthetic_fixture':'only'});return value
 def context(self):return local.OwnedContext().bind(self.before(),'999111222333444555','734df9f4-7bc5-405d-9548-fba3ef7fb439')
 def test_qualifications_are_owned_only_and_fresh_identity_stays_exact(self):
  before=self.before()
  with self.assertRaises(ValueError):self.base.check(before,False)
  c=self.context();c.check(before,False);after=c.expected(before);c.transition(before,after)
  changed=copy.deepcopy(after);changed['canonical']['base']['protected_m02']={'changed':'fixture'}
  with self.assertRaises(ValueError):c.check(changed,True)
  with self.assertRaises(ValueError):local.OwnedContext().bind(before,local.ORIGINAL_SYSTEM,c.run)
 def test_actual_collector_bytes_and_inverse_render_guard(self):
  c=self.context();self.assertEqual(c.state_sql(),self.base.state_sql());self.assertEqual(c.checkpoint_sql(),self.base.checkpoint_sql())
  marker='97c37609-4166-4fa8-bff8-a53bacda635e';canonical=s.Context.render(c,self.before(),marker);owned=c.render(self.before(),marker)
  old="current_database()<>'postgres'";new="current_database()<>'project39'or(pg_control_system()).system_identifier::text<>"+s.literal(c.system)+"or current_setting('eps.reason40collector.run',true)is distinct from "+s.literal(c.run)
  self.assertEqual(s.replace_once(owned,new,old),canonical);self.assertEqual(s.sha(self.base.migration),s.MIGRATION_SHA);parse_sql(owned)
 def test_existing_exact_three_row_qualification_and_config_scope(self):
  cfg=local.configuration();self.assertEqual(len(cfg['qualification_rows']),3);self.assertTrue(cfg['qualification_rows'][2]['trigger_only']);self.assertEqual(len(cfg['config_setup_tables']),5);self.assertEqual(cfg['config_setup_sql'].count('update eps.'),5)
  self.assertIn(s.NATIVE,cfg['config_setup_sql']);self.assertNotIn('disable trigger',cfg['qualification_sql'].lower());self.assertNotIn('update eps.presentation_versions',cfg['qualification_sql'].lower())
  parse_sql(cfg['qualification_sql'].replace('__WORKER39_OWNED_SYSTEM_SQL__',"'123'").replace('__WORKER39_OWNED_RUN_SQL__',"'run'"));parse_sql(cfg['config_setup_sql'])
 def test_default_off_callback_refuses_before_target_and_compile_does_not_write(self):
  url=(HERE/'local-cases.mjs').as_uri();script='const m=await import('+json.dumps(url)+');if(m.EXECUTION_ENABLED)process.exit(8);try{await m.runCases({get system(){throw Error("target touched");}},{});process.exit(9);}catch(e){if(e.code!=="ERR_ASSERTION"||!e.message.includes("DISABLED"))process.exit(7);}'
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',script],capture_output=True,timeout=10);self.assertEqual(result.returncode,0)
  directory=s.SOURCE/'.local/reason40-collector-validation-source';before=list(directory.glob('*'))if directory.exists()else[]
  source,cfg=compiler.compile_source('.local/reason40-collector-validation-source/offline-test.mjs');self.assertEqual(list(directory.glob('*'))if directory.exists()else[],before)
  self.assertIn('eps.reason40collector.run',source);self.assertIn('report.all_other_cloned_old_column_rows_preserved=true',source);self.assertNotIn("const sameKey =",source);self.assertNotIn("insert into auth.users(id,is_anonymous)values('${ACTOR}'",source)
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--check','--input-type=module'],input=source.encode(),capture_output=True,timeout=10);self.assertEqual(result.returncode,0)

if __name__=='__main__':unittest.main()
