"""Injected operational regression tests only. No CLI, SQL or private files."""
import copy
import datetime
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('read_operation_release', ROOT / 'tools/release_specs_read_operation.py')
release = importlib.util.module_from_spec(spec); spec.loader.exec_module(release)
MIGRATION = '20261029070000_m02_specs_read_operation.sql'


def states():
    policies = []
    for name in release.POLICIES:
        policies.append({'table': 'storage.objects', 'name': name, 'command': 'r',
                         'permissive': name != 'eps_specs_read_guard',
                         'roles': ['authenticated'] if name.endswith('original_read') else ['anon'] if name.endswith('capability_read') else ['PUBLIC'],
                         'check': None, 'using': 'synthetic_body_only_' + name})
    before = {'query_role': 'postgres', 'database': 'postgres', 'unrestricted_visibility': True,
              'versions': release.BASE_VERSIONS,
              'catalog': {'policies': policies, 'functions': [{'name': 'eps.synthetic', 'source_sha256': 'a' * 64}],
                          'table_acls': [{'table': 'eps.synthetic', 'role': 'authenticated', 'maintain': False}],
                          'relations': [], 'columns': []},
              'counts': {'auth.users': 1, 'eps.media_assets': 2, 'eps.specs_verification_keys': 1, 'storage.objects': 2},
              'data_sha256': {'eps.specs': 'b' * 64, 'storage.objects': 'c' * 64, 'eps.specs_verification_keys:metadata': 'd' * 64},
              'source_config': {'enabled': True}, 'assets': {'config': {'uploads_enabled': True}, 'keys': 1},
              'runtime': {'name': 'eps_specs_runtime', 'login': True, 'table_authority': False, 'schema_create': False,
                  **{key: False for key in ('inherit', 'superuser', 'bypass_rls', 'create_db', 'create_role', 'replication')},
                  'connection_limit': 4, 'execute': release.RUNTIME_OPERATIONS,
                  'parents': [{'name': name, 'grantor': 'postgres', 'admin': False, 'inherit': True, 'set': False}
                              for name in sorted(release.RUNTIME_GROUPS)],
                  'incoming': [{'name': 'postgres', 'grantor': 'supabase_admin', 'admin': True, 'inherit': False, 'set': False}],
                  'settings': [{'database': '0', 'values': release.RUNTIME_SETTINGS, 'unknown_setting': False}],
                  'valid_until': (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=10)).isoformat()},
              'buckets': [{'id': 'eps-specs-assets', 'public': False}]}
    after = copy.deepcopy(before); after['versions'] = release.BASE_VERSIONS + [MIGRATION[:14]]
    for row in after['catalog']['policies']: row['using'] = 'synthetic_body_plus_info_' + row['name']
    return before, after


class ReadOperationRelease(unittest.TestCase):
    def setUp(self):
        self.before, self.after = states()
        self.patches = [patch.object(release, 'MIGRATION', MIGRATION),
                        patch.object(release, 'NEW_USING_SHA256', {row['name']: release.hashlib.sha256(row['using'].encode()).hexdigest()
                                                                  for row in self.after['catalog']['policies']}),
                        patch.object(subprocess, 'run', side_effect=AssertionError('No process')),
                        patch.object(subprocess, 'Popen', side_effect=AssertionError('No process'))]
        for item in self.patches: item.start(); self.addCleanup(item.stop)

    def test_only_three_using_fields_change_with_active_rows_keys_and_flags_retained(self):
        self.assertEqual(release.validate_snapshot(self.before), 'pending')
        self.assertEqual(release.validate_snapshot(self.after), 'applied')
        release.compare_preserved(self.before, self.after)
        release.compare_catalogues(self.before, self.after, True)

    def test_catalogue_acl_role_and_expression_tampering_are_denied(self):
        mutators = [lambda s: s['catalog']['functions'][0].update(source_sha256='f' * 64),
                    lambda s: s['catalog']['policies'][0].update(roles=['PUBLIC']),
                    lambda s: s['catalog']['policies'][0].update(permissive=False),
                    lambda s: s['catalog']['policies'][0].update(using='true'),
                    lambda s: s['catalog']['policies'][0].update(check='true'),
                    lambda s: s['catalog']['policies'].append(copy.deepcopy(s['catalog']['policies'][0])),
                    lambda s: s['catalog']['table_acls'][0].update(maintain=True)]
        for change in mutators:
            state = copy.deepcopy(self.after); change(state)
            with self.assertRaises(release.Blocked):
                release.validate_snapshot(state); release.compare_catalogues(self.before, state, True)

    def test_every_existing_row_hash_count_config_and_runtime_must_be_preserved(self):
        for change in [lambda s: s['counts'].update({'auth.users': 2}),
                       lambda s: s['data_sha256'].update({'storage.objects': 'e' * 64}),
                       lambda s: s['data_sha256'].update({'eps.specs_verification_keys:metadata': 'e' * 64}),
                       lambda s: s['assets']['config'].update(uploads_enabled=False),
                       lambda s: s.update(runtime={'unexpected': True})]:
            state = copy.deepcopy(self.after); change(state)
            with self.assertRaises(release.Blocked): release.compare_preserved(self.before, state)

    def test_fresh_baseline_cannot_adopt_already_drifted_runtime_authority_or_logging(self):
        for change in [lambda r: r['parents'][0].update(set=True), lambda r: r['parents'][0].update(admin=True),
                       lambda r: r['parents'].append({'name': 'authenticated'}), lambda r: r.update(execute=release.RUNTIME_OPERATIONS[:-1]),
                       lambda r: r.update(connection_limit=10), lambda r: r['settings'][0].update(unknown_setting=True),
                       lambda r: r['settings'][0].update(values=['log_statement=all']),
                       lambda r: r['incoming'][0].update(inherit=True), lambda r: r.update(valid_until='2000-01-01T00:00:00Z')]:
            state = copy.deepcopy(self.before); change(state['runtime'])
            with self.assertRaises(release.Blocked): release.validate_snapshot(state)
        local = copy.deepcopy(self.before)
        with self.assertRaises(release.Blocked): release.validate_snapshot(local, local=True)
        local['runtime'] = None; self.assertEqual(release.validate_snapshot(local, local=True), 'pending')

    def test_wrong_history_and_missing_source_seals_stop_before_dispatch(self):
        for history in [release.BASE_VERSIONS[:-1], release.BASE_VERSIONS + ['00000000000000'], release.BASE_VERSIONS + [MIGRATION[:14], 'extra']]:
            state = copy.deepcopy(self.before); state['versions'] = history
            with self.assertRaises(release.Blocked): release.validate_snapshot(state)
        with patch.object(release, 'LOCAL_PROOF', None), patch.object(release, 'call') as call:
            with self.assertRaises(release.Blocked): release.prerequisites()
            call.assert_not_called()

    def test_wrong_prerequisite_hash_is_rejected_without_cli(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'proof.json').write_text('{"result":"passed"}')
            with patch.object(release, 'ROOT', root), patch.object(release, 'call') as call:
                with self.assertRaises(release.Blocked): release.load_sealed(('proof.json', '0' * 64))
                call.assert_not_called()
        with patch.object(release, 'digest', return_value='f' * 64), patch.object(release, 'call') as call:
            with self.assertRaises(release.Blocked): release.capture_baseline()
            call.assert_not_called()

    def operate(self, *, action='apply', after=None, call_result=None, readback_error=False, preflight=None, mutate_dry=None):
        after = copy.deepcopy(self.after if after is None else after)
        inspections = [(release.validate_snapshot(preflight or self.before), copy.deepcopy(preflight or self.before))]
        inspections.append(release.Blocked('Safe readback failure') if readback_error else (release.validate_snapshot(after), after))
        with tempfile.TemporaryDirectory() as directory:
            evidence = Path(directory)
            inputs = {'synthetic': True, 'baseline': ('synthetic-public-proof.json', 'a' * 64)}
            dry = {'result': 'passed', 'target': release.TARGET, 'inputs': copy.deepcopy(inputs), 'action': 'dry-run',
                   'readback': release.compact(self.before), 'pending_migrations': [MIGRATION], 'finished_at': release.stamp()}
            if mutate_dry: mutate_dry(dry)
            (evidence / 'dry-run.json').write_text(json.dumps(dry))
            def read(path):
                self.assertEqual(path, 'dry-run.json'); return json.loads((evidence / path).read_text())
            with patch.object(release, 'EVIDENCE', evidence), patch.object(release, 'ROOT', evidence), \
                    patch.object(release, 'prerequisites', return_value=(inputs, self.before)), \
                    patch.object(release, 'inspect', side_effect=inspections), patch.object(release, 'read_json', side_effect=read), \
                    patch.object(release, 'call', side_effect=call_result if isinstance(call_result, Exception) else None,
                                 return_value=call_result) as dispatch, patch.object(sys, 'argv', ['fixed', action]), redirect_stdout(io.StringIO()):
                try: release.main()
                except release.Blocked: pass
                receipts = [json.loads(path.read_text()) for path in evidence.glob('*.json') if path.name != 'dry-run.json']
                self.last_dispatch_count = dispatch.call_count
            final = next(row for row in receipts if row.get('finished_at'))
            return final, receipts

    def test_lost_response_after_commit_retains_applied_truth_and_attempt(self):
        final, rows = self.operate(call_result=TimeoutError('never publish private diagnostics'))
        self.assertEqual(final['result'], 'failed'); self.assertTrue(final['application_verified_by_readback'])
        self.assertEqual(final['application_status'], 'verified_applied')
        self.assertTrue(any(row['application_status'] == 'unknown_until_readback' for row in rows))
        self.assertEqual(self.last_dispatch_count, 1)
        self.assertNotIn('private diagnostics', json.dumps(rows))

    def test_unknown_readback_keeps_unknown_state_and_never_retries(self):
        final, _ = self.operate(call_result=TimeoutError('private'), readback_error=True)
        self.assertFalse(final['application_verified_by_readback'])
        self.assertEqual(final['application_status'], 'unknown_until_readback')
        self.assertEqual(self.last_dispatch_count, 1)

    def test_postcommit_data_drift_does_not_erase_observed_history(self):
        after = copy.deepcopy(self.after); after['data_sha256']['eps.specs'] = 'f' * 64
        result = subprocess.CompletedProcess([], 0, MIGRATION, '')
        final, _ = self.operate(after=after, call_result=result)
        self.assertEqual(final['result'], 'failed'); self.assertEqual(final['application_status'], 'verified_applied')
        self.assertTrue(final['application_verified_by_readback'])

    def test_changed_preflight_blocks_mutator_and_already_applied_cannot_push(self):
        before = copy.deepcopy(self.before); before['catalog']['functions'][0]['source_sha256'] = 'f' * 64
        for preflight in [before, self.after]:
            with patch.object(release, 'call', side_effect=AssertionError('No dispatch')):
                final, _ = self.operate(preflight=preflight)
            self.assertEqual(final['result'], 'failed')
            self.assertEqual(self.last_dispatch_count, 0)

    def test_readback_success_and_positive_apply_remain_distinct_from_pipeline_acceptance(self):
        result = subprocess.CompletedProcess([], 0, MIGRATION, '')
        final, _ = self.operate(call_result=result)
        self.assertEqual(final['result'], 'passed'); self.assertFalse(final['file_pipeline_acceptance'])
        final, _ = self.operate(action='readback', preflight=self.after)
        self.assertEqual(final['result'], 'passed'); self.assertEqual(final['application_status'], 'verified_applied')

    def test_changed_roundtripped_proof_or_source_value_still_blocks_dispatch(self):
        for mutate in [lambda dry: dry['inputs'].update(baseline=('other-proof.json', 'a' * 64)),
                       lambda dry: dry['inputs'].update(baseline=('synthetic-public-proof.json', 'f' * 64))]:
            final, _ = self.operate(mutate_dry=mutate)
            self.assertEqual(final['result'], 'failed'); self.assertEqual(self.last_dispatch_count, 0)


if __name__ == '__main__': unittest.main()
