"""Retained failing request RED/new exact Context GREEN; no SQL execution."""
from pathlib import Path
import copy
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


local = module('raw_collector_actual_tests', HERE / 'local.py')
m = module('raw_collector_compiler_tests', HERE / 'compiler.py')
RUN = '8a300000-0000-4000-8000-000000000042'
INPUT = '.local/presentation-generation-collector-history-proof/ec829d5c-fc41-41b1-83cc-0b6e135046fb/bridge-check-7537d887-c065-4549-a32f-980c88f0425f-input.json'
INPUT_SHA = '6ce7e5ca7cb895db6a3409a12232fa2d51162e85776155956a91d9e1a28f9ce7'


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        raw = local.s.load(m.MAIN / INPUT)
        cls.raw = raw
        cls.value = json.loads(raw)
        local.s.need(local.s.sha(raw) == INPUT_SHA)

    def test_actual_retained_bridge_check_old_RED_exact_raw_GREEN_and_strict_negatives(self):
        with self.assertRaises(ValueError):
            local.old.dispatch('check', self.value)
        self.assertEqual(local.dispatch('check', self.value), {'result': 'passed'})
        self.assertIs(local.Context.bind.__code__, local.old.Context.bind.__code__)
        for name in ('eps.presentation_lock_sources(uuid,text,text)', 'eps.review_snapshot(uuid,uuid,text)', 'eps.review_snapshot_data(uuid,uuid,text)'):
            bad = copy.deepcopy(self.value)
            bad['initial']['targets'][name]['source_sha256'] = local.s.parent.manifest()[name]['before_sha256'] if name in local.s.RAW else 'f' * 64
            with self.assertRaises(ValueError):
                local.dispatch('check', bad)

    def test_actual_retained_state_render_diagnostic_and_all_seven_before_after_sources(self):
        value = {**self.value, 'before': self.value['initial'], 'marker': RUN}
        rendered = local.dispatch('render', value)
        self.assertGreater(len(parse_sql(rendered['sql'])), 12)
        self.assertGreaterEqual(len(parse_plpgsql(rendered['sql'])), 10)
        self.assertEqual(rendered['sql'].count('commit;'), 1)
        self.assertNotIn('commit;', rendered['diagnostic_sql'])
        self.assertIn("current_database()<>'project39'", rendered['sql'])
        self.assertIn("current_setting('eps.generation42collector.run',true)", rendered['sql'])
        c = local.Context().bind(self.value['initial'], self.value['system'], self.value['run'])
        self.assertEqual(c.definitions_sql().encode(), c.require_ready())
        for name, row in c.targets.items():
            self.assertEqual(rendered['expected']['targets'][name]['source_sha256'], row['after_sha256'])
        self.assertEqual(local.dispatch('diagnose', {**value, 'observed': rendered['expected']})['difference_count'], 0)

    def test_finite_frozen_protocol_projection_and_OFF_before_ports(self):
        source, bridge, entry, proof = m.compile_source('.local/presentation-generation-collector-raw-compiled/controller-' + RUN + '.mjs')
        self.assertTrue(all(proof[name] for name in ('parent_controller_inverse_byte_equal', 'parent_bridge_inverse_byte_equal', 'parent_entry_inverse_byte_equal', 'only_actual_raw_Context_and_new_ownership_changed', 'no_fixture_DDL_or_protocol_or_bounds_change')))
        begin = source.index('const cfg=') + len('const cfg=')
        cfg, _ = json.JSONDecoder().raw_decode(source[begin:])
        self.assertEqual(cfg['snapshot_sql'], local.Context().state_sql())
        self.assertEqual(cfg['migration_sha256'], '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78')
        self.assertIn("assert.deepEqual(actualHistory.history,[...cfg.history40,'20261103031200']);", source)
        self.assertIn('presentation-generation-collector-raw-once', entry)
        self.assertIn('eps.genraw.run', source)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = source.replace(Path(cfg['entry_file']).as_uri(), (root / 'entry.mjs').as_uri())
            for name, text in [('entry.mjs', entry), ('bridge.mjs', bridge), ('controller.mjs', source)]:
                file = root / name
                file.write_text(text, encoding='utf8', newline='\n')
                result = subprocess.run(['node', '--check', str(file)], capture_output=True, timeout=15)
                self.assertEqual(result.returncode, 0, 'generated syntax refused')
            script = 'const m=await import(' + json.dumps((root / 'controller.mjs').as_uri()) + ");try{await m.runRace('D:/unreachable');process.exitCode=2}catch(e){if(e.message!=='LOGO_INFO_COLLECTOR_DISABLED')process.exitCode=3}"
            result = subprocess.run(['node', '--input-type=module', '-e', script], capture_output=True, timeout=15)
            self.assertEqual(result.returncode, 0, 'OFF must refuse before target/claim/Docker')


if __name__ == '__main__':
    unittest.main()
