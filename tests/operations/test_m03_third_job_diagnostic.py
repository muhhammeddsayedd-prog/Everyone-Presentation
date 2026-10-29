"""Offline fixed-projection privacy checks; no live operation is imported."""
import copy,importlib.util,json,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('third_diagnostic',ROOT/'tools/capture-m03-third-job-diagnostic.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class ThirdJobDiagnosticTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.proof=json.loads((ROOT/'tracking/evidence/m03/third-job-diagnostic/2026-10-29T11-31-30-898694+00-00-af467f9d.json').read_bytes())['proof']
 def test_actual_retained_metadata_includes_known_processing_failure(self):
  self.assertEqual(module.validate(self.proof)['job']['known_error_code'],'PROCESSING_FAILED')
  self.assertEqual(sum(row['grant_count'] for row in self.proof['grants'] if row['stage']=='transcribe_candidate' and row['purpose']=='audio'),1)
 def test_private_grant_or_raw_error_content_is_rejected(self):
  for field in ['token_digest','grant_token','raw_message','filename','original_transcript']:
   value=copy.deepcopy(self.proof);value['job'][field]='PRIVATE_CANARY'
   with self.assertRaises(ValueError):module.validate(value)
 def test_sealed_fixed_sql_and_job_scope(self):
  self.assertEqual(module.sha((ROOT/module.SQL).read_bytes()),module.SEAL)
  value=copy.deepcopy(self.proof);value['job']['job_id']='00000000-0000-4000-8000-000000000001'
  with self.assertRaises(ValueError):module.validate(value)
if __name__=='__main__':unittest.main()
