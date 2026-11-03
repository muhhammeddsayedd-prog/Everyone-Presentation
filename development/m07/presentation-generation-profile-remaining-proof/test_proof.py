"""Finite remaining-tail/inverse/binding checks only; no SQL or artifacts."""
from pathlib import Path
import importlib.util
import json
import subprocess
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


p = load('remaining_test_source', HERE / 'source.py')
c = load('remaining_test_compiler', HERE / 'compiler.py')


def bindings(source):
    start = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    return json.JSONDecoder().raw_decode(source[start:])[0]


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.relative = '.local/presentation-generation-profile-remaining-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        cls.controller, cls.callback, cls.cases = c.compile_source(cls.relative)
        cls.old, cls.old_callback, cls.old_cases = p.load('remaining_test_parent', p.OLD / 'compiler.py').compile_source(cls.relative.replace(p.NAMESPACE, p.PREVIOUS_NAMESPACE))

    def test_exact_completed_prefix_removed_only_and_fresh_comparisons_retained(self):
        self.assertEqual(self.cases, self.old_cases)
        before, after = bindings(self.old), bindings(self.controller)
        self.assertEqual(set(after) - set(before), {'remainingScopeProjection'})
        for key, value in before.items():
            if key not in {'projectedCallback', 'projectedCallbackSha', 'projectedCases'}:
                self.assertEqual(after[key], value, key)
        self.assertTrue(after['remainingScopeProjection']['inverse_byte_equal'])
        for removed in ['  await firstWholeGenerations(', '  await projectionEqualities(', '  await verifyAcquisitionLocks(', '  await missingFrameEquality(']:
            self.assertNotIn(removed, self.callback)
        for retained in ['await verifyDataReuseCases(', 'await verifyAssignmentCases(', 'await verifyRawAuthorityCases(',
                         'await changedSourceRaces(', 'assertDataReuseEquality(', 'assertAssignmentEquality(',
                         'assert.deepEqual(security.old,security.candidate)', 'original4107_and_all_six_old_bodies_restored=true',
                         'COMBINED_FINAL_BASELINE_CHANGED', 'LOCKSOURCE41_CONFIG_RESTORE_UNCONFIRMED']:
            self.assertIn(retained, self.callback)
        self.assertIn("if(variant==='candidate'){", self.callback)
        self.assertIn('ctx.report.pin_batch_cases.old.executed_in_current_runtime,false', self.callback)
        self.assertIn(p.FIX.as_uri(), self.callback)
        self.assertNotIn(p.OLD_RAW.as_uri(), self.callback)
        for text in [self.controller, self.callback, self.cases]:
            checked = subprocess.run(['C:/Program Files/nodejs/node.exe', '--check', '--input-type=module'],
                                     input=text, text=True, capture_output=True, timeout=15)
            self.assertEqual(checked.returncode, 0, checked.stderr)

    def test_actual_completed_carry_is_dated_and_never_fills_fresh_matrix_arrays(self):
        code = 'import assert from "node:assert/strict";import{completedCarry,applyCompletedScopes}from ' + json.dumps((HERE / 'admit.mjs').as_uri()) + ';'
        code += 'const admitted=await completedCarry(' + json.dumps(str(p.LIBRARY).replace('\\', '/')) + ');'
        code += 'const ctx={bindings:' + json.dumps(bindings(self.controller)) + ',report:{combined_generation:{first_calls:[],projections:[]},pin_batch_cases:{}}};'
        code += "applyCompletedScopes(ctx,admitted);assert.equal(ctx.report.combined_generation.first_calls.length,0);assert.equal(ctx.report.combined_generation.projections.length,0);"
        code += "assert.equal(ctx.report.combined_generation.completion_flags_refer_to_dated_verified_prefix,true);assert.equal(ctx.report.pin_batch_cases.old.executed_in_current_runtime,false);assert.equal(ctx.report.pin_batch_cases.old.cases.length,3);"
        result = subprocess.run(['C:/Program Files/nodejs/node.exe', '--input-type=module'], input=code,
                                text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_exact_flag_bytes_before_parent_loader_and_distinct_once_namespace(self):
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
        self.assertIn('presentation-generation-profile-remaining-proof-once', self.controller)
        self.assertIn("assert(lockProof.EXECUTION_ENABLED,'PROFILE_REMAINING_PROOF_EXECUTION_DISABLED')", self.controller)
        self.assertEqual(self.controller.count('IMAGE, ...ownedPostgresArgs]'), 1)
        self.assertFalse((p.ROOT / self.relative).exists())


if __name__ == '__main__':
    unittest.main()
