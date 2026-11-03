"""Passed owned metadata and factored render pair; no runtime SQL execution."""
from pathlib import Path
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


local = module('factored_collector_context_tests', HERE / 'local.py')
m = module('factored_collector_compiler_tests', HERE / 'compiler.py')
RUN = '8a600000-0000-4000-8000-000000000042'


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        file = m.MAIN / '.local/presentation-generation-english-guard-collector-proof/89fbfcc7-41a8-4cb5-ae9e-08148ed461a7/bridge-check-456f305f-1378-4499-8561-f12da00676c8-input.json'
        raw = local.s.load(file)
        local.s.need(local.s.sha(raw) == '6c85840c272ea786a7e826a5c48de18ac63e01533196244ed0c15ded3a8966f1')
        cls.value = json.loads(raw)

    def test_same_actual_check_bind_diagnose_and_qualified_factored_render_pair(self):
        value = self.value
        self.assertEqual(local.dispatch('check', value), {'result': 'passed'})
        c = local.Context().bind(value['initial'], value['system'], value['run'])
        before = value['initial']
        rendered = local.dispatch('render', {**value, 'before': before, 'marker': RUN})
        query = c.state_sql()
        self.assertEqual(rendered['sql'].count(query), 1)
        self.assertEqual(rendered['sql'].count('execute g42_state_query into observed;'), 2)
        self.assertEqual(rendered['diagnostic_sql'].count(query), 2)
        self.assertNotIn('commit;', rendered['diagnostic_sql'])
        self.assertIn("current_database()<>'project39'", rendered['sql'])
        self.assertIn("current_setting('eps.generation42collector.run',true)", rendered['sql'])
        self.assertGreater(len(parse_sql(rendered['sql'])), 7)
        self.assertGreaterEqual(len(parse_plpgsql(rendered['sql'])), 2)
        self.assertGreater(len(parse_sql(rendered['diagnostic_sql'])), 7)
        self.assertEqual(local.dispatch('diagnose', {**value, 'before': before, 'observed': rendered['expected']})['difference_count'], 0)
        self.assertIs(local.Context.bind.__code__, local.old.Context.bind.__code__)
        self.assertIs(local.prior_dispatch.__code__, local.old.dispatch.__code__)
        _, _, proof = local.s.Context.rendering(c, before, RUN)
        self.assertLess(proof['factored_SQL_bytes'], proof['original_SQL_bytes'])

    def test_snapshot_checkpoint_protocol_inverse_three_syntax_and_OFF_before_ports(self):
        source, bridge, entry, proof = m.compile_source('.local/presentation-generation-collector-factored-compiled/controller-' + RUN + '.mjs')
        self.assertTrue(all(proof[k] for k in ('parent_controller_inverse_byte_equal', 'parent_bridge_inverse_byte_equal', 'parent_entry_inverse_byte_equal', 'only_renderer_and_new_ownership_changed', 'no_fixture_DDL_or_protocol_or_bounds_change')))
        begin = source.index('const cfg=') + len('const cfg=')
        cfg, _ = json.JSONDecoder().raw_decode(source[begin:])
        old = local.old.configuration()
        self.assertEqual(cfg['snapshot_sql'], old['snapshot_sql'])
        self.assertEqual(cfg['checkpoint_sql'], old['checkpoint_sql'])
        self.assertEqual(cfg['migration_sha256'], '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78')
        self.assertIn('presentation-generation-collector-factored-once', entry)
        self.assertIn('eps.genfactored.run', source)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = source.replace(Path(cfg['entry_file']).as_uri(), (root / 'entry.mjs').as_uri())
            for name, text in [('controller.mjs', source), ('bridge.mjs', bridge), ('entry.mjs', entry)]:
                file = root / name
                file.write_text(text, encoding='utf8', newline='\n')
                result = subprocess.run(['node', '--check', str(file)], capture_output=True, timeout=15)
                self.assertEqual(result.returncode, 0, 'generated syntax refused')
            script = 'const m=await import(' + json.dumps((root / 'controller.mjs').as_uri()) + ");try{await m.runRace('D:/unreachable');process.exitCode=2}catch(e){if(e.message!=='LOGO_INFO_COLLECTOR_DISABLED')process.exitCode=3}"
            result = subprocess.run(['node', '--input-type=module', '-e', script], capture_output=True, timeout=15)
            self.assertEqual(result.returncode, 0, 'OFF before ports')


if __name__ == '__main__':
    unittest.main()
