"""Daemon-only dispatch fences; no registry/auth/config or real processes."""
from pathlib import Path
import importlib.util,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('compatible_registry_tests',HERE/'registry.py');r=importlib.util.module_from_spec(s);s.loader.exec_module(r)
class Tests(unittest.TestCase):
 def test_disabled_entry_refuses_before_ports(self):
  with self.assertRaises(ValueError):r.operate('prepare','daemon',object())
 def test_native_mutation_actions_are_unconditionally_closed(self):
  with patch.object(r,'REGISTRY_ENABLED',True):
   for action in('prepare','refresh','copy','ready','readback'):
    with self.assertRaises(ValueError):r.operate(action,'native',object())
  ports=r.Ports.__new__(r.Ports)
  for call in(lambda:ports.exported('native'),lambda:ports.target('native'),lambda:ports.copy('native',{})):
   with self.assertRaises(ValueError):call()
 def test_enabled_daemon_operation_delegates_same_sealed_normal_function_once(self):
  seen=[];port=object()
  with patch.object(r,'REGISTRY_ENABLED',True),patch.object(r.old,'operate',lambda action,kind,p:seen.append((action,kind,p))or{'normal_return':True}):self.assertEqual(r.operate('copy','daemon',port),{'normal_return':True})
  self.assertEqual(seen,[('copy','daemon',port)])
if __name__=='__main__':unittest.main()
