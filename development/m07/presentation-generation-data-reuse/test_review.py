"""Finite source/parser checks only; actual equality/security need an owned DB proof."""
from pathlib import Path
import importlib.util
import unittest
from unittest.mock import patch
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent


def module(name):
    spec = importlib.util.spec_from_file_location('data_reuse_' + name, HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


s = module('source')
r = module('review')


class Tests(unittest.TestCase):
    def setUp(self):
        self.sources = s.sources()
        self.before = self.sources['eps.review_snapshot_data']['body']
        self.after = r.patch_data_body(self.before)

    def test_exact_body_and_inverse_finite_projection(self):
        self.assertNotEqual(self.before, self.after)
        self.assertEqual(r.unpatch_data_body(self.after), self.before)
        for changed in [self.before + '\n', self.before.replace("f.status='ready'", "f.status='pending'", 1)]:
            with self.assertRaises(ValueError):
                r.patch_data_body(changed)

    def test_same_attributes_signature_and_plpgsql_parse(self):
        for name, transform in [('eps.review_snapshot_data', r.patch_data_body), ('eps.review_snapshot', r.patch_wrapper_body)]:
            record = self.sources[name]
            after = s.definition(record, transform(record['body']))
            old, new = parse_sql(record['definition'])[0].stmt, parse_sql(after)[0].stmt
            self.assertEqual(old.funcname, new.funcname)
            self.assertEqual(old.parameters, new.parameters)
            self.assertEqual(old.returnType, new.returnType)
            self.assertEqual([v for v in old.options if v.defname != 'as'], [v for v in new.options if v.defname != 'as'])
            self.assertEqual(len(parse_plpgsql(after)), 1)

    def test_only_successes_exact_keys_shared_budget_and_uncached_fallback(self):
        self.assertEqual(self.after.count('reuse_found:=found;'), 5)
        self.assertEqual(self.after.count('if reuse_found then'), 5)
        self.assertEqual(self.after.count('reuse_bytes+reuse_cost<=4194304'), 7)
        self.assertEqual(self.after.count('reuse_bytes:=reuse_bytes+reuse_cost;'), 7)
        self.assertEqual(self.after.count('pg_column_size('), 7)
        self.assertEqual(self.after.count('::text)::bigint+octet_length(reuse_key)+256'), 7)
        for query in r.LOOKUPS:
            self.assertEqual(self.after.count(query['query']), 1)
            self.assertIn(query['key'], self.after)
        self.assertIn("frame_id::text||':'||media.id::text||':'||media.source_asset_id::text", self.after)
        self.assertNotIn('jsonb_populate_record', self.after)

    def test_projection_and_issues_unmodified_outside_finite_edits(self):
        for line in self.before.splitlines():
            if any(key in line for key in ["slide:=jsonb_build_object", "inputs:=inputs||", 'fingerprint:=encode', 'return jsonb_build_object', 'REVIEW_TOO_LARGE', "reviewed:=candidate.reviewed"]):
                self.assertIn(line, self.after)
        for token in ['statement_timeout', 'set_config', 'SET ROLE', 'security definer', 'mcp_token_permits_capability']:
            self.assertNotIn(token, self.after)
        self.assertEqual(self.after.count('eps.review_issue('), self.before.count('eps.review_issue('))
        self.assertEqual(self.after.count('eps.fail('), self.before.count('eps.fail('))

    def test_roles_slots_and_category_fallback_preserve_original_casts(self):
        self.assertIn('if reuse_roles_complete then', self.after)
        self.assertIn('if reuse_roles_complete and reuse_slots_complete then', self.after)
        for query in [r.ROLE_INPUTS, r.SLOT_INPUTS]:
            self.assertEqual(self.after.count(query), 1)
        self.assertIn("else (select r.category from eps.roles r where r.id=(v->>'role_id')::uuid)end", self.after)
        self.assertIn("from unnest(reuse_roles)r where r.id=(v->>'role_id')::uuid", self.after)
        self.assertNotIn('array_agg', self.after)

    def test_final_wrapper_rechecks_scope_clock_without_caching_authority(self):
        before = self.sources['eps.review_snapshot']['body']
        after = r.patch_wrapper_body(before)
        self.assertEqual(after.count('eps.review_snapshot_data('), 1)
        self.assertEqual(after.count('eps.review_require(p_workspace)'), 2)
        self.assertEqual(after.count("eps.require_capability('cast.read')"), 2)
        self.assertLess(after.index('data:=eps.review_snapshot_data'), after.rindex('eps.review_require'))
        self.assertLess(after.rindex("eps.require_capability('cast.read')"), after.index('return data;'))
        with self.assertRaises(ValueError):
            r.patch_wrapper_body(before + ' ')

    def test_source_drift_fails_without_payload_output(self):
        with patch.object(s, 'BACKUP_SHA', '0' * 64):
            with self.assertRaisesRegex(ValueError, '^GENERATION_DATA_REUSE_SOURCE_UNCONFIRMED$'):
                s.sources()


if __name__ == '__main__':
    unittest.main()
