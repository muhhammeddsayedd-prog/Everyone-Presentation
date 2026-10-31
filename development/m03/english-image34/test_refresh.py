from pathlib import Path
import importlib.util, unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('vcr_refresh',HERE/'refresh-vcr.py');refresh=importlib.util.module_from_spec(spec);spec.loader.exec_module(refresh)
class Guards(unittest.TestCase):
 def test_no_debug_or_ambient_auth_forwarding(self):
  actual=refresh.environment({'DEBUG':'secret','NODE_OPTIONS':'unsafe','VERCEL_TOKEN':'private','VERCEL_VCR_REGISTRY':'evil','DOCKER_CONFIG':'evil','PATH':'evil','SystemRoot':'C:/Windows'})
  self.assertNotIn('DEBUG',actual);self.assertNotIn('NODE_OPTIONS',actual);self.assertNotIn('VERCEL_TOKEN',actual);self.assertNotIn('VERCEL_VCR_REGISTRY',actual)
  self.assertEqual(actual['DOCKER_CONFIG'],str(refresh.DOCKER_CONFIG));self.assertEqual(actual['PATH'],str(refresh.DOCKER.parent))
 def test_exact_project_and_scope(self):
  command=refresh.cli(['vcr','login','docker','--project',refresh.PROJECT,'--format','json'])
  self.assertIn(refresh.PROJECT,command);self.assertIn('muhammed-abdelrahman',command);self.assertNotIn('--token',command);self.assertNotIn('--debug',command)
 def test_exact_success_schema(self):
  value={'status':'success','engine':'docker','registry':'vcr.vercel.com','username':'oidc','validForHours':12};self.assertEqual(refresh.login_result(value),value)
  with self.assertRaises(ValueError):refresh.login_result({**value,'token':'private'})
 def test_existing_source_and_cli_pins(self):self.assertEqual(refresh.sources()['failure_receipt_sha256'],refresh.FAILURE_SHA)
if __name__=='__main__':unittest.main()
