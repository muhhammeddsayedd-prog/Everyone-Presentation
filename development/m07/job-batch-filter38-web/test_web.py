"""Inert web38 gates. No CLI, SQL, private source, build or provider operation."""
import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('batch38_web_test_subject', HERE / 'web.py')
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)


class WebTests(unittest.TestCase):
    def setUp(self):
        self.migration_patch = patch.object(w, 'MIGRATION_SHA', 'f' * 64)
        self.migration_patch.start()
        self.addCleanup(self.migration_patch.stop)

    def report(self):
        rows = w.candidate_source_rows()
        return {'files': rows, 'entries': len(rows)}

    def test_pending_anchors_are_explicit_and_cannot_be_accepted(self):
        with patch.dict(w.ANCHORS, {'proof': None, 'api_gates': None}):
            with self.assertRaises(ValueError):
                w.proof()
            with self.assertRaises(ValueError):
                w.product_gates(None)
        with patch.object(w, 'MIGRATION_SHA', None), patch.object(w, 'reference') as read:
            with self.assertRaises(ValueError):
                w.canonical({'apply': None, 'readback': None})
            read.assert_not_called()

    def test_web_pins_do_not_revalidate_old376_product_bytes_after_merge(self):
        anchors = {name: {'path': 'tracking/evidence/synthetic/' + name + '.json', 'sha256': 'f' * 64} for name in w.ANCHORS}
        with patch.dict(w.ANCHORS, anchors), patch.object(w, 'proof', return_value={'source_seals': {'old/changed.ts': '0' * 64}}), patch.object(w.base, 'source_pins', return_value={w.BASE: w.BASE_SHA}), patch.object(w, 'reference'), patch.object(w, 'verify_pins') as verified:
            result = w.source_pins()
            verified.assert_called_once_with(w.PRODUCT_PINS)
            self.assertNotIn('old/changed.ts', result)
            self.assertTrue(w.PRODUCT_PINS.items() <= result.items())

    def test_actual_postmerge_quality_gates_require_all_commands_and_exact_current_sources(self):
        ref = {'path': 'tracking/evidence/synthetic/quality.json', 'sha256': 'b' * 64}
        proof = {'path': 'tracking/evidence/synthetic/proof.json', 'sha256': 'c' * 64}
        def payload():
            return {'result': 'passed', 'product_source_unchanged_after_commands': True,
                    'product_source_pins': dict(w.PRODUCT_PINS), 'provider_called': False,
                    'owned_sql_receipt': proof,
                    'commands': [{'command': cmd, 'exit_code': 0} for cmd in
                                 ['npm.cmd test', 'npm.cmd run lint', 'npm.cmd run typecheck']]}
        doc = payload()
        with patch.dict(w.ANCHORS, {'api_gates': ref, 'proof': proof}), patch.object(w, 'reference', side_effect=lambda _: doc):
            self.assertEqual(w.product_gates(ref), doc)
            for change in [lambda: doc['commands'][1].update(exit_code=1),
                           lambda: doc.update(product_source_unchanged_after_commands=False),
                           lambda: doc['product_source_pins'].update({w.ADDED: '0' * 64}),
                           lambda: doc.update(owned_sql_receipt=None)]:
                doc = payload()
                change()
                with self.assertRaises(ValueError):
                    w.product_gates(ref)

    def test_delta_is_actual_six_shipped_changes_and_one_new_domain_file(self):
        report = self.report()
        with patch.object(w, 'expected_source_rows', return_value=w.candidate_source_rows()):
            delta = w.source_delta(report)
        self.assertEqual(delta['baseline_entries'], 284)
        self.assertEqual(delta['current_entries'], 285)
        self.assertEqual({row['path'] for row in delta['changed']}, w.CHANGED)
        self.assertEqual([row['path'] for row in delta['added']], [w.ADDED])
        self.assertEqual(delta['removed'], [])
        trace = 'packages/jobs/src/attempt-trace.ts'
        baseline = {r['path']: r for r in w.anchor('baseline_source')['files']}
        self.assertEqual(next(r for r in report['files'] if r['path'] == trace), baseline[trace])
        mutations = [lambda r: r['files'].pop(),
                     lambda r: r['files'].append({'path': '.env.local', 'bytes': 1, 'sha256': 'a' * 64}),
                     lambda r: next(x for x in r['files'] if x['path'] == 'apps/worker/package.json').update(sha256='0' * 64),
                     lambda r: next(x for x in r['files'] if x['path'] == w.ADDED).update(sha256='0' * 64)]
        for mutate in mutations:
            bad = copy.deepcopy(report)
            mutate(bad)
            with patch.object(w, 'expected_source_rows', return_value=w.candidate_source_rows()), self.assertRaises(ValueError):
                w.source_delta(bad)

    def test_disabled_entry_refuses_every_root_action_before_io(self):
        self.assertIs(type(w.DEPLOY_ENABLED), bool)
        for action in ['prepare', 'inspect', 'build', 'admit', 'deploy', 'readback']:
            with patch.object(w, 'DEPLOY_ENABLED', False), patch.object(w, 'load') as load, patch.object(w, 'command') as command, patch.object(w, 'source_pins') as pins:
                with self.assertRaises(ValueError):
                    w.main([action, 'synthetic-input'])
                load.assert_not_called()
                command.assert_not_called()
                pins.assert_not_called()

    def test_deploy_command_is_fixed_normal_cli_source_build_without_transfer_or_hook(self):
        args = w.deploy_command(Path('synthetic-source'), 'a' * 64, 'b' * 64, 'c' * 64)
        self.assertEqual(args[:4], [str(w.old.NODE), str(w.old.CLI), 'deploy', 'synthetic-source'])
        self.assertIn(w.old.PROJECT, args)
        self.assertIn(w.old.SLUG, args)
        self.assertIn('epsBatchFilter38Source=' + 'a' * 64, args)
        for forbidden in ['--prebuilt', '--env', '--build-env', '--token', '--import', '--require', 'rollback', 'promote', 'restart', 'daemon']:
            self.assertNotIn(forbidden, args)
        self.assertNotIn(w.WORKER, args)
        self.assertEqual(w.CURRENT, w.anchor('baseline_ready')['deployment']['id'])

    def test_current_and_new_provider_metadata_use_separate_exact_marker_families(self):
        expected = w.anchor('baseline_ready')['deployment']
        raw = {'id': w.CURRENT, 'name': 'everyone-presentation-pilot', 'project': {'id': w.old.PROJECT},
               'team': {'id': w.old.TEAM}, 'readyState': 'READY', 'url': expected['url'],
               'meta': {'epsFeedback37' + suffix: expected[field] for suffix, field in
                        [('Source', 'source_sha256'), ('Quality', 'quality_sha256'), ('Canonical', 'canonical_sha256')]}}
        self.assertEqual(w.deployment(raw), expected)
        raw['id'] = 'dpl_12345678901234567890'
        raw['meta'] = {key: expected[field] for key, field in w.MARKERS}
        self.assertEqual(w.deployment(raw), {**expected, 'id': raw['id']})
        raw['meta']['epsBatchFilter38Source'] = 'unexpected-private-provider-text'
        with self.assertRaises(ValueError):
            w.deployment(raw)

    def test_bad_source_refuses_before_private_plan_or_provider_actions(self):
        supplied = {'source_receipt': {'path': 'synthetic', 'sha256': 'a' * 64},
                    'api_gates_receipt': w.ANCHORS['api_gates'], 'public_build_environment': {}}
        with patch.object(w, 'DEPLOY_ENABLED', True), patch.object(w, 'PLAN', Mock(exists=lambda: False)), patch.object(w, 'inputs', return_value=supplied), patch.object(w, 'product_gates'), patch.object(w.base, 'public_environment', return_value={}), patch.object(w, 'source_pins', return_value={}), patch.object(w, 'stage', side_effect=ValueError('synthetic-bad-source')), patch.object(w, 'exclusive') as exclusive, patch.object(w, 'command') as command:
            with self.assertRaises(ValueError):
                w.main(['prepare', 'synthetic-input'])
            exclusive.assert_not_called()
            command.assert_not_called()

    def canonical_docs(self):
        static = {'history': [str(i) for i in range(37)] + [w.VERSION], 'installed': 'synthetic-static'}
        pins = {file: 'a' * 64 for file in w.DB_FILES}
        apply = {'action': 'apply', 'result': 'passed', 'target': w.TARGET, 'version': w.VERSION,
                 'migration_sha256': w.MIGRATION_SHA, 'normal_return_marker_observed': True,
                 'independent_readback_verified': True, 'claim_retained': True,
                 'first': {'static_schema': static}, 'second': {'static_schema': static},
                 'static_schema_after': static,
                 'preservation': {key: True for key in
                     ['all74_business_hashes_unchanged', 'trace_hash_unchanged', 'old4_full_pg_proc_unchanged',
                      'only_history_and_one_new_function_changed', 'English_Ready_Reviewed_media_protectedM02_preserved',
                      'old_catalogue_OAuth_RLS_grants_owners_preserved']},
                 'source_pins': {**pins, 'old/native376/changed-product.ts': 'b' * 64},
                 'admission': {'local_proof': w.ANCHORS['proof']}}
        readback = {'action': 'readback', 'result': 'observed_applied', 'target': w.TARGET, 'version': w.VERSION,
                    'migration_sha256': w.MIGRATION_SHA, 'source_pins': pins,
                    'static_schema_after': static, 'normal_return_not_inferred': True,
                    'two_static_reads_equal': True, 'full_business_hashes_rechecked': False}
        refs = {'apply': {'path': 'tracking/evidence/m07/job-batch-filter38-release/synthetic-apply.json', 'sha256': 'b' * 64},
                'readback': {'path': 'tracking/evidence/m07/job-batch-filter38-release/synthetic-readback.json', 'sha256': 'c' * 64}}
        return refs, apply, readback, static

    def static_helper(self, static):
        return SimpleNamespace(VERSION=w.VERSION, MIGRATION_SHA=w.MIGRATION_SHA,
                               s=SimpleNamespace(static_schema=Mock(side_effect=lambda full: full['static_schema']),
                                                 check_static=Mock(side_effect=lambda value: value),
                                                 native_admission_sources=Mock(side_effect=AssertionError('native376 aftermerge'))),
                               sources=Mock(side_effect=AssertionError('full apply pins aftermerge')),
                               admission=Mock(side_effect=AssertionError('native admission aftermerge')),
                               read_static_state=Mock(return_value=static))

    def test_real_apply_normal_return_and_distinct_independent_static_readback_are_mandatory(self):
        refs, apply, readback, static = self.canonical_docs()
        def resolve(ref):
            return apply if ref == refs['apply'] else readback
        helper = self.static_helper(static)
        with patch.object(w, 'proof'), patch.object(w, 'reference', side_effect=resolve), patch.object(w, 'database_helper', return_value=helper):
            self.assertEqual(w.canonical(refs), w.digest(static))
            self.assertNotEqual(apply['source_pins'], readback['source_pins'])
            helper.s.static_schema.assert_called_once_with(apply['first'])
            helper.s.check_static.assert_called_once_with(static)
            helper.read_static_state.assert_not_called()
            for change in [lambda: apply.update(result='prepared'),
                           lambda: apply.update(normal_return_marker_observed=False),
                           lambda: readback.update(static_schema_after={'history': []}),
                           lambda: readback.update(source_pins={}),
                           lambda: readback['source_pins'].update({next(iter(w.DB_FILES)): 'e' * 64}),
                           lambda: readback.update(two_static_reads_equal=False),
                           lambda: apply.update(preservation={}),
                           lambda: apply.update(second={'different': 'full-state'})]:
                refs, apply, readback, static = self.canonical_docs()
                change()
                with self.assertRaises(ValueError):
                    w.canonical(refs)
        with self.assertRaises(ValueError):
            w.canonical({'apply': None, 'readback': None})

    def test_live_gate_uses_only_readonly_projection_without_old_product_pins(self):
        refs, apply, readback, static = self.canonical_docs()
        helper = self.static_helper(static)
        with patch.object(w, 'proof'), patch.object(w, 'reference', side_effect=lambda ref: apply if ref == refs['apply'] else readback), patch.object(w, 'database_helper', return_value=helper) as imported:
            self.assertEqual(w.canonical(refs, True), w.digest(static))
            imported.assert_called_once_with(readback['source_pins'])
            helper.read_static_state.assert_called_once_with()
            helper.sources.assert_not_called()
            helper.admission.assert_not_called()
            helper.s.native_admission_sources.assert_not_called()
            helper.read_static_state.return_value = {**static, 'installed': 'changed'}
            with self.assertRaises(ValueError):
                w.canonical(refs, True)

    def test_database_import_requires_exact_projection_map_not_merely_a_subset(self):
        _, apply, readback, static = self.canonical_docs()
        helper = self.static_helper(static)
        helper.projection_sources = Mock(return_value=readback['source_pins'])
        fake_loader = SimpleNamespace(exec_module=Mock())
        with patch.object(w, 'verify_pins') as verified, patch.object(w.importlib.util, 'spec_from_file_location', return_value=SimpleNamespace(loader=fake_loader)), patch.object(w.importlib.util, 'module_from_spec', return_value=helper):
            self.assertIs(w.database_helper(readback['source_pins']), helper)
            verified.assert_called_once_with(readback['source_pins'])
            with self.assertRaises(ValueError):
                w.database_helper(apply['source_pins'])
            helper.s.native_admission_sources.assert_not_called()

    def test_ready_requires_same_new_id_and_every_source_quality_canonical_marker(self):
        row = {'id': 'dpl_new', 'state': 'READY', 'source_sha256': 'a' * 64, 'quality_sha256': 'b' * 64, 'canonical_sha256': 'c' * 64}
        self.assertEqual(w.ready(row, row, 'a' * 64, 'b' * 64, 'c' * 64), row)
        for changed in [{**row, 'id': w.CURRENT}, {**row, 'state': 'BUILDING'}, {**row, 'source_sha256': '0' * 64}]:
            with self.assertRaises(ValueError):
                w.ready(changed, changed, 'a' * 64, 'b' * 64, 'c' * 64)
        with self.assertRaises(ValueError):
            w.ready(row, {**row, 'id': 'dpl_other'}, 'a' * 64, 'b' * 64, 'c' * 64)

    def test_unknown_dispatch_retains_new_once_claim_and_prevents_second_command(self):
        claim = Mock(); claim.exists.return_value = False
        returned = Mock(); returned.exists.return_value = False
        value = {'run_id': '10000000-0000-4000-8000-000000000001'}
        before = {'deployment': {'id': w.CURRENT}}
        doc = {'source_sha256': 'a' * 64}
        bound = {'canonical_schema_sha256': 'b' * 64}
        def exclusive(path, body):
            self.assertIs(path, claim)
            self.assertIs(body['automatic_retry'], False)
            self.assertIs(body['dispatch_may_have_occurred'], True)
            claim.exists.return_value = True
        with patch.object(w, 'CLAIM', claim), patch.object(w, 'RETURNED', returned), patch.object(w, 'observe', return_value=before), patch.object(w, 'admission', return_value=bound), patch.object(w, 'plan', return_value=value), patch.object(w, 'build_receipt', return_value=doc), patch.object(w, 'source_pins', return_value={}), patch.object(w, 'load', return_value=b'synthetic-sealed-file'), patch.object(w, 'exclusive', side_effect=exclusive), patch.object(w, 'command', side_effect=TimeoutError('synthetic')) as command:
            with self.assertRaises(TimeoutError):
                w.dispatch(value, Path('synthetic-source'), doc, before)
            with self.assertRaises(ValueError):
                w.dispatch(value, Path('synthetic-source'), doc, before)
            self.assertEqual(command.call_count, 1)


if __name__ == '__main__':
    unittest.main()
