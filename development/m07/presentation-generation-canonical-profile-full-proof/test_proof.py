"""Focused RAM-only inverse/binding/startup/refusal checks, without SQL or artifacts."""
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


p = load('profile_full_test_source', HERE / 'source.py')
c = load('profile_full_test_compiler', HERE / 'compiler.py')


def bindings(source):
    start = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    return json.JSONDecoder().raw_decode(source[start:])[0]


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.relative = '.local/presentation-generation-canonical-profile-full-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        cls.controller, cls.callback, cls.cases = c.compile_source(cls.relative)
        old_relative = cls.relative.replace(p.NAMESPACE, p.PREVIOUS_NAMESPACE)
        cls.old, cls.old_callback, cls.old_cases = p.load('profile_full_test_parent', p.OLD / 'compiler.py').compile_source(old_relative)

    def test_every_body_case_authority_and_timeout_binding_stays_exact(self):
        before, after = bindings(self.old), bindings(self.controller)
        added = {'canonicalPlannerProfile', 'canonicalPlannerReference', 'canonicalProfileFullProjection'}
        self.assertEqual(set(after) - set(before), added)
        for key, value in before.items():
            if key not in {'projectedCallback', 'projectedCallbackSha', 'projectedCases'}:
                self.assertEqual(after[key], value, key)
        self.assertEqual(self.cases, self.old_cases)
        self.assertEqual(after['canonicalPlannerProfile'], p.PROFILE)
        self.assertEqual(after['canonicalPlannerReference'], {'path': p.STATS_REF, 'sha256': p.STATS_SHA})
        self.assertEqual(self.callback.count('await observeProfile(ctx,s,tag)'), 1)
        self.assertEqual(self.callback.count("await observeProfile(ctx,observer,'before_matrix')"), 1)
        self.assertLess(self.callback.index("await observeProfile(ctx,observer,'before_matrix')"), self.callback.index('  await firstWholeGenerations(combined);'))
        self.assertTrue(after['canonicalProfileFullProjection']['inverse_byte_equal'])
        for forbidden in ['set jit=', 'set local jit=', 'ALTER SYSTEM', 'ANALYZE ']:
            self.assertNotIn(forbidden, self.callback)

    def test_only_owned_image_cmd_is_extended_and_sources_stay_default_off(self):
        self.assertEqual(self.controller.count('IMAGE, ...ownedPostgresArgs]'), 1)
        self.assertIn('lockProof.ownedPostgresCommand(image)', self.controller)
        self.assertLess(self.controller.index('lockProof.ownedPostgresCommand(image)'), self.controller.index("['container', 'create'"))
        self.assertIn("appended_args:['-c','jit=off']", self.controller)
        self.assertIn("assert(lockProof.EXECUTION_ENABLED,'CANONICAL_PROFILE_FULL_PROOF_EXECUTION_DISABLED')", self.controller)
        self.assertLess(self.controller.index("assert(lockProof.EXECUTION_ENABLED,'CANONICAL_PROFILE_FULL_PROOF_EXECUTION_DISABLED')"), self.controller.index('const target = await port.verifyLocalTarget()'))
        self.assertEqual((HERE / 'entry.mjs').read_bytes().decode(), p.project_entry())
        self.assertFalse((p.ROOT / self.relative).exists())
        for source in [self.controller, self.callback, self.cases]:
            checked = subprocess.run(['C:/Program Files/nodejs/node.exe', '--check', '--input-type=module'],
                                     input=source, text=True, capture_output=True, timeout=15)
            self.assertEqual(checked.returncode, 0, checked.stderr)

    def test_exact_entry_flag_only_and_raw_byte_compiler_boundary(self):
        closed = p.project_entry()
        armed = closed.replace('export const EXECUTION_ENABLED=false;', 'export const EXECUTION_ENABLED=true;', 1)
        p.admit_entry(closed)
        p.admit_entry(armed)
        for bad in [closed.replace('\n', '\r\n'), closed + '\n', closed.replace('assertSevenBindings', 'assertUnknownBindings')]:
            with self.assertRaises(ValueError):
                p.admit_entry(bad)
        with tempfile.TemporaryDirectory() as folder:
            temporary = Path(folder)
            (temporary / 'entry.mjs').write_bytes(closed.replace('\n', '\r\n').encode())
            with patch.object(c, 'HERE', temporary), patch.object(c, 'load', return_value=p) as loader:
                with self.assertRaises(ValueError):
                    c.compile_source(self.relative)
                self.assertEqual(loader.call_count, 1)


if __name__ == '__main__':
    unittest.main()
