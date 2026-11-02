"""Pure finite SQL/entry/compiler/phase-map checks; no database or provider."""
from pathlib import Path
import importlib.util
import json
import subprocess
import unittest
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location('cancel_diag_test_' + name, HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class Tests(unittest.TestCase):
    def test_only_temp_declarations_cancel_handler_change_and_inverse(self):
        m = module('temporary');sql, proof = m.build()
        self.assertTrue(proof['inverse_byte_equal']);self.assertFalse(proof['pre_error_application_work_or_bounds_changed'])
        self.assertEqual(sql.replace(m.CATCH_NEW, m.CATCH).replace(m.DECL_NEW, m.DECL).encode(), m.OLD.read_bytes())
        self.assertEqual(len(parse_sql(sql)), 3);self.assertEqual(len(parse_plpgsql(sql)), 3)
        self.assertIn('get stacked diagnostics', sql);self.assertIn('PG_EXCEPTION_CONTEXT', sql)
        self.assertNotIn('track_functions', sql);self.assertNotIn('pg_stat_reset', sql)
        stages = m.stage_map();self.assertEqual(stages['candidate_generate_body_sha256'], 'a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40')
        self.assertIn({'line':22,'stage':'source_locking'}, stages['line_stages']);self.assertIn({'line':26,'stage':'review_and_fit'}, stages['line_stages'])

    def test_finite_callback_one_diagnostic_no_matrix_focus_and_restore(self):
        m = module('source');callback, proof = m.project_callback(ROOT / '.local/never-executed-diagnostic-cases.mjs')
        self.assertTrue(proof['inverse_byte_equal']);self.assertTrue(proof['same_fixture_prefix_280_four_candidate_bodies'])
        self.assertEqual(callback.count('await runDiagnostic('), 1)
        for call in ['await firstWholeGenerations(', 'await projectionEqualities(', 'await missingFrameEquality(', 'await verifyDataReuseCases(', 'await changedSourceRaces(']:
            self.assertNotIn(call, callback)
        self.assertIn('original4107_and_four_old_bodies_restored=true', callback);self.assertIn('original_config_and_full_baseline_restored=true', callback)
        self.assertIn('performance_or_release_acceptance=false', callback)
        source = (HERE / 'run.mjs').read_text();self.assertEqual(source.count("pg_temp.locksource41_measure('generate'"), 1)
        self.assertLess(source.index('custodyAndStrip(rows,'), source.index('record.result=projected.result'))
        self.assertNotIn('record.result=rows', source)

    def test_default_off_before_context_private_claim_or_reads(self):
        m = module('source');self.assertEqual((HERE / 'entry.mjs').read_text(), m.project_entry())
        code = "import assert from 'node:assert/strict';import{runCases}from './development/m07/presentation-generation-cancel-diagnostic/entry.mjs';await assert.rejects(runCases({}),{message:'CANCEL_DIAG_EXECUTION_DISABLED'});"
        subprocess.run(['node','--input-type=module','-e',code],cwd=ROOT,text=True,capture_output=True,check=True)
        entry = (HERE / 'entry.mjs').read_text();self.assertIn('captureError,sessions,custodyDiagnostic,admitFreshCarry:',entry);self.assertIn("{flag:'wx',mode:0o600}",entry)

    def test_three_fresh_artifacts_claim_before_DB_and_exact_same_candidate_bodies(self):
        m = module('compiler');relative = '.local/presentation-generation-cancel-diagnostic-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        controller, callback, cases = m.compile_source(relative)
        self.assertEqual(controller.count('label=eps.gendiag.run='),2);self.assertIn("'.local/presentation-generation-cancel-diagnostic-once'",controller)
        self.assertLess(controller.index('await protect(dispatchRoot)'),controller.index('port = await import('))
        pos = controller.index('bindings:',controller.index('await lockProof.runCases('))+len('bindings:');args,_ = json.JSONDecoder().raw_decode(controller[pos:])
        self.assertEqual(args['baseSha'],args['candidateSha']);self.assertEqual(args['candidateSha'],'280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4')
        self.assertEqual(args['afterBodies'][2]['sha'],'a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40');self.assertTrue(args['diagnosticTemporaryProof']['inverse_byte_equal'])
        self.assertEqual(args['projectedCallbackSha'],m.sha(callback.encode()));self.assertEqual(args['projectedCasesSha'],m.sha(cases.encode()))
        for text in [controller,callback,cases]:
            subprocess.run(['node','--check','--input-type=module'],input=text,text=True,capture_output=True,check=True)


if __name__ == '__main__':
    unittest.main()
