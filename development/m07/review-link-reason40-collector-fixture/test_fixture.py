"""Pure source tests for a new purpose. No SQL/Docker/provider execution."""
from pathlib import Path
import hashlib,importlib.util,json,re,subprocess,unittest
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
f=module('new_config_fixture',HERE/'fixture.py');c=module('new_config_compiler',HERE/'compiler.py')

class Tests(unittest.TestCase):
 def test_exact_copy_preimages_and_minimum_missing_fields(self):
  sql,rows=f.configuration();self.assertEqual(set(rows),set(f.ROWS));self.assertEqual(len(rows),5)
  self.assertEqual(rows['candidate_asset_config']['actual_changed_fields'],['enabled','extraction_model','transcription_model'])
  self.assertEqual(rows['specs_pipeline_config']['actual_changed_fields'],['document_preparation_version','enabled','model_version','prompt_version','result_schema_version'])
  self.assertEqual(rows['frame_extraction_config']['actual_changed_fields'],['enabled','native_image_id']);self.assertEqual(rows['presentation_processing_config']['actual_changed_fields'],[]);self.assertEqual(rows['review_processing_config']['actual_changed_fields'],[])
  candidate=rows['candidate_asset_config'];self.assertIsNone(candidate['before']['transcription_model']);self.assertIsNone(candidate['before']['extraction_model']);self.assertIn('transcription_model IS NOT NULL',candidate['exact_backup_constraints']['candidate_asset_config_check']);self.assertTrue(all(1<=len(candidate['after'][key])<=200 for key in('transcription_model','extraction_model')))
  spec=rows['specs_pipeline_config'];self.assertTrue(all(spec['before'][key]is None and 1<=len(spec['after'][key])<=200 and spec['after'][key]==spec['after'][key].strip()for key in('document_preparation_version','model_version','prompt_version','result_schema_version')))
  self.assertEqual(sql.count('update eps.'),5);self.assertNotIn('alter table',sql.lower());self.assertNotIn('disable trigger',sql.lower());self.assertNotIn('insert into',sql.lower())
 def test_actual_fixture_sql_and_plpgsql_parse(self):
  sql,_=f.configuration();sql=sql.replace('__REASON40_FIXTURE_SYSTEM_SQL__',"'123'").replace('__REASON40_FIXTURE_RUN_SQL__',"'newrun'");self.assertEqual(len(parse_sql(sql)),2)
  body=re.search(r'do \$reason40_config\$(.*?)\$reason40_config\$;',sql,re.S)[1];self.assertEqual(len(parse_plpgsql('create function pg_temp.check_fixture()returns void language plpgsql as $body$'+body+'$body$;')),1)
 def test_compiler_reuses_frozen_queries_cases_and_closed_admission_namespace(self):
  source,cfg=c.compile_source('.local/reason40-collector-fixture-source/offline.mjs')
  self.assertEqual(hashlib.sha256(cfg['state_sql'].encode()).hexdigest(),'9b352fb4b3a14e31e396b7fee03c9cd991cea4bbacf663ea094830ba9d2e6133');self.assertEqual(hashlib.sha256(cfg['checkpoint_sql'].encode()).hexdigest(),'4737f4ff1cf4ead4faf654b439cd879cbe9974c84058aa70b43100550f8978b7');self.assertEqual(hashlib.sha256(cfg['qualification_sql'].encode()).hexdigest(),'9ca76b04b6061abb12908e89a6a0f7dbd22985525a89fab8b439a5a3c69e17fd')
  self.assertIn("'.local/reason40-collector-fixture-validation'",source);self.assertIn("'eps.reason40fixture.run'",source);self.assertIn("'tracking/evidence/m07/reason40-collector-validation'",source);self.assertIn('prior_failed_run',source);self.assertIn('synthetic_config_fixture',cfg)
  for name,sha in c.PINS.items():self.assertEqual(hashlib.sha256((c.PRIOR/name).read_bytes()).hexdigest(),sha)
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--check','--input-type=module'],input=source.encode(),capture_output=True,timeout=10);self.assertEqual(result.returncode,0)
 def test_new_default_off_guard_precedes_frozen_library_and_target(self):
  script='const m=await import('+json.dumps((HERE/'cases.mjs').as_uri())+');if(m.EXECUTION_ENABLED)process.exit(8);try{await m.runCases({get system(){throw Error("touched");}},{});process.exit(9);}catch(e){if(e.code!=="ERR_ASSERTION"||!e.message.includes("DISABLED"))process.exit(7);}'
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',script],capture_output=True,timeout=10);self.assertEqual(result.returncode,0)

if __name__=='__main__':unittest.main()
