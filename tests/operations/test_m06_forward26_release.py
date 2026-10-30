"""Pure release-boundary regressions. No CLI/config/provider/private access."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest import mock
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
SPEC = importlib.util.spec_from_file_location('m06_forward26_release', ROOT / 'tools/release_m06_forward26.py')
m = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(m)

class ReviewReleaseTests(unittest.TestCase):
    def setUp(self):
        self.delta = json.loads((ROOT / 'development/m06/forward26-release-delta.json').read_bytes())
        proof = json.loads((ROOT / 'tracking/evidence/m06/forward26-release-local/2026-10-30T00-46-20-101Z-255c7bf7.json').read_bytes())
        self.before = copy.deepcopy(proof['readback_before']); self.after = copy.deepcopy(proof['readback_expected'])
        self.after['old_data']['versions'].append(m.MIGRATION[:14])
        self.before['runtime'] = {'name':'eps_specs_runtime','execute':sorted(m.OLD_OPERATIONS)}
        self.after['runtime'] = {'name':'eps_specs_runtime','execute':sorted(m.NEW_OPERATIONS)}
        self.before['protected_m02'] = self.after['protected_m02'] = {'exists':True,'manual_note_retained':True}

    def test_exact_local_delta_and_valid_additive_comparison(self):
        self.assertTrue(m.validate_delta(self.delta)); m.validate_before_state(self.before,self.delta)
        self.assertTrue(all(m.compare_states(self.before,self.after,self.delta).values()))

    def test_no_deleted_catalog_allowed(self):
        self.delta['deleted']['function|unrelated|owner'] = 'postgres'
        with self.assertRaises(m.Blocked): m.validate_delta(self.delta)

    def test_enabled_or_key_present_initial_state_denied(self):
        for field,value in [('enabled',True),('key_present',True),('key_bytes',32)]:
            delta=copy.deepcopy(self.delta);delta['new_state']['config'][field]=value
            with self.subTest(field=field),self.assertRaises(m.Blocked):m.validate_delta(delta)

    def test_secret_field_initial_state_denied(self):
        self.delta['new_state']['config']['backend_key']='must-not-exist'
        with self.assertRaises(m.Blocked):m.validate_delta(self.delta)

    def test_old_business_count_drift_denied(self):
        self.after['old_data']['counts']['eps.candidates']+=1
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)

    def test_old_business_hash_drift_denied(self):
        self.after['old_data']['hashes']['eps.specs']='0'*64
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)

    def test_managed_auth_count_drift_denied(self):
        self.after['old_data']['managed_auth']['user_count']+=1
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)

    def test_unrelated_catalog_drift_denied(self):
        self.after['catalog_protected_sha256']='0'*64
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)

    def test_wrong_new_column_or_policy_denied(self):
        self.after['catalog_delta_values'][next(iter(self.after['catalog_delta_values']))]='not-exact'
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)

    def test_no_new_runtime_permission_beyond_operation12(self):
        self.after['runtime']['execute'].append('eps.arbitrary_admin(jsonb)')
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)

    def test_no_old_runtime_operation_removed(self):
        self.after['runtime']['execute'].remove('eps.claim_job_stage(jsonb)')
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)

    def test_no_runtime_authority_change(self):
        self.after['runtime']['superuser']=True
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)

    def test_config_only_does_not_credit_preprovisioned_key(self):
        self.after['new_state']['config']['key_present']=True
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)

    def test_exact_one_pending_migration(self):
        m.validate_pending('Only '+m.MIGRATION)
        for text in ('',m.MIGRATION+'\n20261030000000_unrelated.sql'):
            with self.subTest(text=text),self.assertRaises(m.Blocked):m.validate_pending(text)

    def test_push_has_no_seed_reset_or_vault_sync(self):
        command=m.push_command(True)
        self.assertIn('--skip-vault',command);self.assertIn('--dry-run',command)
        self.assertNotIn('--include-seed',command);self.assertNotIn('reset',command)
        self.assertEqual(command[command.index('--project-ref')+1],m.TARGET)

    def test_ambient_redirect_denied(self):
        m.validate_process_scope({})
        for name in ('PGHOST','PGDATABASE','PGOPTIONS','SUPABASE_DB_URL','SUPABASE_PROJECT_ID'):
            with self.subTest(name=name),self.assertRaises(m.Blocked):m.validate_process_scope({name:'redirect'})

    def test_apply_claim_or_attempt_denies_repeat(self):
        for claimed,attempts in ((True,[]),(False,['retained-attempt'])):
            claim=mock.Mock();claim.exists.return_value=claimed;evidence=mock.Mock();evidence.glob.return_value=attempts
            with mock.patch.object(m,'CLAIM',claim),mock.patch.object(m,'EVIDENCE',evidence),self.assertRaises(m.Blocked):m.refuse_repeat_apply()

    def test_missing_config_seal_blocks_before_cli(self):
        with mock.patch.object(m,'CONFIG_SHA',''),mock.patch.object(m,'call')as call:
            with self.assertRaises(m.Blocked):m.current_release_inputs()
            call.assert_not_called()

    def test_initial_state_requires_empty_new_tables(self):
        self.before['new_state']['tables']['review_links']={'count':1}
        with self.assertRaises(m.Blocked):m.validate_before_state(self.before,self.delta)

    def test_fixed_role_and_original_job_admission(self):
        admission={'query_role':'postgres','database':'postgres','unrestricted_visibility':True,
          'runtime':{'name':'eps_specs_runtime','login':True,'inherit':False,'superuser':False,'bypass_rls':False,'create_db':False,'create_role':False,'replication':False,'execute':sorted(m.NEW_OPERATIONS)},
          'protected_m02':{'exists':True,'manual_note_retained':True}}
        state=copy.deepcopy(self.after);state.pop('runtime');state.pop('protected_m02')
        inputs={'readback_sha256':'0'*64,'admission_sha256':'1'*64,'versions':state['old_data']['versions']}
        with mock.patch.object(m,'_query',side_effect=[state,admission]):self.assertEqual(m.inspect_state(inputs)['runtime']['execute'],sorted(m.NEW_OPERATIONS))
        for field in ('unrestricted_visibility','protected_m02'):
            bad=copy.deepcopy(admission);bad[field]=False if field=='unrestricted_visibility'else{'exists':True,'manual_note_retained':False}
            with mock.patch.object(m,'_query',side_effect=[state,bad]),self.assertRaises(m.Blocked):m.inspect_state(inputs)

if __name__=='__main__':unittest.main()
