from pathlib import Path
import importlib.util, unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('image34continuation',HERE/'build-image-v2.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class Guards(unittest.TestCase):
 def test_frozen_first_operator_preserved(self):self.assertEqual(module.sha(module.FROZEN.read_bytes()),module.FROZEN_SHA)
 def test_separate_tag_and_claim_directory(self):
  self.assertEqual(module.base.TAG,'english34-auth2-4186fd1e');self.assertEqual(module.base.PRIVATE,module.ROOT/'.local/m03-english-image34-continuation')
 def test_only_program_files_added_to_fixed_environment(self):
  old=module.original_environment();new=module.environment();self.assertEqual(new.pop('ProgramFiles'),'C:/Program Files');self.assertEqual(old,new)
 def test_plugin_and_fresh_successful_readonly_discovery(self):self.assertTrue(module.sources()['program_files_explicitly_forwarded'])
 def test_original_source_and_metadata_fences_preserved(self):
  self.assertEqual(module.base.verify_context('native')['source_sha256'],module.base.SOURCE)
  command=module.base.command('native',module.base.PRIVATE/'native-build.metadata.json');self.assertIn(module.base.HOST,command);self.assertIn('native:english34-auth2-4186fd1e',command[command.index('--output')+1])
if __name__=='__main__':unittest.main()
