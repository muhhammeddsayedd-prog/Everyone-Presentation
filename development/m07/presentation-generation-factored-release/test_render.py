"""Complete SQL sharing, exact guards/migration and OFF normal transport."""
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


s = module('factor42_state_tests', HERE / 'state.py')
r = module('factor42_phase_tests', HERE / 'release.py')
RUN = '8a500000-0000-4000-8000-000000000042'


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        file = s.MAIN / '.local/presentation-generation-english-guard-collector-proof/89fbfcc7-41a8-4cb5-ae9e-08148ed461a7/before-checkpoint.json'
        raw = s.load(file)
        s.need(s.sha(raw) == '8c784480305370e077c1625928cbe3faaae82c701d4e74e5bf78cb45b05c69d9')
        cls.before = json.loads(raw)['state']
        cls.c = s.Context(root=s.MAIN, source=s.MAIN)
        local = module('factor42_accepted_owned_context', s.MAIN / 'development/m07/presentation-generation-english-guard-collector-proof/local.py')
        cls.c.current = local.old.old.Canonical41Owned(root=s.MAIN, source=s.MAIN)
        cls.c.current.bind_installed(cls.before['canonical41'], '123456789', RUN)

    def test_same_state_once_both_typed_guards_exact_DDL_history_tail_and_parse(self):
        normal, diagnostic, proof = self.c.rendering(self.before, RUN)
        query = self.c.state_sql()
        self.assertEqual(normal.count(query), 1)
        self.assertEqual(diagnostic.count(query), 2)
        self.assertEqual(normal.count('execute g42_state_query into observed;'), 2)
        self.assertEqual(normal.count("raise exception'GENERATION42_PREIMAGE_CHANGED'"), 1)
        self.assertEqual(normal.count("raise exception'GENERATION42_POSTIMAGE_CHANGED'"), 1)
        self.assertIn('g42_before constant jsonb:=', normal)
        self.assertIn('g42_after constant jsonb:=', normal)
        match = re.search(r'g42_state_query constant text:=(\$g42_state_[a-f0-9]+\$)(.*?)\1;observed', normal, re.S)
        self.assertIsNotNone(match)
        self.assertEqual(match[2], query)
        self.assertEqual(s.sha(match[2].encode()), proof['complete_state_query_sha256'])
        self.assertEqual(normal.count(self.c.definitions_sql()), 1)
        self.assertEqual(proof['migration_sha256'], '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78')
        self.assertEqual(normal.count('insert into supabase_migrations.schema_migrations'), 1)
        self.assertEqual(normal.count('commit;select jsonb_build_object'), 1)
        self.assertNotIn('commit;', diagnostic)
        self.assertNotIn('GENERATION42_POSTIMAGE_CHANGED', diagnostic)
        self.assertTrue(proof['original_render_inverse_byte_equal'])
        self.assertTrue(proof['same_prefix_seven_DDL_history_and_commit_tail'])
        self.assertLess(proof['factored_SQL_bytes'], proof['original_SQL_bytes'])
        self.assertLess(len(normal.encode()), s.MAXIMUM)
        self.assertGreater(len(parse_sql(normal)), 7)
        self.assertGreaterEqual(len(parse_plpgsql(normal)), 2)
        self.assertGreater(len(parse_sql(diagnostic)), 7)
        self.assertGreaterEqual(len(parse_plpgsql(diagnostic)), 2)

    def test_tag_collision_refuses_and_original_security_does_not_change(self):
        query = 'select 1 /*$g42_state_' + 'f' * 24 + '$*/'
        with patch.object(self.c, 'state_sql', return_value=query), patch.object(s, 'sha', return_value='f' * 64):
            with self.assertRaises(ValueError):
                self.c.render(self.before, RUN)
        self.assertEqual(self.c.compatibility_sql(), s.parent.Context.compatibility_sql(self.c))
        self.assertTrue(self.c.admission()['candidate_seven_definitions_unchanged'])

    def test_same_normal_phase_bytecode_guarded_loader_bounds_and_OFF(self):
        self.assertFalse(r.READ_ENABLED or r.APPLY_ENABLED)
        self.assertIs(s.module, s.parent.module)
        for name in ('query', 'prepare', 'apply', 'reconcile'):
            self.assertIs(getattr(r.Base, name).__code__, getattr(r.old.Base, name).__code__)
            self.assertIs(getattr(r.Base, name).__globals__['s'], r.s)
        op = r.Release.__new__(r.Release)
        op.c = self.c
        for name in ('prepare', 'apply', 'reconcile', 'snapshot', 'admission'):
            with self.assertRaises(ValueError):
                getattr(op, name)()
        self.assertEqual(s.MAXIMUM, s.parent.MAXIMUM)


if __name__ == '__main__':
    unittest.main()
