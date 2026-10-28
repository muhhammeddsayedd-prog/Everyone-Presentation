"""Offline release recovery regressions; all transport/inspection is injected."""
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
import release_processing_foundation as release


PRIVATE_DIAGNOSTIC = 'synthetic-private-release-provider-text@example.invalid'


class ProcessingReleaseRecoveryTests(unittest.TestCase):
    def setUp(self):
        # An accidentally unmocked helper must fail before invoking any real CLI.
        for method in ('run', 'Popen'):
            guard = mock.patch.object(release.subprocess, method,
                                      side_effect=AssertionError('Real CLI transport is prohibited in offline tests.'))
            guard.start()
            self.addCleanup(guard.stop)

    def run_apply(self, *, before_mode='pending', after_mode='applied',
                  lost_response=False, failed_readback=False, changed_counts=False,
                  exit_code=0):
        inputs = {'migration_hashes': {'synthetic_migration.sql': 'a' * 64},
                  'release_helper_sha256': 'b' * 64, 'readback_sha256': 'c' * 64}
        before = {'versions': ['synthetic-before'], 'counts': {'projects': 1, 'media': 1},
                  'queue_counts': {'jobs': 0, 'outbox': 0, 'events': 0} if before_mode == 'applied' else None}
        after = {'versions': ['synthetic-before', 'synthetic-after'],
                 'counts': {'projects': 2 if changed_counts else 1, 'media': 1},
                 'queue_counts': {'jobs': 0, 'outbox': 0, 'events': 0}}
        inspections = 0
        committed_or_partial = False
        predispatch = []
        output = io.StringIO()
        with tempfile.TemporaryDirectory(prefix='eps-processing-release-test-') as directory:
            evidence = Path(directory)
            prior = {'result': 'passed', 'inputs': inputs, 'target': release.TARGET,
                     'action': 'dry-run', 'pending_migrations': release.PENDING,
                     'readback': before,
                     'finished_at': datetime.datetime.now(datetime.timezone.utc).isoformat()}
            (evidence / 'dry-run.json').write_text(json.dumps(prior), encoding='utf-8')

            def inspect():
                nonlocal inspections
                inspections += 1
                if inspections == 1:
                    return before_mode, copy.deepcopy(before)
                self.assertTrue(committed_or_partial)
                if failed_readback:
                    raise ConnectionError(PRIVATE_DIAGNOSTIC)
                return after_mode, copy.deepcopy(after)

            def dispatch(command):
                nonlocal committed_or_partial
                self.assertEqual(command, ['db', 'push', '--linked', '--project-ref', release.TARGET,
                                           '--skip-vault', '--yes', '--output-format', 'json'])
                attempts = [json.loads(file.read_text(encoding='utf-8'))
                            for file in evidence.glob('*-apply-attempt.json')]
                self.assertEqual(len(attempts), 1)
                attempt = attempts[0]
                predispatch.append(attempt)
                self.assertEqual(attempt['application_status'], 'unknown_until_readback')
                self.assertFalse(attempt['application_verified_by_readback'])
                self.assertEqual(attempt['result'], 'failed')
                self.assertEqual(attempt['before'], before)
                self.assertNotIn('finished_at', attempt)
                committed_or_partial = True
                if lost_response:
                    raise subprocess.TimeoutExpired(['synthetic-db-push'], 90,
                                                    output=PRIVATE_DIAGNOSTIC, stderr=PRIVATE_DIAGNOSTIC)
                return SimpleNamespace(returncode=exit_code,
                                       stdout='\n'.join(release.PENDING) + '\n' + PRIVATE_DIAGNOSTIC,
                                       stderr=PRIVATE_DIAGNOSTIC)

            expected_error = ConnectionError if failed_readback else release.Blocked
            with mock.patch.object(release, 'prerequisites', return_value=inputs), \
                 mock.patch.object(release, 'inspect', side_effect=inspect), \
                 mock.patch.object(release, 'call', side_effect=dispatch) as transport, \
                 mock.patch.object(release, 'EVIDENCE', evidence), \
                 mock.patch.object(sys, 'argv', ['release_processing_foundation.py', 'apply']), \
                 contextlib.redirect_stdout(output), self.assertRaises(expected_error):
                release.main()

            files = list(evidence.glob('*-apply.json'))
            self.assertEqual(len(files), 1)
            receipt = json.loads(files[0].read_text(encoding='utf-8'))
            attempted = before_mode == 'pending'
            self.assertEqual(transport.call_count, 1 if attempted else 0)
            self.assertEqual(inspections, 2 if attempted else 1)
            self.assertEqual(len(predispatch), 1 if attempted else 0)
            self.assertEqual(len(list(evidence.glob('*-apply-attempt.json'))), 1 if attempted else 0)
            self.assertEqual(receipt['result'], 'failed')
            self.assertFalse(receipt['raw_diagnostics_recorded'])
            self.assertFalse(receipt['runtime_flag_changed'])
            self.assertFalse(receipt['identity_provisioned'])
            self.assertFalse(receipt['provider_or_service_provisioned'])
            self.assertFalse(receipt['seeds'])
            self.assertFalse(receipt['vault_sync'])
            self.assertFalse(receipt['pipeline_acceptance'])
            self.assertEqual(json.loads((evidence / 'dry-run.json').read_text(encoding='utf-8')), prior)
            self.assertNotIn(PRIVATE_DIAGNOSTIC, output.getvalue())
            for file in evidence.iterdir():
                self.assertNotIn(PRIVATE_DIAGNOSTIC, file.read_text(encoding='utf-8'))
        return receipt, before, after

    def test_lost_push_response_keeps_verified_applied_readback_without_retrying(self):
        receipt, _, after = self.run_apply(lost_response=True)
        self.assertTrue(receipt['dispatch_response_unavailable'])
        self.assertNotIn('exit_code', receipt)
        self.assertTrue(receipt['application_verified_by_readback'])
        self.assertEqual(receipt['application_status'], 'verified_applied')
        self.assertEqual(receipt['readback'], after)
        self.assertIn('unconfirmed', receipt['reason'])

    def test_partial_apply_keeps_partial_history_and_refuses_to_claim_success(self):
        receipt, _, after = self.run_apply(after_mode='partial_scope_applied', exit_code=1)
        self.assertEqual(receipt['exit_code'], 1)
        self.assertEqual(receipt['application_status'], 'verified_partial')
        self.assertFalse(receipt['application_verified_by_readback'])
        self.assertEqual(receipt['readback'], after)
        self.assertIn('partial', receipt['reason'])

    def test_lost_readback_after_push_preserves_unknown_outcome_and_attempt(self):
        receipt, before, _ = self.run_apply(failed_readback=True)
        self.assertEqual(receipt['exit_code'], 0)
        self.assertEqual(receipt['pending_migrations'], release.PENDING)
        self.assertEqual(receipt['application_status'], 'unknown_until_readback')
        self.assertFalse(receipt['application_verified_by_readback'])
        self.assertEqual(receipt['before'], before)
        self.assertNotIn('readback', receipt)

    def test_count_drift_preserves_confirmed_application_and_both_snapshots(self):
        receipt, before, after = self.run_apply(changed_counts=True)
        self.assertEqual(receipt['application_status'], 'verified_applied')
        self.assertTrue(receipt['application_verified_by_readback'])
        self.assertEqual(receipt['before']['counts'], before['counts'])
        self.assertEqual(receipt['readback']['counts'], after['counts'])
        self.assertIn('counts changed', receipt['reason'])

    def test_existing_partial_history_prevents_a_second_mutator(self):
        receipt, _, _ = self.run_apply(before_mode='partial_scope_applied')
        self.assertEqual(receipt['application_status'], 'verified_partial')
        self.assertFalse(receipt['application_verified_by_readback'])
        self.assertNotIn('attempt_receipt', receipt)
        self.assertNotIn('exit_code', receipt)

    def test_existing_applied_history_stays_verified_while_redundant_push_is_refused(self):
        receipt, _, _ = self.run_apply(before_mode='applied')
        self.assertEqual(receipt['application_status'], 'verified_existing')
        self.assertTrue(receipt['application_verified_by_readback'])
        self.assertNotIn('attempt_receipt', receipt)
        self.assertNotIn('exit_code', receipt)


if __name__ == '__main__':
    unittest.main()
