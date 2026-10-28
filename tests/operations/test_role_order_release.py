"""Offline role-order release tests. Transport and inspection are injected.

These tests neither execute SQL nor call a real release CLI. Catalog collision
tests reuse historical metadata as input, not as fresh hosted acceptance.
"""
import contextlib
import copy
import datetime
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
import release_role_order as release


PRIVATE_DIAGNOSTIC = 'synthetic-private-release-provider@example.invalid'


class RoleOrderReleaseTests(unittest.TestCase):
    def setUp(self):
        for name in ('run', 'Popen'):
            guard = mock.patch.object(release.subprocess, name,
                                     side_effect=AssertionError('Real CLI is prohibited in offline tests.'))
            guard.start()
            self.addCleanup(guard.stop)

    def exercise(self, *, action='apply', before_mode='pending', lost_response=False,
                 readback_error=False, invalid_readback=False, drift=None,
                 stale_preview=False, succeeds=False):
        inputs = {'migration_hashes': {'synthetic.sql': 'a' * 64},
                  'release_helper_sha256': 'b' * 64, 'readback_sha256': 'c' * 64}
        existing_counts = {'specs': 1, 'roles': 2, 'slots': 2, 'workspace_coverage': 1,
                    'archived_workspace_coverage': 0, 'pristine_specs': 1}
        before = {'base': {'counts': {'workspaces': 1, 'media': 1},
                           'queue_counts': {'jobs': 0, 'outbox': 0, 'events': 0}},
                  'manual': {'workspace_state_sha256': 'a' * 64, 'archived_workspaces': 0,
                             'counts': copy.deepcopy(existing_counts)},
                  'role_order': {'data_sha256': {key: 'f' * 64 for key in ('specs', 'roles', 'slots', 'preferences')}}}
        after = copy.deepcopy(before)
        after_mode = 'pending' if action == 'dry-run' else ('applied' if action == 'apply' else before_mode)
        after['manual']['counts'] = copy.deepcopy(existing_counts)
        if drift == 'counts':
            after['base']['counts']['media'] = 2
        elif drift == 'workspace':
            after['manual']['workspace_state_sha256'] = 'd' * 64
        elif drift in ('source', 'roles', 'slots', 'preferences'):
            after['role_order']['data_sha256']['specs' if drift == 'source' else drift] = '9' * 64
        inspections = 0
        attempts = []
        output = io.StringIO()
        with tempfile.TemporaryDirectory(prefix='eps-role-order-release-offline-') as directory:
            evidence = Path(directory)
            prior = {'result': 'passed', 'inputs': inputs, 'target': release.TARGET,
                     'action': 'dry-run', 'pending_migrations': release.PENDING,
                     'readback': copy.deepcopy(before),
                     'finished_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
            if stale_preview:
                prior['readback']['manual']['workspace_state_sha256'] = 'e' * 64
            (evidence / 'dry-run.json').write_text(json.dumps(prior), encoding='utf-8')

            def inspect():
                nonlocal inspections
                inspections += 1
                if inspections == 1:
                    return before_mode, copy.deepcopy(before)
                if readback_error:
                    raise ConnectionError(PRIVATE_DIAGNOSTIC)
                if invalid_readback:
                    error = release.Blocked('Observed metadata failed its exact catalog contract.')
                    error.snapshot = copy.deepcopy(after)
                    raise error
                return after_mode, copy.deepcopy(after)

            def dispatch(command):
                expected = ['db', 'push', '--linked', '--project-ref', release.TARGET,
                            '--skip-vault', '--yes', '--output-format', 'json']
                if action == 'dry-run':
                    expected.append('--dry-run')
                self.assertEqual(command, expected)
                files = list(evidence.glob(f'*-{action}-attempt.json'))
                self.assertEqual(len(files), 1)
                attempt = json.loads(files[0].read_text(encoding='utf-8'))
                attempts.append(attempt)
                self.assertEqual(attempt['application_status'],
                                 'unknown_until_readback' if action == 'apply' else 'not_attempted')
                self.assertEqual(attempt['result'], 'failed')
                self.assertFalse(attempt['application_verified_by_readback'])
                self.assertNotIn('finished_at', attempt)
                if lost_response:
                    raise subprocess.TimeoutExpired(['synthetic-db-push'], 90,
                                                    output=PRIVATE_DIAGNOSTIC, stderr=PRIVATE_DIAGNOSTIC)
                return SimpleNamespace(returncode=0, stdout='\n'.join(release.PENDING),
                                       stderr=PRIVATE_DIAGNOSTIC)

            with mock.patch.object(release, 'prerequisites', return_value=inputs), \
                 mock.patch.object(release, 'inspect', side_effect=inspect), \
                 mock.patch.object(release, 'call', side_effect=dispatch) as transport, \
                 mock.patch.object(release, 'EVIDENCE', evidence), \
                 mock.patch.object(sys, 'argv', ['release_role_order.py', action]), \
                 contextlib.redirect_stdout(output):
                if succeeds:
                    release.main()
                else:
                    with self.assertRaises(ConnectionError if readback_error else release.Blocked):
                        release.main()
            files = list(evidence.glob(f'*-{action}.json'))
            self.assertEqual(len(files), 1)
            receipt = json.loads(files[0].read_text(encoding='utf-8'))
            dispatched = action != 'readback' and before_mode == 'pending' and not stale_preview
            self.assertEqual(transport.call_count, 1 if dispatched else 0)
            self.assertEqual(len(attempts), 1 if dispatched else 0)
            self.assertEqual(inspections, 2 if dispatched or action == 'readback' else 1)
            self.assertEqual(receipt['result'], 'passed' if succeeds else 'failed')
            for field in ('raw_diagnostics_recorded', 'runtime_flag_changed', 'identity_provisioned',
                          'provider_or_service_provisioned', 'seeds', 'vault_sync', 'pipeline_acceptance'):
                self.assertFalse(receipt[field])
            if action != 'dry-run' or not succeeds:
                self.assertEqual(json.loads((evidence / 'dry-run.json').read_text(encoding='utf-8')), prior)
            self.assertNotIn(PRIVATE_DIAGNOSTIC, output.getvalue())
            for file in evidence.iterdir():
                self.assertNotIn(PRIVATE_DIAGNOSTIC, file.read_text(encoding='utf-8'))
        return receipt, before, after

    def test_lost_dispatch_response_retains_verified_apply_and_never_retries(self):
        receipt, _, after = self.exercise(lost_response=True)
        self.assertTrue(receipt['dispatch_response_unavailable'])
        self.assertTrue(receipt['application_verified_by_readback'])
        self.assertEqual(receipt['application_status'], 'verified_applied')
        self.assertEqual(receipt['readback'], after)
        self.assertIn('unconfirmed', receipt['reason'])

    def test_lost_readback_after_dispatch_keeps_unknown_outcome_and_attempt(self):
        receipt, _, _ = self.exercise(readback_error=True)
        self.assertEqual(receipt['application_status'], 'unknown_until_readback')
        self.assertFalse(receipt['application_verified_by_readback'])
        self.assertNotIn('readback', receipt)
        self.assertIn('attempt_receipt', receipt)

    def test_invalid_postapply_catalog_is_retained_without_claiming_verified_apply(self):
        receipt, _, after = self.exercise(invalid_readback=True)
        self.assertEqual(receipt['unverified_readback'], after)
        self.assertEqual(receipt['application_status'], 'unknown_until_readback')
        self.assertFalse(receipt['application_verified_by_readback'])

    def test_count_and_workspace_version_drift_keep_confirmed_history_for_reconciliation(self):
        for drift in ('counts', 'workspace'):
            with self.subTest(drift=drift):
                receipt, before, after = self.exercise(drift=drift)
                self.assertEqual(receipt['application_status'], 'verified_applied')
                self.assertTrue(receipt['application_verified_by_readback'])
                self.assertEqual(receipt['before'], before)
                self.assertEqual(receipt['readback'], after)

    def test_source_digest_drift_retains_verified_history_and_both_snapshots(self):
        for field in ('source', 'roles', 'slots', 'preferences'):
            with self.subTest(field=field):
                receipt, before, after = self.exercise(drift=field)
                self.assertTrue(receipt['application_verified_by_readback'])
                self.assertEqual(receipt['before'], before)
                self.assertEqual(receipt['readback'], after)
                self.assertNotEqual(before['role_order']['data_sha256'], after['role_order']['data_sha256'])
                self.assertIn('Source/role order/slots/preferences changed', receipt['reason'])

    def test_changed_preflight_refuses_dispatch_even_with_a_successful_dry_run(self):
        receipt, _, _ = self.exercise(stale_preview=True)
        self.assertNotIn('attempt_receipt', receipt)
        self.assertEqual(receipt['application_status'], 'not_attempted')

    def test_existing_applied_history_prevents_a_second_apply(self):
        receipt, _, _ = self.exercise(before_mode='applied')
        self.assertEqual(receipt['application_status'], 'verified_existing')
        self.assertTrue(receipt['application_verified_by_readback'])
        self.assertNotIn('attempt_receipt', receipt)

    def test_existing_verified_state_is_retained_when_later_readback_fails(self):
        receipt, before, _ = self.exercise(action='readback', before_mode='applied', readback_error=True)
        self.assertEqual(receipt['before'], before)
        self.assertEqual(receipt['application_status'], 'verified_existing')
        self.assertTrue(receipt['application_verified_by_readback'])
        self.assertNotIn('attempt_receipt', receipt)

    def test_successful_apply_preserves_existing_nonempty_business_snapshots(self):
        receipt, before, after = self.exercise(succeeds=True)
        self.assertEqual(receipt['before'], before)
        self.assertEqual(receipt['readback'], after)
        self.assertTrue(receipt['application_verified_by_readback'])

    def test_pending_readback_success_does_not_claim_migration_applied(self):
        receipt, _, _ = self.exercise(action='readback', succeeds=True)
        self.assertEqual(receipt['application_status'], 'verified_pending')
        self.assertFalse(receipt['application_verified_by_readback'])

    def catalog(self, *, applied=False):
        # Actual historical8 metadata is a file-only fixture, never a fresh9 or
        # hosted assertion. New digest values/9 additions are explicitly synthetic.
        path = release.PROOFS['prior_cloud'][0]
        state = copy.deepcopy(release.read_json(path)['readback'])
        state['role_order'] = {'functions': [], 'policies': [],
            'data_sha256': {key: 'a' * 64 for key in ('specs', 'roles', 'slots', 'preferences')},
            'sort_order_acl': [{key: value for key, value in row.items() if key not in ('table', 'column')}
                for row in state['manual']['column_acls'] if row['table'] == 'eps.roles' and row['column'] == 'sort_order']}
        if applied:
            state['base']['versions'] = release.VERSIONS
            state['base']['functions'].append({'name': 'public.eps_reorder_workspace'})
            state['manual']['functions'].append({'name': 'eps.specs_order_workspace_dto'})
            state['manual']['policies'].extend({'name': name} for name in release.POLICIES)
            next(row for row in state['manual']['column_acls'] if
                 (row['table'], row['column'], row['role']) == ('eps.roles', 'sort_order', 'eps_specs_owner'))['update'] = True
            next(row for row in state['role_order']['sort_order_acl'] if row['role'] == 'eps_specs_owner')['update'] = True
        return state

    def test_known_delta_projection_preserves_the_frozen_eight_version_contract(self):
        before = self.catalog()
        self.assertEqual(release.validate_state(before), 'pending')
        after = self.catalog(applied=True)
        projected = release.old_projection(after, True)
        self.assertEqual(release.prior.validate_state(projected), 'applied')
        source = next(row for row in after['manual']['column_acls'] if
                      (row['table'], row['column'], row['role']) == ('eps.roles', 'sort_order', 'eps_specs_owner'))
        self.assertTrue(source['update'])  # Projection must not mutate its input.
        masked = next(row for row in projected['manual']['column_acls'] if
                      (row['table'], row['column'], row['role']) == ('eps.roles', 'sort_order', 'eps_specs_owner'))
        self.assertFalse(masked['update'])

    def test_before_release_known_routine_and_policy_collisions_are_rejected(self):
        for section, name in (('base', 'public.eps_reorder_workspace'), ('manual', 'eps.specs_order_workspace_dto')):
            with self.subTest(name=name):
                state = self.catalog()
                state[section]['functions'].append({'name': name})
                with self.assertRaisesRegex(release.Blocked, 'exactly the known9 additions'):
                    release.validate_state(state)
        state = self.catalog()
        state['manual']['policies'].append({'name': 'specs_order_audit'})
        with self.assertRaisesRegex(release.Blocked, 'exactly the known9 additions'):
            release.validate_state(state)

    def test_after_release_wrapper_and_private_helper_overloads_cannot_be_masked(self):
        for section, name in (('base', 'public.eps_reorder_workspace'), ('manual', 'eps.specs_order_workspace_dto')):
            with self.subTest(name=name):
                state = self.catalog(applied=True)
                state[section]['functions'].append({'name': name, 'signature': name + '(text)'})
                with self.assertRaisesRegex(release.Blocked, 'exactly the known9 additions'):
                    release.old_projection(state, True)

    def test_only_the_explicit_owner_sort_order_update_bit_is_masked(self):
        for table, column, role in (('eps.specs', 'source_text', 'eps_specs_owner'),
                                    ('eps.roles', 'sort_order', 'authenticated')):
            with self.subTest(table=table, column=column, role=role):
                state = self.catalog(applied=True)
                next(row for row in state['manual']['column_acls'] if
                     (row['table'], row['column'], row['role']) == (table, column, role))['update'] = True
                with self.assertRaises(release.Blocked):
                    release.prior.validate_state(release.old_projection(state, True))
        state = self.catalog(applied=True)
        next(row for row in state['manual']['column_acls'] if
             (row['table'], row['column'], row['role']) == ('eps.roles', 'sort_order', 'eps_specs_owner'))['update'] = False
        with self.assertRaisesRegex(release.Blocked, 'explicit role sort-order UPDATE delta'):
            release.old_projection(state, True)
        state = self.catalog(applied=True)
        next(row for row in state['role_order']['sort_order_acl'] if row['role'] == 'eps_specs_owner')['update'] = False
        with self.assertRaisesRegex(release.Blocked, 'Role sort-order column authority differs'):
            release.validate_state(state)

    def test_unrelated_policy_or_old_source_changes_survive_projection_and_fail(self):
        state = self.catalog(applied=True)
        state['manual']['policies'].append({'name': 'specs_order_unexpected'})
        with self.assertRaises(release.Blocked):
            release.prior.validate_state(release.old_projection(state, True))
        state = self.catalog(applied=True)
        state['manual']['functions'][0]['source_sha256'] = '0' * 64
        with self.assertRaises(release.Blocked):
            release.prior.validate_state(release.old_projection(state, True))

    def test_missing_catalog_seal_blocks_before_any_transport(self):
        with mock.patch.object(release, 'READBACK_HASH', None):
            with self.assertRaisesRegex(release.Blocked, 'not configured'):
                release.prerequisites()

    def test_fixed_inspection_hashes_all_three_source_sections_even_when_catalog_is_invalid(self):
        for invalid in (False, True):
            with self.subTest(invalid=invalid):
                state = {section: {'functions': [{'name': section + '.synthetic', 'source': PRIVATE_DIAGNOSTIC + '\r\n'}]}
                         for section in ('base', 'manual', 'role_order')}
                response = SimpleNamespace(returncode=0, stdout=json.dumps({'rows': [{'role_order_release': state}]}))
                rejected = release.Blocked('Synthetic catalog contract rejection.')
                with mock.patch.object(release, 'call', return_value=response) as transport, \
                     mock.patch.object(release, 'validate_state', side_effect=rejected if invalid else None, return_value='applied'):
                    if invalid:
                        with self.assertRaises(release.Blocked):
                            release.inspect()
                        sanitized = rejected.snapshot
                    else:
                        mode, sanitized = release.inspect()
                        self.assertEqual(mode, 'applied')
                transport.assert_called_once_with(['db', 'query', '--linked', '--project-ref', release.TARGET,
                    '--file', str(release.ROOT / release.READBACK), '--output-format', 'json'])
                self.assertNotIn(PRIVATE_DIAGNOSTIC, json.dumps(sanitized))
                expected = hashlib.sha256((PRIVATE_DIAGNOSTIC + '\n').encode()).hexdigest()
                for section in ('base', 'manual', 'role_order'):
                    self.assertNotIn('source', sanitized[section]['functions'][0])
                    self.assertEqual(sanitized[section]['functions'][0]['source_sha256'], expected)


if __name__ == '__main__':
    unittest.main()
