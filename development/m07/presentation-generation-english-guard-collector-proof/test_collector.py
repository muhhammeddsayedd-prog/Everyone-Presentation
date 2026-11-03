"""Pure retained Context and unchanged collector-protocol projections."""
from pathlib import Path
import importlib.util
import json
import subprocess
import tempfile
import unittest
from pglast import parse_sql

HERE = Path(__file__).resolve().parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


local = module('English_guard_collector_tests', HERE / 'local.py')
m = module('English_guard_compiler_tests', HERE / 'compiler.py')
RUN = '8a400000-0000-4000-8000-000000000042'


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        file = m.MAIN / '.local/presentation-generation-raw-preimage-collector-proof/b1c52308-71af-4c26-986b-51f8715cb726/bridge-diagnose-3197ddc0-f8da-48bc-97b9-09865f15e205-input.json'
        raw = local.s.load(file)
        local.s.need(local.s.sha(raw) == 'b3539c6269048bfaac617e09a33be018f3e1955cd655742a5bf31afabfff422b')
        cls.value = json.loads(raw)

    def test_actual_owned_bind_and_false_result_still_rejected(self):
        value = self.value
        self.assertEqual(local.dispatch('check', {**value, 'observed': value['before']}), {'result': 'passed'})
        c = local.Context().bind(value['before'], value['system'], value['run'])
        with self.assertRaises(ValueError):
            c.check(value['observed'], True)
        self.assertIs(local.Context.bind.__code__, local.old.Context.bind.__code__)
        self.assertIs(local.Context.render.__code__, local.old.Context.render.__code__)
        self.assertIs(local.dispatch.__code__, local.old.dispatch.__code__)
        original = local.s.parent.Context.compatibility_sql(c)
        expected = local.s.project(original, c.targets[local.s.SIGNATURE]['before_body'])[0]
        self.assertEqual(c.compatibility_sql(), expected)

    def test_actual_renderer_parse_and_diagnostic_projection_not_new_observation(self):
        value = {**self.value, 'before': self.value['before'], 'marker': RUN}
        result = local.dispatch('render', value)
        self.assertGreater(len(parse_sql(result['sql'])), 12)
        self.assertGreater(len(parse_sql(result['diagnostic_sql'])), 12)
        self.assertEqual(result['sql'].count('commit;'), 1)
        self.assertNotIn('commit;', result['diagnostic_sql'])
        self.assertIn("case when oid=to_regprocedure('" + local.s.SIGNATURE + "')then", result['sql'])
        self.assertEqual(local.dispatch('diagnose', {**value, 'observed': result['expected']})['difference_count'], 0)
        self.assertEqual(local.dispatch('diagnose', {**value, 'observed': self.value['observed']})['difference_count'], 1)

    def test_frozen_protocol_fixture_inverse_three_syntax_and_OFF_before_ports(self):
        source, bridge, entry, proof = m.compile_source('.local/presentation-generation-collector-english-guard-compiled/controller-' + RUN + '.mjs')
        self.assertTrue(all(proof[k] for k in ('parent_controller_inverse_byte_equal', 'parent_bridge_inverse_byte_equal', 'parent_entry_inverse_byte_equal', 'only_legacy_English_source_operand_and_new_ownership_changed', 'no_fixture_DDL_or_protocol_or_bounds_change')))
        begin = source.index('const cfg=') + len('const cfg=')
        cfg, _ = json.JSONDecoder().raw_decode(source[begin:])
        self.assertEqual(cfg['snapshot_sql'], local.Context().state_sql())
        self.assertEqual(cfg['migration_sha256'], '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78')
        self.assertIn("assert.deepEqual(actualHistory.history,[...cfg.history40,'20261103031200']);", source)
        self.assertIn('presentation-generation-collector-english-guard-once', entry)
        self.assertIn('eps.genenglishguard.run', source)
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
