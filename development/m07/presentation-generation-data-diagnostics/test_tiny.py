"""Compilation/source/parser tests only; no Docker, psql or database calls."""
from pathlib import Path
import importlib.util
import json
import subprocess
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location('cohort_diag_' + name, HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class Tests(unittest.TestCase):
    def test_tiny_prefix_is_exact_fixture_and_no_replayed_measurement_tail(self):
        tiny = module('tiny_source')
        callback, proof = tiny.project_source()
        prior_spec = importlib.util.spec_from_file_location('frozen_data_proof', tiny.PREVIOUS)
        prior = importlib.util.module_from_spec(prior_spec)
        prior_spec.loader.exec_module(prior)
        full = prior.project_source()
        marker = '  const results={},security={},locks={},edges={},races={};'
        self.assertEqual(callback[:callback.index('  const evidence=ctx.report.cohort_diagnostic=')], full[:full.index(marker)])
        self.assertTrue(proof['inverse_byte_equal'])
        self.assertFalse('for(const variant of' in callback)
        self.assertFalse('await verifyDataReuseCases(' in callback)
        self.assertFalse('await changedSourceRaces(' in callback)
        self.assertIn("measure('locks',p)", callback)
        self.assertIn('select pg_temp.locksource41_cohorts(${literal(p.workspace)}::uuid,${literal(p.series)}::uuid);', callback)
        self.assertIn("'COHORT_DIAGNOSTIC_PREIMAGE_CHANGED'", callback)
        self.assertIn("'COHORT_DIAGNOSTIC_POSTIMAGE_CHANGED'", callback)
        self.assertIn('exact_historical_c7e4f2ef_rowhash_equivalence_claimed:false', callback)
        self.assertIn('await install(ctx.bindings.originalLockSource)', callback)

    def test_new_disabled_guard_precedes_private_context(self):
        code = """import assert from 'node:assert/strict';import {runCases}from './development/m07/presentation-generation-data-diagnostics/entry.mjs';await assert.rejects(runCases({}),{message:'COHORT_DIAGNOSTIC_EXECUTION_DISABLED'});"""
        subprocess.run(['C:/Program Files/nodejs/node.exe', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True)
        text = (HERE / 'entry.mjs').read_text()
        self.assertLess(text.index('assert(EXECUTION_ENABLED'), text.index('await realpath(privateRoot)'))
        self.assertIn("'VERBOSITY=verbose'", text)
        self.assertIn("assert.equal(ctx.report.private_acl_verified,true)", text)
        self.assertIn("'first-owned-native-error.json'", text)
        self.assertIn("flag:'wx'", text)

    def test_fresh_ownership_callback_and_all_source_checks_compile_and_parse(self):
        c = module('compiler')
        relative = '.local/presentation-generation-data-diagnostics-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        callback_relative = relative.replace('/controller-', '/callback-')
        controller, callback = c.compile_source(relative, callback_relative)
        self.assertIn('COHORT_DIAGNOSTIC_EXECUTION_DISABLED', controller)
        self.assertIn("'eps.cohortdiagnostic.run'", controller)
        self.assertEqual(controller.count('label=eps.cohortdiagnostic.run='), 2)
        self.assertIn("'.local/presentation-generation-data-diagnostics'", controller)
        self.assertIn("'presentation-original-cohort-diagnostic'", controller)
        position = controller.index('bindings:', controller.index('await lockProof.runCases(')) + len('bindings:')
        bindings, _ = json.JSONDecoder().raw_decode(controller[position:])
        self.assertTrue(bindings['projectedCallback'].endswith(callback_relative))
        self.assertEqual(bindings['projectedCallbackSha'], c.sha(callback.encode()))
        self.assertEqual(bindings['baseSha'], '1ff8ce429ec61785c1e1037da8de5d2a4b9426789074a64eab0f6f89241c48e4')
        self.assertEqual(len(bindings['beforeBodies']), 4)
        self.assertTrue(bindings['diagnosticProjection']['inverse_byte_equal'])
        for text in [controller, callback]:
            subprocess.run(['C:/Program Files/nodejs/node.exe', '--check', '--input-type=module'], input=text, capture_output=True, text=True, check=True)


if __name__ == '__main__':
    unittest.main()
