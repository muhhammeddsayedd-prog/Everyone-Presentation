"""Finite/inverse/parser tests only; no SQL, provider or resource execution."""
from pathlib import Path
import importlib.util
import json
import subprocess
import unittest
from pglast import parse_plpgsql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


p = load('pin_stage_projection_test', HERE / 'projection.py')
c = load('pin_stage_compiler_test', HERE / 'compiler.py')


def bindings(text):
    position = text.index('bindings:', text.index('await lockProof.runCases(')) + len('bindings:')
    return json.JSONDecoder().raw_decode(text[position:])[0]


class Tests(unittest.TestCase):
    def test_frozen_mechanism_exact_new_GEN_notices_and_inverse(self):
        p.frozen()
        self.assertEqual(len(p.PINS), 7)
        self.assertEqual((HERE / 'entry.mjs').read_text(), p.project_entry())
        old = p.previous_instrument().build()
        rows, proof = p.instrumented_bodies()
        self.assertTrue(proof['one_business_GEN_block_only'])
        self.assertEqual(len(rows), 4)
        for before, after in zip(old, rows):
            if after['name'] != 'public.eps_generate_version':
                self.assertEqual(before, after)
            else:
                self.assertEqual(after['current_candidate_body_sha256'], p.GEN)
                self.assertEqual(after['after_body_sha256'], p.INSTRUMENTED_GEN)
                candidate = p.pin_candidate()
                match = candidate.parts(after['after'])
                body = match[2]
                for a, b in reversed(p.previous_instrument().generate_edits()):
                    self.assertEqual(body.count(b), 1)
                    body = body.replace(b, a, 1)
                self.assertEqual(p.sha(body.encode()), p.GEN)
                self.assertEqual(body.count('\n'), match[2].count('\n'))
            self.assertEqual(len(parse_plpgsql(after['after'])), 1)
        path = ROOT / '.local/never-written-pin-stage-cases.mjs'
        before, _ = p.previous().project_callback(path)
        after, info = p.project_callback(path)
        self.assertTrue(info['inverse_byte_equal'])
        for a, b in reversed(p.CALLBACK_EDITS):
            after = after.replace(b, a, 1)
        self.assertEqual(after, before)

    def test_compile_has_only_GEN_binding_delta_and_fresh_namespace(self):
        relative = '.local/presentation-generation-pin-batch-stage-diagnostic-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        source, callback, cases = c.compile_source(relative)
        old_source, _, old_cases = p.load('pin_stage_old_compile', p.OLD / 'compiler.py').compile_source(relative.replace(p.NAMESPACE, p.PREVIOUS_NAMESPACE))
        old, new = bindings(old_source), bindings(source)
        self.assertEqual(cases, old_cases)
        for key in ['baseSource', 'baseSha', 'candidateSource', 'candidateSha', 'beforeBodies', 'diagnosticTemporarySQL', 'diagnosticTemporaryProof']:
            self.assertEqual(old[key], new[key], key)
        for i, (a, b) in enumerate(zip(old['afterBodies'], new['afterBodies'])):
            self.assertEqual(a, b) if i != 2 else self.assertEqual(b['sha'], p.INSTRUMENTED_GEN)
        for key in set(old['diagnosticStageMap']) | set(new['diagnosticStageMap']):
            if key != 'candidate_generate_body_sha256':
                self.assertEqual(old['diagnosticStageMap'][key], new['diagnosticStageMap'][key])
        self.assertEqual(new['diagnosticStageMap']['candidate_generate_body_sha256'], p.INSTRUMENTED_GEN)
        self.assertEqual(callback.count('await runDiagnostic('), 1)
        self.assertNotIn('await firstWholeGenerations(', callback)
        self.assertIn('original4107_and_four_old_bodies_restored=true', callback)
        self.assertIn('original_config_and_full_baseline_restored=true', callback)
        self.assertIn("'.local/" + p.NAMESPACE + "-once'", source)
        self.assertIn("'eps.pinstage.run'", source)
        self.assertNotIn('label=eps.acqstage.run=', source)
        self.assertLess(source.index('report.dispatch_once_claim_created=true'), source.index('const target = await port.verifyLocalTarget()'))
        self.assertIn("set local statement_timeout='8s';set local lock_timeout='8s';", cases)
        self.assertLess(cases.index('await custodyAndStrip('), cases.index('record.result=projected.result'))
        self.assertIn('await s.finish();const exit=await s.done;', cases)
        for kind, text in [('callback', callback), ('cases', cases)]:
            self.assertIn(c.sha(text.encode()), source)
            self.assertIn(relative.replace('/controller-', '/' + kind + '-'), source)
        for text in [source, callback, cases, (HERE / 'entry.mjs').read_text()]:
            result = subprocess.run(['node', '--check', '--input-type=module'], input=text, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_disabled_before_any_context_private_file_or_transport(self):
        result = subprocess.run(['node', '--input-type=module', '-e', 'import {runCases}from ' + json.dumps((HERE / 'entry.mjs').as_uri()) + ';await runCases({});'], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('PIN_BATCH_STAGE_DIAG_EXECUTION_DISABLED', result.stderr)
        self.assertEqual(result.stdout, '')


if __name__ == '__main__':
    unittest.main()
