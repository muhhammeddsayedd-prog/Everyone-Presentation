from pathlib import Path
import importlib.util,json,unittest
spec=importlib.util.spec_from_file_location('response3',Path(__file__).with_name('diagnostic-response-v3.py'));d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
class ParserTests(unittest.TestCase):
 def test_observed_nested_cli_error_preserves_native_state(self):
  nested=json.dumps({'message':'Failed to run sql query: ERROR:  22012: division by zero\nCONTEXT: private context'})
  value=d.safe_errors(json.dumps({'_tag':'Error','error':{'code':'DbQueryUnexpectedStatusError','message':'unexpected status 400: '+nested}}),'')
  self.assertEqual(value['sqlstates'],['22012']);self.assertEqual(value['http_status'],400);self.assertEqual(value['sanitized_native_error'],'division by zero');self.assertNotIn('private',json.dumps(value))
 def test_unknown_native_error_is_sanitized_not_discarded(self):
  message='Failed to run sql query: ERROR:  42501: must be owner of table sessions\nQUERY: select private'
  value=d.safe_errors(json.dumps({'_tag':'Error','error':{'code':'DbQueryUnexpectedStatusError','message':'unexpected status 400: '+json.dumps({'message':message})}}),'')
  self.assertEqual(value['sqlstates'],['42501']);self.assertTrue(value['fixed_error_flags']['must_own_auth_sessions']);self.assertEqual(value['sanitized_native_error'],'must be owner of table sessions')
 def test_urls_emails_credentials_long_values_and_context_removed(self):
  message='ERROR:  42501: denied https://private.invalid/secret a@example.invalid Bearer secret-example-token sbp_secretvalue12345678901234567890 abcdefghijklmnopqrstuvwxyz\nDETAIL: sensitive'
  value=d.safe_errors(json.dumps({'error':{'message':message}}),'');encoded=json.dumps(value)
  for secret in ['private.invalid','a@example.invalid','secret-example-token','sbp_secretvalue12345678901234567890','abcdefghijklmnopqrstuvwxyz','sensitive']:self.assertNotIn(secret,encoded)
  self.assertLessEqual(len(value['sanitized_native_error']),300)
 def test_echoed_query_markers_do_not_become_actual_source_error(self):
  value=d.safe_errors(json.dumps({'error':{'message':'ERROR:  22012: division by zero\nQUERY: '+d.MARKERS[0]}}),'')
  self.assertEqual(value['known_source_markers'],[])
if __name__=='__main__':unittest.main()
