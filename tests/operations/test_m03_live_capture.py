"""Offline metadata/privacy guards. No DB, log, provider or CLI invocation."""
import copy,importlib.util,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('m03_capture',ROOT/'tools/capture-m03-live.py');capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
def proof():return {'observed_at':'2026-10-29T12:00:00+00:00','query_role':'postgres','database':'postgres','workspace_id':capture.WORKSPACE,'project_id':capture.PROJECT,'job_count':1,
 'configuration':{'enabled':True,'transcription_model':'synthetic-transcription-model','extraction_model':'synthetic-extraction-model','prompt_version':'candidate-v1','schema_version':'1.0','media_implementation_version':'video-preparation.v1'},
 'protected_m02':{'job_checkpoint_unchanged':True,'spec_checkpoint_unchanged':True,'manual_note_retained':True},
 'jobs':[{'job_id':'70000000-0000-4000-8000-000000000001','status':'queued','stage':'prepare_candidate','providers':[],'completed_stages':[]}]}
class M03CaptureTests(unittest.TestCase):
 def test_bounded_metadata_only_shape(self):
  value=proof();self.assertEqual(capture.validate(value),value);self.assertTrue(capture.summarize(value)['protected_m02_unchanged'])
  self.assertFalse(capture.summarize(value)['jobs'][0]['five_stages_committed'])
 def test_raw_name_filename_transcript_or_provider_payload_is_rejected(self):
  for field in ('name','filename','facts','original_transcript','provider_response','diagnostic'):
   value=proof();value['jobs'][0][field]='PRIVATE_CANARY_MUST_NOT_ESCAPE'
   with self.assertRaises(ValueError):capture.validate(value)
 def test_untrusted_string_cannot_pass_as_version_or_identifier(self):
  value=proof();value['configuration']['extraction_model']='PRIVATE name\nraw body'
  with self.assertRaises(ValueError):capture.validate(value)
  value=proof();value['jobs'][0]['n8n_execution_id']='Bearer secret value'
  with self.assertRaises(ValueError):capture.validate(value)
 def test_failed_and_partial_jobs_remain_visible(self):
  value=proof();value['jobs'][0].update(status='failed',error_code='SOURCE_UNREADABLE');capture.validate(value)
  summary=capture.summarize(value);self.assertEqual(summary['outcomes']['failed'],1);self.assertFalse(summary['jobs'][0]['candidate_media_applied'])
  value['jobs'][0].update(status='succeeded',application={'processing_issue_count':1});capture.validate(value)
  self.assertTrue(capture.summarize(value)['jobs'][0]['partial_material'])
 def test_scope_count_and_protection_are_not_silently_dropped(self):
  value=proof();value['project_id']='70000000-0000-4000-8000-000000000002'
  with self.assertRaises(ValueError):capture.validate(value)
  value=proof();value['job_count']=65
  with self.assertRaises(ValueError):capture.validate(value)
  value=proof();value['protected_m02']['manual_note_retained']=False;capture.validate(value)
  self.assertFalse(capture.summarize(value)['protected_m02_unchanged'])
 def test_source_seals_and_protected_baseline_are_fixed(self):
  self.assertEqual(capture.sha((ROOT/capture.SQL).read_bytes()),capture.SQL_SHA256)
  self.assertEqual(capture.sha((ROOT/capture.PROTECTED_BASELINE).read_bytes()),capture.PROTECTED_BASELINE_SHA256)
if __name__=='__main__':unittest.main()
