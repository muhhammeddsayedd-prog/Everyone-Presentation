"""New continuation ownership/sequencing, using metadata and fake ports only."""
from pathlib import Path
import copy,importlib.util,sys,unittest
from unittest.mock import Mock,patch
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
f=module('forward_prepare_test_target',HERE/'forward_prepare.py');t=module('forward_prepare_test_ports',HERE/'test_controller.py')
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.state=f.f.State()
 def ports(self):
  port=t.Ports(self.state);port.concurrency=Mock(return_value={'path':'synthetic','sha256':'a'*64});legacy=port.value['canonical']['base']['legacy'];legacy['job_count']+=1;legacy['kinds']['review_fit']=legacy['kinds'].get('review_fit',0)+1;return port
 def test_disabled_main_never_constructs_provider(self):
  with patch.object(f,'FORWARD_ENABLED',False),patch.object(f,'ForwardProvider')as provider,patch.object(sys,'argv',['forward_prepare.py','prepare']):
   with self.assertRaises(ValueError):f.main()
   provider.assert_not_called()
 def test_real_retained_readonly_claim_and_exact_old_source_pins(self):
  port=f.ForwardProvider();port.run=Mock(side_effect=AssertionError('NO_PROVIDER'));port.api=Mock(side_effect=AssertionError('NO_PROVIDER'));pins=port.pins();result=f.retained_preparation(port,pins)
  self.assertEqual(result['prepare_claim_sha256'],f.PRIOR_SHA);self.assertTrue(result['retained_old_pins_unchanged']);port.run.assert_not_called();port.api.assert_not_called()
  bad=copy.deepcopy(pins);bad[str(HERE/'provider.py')]='0'*64
  with self.assertRaises(ValueError):f.retained_preparation(port,bad)
  with patch.object(port,'exists',side_effect=lambda name:name=='plan.json'):
   with self.assertRaises(ValueError):f.retained_preparation(port,pins)
 def test_forward_state_new_inputs_and_null_proof_block_before_provider(self):
  port=f.ForwardProvider();self.assertEqual(port.s.sql_contract_sha256(),f.FROZEN['forward_state.py']);self.assertEqual(f.p.s.sha(f.p.s.load(HERE/'state.py')),f.FROZEN['state.py']);self.assertEqual(port.concurrency(),port.inputs['native_concurrency']);port.inputs['native_concurrency']=None;port.run=Mock();port.api=Mock()
  with self.assertRaises(ValueError):port.admission('prepare')
  port.run.assert_not_called();port.api.assert_not_called()
 def test_new_claim_precedes_reads_and_full_fresh_plan_drives_original_pause(self):
  port=self.ports();before=copy.deepcopy(port.value);retained={'prepare_claim_sha256':f.PRIOR_SHA}
  with patch.object(f,'retained_preparation',return_value=retained),patch.object(f,'FORWARD_ENABLED',True):
   result=f.operate('prepare',port);self.assertEqual(result['result'],'prepared');self.assertEqual(port.files['plan.json']['before'],before);self.assertEqual(port.files['plan.json']['forward_preparation']['forward_claim_sha256'],port.hash(f.CLAIM));self.assertLess(port.calls.index(('write',f.CLAIM)),port.calls.index(('snapshot',None)))
   result=f.operate('pause',port);self.assertEqual(result['result'],'passed');self.assertEqual(port.value['canonical']['base']['legacy'],before['canonical']['base']['legacy'])
 def test_failed_continuation_retains_claim_and_never_replays(self):
  port=self.ports();port.snapshot=Mock(side_effect=TimeoutError('PRIVATE'))
  with patch.object(f,'retained_preparation',return_value={'prepare_claim_sha256':f.PRIOR_SHA}),patch.object(f,'FORWARD_ENABLED',True):
   result=f.operate('prepare',port);self.assertEqual(result['result'],'unconfirmed');self.assertIn(f.CLAIM,port.files);self.assertNotIn('plan.json',port.files);self.assertEqual(port.snapshot.call_count,1)
   result=f.operate('prepare',port);self.assertEqual(result['result'],'unconfirmed');self.assertEqual(port.snapshot.call_count,1)
if __name__=='__main__':unittest.main()
