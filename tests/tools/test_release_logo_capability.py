"""Release coordinator evidence recovery with synthetic in-memory cloud responses."""
import contextlib
import copy
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
import release_logo_capability as release


PRIVATE_DIAGNOSTIC = 'synthetic-private-cli-output-must-not-be-recorded@example.invalid'


class CapabilityReleaseRecoveryTests(unittest.TestCase):
    def run_apply(self, *, lost_response=False, failed_readback=False, changed_counts=False):
        inputs = {'migration_hashes': {release.PENDING: 'a' * 64},
                  'local_proof': 'synthetic-local-proof.json', 'local_proof_sha256': 'b' * 64,
                  'readback_sha256': 'c' * 64}
        before = {'query_role': 'postgres', 'database': 'postgres', 'unrestricted_visibility': True,
                  'versions': ['synthetic-before'], 'counts': {'clients': 1, 'projects': 1, 'media': 0}}
        after = copy.deepcopy(before)
        after['versions'] = ['synthetic-before', 'synthetic-after']
        if changed_counts:
            after['counts']['projects'] = 2
        committed = False
        inspections = 0
        predispatch = []
        output = io.StringIO()
        with tempfile.TemporaryDirectory(prefix='eps-release-recovery-test-') as directory:
            evidence = Path(directory)
            prior = {'result': 'passed', 'inputs': inputs, 'pending_migrations': [release.PENDING]}
            (evidence / 'dry-run.json').write_text(json.dumps(prior), encoding='utf-8')

            def inspect():
                nonlocal inspections
                inspections += 1
                if inspections == 1:
                    return 'pending', copy.deepcopy(before)
                self.assertTrue(committed)
                if failed_readback:
                    raise ConnectionError(PRIVATE_DIAGNOSTIC)
                return 'applied', copy.deepcopy(after)

            def dispatch(command):
                nonlocal committed
                self.assertIn('push', command)
                self.assertNotIn('--dry-run', command)
                attempts = [json.loads(file.read_text(encoding='utf-8'))
                            for file in evidence.glob('*-apply.json')]
                self.assertEqual(len(attempts), 1)
                predispatch.append(attempts[0])
                self.assertEqual(attempts[0]['application_status'], 'unknown_until_readback')
                self.assertEqual(attempts[0]['result'], 'failed')
                self.assertFalse(attempts[0]['application_verified_by_readback'])
                self.assertEqual(attempts[0]['before'], before)
                self.assertNotIn('finished_at', attempts[0])
                # The provider committed, independently of whether its response arrives.
                committed = True
                if lost_response:
                    raise subprocess.TimeoutExpired(['synthetic-db-push'], 90,
                                                    output=PRIVATE_DIAGNOSTIC, stderr=PRIVATE_DIAGNOSTIC)
                return SimpleNamespace(returncode=0, stdout=release.PENDING + '\n' + PRIVATE_DIAGNOSTIC,
                                       stderr=PRIVATE_DIAGNOSTIC)

            expected_error = subprocess.TimeoutExpired if lost_response else ConnectionError if failed_readback else ValueError
            with mock.patch.object(release, 'prerequisites', return_value=inputs), \
                 mock.patch.object(release, 'inspect', side_effect=inspect), \
                 mock.patch.object(release, 'call', side_effect=dispatch) as transport, \
                 mock.patch.object(release, 'EVIDENCE', evidence), \
                 mock.patch.object(sys, 'argv', ['release_logo_capability.py', 'apply']), \
                 contextlib.redirect_stdout(output), self.assertRaises(expected_error):
                release.main()

            artifacts = [file.read_text(encoding='utf-8') for file in evidence.glob('*-apply.json')]
            receipts = [json.loads(artifact) for artifact in artifacts]
            self.assertEqual(transport.call_count, 1)
            self.assertTrue(committed)
            self.assertEqual(len(receipts), 2)
            self.assertEqual(len(predispatch), 1)
            completed = [receipt for receipt in receipts if 'finished_at' in receipt]
            self.assertEqual(len(completed), 1)
            self.assertNotIn(PRIVATE_DIAGNOSTIC, output.getvalue())
            self.assertNotIn(PRIVATE_DIAGNOSTIC, '\n'.join(artifacts))
            self.assertEqual(json.loads((evidence / 'dry-run.json').read_text(encoding='utf-8')), prior)
        return completed[0], before, after, inspections

    def test_committed_push_with_lost_response_keeps_unknown_attempt_for_readback(self):
        receipt, before, _, inspections = self.run_apply(lost_response=True)
        self.assertEqual(inspections, 1)
        self.assertEqual(receipt['result'], 'failed')
        self.assertEqual(receipt['application_status'], 'unknown_until_readback')
        self.assertEqual(receipt['before'], before)
        self.assertFalse(receipt['application_verified_by_readback'])
        self.assertFalse(receipt['raw_diagnostics_recorded'])
        self.assertNotIn('exit_code', receipt)
        self.assertNotIn('readback', receipt)
        self.assertIn('Use readback', receipt['reason'])

    def test_successful_push_with_failed_readback_keeps_exit_and_pending_migration(self):
        receipt, before, _, inspections = self.run_apply(failed_readback=True)
        self.assertEqual(inspections, 2)
        self.assertEqual(receipt['result'], 'failed')
        self.assertEqual(receipt['application_status'], 'unknown_until_readback')
        self.assertEqual(receipt['exit_code'], 0)
        self.assertEqual(receipt['pending_migrations'], [release.PENDING])
        self.assertEqual(receipt['before'], before)
        self.assertFalse(receipt['application_verified_by_readback'])
        self.assertNotIn('readback', receipt)

    def test_applied_readback_survives_later_count_failure_without_claiming_success(self):
        receipt, before, after, inspections = self.run_apply(changed_counts=True)
        self.assertEqual(inspections, 2)
        self.assertEqual(receipt['result'], 'failed')
        self.assertEqual(receipt['application_status'], 'verified_applied')
        self.assertTrue(receipt['application_verified_by_readback'])
        self.assertEqual(receipt['before']['counts'], before['counts'])
        self.assertEqual(receipt['readback']['counts'], after['counts'])
        self.assertEqual(receipt['exit_code'], 0)
        self.assertIn('counts changed', receipt['reason'])
        self.assertFalse(receipt['runtime_flag_changed'])
        self.assertFalse(receipt['seeds'])
        self.assertFalse(receipt['vault_sync'])


if __name__ == '__main__':
    unittest.main()
