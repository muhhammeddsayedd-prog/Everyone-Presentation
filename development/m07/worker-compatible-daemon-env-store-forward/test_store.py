"""Real synthetic files with an actual State instance; fake ACL only, no API."""
from pathlib import Path
import hashlib,importlib.util,json,tempfile,types,unittest
HERE=Path(__file__).resolve().parent

def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

c=module('env_store_successor_tests',HERE/'controller.py');f=c.f
old=module('env_store_original_read_only',f._ORIGINAL/'forward.py')

class Guard:
 def verify(self,file):assert file.is_file()and not file.is_symlink()
 def create(self,file):return file.open('xb')
 def verify_open(self,stream):assert not stream.closed

class Tests(unittest.TestCase):
 def port(self):
  state=f._provider_module.s.State(f._provider_module.a.NATIVE_DIGEST)
  self.assertFalse(hasattr(state,'load'));return types.SimpleNamespace(inputs={'run':f.RUN},s=state,guard=Guard())
 def test_actual_old_Store_real_owner_read_is_RED_with_State_instance(self):
  with tempfile.TemporaryDirectory(prefix='eps-envstore-old-')as folder:
   root=Path(folder).resolve();self.assertTrue(root.is_relative_to(Path(tempfile.gettempdir()).resolve()))
   store=old.Store(self.port());store.private=root/'owned'
   with self.assertRaisesRegex(AttributeError,"has no attribute 'load'"):store.write('environment.claim.json',{'synthetic':True})
   self.assertEqual({p.name for p in store.private.iterdir()},{'owner.json'})
 def test_new_Store_writes_reads_hashes_real_files_with_module_loader_GREEN(self):
  with tempfile.TemporaryDirectory(prefix='eps-envstore-new-')as folder:
   root=Path(folder).resolve();self.assertTrue(root.is_relative_to(Path(tempfile.gettempdir()).resolve()))
   store=f.Store(self.port());store.private=root/'owned';value={'synthetic':True}
   store.write('environment.claim.json',value);self.assertEqual(store.read('environment.claim.json'),value)
   self.assertEqual(store.hash('environment.claim.json'),hashlib.sha256((store.private/'environment.claim.json').read_bytes()).hexdigest());store.check()
   self.assertIs(f.FILE_LOAD,f._provider_module.s.load)
   with self.assertRaises(Exception):store.write('environment.claim.json',{'overwrite':True})
 def test_exact_inverse_new_namespaces_and_old_four_raw_seals_remain_bound(self):
  projected=f.project_forward();self.assertNotIn('self.p.s.load(file)',projected);self.assertEqual(projected.count('FILE_LOAD(file)'),2)
  self.assertIn("'.local/worker-compatible-daemon-env-store-forward'",projected);self.assertIn("'tracking/evidence/m07/worker-compatible-daemon-env-store-forward'",projected)
  pins=f.source_pins()
  for name,digest in f._OLD_PINS.items():self.assertEqual(pins['frozen/'+name],digest)
  self.assertFalse(c.EXECUTION_ENABLED)
  with self.assertRaises(ValueError):c.operate('complete-env',object(),object(),object())
if __name__=='__main__':unittest.main()
