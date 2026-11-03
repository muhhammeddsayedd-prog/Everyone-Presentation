"""Exact predicate inverse and real retained Context guards; no SQL execution."""
from pathlib import Path
import copy
import importlib.util
import json
import unittest
from pglast import parse_sql

HERE = Path(__file__).resolve().parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


s = module('English_guard_state_tests', HERE / 'state.py')
r = module('English_guard_phase_tests', HERE / 'release.py')


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        file = s.MAIN / '.local/presentation-generation-raw-preimage-collector-proof/b1c52308-71af-4c26-986b-51f8715cb726/bridge-diagnose-3197ddc0-f8da-48bc-97b9-09865f15e205-input.json'
        raw = s.load(file)
        s.need(s.sha(raw) == 'b3539c6269048bfaac617e09a33be018f3e1955cd655742a5bf31afabfff422b')
        cls.value = json.loads(raw)
        cls.local = module('English_guard_accepted_owned_Context', s.MAIN / 'development/m07/presentation-generation-raw-preimage-collector-proof/local.py')
        cls.c = s.Context(root=s.MAIN, source=s.MAIN)
        cls.c.current = cls.local.old.Canonical41Owned(root=s.MAIN, source=s.MAIN)
        cls.c.current.bind_installed(cls.value['before']['canonical41'], cls.value['system'], cls.value['run'])

    def test_exact_one_operand_inverse_preserves_all_remaining_security_terms(self):
        original = s.parent.Context.compatibility_sql(self.c)
        after, replacement = s.project(original, self.c.targets[s.SIGNATURE]['before_body'])
        self.assertEqual(after, self.c.compatibility_sql())
        self.assertEqual(original.count(s.ANCHOR), 1)
        self.assertEqual(after.count(replacement), 1)
        self.assertEqual(after.replace(replacement, s.ANCHOR, 1), original)
        self.assertIn('else prosrc end', replacement)
        self.assertNotIn('then true', replacement)
        for signature in ('eps.english_transcript_text_valid(text)', 'eps.validate_candidate_english_transcript(eps.jobs,text,jsonb,jsonb)', 'eps.presentation_video_english_transcript(uuid,uuid)'):
            term = "oid=to_regprocedure('" + signature + "')"
            self.assertGreaterEqual(original.count(term), 1)
            self.assertEqual(after.count(term), original.count(term))
        self.assertEqual(len(parse_sql(self.c.state_sql())), 1)
        self.assertEqual(len(parse_sql(self.c.checkpoint_sql())), 1)
        self.assertEqual(s.sha(self.c.definitions_sql().encode()), '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78')
        for bad in [original.replace(s.SIGNATURE, 'eps.wrong_target(uuid)'), original.replace(s.ANCHOR, s.ANCHOR.replace("proowner='eps_review_owner'", "proowner='eps_guest_owner'"))]:
            with self.assertRaises(ValueError):
                s.project(bad, self.c.targets[s.SIGNATURE]['before_body'])

    def test_retained_actual_false_not_waived_and_wrong_target_owner_ACL_denied(self):
        before = self.value['before']
        self.c.check(before, False)
        # The actual old diagnostic remains rejected. This test does not claim
        # that the new SQL was executed or relabel false as an observed success.
        with self.assertRaises(ValueError):
            self.c.check(self.value['observed'], True)
        expected = self.c.expected(before)
        differences = self.local.old.qualification.differing_paths(expected, self.value['observed'])
        self.assertEqual([item['path'] for item in differences], ['$.canonical41.compatibility.schema40.canonical.base.english.security'])
        self.assertTrue(all(self.c.transition(before, expected).values()))
        mutations = [
            lambda value: value['targets'][s.SIGNATURE].__setitem__('source_sha256', 'f' * 64),
            lambda value: value['targets'][s.SIGNATURE]['identity'].__setitem__('proowner', 999999),
            lambda value: value['targets'][s.SIGNATURE]['identity'].__setitem__('proacl', ['PUBLIC=X/owner']),
            lambda value: value['canonical41']['compatibility']['schema40']['canonical']['base']['english'].__setitem__('security', False),
        ]
        for mutate in mutations:
            bad = copy.deepcopy(expected)
            mutate(bad)
            with self.assertRaises(ValueError):
                self.c.transition(before, bad)

    def test_normal_phase_bytecode_globals_and_OFF_before_ports(self):
        self.assertFalse(r.READ_ENABLED or r.APPLY_ENABLED)
        self.assertIs(s.module, s.parent.module)
        for name in ('query', 'prepare', 'apply', 'reconcile'):
            self.assertIs(getattr(r.Base, name).__code__, getattr(r.old.Base, name).__code__)
            self.assertIs(getattr(r.Base, name).__globals__['s'], r.s)
        for name in ('response_binding', 'worker', 'compare_checkpoints', 'admission'):
            self.assertIs(getattr(r.Phase, name).__code__, getattr(r.old.Phase, name).__code__)
            self.assertIs(getattr(r.Phase, name).__globals__['s'], r.s)
        op = r.Release.__new__(r.Release)
        op.c = self.c
        for name in ('prepare', 'apply', 'reconcile', 'snapshot', 'admission'):
            with self.assertRaises(ValueError):
                getattr(op, name)()


if __name__ == '__main__':
    unittest.main()
