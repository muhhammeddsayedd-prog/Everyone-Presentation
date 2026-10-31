"""Synthetic pure fixtures; no CLI, credentials, database or filesystem effects."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('future_origin', Path(__file__).with_name('future-origin.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def metadata():
    return {**{key: {'count': 2, 'sha256': 'a' * 64} for key in ('versions', 'slides', 'pins', 'ready_asset_metadata')},
            'protected_m02': {'id': module.PROTECTED_JOB, 'status': 'failed', 'stage': 'extract_specs', 'attempt': 1,
                              'row_version': 3, 'resource_id': 'a0000000-0000-4000-8000-000000000001',
                              'manual_note_retained': True, 'spec_sha256': 'b' * 64}}


def readback(origin=None):
    origin = origin or module.OLD
    return {'expected_project': module.TARGET, 'configuration': {'application_origin': origin, 'enabled': True,
            'renderer_version': 'synthetic-renderer-v1', 'max_manifest_bytes': 1048576, 'max_pdf_bytes': 67108864, 'max_pages': 100},
            'pilot_origin_configured': origin == module.HOST, 'captured_pilot_origin_versions': 0,
            'captured_loopback_origin_versions': 2, 'protected_metadata': metadata()}


def preflight(origin=None):
    return {'database': 'postgres', 'operator': 'postgres', 'history': list(module.VERSIONS), 'configuration_count': 1,
            'application_origin': origin or module.OLD, 'active_presentation_jobs': 0, 'unexpected_config_triggers': 0}


def update():
    return {'expected_project': module.TARGET, 'old_origin': module.OLD, 'new_origin': module.HOST,
            'configuration_other_columns_preserved': True, 'snapshots_slides_pins_ready_metadata_and_m02_preserved': True,
            'protected_metadata': metadata(), 'scope': module.UPDATE_SCOPE}


class FakeIO:
    def __init__(self, unknown=False, applied=True, collision=False, changed=False, active_after_claim=False):
        self.unknown, self.applied, self.collision, self.changed = unknown, applied, collision, changed
        self.active_after_claim = active_after_claim
        self.calls, self.dispatched, self.claims, self.preflights = [], 0, [], 0

    def preflight(self):
        self.calls.append('preflight'); self.preflights += 1
        value = preflight()
        if self.active_after_claim and self.preflights == 2:
            value['active_presentation_jobs'] = 1
        return value

    def readback(self):
        self.calls.append('readback')
        value = readback(module.HOST if self.dispatched and self.applied else module.OLD)
        if self.changed and self.dispatched:
            value['protected_metadata']['versions']['sha256'] = 'c' * 64
        return value

    def claim(self, value):
        self.calls.append('claim')
        if self.collision:
            raise ValueError('SYNTHETIC_CLAIM_EXISTS')
        self.claims.append(copy.deepcopy(value))

    def verify_sources(self):
        self.calls.append('verify')

    def dispatch(self):
        self.calls.append('dispatch'); self.dispatched += 1
        if self.unknown:
            raise TimeoutError('SYNTHETIC_PRIVATE_DIAGNOSTIC')
        return update()


class FutureOriginTests(unittest.TestCase):
    def test_exact_history_and_quiescence_refuse_same_count_substitution_and_active_job(self):
        module.validate_preflight(preflight())
        for field, value in [('database', 'other'), ('operator', 'other'), ('configuration_count', 2),
                             ('active_presentation_jobs', 1), ('unexpected_config_triggers', 1), ('application_origin', 'https://other.invalid')]:
            invalid = preflight(); invalid[field] = value
            with self.assertRaises(ValueError): module.validate_preflight(invalid)
        invalid = preflight(); invalid['history'][0] = '20261028000000'
        with self.assertRaises(ValueError): module.validate_preflight(invalid)

    def test_ambient_target_overrides_denied_but_existing_management_auth_not_read_or_changed(self):
        module.validate_environment({'SUPABASE_ACCESS_TOKEN': 'SYNTHETIC_EXISTING_AUTH'})
        for key in module.FORBIDDEN_ENV:
            with self.assertRaises(ValueError): module.validate_environment({key: 'SYNTHETIC_OVERRIDE'})

    def test_readback_is_closed_and_protects_manual_note_types_hashes_and_canonical_uuid(self):
        module.validate_readback(readback())
        for mutate in [lambda value: value.update(extra='SYNTHETIC_PRIVATE'),
                       lambda value: value['protected_metadata']['versions'].update(count=True),
                       lambda value: value['protected_metadata']['pins'].update(sha256='bad'),
                       lambda value: value['protected_metadata']['protected_m02'].update(manual_note_retained=False),
                       lambda value: value['protected_metadata']['protected_m02'].update(resource_id='bad'),
                       lambda value: value.update(pilot_origin_configured=True)]:
            invalid = readback(); mutate(invalid)
            with self.assertRaises(ValueError): module.validate_readback(invalid)

    def test_apply_claim_precedes_one_dispatch_and_independent_reads_preserve_frozen_data(self):
        io = FakeIO(); result = module.apply_once(io)
        self.assertEqual(io.dispatched, 1); self.assertEqual(len(io.claims), 1)
        self.assertLess(io.calls.index('claim'), io.calls.index('dispatch'))
        self.assertEqual(io.calls.count('readback'), 3)
        self.assertEqual(result['result'], 'passed'); self.assertTrue(result['independent_readback_equal'])
        self.assertFalse(result['automatic_dispatch_retry'])

    def test_unknown_commit_can_be_proved_by_two_reads_without_replaying_update(self):
        io = FakeIO(unknown=True); result = module.apply_once(io)
        self.assertEqual(io.dispatched, 1); self.assertEqual(result['result'], 'passed')
        self.assertEqual(result['dispatch_outcome'], 'unconfirmed')
        self.assertTrue(result['application_verified_by_readback'])
        self.assertNotIn('SYNTHETIC_PRIVATE', str(result))

    def test_unknown_not_applied_and_changed_protected_state_remain_unconfirmed(self):
        for kwargs in [{'unknown': True, 'applied': False}, {'changed': True}]:
            io = FakeIO(**kwargs); result = module.apply_once(io)
            self.assertEqual(result['result'], 'unconfirmed'); self.assertEqual(io.dispatched, 1)

    def test_claim_collision_and_fresh_active_job_never_dispatch(self):
        for kwargs in [{'collision': True}, {'active_after_claim': True}]:
            io = FakeIO(**kwargs)
            with self.assertRaises(ValueError): module.apply_once(io)
            self.assertEqual(io.dispatched, 0)

    def test_already_hosted_origin_is_readback_only_not_another_apply(self):
        io = FakeIO(); io.preflight = lambda: preflight(module.HOST)
        with self.assertRaises(ValueError): module.apply_once(io)
        self.assertEqual(io.dispatched, 0); self.assertFalse(io.claims)

    def test_final_read_mismatch_and_malformed_success_never_receive_pass_credit(self):
        io = FakeIO(); original = io.readback; reads = []
        def read():
            value = original(); reads.append(1)
            if len(reads) == 3: value['configuration']['max_pages'] += 1
            return value
        io.readback = read
        result = module.apply_once(io); self.assertEqual(result['result'], 'unconfirmed')
        io = FakeIO(); io.dispatch = lambda: {'scope': 'SYNTHETIC_PRIVATE'}
        result = module.apply_once(io); self.assertEqual(result['result'], 'unconfirmed')

    def test_command_has_fixed_project_link_pinned_cli_and_file_no_database_or_secret_arguments(self):
        args = module.query_command('readback')
        self.assertEqual(args[:6], ['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked'])
        self.assertEqual(args[args.index('--project-ref') + 1], module.TARGET)
        self.assertNotIn('--db-url', args)
        with self.assertRaises(ValueError): module.query_command('arbitrary')

    def test_standalone_readback_without_original_claim_baseline_is_observation_only(self):
        current = readback(module.HOST)
        result = module.readback_result(None, current, copy.deepcopy(current))
        self.assertEqual(result['result'], 'unconfirmed')
        self.assertTrue(result['origin_configured'])
        self.assertFalse(result['application_verified_by_readback'])
        self.assertFalse(result['original_baseline_available'])
        verified = module.readback_result(readback(), current, copy.deepcopy(current))
        self.assertEqual(verified['result'], 'passed')
        self.assertTrue(verified['application_verified_by_readback'])


if __name__ == '__main__':
    unittest.main()
