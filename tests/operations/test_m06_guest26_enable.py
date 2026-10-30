"""One-flag boundary checks; no CLI, key material or private config access."""
import copy
import datetime
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest import mock
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('m06_guest26_enable',ROOT/'tools/enable_m06_guest26.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Guest26EnableTests(unittest.TestCase):
    def setUp(self):
        self.local=json.loads((ROOT/'tracking/evidence/m06/guest26-readiness-local/2026-10-30T00-56-10-533Z-9b06baf4.json').read_bytes())
        self.before=copy.deepcopy(self.local['before']);self.after=copy.deepcopy(self.local['enabled_state']);self.digest=self.local['enabled_projection_sha256']

    def test_exact_two_safe_projection_differences_only(self):self.assertTrue(all(m.compare_enabled(self.before,self.after,self.digest).values()))

    def test_unrelated_data_and_catalog_changes_denied(self):
        for mutate in (lambda v:v['old_data']['hashes'].update({'eps.jobs':'0'*64}),lambda v:v.update(catalog_protected_sha256='0'*64),lambda v:v['old_data']['managed_auth'].update(user_count=99)):
            after=copy.deepcopy(self.after);mutate(after)
            with self.assertRaises(m.release.Blocked):m.compare_enabled(self.before,after,self.digest)

    def test_no_key_metadata_or_ttl_change(self):
        for field,value in (('key_present',False),('key_bytes',16),('session_ttl_seconds',7200),('backend_key','never-allowed')):
            after=copy.deepcopy(self.after);after['new_state']['config'][field]=value
            with self.subTest(field=field),self.assertRaises(m.release.Blocked):m.compare_enabled(self.before,after,self.digest)

    def test_repeat_before_already_enabled_denied(self):
        self.before['new_state']['config']['enabled']=True
        with self.assertRaises(m.release.Blocked):m.compare_enabled(self.before,self.after,self.digest)

    def test_wrong_enabled_projection_hash_denied(self):
        with self.assertRaises(m.release.Blocked):m.compare_enabled(self.before,self.after,'0'*64)

    def test_bootstrap_only_presence_and_length_change(self):
        before=copy.deepcopy(self.local['original']);after=copy.deepcopy(before);after['new_state']['config'].update(key_present=True,key_bytes=32)
        self.assertTrue(m.compare_bootstrap(before,after));after['old_data']['hashes']['eps.review_gateway_config']='0'*64
        with self.assertRaises(m.release.Blocked):m.compare_bootstrap(before,after)

    def test_readiness_exact_protected_job_idle_and_key(self):
        state=copy.deepcopy(self.local['readiness_before']);inputs={'versions':state['versions']};m.validate_readiness(state,inputs,False)
        for mutate in (lambda v:v.update(active_jobs=1),lambda v:v.update(leased_outbox=1),lambda v:v['protected_m02'].update(manual_note_retained=False),lambda v:v.update(presentation_processing_enabled=False),lambda v:v['gateway'].update(key_bytes=0)):
            changed=copy.deepcopy(state);mutate(changed)
            with self.assertRaises(m.release.Blocked):m.validate_readiness(changed,inputs,False)

    def test_explicit_startup12_without_claim_or_provider(self):
        seals={m.STARTUP_HARNESS:'a'*64,**{f'synthetic-source-{i}':'b'*64 for i in range(22)}}
        proof={'result':'passed','sources_stable':True,'gateway_attempted':True,'authenticated_gateway_verified':True,'verified_function_operations':12,'jobs_claimed':False,'provider_invoked':False,'workflows_executed':False,'credentials_printed':False,'hosting_deferred':True,'harness_path':m.STARTUP_HARNESS,'harness_sha256':'a'*64,'source_sha256':seals}
        with mock.patch.object(m.release,'sealed'):m.validate_startup(proof,{'source_seals':seals})
        for field,value in (('verified_function_operations',11),('provider_invoked',True),('jobs_claimed',True),('gateway_attempted',False),('credentials_printed',True)):
            changed=copy.deepcopy(proof);changed[field]=value
            with mock.patch.object(m.release,'sealed'),self.subTest(field=field),self.assertRaises(m.release.Blocked):m.validate_startup(changed,{'source_seals':seals})

    def test_actual_repaired_workflow_metadata_five_stages(self):
        repaired=json.loads((ROOT/'tracking/evidence/m06/n8n-wf03/2026-10-30T00-34-58-982Z-fde4b974-expression-repair.json').read_bytes());probe=json.loads((ROOT/'tracking/evidence/m06/n8n-wf03/2026-10-30T00-35-04-583Z-43a350e8-expression-probe.json').read_bytes())
        config={'source_seals':repaired['source_seals']}
        with mock.patch.object(m.release,'sealed'):m.validate_workflow(repaired,probe,config)
        probe['stages']=probe['stages'][:-1]
        with mock.patch.object(m.release,'sealed'),self.assertRaises(m.release.Blocked):m.validate_workflow(repaired,probe,config)

    def test_worker_mode_ownership_and_matching_startup(self):
        item={'path':'synthetic-startup.json','sha256':'a'*64};startup={'source_sha256':{'source':'b'*64}}
        worker={'result':'started','new_process_ownership_verified':True,'sources_match_authenticated_startup':True,'public_worker_listener':False,'guest_exports_enabled':True,'hosting_deferred':True,'worker_id':123,'startup_proof':item['path'],'startup_proof_sha256':item['sha256'],'source_sha256':startup['source_sha256']}
        m.validate_worker(worker,item,startup)
        for field,value in (('guest_exports_enabled',False),('public_worker_listener',True),('new_process_ownership_verified',False),('worker_id',True),('startup_proof','wrong')):
            changed=copy.deepcopy(worker);changed[field]=value
            with self.subTest(field=field),self.assertRaises(m.release.Blocked):m.validate_worker(changed,item,startup)

    def test_runtime_process_proof_freshness(self):
        now=datetime.datetime(2026,10,30,tzinfo=datetime.timezone.utc)
        m.validate_fresh({'observed_at':(now-datetime.timedelta(seconds=30)).isoformat()},now)
        for seconds in (-1,901):
            with self.assertRaises(m.release.Blocked):m.validate_fresh({'observed_at':(now-datetime.timedelta(seconds=seconds)).isoformat()},now)

    def test_missing_config_seal_blocks_before_cli(self):
        with mock.patch.object(m,'CONFIG_SHA',''),mock.patch.object(m.release,'call')as call:
            with self.assertRaises(m.release.Blocked):m.current_inputs()
            call.assert_not_called()

    def test_historical_attempt_or_claim_denies_repeat(self):
        for claimed,attempts in ((True,[]),(False,['historical-attempt'])):
            claim=mock.Mock();claim.exists.return_value=claimed;evidence=mock.Mock();evidence.glob.return_value=attempts
            with mock.patch.object(m,'CLAIM',claim),mock.patch.object(m,'EVIDENCE',evidence),self.assertRaises(m.release.Blocked):m.refuse_repeat()

    def test_own_retained_attempt_does_not_block_exclusive_claim(self):
        claim=mock.Mock();claim.exists.return_value=False;security=mock.Mock();handle=mock.Mock();handle.fileno.return_value=1;security.create.return_value.__enter__=mock.Mock(return_value=handle);security.create.return_value.__exit__=mock.Mock(return_value=False)
        with mock.patch.object(m,'CLAIM',claim),mock.patch.object(m,'refuse_repeat',side_effect=AssertionError('Own attempt must not be rejected')),mock.patch('provision_logo_verifier.WindowsPrivateFiles',return_value=security),mock.patch.object(m.os,'fsync'):
            m.write_claim(self.before,{'versions':[]},{},'synthetic-enable-attempt.json')
            security.create.assert_called_once_with(claim);self.assertTrue(handle.write.called)

if __name__=='__main__':unittest.main()
