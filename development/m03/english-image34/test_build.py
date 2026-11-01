from pathlib import Path
import importlib.util, unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('image34build',HERE/'build-image.py');build=importlib.util.module_from_spec(spec);spec.loader.exec_module(build)
class Guards(unittest.TestCase):
 def test_native_frozen_graph(self):self.assertEqual(build.verify_context('native')['file_count'],160)
 def test_fixed_native_command_has_no_build_credentials(self):
  command=build.command('native',build.PRIVATE/'native-build.metadata.json');self.assertIn(build.HOST,command);self.assertIn('default',command);self.assertIn('linux/amd64',command)
  output=command[command.index('--output')+1];self.assertIn('native:english34-auth-4186fd1e',output);self.assertIn('compression=zstd',output)
  for forbidden in ['--secret','--build-arg','--ssh','--network','--allow']:self.assertNotIn(forbidden,command)
 def test_environment_has_fixed_host_and_no_debug(self):
  env=build.environment();self.assertEqual(env['DOCKER_HOST'],build.HOST);self.assertNotIn('DEBUG',env);self.assertEqual(env['DOCKER_CONFIG'],str(build.refresh.DOCKER_CONFIG))
 def test_import_gate_requires_uncached_complete_step(self):
  raw=('#22 [stage-1 12/12] '+build.IMPORT+'\n#22 DONE 2.0s\n').encode();self.assertEqual(build.import_gate(raw,'daemon')['user'],'1000:1000')
  with self.assertRaises(ValueError):build.import_gate(raw.replace(b'DONE 2.0s',b'CACHED'),'daemon')
  with self.assertRaises(ValueError):build.import_gate(raw.replace(b'DONE 2.0s',b'ERROR failed'),'daemon')
 def test_progress_does_not_include_raw_error_or_token(self):
  value=build.progress(b'#1 DONE 1.0s\n#2 CACHED\n#3 ERROR privateToken 403 Forbidden\n');self.assertTrue(value['http_403_observed']);self.assertNotIn('privateToken',str(value))
 def test_refresh_and_tool_pins(self):self.assertEqual(build.source_pins()['refresh_receipt_sha256'],build.REFRESH_SHA)
if __name__=='__main__':unittest.main()
