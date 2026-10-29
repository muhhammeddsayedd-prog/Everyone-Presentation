"""Synthetic M05 release guards. No private files, database or network access."""
import copy
import datetime
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from contextlib import ExitStack, redirect_stdout
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('m05_release', ROOT / 'tools/release_m05_presentations.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
import prepare_m05_presentation_readback as prepare


def new_state():
    config = {'id': True, 'enabled': False, 'renderer_version': 'everyone-casting-pdf-v1', 'application_origin': 'http://127.0.0.1:3000',
              'max_manifest_bytes': 8388608, 'max_pdf_bytes': 67108864, 'max_pages': 1000}
    registry = json.loads((ROOT / 'packages/templates/versions/1.1.0/registry.json').read_bytes())
    return {'tables': {name: {'count': 1 if name.endswith('processing_config') else 0,
                             'sha256': 'a' * 64 if name.endswith('processing_config') else release.sha(b'')} for name in prepare.NEW_TABLES},
            'config': config, 'template': {'key': registry['key'], 'version': registry['version'], 'content_sha256': registry['content_sha256'],
                                         'font_key': registry['font_key'], 'font_hashes': {font['path']: font['sha256'] for font in registry['fonts']}, 'registered': True},
            'bucket': {'id': 'eps-presentation-outputs', 'name': 'eps-presentation-outputs', 'public': False, 'file_size_limit': 67108864,
                       'allowed_mime_types': ['application/json', 'application/pdf'], 'owner': None, 'owner_id': None}}


def fixture():
    state = new_state()
    delta = {'schema_version': '1.0', 'created': {'functions|eps.presentation_new(uuid)|owner': 'eps_review_owner'},
             'changed': {'functions|eps.jobs_dto(uuid)|source_sha256': {'before': 'a' * 64, 'after': 'b' * 64}}, 'deleted': {}, 'm05_state': state}
    before = {'versions': [str(n) for n in range(23)], 'counts': {'auth.users': 1, 'eps.jobs': 3, 'storage.buckets': 4},
              'data_sha256': {'eps.jobs': 'e' * 64, 'eps.review_processing_config': 'c' * 64, 'storage.buckets': 'd' * 64},
              'runtime': {'unchanged': True}, 'managed_auth': {'unchanged': True}, 'schema_defaults': {'unchanged': True},
              'source_config': {'enabled': True}, 'protected_m02': {'unchanged': True},
              'review_state': {'config': {'enabled': True}, 'template': {**state['template'], 'version': '1.0.0',
                  'content_sha256': '8cfc99e874b2810d782f0a447628039e52e48a337fe1ce5b6286799c56e90001'}},
              'catalog_full_sha256': 'f' * 64, 'catalog_protected_sha256': '1' * 64, 'catalog_count': 100,
              'catalog_delta_values': {key: row['before'] for key, row in delta['changed'].items()},
              'm05_state': {'tables': {name: None for name in prepare.NEW_TABLES}, 'config': None, 'template': None, 'bucket': None}}
    after = copy.deepcopy(before)
    after.update(versions=before['versions'] + [release.MIGRATION[:14]], catalog_full_sha256='2' * 64, catalog_count=101,
                 catalog_delta_values={**delta['created'], **{key: row['after'] for key, row in delta['changed'].items()}}, m05_state=state)
    return before, after, delta


class PresentationRelease(unittest.TestCase):
    def setUp(self): self.before, self.after, self.delta = fixture()

    def test_missing_final_seals_deny_before_linked_config_or_cli_access(self):
        with patch.object(release, 'CONFIG_SHA', None), patch.object(release, 'cli_call', side_effect=AssertionError('CLI forbidden')):
            with self.assertRaises(release.Blocked): release.current_release_inputs()

    def test_only_exact_local_catalog_and_initial_presentation_additions_are_allowed(self):
        result = release.compare_states(self.before, self.after, self.delta)
        self.assertTrue(result['old_business_and_catalog_preserved'])
        self.assertTrue(result['new_processing_disabled'])
        self.assertTrue(result['exact_initial_template_bucket_and_empty_version_tables'])

    def test_existing_business_auth_runtime_storage_and_review_state_cannot_change(self):
        for name in ('counts', 'data_sha256', 'runtime', 'managed_auth', 'schema_defaults', 'source_config', 'protected_m02', 'review_state'):
            value = copy.deepcopy(self.after); value[name]['unreviewed'] = True
            with self.subTest(name=name), self.assertRaises(release.Blocked): release.compare_states(self.before, value, self.delta)
        for name in ('catalog_protected_sha256', 'catalog_count', 'catalog_delta_values'):
            value = copy.deepcopy(self.after); value[name] = '0' * 64 if name == 'catalog_protected_sha256' else self.before[name]
            with self.subTest(name=name), self.assertRaises(release.Blocked): release.compare_states(self.before, value, self.delta)

    def test_new_config_is_disabled_and_all_new_table_counts_are_exact(self):
        for change in (lambda state: state['config'].update(enabled=True), lambda state: state['config'].update(max_pdf_bytes=100000000),
                       lambda state: state['tables']['eps.presentation_versions'].update(count=1),
                       lambda state: state['tables']['eps.presentation_processing_config'].update(count=2),
                       lambda state: state['tables']['eps.version_slides'].update(sha256='0' * 64),
                       lambda state: state['tables'].update({'eps.unreviewed': {'count': 0, 'sha256': release.sha(b'')}})):
            delta = copy.deepcopy(self.delta); change(delta['m05_state'])
            value = copy.deepcopy(self.after); value['m05_state'] = delta['m05_state']
            with self.assertRaises(release.Blocked): release.compare_states(self.before, value, delta)

    def test_new_template_and_private_bucket_metadata_are_pinned(self):
        for change in (lambda state: state['template'].update(content_sha256='0' * 64), lambda state: state['template'].update(registered=False),
                       lambda state: state['template']['font_hashes'].pop(next(iter(state['template']['font_hashes']))),
                       lambda state: state['bucket'].update(public=True), lambda state: state['bucket'].update(file_size_limit=100000000),
                       lambda state: state['bucket'].update(allowed_mime_types=['application/pdf', 'text/html']),
                       lambda state: state['bucket'].update(created_at='unreviewed-time')):
            delta = copy.deepcopy(self.delta); change(delta['m05_state'])
            value = copy.deepcopy(self.after); value['m05_state'] = delta['m05_state']
            with self.assertRaises(release.Blocked): release.compare_states(self.before, value, delta)

    def test_before_state_cannot_adopt_partial_tables_bucket_or_catalog_collision(self):
        for change in (lambda state: state['m05_state'].update(bucket=self.delta['m05_state']['bucket']),
                       lambda state: state['m05_state']['tables'].update({'eps.presentation_versions': {'count': 0, 'sha256': release.sha(b'')}}),
                       lambda state: state['catalog_delta_values'].update(self.delta['created'])):
            before = copy.deepcopy(self.before); change(before)
            with self.assertRaises(release.Blocked): release.compare_states(before, self.after, self.delta)

    def test_preflight_rejects_partial_bucket_and_changed_font_copy_source_before_dispatch(self):
        for change in (lambda value: value['m05_state'].update(bucket=self.delta['m05_state']['bucket']),
                       lambda value: value['review_state']['template']['font_hashes'].update({next(iter(value['review_state']['template']['font_hashes'])): '0' * 64})):
            stack, _, calls, claims = self.protocol()
            before = copy.deepcopy(self.before); change(before)
            with stack, patch.object(release, 'inspect_state', return_value=before), patch.object(Path, 'write_text'), patch.object(release.os, 'replace'):
                with self.assertRaises(release.Blocked): release.main(['dry-run'])
                self.assertEqual(calls, []); self.assertEqual(claims, [])

    def test_pending_and_command_target_only24_without_seed_roles_or_vault(self):
        release.validate_pending('Apply ' + release.MIGRATION)
        for plan in ('', 'other.sql', release.MIGRATION + '\n20261029203953_m04_ai_apply_source_guard.sql'):
            with self.assertRaises(release.Blocked): release.validate_pending(plan)
        command = release.push_command(False)
        self.assertEqual(command[command.index('--project-ref') + 1], 'pyibofyctwnqpvktepse')
        self.assertIn('--skip-vault', command)
        self.assertNotIn('--include-seed', command); self.assertNotIn('--include-roles', command)
        self.assertEqual(release.push_command(True), command + ['--dry-run'])

    def test_ambient_routing_or_tls_cannot_redirect_fixed_release(self):
        release.validate_process_scope({'SUPABASE_ACCESS_TOKEN': 'synthetic-private-auth'})
        for name in ('SUPABASE_DB_URL', 'SUPABASE_API_URL', 'SUPABASE_WORKDIR', 'PGHOST', 'PGSERVICE', 'PGOPTIONS', 'PGSSLMODE', 'PGSSLKEY'):
            with self.assertRaises(release.Blocked): release.validate_process_scope({name: 'synthetic-private-override'})

    def test_readback_preserves_every_old_bucket_and_template_except_exact_new_rows(self):
        source = prepare.generate_readback((ROOT / prepare.BASE).read_text(encoding='utf8'), (ROOT / prepare.ORACLE).read_text(encoding='utf8'),
                                          (ROOT / prepare.NEW_STATE).read_text(encoding='utf8'), ["functions|eps.quoted('value')|source_sha256"])
        self.assertIn('begin isolation level repeatable read read only;', source)
        self.assertIn("r.id<>'eps-presentation-outputs'", source)
        self.assertIn("not(r.key='everyone-casting'and r.version='1.1.0')", source)
        self.assertNotIn("r.id<>'eps-candidate-support'", source)
        self.assertIn("functions|eps.quoted(''value'')|source_sha256", source)
        self.assertIn("to_jsonb(b)-array['created_at','updated_at']", source)
        self.assertIn('as m05_presentation_release;', source)
        self.assertTrue(source.rstrip().endswith('rollback;'))

    def test_proof_binds_current_harness_sources_and_exact_unique_marker_set(self):
        config = {'baseline_manifest': {'sha256': '1' * 64}, 'reviewed_manifest': {'sha256': '2' * 64},
                  'source_seals': {'tools/test-m05-versions-local.mjs': '3' * 64, 'tests/db/synthetic.sql': '4' * 64, 'tools/unrelated.mjs': '4' * 64}, 'required_markers': ['M05_SYNTHETIC_PASSED']}
        proof = {'harness_path': 'tools/test-m05-versions-local.mjs', 'harness_sha256': '3' * 64,
                 'source_sha256': {'tests/db/synthetic.sql': '4' * 64, 'development/local-db/reviewed.json': '1' * 64}, 'markers': ['M05_SYNTHETIC_PASSED']}
        files = set(release.FRAGMENTS) | {'supabase/migrations/' + release.MIGRATION, release.READBACK, release.DELTA,
                'tools/local-postgres.mjs', 'development/local-db/instance.json', 'tools/sql/m04-review-catalog.sql',
                'tools/sql/m04-review-local-snapshot.sql', 'tools/sql/m05-presentation-new-state.sql', 'tests/db/m04-assignments-fixture.sql',
                'tests/db/m05-versions-fixture.sql', 'tests/db/m05-versions.sql', 'tests/db/m05-processing.sql',
                'tests/db/m05-lifecycle.sql', 'tests/db/m05-retention.sql', 'tests/db/m05-no-role.sql', 'tools/test-m05-versions-local.mjs'}
        config['source_seals'].update({file: '4' * 64 for file in files if file != proof['harness_path']})
        proof['source_sha256'].update({file: config['source_seals'][file] for file in files})
        with patch.object(release, 'sealed'):
            release.validate_proof_sources(proof, config, candidate=True)
            for change in (lambda value: value.update(harness_sha256='5' * 64), lambda value: value['source_sha256'].update({'tests/db/synthetic.sql': '5' * 64}),
                           lambda value: value['source_sha256'].update({'unknown': '4' * 64}), lambda value: value.update(markers=['M05_OTHER_PASSED']),
                           lambda value: value.update(markers=['M05_SYNTHETIC_PASSED'] * 2),
                           lambda value: value['source_sha256'].pop('tests/db/m05-retention.sql'),
                           lambda value: value['source_sha256'].pop('development/m05/versions.sql'),
                           lambda value: value['source_sha256'].pop(release.READBACK),
                           lambda value: value.update(harness_path='tools/unrelated.mjs', harness_sha256='4' * 64),
                           lambda value: value.update(harness_path='tests/db/synthetic.sql', harness_sha256='4' * 64)):
                value = copy.deepcopy(proof); change(value)
                with self.assertRaises(release.Blocked): release.validate_proof_sources(value, config, candidate=True)

    def test_promotion_proof_requires_the_fixed_harness_baseline_and_executed_candidate(self):
        config = {'baseline_manifest': {'path': 'development/m05/presentation-baseline23.json', 'sha256': '1' * 64},
                  'reviewed_manifest': {'sha256': '2' * 64}, 'local_proof': {'path': 'tracking/evidence/m05/synthetic-proof.json'}, 'source_seals': {}}
        files = release.PROOF_SOURCES | {release.PROMOTION_HARNESS, config['baseline_manifest']['path'], config['local_proof']['path']}
        sources = {name: '3' * 64 for name in files}
        sources['development/local-db/reviewed.json'] = '2' * 64
        config['source_seals'] = sources
        item = {'harness_path': release.PROMOTION_HARNESS, 'harness_sha256': '3' * 64, 'source_sha256': sources}
        with patch.object(release, 'sealed'):
            release.validate_proof_sources(item, config, candidate=False)
            for name in (release.PROMOTION_HARNESS, release.DELTA, config['local_proof']['path'], config['baseline_manifest']['path']):
                value = copy.deepcopy(item); value['source_sha256'].pop(name)
                with self.assertRaises(release.Blocked): release.validate_proof_sources(value, config, candidate=False)

    def test_race_receipt_requires_two_actors_busy_source_atomic_capture_and_allocation(self):
        harness = 'tools/test-m05-presentation-race-local.mjs'
        files = set(release.FRAGMENTS) | {harness, 'supabase/migrations/' + release.MIGRATION, 'tools/local-postgres.mjs', 'development/local-db/instance.json',
                                         'development/local-db/reviewed.json', 'tools/sql/m04-review-local-snapshot.sql', 'tools/sql/m04-review-catalog.sql',
                                         'tools/m05-presentation-private-fixture-file.py', 'tools/provision_logo_verifier.py', 'supabase/migrations/20261028222030_m02_specs_pipeline.sql',
                                         'tests/db/m05-versions.sql', 'tests/db/m05-versions-fixture.sql', 'tests/db/m04-assignments-fixture.sql'}
        config = {'baseline_manifest': {'sha256': '1' * 64}, 'source_seals': {name: '2' * 64 for name in files}}
        item = {'result': 'passed', 'mode': 'candidate', 'cloud_called': False, 'provider_called': False, 'hosted_credential_files_read': False,
                **{key: True for key in ('sources_stable', 'assertions_passed', 'disposable_cleanup_verified', 'canonical23_unchanged', 'managed_auth_metadata_and_row_revisions_preserved', 'reviewed_catalog_and_application_snapshot_matches23', 'private_artifacts_owner_system_protected')},
                'before': {}, 'after': {}, 'managed_auth_before': {}, 'managed_auth_after': {}, 'distinct_authorized_principals': 2,
                'source_seals': {**config['source_seals'], 'development/local-db/reviewed.json': '1' * 64}, 'harness_sha256': '2' * 64,
                'busy_then_changed_source': {'real_source_writer_held': True, 'nowait_denied_code': 'INPUT_CHANGED', 'no_partial_allocation': True, 'review_before_source_commit': True, 'after_commit_denied_code': 'INPUT_CHANGED'},
                'concurrent_allocation': {'two_distinct_authorized_principals': True, 'actual_workspace_lock_wait_observed': True, 'distinct_version_ids': True, 'sequential_numbers': [4, 5], 'no_gap_or_duplicate': True},
                'atomic_capture_source_lock': {'actual_source_writer_wait_observed': True, 'capture_committed_before_source_writer': True, 'frozen_content_preserved': True, 'exact_ack_replay_after_later_source_change': True}}
        with patch.object(release, 'sealed'):
            release.validate_race_proof(item, config)
            for change in (lambda value: value.update(distinct_authorized_principals=1), lambda value: value.update(mode='red_unfenced_protocol'),
                           lambda value: value['busy_then_changed_source'].update(no_partial_allocation=False),
                           lambda value: value['concurrent_allocation'].update(sequential_numbers=[4, 6]),
                           lambda value: value['atomic_capture_source_lock'].update(frozen_content_preserved=False),
                           lambda value: value['source_seals'].pop('development/local-db/reviewed.json'),
                           lambda value: value['source_seals'].pop('tools/m05-presentation-private-fixture-file.py'),
                           lambda value: value['source_seals'].pop('development/m05/versions.sql')):
                value = copy.deepcopy(item); change(value)
                with self.assertRaises(release.Blocked): release.validate_race_proof(value, config)

    def protocol(self, *, unknown=False, source_drift=False, stale_dry=False):
        before, after, delta = copy.deepcopy((self.before, self.after, self.delta))
        inputs = {'versions': after['versions'], 'migration_sha256': 'a' * 64, 'readback_sha256': 'b' * 64}
        saved = {'tracking/evidence/cloud-m05-presentations/dry-run.json': {'result': 'passed', 'inputs': inputs, 'before': before,
                 'pending_migrations': [release.MIGRATION], 'finished_at': (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=1000 if stale_dry else 1)).isoformat()}}
        calls, claims = [], []
        checks = 0
        def current():
            nonlocal checks
            checks += 1
            return {**inputs, 'changed': True} if source_drift and checks == 2 else inputs
        def load(name): return delta if name == release.DELTA else saved[name.as_posix() if isinstance(name, Path) else name]
        def retain(value, suffix):
            path = 'tracking/evidence/cloud-m05-presentations/synthetic-' + suffix + '.json'; saved[path] = copy.deepcopy(value); return path
        def write(file, data):
            self.assertEqual(file, release.CLAIM); claims.append(data); saved[file.relative_to(release.ROOT).as_posix()] = json.loads(data)
        def call(arguments):
            calls.append(arguments)
            if unknown: raise subprocess.TimeoutExpired('synthetic', 1)
            return subprocess.CompletedProcess([], 0, release.MIGRATION, '')
        stack = ExitStack()
        for name, value in (('current_release_inputs', current), ('read_json', load), ('retain', retain), ('private_write', write), ('call', call),
                            ('refuse_repeat_apply', lambda: release.require(not claims))): stack.enter_context(patch.object(release, name, side_effect=value))
        stack.enter_context(redirect_stdout(io.StringIO()))
        return stack, saved, calls, claims

    def test_apply_claim_precedes_dispatch_and_unknown_outcome_only_allows_readback(self):
        stack, saved, calls, claims = self.protocol(unknown=True)
        with stack:
            with patch.object(release, 'inspect_state', return_value=self.before):
                with self.assertRaises(subprocess.TimeoutExpired): release.main(['apply'])
            self.assertEqual(len(claims), 1); self.assertEqual(calls, [release.push_command(False)])
            with patch.object(release, 'inspect_state', return_value=self.after): release.main(['readback'])
            self.assertTrue(saved['tracking/evidence/cloud-m05-presentations/synthetic-readback.json']['application_verified_by_readback'])
            with self.assertRaises(release.Blocked): release.refuse_repeat_apply()
            self.assertEqual(len(calls), 1)

    def test_stale_dry_run_and_last_moment_source_drift_never_dispatch(self):
        for settings in ({'stale_dry': True}, {'source_drift': True}):
            stack, _, calls, claims = self.protocol(**settings)
            with stack, patch.object(release, 'inspect_state', return_value=self.before):
                with self.assertRaises(release.Blocked): release.main(['apply'])
                self.assertEqual(calls, []); self.assertEqual(len(claims), 0 if settings.get('stale_dry') else 1)


if __name__ == '__main__': unittest.main()
