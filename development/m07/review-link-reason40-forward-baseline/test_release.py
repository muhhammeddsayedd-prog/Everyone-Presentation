from pathlib import Path
import importlib.util,unittest,uuid
from unittest.mock import patch

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
spec=importlib.util.spec_from_file_location('qualified_forward_entry_tests',HERE/'release.py');entry=importlib.util.module_from_spec(spec);spec.loader.exec_module(entry)

class Tests(unittest.TestCase):
 def test_default_off_refuses_before_context_or_phase(self):
  with patch.object(entry,'Release',side_effect=AssertionError('context must not be constructed')):
   for action in('prepare','apply','reconcile'):
    with self.assertRaises(ValueError):entry.main([action,str(uuid.uuid4())])
 def test_actual_bound_forward_proof_and_one_byte_drift(self):
  raw=(ROOT/entry.PROOF['path']).read_bytes();value=entry.validate_proof(raw)
  self.assertEqual(value['run_id'],'bd221d39-fb0c-4cb2-9df1-7438b6a822c3')
  with self.assertRaises(ValueError):entry.validate_proof(raw+b' ')
 def test_transaction_query_checkpoint_and_acceptance_methods_inherited(self):
  for name in('prepare','apply','reconcile','query','snapshot','checkpoint','compare_checkpoints'):
   self.assertIs(getattr(entry.Release,name),getattr(entry.prior.Release,name))
  for name in('check','state_sql','checkpoint_sql','expected','transition','render'):
   self.assertIs(getattr(entry.projection.ProposedContext,name),getattr(entry.projection.prior.Context,name))
 def test_exact_registration_and_historical_identity_limit(self):
  operator=object.__new__(entry.Release);operator.c=type('Context',(),{'source':ROOT})()
  good={'collector_validation':dict(entry.PROOF),'forward_baseline':{'scope':entry.projection.SCOPE,'historical_identity_equivalence_since39':False}}
  with patch.object(entry.prior.Release,'admission',return_value=good):self.assertEqual(operator.admission(),good)
  for changed in({'collector_validation':{'path':'wrong','sha256':'0'*64}}, {'forward_baseline':{'scope':entry.projection.SCOPE,'historical_identity_equivalence_since39':True}}):
   with patch.object(entry.prior.Release,'admission',return_value={**good,**changed}):
    with self.assertRaises(ValueError):operator.admission()

if __name__=='__main__':unittest.main()
