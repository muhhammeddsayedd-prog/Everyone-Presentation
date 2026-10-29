"""Deterministic release failure tests. No CLI, database, Docker or provider."""
import contextlib
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
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / 'tools'))
spec = importlib.util.spec_from_file_location('specs_assets_release_under_test', REPO / 'tools/release_specs_assets.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


def runtime():
    return {'name': 'eps_specs_runtime', 'login': True, 'inherit': False, 'superuser': False, 'bypass_rls': False,
            'create_db': False, 'create_role': False, 'replication': False, 'schema_create': False, 'table_authority': False,
            'connection_limit': 4, 'valid_until': (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=10)).isoformat(),
            'parents': [{'name': name, 'grantor': 'postgres', 'admin': False, 'inherit': True, 'set': False}
                        for name in ('eps_jobs_dispatcher', 'eps_jobs_executor')],
            'incoming': [{'name': 'postgres', 'grantor': 'supabase_admin', 'admin': True, 'inherit': False, 'set': False}],
            'settings': [{'database': '0', 'values': release.SETTINGS, 'unknown_setting': False}], 'execute': release.RUNTIME_OPERATIONS}


def states():
    before = {'query_role': 'postgres', 'database': 'postgres', 'unrestricted_visibility': True, 'versions': release.VERSIONS[:-2],
              'catalog': {'functions': [{'signature': 'synthetic_before(jsonb)', 'source_sha256': 'a' * 64, 'owner': 'postgres', 'explicit_acl': []}],
                          'relations': [], 'columns': [], 'table_acls': []},
              'counts': {'storage.buckets': 1, 'storage.objects': 1, 'eps.media_assets': 1, 'auth.users': 1, 'eps.logo_verification_keys': 1},
              'data_sha256': {'eps.specs': 'b' * 64, 'eps.roles': 'c' * 64, 'storage.buckets': 'd' * 64},
              'runtime': runtime(), 'release_additions_pristine': True,
              'source_config': {'id': 1, 'enabled': True, 'model_version': 'synthetic-model'}, 'assets': None, 'buckets': []}
    after = copy.deepcopy(before); after['versions'] = release.VERSIONS
    after['catalog']['functions'][0]['source_sha256'] = 'e' * 64
    after['catalog']['functions'].append({'signature': 'synthetic_after(jsonb)', 'source_sha256': 'e' * 64, 'owner': 'postgres', 'explicit_acl': []})
    after['counts'].update({name: 1 if name == 'eps.specs_asset_config' else 0 for name in release.NEW_TABLES})
    after['counts']['storage.buckets'] += 2
    after['assets'] = {'config': {'id': 1, 'uploads_enabled': False, 'capabilities_enabled': False, 'file_pipeline_enabled': False},
                       'keys': 0, 'uploads': 0, 'grants': 0, 'preparations': 0}
    after['buckets'] = [{'id': 'eps-specs-assets', 'name': 'eps-specs-assets', 'public': False, 'file_size_limit': 20971520,
                         'allowed_mime_types': ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']},
                        {'id': 'eps-specs-outputs', 'name': 'eps-specs-outputs', 'public': False, 'file_size_limit': 20971520,
                         'allowed_mime_types': ['application/json']}]
    return before, after


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.before, self.after = states()
        self.catalogue = patch.object(release, 'CATALOG_HASHES', {mode: release.catalogue_hash(state['catalog'], mode)
                                                               for mode, state in (('pending', self.before), ('applied', self.after))})
        self.catalogue.start(); self.addCleanup(self.catalogue.stop)
        self.run = patch.object(subprocess, 'run', side_effect=AssertionError('No process execution permitted.')).start()
        self.popen = patch.object(subprocess, 'Popen', side_effect=AssertionError('No process execution permitted.')).start()
        self.addCleanup(patch.stopall)

    def test_exact_disabled_transition_preserves_live_text_data(self):
        self.assertEqual(release.validate_state(self.before), 'pending'); self.assertEqual(release.validate_state(self.after), 'applied')
        release.compare_preserved(self.before, self.after)
        self.assertTrue(self.before['source_config']['enabled']); self.assertEqual(self.after['counts']['auth.users'], 1)

    def test_catalogue_and_unknown_history_tampering_are_denied(self):
        for original, mutate in [(self.after, lambda value: value['catalog']['functions'][0].update(source_sha256='f' * 64)),
                                 (self.after, lambda value: value['catalog']['functions'][0].update(signature='unrelated(text)')),
                                 (self.before, lambda value: value['versions'].append('unexpected'))]:
            value = copy.deepcopy(original); mutate(value)
            with self.assertRaises(release.Blocked): release.validate_state(value)

    def test_nullable_additions_and_new_key_or_enabled_flag_are_not_hidden(self):
        for mutate in [lambda value: value.update(release_additions_pristine=False),
                       lambda value: value['assets'].update(keys=1),
                       lambda value: value['assets']['config'].update(uploads_enabled=True),
                       lambda value: value['buckets'][0].update(public=True)]:
            value = copy.deepcopy(self.after); mutate(value)
            with self.assertRaises(release.Blocked): release.validate_state(value)

    def test_current_cloud_metadata_denies_maintain_and_nonowner_grant_options(self):
        value = copy.deepcopy(self.before)
        value['catalog']['functions'][0]['explicit_acl'] = [{'grantor': 'postgres', 'grantee': 'authenticated', 'privilege': 'EXECUTE', 'grantable': True}]
        # The historical effective-ACL hash cannot observe this new metadata;
        # current security validation must independently reject delegation.
        self.assertEqual(release.catalogue_hash(value['catalog'], 'pending'), release.CATALOG_HASHES['pending'])
        with self.assertRaises(release.Blocked): release.validate_state(value)
        value = copy.deepcopy(self.before); value['catalog']['table_acls'] = [{'maintain': True}]
        with self.assertRaises(release.Blocked): release.validate_security_metadata(value['catalog'])

    def test_raw_grantor_and_privilege_preservation_allows_only_reviewed_deltas(self):
        before = copy.deepcopy(self.before['catalog']); after = copy.deepcopy(self.after['catalog'])
        old = {'grantor': 'postgres', 'grantee': 'authenticated', 'privilege': 'EXECUTE', 'grantable': False}
        before['functions'][0]['explicit_acl'] = [old]; after['functions'][0]['explicit_acl'] = [old]
        release.compare_direct_acls(before, after)
        after['functions'][0]['explicit_acl'] = [{**old, 'grantor': 'unrelated'}]
        with self.assertRaises(release.Blocked): release.compare_direct_acls(before, after)
        after['functions'][0]['explicit_acl'] = [old, {**old, 'grantee': 'unrelated'}]
        with self.assertRaises(release.Blocked): release.compare_direct_acls(before, after)

    def test_runtime_extra_group_table_authority_or_unknown_defaults_are_denied(self):
        for mutate in [lambda value: value['runtime'].update(table_authority=True),
                       lambda value: value['runtime']['parents'].append({'name': 'eps_specs_assets_executor'}),
                       lambda value: value['runtime']['settings'][0].update(unknown_setting=True),
                       lambda value: value['runtime']['execute'].append('eps.unrelated(jsonb)')]:
            value = copy.deepcopy(self.before); mutate(value)
            with self.assertRaises(release.Blocked): release.validate_state(value)

    def test_local_contract_never_adopts_cloud_runtime_identity(self):
        value = copy.deepcopy(self.before)
        with self.assertRaises(release.Blocked): release.validate_state(value, local=True)
        value['runtime'] = None; self.assertEqual(release.validate_state(value, local=True), 'pending')

    def test_missing_final_seals_stop_before_process_or_target_discovery(self):
        with patch.object(release, 'SOURCE_SEALS', {}):
            with self.assertRaises(release.Blocked): release.prerequisites()
        self.run.assert_not_called(); self.popen.assert_not_called()

    def operate(self, action='apply', snapshots=None, response=None, baseline=None, expect_failure=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); evidence = root / 'evidence'; evidence.mkdir()
            (root / 'baseline.json').write_text(json.dumps({'readback': baseline or self.before}))
            inputs = {'migrations': release.MIGRATIONS, 'sealed': 'synthetic-injected-operational-test'}
            (evidence / 'dry-run.json').write_text(json.dumps({'result': 'passed', 'target': release.TARGET, 'inputs': inputs,
                'action': 'dry-run', 'finished_at': release.stamp(), 'readback': release.compact(self.before), 'pending_migrations': release.PENDING}))
            if snapshots is None: snapshots = [('pending', self.before), ('applied', self.after)]
            with patch.object(release, 'ROOT', root), patch.object(release, 'EVIDENCE', evidence), \
                 patch.object(release, 'PROOFS', {'cloud_before': ('baseline.json', 'synthetic-seal')}), \
                 patch.object(release, 'prerequisites', return_value=inputs), patch.object(release, 'inspect', side_effect=snapshots), \
                 patch.object(release, 'call', side_effect=response if isinstance(response, Exception) else None,
                              return_value=response or subprocess.CompletedProcess([], 0, '\n'.join(release.PENDING), '')), \
                 patch.object(sys, 'argv', ['release_specs_assets.py', action]), contextlib.redirect_stdout(io.StringIO()) as output:
                if expect_failure:
                    with self.assertRaises(Exception): release.main()
                else: release.main()
                calls = release.call.call_args_list
            records = [json.loads(file.read_text()) for file in evidence.glob('*.json') if file.name != 'dry-run.json']
            finals = [value for value in records if 'finished_at' in value]
            self.assertEqual(len(finals), 1)
            self.assertNotIn('RAW_PRIVATE_SENTINEL', output.getvalue() + json.dumps(records))
            return finals[0], records, calls

    def test_lost_dispatch_response_retains_applied_state_without_retry(self):
        final, records, calls = self.operate(response=RuntimeError('RAW_PRIVATE_SENTINEL'), expect_failure=True)
        self.assertEqual(len(calls), 1); self.assertTrue(final['application_verified_by_readback'])
        self.assertEqual(final['application_status'], 'verified_applied'); self.assertEqual(final['result'], 'failed')
        self.assertTrue(any('attempt_receipt' not in value and value['application_status'] == 'unknown_until_readback' for value in records))

    def test_failed_readback_keeps_unknown_outcome_and_immutable_attempt(self):
        final, records, calls = self.operate(snapshots=[('pending', self.before), RuntimeError('RAW_PRIVATE_SENTINEL')], expect_failure=True)
        self.assertEqual(len(calls), 1); self.assertEqual(final['application_status'], 'unknown_until_readback')
        self.assertFalse(final['application_verified_by_readback']); self.assertGreaterEqual(len(records), 2)

    def test_original_source_or_count_drift_retains_observed_applied_status(self):
        for field in ('data_sha256', 'counts'):
            after = copy.deepcopy(self.after)
            after[field]['eps.specs' if field == 'data_sha256' else 'auth.users'] = 'f' * 64 if field == 'data_sha256' else 2
            final, _, _ = self.operate(snapshots=[('pending', self.before), ('applied', after)], expect_failure=True)
            self.assertEqual(final['result'], 'failed'); self.assertTrue(final['application_verified_by_readback'])

    def test_changed_preflight_refuses_mutation(self):
        drift = copy.deepcopy(self.before); drift['counts']['auth.users'] = 2
        final, _, calls = self.operate(snapshots=[('pending', drift)], expect_failure=True)
        self.assertEqual(len(calls), 0); self.assertEqual(final['application_status'], 'not_attempted')

    def test_nongrantable_direct_acl_drift_after_sealed_preflight_refuses_dispatch(self):
        drift = copy.deepcopy(self.before)
        drift['catalog']['functions'][0]['explicit_acl'] = [{'grantor': 'unrelated', 'grantee': 'authenticated', 'privilege': 'EXECUTE', 'grantable': False}]
        self.assertEqual(release.catalogue_hash(drift['catalog'], 'pending'), release.CATALOG_HASHES['pending'])
        final, _, calls = self.operate(snapshots=[('pending', drift)], expect_failure=True)
        self.assertEqual(len(calls), 0); self.assertEqual(final['application_status'], 'not_attempted')

    def test_existing_applied_state_refuses_second_dispatch(self):
        final, _, calls = self.operate(snapshots=[('applied', self.after)], expect_failure=True)
        self.assertEqual(len(calls), 0); self.assertEqual(final['application_status'], 'verified_existing')
        self.assertTrue(final['application_verified_by_readback'])

    def test_readback_preserves_the_original_business_baseline(self):
        final, _, calls = self.operate(action='readback', snapshots=[('applied', self.after), ('applied', self.after)])
        self.assertEqual(len(calls), 0); self.assertEqual(final['result'], 'passed')
        self.assertEqual(final['readback']['versions'], release.VERSIONS)
        drift = copy.deepcopy(self.after); drift['data_sha256']['eps.specs'] = 'f' * 64
        final, _, calls = self.operate(action='readback', snapshots=[('applied', drift)], expect_failure=True)
        self.assertEqual(len(calls), 0); self.assertEqual(final['result'], 'failed')
        self.assertTrue(final['application_verified_by_readback']); self.assertEqual(final['application_status'], 'verified_existing')

    def test_known_success_has_one_mutator_and_compact_verified_receipt(self):
        final, _, calls = self.operate()
        self.assertEqual(len(calls), 1); self.assertEqual(final['result'], 'passed')
        self.assertNotIn('catalog', final['readback']); self.assertIn('catalog_sha256', final['readback'])
        self.assertFalse(final['file_pipeline_acceptance']); self.assertFalse(final['runtime_flag_changed'])


if __name__ == '__main__': unittest.main()
