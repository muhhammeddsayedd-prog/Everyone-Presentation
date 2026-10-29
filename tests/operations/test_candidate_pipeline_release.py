"""Offline guards only. No CLI/network/DB/provider is called by these tests."""
import copy,json,sys,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import release_candidate_pipeline as release

class CandidatePipelineReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.promotion=release.read_json(release.PROMOTION)
        # Historical successful cloud16 readback, used offline as an exact
        # role-shape fixture. It is not a fresh credential authentication test.
        cls.observed_runtime=release.read_json('tracking/evidence/cloud-pdf-vision/2026-10-29T09-54-06-914141Z-9a0506a9-apply.json')['readback']['runtime']
    def identity(self):
        state=copy.deepcopy(self.promotion['before'])
        state['runtime']=copy.deepcopy(self.observed_runtime)
        return state
    def inspect(self,state):
        response=SimpleNamespace(returncode=0,stdout=json.dumps({'rows':[{'candidate_pipeline_release':state}]}))
        with patch.object(release,'call',return_value=response):return release.inspect()
    def test_pinned_local_evidence_and_history_pass_without_cloud(self):
        _,versions=release.prerequisites();self.assertEqual(len(versions),16)
    def test_expected_catalog_delta_and_json_bridge_roundtrip(self):
        release.compare(self.promotion['before'],self.promotion['after'])
        actual=self.inspect(self.identity())['runtime'];self.assertEqual(actual['name'],'eps_specs_runtime');self.assertIs(actual['inherit'],False)
        self.assertEqual(actual['incoming'],[{'name':'postgres','grantor':'supabase_admin','admin':True,'inherit':False,'set':False}])
    def test_hidden_snapshot_or_broader_runtime_identity_is_rejected(self):
        for change in ['visibility','table','function','member_set','role_inherit','unrelated_incoming']:
            state=self.identity()
            if change=='visibility':state['unrestricted_visibility']=False
            elif change=='table':state['runtime']['table_authority']=True
            elif change=='function':state['runtime']['execute'].append('eps.candidate_upload_scope(uuid)')
            elif change=='member_set':state['runtime']['parents'][0]['set']=True
            elif change=='role_inherit':state['runtime']['inherit']=True
            else:state['runtime']['incoming'].append({'name':'authenticated','grantor':'postgres','admin':False,'inherit':True,'set':True})
            with self.assertRaises(ValueError):self.inspect(state)
    def test_private_helper_auth_execute_tampering_rejected(self):
        after=copy.deepcopy(self.promotion['after'])
        next(row for row in after['catalog']['functions'] if row['name']=='eps.candidate_upload_scope')['execute']['authenticated']=True
        with self.assertRaises(ValueError):release.compare(self.promotion['before'],after)
    def test_existing_media_default_or_business_change_rejected(self):
        for change in ['issues','jobs']:
            after=copy.deepcopy(self.promotion['after'])
            if change=='issues':after['candidate_processing_issues_pristine']=False
            else:after['data_sha256']['eps.jobs']='0'*64
            with self.assertRaises(ValueError):release.compare(self.promotion['before'],after)
if __name__=='__main__':unittest.main()
