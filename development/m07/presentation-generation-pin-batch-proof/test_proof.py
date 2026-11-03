"""Finite source/three-artifact/default-OFF checks only; no SQL or Docker."""
from pathlib import Path
import hashlib
import importlib.util
import json
import subprocess
import unittest
from pglast import parse_plpgsql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


s = load('pin_batch_projection_tests', HERE / 'source.py')
c = load('pin_batch_compiler_tests', HERE / 'compiler.py')


class Tests(unittest.TestCase):
    def test_callback_inverse_keeps_all_prior_generation_semantic_lock_and_restore_calls(self):
        path = ROOT / '.local/no-write-pin-batch-cases.mjs'
        before, _ = s.original().project_callback(path)
        after, proof = s.project_callback(path)
        self.assertTrue(proof['inverse_byte_equal'])
        for token in ['await firstWholeGenerations(combined);', 'await projectionEqualities(combined);',
                      'await verifyAcquisitionLocks(', 'await missingFrameEquality(combined);',
                      'await verifyDataReuseCases(', 'await verifyAssignmentCases(',
                      'await changedSourceRaces(context);', 'assertDataReuseEquality(', 'assertAssignmentEquality(',
                      'await install(ctx.bindings.originalLockSource,ctx.bindings.beforeBodies);',
                      'original_presentation_config_restored=true', 'COMBINED_FINAL_BASELINE_CHANGED']:
            self.assertEqual(before.count(token), after.count(token), token)
        self.assertEqual(after.count('await verifyPinAuthorityCases('), 1)
        self.assertIn('baseline,startFreshGeneration});', after)
        self.assertLess(after.index('await firstWholeGenerations(combined);'), after.index('await projectionEqualities(combined);'))
        self.assertLess(after.index('await projectionEqualities(combined);'), after.index('await verifyPinAuthorityCases('))
        self.assertEqual((HERE / 'admit.mjs').read_text(), s.project_admit())
        old_admit = (s.OLD / 'admit.mjs').read_text()
        self.assertEqual((HERE / 'admit.mjs').read_text().replace(s.AFTER, s.BEFORE, 1), old_admit)

    def test_compiled_only_one_current_body_changes_exact_five_set_and_three_seals(self):
        relative = '.local/presentation-generation-pin-batch-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        controller, callback, cases = c.compile_source(relative)
        old_controller, _, old_cases = load('pin_batch_old_compiler_tests', s.OLD / 'compiler.py').compile_source(relative.replace('presentation-generation-pin-batch-proof-compiled', 'presentation-generation-lock-acquisition-proof-compiled'))
        def bindings(text):
            start = text.index('bindings:', text.index('await lockProof.runCases(')) + len('bindings:')
            return json.JSONDecoder().raw_decode(text[start:])[0]
        old, new = bindings(old_controller), bindings(controller)
        self.assertEqual(cases, old_cases)
        for key in ['baseSource', 'baseSha', 'candidateSource', 'candidateSha', 'beforeBodies']:
            self.assertEqual(old[key], new[key], key)
        self.assertEqual(new['candidateSha'], 'aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3')
        for index in [0, 1, 3]:
            self.assertEqual(old['afterBodies'][index], new['afterBodies'][index])
        self.assertEqual(old['afterBodies'][2]['sha'], s.BEFORE)
        self.assertEqual(new['afterBodies'][2]['sha'], s.AFTER)
        self.assertEqual(new['afterBodies'][2]['name'], 'public.eps_generate_version')
        self.assertEqual(len(parse_plpgsql(new['afterBodies'][2]['sql'])), 1)
        self.assertNotIn('NOTICE', new['afterBodies'][2]['sql'])
        self.assertEqual(c.sha(new['afterBodies'][2]['sql'].encode()), new['afterBodies'][2]['definition_sha256'])
        for text in [controller, callback, cases, (HERE / 'entry.mjs').read_text()]:
            result = subprocess.run(['node', '--check', '--input-type=module'], input=text, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("'.local/presentation-generation-pin-batch-proof-once'", controller)
        self.assertIn("'eps.pinbatch.run'", controller)
        self.assertNotIn('label=eps.acqproof.run=', controller)
        self.assertLess(controller.index('report.dispatch_once_claim_created=true'), controller.index('const target = await port.verifyLocalTarget()'))
        for kind, text in [('callback', callback), ('cases', cases)]:
            self.assertIn(hashlib.sha256(text.encode()).hexdigest(), controller)
            self.assertIn(relative.replace('/controller-', '/' + kind + '-'), controller)

    def test_exact_real_pin_barrier_shape_and_no_timeout_or_authority_cache(self):
        text = (HERE / 'pin-authority.mjs').read_text()
        for needle in ['lock table eps.presentation_version_assets in share mode', "mode='RowExclusiveLock'",
                       "relation='eps.presentation_version_assets'::regclass", 'pg_blocking_pids(',
                       'Math.floor(await clock())+4', 'for(let i=0;i<150;i++)',
                       "ctx.acting('mcp','authenticated',ACTOR", "first_verbose_psql_ERROR_line",
                       "assert.equal(exit,3", 'record.authority_restored=', 'PIN_AUTHORITY_FULL_BASELINE_CHANGED']:
            self.assertIn(needle, text)
        self.assertIn("set local statement_timeout='8s';set local lock_timeout='8s';", text)
        self.assertIn('pending=observePending(sender.request(', text)
        self.assertIn('ctx.startFreshGeneration(', text)
        self.assertNotIn("new Set(['57014'", text)
        self.assertNotIn('disable trigger', text.lower())
        self.assertNotIn('set_config', text)

    def test_default_off_entry_exact_projection_and_refusal_before_context(self):
        self.assertEqual((HERE / 'entry.mjs').read_text(), s.project_entry())
        result = subprocess.run(['node', '--input-type=module', '-e',
                                 'import {runCases}from ' + json.dumps((HERE / 'entry.mjs').as_uri()) + ';await runCases({});'],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('PIN_BATCH_PROOF_EXECUTION_DISABLED', result.stderr)
        self.assertEqual(result.stdout, '')
        self.assertIn('export const EXECUTION_ENABLED=false;', (HERE / 'entry.mjs').read_text())


if __name__ == '__main__':
    unittest.main()
