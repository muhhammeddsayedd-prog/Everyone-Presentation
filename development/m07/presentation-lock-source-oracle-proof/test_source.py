"""Finite source/default-off compilation checks only; no database transport."""
from pathlib import Path
import importlib.util
import json
import subprocess
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location('oracle_proof_test_' + name, HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class Tests(unittest.TestCase):
    def test_cases_inverse_preserves_all_product_queries_and_remaining_semantics(self):
        value = module('source')
        cases = value.project_cases()
        self.assertIn('await prepareOracle(ctx,oracle,record)', cases)
        self.assertIn('keys=await readOracle(ctx,oracle,relation,record)', cases)
        self.assertIn("await ctx.installHelper('new')", cases)
        self.assertNotIn('await firstAndWarm(ctx);', cases)
        self.assertIn('fresh_timing_matrix_executed=false', cases)
        for operation in ['semanticCases', 'crossWorkspaceKeys', 'workspaceFenceRace', 'authorityCases']:
            self.assertIn('await ' + operation + '(ctx);', cases)
        self.assertIn('observePending(writer.request(', cases)
        self.assertIn('observePending(holder.request(', cases)
        subprocess.run(['node', '--check', '--input-type=module'], input=cases, text=True, capture_output=True, check=True)

    def test_disabled_entry_refuses_before_context_or_evidence(self):
        code = "import assert from 'node:assert/strict';import{runCases}from './development/m07/presentation-lock-source-oracle-proof/entry.mjs';await assert.rejects(runCases({}),{message:'ORACLE_PROOF_EXECUTION_DISABLED'});"
        subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True)

    def test_fresh_three_artifact_compiler_hashes_once_guard_and_old_four_bodies(self):
        compiler = module('compiler')
        relative = '.local/presentation-lock-source-oracle-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        controller, callback, cases = compiler.compile_source(relative)
        self.assertIn("'.local/presentation-lock-source-oracle-proof-once'", controller)
        self.assertIn("'eps.oracleproof.run'", controller)
        self.assertEqual(controller.count('label=eps.oracleproof.run='), 2)
        self.assertLess(controller.index('await protect(dispatchRoot)'), controller.index('port = await import('))
        position = controller.index('bindings:', controller.index('await lockProof.runCases(')) + len('bindings:')
        bindings, _ = json.JSONDecoder().raw_decode(controller[position:])
        self.assertEqual(bindings['projectedCallbackSha'], compiler.sha(callback.encode()))
        self.assertEqual(bindings['projectedCasesSha'], compiler.sha(cases.encode()))
        self.assertEqual(bindings['beforeBodies'], bindings['afterBodies'])
        self.assertEqual(bindings['candidateSha'], '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4')
        self.assertIn('original_presentation_configuration_restored=true', callback)
        self.assertIn('original_lock_and_four_preceding_bodies_restored=true', callback)
        self.assertIn('catalogue_prosrc_exclusions:1', callback)
        for source in [controller, callback, cases]:
            subprocess.run(['node', '--check', '--input-type=module'], input=source, text=True, capture_output=True, check=True)


if __name__ == '__main__':
    unittest.main()
