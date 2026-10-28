"""Offline specs-pipeline release tests. Transport and inspection are injected.

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
import release_specs_pipeline as release


PRIVATE_DIAGNOSTIC = 'synthetic-private-release-provider@example.invalid'


class SpecsPipelineReleaseTests(unittest.TestCase):
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
                 mock.patch.object(release, 'reconcile_failed_apply', return_value={'scope': 'synthetic-offline'}), \
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
                          'provider_called', 'n8n_changed', 'seeds', 'vault_sync', 'pipeline_acceptance'):
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
                self.assertIn('Business/source/order/branding/counts changed', receipt['reason'])

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


    def actual_catalog(self, applied):
        if applied:
            return copy.deepcopy(release.read_json(release.PROOFS['local_contract'][0])['readback'])
        path = 'tracking/evidence/cloud-specs-pipeline/2026-10-28T23-41-25-536171Z-ef86b601-readback.json'
        return copy.deepcopy(release.read_json(path)['readback'])

    def test_actual_pending9_and_local_applied10_catalogues_classify(self):
        self.assertEqual(release.validate_state(self.actual_catalog(False)), 'pending')
        after = self.actual_catalog(True)
        self.assertEqual(release.validate_state(after), 'applied')
        projected = release.old_projection(after, True)
        self.assertEqual(release.prior.validate_state(projected), 'applied')
        self.assertEqual(after['base']['versions'], release.VERSIONS)
        self.assertEqual(projected['base']['versions'], release.VERSIONS[:9])

    def test_all_relation_kinds_and_overloads_collide_before10(self):
        for kind in ('r','v','m','p','f','S'):
            state = self.actual_catalog(False)
            state['pipeline']['catalog']['relations'].append({'name':'eps.specs_source_inputs','kind':kind})
            with self.assertRaises(release.Blocked): release.validate_state(state)
        state = self.actual_catalog(False)
        state['pipeline']['catalog']['functions'].append({'name':'public.eps_submit_specs','signature':'public.eps_submit_specs(text)'})
        with self.assertRaises(release.Blocked): release.validate_state(state)

    def test_new_source_named_argument_return_owner_acl_policy_and_fk_tampering_rejects(self):
        mutations = [
          lambda c: c['functions'][0].update(source_sha256='0'*64),
          lambda c: c['functions'][0].update(identity_arguments='wrong text'),
          lambda c: c['functions'][0].update(returns='text'),
          lambda c: c['functions'][0].update(owner='postgres'),
          lambda c: c['functions'][0].update(public_execute=True),
          lambda c: c['policies'][0].update(using='true OR true'),
          lambda c: c['constraints'][0].update(validated=False),
          lambda c: c['column_acls'][0].update(update=not c['column_acls'][0]['update']),
        ]
        for mutation in mutations:
            state=self.actual_catalog(True);mutation(state['pipeline']['catalog'])
            with self.assertRaises(release.Blocked): release.validate_state(state)

    def test_projection_cannot_mask_user_origin_write_or_unrelated_old_source(self):
        state=self.actual_catalog(True)
        next(r for r in state['manual']['column_acls'] if r['column']=='source_job_id')['update']=True
        with self.assertRaises(release.Blocked): release.validate_state(state)
        state=self.actual_catalog(True);state['base']['functions'][0]['source_sha256']='0'*64
        with self.assertRaises(release.Blocked): release.validate_state(state)

    def test_missing_catalog_seal_blocks_before_cli(self):
        with mock.patch.object(release,'CATALOG_HASH',None):
            with self.assertRaises(release.Blocked): release.prerequisites()

    def test_only_order_of_exact_known_admin_edges_is_semantically_irrelevant(self):
        state=self.actual_catalog(True)
        for role in state['pipeline']['catalog']['roles']: role['incoming'].reverse()
        self.assertEqual(release.validate_state(state),'applied')
        for change in ({'admin':False,'inherit':False,'set':False},{'name':'authenticated'}):
            altered=copy.deepcopy(state);altered['pipeline']['catalog']['roles'][0]['incoming'][0].update(change)
            with self.assertRaises(release.Blocked):release.validate_state(altered)

    def test_actual_committed_ordering_failure_reconciles_only_with_original_business_hashes(self):
        failed=release.read_json(release.FAILED_APPLY[0]);state=copy.deepcopy(failed['unverified_readback'])
        proof=release.reconcile_failed_apply(state)
        self.assertTrue(proof['business_snapshots_preserved_from_before_ddl'])
        state['role_order']['data_sha256']['specs']='0'*64
        with self.assertRaises(release.Blocked): release.reconcile_failed_apply(state)

if __name__ == '__main__': unittest.main()
