"""Unchanged complete-window projector with distinct native/daemon source fields."""
from pathlib import Path
import importlib.util,json,unittest
HERE=Path(__file__).resolve().parent
def module(name,file):
 s=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
o=module('compatible_observer_under_test',HERE/'startup.py');f=module('compatible_observer_original_fixtures',o.a.OLD/'test_startup.py')
class Tests(unittest.TestCase):
 def test_exact_original_projector_accepts_two_distinct_sources_without_fixed_record_count(self):
  self.assertIs(o.startup,o.old.startup);self.assertIs(o.request,o.old.request);self.assertFalse(o.OBSERVE_ENABLED)
  scope,payload,now,project=f.Tests().fixture();self.assertNotEqual(scope['bindings']['native_source_sha256'],scope['bindings']['daemon_source_sha256']);result=o.startup(scope,payload,now,project);self.assertEqual(result['log_records'],2);self.assertEqual(result['actual_source_identity_event']['native_source_sha256'],scope['bindings']['native_source_sha256'])
 def test_wrong_native_identity_and_incomplete_window_are_not_accepted(self):
  scope,payload,now,project=f.Tests().fixture();message=json.loads(payload['events'][0]['message']);message['native_source_sha256']=scope['bindings']['daemon_source_sha256'];payload['events'][0]['message']=json.dumps(message)
  with self.assertRaises(ValueError):o.startup(scope,payload,now,project)
  scope,payload,now,project=f.Tests().fixture()
  with self.assertRaises(ValueError):o.startup(scope,payload,now-1,project)
if __name__=='__main__':unittest.main()
