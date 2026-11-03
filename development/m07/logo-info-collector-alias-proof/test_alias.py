from pathlib import Path
import importlib.util,json,subprocess,tempfile,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('collector_alias_compiler_tests',HERE/'compiler.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
RUN='8a100000-0000-4000-8000-000000000001'
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.source,cls.bridge,cls.entry,cls.proof=m.compile_source('.local/logo-info-collector-alias-compiled/controller-'+RUN+'.mjs')
  begin=cls.source.index('const cfg=')+len('const cfg=');cls.cfg,_=json.JSONDecoder().raw_decode(cls.source[begin:])
 def test_precise14_condition_inverse_source_binding_and_no_fixture_change(self):
  for name in('parent_controller_inverse_byte_equal','parent_entry_inverse_byte_equal','parent_bridge_inverse_byte_equal','only14ROWconditions_change_actual_collector_and_checkpoint'):self.assertTrue(self.proof[name])
  self.assertIn('logo-info-collector-alias-once',self.entry);self.assertIn('eps.logoalias.run',self.source)
  self.assertIn('resource_id',self.source);self.assertIn("':resource'||n)::uuid",self.source)
  self.assertTrue(any('logo-info-canonical-alias-release/state.py'in p.replace('\\','/')for p in self.proof['source_pins']))
 def test_inherited_actual8setup_fake_SQL_and_schema_regression(self):
  parent=m.module('alias_collector_actual_frozen_resource_tests',m.OLD/'test_resource.py')
  parent.Tests.test_inherited_actual_setup_fake_port_executes_and_parses_without_change(self)
  parent.Tests.test_schema_required_resource_field_old_RED_new_GREEN(self)
 def test_local_dispatch_same_code_independent_globals_and_corrected_SQL(self):
  local=m.module('alias_local_binding_test',HERE/'local.py')
  self.assertIs(local.dispatch.__code__,local.old.dispatch.__code__);self.assertIsNot(local.dispatch.__globals__,local.old.dispatch.__globals__)
  c=local.Context();canonical=local.alias.Context();qualified=local.old.old.qualify_oauth_count(canonical.state_sql(),3,2)
  self.assertEqual(c.state_sql(),qualified)
  self.assertEqual(self.cfg['snapshot_sql'],qualified)
 def test_generated_three_scripts_and_default_off_before_ports(self):
  with tempfile.TemporaryDirectory()as directory:
   root=Path(directory);entry=root/'entry.mjs'
   source=self.source.replace((m.MAIN/'.local/logo-info-collector-alias-compiled'/('entry-'+RUN+'.mjs')).as_uri(),entry.as_uri())
   for name,text in [('entry.mjs',self.entry),('bridge.mjs',self.bridge),('controller.mjs',source)]:
    file=root/name;file.write_text(text,encoding='utf8',newline='\n');result=subprocess.run(['node','--check',str(file)],capture_output=True,text=True,timeout=15);self.assertEqual(result.returncode,0,'syntax check failed')
   script='const m=await import('+json.dumps((root/'controller.mjs').as_uri())+");try{await m.runRace('D:/unreachable');process.exitCode=2}catch(e){if(e.message!=='LOGO_INFO_COLLECTOR_DISABLED')process.exitCode=3}"
   result=subprocess.run(['node','--input-type=module','-e',script],capture_output=True,text=True,timeout=15);self.assertEqual(result.returncode,0,result.stderr)
if __name__=='__main__':unittest.main()
