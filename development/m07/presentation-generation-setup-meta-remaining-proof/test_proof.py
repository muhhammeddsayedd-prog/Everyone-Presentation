"""Actual rendered temporary SQL/source-only regressions; no database or artifacts."""
from pathlib import Path
import importlib.util
import json
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


p = load('setup_meta_test_source', HERE / 'source.py')
c = load('setup_meta_test_compiler', HERE / 'compiler.py')


def bindings(source):
    start = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    return json.JSONDecoder().raw_decode(source[start:])[0]


def meta_body(sql):
    return sql.split('as $review$\n', 1)[1].split('\nend$review$;', 1)[0]


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.relative = '.local/presentation-generation-setup-meta-remaining-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        cls.controller, cls.callback, cls.cases = c.compile_source(cls.relative)
        cls.old, cls.old_callback, cls.old_cases = p.load('setup_meta_test_parent', p.OLD / 'compiler.py').compile_source(cls.relative.replace(p.NAMESPACE, p.PREVIOUS_NAMESPACE))

    def test_old_has_unused_cost_new_removes_only_that_return_pair_and_parses(self):
        before = p.TEMP.read_bytes().decode('utf8')
        after = bindings(self.controller)['setupMetadataTemporarySQL']
        self.assertEqual(after, p.patch_temporary(before))
        self.assertIn(p.COST, meta_body(before))
        self.assertNotIn('review_hash', meta_body(after))
        self.assertNotIn('eps.presentation_hash(v_review)', meta_body(after))
        for key in ['input', 'expected_workspace_row_version', 'expected_draft_revision', 'expected_input_fingerprint',
                    'template_sha256', 'candidate_slides', 'pending_slides', 'fit_status', 'can_generate']:
            self.assertEqual(meta_body(after).count("'" + key + "'"), meta_body(before).count("'" + key + "'"), key)
        self.assertEqual(len(parse_sql(before)), len(parse_sql(after)))
        self.assertEqual(len(parse_plpgsql(before)), 3)
        self.assertEqual(len(parse_plpgsql(after)), 3)
        # Existing measured review/snapshot/hash operations and their hash calls stay exact.
        self.assertEqual(after.split('create function pg_temp.locksource41_review_meta', 1)[0], before.split('create function pg_temp.locksource41_review_meta', 1)[0])
        self.assertEqual(after.split('end$review$;', 1)[1], before.split('end$review$;', 1)[1])
        with self.assertRaises(ValueError):
            p.patch_temporary(before.replace(p.COST, ''))

    def test_remaining_body_case_carry_and_all_gate_bindings_unchanged(self):
        before, after = bindings(self.old), bindings(self.controller)
        self.assertEqual(set(after) - set(before), {'setupMetadataTemporarySQL', 'setupMetadataProjection'})
        for key, value in before.items():
            if key not in {'projectedCallback', 'projectedCallbackSha', 'projectedCases'}:
                self.assertEqual(after[key], value, key)
        self.assertEqual(self.cases, self.old_cases)
        self.assertTrue(after['setupMetadataProjection']['inverse_byte_equal'])
        self.assertIn('ctx.applyCompletedScopes(combined)', self.callback)
        self.assertNotIn('  await firstWholeGenerations(', self.callback)
        self.assertIn('assertDataReuseEquality(ctx.report.data_reuse_cases)', self.callback)
        self.assertIn('assertAssignmentEquality(ctx.report.assignment_cases)', self.callback)
        for text in [self.controller, self.callback, self.cases]:
            checked = subprocess.run(['C:/Program Files/nodejs/node.exe', '--check', '--input-type=module'],
                                     input=text, text=True, capture_output=True, timeout=15)
            self.assertEqual(checked.returncode, 0, checked.stderr)

    def test_declared_runtime_and_generated_sources_have_no_consumer(self):
        checked = p.no_consumers(self.callback, self.cases)
        self.assertEqual(len(checked), len(p.RUNTIME_MODULES) + 2)
        for callback, cases in [(self.callback + '\nvoid value.review_hash;', self.cases),
                                (self.callback, self.cases + '\nvoid value["review_hash"];')]:
            with self.assertRaises(ValueError):
                p.no_consumers(callback, cases)
        self.assertEqual((p.TEMP.read_text()).count('review_hash'), 1)

    def test_exact_default_off_entry_refuses_before_ports_and_raw_byte_admission(self):
        entry = (HERE / 'entry.mjs').read_bytes().decode()
        self.assertEqual(entry, p.project_entry())
        p.admit_entry(entry)
        p.admit_entry(entry.replace('export const EXECUTION_ENABLED=false;', 'export const EXECUTION_ENABLED=true;', 1))
        for bad in [entry.replace('\n', '\r\n'), entry + '\n']:
            with self.assertRaises(ValueError):
                p.admit_entry(bad)
        with tempfile.TemporaryDirectory() as folder:
            temporary = Path(folder)
            (temporary / 'entry.mjs').write_bytes(entry.replace('\n', '\r\n').encode())
            with patch.object(c, 'HERE', temporary), patch.object(c, 'load', return_value=p) as loader:
                with self.assertRaises(ValueError):
                    c.compile_source(self.relative)
                self.assertEqual(loader.call_count, 1)
        code = 'import assert from "node:assert/strict";import{runCases}from ' + json.dumps((HERE / 'entry.mjs').as_uri()) + ';'
        code += 'let reads=0;const ctx=new Proxy({},{get(){reads++;throw Error("PORT_REACHED");}});await assert.rejects(runCases(ctx),/SETUP_META_REMAINING_PROOF_EXECUTION_DISABLED/u);assert.equal(reads,0);'
        checked = subprocess.run(['C:/Program Files/nodejs/node.exe', '--input-type=module'], input=code,
                                 text=True, capture_output=True, timeout=15)
        self.assertEqual(checked.returncode, 0, checked.stderr)
        self.assertFalse((p.ROOT / self.relative).exists())


if __name__ == '__main__':
    unittest.main()
