"""Synthetic metadata parser checks. No CLI, personal payload or runtime config."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest import mock

ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('m06_app_capture',ROOT/'tools/capture-m06-app.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def uid(number):return f'00000000-0000-4000-8000-{number:012x}'

def fixture():
    baseline=json.loads((ROOT/m.BASELINE).read_bytes())['state'];state={
        'schema_version':'1.0','observed_at':'2026-10-30T02:00:00+00:00','query_role':'postgres','database':'postgres',
        'unrestricted_visibility':True,'workspace_id':m.WORKSPACE,'migration_versions':[str(i)for i in range(26)],
        'series':[],'versions':[],'links':[],'sessions':[],'comments':[],'preferences':[],'exports':[],
        'media_grants':[],'asset_grants':[],'jobs':[],'protected':{**baseline['protected'],'m02_manual_note_retained':True}}
    for series in baseline['series']:
        state['series'].append({**series,'workspace_id':m.WORKSPACE,'audience_scope':'internal',
            'template_content_sha256':next((v['template_content_sha256']for v in baseline['versions']if v['series_id']==series['id']),'a'*64)})
    for version in baseline['versions']:
        state['versions'].append({k:copy.deepcopy(version[k])for k in m.IMMUTABLE_FIELDS})
        state['versions'][-1].update(audience_scope='internal',snapshot_scope_matches_series=True)
    source=copy.deepcopy(state['versions'][0]);source.update(id=uid(2),series_id=uid(1),version_no=1,audience_scope='external')
    source['slides']=[{**row,'id':uid(100+i)}for i,row in enumerate(source['slides'])]
    state['versions'].append(source)
    state['series'].append({'id':uid(1),'workspace_id':m.WORKSPACE,'output_type':'selection','audience_scope':'external',
        'template_version':'1.1.0','template_content_sha256':source['template_content_sha256'],'latest_ready_version_id':uid(2),
        'latest_ready_version_no':1,'next_version_no':2})
    state['links']=[{'id':uid(3),'series_id':uid(1),'label_present':True,'label_codepoints':4,'created_at':'2026-10-30T01:00:00+00:00',
        'expires_at':'2026-11-29T01:00:00+00:00','expiry_default30_delta_ms':0,'default_30_day_expiry':True,
        'download_enabled':True,'revoked_at':None,'token_generation':1,'export_revision':1,'row_version':1,'live':True,
        'latest_ready_version_id':uid(2),'session_count':1,'external_comment_count':1,'preference_count':1}]
    state['sessions']=[{'id':uid(4),'review_link_id':uid(3),'identified':True,'company_present':False,'link_token_generation':1,
        'created_at':'2026-10-30T01:30:00+00:00','expires_at':'2026-10-30T02:30:00+00:00','last_seen_at':'2026-10-30T01:40:00+00:00',
        'parent_generation_current':True,'active':True,'comment_count':1,'preference_count':1}]
    slide=next(row['id']for row in source['slides']if row['kind']=='candidate')
    state['comments']=[{'id':uid(5),'series_id':uid(1),'version_id':uid(2),'slide_id':slide,'guest_session_id':uid(4),
        'author_kind':'guest','parent_comment_id':None,'visibility':'external','resolved':False,'deleted':False,'row_version':1,
        'created_at':'2026-10-30T01:40:00+00:00','updated_at':'2026-10-30T01:40:00+00:00','reply_count':0}]
    state['preferences']=[{'id':uid(6),'series_id':uid(1),'version_id':uid(2),'slide_id':slide,'guest_session_id':uid(4),
        'author_kind':'guest','preference':'preferred','row_version':1}]
    state['exports']=[{'id':uid(7),'version_id':uid(2),'review_link_id':uid(3),'template_version':'1.1.0','export_revision':1,
        'parent_token_generation':1,'current_cache_identity':True,'status':'ready','pdf_asset_id':uid(8),'pdf_sha256':'b'*64,'pdf_bytes':1234,
        'pdf_identity_matches_job':True,'canonical_pdf_unchanged':True,'media_grant_id':uid(9),'grant_digest_present':True,
        'job_id':uid(10),'created_at':'2026-10-30T01:42:00+00:00','ready_at':'2026-10-30T01:43:00+00:00','failure_code':None}]
    videos=[pin['asset_id']for pin in source['pins']if pin['asset_kind']=='candidate_video']
    state['media_grants']=[{'id':uid(9),'review_link_id':uid(3),'version_id':uid(2),'export_id':uid(7),'parent_token_generation':1,
        'token_digest_present':True,'producing_attempt_id':uid(11),'created_at':'2026-10-30T01:42:01+00:00',
        'expires_at':'2026-11-29T01:00:00+00:00','revoked_at':None,'parent_generation_current':True,'live':True,
        'published_export_member':True,'video_asset_ids':videos}]
    state['jobs']=[{'id':uid(10),'workspace_id':m.WORKSPACE,'export_id':uid(7),'kind':'presentation_export','status':'succeeded',
        'stage':'render_export','attempt':1,'current_attempt_id':uid(11),'dispatch_generation':1,'n8n_execution_id':'31473','error_code':None,
        'input_hash_matches':True,'completed_stages':[{'stage':'render_export','attempt_id':uid(11),'input_hash_matches':True,
            'result_schema':'presentation-export-result.v1'}],
        'stage_receipts':[{'stage':'render_export','attempt_id':uid(11),'result_schema':'presentation-export-result.v1'}],
        'outbox':[{'id':uid(12),'stage':'render_export','status':'delivered','generation':1,'attempt_count':1,'input_hash_matches':True}]}]
    return state,baseline

class M06AppCaptureTests(unittest.TestCase):
    def setUp(self):self.state,self.baseline=fixture();self.versions=self.state['migration_versions']
    def validate(self):return m.validate(self.state,self.versions,self.baseline)
    def test_full_export_and_feedback_metadata_accepted(self):
        checks=self.validate();self.assertEqual(checks['old_ready_versions_preserved'],3);self.assertTrue(checks['no_names_text_urls_or_credentials_in_observation'])
    def test_ready_m05_version_cannot_be_removed_or_mutated(self):
        for mutate in (lambda v:v['versions'].pop(0),lambda v:v['versions'][0].update(snapshot_sha256='c'*64),lambda v:v['versions'][0]['pins'][0].update(sha256='d'*64)):
            self.state,_=fixture();mutate(self.state)
            with self.assertRaises(ValueError):self.validate()
    def test_unknown_private_fields_denied_at_every_layer(self):
        for section,key,value in [('links','token_digest','a'*64),('sessions','display_name','Private name'),('comments','body','Private text'),('exports','grant_token','secret'),('media_grants','token_digest','a'*64),('jobs','input',{}),('versions','snapshot',{})]:
            self.state,_=fixture();self.state[section][0][key]=value
            with self.subTest(section=section),self.assertRaises(ValueError):self.validate()
    def test_digest_presence_must_be_boolean(self):
        for section,field in [('exports','grant_digest_present'),('media_grants','token_digest_present')]:
            self.state,_=fixture();self.state[section][0][field]='a'*64
            with self.assertRaises(ValueError):self.validate()
    def test_foreign_scope_and_internal_review_link_denied(self):
        for mutate in (lambda v:v.update(workspace_id=uid(200)),lambda v:v['versions'][0].update(workspace_id=uid(200)),lambda v:v['links'][0].update(series_id=v['series'][0]['id'])):
            self.state,_=fixture();mutate(self.state)
            with self.assertRaises(ValueError):self.validate()
    def test_cross_version_comment_thread_and_preference_denied(self):
        for section in ('comments','preferences'):
            self.state,_=fixture();self.state[section][0]['slide_id']=self.state['versions'][0]['slides'][0]['id']
            with self.assertRaises(ValueError):self.validate()
        self.state,_=fixture();self.state['comments'][0]['parent_comment_id']=uid(500)
        with self.assertRaises(ValueError):self.validate()
    def test_internal_note_cannot_claim_guest_ownership(self):
        self.state['comments'][0]['visibility']='internal'
        with self.assertRaises(ValueError):self.validate()
    def test_count_mismatch_and_duplicate_session_denied(self):
        self.state['sessions'][0]['comment_count']=2
        with self.assertRaises(ValueError):self.validate()
        self.state,_=fixture();self.state['sessions'].append(copy.deepcopy(self.state['sessions'][0]))
        with self.assertRaises(ValueError):self.validate()
    def test_default_expiry_claim_matches_dates_and_delta(self):
        self.state['links'][0]['expiry_default30_delta_ms']=5000
        with self.assertRaises(ValueError):self.validate()
    def test_revoked_parent_cannot_have_live_session_or_grant(self):
        self.state['links'][0].update(revoked_at='2026-10-30T01:59:00+00:00',live=False)
        with self.assertRaises(ValueError):self.validate()
    def test_export_pdf_cannot_overwrite_canonical_pdf_or_cross_link(self):
        self.state['exports'][0]['pdf_asset_id']=self.state['versions'][-1]['pdf_asset_id']
        with self.assertRaises(ValueError):self.validate()
        self.state,_=fixture();self.state['exports'][0]['review_link_id']=uid(500)
        with self.assertRaises(ValueError):self.validate()
    def test_grant_video_membership_is_fixed_version_only(self):
        self.state['media_grants'][0]['video_asset_ids']=[uid(500)]
        with self.assertRaises(ValueError):self.validate()
    def test_completed_export_requires_scoped_stage_receipt(self):
        self.state['jobs'][0]['stage_receipts']=[]
        with self.assertRaises(ValueError):self.validate()
    def test_private_workflow_execution_value_denied(self):
        self.state['jobs'][0]['n8n_execution_id']='https://private.example/token'
        with self.assertRaises(ValueError):self.validate()
    def test_preparing_link_without_ready_version_is_valid(self):
        self.state['versions'].pop();self.state['series'][-1].update(latest_ready_version_id=None,latest_ready_version_no=None,next_version_no=1)
        self.state['links'][0].update(latest_ready_version_id=None,external_comment_count=0,preference_count=0)
        self.state['sessions'][0].update(comment_count=0,preference_count=0)
        for section in ('comments','preferences','exports','media_grants','jobs'):self.state[section]=[]
        self.assertTrue(self.validate()['fixed_workspace_and_external_link_scope_verified'])
    def test_transient_asset_capability_has_no_credential_identity(self):
        asset=self.state['media_grants'][0]['video_asset_ids'][0]
        capability={'session_id':None,'media_grant_id':uid(9),'review_link_id':uid(3),'version_id':uid(2),'asset_id':asset,'export_id':None,
            'purpose':'video','created_at':'2026-10-30T01:59:30+00:00','expires_at':'2026-10-30T02:00:30+00:00','token_digest_present':True,'fixed_asset_membership':True}
        self.state['asset_grants']=[capability];self.validate()
        for mutate in (lambda v:v.update(expires_at='2026-10-30T02:00:31+00:00'),lambda v:v.update(asset_id=uid(500)),lambda v:v.update(token_digest='a'*64)):
            self.state['asset_grants']=[copy.deepcopy(capability)];mutate(self.state['asset_grants'][0])
            with self.assertRaises(ValueError):self.validate()
    def test_old_history_and_protected_facts_required(self):
        self.state['migration_versions']=self.versions[:-1]
        with self.assertRaises(ValueError):self.validate()
        self.state,_=fixture();self.state['protected']['m02_manual_note_retained']=False
        with self.assertRaises(ValueError):self.validate()
    def test_main_with_untrusted_cli_payload_does_not_publish_payload(self):
        result=mock.Mock(returncode=0,stdout=json.dumps({'rows':[{'m06_app_capture':{'private':'do not publish'}}]}))
        with mock.patch.object(m,'inputs',return_value=(self.versions,{},self.baseline)),mock.patch.object(m,'cli_call',return_value=result),mock.patch.object(m,'retain',return_value='synthetic-receipt.json')as retain,mock.patch('builtins.print'):
            self.assertEqual(m.main([]),1);report=retain.call_args[0][0];self.assertNotIn('state',report);self.assertNotIn('do not publish',json.dumps(report))

if __name__=='__main__':unittest.main()
