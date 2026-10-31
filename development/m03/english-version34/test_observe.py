"""Synthetic contract/SQL-source checks. No database, credential or provider call."""
from pathlib import Path
import copy, importlib.util, unittest
spec=importlib.util.spec_from_file_location('version34',Path(__file__).with_name('observe.py'));observer=importlib.util.module_from_spec(spec);spec.loader.exec_module(observer)
def identifier(index):return 'a3500000-0000-4000-8000-'+str(index).zfill(12)
def plan():return {'version_id':identifier(1),'job_id':identifier(2),'candidate_media_id':identifier(3),'source_asset_id':identifier(4),'source_sha256':observer.SOURCE_SHA}
def fixture():
 p=plan();c={key:identifier(index+1)for index,key in enumerate(['version_id','series_id','workspace_id','project_id','generation_job_id','pdf_asset_id','source_job_id','candidate_media_id','candidate_id','video_asset_id'])}
 c.update(version_id=p['version_id'],source_job_id=p['job_id'],candidate_media_id=p['candidate_media_id'],video_asset_id=p['source_asset_id'],version_number=9,
  version_status='ready',english_transcript_version='1.0',source_video_sha256=observer.SOURCE_SHA,current_media_row_version=2,source_media_row_version=2,english_status='available',
  english_sha256='a'*64,english_characters=40,english_utf8_bytes=40,matching_candidate_slide_count=2,checks=dict.fromkeys(observer.CHECKS,True))
 h=observer.helper().preflight()['history'];return [{'english_version_capture':{'database':'postgres','operator':'postgres','history':h+[observer.VERSION],'match_count':1,'capture':c}}],h

class VersionCaptureTests(unittest.TestCase):
 def test_valid_capture_returns_only_closed_bound_metadata(self):
  payload,history=fixture();before=copy.deepcopy(payload);value=observer.parse(payload,plan(),history)
  self.assertEqual(value['english_sha256'],'a'*64);self.assertEqual(value['matching_candidate_slide_count'],2);self.assertEqual(payload,before)
 def test_plan_refuses_wrong_source_old_reviewed_job_or_uuid_injection(self):
  for change in[lambda p:p.update(source_sha256='b'*64),lambda p:p.update(job_id="';delete from eps.jobs;--"),lambda p:p.update(candidate_media_id='f5dff77f-092f-4777-9f56-3bbce4dee57c')]:
   value=plan();change(value)
   with self.assertRaises(ValueError):observer.plan_value(value)
 def test_every_capture_binding_or_immutable_guard_must_pass(self):
  for key in observer.CHECKS:
   payload,history=fixture();payload[0]['english_version_capture']['capture']['checks'][key]=False
   with self.assertRaises(ValueError):observer.parse(payload,plan(),history)
 def test_wrong_ids_history_status_hash_or_cohort_are_refused(self):
  for key,value in[('version_id',identifier(99)),('source_job_id',identifier(99)),('candidate_media_id',identifier(99)),('video_asset_id',identifier(99)),
                    ('version_status','rendering'),('english_transcript_version',None),('english_status','unavailable'),('english_sha256','not-a-hash'),('english_utf8_bytes',1)]:
   payload,history=fixture();payload[0]['english_version_capture']['capture'][key]=value
   with self.assertRaises(ValueError):observer.parse(payload,plan(),history)
  payload,history=fixture();payload[0]['english_version_capture']['history'].pop()
  with self.assertRaises(ValueError):observer.parse(payload,plan(),history)
 def test_payload_or_guest_url_extras_never_leave_parser(self):
  for key in['original_text','english_text','snapshot','guest_url','token']:
   payload,history=fixture();payload[0]['english_version_capture']['capture'][key]='SYNTHETIC_PRIVATE'
   with self.assertRaises(ValueError):observer.parse(payload,plan(),history)
 def test_query_is_read_only_and_hashes_text_instead_of_selecting_it(self):
  sql=observer.observation_sql(plan());self.assertTrue(sql.startswith('begin read only;'));self.assertTrue(sql.rstrip().endswith('rollback;'))
  self.assertNotRegex(sql,r'(?im)^\s*(?:commit|insert|update|delete|create|alter|drop|grant|revoke)\b')
  self.assertIn("et.english_sha256=encode(sha256(convert_to(m.english_transcript,'UTF8')),'hex')",sql)
  self.assertIn("et.captured_at=v.created_at and t.captured_at=v.created_at",sql)
  self.assertIn("t.source_media_row_version=m.row_version",sql)
  self.assertNotIn("'english_text',",sql);self.assertNotIn("'original_text',",sql);self.assertNotIn("'snapshot',",sql);self.assertNotIn("'object_key',",sql)
  self.assertIn("tgname='presentation_video_english_immutable'",sql)

if __name__=='__main__':unittest.main()
