"""Synthetic release guards only. No cloud, process or private file operations."""
import copy
import importlib.util
import datetime
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from contextlib import ExitStack, redirect_stdout
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('m04_ai_apply_release', ROOT / 'tools/release_m04_ai_apply.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
import prepare_m04_review_readback as prepare


def fixture():
    delta={'schema_version':'1.0','created':{'functions|eps.new(uuid)|owner':'eps_review_owner'},'changed':{'functions|public.eps_update_assignment(uuid,jsonb,text)|source_sha256':{'before':'a'*64,'after':'b'*64}},'deleted':{}}
    before={'versions':[str(value)for value in range(22)],'counts':{'auth.users':1,'eps.jobs':3,'eps.review_processing_config':1,'eps.ai_suggestions':0},'data_sha256':{'eps.jobs':'e'*64,'eps.review_processing_config':'c'*64},'runtime':{'unchanged':True},'managed_auth':{'unchanged':True},'schema_defaults':{'unchanged':True},'source_config':{'enabled':True},'protected_m02':{'unchanged':True},'catalog_full_sha256':'f'*64,'catalog_protected_sha256':'1'*64,'catalog_count':100,'catalog_delta_values':{key:row['before']for key,row in delta['changed'].items()},'review_state':{'config':{'enabled':True,'model':'gpt-6.1-sol'},'template':{'content_sha256':'d'*64}}}
    after=copy.deepcopy(before);after['versions'].append(release.MIGRATION[:14]);after['catalog_full_sha256']='2'*64;after['catalog_count']+=1;after['catalog_delta_values']={**delta['created'],**{key:row['after']for key,row in delta['changed'].items()}}
    return before,after,delta


class ReviewRelease(unittest.TestCase):
    def setUp(self):
        active = patch.object(release, 'MIGRATION', '20261029203953_m04_ai_apply_source_guard.sql'); active.start(); self.addCleanup(active.stop)
        self.before, self.after, self.delta = fixture()

    def test_import_is_inert_and_missing_seals_stop_before_cli(self):
        with patch.object(release, 'CONFIG_SHA', None), patch.object(release, 'cli_call', side_effect=AssertionError('CLI forbidden')):
            with self.assertRaises(release.Blocked): release.current_release_inputs()

    def test_only_exact_guard_catalog_fields_change_and_existing_processing_is_preserved(self):
        result = release.compare_states(self.before, self.after, self.delta)
        self.assertTrue(result['old_business_and_catalog_preserved'])
        self.assertTrue(result['processing_configuration_and_template_unchanged'])

    def test_old_business_auth_runtime_config_and_unrelated_catalog_drift_are_denied(self):
        changes = [lambda value: value['counts'].update({'auth.users': 2}), lambda value: value['data_sha256'].update({'eps.jobs': '0' * 64}),
                   lambda value: value['runtime'].update(unexpected=True), lambda value: value['managed_auth'].update(unexpected=True),
                   lambda value: value['schema_defaults'].update(unexpected=True), lambda value: value['source_config'].update(enabled=False),
                   lambda value: value['protected_m02'].update(unexpected=True), lambda value: value.update(catalog_protected_sha256='3' * 64),
                   lambda value: value['catalog_delta_values'].update({'functions|public.eps_update_assignment(uuid,jsonb,text)|source_sha256': '0' * 64}),
                   lambda value: value['catalog_delta_values'].update({'unreviewed': 'true'}), lambda value: value.update(catalog_count=102),
                   lambda value: value['review_state']['config'].update(enabled=False), lambda value: value['counts'].update({'eps.ai_suggestions': 1})]
        for change in changes:
            with self.subTest(change=change):
                value = copy.deepcopy(self.after); change(value)
                with self.assertRaises(release.Blocked): release.compare_states(self.before, value, self.delta)

    def test_before_values_cannot_adopt_unexpected_deployed_correction_or_created_key_collision(self):
        for change in [lambda value: value['catalog_delta_values'].update({'functions|public.eps_update_assignment(uuid,jsonb,text)|source_sha256': '9' * 64}),
                       lambda value: value['catalog_delta_values'].update({'functions|eps.new(uuid)|owner': 'already-present'})]:
            value = copy.deepcopy(self.before); change(value)
            with self.assertRaises(release.Blocked): release.compare_states(value, self.after, self.delta)

    def test_pending_plan_and_command_are_fixed_to_exact23_without_seed_roles_or_vault(self):
        release.validate_pending('Apply ' + release.MIGRATION)
        for value in ['', 'other.sql', release.MIGRATION + '\n20261029180953_m03_frame_vision_selection.sql']:
            with self.assertRaises(release.Blocked): release.validate_pending(value)
        command = release.push_command(False)
        self.assertIn('--skip-vault', command); self.assertNotIn('--include-seed', command); self.assertNotIn('--include-roles', command)
        self.assertEqual(command[command.index('--project-ref') + 1], 'pyibofyctwnqpvktepse')
        self.assertEqual(release.push_command(True), command + ['--dry-run'])

    def test_ambient_routing_tls_and_workdir_overrides_cannot_redirect_fixed_release(self):
        release.validate_process_scope({'SUPABASE_ACCESS_TOKEN': 'synthetic-private-auth'})
        for name in ['SUPABASE_PROJECT_ID', 'SUPABASE_API_URL', 'SUPABASE_WORKDIR', 'PGHOST', 'PGHOSTADDR', 'PGSERVICE', 'PGOPTIONS', 'PGSSLROOTCERT', 'PGSSLMODE']:
            with self.assertRaises(release.Blocked): release.validate_process_scope({name: 'synthetic-private-override'})

    def test_proof_binds_current_harness_tests_and_exact_marker_set(self):
        config = {'baseline_manifest': {'sha256': '1' * 64}, 'reviewed_manifest': {'sha256': '2' * 64},
                  'source_seals': {'tools/synthetic-proof.mjs': '3' * 64, 'tests/db/synthetic.sql': '4' * 64},
                  'required_markers': ['M04_SYNTHETIC_PASSED']}
        proof = {'harness_path': 'tools/synthetic-proof.mjs', 'harness_sha256': '3' * 64,
                 'source_sha256': {'tests/db/synthetic.sql': '4' * 64, 'development/local-db/reviewed.json': '1' * 64},
                 'markers': ['M04_SYNTHETIC_PASSED']}
        with patch.object(release, 'sealed'):
            release.validate_proof_sources(proof, config, candidate=True)
            for patcher in [lambda value: value.update(harness_sha256='5' * 64), lambda value: value['source_sha256'].update({'tests/db/synthetic.sql': '5' * 64}),
                            lambda value: value['source_sha256'].update({'unknown': '4' * 64}), lambda value: value.update(markers=['M04_OTHER_PASSED']),
                            lambda value: value.update(markers=['M04_SYNTHETIC_PASSED'] * 2)]:
                value = copy.deepcopy(proof); patcher(value)
                with self.assertRaises(release.Blocked): release.validate_proof_sources(value, config, candidate=True)

    def test_one_shot_apply_claim_or_any_prior_apply_attempt_prevents_repeat(self):
        with patch.object(release.CLAIM.__class__, 'exists', return_value=True):
            with self.assertRaises(release.Blocked): release.refuse_repeat_apply()

    def test_enabled_or_disabled_existing_processing_is_preserved_without_adopting_new_rows(self):
        for enabled in (True, False):
            before, after = copy.deepcopy((self.before, self.after))
            before['review_state']['config']['enabled'] = after['review_state']['config']['enabled'] = enabled
            release.compare_states(before, after, self.delta)
        for extra in ('new_tables', 'review_state'):
            value = copy.deepcopy(self.delta); value[extra] = {}
            with self.assertRaises(release.Blocked): release.validate_delta(value)

    def test_real_race_receipt_requires_two_actors_source_busy_and_atomic_ack_proof(self):
        files = {'development/m04/assignment-ai-apply-forward.sql', 'tools/test-m04-ai-apply-race-local.mjs', 'tests/db/m04-ai-apply.sql', 'tests/db/m04-assignments-fixture.sql'}
        config = {'baseline_manifest': {'sha256': '1' * 64}, 'source_seals': {file: '2' * 64 for file in files}}
        item = {'result': 'passed', 'cloud_called': False, 'provider_called': False, 'hosted_credential_files_read': False,
                **{key: True for key in ('sources_stable', 'assertions_passed', 'disposable_cleanup_verified', 'canonical22_unchanged', 'managed_auth_metadata_and_row_revisions_preserved', 'reviewed_catalog_and_application_snapshot_matches22', 'private_artifacts_owner_system_protected')},
                'before': {}, 'after': {}, 'managed_auth_before': {}, 'managed_auth_after': {}, 'distinct_authorized_principals': 2,
                'source_seals': {**config['source_seals'], 'development/local-db/reviewed.json': '1' * 64}, 'harness_sha256': '2' * 64,
                'busy_then_changed_source': {'real_source_writer_held': True, 'nowait_denied_code': 'INPUT_CHANGED', 'no_partial_mutation': True, 'proposal_get_before_source_commit': True, 'after_commit_denied_code': 'INPUT_CHANGED'},
                'atomic_apply_source_lock': {'source_writer_lock_wait_observed': True, 'apply_committed_before_source_writer': True, 'one_assignment_update_event': True, 'exact_ack_replay_after_later_source_change': True}}
        with patch.object(release, 'sealed'):
            release.validate_race_proof(item, config)
            for change in (lambda value: value.update(distinct_authorized_principals=1), lambda value: value['busy_then_changed_source'].update(no_partial_mutation=False), lambda value: value['atomic_apply_source_lock'].update(source_writer_lock_wait_observed=False), lambda value: value['source_seals'].pop('development/m04/assignment-ai-apply-forward.sql')):
                value = copy.deepcopy(item); change(value)
                with self.assertRaises(release.Blocked): release.validate_race_proof(value, config)

    def test_compact_readback_replaces_effective_acl_crossproduct_and_keeps_all_old_storage_rows(self):
        source = prepare.generate_readback((ROOT / prepare.BASE).read_text(encoding='utf8'), (ROOT / prepare.ORACLE).read_text(encoding='utf8'), ["functions|eps.quoted('value')|source_sha256"])
        self.assertIn('begin isolation level repeatable read read only;', source)
        self.assertNotIn("where r.rolname in('anon','authenticated','service_role')", source)
        self.assertNotIn("r.id<>'eps-candidate-support'", source)
        self.assertIn("functions|eps.quoted(''value'')|source_sha256", source)
        self.assertIn('catalog_protected_sha256', source)
        self.assertIn("::jsonb-'catalog'", source)
        self.assertTrue(source.rstrip().endswith('rollback;'))

    def protocol(self, *, unknown=False, source_drift=False, stale_dry=False):
        before, after, delta = copy.deepcopy((self.before, self.after, self.delta))
        inputs = {'versions': after['versions'], 'migration_sha256': 'a' * 64, 'readback_sha256': 'b' * 64}
        saved = {'tracking/evidence/cloud-m04-ai-apply/dry-run.json': {'result': 'passed', 'inputs': inputs, 'before': before,
                 'pending_migrations': [release.MIGRATION], 'finished_at': (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=1000 if stale_dry else 1)).isoformat()}}
        calls = []; claims = []; checks = 0
        def current():
            nonlocal checks
            checks += 1
            return {**inputs, 'changed': True} if source_drift and checks == 2 else inputs
        def load(name):
            name = name.as_posix() if isinstance(name, Path) else name
            return delta if name == release.DELTA else saved[name]
        def retain(value, suffix):
            path = 'tracking/evidence/cloud-m04-ai-apply/synthetic-' + suffix + '.json'; saved[path] = copy.deepcopy(value); return path
        def write(file, data):
            self.assertEqual(file, release.CLAIM); claims.append(data); saved[file.relative_to(release.ROOT).as_posix()] = json.loads(data)
        def call(arguments):
            calls.append(arguments)
            if unknown: raise subprocess.TimeoutExpired('synthetic', 1)
            return subprocess.CompletedProcess([], 0, release.MIGRATION, '')
        def refuse(): release.require(not claims)
        stack = ExitStack(); stack.enter_context(patch.object(release, 'current_release_inputs', side_effect=current))
        stack.enter_context(patch.object(release, 'read_json', side_effect=load)); stack.enter_context(patch.object(release, 'retain', side_effect=retain))
        stack.enter_context(patch.object(release, 'private_write', side_effect=write)); stack.enter_context(patch.object(release, 'call', side_effect=call))
        stack.enter_context(patch.object(release, 'refuse_repeat_apply', side_effect=refuse)); stack.enter_context(redirect_stdout(io.StringIO()))
        return stack, saved, calls, claims, inputs

    def test_apply_claim_precedes_single_dispatch_and_unknown_outcome_allows_only_readback(self):
        stack, saved, calls, claims, inputs = self.protocol(unknown=True)
        with stack:
            with patch.object(release, 'inspect_state', return_value=self.before):
                with self.assertRaises(subprocess.TimeoutExpired): release.main(['apply'])
            self.assertEqual(len(claims), 1); self.assertEqual(calls, [release.push_command(False)])
            self.assertTrue(saved['tracking/evidence/cloud-m04-ai-apply/synthetic-apply.json']['dispatch_attempted'])
            with patch.object(release, 'inspect_state', return_value=self.after): release.main(['readback'])
            self.assertTrue(saved['tracking/evidence/cloud-m04-ai-apply/synthetic-readback.json']['application_verified_by_readback'])
            with patch.object(release, 'inspect_state', return_value=self.before):
                with self.assertRaises(release.Blocked): release.main(['apply'])
            self.assertEqual(len(calls), 1); self.assertEqual(len(claims), 1)

    def test_stale_dry_run_and_last_moment_source_drift_never_dispatch(self):
        for settings in ({'stale_dry': True}, {'source_drift': True}):
            stack, saved, calls, claims, inputs = self.protocol(**settings)
            with stack, patch.object(release, 'inspect_state', return_value=self.before):
                with self.assertRaises(release.Blocked): release.main(['apply'])
                self.assertEqual(calls, []); self.assertEqual(len(claims), 0 if settings.get('stale_dry') else 1)


if __name__ == '__main__': unittest.main()
