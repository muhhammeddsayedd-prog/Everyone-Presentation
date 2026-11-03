"""Source/parser/inverse/default-off proof checks. Never run SQL or Docker."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
import unittest
import uuid

from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


s = load('assignment_proof_tests_source', HERE / 'source.py')
c = load('assignment_proof_tests_compiler', HERE / 'compiler.py')


class Tests(unittest.TestCase):
    def test_frozen_entry_and_matrix_finite_projection(self):
        self.assertEqual((HERE / 'entry.mjs').read_text(), s.project_entry())
        self.assertEqual((HERE / 'matrix.mjs').read_text(), s.project_matrix())
        old = (s.OLD / 'cases.mjs').read_text()
        after = s.project_matrix()
        self.assertEqual(old[old.index('export async function projectionEqualities'):], after[after.index('export async function projectionEqualities'):])
        self.assertIn("[{variant:'candidate',mode:'mcp',label:'large'}", after)
        self.assertIn("filter(x=>!(x.variant==='candidate'&&x.mode==='mcp'&&x.label==='large'))", after)
        self.assertEqual(after.count('first_application_call'), old.count('first_application_call'))

    def test_callback_guards_and_original_combined_security_restore_calls(self):
        source, proof = s.project_callback(ROOT / '.local/no-write-cases.mjs')
        self.assertTrue(proof['inverse_byte_equal'])
        self.assertTrue(proof['candidate_MCP_large_first_exactly_once_then_remaining_seven'])
        old, _ = s.original().project_callback(ROOT / '.local/no-write-cases.mjs')
        for call in ['await firstWholeGenerations(combined);', 'await projectionEqualities(combined);', 'await missingFrameEquality(combined);', 'await verifyDataReuseCases(', 'await changedSourceRaces(context);', 'assertDataReuseEquality(', 'COMBINED_FINAL_BASELINE_CHANGED']:
            self.assertEqual(source.count(call), old.count(call))
        self.assertLess(source.index('await firstWholeGenerations(combined)'), source.index('await projectionEqualities(combined)'))
        self.assertLess(source.index('await projectionEqualities(combined)'), source.index('await verifyAssignmentCases('))
        self.assertIn('await install(ctx.bindings.originalLockSource,ctx.bindings.beforeBodies)', source)
        self.assertIn('original_presentation_config_restored=true', source)
        start = source.index('const assignmentFK=await value(') + len('const assignmentFK=await value(')
        sql, _ = json.JSONDecoder().raw_decode(source[start:])
        self.assertEqual(len(parse_sql(sql)), 1)
        for needle in ["conrelid='eps.assignments'::regclass", "confrelid='eps.slots'::regclass", 'convalidated', 'condeferrable', 'condeferred', 'conkey=ARRAY[', 'confkey=ARRAY[']:
            self.assertIn(needle, sql)
        self.assertIn("attname='workspace_id'),(select attnum from pg_attribute where attrelid='eps.assignments'::regclass and attname='slot_id')", sql)
        self.assertIn("attname='workspace_id'),(select attnum from pg_attribute where attrelid='eps.slots'::regclass and attname='id')", sql)

    def test_compile_three_sealed_artifacts_new_purpose_only(self):
        relative='.local/presentation-generation-assignment-proof-compiled/controller-' + str(uuid.UUID('00000000-0000-4000-8000-000000000001')) + '.mjs'
        controller, callback, cases = c.compile_source(relative)
        for text in [controller, callback, cases]:
            result = subprocess.run(['node', '--check', '--input-type=module'], input=text, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("'.local/presentation-generation-assignment-proof-once'", controller)
        self.assertIn("'eps.assignproof.run'", controller)
        self.assertNotIn('label=eps.combinedproof.run=', controller)
        self.assertIn('0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd', controller)
        self.assertIn('candidate_MCP_large_first_exactly_once_then_remaining_seven', controller)
        self.assertIn('report.dispatch_once_claim_created=true', controller)
        self.assertLess(controller.index('report.dispatch_once_claim_created=true'), controller.index('const target = await port.verifyLocalTarget()'))
        for kind, text in [('callback', callback), ('cases', cases)]:
            self.assertIn(hashlib.sha256(text.encode()).hexdigest(), controller)
            self.assertIn(relative.replace('/controller-', '/'+kind+'-'), controller)

    def test_new_temp_helper_SQL_and_private_fallback_fixture_inputs(self):
        sql = (HERE / 'assignment-cases.sql').read_text()
        self.assertEqual(len(parse_sql(sql)), 1)
        self.assertEqual(len(parse_plpgsql(sql)), 1)
        self.assertIn('security invoker', sql)
        self.assertIn("current_setting('statement_timeout')<>'8s'", sql)
        self.assertIn('s:=eps.review_snapshot(p_workspace,p_series,null);', sql)
        self.assertNotIn('security definer', sql)
        text = (HERE / 'assignment-cases.mjs').read_text()
        for token in ['internal_notes=', 'over_shared_budget', 'shortlist_excluded_main', 'shortlist_included_main', 'shortlist_empty', 'eps_create_presentation_series(', 'empty_tail_expiry', 'lock table eps.specs in access exclusive mode', 'observePending(contender.request(', 'full_baseline_restored=true']:
            self.assertIn(token, text)
        self.assertNotIn('disable trigger', text.lower())
        self.assertNotIn('update eps.presentation_versions', text.lower())
        self.assertIn("record.observation=only(await ctx.holder.request(observe(profile)));record.normal_return=true;\n  safeResult(record.observation);", text)
        self.assertIn("if(ctx.variant==='candidate'){assert.equal(record.result.ok,false)", text)

    def test_default_off_before_context_or_transport(self):
        result = subprocess.run(['node', '--input-type=module', '-e', f'import {{runCases}} from {json.dumps((HERE/"entry.mjs").as_uri())};await runCases({{}});'], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('ASSIGNMENT_PROOF_EXECUTION_DISABLED', result.stderr)
        self.assertEqual(result.stdout, '')
        self.assertIn('export const EXECUTION_ENABLED=false;', (HERE / 'entry.mjs').read_text())
        self.assertNotIn('exec(', (HERE / 'compiler.py').read_text())


if __name__ == '__main__':
    unittest.main()
