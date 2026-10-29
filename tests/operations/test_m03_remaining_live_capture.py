"""Offline observer validation/redaction tests; no CLI/DB/provider/log access."""
import copy,importlib.util,sys,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('remaining_capture',ROOT/'tools/capture-m03-remaining-live.py')
capture=importlib.util.module_from_spec(spec);spec.loader.exec_module(capture)
JOB='70000000-0000-4000-8000-000000000001';MEDIA='70000000-0000-4000-8000-000000000002';FRAME='70000000-0000-4000-8000-000000000003'

def proof():
    return {'observed_at':'2026-10-29T15:00:00+00:00','query_role':'postgres','database':'postgres',
      'scopes':[{'workspace_id':k,'project_id':v}for k,v in capture.SCOPES.items()],
      'job_count':1,'configuration':{},'frame_configuration':{'enabled':True,'native_image_id':'sha256:'+'a'*64,'implementation_version':'frame-extraction.v1'},
      'protected_m02':{'job_checkpoint_unchanged':True,'spec_checkpoint_unchanged':True,'manual_note_retained':True},
      'candidate_rows_sha256':'1'*64,'workspace_candidate_rows_sha256':'2'*64,'participations':[],
      'jobs':[{'job_id':JOB,'kind':'frame_extract','workspace_id':capture.WORKSPACE,'project_id':capture.SCOPES[capture.WORKSPACE],
        'status':'succeeded','stage':'apply_frames','providers':[],'completed_stages':[],
        'frame_outcome':{'candidate_media_id':MEDIA,'source_asset_id':JOB,'requested_count':2,'extracted_count':1,'unavailable_count':1,
          'unavailable_timestamps_ms':[1500],'frame_asset_ids':[FRAME],'warnings':['FRAME_TIMESTAMP_UNAVAILABLE']}}]}

class RemainingCaptureTests(unittest.TestCase):
    def test_mixed_kind_cohort_and_partial_outcome_are_safe(self):
        p=proof();capture.validate(p);summary=capture.summarize(p,'1'*64)
        self.assertTrue(summary['global_candidate_rows_unchanged_since_pre_job_baseline'])
        self.assertTrue(summary['jobs'][0]['partial_frame_result'])
        p['jobs'].append({'job_id':MEDIA,'kind':'candidate_scan','workspace_id':capture.OTHER_WORKSPACE,'project_id':capture.SCOPES[capture.OTHER_WORKSPACE],
          'status':'failed','stage':'prepare_candidate','providers':[],'completed_stages':[]});p['job_count']=2
        capture.validate(p);self.assertEqual(capture.summarize(p,'1'*64)['outcomes']['failed'],1)
    def test_no_private_or_unknown_fields_even_under_otherwise_known_objects(self):
        for field in ['name','filename','original_transcript','facts','raw_result','url','secret']:
            p=proof();p['jobs'][0][field]='PRIVATE_CANARY'
            with self.subTest(field=field),self.assertRaises(ValueError):capture.validate(p)
        p=proof();p['jobs'][0]['frame_outcome']['source_asset_id']='PRIVATE_CANARY'
        with self.assertRaises(ValueError):capture.validate(p)
        p=proof();p['jobs'][0]['frame_outcome']['warnings']=['PRIVATE_CANARY']
        with self.assertRaises(ValueError):capture.validate(p)
    def test_known_metadata_keys_cannot_hide_wrong_shapes_or_coerced_counts(self):
        for source in [{'asset_id':{'ready':True}},{'width':'ready'},{'size_bytes':True},{'sha256':['a'*64]}]:
            p=proof();p['jobs'][0]['source']=source
            with self.subTest(source=source),self.assertRaises(ValueError):capture.validate(p)
    def test_authorized_scope_kind_and_stage_cannot_be_substituted(self):
        for change in [{'workspace_id':JOB},{'project_id':JOB},{'kind':'specs_extract'},{'stage':'prepare_candidate'}]:
            p=proof();p['jobs'][0].update(change)
            with self.subTest(change=change),self.assertRaises(ValueError):capture.validate(p)
        p=proof();p['job_count']=65
        with self.assertRaises(ValueError):capture.validate(p)
    def test_geometry_and_outcome_types_fail_closed_and_shared_requests_are_allowed(self):
        p=proof();p['jobs'][0]['frame_geometry']={'width':853,'height':480,'sample_aspect_ratio':{'numerator':16,'denominator':15},'display_aspect_ratio':{'numerator':16,'denominator':9}}
        capture.validate(p)
        p['jobs'][0]['frame_geometry']['sample_aspect_ratio']['denominator']=0
        with self.assertRaises(ValueError):capture.validate(p)
        for bad in [True,1.5,-1,'1']:
            p=proof();p['jobs'][0]['frame_outcome']['extracted_count']=bad
            with self.subTest(bad=bad),self.assertRaises(ValueError):capture.validate(p)
        p=proof();p['jobs'][0]['frame_outcome'].update(requested_count=3,extracted_count=1,unavailable_count=0,unavailable_timestamps_ms=[],warnings=['FRAME_TIMESTAMP_SHARED'])
        capture.validate(p)  # Multiple requests may share one physical frame; no sum-equality assumption.
    def test_retention_is_unknown_when_global_candidate_rows_changed(self):
        summary=capture.summarize(proof(),'3'*64)
        self.assertFalse(summary['global_candidate_rows_unchanged_since_pre_job_baseline'])
        self.assertIsNone(summary['manual_facts_retained_verified'])
    def test_fixed_no_audio_job_proves_unique_intent_and_real_frames_without_billing_claim(self):
        p=proof();j=p['jobs'][0];j.update(job_id=capture.FIXED_JOB,kind='candidate_scan',stage='apply_candidate',
          source={'status':'ready','sha256':capture.SOURCE_SHA256,'size_bytes':capture.SOURCE_BYTES},
          upload={'intent_count_for_source':1,'asset_count_for_source':1,'scan_job_count_for_source':1},
          preparation={'has_audio':False,'sampled_frame_count':12},initial_selected_frame_asset_ids=capture.D5_FRAMES,
          application={'processing_issues':['NO_AUDIO'],'frames':[{'asset_id':f'71000000-0000-4000-8000-{i:012d}','ready':True,'source_and_job_match':True}for i in range(12)]})
        j['completed_stages']=[{'stage':stage}for stage in capture.CANDIDATE_STAGES];j.pop('frame_outcome')
        capture.validate(p);s=capture.summarize(p,'1'*64)['fixed_resumed_job']
        self.assertTrue(s['source_matches_expected_sha_and_size']);self.assertTrue(s['one_intent_asset_and_candidate_scan'])
        self.assertTrue(s['twelve_ready_origin_frames']);self.assertTrue(s['no_audio_and_no_persisted_provider_metadata'])
        self.assertNotIn('zero_provider_billing',s)
    def test_opaque_sql_failure_never_returns_raw_diagnostics(self):
        value=capture.safe_sql_failure('syntax error PRIVATE_CANARY https://private.invalid','password=PRIVATE_CANARY')
        self.assertTrue(value['syntax_error']);self.assertNotIn('PRIVATE_CANARY',str(value));self.assertNotIn('http',str(value))
    def test_sources_are_fixed_and_capture_is_not_run_on_import(self):
        self.assertEqual(capture.sha((ROOT/capture.SQL).read_bytes()),capture.SQL_SHA256)
        for file,digest in capture.OLD_SEALS.items():self.assertEqual(capture.sha((ROOT/file).read_bytes()),digest)
        with patch.object(capture,'call')as call:capture.validate(proof());call.assert_not_called()

if __name__=='__main__':unittest.main()
