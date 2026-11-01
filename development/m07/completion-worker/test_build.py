"""Local source/command guards; no Docker or provider operation."""
from pathlib import Path
import importlib.util, os, subprocess, unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent

class Tests(unittest.TestCase):
 def setUp(self):
  spec=importlib.util.spec_from_file_location('completion_worker_test',HERE/'build.py')
  self.b=importlib.util.module_from_spec(spec);spec.loader.exec_module(self.b)
 def test_import_is_inert(self):
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):
   self.setUp()
 def test_current_context_and_owner_have_no_private_files(self):
  value=self.b.context('native');self.assertEqual(value['file_count'],165);self.assertEqual(value['context_files'],169)
  self.assertEqual(value['private_pattern_hits'],0);self.assertEqual(value['source_sha256'],self.b.SOURCE)
 def test_local_commands_never_upload_or_forward_secrets(self):
  for kind in ['native','daemon']:
   command=self.b.command(kind);self.assertIn('linux/amd64',command);self.assertEqual(command[-1],str(self.b.CONTEXT))
   self.assertFalse(set(command)&{'--push','--secret','--build-arg'});self.assertIn('type=oci,dest=',command[command.index('--output')+1])
   self.assertEqual('--no-cache'in command,kind=='daemon')
  with self.assertRaises(ValueError):self.b.command('shell')
 def test_child_environment_uses_fresh_auth_free_configuration(self):
  with patch.dict(os.environ,{'OPENAI_API_KEY':'private','VERCEL_TOKEN':'private','NODE_OPTIONS':'unsafe','DOCKER_CONFIG':'unsafe'},clear=True):
   value=self.b.environment()
  self.assertEqual(value['DOCKER_CONFIG'],str(self.b.PRIVATE/'docker-client'))
  self.assertFalse(set(value)&{'OPENAI_API_KEY','VERCEL_TOKEN','NODE_OPTIONS'})
 def test_wrong_kind_and_changed_current_source_refuse_before_dispatch(self):
  with self.assertRaises(ValueError):self.b.context('shell')
  original=self.b.load
  def changed(file,maximum=16*1024**2):
   return b'changed'if file==self.b.SOURCE_ROOT/'apps/worker/src/runtime-main.ts'else original(file,maximum)
  with patch.object(self.b,'load',side_effect=changed):
   with self.assertRaises(ValueError):self.b.context('native')
 def test_native_manifest_binds_the_actual_runtime_digest_and_graph(self):
  manifest=self.b.manifest_value('sha256:'+'a'*64)
  self.assertEqual(manifest['source_sha256'],self.b.SOURCE)
  self.assertEqual(manifest['image'],'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:'+'a'*64)
  for bad in ['latest','sha256:'+'A'*64]:
   with self.assertRaises(ValueError):self.b.manifest_value(bad)

if __name__=='__main__':unittest.main()
