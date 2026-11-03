"""New per-kind gate over unchanged registry functions; no registry calls."""
from pathlib import Path
import contextlib,importlib.util,io,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('ocr_registry_tests',HERE/'registry.py');r=importlib.util.module_from_spec(s);s.loader.exec_module(r)
class Tests(unittest.TestCase):
 def test_disabled_and_native_dispatch_refuse_before_any_port(self):
  with self.assertRaises(ValueError):r.operate('copy','daemon',object())
  with patch.object(r,'REGISTRY_ENABLED',True):
   for action in('prepare','refresh','copy','ready','readback'):
    with self.assertRaises(ValueError):r.operate(action,'native',object())
 def test_enabled_daemon_delegates_one_exact_unchanged_normal_operation(self):
  p=object();calls=[]
  with patch.object(r,'REGISTRY_ENABLED',True),patch.object(r.old,'operate',lambda a,k,p:calls.append((a,k,p))or{'result':'passed'}):self.assertEqual(r.operate('copy','daemon',p),{'result':'passed'})
  self.assertEqual(calls,[('copy','daemon',p)])
 def test_registry_main_loads_only_new_build_profile_without_future_provider_module_or_inputs(self):
  calls=[]
  class Build:
   def save(self,action,value):calls.append(('save',action,dict(value)));return{'path':'synthetic-public-receipt.json'}
  class Builder:
   def load_build(self):calls.append(('new_profile',));return Build()
  for action in('copy','ready','prepare'):
   calls.clear()
   with patch.object(r,'REGISTRY_ENABLED',True),patch.object(r.sys,'argv',['registry.py',action,'daemon']),patch.object(r.a,'builder',lambda:Builder()),patch.object(r.a,'module',side_effect=AssertionError('FUTURE_PROVIDER_IMPORTED')),patch.object(r,'Ports',lambda b:'new-build-ports'),patch.object(r,'operate',lambda action,kind,ports:calls.append((action,kind,ports))or{'result':'passed'}),contextlib.redirect_stdout(io.StringIO()):r.main()
   self.assertEqual(calls[:2],[('new_profile',),(action,'daemon','new-build-ports')]);self.assertEqual(calls[2],('save','daemon-registry-'+action,{'result':'passed','provider_called':action!='prepare','provider_mutations':action=='copy','credentials_extracted':False,'raw_credentials_persisted':False,'exact_wire_attempt_count_claimed':False}))
if __name__=='__main__':unittest.main()
