"""Offline manual-specs release tests. Transport and inspection are injected.

These tests neither execute SQL nor call a real release CLI. Catalog collision
tests reuse historical metadata as input, not as fresh hosted acceptance.
"""
import contextlib
import copy
import datetime
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
import release_manual_specs as release


PRIVATE_DIAGNOSTIC = 'synthetic-private-release-provider@example.invalid'


class ManualSpecsReleaseTests(unittest.TestCase):
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
        pristine = {'specs': 1, 'roles': 0, 'slots': 0, 'workspace_coverage': 1,
                    'archived_workspace_coverage': 0, 'pristine_specs': 1}
        before = {'base': {'counts': {'workspaces': 1, 'media': 1},
                           'queue_counts': {'jobs': 0, 'outbox': 0, 'events': 0}},
                  'manual': {'workspace_state_sha256': 'a' * 64, 'archived_workspaces': 0,
                             'counts': pristine if before_mode == 'applied' else None}}
        after = copy.deepcopy(before)
        after_mode = 'pending' if action == 'dry-run' else ('applied' if action == 'apply' else before_mode)
        after['manual']['counts'] = copy.deepcopy(pristine) if after_mode == 'applied' else None
        if drift == 'counts':
            after['base']['counts']['media'] = 2
        elif drift == 'workspace':
            after['manual']['workspace_state_sha256'] = 'd' * 64
        elif drift == 'backfill':
            after['manual']['counts']['roles'] = 1
        inspections = 0
        attempts = []
        output = io.StringIO()
        with tempfile.TemporaryDirectory(prefix='eps-manual-release-offline-') as directory:
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
                 mock.patch.object(sys, 'argv', ['release_manual_specs.py', action]), \
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

    def test_nonempty_backfill_is_preserved_and_reported_after_confirmed_application(self):
        receipt, _, after = self.exercise(drift='backfill')
        self.assertTrue(receipt['application_verified_by_readback'])
        self.assertEqual(receipt['readback'], after)
        self.assertEqual(after['manual']['counts']['roles'], 1)
        self.assertIn('backfill', receipt['reason'])

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

    def test_successful_apply_requires_pristine_backfill_and_retains_exact_snapshots(self):
        receipt, before, after = self.exercise(succeeds=True)
        self.assertEqual(receipt['before'], before)
        self.assertEqual(receipt['readback'], after)
        self.assertTrue(receipt['application_verified_by_readback'])

    def test_pending_readback_success_does_not_claim_migration_applied(self):
        receipt, _, _ = self.exercise(action='readback', succeeds=True)
        self.assertEqual(receipt['application_status'], 'verified_pending')
        self.assertFalse(receipt['application_verified_by_readback'])

    def test_nonordinary_relations_are_collisions_before_migration(self):
        metadata = release.read_json('tracking/evidence/cloud-processing-foundation/local-readback-contract.json')['state']
        manual = {key: [] for key in ('functions', 'relations', 'table_acls', 'column_acls', 'roles',
                                     'policies', 'triggers', 'support_acls', 'workspace_column_acls')}
        manual.update(counts=None, workspace_state_sha256='a' * 64, archived_workspaces=0)
        self.assertEqual(release.validate_state({'base': metadata, 'manual': manual}), 'pending')
        for kind in ('v', 'm', 'f', 'p', 'S', 'r'):
            with self.subTest(kind=kind):
                collision = copy.deepcopy(manual)
                collision['relations'] = [{'name': 'eps.specs', 'kind': kind, 'owner': 'postgres',
                                           'rls': False, 'forced_rls': False}]
                with self.assertRaisesRegex(release.Blocked, 'collision before release'):
                    release.validate_state({'base': metadata, 'manual': collision})

    def test_missing_catalog_seal_blocks_before_any_transport(self):
        with mock.patch.object(release, 'READBACK_HASH', None):
            with self.assertRaisesRegex(release.Blocked, 'not configured'):
                release.prerequisites()


if __name__ == '__main__':
    unittest.main()
