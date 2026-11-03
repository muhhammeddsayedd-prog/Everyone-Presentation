"""Offline inverse/parser/default-OFF checks; no local or hosted SQL dispatch."""
from pathlib import Path
import importlib.util
import json
import subprocess
import unittest
from pglast import parse_plpgsql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


p = load('acquisition_stage_wrapper_tests', HERE / 'projection.py')
c = load('acquisition_stage_compiler_tests', HERE / 'compiler.py')


class Tests(unittest.TestCase):
    def test_exact_fourteen_frozen_files_callback_inverse_and_disabled_entry(self):
        p.frozen()
        self.assertEqual(len(p.PINS), 14)
        self.assertEqual((HERE / 'entry.mjs').read_text(), p.project_entry())
        path = ROOT / '.local/no-write-acquisition-stage-cases.mjs'
        before, _ = p.previous().project_callback(path)
        after, proof = p.project_callback(path)
        self.assertTrue(proof['inverse_byte_equal'])
        self.assertTrue(proof['callback_business_SQL_authority_and_restoration_byte_unchanged'])
        self.assertEqual(after.replace('candidate_aa1_four_body_identity_verified=true', 'helper280_four_body_identity_verified=true').replace('a820_performance_failure_remains_open=true', 'd093_performance_failure_remains_open=true'), before)
        self.assertEqual(after.count('await runDiagnostic('), 1)
        for call in ['await firstWholeGenerations(', 'await projectionEqualities(', 'await verifyAssignmentCases(', 'await verifyAcquisitionLocks(']:
            self.assertNotIn(call, after)
        self.assertIn('original4107_and_four_old_bodies_restored=true', after)
        self.assertIn('original_config_and_full_baseline_restored=true', after)

    def test_compiled_only_helper_delta_same_cases_temporary_map_instrument_and_bounds(self):
        token='00000000-0000-4000-8000-000000000001'
        relative='.local/presentation-generation-acquisition-stage-diagnostic-compiled/controller-'+token+'.mjs'
        source, callback, cases=c.compile_source(relative)
        old_compiler=load('acquisition_old_stage_test_compiler',p.OLD/'compiler.py')
        old, _, old_cases=old_compiler.compile_source(relative.replace('presentation-generation-acquisition-stage-diagnostic-compiled','presentation-generation-stage-diagnostic-compiled'))
        def args(text):
            start=text.index('bindings:',text.index('await lockProof.runCases('))+len('bindings:')
            return json.JSONDecoder().raw_decode(text[start:])[0]
        a,b=args(old),args(source)
        self.assertEqual(cases,old_cases)
        for key in ['beforeBodies','afterBodies','baseSource','baseSha','diagnosticTemporarySQL','diagnosticTemporaryProof','diagnosticStageMap','stageInstrumentation']:
            self.assertEqual(a[key],b[key],key)
        self.assertEqual(a['candidateSha'],p.BEFORE)
        self.assertEqual(b['candidateSha'],p.AFTER)
        self.assertNotEqual(a['candidateSource'],b['candidateSource'])
        self.assertEqual(len(parse_plpgsql(b['candidateSource'])),1)
        self.assertNotIn('NOTICE',b['candidateSource'])
        for text in [source,callback,cases,(HERE/'entry.mjs').read_text()]:
            result=subprocess.run(['node','--check','--input-type=module'],input=text,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn("'.local/presentation-generation-acquisition-stage-diagnostic-once'",source)
        self.assertIn("'eps.acqstage.run'",source)
        self.assertNotIn('label=eps.stagediag.run=',source)
        self.assertLess(source.index('report.dispatch_once_claim_created=true'),source.index('const target = await port.verifyLocalTarget()'))
        for kind,text in [('callback',callback),('cases',cases)]:
            self.assertIn(c.sha(text.encode()),source)
            self.assertIn(relative.replace('/controller-','/'+kind+'-'),source)
        self.assertIn("set local statement_timeout='8s';set local lock_timeout='8s';",cases)
        self.assertIn('closedPhaseCustody',cases)
        self.assertIn('await s.finish();const exit=await s.done;',cases)
        self.assertLess(cases.index('await custodyAndStrip('),cases.index('record.result=projected.result'))

    def test_disabled_before_context_private_sink_or_transport(self):
        result=subprocess.run(['node','--input-type=module','-e','import {runCases}from '+json.dumps((HERE/'entry.mjs').as_uri())+';await runCases({});'],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('ACQUISITION_STAGE_DIAG_EXECUTION_DISABLED',result.stderr)
        self.assertEqual(result.stdout,'')


if __name__=='__main__':
    unittest.main()
