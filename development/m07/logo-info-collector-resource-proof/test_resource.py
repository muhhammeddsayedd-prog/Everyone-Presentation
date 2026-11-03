"""Schema-derived fixture regression plus inherited fake setup, no SQL/Docker."""
from pathlib import Path
import importlib.util,json,re,subprocess,tempfile,unittest
from pglast import parse_sql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('logo41_resource_tests_compiler',HERE/'compiler.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
RUN='8a100000-0000-4000-8000-000000000001'

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.source,cls.bridge,cls.entry,cls.proof=m.compile_source('.local/logo-info-collector-resource-compiled/controller-'+RUN+'.mjs')
  begin=cls.source.index('const cfg=')+len('const cfg=');cls.cfg,_=json.JSONDecoder().raw_decode(cls.source[begin:])
 def test_all_three_exact_inverses_and_fresh_ownership(self):
  for key in('parent_controller_inverse_byte_equal','parent_entry_inverse_byte_equal','parent_bridge_inverse_byte_equal','fixture_only_adds_required_resource_id'):self.assertTrue(self.proof[key])
  self.assertIn('.local/logo-info-collector-resource-once',self.entry);self.assertIn('eps.logoresource.run',self.source);self.assertIn('logo-info-collector-proof/resource-successor',self.source)
  self.assertEqual(self.cfg['version'],'20261103031200')
 def test_inherited_actual_setup_fake_port_executes_and_parses_without_change(self):
  parent=m.module('logo41_resource_frozen_setup_test',m.OLD/'test_proof.py')
  parent.Tests.test_actual_setup_expressions_execute_only_fake_sql_and_parse(self)
 def test_schema_required_resource_field_old_RED_new_GREEN(self):
  ddl=(m.MAIN/'supabase/migrations/20261028010943_m01_canonical_foundation.sql').read_text()
  table=next(item.stmt for item in parse_sql(ddl)if type(item.stmt).__name__=='CreateStmt'and item.stmt.relation.schemaname=='eps'and item.stmt.relation.relname=='audit_events')
  required=set()
  for column in table.tableElts:
   if type(column).__name__!='ColumnDef':continue
   kinds={constraint.contype.name for constraint in column.constraints or()}
   if 'CONSTR_NOTNULL'in kinds and 'CONSTR_DEFAULT'not in kinds:required.add(column.colname)
  self.assertIn('resource_id',required)
  match=re.search(r'insert into eps.audit_events\(([^)]+)\)select',self.source);self.assertIsNotNone(match)
  columns=set(match[1].split(','));self.assertTrue(required<=columns)
  # Exact missing field responsible for925: original columns fail schema need.
  with self.assertRaises(AssertionError):self.assertTrue(required<=(columns-{'resource_id'}))
  self.assertIn("':resource'||n)::uuid",self.source)
 def test_three_generated_scripts_syntax_and_default_off(self):
  with tempfile.TemporaryDirectory()as directory:
   root=Path(directory);entry=root/'entry.mjs';entry.write_text(self.entry,encoding='utf8',newline='\n')
   source=self.source.replace((m.MAIN/'.local/logo-info-collector-resource-compiled'/('entry-'+RUN+'.mjs')).as_uri(),entry.as_uri())
   for name,text in [('controller.mjs',source),('bridge.mjs',self.bridge),('entry.mjs',self.entry)]:
    file=root/name;file.write_text(text,encoding='utf8',newline='\n');result=subprocess.run(['node','--check',str(file)],capture_output=True,text=True,timeout=15);self.assertEqual(result.returncode,0,'Node syntax refused')
   script='const m=await import('+json.dumps((root/'controller.mjs').as_uri())+");try{await m.runRace('D:/unreachable');process.exitCode=2}catch(e){if(e.message!=='LOGO_INFO_COLLECTOR_DISABLED')process.exitCode=3}"
   result=subprocess.run(['node','--input-type=module','-e',script],capture_output=True,text=True,timeout=15);self.assertEqual(result.returncode,0,result.stderr)

if __name__=='__main__':unittest.main()
