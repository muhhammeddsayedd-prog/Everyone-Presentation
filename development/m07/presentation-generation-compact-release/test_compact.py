"""Closed token lift, real canonical bytes, Unicode spans and OFF phases."""
from pathlib import Path
import importlib.util
import json
import re
import unittest
from unittest.mock import patch
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


s = module('compact42_state_tests', HERE / 'state.py')
r = module('compact42_phase_tests', HERE / 'release.py')
RUN = '8a700000-0000-4000-8000-000000000042'


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = s.Context(root=s.MAIN, source=s.MAIN)
        cls.query = cls.c.original_state_sql()
        cls.compact, cls.proof = s.lift(cls.query, cls.c.targets)
        root = s.MAIN / '.local/presentation-generation-factored-release/92b626cc-2b56-4850-b9e8-9803cf969898'
        cls.before = json.loads(s.load(root / 'plan.json'))['before']
        cls.actual_SQL = s.load(root / 'apply-d19aa597-8702-47c3-826c-db45ed709855.sql').decode('utf8')
        s.need(s.sha(cls.actual_SQL.encode()) == '2d309299e2bef2ef6fc03323596979967948144ada579895109638d124d82341')

    def test_exact519_literals_types_inverse_and_large_measured_margin(self):
        self.assertEqual(len(self.query.encode()), 2978393)
        self.assertEqual(self.proof['exact_token_replacements'], 519)
        self.assertEqual(sorted(self.proof['literal_counts'].values()), [74] * 6 + [75])
        self.assertTrue(self.proof['inverse_original_UTF8_byte_equal'])
        self.assertTrue(self.proof['non_token_bytes_and_outer_text_casts_unchanged'])
        self.assertEqual(len(parse_sql(self.compact)), 1)
        normal, diagnostic, _ = self.c.rendering(self.before, RUN)
        self.assertEqual(normal.count(self.compact), 1)
        self.assertLess(len(normal.encode()), len(self.actual_SQL.encode()) // 4)
        for variable, end in [('g42_before', ';g42_after'), ('g42_after', ';begin')]:
            pattern = variable + r' constant jsonb:=(.*?)' + re.escape(end)
            old = re.search(pattern, self.actual_SQL, re.S)
            new = re.search(pattern, normal, re.S)
            self.assertIsNotNone(old)
            self.assertEqual(old[1], new[1])
        self.assertEqual(len(parse_plpgsql(normal)), 2)
        self.assertGreater(len(parse_sql(diagnostic)), 7)
        self.assertEqual(self.c.require_ready(), self.c.definitions_sql().encode())
        self.assertEqual(s.sha(self.c.definitions_sql().encode()), '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78')

    def test_Unicode_byte_mapping_collision_wrong_type_and_wrong_token_refuse(self):
        query = self.query[:5] + '/* Ω العربية */' + self.query[5:]
        lifted, proof = s.lift(query, self.c.targets)
        self.assertTrue(proof['inverse_original_UTF8_byte_equal'])
        self.assertIn('/* Ω العربية */', lifted)
        self.assertEqual(len(parse_sql(lifted)), 1)
        with patch.object(s, 'cte_name', return_value='generation42_history41'):
            with self.assertRaises(ValueError):
                s.lift(self.query, self.c.targets)
        body = next(iter(self.c.targets.values()))['before_body']
        term = s.literal(body)
        for changed in (self.query.replace(term + '::text', term + '::jsonb', 1), self.query.replace(term, s.literal(body + ' '), 1)):
            with self.assertRaises(ValueError):
                s.lift(changed, self.c.targets)

    def test_same_factored_render_normal_CLI_guarded_loader_and_OFF(self):
        self.assertIs(s.Context.render.__code__, s.parent.Context.render.__code__)
        self.assertIs(s.module, s.parent.module)
        self.assertFalse(r.READ_ENABLED or r.APPLY_ENABLED)
        for name in ('query', 'prepare', 'apply', 'reconcile'):
            self.assertIs(getattr(r.Base, name).__code__, getattr(r.old.Base, name).__code__)
            self.assertIs(getattr(r.Base, name).__globals__['s'], r.s)
        op = r.Release.__new__(r.Release)
        op.c = self.c
        for name in ('prepare', 'apply', 'reconcile', 'snapshot', 'admission'):
            with self.assertRaises(ValueError):
                getattr(op, name)()
        self.assertEqual(self.c.admission()['second_413_not_applied_reconciliation'], s.RECONCILIATION)


if __name__ == '__main__':
    unittest.main()
