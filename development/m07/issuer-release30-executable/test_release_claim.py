"""Claim paths and nested identity fields cannot authorize private file reads."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('issuer30_release_claim',HERE/'release.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
BASE=HERE.parents[2]/'tracking/evidence/m07/issuer-release30-executable/2026-10-30T15-31-12-986032Z-b19aca5b-canonical-discovery.json'
class NestedGuards(unittest.TestCase):
    def test_readback_attempt_must_match_pinned_before_identity_plan_and_sources(self):
        base=json.loads(BASE.read_text())['discovery'];plan=json.loads((HERE/'release-plan.json').read_text())
        inputs={'base':base,'plan':plan,'sources':{'synthetic-source':'a'*64}}
        claim={'target':module.TARGET,'plan':plan,'before_sha256':module.canonical(base),'attempt_receipt':'tracking/evidence/m07/issuer-release30-executable/2026-10-30T16-00-00-123456Z-123456ab-canonical-apply-attempt.json','attempt_sha256':'b'*64,'dispatch_may_have_occurred':True}
        attempt={'schema_version':'1.0','action':'apply','target':module.TARGET,'started_at':'2026-10-30T16:00:00+00:00','result':'failed','dispatch_attempted':False,'automatic_retry':False,'provider_hook_client_or_identity_mutations':False,'seeds':False,'vault_sync':False,'claude_config_login_or_model_calls':False,'raw_diagnostics_suppressed':True,'plan':plan,'source_seals':inputs['sources'],'cli_login_expiry_qualifications':[],'before':base,'quiescence':{'schema_version':'1.0','observed_at':'2026-10-30T15:59:30+00:00','target':module.TARGET,'owned_processes_verified':True,'web_stopped':True,'worker_stopped':True,'owned_pids':[123,456],'ownership_evidence':'.local/synthetic/owned-stop.json'}}
        module.validate_attempt(inputs,claim,attempt)
        for patch_value in [{'action':'readback'},{'target':'other'},{'source_seals':{}},{'private_token':'sentinel'}]:
            with self.subTest(patch=patch_value),self.assertRaises(ValueError):module.validate_attempt(inputs,claim,dict(attempt,**patch_value))
        changed=copy.deepcopy(attempt);changed['before']['catalog']['tables|eps.app_settings|force_rls']=False
        with self.assertRaises(ValueError):module.validate_attempt(inputs,claim,changed)
    def test_windows_drive_path_denied_before_any_file_read(self):
        with patch.object(Path,'resolve',lambda p:p),patch.object(Path,'is_file',return_value=True),patch.object(Path,'is_symlink',return_value=False),patch.object(Path,'read_bytes',side_effect=AssertionError('EXTERNAL_READ_ATTEMPTED'))as read:
            with self.assertRaises(ValueError):module.sealed('C:/outside/synthetic-private.json','a'*64)
            read.assert_not_called()
    def test_claim_closed_fields_sha_and_exact_attempt_receipt_are_required(self):
        plan={'schema_version':'1.0','version':'20261030154824','migration_path':'supabase/migrations/20261030154824_m07_native_oauth_issuer.sql','migration_sha256':module.CANDIDATE_SHA,'candidate_sha256':module.CANDIDATE_SHA,'cli_version':'2.122.0'}
        claim={'target':module.TARGET,'plan':plan,'before_sha256':'a'*64,'attempt_receipt':'tracking/evidence/m07/issuer-release30-executable/2026-10-30T16-00-00-123456Z-123456ab-canonical-apply-attempt.json','attempt_sha256':'b'*64,'dispatch_may_have_occurred':True}
        module.validate_claim(claim)
        for patch_value in [{'attempt_receipt':'C:/outside/synthetic-private.json'},{'attempt_receipt':'tracking/evidence/../private.json'},{'attempt_sha256':'x'},{'before_sha256':None},{'dispatch_may_have_occurred':1},{'private_token':'sentinel'}]:
            with self.subTest(patch=patch_value),self.assertRaises(ValueError):module.validate_claim(dict(claim,**patch_value))
    def test_membership_oids_flags_names_and_new_owner_inventory_are_closed(self):
        state=json.loads(BASE.read_text())['discovery']
        proof=json.loads((HERE.parents[2]/'tracking/evidence/m07/issuer-release30-executable/2026-10-30T15-54-37-082Z-36b1483b-local-proof.json').read_text())
        module.validate_query_shape(json.loads((HERE.parents[2]/proof['committed_snapshot']['path']).read_text()))
        for patch_value in [{'role_oid':'synthetic-private-sentinel'},{'role_oid':'4294967295'},{'member':'missing-role'},{'set':1},{'private_token':'sentinel'}]:
            value=copy.deepcopy(state);value['context']['all_memberships'][0].update(patch_value)
            with self.subTest(patch=patch_value),self.assertRaises(ValueError):module.validate_query_shape(value)
        value=json.loads((HERE.parents[2]/proof['committed_snapshot']['path']).read_text());owner=value['context']['effective_privileges']['eps_mcp_issuer_owner']
        owner['columns']['auth.users.synthetic_private_extra']={'select':False,'insert':False,'update':False,'references':False}
        with self.assertRaises(ValueError):module.validate_query_shape(value)
