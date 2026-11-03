"""Finite-inverse/security/parser/ownership checks only; no SQL/Docker dispatch."""
from pathlib import Path
import importlib.util
import json
import re
import subprocess
import unittest

from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


i = load('stage_test_instrument', HERE / 'instrument.py')
s = load('stage_test_source', HERE / 'source.py')
c = load('stage_test_compiler', HERE / 'compiler.py')


class Tests(unittest.TestCase):
    def test_only_two_bodies_notices_inverse_unchanged_attributes_and_line_counts(self):
        rows = i.build()
        self.assertEqual([x['name'] for x in rows if x['instrumented']], ['eps.review_snapshot_data', 'public.eps_generate_version'])
        normal = load('stage_test_normal_candidate', HERE.parent / 'presentation-generation-assignment-reuse/candidate.py').build()
        base = load('stage_test_frozen_four', HERE.parent / 'presentation-generation-data-reuse/build.py').build()
        for row in rows:
            previous = normal['after'] if row['name'] == 'eps.review_snapshot_data' else next(x['after'] for x in base if x['name'] == row['name'])
            before, after = parse_sql(previous)[0].stmt, parse_sql(row['after'])[0].stmt
            self.assertEqual(before.funcname, after.funcname)
            self.assertEqual(before.parameters, after.parameters)
            self.assertEqual(before.returnType, after.returnType)
            self.assertEqual([x for x in before.options if x.defname != 'as'], [x for x in after.options if x.defname != 'as'])
            self.assertEqual(len(parse_plpgsql(row['after'])), 1)
            self.assertEqual(previous.count('\n'), row['after'].count('\n'))
            if row['instrumented']:
                edits = i.data_edits() if row['name'] == 'eps.review_snapshot_data' else i.generate_edits()
                inverse = row['after']
                for a, b in reversed(edits):
                    self.assertEqual(inverse.count(b), 1)
                    inverse = inverse.replace(b, a, 1)
                self.assertEqual(inverse, previous)
            else:
                self.assertEqual(row['after'], previous)

    def test_temporary_context_and_fixed_marker_inventory(self):
        sql, proof = i.temporary()
        self.assertEqual(len(parse_sql(sql)), 3)
        self.assertEqual(len(parse_plpgsql(sql)), 3)
        self.assertTrue(proof['phase_inverse_byte_equal'])
        self.assertTrue(proof['diagnostic_record_overhead_present'])
        definitions = '\n'.join(x['after'] for x in i.build()) + sql
        labels = re.findall(r"raise notice 'EPS_STAGE_V1\|%\|([a-z_]+)\|%'", definitions)
        self.assertEqual(len(labels), 15)
        self.assertEqual(set(labels), set(i.PHASES + ['measure_cancel']))
        self.assertEqual(len(labels), len(set(labels)))
        for needle in ['track_functions', 'pg_stat_reset', 'security definer', 'set_config(']:
            self.assertNotIn(needle, '\n'.join(i.notice(x) for x in labels).lower())
        self.assertIn('get stacked diagnostics', sql)
        self.assertEqual(i.stage_map()['candidate_generate_body_sha256'], next(x['after_body_sha256'] for x in i.build() if x['name'] == 'public.eps_generate_version'))

    def test_passive_transport_and_entry_exact_projection(self):
        self.assertEqual((HERE / 'session.mjs').read_text(), i.session_source())
        self.assertEqual((HERE / 'entry.mjs').read_text(), s.project_entry())
        transport = (HERE / 'session.mjs').read_text()
        self.assertIn('stageRecords:()=>projectStageLines(stderr,ctx.runId)', transport)
        self.assertIn('timeout=45000', transport)
        self.assertIn('stderr.length>128*1024', transport)
        self.assertIn('count>2*1024**2', transport)
        self.assertNotIn('get stderr', transport)
        self.assertNotIn('get stdout', transport)

    def test_single_call_callback_preserves_actual_FK_and_full_restore(self):
        callback, proof = s.project_callback(ROOT / '.local/no-stage-dispatch-cases.mjs')
        self.assertTrue(proof['inverse_byte_equal'])
        self.assertTrue(proof['single_fresh_MCP_large_call_only'])
        for needle in ['await firstWholeGenerations(', 'await projectionEqualities(', 'await verifyAssignmentCases(', 'await changedSourceRaces(', 'await verifyDataReuseCases(']:
            self.assertNotIn(needle, callback)
        self.assertEqual(callback.count('await runDiagnostic('), 1)
        self.assertIn('await install(ctx.bindings.originalLockSource,ctx.bindings.beforeBodies)', callback)
        self.assertIn('original_config_and_full_baseline_restored=true', callback)
        self.assertIn("set client_min_messages=notice;", callback)
        start = callback.index('const assignmentFK=await value(') + len('const assignmentFK=await value(')
        fk, _ = json.JSONDecoder().raw_decode(callback[start:])
        self.assertEqual(len(parse_sql(fk)), 1)
        for part in ['conkey=ARRAY[', 'confkey=ARRAY[', "conrelid='eps.assignments'::regclass", "confrelid='eps.slots'::regclass"]:
            self.assertIn(part, fk)

    def test_three_compiled_artifacts_fresh_claim_before_original_target_and_seals(self):
        relative = '.local/presentation-generation-stage-diagnostic-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        controller, callback, cases = c.compile_source(relative)
        for text in [controller, callback, cases]:
            result = subprocess.run(['node', '--check', '--input-type=module'], input=text, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("'.local/presentation-generation-stage-diagnostic-once'", controller)
        self.assertIn("'eps.stagediag.run'", controller)
        self.assertNotIn('label=eps.assignproof.run=', controller)
        self.assertLess(controller.index('report.dispatch_once_claim_created=true'), controller.index('const target = await port.verifyLocalTarget()'))
        self.assertIn('stageInstrumentation', controller)
        self.assertIn('diagnosticTemporarySQL', controller)
        self.assertIn(i.sha(callback.encode()), controller)
        self.assertIn(i.sha(cases.encode()), controller)

    def test_default_off_before_private_context_and_no_function_stats(self):
        result = subprocess.run(['node', '--input-type=module', '-e', f'import {{runCases}} from {json.dumps((HERE/"entry.mjs").as_uri())};await runCases({{}});'], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('STAGE_DIAG_EXECUTION_DISABLED', result.stderr)
        self.assertEqual(result.stdout, '')
        run = (HERE / 'run.mjs').read_text()
        self.assertEqual(run.count('select pg_temp.locksource41_measure('), 1)
        self.assertLess(run.index('await s.finish()'), run.index('s.stageRecords()'))
        self.assertLess(run.index('await custodyAndStrip('), run.index('record.result=projected.result'))
        self.assertNotIn('track_functions', run)


if __name__ == '__main__':
    unittest.main()
