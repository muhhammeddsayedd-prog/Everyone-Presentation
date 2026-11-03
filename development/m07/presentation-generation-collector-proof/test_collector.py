"""Focused pure compiler/Context checks; no DB, Docker, claims or providers."""
from pathlib import Path
import importlib.util
import json
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from pglast import parse_sql

HERE = Path(__file__).resolve().parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


m = module('generation42_collector_tests', HERE / 'compiler.py')
RUN = '8a100000-0000-4000-8000-000000000042'


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source, cls.bridge, cls.entry, cls.proof = m.compile_source('.local/presentation-generation-collector-compiled/controller-' + RUN + '.mjs')
        start = cls.source.index('const cfg=') + len('const cfg=')
        cls.cfg, _ = json.JSONDecoder().raw_decode(cls.source[start:])

    def test_full_inverse_new_ownership_and_accepted41_fixture_before_baseline(self):
        for key in ('parent_controller_inverse_byte_equal', 'parent_entry_inverse_byte_equal', 'parent_bridge_inverse_byte_equal', 'accepted41_declared_before_clone_baseline', 'actual_seven_target_Context'):
            self.assertTrue(self.proof[key])
        self.assertFalse(self.proof['transport_or_bounds_changed'])
        self.assertIn('presentation-generation-collector-once', self.entry)
        self.assertIn('eps.generationcollector.run', self.source)
        self.assertIn('eps.generation42collector.run', self.entry)
        self.assertIn('GENERATION42_PREIMAGE_CHANGED', self.entry)
        self.assertIn('changed.canonical41.compatibility.schema40', self.entry)
        self.assertIn('ctx.report.final_history_count = 42;', self.entry)
        fixture = self.source.index('let migration41=')
        baseline = self.source.index('await sql(snapshot);report.declared_owned_fixture=')
        self.assertLess(fixture, baseline)
        self.assertEqual(self.cfg['version'], '20261103104337')
        self.assertEqual(self.cfg['migration_sha256'], '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78')

    def test_actual_seven_queries_and_migration_are_not_logo_only(self):
        local = module('generation42_collector_query_tests', HERE / 'local.py')
        c = local.Context()
        self.assertEqual(len(c.targets), 7)
        self.assertEqual(len(parse_sql(self.cfg['snapshot_sql'])), 1)
        self.assertEqual(len(parse_sql(self.cfg['checkpoint_sql'])), 1)
        self.assertEqual(self.cfg['snapshot_sql'], c.state_sql())
        self.assertIn('generation42_history41', self.cfg['snapshot_sql'])
        self.assertIn('to_jsonb(2::bigint)', self.cfg['snapshot_sql'])
        self.assertNotIn('to_jsonb(3::bigint)', self.cfg['snapshot_sql'])
        self.assertEqual(c.admission()['local_proof'], local.s.REMAINING_PROOF_REF)
        self.assertEqual(len(parse_sql(c.definitions_sql())), 7)

    def test_owned_binding_checks_installed41_before_new42_not_logo_preimage40(self):
        local = module('generation42_owned41_binding_tests', HERE / 'local.py')
        c = local.Canonical41Owned()
        before = {'compatibility': {'schema40': {'canonical': {'base': {'data': {'oauth_consent_claims': {'count': 2}}}}}}}
        checked = []
        class Qualification:
            def __init__(self, **_kw):
                pass
            def bind_current(self, *_args):
                return self
        class State:
            def __init__(self, *_args, **_kw):
                pass
        with patch.object(local.qualification, 'OwnedContext', Qualification), patch.object(local.qualification.m, 'State', State), patch.object(c, 'check', side_effect=lambda value, installed: checked.append((value, installed))):
            c.bind_installed(before, '123456789', RUN)
        self.assertEqual(checked, [(before, True)])
        with self.assertRaises(ValueError):
            c.bind_installed(before, local.qualification.ORIGINAL_SYSTEM, RUN)

    def test_actual_entry_bytes_before_compiler_load_and_unbound_configuration_refusal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'entry.mjs').write_bytes(m.ENTRY.replace(b'\n', b'\r\n'))
            with patch.object(m, 'HERE', root), patch.object(m, 'module', side_effect=AssertionError('inherited compiler reached')):
                with self.assertRaises(ValueError):
                    m.compile_source('.local/presentation-generation-collector-compiled/controller-' + RUN + '.mjs')
        local = module('generation42_unbound_collector_tests', HERE / 'local.py')
        with patch.object(local.s, 'READY', False):
            with self.assertRaises(ValueError):
                local.configuration()

    def test_generated_three_scripts_and_OFF_controller_refuses_before_ports(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            entry = root / 'entry.mjs'
            source = self.source.replace(Path(self.cfg['entry_file']).as_uri(), entry.as_uri())
            for name, text in [('entry.mjs', self.entry), ('bridge.mjs', self.bridge), ('controller.mjs', source)]:
                file = root / name
                file.write_text(text, encoding='utf8', newline='\n')
                result = subprocess.run(['node', '--check', str(file)], capture_output=True, text=True, timeout=15)
                self.assertEqual(result.returncode, 0, 'generated script syntax refused')
            script = 'const m=await import(' + json.dumps((root / 'controller.mjs').as_uri()) + ");try{await m.runRace('D:/unreachable');process.exitCode=2}catch(e){if(e.message!=='LOGO_INFO_COLLECTOR_DISABLED')process.exitCode=3}"
            result = subprocess.run(['node', '--input-type=module', '-e', script], capture_output=True, text=True, timeout=15)
            self.assertEqual(result.returncode, 0, 'OFF controller must refuse before target/claim/Docker')


if __name__ == '__main__':
    unittest.main()
