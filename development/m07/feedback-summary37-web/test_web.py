"""Inert web37 gates. No CLI, SQL, private source, build or provider operation."""
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
spec = importlib.util.spec_from_file_location('feedback37_web_test_subject', HERE / 'web.py')
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)


class WebTests(unittest.TestCase):
    def report(self):
        return {'files': w.expected_source_rows(), 'entries': len(w.expected_source_rows())}

    def test_actual_217_proof_and_root_product_gates_are_independent_and_sealed(self):
        proof = w.proof()
        self.assertEqual(len(proof['source_seals']), 217)
        self.assertEqual(proof['feedback37_sql']['actual37_sha256'], w.MIGRATION_SHA)
        gates = w.product_gates(w.ANCHORS['api_gates'])
        self.assertIsNone(gates['aggregate_test_count_claimed'])
        self.assertEqual([row['exit_code'] for row in gates['commands']], [0, 0, 0])
        with self.assertRaises(ValueError):
            w.product_gates({**w.ANCHORS['api_gates'], 'sha256': '0' * 64})

    def test_delta_is_actual_seven_shipped_changes_and_one_new_domain_file(self):
        report = self.report()
        delta = w.source_delta(report)
        self.assertEqual(delta['baseline_entries'], 283)
        self.assertEqual(delta['current_entries'], 284)
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
            with self.assertRaises(ValueError):
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
        self.assertIn('epsFeedback37Source=' + 'a' * 64, args)
        for forbidden in ['--prebuilt', '--env', '--build-env', '--token', '--import', '--require', 'rollback', 'promote', 'restart', 'daemon']:
            self.assertNotIn(forbidden, args)
        self.assertNotIn(w.WORKER, args)
        self.assertEqual(w.CURRENT, w.anchor('baseline_ready')['deployment']['id'])

    def test_current_and_new_provider_metadata_use_separate_exact_marker_families(self):
        expected = w.anchor('baseline_ready')['deployment']
        raw = {'id': w.CURRENT, 'name': 'everyone-presentation-pilot', 'project': {'id': w.old.PROJECT},
               'team': {'id': w.old.TEAM}, 'readyState': 'READY', 'url': expected['url'],
               'meta': {'epsSourceUnreadable36' + suffix: expected[field] for suffix, field in
                        [('Source', 'source_sha256'), ('Quality', 'quality_sha256'), ('Canonical', 'canonical_sha256')]}}
        self.assertEqual(w.deployment(raw), expected)
        raw['id'] = 'dpl_12345678901234567890'
        raw['meta'] = {key: expected[field] for key, field in w.MARKERS}
        self.assertEqual(w.deployment(raw), {**expected, 'id': raw['id']})
        raw['meta']['epsFeedback37Source'] = 'unexpected-private-provider-text'
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
        static = {'history': [str(i) for i in range(36)] + [w.VERSION], 'installed': 'synthetic-static'}
        pins = {file: 'a' * 64 for file in w.DB_FILES}
        apply = {'action': 'apply', 'result': 'passed', 'target': w.TARGET, 'version': w.VERSION,
                 'migration_sha256': w.MIGRATION_SHA, 'normal_return_marker_observed': True,
                 'independent_readback_verified': True, 'claim_retained': True,
                 'first': {'static_schema': static}, 'second': {'static_schema': static},
                 'static_schema_after': static, 'source_pins': pins, 'admission': {'synthetic': True}}
        readback = {'action': 'readback', 'result': 'observed_applied', 'target': w.TARGET, 'version': w.VERSION,
                    'migration_sha256': w.MIGRATION_SHA, 'source_pins': pins, 'admission': apply['admission'],
                    'static_schema_after': static, 'original_dispatch_normal_return_not_inferred': True, 'claim_retained': True}
        refs = {'apply': {'path': 'tracking/evidence/m07/feedback-summary37-release/synthetic-apply.json', 'sha256': 'b' * 64},
                'readback': {'path': 'tracking/evidence/m07/feedback-summary37-release/synthetic-readback.json', 'sha256': 'c' * 64}}
        return refs, apply, readback, static

    def static_helper(self, static):
        return SimpleNamespace(VERSION=w.VERSION, MIGRATION_SHA=w.MIGRATION_SHA,
                               s=SimpleNamespace(static_schema=Mock(side_effect=lambda full: full['static_schema']),
                                                 check_static=Mock(side_effect=lambda value: value)),
                               read_static_state=Mock(return_value=static))

    def test_actual_db37_apply_and_separate_readback_are_mandatory_not_local_proof(self):
        refs, apply, readback, static = self.canonical_docs()
        def resolve(ref):
            return apply if ref == refs['apply'] else readback
        helper = self.static_helper(static)
        with patch.object(w, 'reference', side_effect=resolve), patch.object(w, 'database_helper', return_value=helper):
            self.assertEqual(w.canonical(refs), w.digest(static))
            helper.s.static_schema.assert_called_once_with(apply['first'])
            helper.s.check_static.assert_called_once_with(static)
            helper.read_static_state.assert_not_called()
            for change in [lambda: apply.update(result='prepared'),
                           lambda: apply.update(normal_return_marker_observed=False),
                           lambda: readback.update(static_schema_after={'history': []}),
                           lambda: readback.update(source_pins={})]:
                refs, apply, readback, static = self.canonical_docs()
                change()
                with self.assertRaises(ValueError):
                    w.canonical(refs)
        with self.assertRaises(ValueError):
            w.canonical({'apply': None, 'readback': None})

    def test_live_db_gate_uses_only_exact_readonly_static_contract(self):
        refs, apply, readback, static = self.canonical_docs()
        helper = self.static_helper(static)
        with patch.object(w, 'reference', side_effect=lambda ref: apply if ref == refs['apply'] else readback), patch.object(w, 'verify_pins'), patch.object(w, 'database_helper', return_value=helper):
            self.assertEqual(w.canonical(refs, True), w.digest(static))
            helper.read_static_state.assert_called_once_with()
            helper.read_static_state.return_value = {**static, 'installed': 'changed'}
            with self.assertRaises(ValueError):
                w.canonical(refs, True)

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
