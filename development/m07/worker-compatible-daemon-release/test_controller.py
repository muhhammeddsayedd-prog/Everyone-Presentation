"""Reuse the existing fake ports to verify the new flags and forward-only entry."""
from pathlib import Path
import importlib.util,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
def module(name,file):
 s=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
c=module('compatible_controller_under_test',HERE/'controller.py');f=module('compatible_controller_frozen_fake_ports',c.a.OLD/'test_controller.py')
class Tests(unittest.TestCase):
 def phase(self,name,port):
  with patch.object(c,'EXECUTION_ENABLED',True):return c.operate(name,port)
 def test_disabled_entry_and_AT069_rollback_action_refuse_before_any_port(self):
  with self.assertRaises(ValueError):c.operate('prepare',object())
  with patch.object(c,'EXECUTION_ENABLED',True):
   for name in('unwind','rollback','native-probe','native-export'):
    with self.assertRaises(ValueError):c.operate(name,object())
  self.assertFalse(c.old.EXECUTION_ENABLED)
 def test_all_forward_phases_keep_one_claim_and_normal_nonce_without_arming_old_controller(self):
  port=f.Port()
  for name in c.old.a.PHASES:self.assertIn(self.phase(name,port)['result'],('prepared','passed','submitted'))
  self.assertEqual(port.query_count,3);self.assertEqual(port.deploy_count,1);self.assertEqual(port.env_count,3);self.assertFalse(c.old.EXECUTION_ENABLED)
 def test_unknown_committed_SQL_remains_unknown_readback_never_repairs_or_replays(self):
  port=f.Port();self.phase('prepare',port);port.fail_query=True;self.assertEqual(self.phase('pause',port)['result'],'unconfirmed');self.assertNotIn('pause.normal.json',port.files);self.phase('pause',port);self.assertEqual(port.query_count,1);read=self.phase('readback:pause',port);self.assertEqual(read['result'],'unconfirmed');self.assertFalse(read['normal_return_observed']);self.assertNotIn('pause.normal.json',port.files)
 def test_fresh_data_or_source_drift_refuses_before_pause_claim(self):
  for key in('data','source'):
   port=f.Port();self.phase('prepare',port)
   if key=='data':port.current['all76_full_rows_sha']='changed'
   else:port.source['source']='changed'
   self.assertEqual(self.phase('pause',port)['result'],'unconfirmed');self.assertNotIn('pause.claim.json',port.files);self.assertEqual(port.query_count,0)
 def test_unknown_deployment_is_not_resubmitted_or_given_normal_marker(self):
  port=f.Port()
  for name in('prepare','pause','env'):self.phase(name,port)
  port.fail_deploy=True;self.phase('deploy',port);self.phase('deploy',port);self.assertEqual(port.deploy_count,1);read=self.phase('readback:deploy',port);self.assertEqual(read['result'],'unconfirmed');self.assertFalse(read['normal_return_observed']);self.assertNotIn('deploy.normal.json',port.files)
if __name__=='__main__':unittest.main()
