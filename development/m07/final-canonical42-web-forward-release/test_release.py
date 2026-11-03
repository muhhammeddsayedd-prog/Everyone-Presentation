"""Offline inverse/refusal tests; no CLI, credentials, private checkpoints or SQL."""
from pathlib import Path
import copy
import datetime
import importlib.util
import json
import types
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


p = module('final42_test_projection', HERE / 'projection.py')
r = module('final42_test_release', HERE / 'release.py')
f = module('final42_test_preflight', HERE / 'preflight.py')


class Source(unittest.TestCase):
    def test_closed_and_unbound_refuse_before_operator_or_reader(self):
        self.assertIs(r.RELEASE_ENABLED, False)
        self.assertEqual((p.TESTED, p.QUALITY, p.MIN_TESTS, p.CANONICAL42), (None, None, None, None))
        with patch.object(r, 'legacy', side_effect=AssertionError('transport loaded')):
            with self.assertRaises(ValueError):
                r.Operator('00000000-0000-4000-8000-000000000000')
            with patch.object(r, 'RELEASE_ENABLED', True):
                with self.assertRaises(ValueError):
                    r.Operator('00000000-0000-4000-8000-000000000000')
        with patch.object(f.r, 'Operator', side_effect=AssertionError('operator constructed')):
            with self.assertRaises(ValueError):
                f.main([])

    def test_every_projected_source_compiles_and_preserves_normal_dispatch(self):
        for name in ('gates.py', 'release.py', 'stage.py'):
            compile(p.project(name), name, 'exec')
        release = p.project('release.py')
        self.assertIn("'--prod','--archive=tgz','--yes','--no-wait','--project'", release)
        self.assertNotIn('--prebuilt', release)
        for name in ('deploy.claim.json', 'prepare.claim.json', 'normal_process_return_observed', 'normal_return_not_inferred', 'automatic_retry'):
            self.assertIn(name, release)
        gates = p.project('gates.py')
        self.assertIn('REASON_FILES=set()', gates)
        self.assertIn('changed&{x[\'path\']for x in source[\'files\']}==REASON_FILES', gates)
        self.assertIn("'schema42': None", gates)
        self.assertIn('_projection.canonical(', gates)

    def test_query_keeps_seven_idle_predicates_and_adds_only_state_operand(self):
        class Context:
            def state_sql(self):
                return "select jsonb_build_object('test_only',true)"
        sql = f.query_sql(Context())
        self.assertIn("'canonical42',(" + Context().state_sql() + "),'projection',", sql)
        self.assertTrue(sql.endswith('rollback;'))
        self.assertIn("read only;set local search_path='';", sql)
        for key in ('queued', 'running', 'waiting_for_input', 'generic_retry_lifecycle', 'presentation_retry_lifecycle', 'pending_outbox', 'leased_outbox'):
            self.assertIn("'" + key + "'", sql)
        self.assertIn('b3f90268-147d-41d4-8875-2a6435df1496', sql)

    def test_snapshot_keeps_full_identity_and_business_state_private(self):
        state = {'history': {'versions': ['x']}, 'targets': {'one': {'identity': {'proacl': ['a']}}}, 'fixed_functions': {'f': 'x'}, 'full_scope': {'catalogue': 'x'}, 'canonical41': {'private_rows': 'synthetic', 'compatibility': {'schema40': {'canonical': {'processing_config': {'specs': {'public': {'enabled': True}}}}}}}}
        class Context:
            def check(self, value, installed):
                if not installed or value.get('canonical41', {}).get('private_rows') != 'synthetic':
                    raise ValueError('invalid')
        g = types.SimpleNamespace(digest=r.g.digest)
        approved = {'stable_scope_sha256': g.digest(p.stable_scope(state))}
        good = p.snapshot_projection(g, Context(), state, approved)
        self.assertEqual(set(good), {'stable_scope_sha256', 'state_sha256', 'seven_sources_full_attributes_fixed_functions_catalogue_dependencies_verified', 'full76_current_state_checked'})
        self.assertNotIn('synthetic', repr(good))
        altered = copy.deepcopy(state)
        altered['targets']['one']['identity']['proacl'].append('b')
        with self.assertRaises(ValueError):
            p.snapshot_projection(g, Context(), altered, approved)
        changed_config = copy.deepcopy(state)
        changed_config['canonical41']['compatibility']['schema40']['canonical']['processing_config']['specs']['public']['enabled'] = False
        with self.assertRaises(ValueError):
            p.snapshot_projection(g, Context(), changed_config, approved)

    def test_preflight_receipt_rejects_drift_age_and_nonzero_work(self):
        now = datetime.datetime(2026, 11, 3, 12, tzinfo=datetime.timezone.utc)
        canonical = {'ref': {'path': 'test'}, 'checkpoint': {'sha256': 'a' * 64}, 'history': ['20261103104337'], 'stable_scope_sha256': 'b' * 64}
        plan = {'run_id': 'test', 'gates': {'source_commit': 'c' * 40, 'source_sha256': 'd' * 64, 'canonical': canonical}}
        current = {'history': canonical['history'], 'gates': dict.fromkeys(['specs', 'candidates', 'support', 'frames', 'presentations'], True), 'native_image_id': p.NATIVE, 'english_transcript_version': '1.0', 'lifecycle': dict.fromkeys(['queued', 'running', 'waiting_for_input', 'generic_retry_lifecycle', 'presentation_retry_lifecycle', 'pending_outbox', 'leased_outbox'], 0), 'worker': copy.deepcopy(p.WORKER), 'canonical42': {'stable_scope_sha256': 'b' * 64, 'state_sha256': 'e' * 64, 'seven_sources_full_attributes_fixed_functions_catalogue_dependencies_verified': True, 'full76_current_state_checked': True}}
        receipt = {'schema_version': '1.0', 'purpose': 'final_canonical42_web_forward_canonical_preflight', 'result': 'passed', 'run_id': 'test', 'source_commit': 'c' * 40, 'source_manifest_sha256': 'd' * 64, 'target': r.g.TARGET, 'canonical_receipt': canonical['ref'], 'recovery_checkpoint_sha256': 'a' * 64, 'observed_at': now.isoformat(), 'first': copy.deepcopy(current), 'second': copy.deepcopy(current), 'two_independent_readbacks_equal': True, 'cloud_mutations': False}
        g = types.SimpleNamespace(TARGET=r.g.TARGET, reference=lambda *args: receipt)
        self.assertTrue(p.preflight_gate(g, None, {}, plan, now, (now - datetime.timedelta(seconds=1)).isoformat())['after_local_build'])
        for key, value in [('native_image_id', 'wrong'), ('worker', {}), ('canonical42', {})]:
            bad = copy.deepcopy(receipt)
            bad['first'][key] = bad['second'][key] = value
            with self.assertRaises((ValueError, KeyError)):
                p.preflight_gate(types.SimpleNamespace(TARGET=g.TARGET, reference=lambda *args: bad), None, {}, plan, now, (now - datetime.timedelta(seconds=1)).isoformat())
        receipt['first']['lifecycle']['queued'] = receipt['second']['lifecycle']['queued'] = 1
        with self.assertRaises(ValueError):
            p.preflight_gate(g, None, {}, plan, now, (now - datetime.timedelta(seconds=1)).isoformat())

    def test_actual42_reference_and_protected_checkpoint_are_both_required(self):
        ref = {'path': 'apply', 'sha256': 'a' * 64}
        proof_ref = {'path': 'proof', 'sha256': 'b' * 64}
        state = {'history': {'versions': [str(i) for i in range(41)] + ['20261103104337']}}
        payload = {'target': r.g.TARGET, 'state': state, 'application_tables': {}, 'catalogue': {}, 'function_rows': [], 'history_rows': []}
        raw = json.dumps(payload).encode()
        checkpoint = {'path': '.local/test/after-checkpoint.json', 'sha256': p.sha(raw), 'history_path': ['state', 'history', 'versions'], 'tables': 76, 'scope': 'after_apply', 'restore_verified': False}
        proof = {'result': 'passed', 'collector_validation': {'result': 'passed'}, 'cloud_called': False, 'provider_called': False, 'all_owned_resources_absent': True, 'original_data_catalogue_and_global_roles_unchanged': True, 'shared_lock_released': True}
        apply = {'result': 'passed', 'target': r.g.TARGET, 'version': '20261103104337', 'migration_sha256': '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78', 'normal_return_marker_observed': True, 'two_independent_readbacks_equal': True, 'first': state, 'second': copy.deepcopy(state), 'admission': {'collector_validation': proof_ref}, 'checkpoint': checkpoint, 'preservation': {'all76_full_rows_including_reason_unchanged': True, 'all_function_metadata_OIDs_ACLs_policies_roles_dependencies_unchanged': True, 'only_exact_seven_prosrc_and_one_history_row_changed': True}}
        class Context:
            def check(self, value, installed):
                if value != state or installed is not True:
                    raise ValueError('bad state')
            def checkpoint_check(self, value, installed):
                if value['state'] != state or installed is not True:
                    raise ValueError('bad checkpoint')
            def version(self):
                return '20261103104337'
        g = types.SimpleNamespace(TARGET=r.g.TARGET, sha=p.sha, load=lambda file: raw, digest=r.g.digest, reference=lambda root, value: apply if value == ref else proof)
        verified = []
        with patch.multiple(p, TESTED='c' * 40, QUALITY={'path': 'q', 'sha256': 'd' * 64}, MIN_TESTS=1023, CANONICAL42={'ref': ref, 'proof': proof_ref, 'checkpoint': checkpoint}), patch.object(p, 'context', return_value=Context()), patch.object(p, 'stable_scope', return_value={'synthetic': 'closed'}):
            self.assertEqual(p.canonical(g, p.MAIN, 'schema42', ref, verified.append)['history'], state['history']['versions'])
            self.assertEqual(verified, [p.MAIN / checkpoint['path']])
            apply['normal_return_marker_observed'] = False
            with self.assertRaises(ValueError):
                p.canonical(g, p.MAIN, 'schema42', ref, verified.append)
            apply['normal_return_marker_observed'] = True
            proof['shared_lock_released'] = False
            with self.assertRaises(ValueError):
                p.canonical(g, p.MAIN, 'schema42', ref, verified.append)


if __name__ == '__main__':
    unittest.main()
