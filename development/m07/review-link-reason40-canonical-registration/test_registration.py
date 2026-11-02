"""Actual sealed admission with injected data reference; no private/provider I/O."""
from pathlib import Path
import hashlib,importlib.util,json,unittest
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
entry=module('registered_reason40_entry',ROOT/'development/m07/review-link-reason40-main-diagnostics/release.py')
registration=json.loads((HERE/'registration.json').read_bytes())
class Tests(unittest.TestCase):
 def test_actual_closed_admission_accepts_exact602_without_private_file_or_provider(self):
  operator=entry.Release('154bf4e4-7e19-4f40-a196-73bfca0130f0')
  def injected_reference(path):
   self.assertEqual(path,operator.private/'query-validation.json');return registration['collector_validation']
  operator.read=injected_reference;value=operator.admission()
  self.assertEqual(value['collector_validation'],registration['collector_validation']);self.assertEqual(value['local_proof'],registration['functional_local_proof']);self.assertEqual(value['canonical39'],registration['historical39_anchor']);self.assertEqual(value['migration_sha256'],registration['migration']['sha256'])
  self.assertFalse(operator.private.exists())
 def test_exact_sources_and_unexecuted_registry_remain_disabled(self):
  for key in('entry','orchestration_library','migration','functional_local_proof','collector_validation'):
   ref=registration[key];self.assertEqual(hashlib.sha256((ROOT/ref['path']).read_bytes()).hexdigest(),ref['sha256'])
  proof=json.loads((ROOT/registration['collector_validation']['path']).read_bytes());self.assertEqual(proof['source_seals'][registration['migration']['path']],registration['migration']['sha256']);self.assertNotEqual(proof['migration_sha256'],registration['migration']['sha256'])
  self.assertFalse(entry.READ_ENABLED);self.assertFalse(entry.APPLY_ENABLED);self.assertFalse(entry.prior.prior.r.READ_ENABLED);self.assertFalse(entry.prior.prior.r.APPLY_ENABLED);self.assertFalse(registration['canonical_execution_enabled']);self.assertFalse(registration['canonical_claims_or_plan_created'])
  future=registration['future_reason_web_registration'];self.assertIsNone(future['accepted_canonical_ref']);self.assertIsNone(future['accepted_after_checkpoint']);self.assertIsNone(future['registry_entry']);self.assertEqual(registration['fresh_checkpoint']['max_stdout_and_artifact_bytes'],16777216)
if __name__=='__main__':unittest.main()
