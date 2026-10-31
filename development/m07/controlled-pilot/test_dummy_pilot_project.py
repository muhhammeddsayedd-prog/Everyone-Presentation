"""Pure synthetic state-machine tests; no CLI, credentials, DB or provider."""
import copy
import importlib.util
from pathlib import Path
import subprocess
import unittest

spec = importlib.util.spec_from_file_location('dummy_project', Path(__file__).with_name('dummy-pilot-project.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
CLIENT = 'a0000000-0000-4000-8000-000000000001'
TEMPLATE = 'a0000000-0000-4000-8000-000000000002'
PROJECT = 'a0000000-0000-4000-8000-000000000003'


def observation(created=False):
    return {'expected_project': module.TARGET, 'acting_user_id': module.ACTOR, 'database': 'postgres', 'operator': 'postgres',
            'history': list(module.VERSIONS), 'client_matches': 1, 'template_matches': 1, 'target_matches': int(created),
            'client': {'id': CLIENT, 'name': 'Dummy Client', 'active': True, 'row_version': 1},
            'template': {'id': TEMPLATE, 'client_id': CLIENT, 'name': 'Dummy Reuse Test', 'archived': False, 'row_version': 1},
            'template_membership': {'project_id': TEMPLATE, 'principal_id': module.ACTOR, 'active': True, 'can_write': True},
            'actor_eligible': True,
            'target': {'id': PROJECT, 'client_id': CLIENT, 'name': 'Dummy Pilot Test', 'archived': False, 'row_version': 1} if created else None,
            'target_memberships': [{'project_id': PROJECT, 'principal_id': module.ACTOR, 'active': True, 'can_write': True}] if created else [],
            'target_workspace_count': 0,
            'protected_metadata': {**{key: {'count': 2, 'sha256': 'a' * 64} for key in module.FINGERPRINT_KEYS},
                'protected_m02': {'id': module.PROTECTED_JOB, 'status': 'waiting_for_input', 'stage': 'extract_specs', 'attempt': 1,
                    'row_version': 3, 'resource_id': 'a0000000-0000-4000-8000-000000000009',
                    'manual_note_retained': True, 'spec_sha256': 'b' * 64}}}


class FakeIO:
    def __init__(self, unknown=False, applied=True, timeout=False, changed=False, collision=False, drift=False):
        self.unknown, self.applied, self.timeout = unknown, applied, timeout
        self.changed, self.collision, self.drift = changed, collision, drift
        self.dispatched, self.reads, self.claims, self.calls = 0, 0, [], []

    def readback(self):
        self.calls.append('read'); self.reads += 1
        value = observation(bool(self.dispatched and self.applied))
        if self.changed and self.dispatched or self.drift and self.claims and not self.dispatched:
            value['protected_metadata']['roles']['sha256'] = 'c' * 64
        return value

    def verify_sources(self):
        self.calls.append('verify')

    def claim(self, value):
        self.calls.append('claim')
        if self.collision:
            raise ValueError('SYNTHETIC_EXISTING_CLAIM')
        self.claims.append(copy.deepcopy(value))

    def dispatch(self, before):
        self.calls.append('dispatch'); self.dispatched += 1
        if self.timeout:
            raise module.CommandProcessUnconfirmed('SYNTHETIC_PRIVATE')
        if self.unknown:
            raise ValueError('SYNTHETIC_PRIVATE')
        return {'inserted_projects': 1, 'inserted_memberships': 1, 'protected_before_after_equal': True,
                'observation': observation(True)}


class DummyProjectTests(unittest.TestCase):
    def test_closed_typed_observation_keeps_unrelated_payloads_out(self):
        module.validate_observation(observation(), require_absent=True)
        mutations = [lambda v: v.update(access_token='SYNTHETIC_PRIVATE'), lambda v: v.update(target_matches=True),
            lambda v: v['client'].update(name='OtherClient'), lambda v: v['template_membership'].update(can_write=False),
            lambda v: v['protected_metadata']['roles'].update(count=True), lambda v: v.update(acting_user_id=CLIENT),
            lambda v: v['protected_metadata']['protected_m02'].update(manual_note_retained=False)]
        for mutate in mutations:
            value = observation(); mutate(value)
            with self.assertRaises(ValueError): module.validate_observation(value)

    def test_exact_history_and_existing_names_are_not_apply_candidates(self):
        value = observation(); value['history'][0] = '20261028000000'
        with self.assertRaises(ValueError): module.validate_observation(value)
        with self.assertRaises(ValueError): module.validate_observation(observation(True), require_absent=True)
        for key in ('client_matches', 'template_matches'):
            value = observation(); value[key] = 2
            with self.assertRaises(ValueError): module.validate_observation(value)

    def test_one_project_and_matching_owner_membership_after_claim(self):
        io = FakeIO(); result = module.apply_once(io)
        self.assertEqual(result['result'], 'passed'); self.assertEqual(io.dispatched, 1)
        self.assertEqual(len(io.claims), 1); self.assertLess(io.calls.index('claim'), io.calls.index('dispatch'))
        self.assertEqual(io.reads, 4); self.assertTrue(result['protected_before_after_equal'])
        self.assertFalse(result['automatic_dispatch_retry'])

    def test_unknown_commit_uses_two_reads_without_repeating_creation(self):
        io = FakeIO(unknown=True); result = module.apply_once(io)
        self.assertEqual(result['result'], 'passed'); self.assertEqual(io.dispatched, 1)
        self.assertEqual(result['dispatch_outcome'], 'unconfirmed')
        self.assertNotIn('SYNTHETIC_PRIVATE', str(result))

    def test_parent_timeout_cannot_be_credited_even_if_rows_are_observed(self):
        io = FakeIO(timeout=True); result = module.apply_once(io)
        self.assertEqual(result['result'], 'unconfirmed'); self.assertTrue(result['command_process_cleanup_unconfirmed'])
        self.assertEqual(io.dispatched, 1); self.assertEqual(io.reads, 4)

    def test_not_applied_or_old_casting_state_changed_is_not_verified(self):
        for options in ({'unknown': True, 'applied': False}, {'changed': True}):
            io = FakeIO(**options); result = module.apply_once(io)
            self.assertEqual(result['result'], 'unconfirmed'); self.assertEqual(io.dispatched, 1)

    def test_existing_claim_or_post_claim_drift_never_dispatches(self):
        for options in ({'collision': True}, {'drift': True}):
            io = FakeIO(**options)
            with self.assertRaises(ValueError): module.apply_once(io)
            self.assertEqual(io.dispatched, 0)

    def test_wrong_membership_extra_workspace_or_target_replacement_is_not_creation_proof(self):
        for mutate in (lambda v: v['target_memberships'][0].update(principal_id=CLIENT),
                       lambda v: v.update(target_workspace_count=1), lambda v: v['target'].update(client_id=TEMPLATE),
                       lambda v: v['target'].update(row_version=2)):
            value = observation(True); mutate(value)
            self.assertFalse(module.creation_preserved(observation(), value))

    def test_standalone_observation_without_claim_has_no_preservation_credit(self):
        value = observation(True); result = module.readback_result(None, value, copy.deepcopy(value))
        self.assertEqual(result['result'], 'unconfirmed'); self.assertTrue(result['project_observed'])
        self.assertFalse(result['creation_verified']); self.assertFalse(result['original_baseline_available'])

    def test_environment_gate_and_command_pin_do_not_read_or_change_management_login(self):
        module.validate_environment({'SUPABASE_ACCESS_TOKEN': 'SYNTHETIC_EXISTING_AUTH', 'UNRELATED': 'allowed'})
        for key in module.FORBIDDEN_ENV:
            with self.assertRaises(ValueError): module.validate_environment({key.lower(): 'SYNTHETIC_OVERRIDE'})
        args = module.query_command('readback')
        self.assertEqual(args[:6], ['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked'])
        self.assertEqual(args[args.index('--project-ref') + 1], module.TARGET)
        self.assertNotIn('--db-url', args)

    def test_sql_rendering_accepts_only_closed_absent_baseline(self):
        sql = "declare expected jsonb := '__EXPECTED_BASELINE__'::jsonb;"
        rendered = module.render_create(sql, observation())
        self.assertNotIn('__EXPECTED_BASELINE__', rendered)
        self.assertIn('Dummy Client', rendered)
        with self.assertRaises(ValueError): module.render_create(sql, observation(True))
        with self.assertRaises(ValueError): module.render_create(sql + sql, observation())

    def test_raw_query_timeout_is_explicit_process_uncertainty(self):
        def timeout(*args, **kwargs):
            raise subprocess.TimeoutExpired('synthetic-cli', 90, output='SYNTHETIC_PRIVATE')
        with self.assertRaises(module.CommandProcessUnconfirmed): module.run_cli(['synthetic'], run=timeout)

    def test_termination_proof_requires_an_actual_parent_return_even_if_output_is_malformed(self):
        completed = []
        def returned(*args, **kwargs):
            return subprocess.CompletedProcess('synthetic-cli',0,stdout='not-json',stderr='')
        with self.assertRaises(ValueError):
            module.run_cli(['synthetic'],run=returned,on_returned=lambda: completed.append(True))
        self.assertEqual(completed,[True])
        completed.clear()
        def timeout(*args, **kwargs):
            raise subprocess.TimeoutExpired('synthetic-cli',90)
        with self.assertRaises(module.CommandProcessUnconfirmed):
            module.run_cli(['synthetic'],run=timeout,on_returned=lambda: completed.append(True))
        self.assertEqual(completed,[])

    def test_actual_cli_transport_envelope_discards_boundary_and_warning_without_domain_authority(self):
        value = observation()
        envelope = {'boundary':{'SYNTHETIC_PRIVATE':'ignored'},'warning':'SYNTHETIC_PRIVATE',
                    'rows':[{'dummy_project_readback':value}]}
        row = module.parse_query_result(envelope,'readback')
        self.assertEqual(module.validate_observation(row),value)
        self.assertNotIn('SYNTHETIC_PRIVATE',str(row))
        for bad in ([], {'rows':[]}, {'rows':envelope['rows']*2}, {'rows':[{'wrong_key':value}]},
                    {'rows':[{'dummy_project_readback':value,'private':'SYNTHETIC_PRIVATE'}]}):
            with self.assertRaises(ValueError): module.parse_query_result(bad,'readback')
        invalid = copy.deepcopy(value); invalid['client']['active'] = 1
        with self.assertRaises(ValueError):
            module.validate_observation(module.parse_query_result({'boundary':True,'warning':None,
                'rows':[{'dummy_project_readback':invalid}]},'readback'))


if __name__ == '__main__':
    unittest.main()
