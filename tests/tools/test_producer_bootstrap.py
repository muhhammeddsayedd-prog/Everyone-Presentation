"""Private phase/identity safeguards; actual SQL behavior has a separate rollback test."""
import sys
import contextlib
import copy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
from producer_bootstrap import require_fresh_records, require_identity, validate_request, mutation_allowed, ProvisionBlocked
import producer_bootstrap as setup


class ProducerSetupTests(unittest.TestCase):
    def run_coordinator(self, action, phase, fail_mutator=False, disappear_after_inspect=False, pending_records_present=False, missing_grant=False):
        request = dict(schema_version='1.0', request_id='ffffffff-1111-4111-8111-111111111111',
                       client_id='ffffffff-2222-4222-8222-222222222222', project_id='ffffffff-3333-4333-8333-333333333333',
                       principal_id=None, producer_email='producer@example.invalid', client_name='Synthetic client', project_name='Synthetic project')
        principal = 'ffffffff-4444-4444-8444-444444444444'
        state = dict(version=1, target=setup.TARGET, request=request, request_sha256=setup.digest(setup.encode(request)), phase=phase,
                     principal_id=principal if phase in ('grants_pending', 'completed') else None, created_at='2026-10-28', updated_at='2026-10-28')
        observed = dict(request_id=request['request_id'], client_id=request['client_id'], project_id=request['project_id'], resource_state='complete_pair',
                        principal_match_count=1, principal_id=principal, principal_confirmed=True, signed_in=True, nonanonymous=True, nondeleted=True, nonbanned=True,
                        project_membership='write', client_membership='write', capabilities={c:'active' for c in setup.CAPABILITIES}, client_name_collisions=0, project_name_collisions=0)
        if phase in ('prepared', 'records_pending'):
            observed['resource_state'] = 'absent'
        if pending_records_present:
            observed['resource_state'] = 'complete_pair'
        if missing_grant:
            observed['capabilities']['projects.write'] = 'absent'
        calls = []; saved = []
        def query(action, envelope, security):
            calls.append((action, copy.deepcopy(envelope)))
            if action == 'inspect':
                result = copy.deepcopy(observed)
                if disappear_after_inspect and len(calls) > 1:
                    result['resource_state'] = 'absent'
                return result
            if fail_mutator:
                raise ProvisionBlocked('Synthetic response lost after request dispatch.')
            raise AssertionError('Unexpected mutator in read-only coordinator rehearsal.')
        def save(stream, value, security):
            saved.append(copy.deepcopy(value))
        with tempfile.TemporaryDirectory() as directory:
            stream = io.BytesIO(setup.encode(state))
            with mock.patch.object(setup, 'prerequisites'), mock.patch.object(setup, 'WindowsPrivateFiles'), mock.patch.object(setup, 'safe_path'), \
                 mock.patch.object(setup, 'PRIVATE', Path(directory)), mock.patch.object(setup, 'EVIDENCE', Path(directory)), \
                 mock.patch.object(setup, 'exclusive_state', return_value=contextlib.nullcontext(stream)), \
                 mock.patch.object(setup, 'query', side_effect=query), mock.patch.object(setup, 'save_state', side_effect=save), \
                 mock.patch.object(sys, 'argv', ['producer_bootstrap.py', action]), contextlib.redirect_stdout(io.StringIO()):
                code = setup.main()
            receipts = [json.loads(p.read_text()) for p in Path(directory).glob('*.json')]
            self.assertEqual(len(receipts), 1)
        return code, calls, saved, receipts[0]

    def test_finalized_record_replay_never_dispatches_mutator_during_delete_race(self):
        for phase in ('records_ready', 'grants_pending', 'completed'):
            with self.subTest(phase=phase):
                code, calls, saved, receipt = self.run_coordinator('records', phase, disappear_after_inspect=True)
                self.assertEqual(code, 1)
                self.assertEqual([call[0] for call in calls], ['inspect', 'inspect'])
                self.assertEqual(saved, [])
                self.assertEqual(receipt['result'], 'failed')

    def test_completed_grants_are_confirmation_only(self):
        code, calls, saved, receipt = self.run_coordinator('grants', 'completed')
        self.assertEqual(code, 0)
        self.assertEqual([call[0] for call in calls], ['inspect', 'inspect'])
        self.assertEqual(receipt['outcome']['result'], 'confirmed_existing_grants')

    def test_pending_record_recovery_confirms_existing_pair_without_mutation(self):
        code, calls, saved, receipt = self.run_coordinator('records', 'records_pending', pending_records_present=True)
        self.assertEqual(code, 0)
        self.assertEqual([call[0] for call in calls], ['inspect', 'inspect'])
        self.assertEqual(saved[-1]['phase'], 'records_ready')

    def test_pending_record_with_absent_outcome_never_recreates_after_delete(self):
        code, calls, saved, receipt = self.run_coordinator('records', 'records_pending')
        self.assertEqual(code, 1)
        self.assertEqual([call[0] for call in calls], ['inspect'])
        self.assertEqual(saved, [])

    def test_pending_grant_recovery_never_restores_deleted_permissions(self):
        code, calls, saved, receipt = self.run_coordinator('grants', 'grants_pending', missing_grant=True)
        self.assertEqual(code, 1)
        self.assertEqual([call[0] for call in calls], ['inspect'])
        self.assertEqual(saved, [])

    def test_pending_grant_recovery_confirms_complete_permissions_readonly(self):
        code, calls, saved, receipt = self.run_coordinator('grants', 'grants_pending')
        self.assertEqual(code, 0)
        self.assertEqual([call[0] for call in calls], ['inspect', 'inspect'])
        self.assertEqual(saved[-1]['phase'], 'completed')

    def test_lost_records_response_preserves_pending_resource_binding(self):
        code, calls, saved, receipt = self.run_coordinator('records', 'prepared', fail_mutator=True)
        self.assertEqual(code, 1)
        self.assertEqual([call[0] for call in calls], ['inspect', 'records'])
        self.assertEqual(saved[-1]['phase'], 'records_pending')
        self.assertEqual(saved[-1]['request'], dict(calls[-1][1]))
        self.assertEqual(receipt['result'], 'failed')

    def test_lost_grants_response_preserves_pending_identity_binding(self):
        code, calls, saved, receipt = self.run_coordinator('grants', 'records_ready', fail_mutator=True)
        self.assertEqual(code, 1)
        self.assertEqual([call[0] for call in calls], ['inspect', 'grants'])
        self.assertEqual(saved[-1]['phase'], 'grants_pending')
        self.assertEqual(saved[-1]['principal_id'], calls[-1][1]['principal_id'])
        self.assertIsNone(saved[-1]['request']['principal_id'])
        self.assertEqual(receipt['result'], 'failed')

    def test_only_pending_phases_invoke_mutators(self):
        for action in ('records', 'grants'):
            for phase in ('prepared', 'records_pending', 'records_ready', 'grants_pending', 'completed'):
                self.assertFalse(mutation_allowed(action, phase, phase))
        self.assertTrue(mutation_allowed('records', 'records_pending', 'prepared'))
        self.assertTrue(mutation_allowed('grants', 'grants_pending', 'records_ready'))

    def test_fresh_request_never_adopts_existing_pair(self):
        with self.assertRaises(ProvisionBlocked):
            require_fresh_records({'phase': 'prepared'}, {'resource_state': 'complete_pair', 'client_name_collisions': 0, 'project_name_collisions': 0})

    def test_persisted_pending_or_final_records_never_recover_absence_by_writing(self):
        for phase in ('records_pending', 'records_ready', 'grants_pending', 'completed'):
            with self.subTest(phase=phase), self.assertRaises(ProvisionBlocked):
                require_fresh_records({'phase': phase}, {'resource_state': 'absent'})

    def test_pending_recovers_owned_pair_but_never_partial(self):
        self.assertEqual(require_fresh_records({'phase': 'records_pending'}, {'resource_state': 'complete_pair'}), 'complete_pair')
        for phase in ('prepared', 'records_pending', 'records_ready'):
            with self.subTest(phase=phase), self.assertRaises(ProvisionBlocked):
                require_fresh_records({'phase': phase}, {'resource_state': 'partial_or_mismatch'})

    def test_verified_identity_must_be_unique_and_pinned(self):
        observed = dict(principal_match_count=1, principal_id='ffffffff-1111-4111-8111-111111111111',
                        principal_confirmed=True, signed_in=True, nonanonymous=True, nondeleted=True, nonbanned=True)
        self.assertEqual(require_identity({'principal_id': None}, observed), observed['principal_id'])
        for flag in ('principal_confirmed', 'signed_in', 'nonanonymous', 'nondeleted', 'nonbanned'):
            with self.subTest(flag=flag), self.assertRaises(ProvisionBlocked):
                require_identity({'principal_id': None}, dict(observed, **{flag: False}))
        for count in (0, 2):
            with self.subTest(count=count), self.assertRaises(ProvisionBlocked):
                require_identity({'principal_id': None}, dict(observed, principal_match_count=count))
        with self.assertRaises(ProvisionBlocked):
            require_identity({'principal_id': 'ffffffff-2222-4222-8222-222222222222'}, observed)

    def test_request_envelope_is_bounded_and_identifiers_explicit(self):
        request = dict(schema_version='1.0', request_id='ffffffff-1111-4111-8111-111111111111',
                       client_id='ffffffff-2222-4222-8222-222222222222', project_id='ffffffff-3333-4333-8333-333333333333',
                       principal_id=None, producer_email='producer@example.invalid', client_name="Owner's client", project_name='Requested project')
        self.assertEqual(validate_request(request), request)
        for change in ({'unexpected': True}, {'project_name': 'a' * 201}, {'client_name': 'bad\nlabel'},
                       {'producer_email': 'other@example.invalid\n'}, {'client_id': request['project_id']}):
            with self.subTest(change=change), self.assertRaises(ProvisionBlocked):
                validate_request(dict(request, **change))


if __name__ == '__main__':
    unittest.main()
