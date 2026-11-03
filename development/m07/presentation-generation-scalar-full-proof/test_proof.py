"""Source-only composition, bindings and refusal checks; no SQL or artifacts."""
from pathlib import Path
import importlib.util
import json
import subprocess
import unittest
from pglast import parse_plpgsql

HERE = Path(__file__).resolve().parent


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


p = load('scalar_full_proof_source_test', HERE / 'source.py')
c = load('scalar_full_proof_compiler_test', HERE / 'compiler.py')


def bindings(source):
    start = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    return json.JSONDecoder().raw_decode(source[start:])[0]


def node(code):
    return subprocess.run(['C:/Program Files/nodejs/node.exe', '--input-type=module'],
                          input=code, capture_output=True, text=True)


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.relative = '.local/presentation-generation-scalar-full-proof-compiled/controller-00000000-0000-4000-8000-000000000002.mjs'
        cls.controller, cls.callback, cls.cases = c.compile_source(cls.relative)
        cls.old, _, cls.old_cases = p.load('scalar_full_test_parent_compiler', p.OLD / 'compiler.py').compile_source(cls.relative.replace(p.NAMESPACE, p.PREVIOUS_NAMESPACE))

    def test_only_three_new_bindings_and_every_existing_body_case_and_helper_unchanged(self):
        before, after = bindings(self.old), bindings(self.controller)
        for key in ['beforeBodies', 'afterBodies', 'englishBefore', 'englishAfter',
                    'baseSource', 'candidateSource', 'baseSha', 'candidateSha']:
            self.assertEqual(before[key], after[key], key)
        self.assertEqual(len(after['beforeBodies']), 4)
        self.assertEqual(len(after['afterBodies']), 4)
        self.assertEqual(self.cases, self.old_cases)
        for key in ['scalarBefore', 'scalarAfter', 'publicValidator']:
            self.assertNotIn(key, before)
            self.assertEqual(len(parse_plpgsql(after[key]['sql'])), 1)
        self.assertEqual(after['publicValidator']['sha'], p.extension().VALIDATOR)
        old_callback, _ = p.original().project_callback(p.ROOT / self.relative.replace('/controller-', '/cases-'))
        self.assertEqual(p.extension().inverse_callback(self.callback), old_callback)

    def test_readiness_before_once_or_ports_and_exact_entry_bytes(self):
        entry = (HERE / 'entry.mjs').read_bytes().decode('utf8')
        self.assertEqual(entry, p.project_entry())
        p.admit_entry(entry)
        p.admit_entry(entry.replace('export const EXECUTION_ENABLED=false;', 'export const EXECUTION_ENABLED=true;', 1))
        for wrong in [entry.replace('\n', '\r\n'), entry + '\n']:
            with self.assertRaises(ValueError):
                p.admit_entry(wrong)
        self.assertLess(self.controller.index("assert(lockProof.ADMISSION_READY,'SCALAR_FULL_PROOF_PARITY_UNBOUND')"),
                        self.controller.index('report.dispatch_once_claim_created=true'))
        self.assertLess(self.controller.index("assert(lockProof.ADMISSION_READY,'SCALAR_FULL_PROOF_PARITY_UNBOUND')"),
                        self.controller.index('const target = await port.verifyLocalTarget()'))
        for kind, text in [('cases', self.cases), ('callback', self.callback)]:
            self.assertIn(c.sha(text.encode()), self.controller)
            self.assertIn(self.relative.replace('/controller-', '/' + kind + '-'), self.controller)
        for text in [self.controller, self.callback, self.cases]:
            result = subprocess.run(['C:/Program Files/nodejs/node.exe', '--check', '--input-type=module'],
                                    input=text, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((p.ROOT / self.relative).exists())

    def test_actual_binding_validator_with_source_definitions_and_privacy_negatives(self):
        values = bindings(self.controller)
        code = 'import assert from "node:assert/strict";import{assertSevenBindings}from ' + json.dumps((HERE / 'admit.mjs').as_uri()) + ';'
        code += 'const bindings=' + json.dumps(values) + ';assertSevenBindings(bindings);'
        code += "for(const key of ['scalarBefore','scalarAfter','publicValidator']){const bad=structuredClone(bindings);bad[key].sql+='\\n';assert.throws(()=>assertSevenBindings(bad));}"
        code += "const bad=structuredClone(bindings);bad.publicValidator.sha='0'.repeat(64);assert.throws(()=>assertSevenBindings(bad));"
        result = node(code)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
