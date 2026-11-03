"""Execute the real JS history guard offline; never invoke an owned runtime."""
from pathlib import Path
import importlib.util
import json
import subprocess
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('generation_history_tests', HERE / 'compiler.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.runtime_id = '8a300000-0000-4000-8000-000000000042'
        cls.source, cls.bridge, cls.entry, cls.proof = m.compile_source('.local/presentation-generation-collector-history-compiled/controller-' + cls.runtime_id + '.mjs')
        start = cls.source.index('const cfg=') + len('const cfg=')
        cls.cfg, _ = json.JSONDecoder().raw_decode(cls.source[start:])

    def test_actual_old_guard_RED_new_post41_guard_GREEN_and_wrong_histories_refuse(self):
        code = 'import assert from "node:assert/strict";const cfg=' + json.dumps({'history40': self.cfg['history40']}) + ';'
        code += 'const oldGuard=new Function("actualHistory","cfg","assert",' + json.dumps(m.OLD_GUARD) + ');'
        code += 'const guard=new Function("actualHistory","cfg","assert",' + json.dumps(m.NEW_GUARD) + ');'
        code += "const correct=[...cfg.history40,'20261103031200'];oldGuard({history:cfg.history40},cfg,assert);assert.throws(()=>oldGuard({history:correct},cfg,assert));guard({history:correct},cfg,assert);"
        code += "for(const wrong of[cfg.history40,[...cfg.history40,'20261103104337'],[...correct,'20261103104337'],[...correct,'unexpected'],[...correct].reverse()])assert.throws(()=>guard({history:wrong},cfg,assert));"
        value = subprocess.run(['node', '--input-type=module'], input=code, text=True, capture_output=True, timeout=15)
        self.assertEqual(value.returncode, 0, value.stderr)

    def test_only_postfixture_expectation_metadata_and_fresh_ownership_change(self):
        self.assertTrue(self.proof['parent_controller_inverse_byte_equal'])
        self.assertTrue(self.proof['parent_bridge_inverse_byte_equal'])
        self.assertTrue(self.proof['parent_entry_inverse_byte_equal'])
        self.assertTrue(self.proof['pre41_guards_Context_SQL_and_bounds_unchanged'])
        self.assertEqual(len(self.cfg['history40']), 40)
        self.assertEqual(self.cfg['history40'][-1], '20261102085405')
        self.assertIn(m.NEW_GUARD, self.source)
        self.assertNotIn(m.OLD_GUARD, self.source)
        self.assertIn(m.NEW_META, self.source)
        self.assertNotIn(m.OLD_META, self.source)
        self.assertLess(self.source.index('let migration41='), self.source.index(m.NEW_GUARD))
        self.assertEqual(self.cfg['version'], '20261103104337')
        self.assertIn(str(m.OLD / 'local.py').replace('\\', '/'), self.bridge)
        self.assertIn('presentation-generation-collector-history-once', self.entry)
        self.assertIn('tracking/evidence/m07/presentation-generation-collector-proof/history-successor', self.source)
        for text in (self.source, self.bridge, self.entry):
            value = subprocess.run(['node', '--check', '--input-type=module'], input=text, text=True, capture_output=True, timeout=15)
            self.assertEqual(value.returncode, 0, value.stderr)

    def test_default_OFF_controller_and_raw_byte_entry_admission(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'entry.mjs').write_bytes(m.ENTRY.replace(b'\n', b'\r\n'))
            with patch.object(m, 'HERE', root), patch.object(m, 'module', side_effect=AssertionError('parent compiler reached')):
                with self.assertRaises(ValueError):
                    m.compile_source('.local/presentation-generation-collector-history-compiled/controller-' + self.runtime_id + '.mjs')
            entry = root / 'entry.mjs'
            entry.write_text(self.entry, encoding='utf8', newline='\n')
            controller = root / 'controller.mjs'
            controller.write_text(self.source.replace(Path(self.cfg['entry_file']).as_uri(), entry.as_uri()), encoding='utf8', newline='\n')
            code = 'const m=await import(' + json.dumps(controller.as_uri()) + ");try{await m.runRace('D:/unreachable');process.exitCode=2}catch(e){if(e.message!=='LOGO_INFO_COLLECTOR_DISABLED')process.exitCode=3}"
            value = subprocess.run(['node', '--input-type=module', '-e', code], capture_output=True, text=True, timeout=15)
            self.assertEqual(value.returncode, 0, 'default OFF must refuse before any target/claim/Docker access')


if __name__ == '__main__':
    unittest.main()
