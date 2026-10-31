from pathlib import Path
import importlib.util,json,unittest
spec=importlib.util.spec_from_file_location('wire4',Path(__file__).with_name('diagnostic-wire-v4.py'));d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
class CorrectedParserTests(unittest.TestCase):
 def test_double_escaped_native_message_drops_line_and_source(self):
  native='Failed to run sql query: ERROR:  42601: missing \\\"THEN\\\" at end of SQL expression\\nLINE 31: source-prefix QUERY: private'
  cli=json.dumps({'_tag':'Error','error':{'code':'DbQueryUnexpectedStatusError','message':'unexpected status 400: '+json.dumps({'message':native})}})
  value=d.safe_errors(cli,'');self.assertEqual(value['sqlstates'],['42601']);self.assertEqual(value['sanitized_native_error'],'missing "THEN" at end of SQL expression')
  for token in ['LINE','source-prefix','QUERY','private']:self.assertNotIn(token,json.dumps(value))
 def test_actual_nested_native_permission_message(self):
  cli=json.dumps({'_tag':'Error','error':{'code':'DbQueryUnexpectedStatusError','message':'unexpected status 400: '+json.dumps({'message':'Failed to run sql query: ERROR:  42501: must be owner of table sessions\nCONTEXT: private'})}})
  value=d.safe_errors(cli,'');self.assertEqual(value['sqlstates'],['42501']);self.assertEqual(value['sanitized_native_error'],'must be owner of table sessions');self.assertNotIn('private',json.dumps(value))
 def test_credentials_urls_emails_and_long_values_redacted(self):
  value=d.safe_errors(json.dumps({'error':{'message':'ERROR:  42501: denied https://private.invalid/secret a@example.invalid Bearer secret-example-token sbp_secretvalue12345678901234567890 abcdefghijklmnopqrstuvwxyz\\nCONTEXT: secret'}}),'')
  for token in ['private.invalid','a@example.invalid','secret-example-token','sbp_secretvalue12345678901234567890','abcdefghijklmnopqrstuvwxyz','CONTEXT']:self.assertNotIn(token,json.dumps(value))
 def test_render_is_whole_corrected_wire_without_commit(self):
  before={'catalogue':d.v2.stable_catalogue(json.loads(d.v2.BASELINE.read_text())['catalogue']),'protected_m02':{'id':'b3f90268-147d-41d4-8875-2a6435df1496','status':'waiting_for_input','stage':'apply_specs','attempt':3,'row_version':7},'new_objects':dict.fromkeys(('role','table','claim','finish'),False),'security':None}
  sql=d.render(before,'60000000-0000-4000-8000-000000000001');self.assertEqual(sql.count('::jsonb then'),2);self.assertNotIn('::jsonbthen',sql);self.assertTrue(sql.rstrip().endswith('rollback;'));self.assertNotIn('\ncommit;',sql);self.assertIn('OAUTH_CONSENT_RELEASE_POSTCONDITION_FAILED',sql)
if __name__=='__main__':unittest.main()
