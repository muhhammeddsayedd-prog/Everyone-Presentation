"""Real owned child-process stream limits; synthetic bytes, no CLI/auth/DB."""
from pathlib import Path
import importlib.util,os,sys,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('checkpoint_capture_tests',HERE/'capture.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
class Tests(unittest.TestCase):
 def run_child(self,program,**options):
  environment={key:os.environ[key]for key in('SystemRoot','WINDIR','PATH','TEMP','TMP')if key in os.environ}
  return c.bounded_checkpoint([sys.executable,'-c',program],environment,cwd=HERE,**options)
 def test_actual_8mib_capture_succeeds_and_does_not_lower_snapshot_bound(self):
  value=self.run_child('import sys;sys.stdout.buffer.write(bytes([97])*(8*1024**2));sys.stdout.flush()')
  self.assertEqual(value[:3],(0,False,False));self.assertEqual(len(value[3]),8*1024**2);self.assertEqual(value[4],b'')
  self.assertEqual(c.MAX_STDOUT,16*1024**2);self.assertEqual(c.MAX_STDERR,64*1024)
 def test_overflow_never_retains_more_than_fixed16mib(self):
  value=self.run_child('import sys;sys.stdout.buffer.write(bytes([97])*(16*1024**2+4096));sys.stdout.flush()')
  self.assertTrue(value[2]);self.assertEqual(len(value[3]),16*1024**2)
 def test_stderr_overflow_and_timeout_are_explicit_closed_results(self):
  value=self.run_child('import sys;sys.stderr.buffer.write(bytes([98])*(64*1024+4096));sys.stderr.flush()');self.assertTrue(value[2]);self.assertEqual(len(value[4]),64*1024)
  value=self.run_child('import time;time.sleep(2)',timeout=0.1);self.assertTrue(value[1]);self.assertNotEqual(value[0],0)
 def test_timeout_cannot_relax_maximum_and_raw_output_is_not_logged(self):
  with self.assertRaises(ValueError):self.run_child('pass',timeout=61)
  text=(HERE/'capture.py').read_text();self.assertNotIn('print(',text);self.assertNotIn('write_text(',text);self.assertNotIn('write_bytes(',text)
if __name__=='__main__':unittest.main()
