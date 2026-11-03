"""Finite raw-only delta and real parsers/disabled guard; no SQL/resources."""
from pathlib import Path
import importlib.util
import json
import subprocess
import unittest
from pglast import parse_plpgsql

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


p=load('raw_stage_test_projection',HERE/'projection.py')
c=load('raw_stage_test_compiler',HERE/'compiler.py')


def args(source):
    position=source.index('bindings:',source.index('await lockProof.runCases('))+len('bindings:')
    return json.JSONDecoder().raw_decode(source[position:])[0]


class Tests(unittest.TestCase):
    def test_raw_only_bodies_callback_inverse_and_entry(self):
        p.frozen();before,_=p.previous().instrumented_bodies();after,proof=p.instrumented_bodies()
        self.assertEqual(proof['raw_body_line_count'],58)
        self.assertEqual(len(before),4)
        for a,b in zip(before,after):
            if a['name']!='eps.capture_presentation_video_transcripts':self.assertEqual(a,b)
            else:
                candidate=p.pin_candidate();self.assertEqual(candidate.inverse(candidate.parts(b['after'])[2]),candidate.parts(a['after'])[2]);self.assertEqual(b['current_candidate_body_sha256'],p.RAW_AFTER);self.assertFalse(b['instrumented'])
            self.assertEqual(len(parse_plpgsql(b['after'])),1)
        self.assertEqual((HERE/'entry.mjs').read_text(),p.project_entry())
        path=ROOT/'.local/never-written-raw-stage-cases.mjs';old,_=p.previous().project_callback(path);new,proof=p.project_callback(path)
        for a,b in reversed(p.CALLBACK_EDITS):new=new.replace(b,a,1)
        self.assertEqual(old,new);self.assertTrue(proof['inverse_byte_equal'])

    def test_generated_artifacts_same_cases_measure_map_three_other_bodies_and_once(self):
        relative='.local/presentation-generation-raw-companion-stage-diagnostic-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        source,callback,cases=c.compile_source(relative)
        old,_,oldcases=load('raw_stage_old_compiler',p.OLD/'compiler.py').compile_source(relative.replace(p.NAMESPACE,p.PREVIOUS_NAMESPACE))
        a,b=args(old),args(source);self.assertEqual(cases,oldcases)
        for key in ['beforeBodies','baseSource','candidateSource','baseSha','candidateSha','diagnosticTemporarySQL','diagnosticTemporaryProof','diagnosticStageMap']:self.assertEqual(a[key],b[key],key)
        self.assertEqual(a['afterBodies'][:3],b['afterBodies'][:3]);self.assertEqual(b['afterBodies'][3]['sha'],p.RAW_AFTER)
        self.assertEqual(a['stageInstrumentation'][:3],b['stageInstrumentation'][:3]);self.assertEqual(b['stageInstrumentation'][3]['current_candidate_body_sha256'],p.RAW_AFTER)
        self.assertEqual(callback.count('await runDiagnostic('),1);self.assertIn('original4107_and_four_old_bodies_restored=true',callback);self.assertIn('original_config_and_full_baseline_restored=true',callback)
        self.assertIn("'.local/presentation-generation-raw-companion-stage-diagnostic-once'",source);self.assertIn("'eps.rawstage.run'",source)
        self.assertLess(source.index('report.dispatch_once_claim_created=true'),source.index('const target = await port.verifyLocalTarget()'))
        self.assertLess(cases.index('await custodyAndStrip('),cases.index('record.result=projected.result'))
        self.assertIn('await s.finish();const exit=await s.done;',cases);self.assertIn("set local statement_timeout='8s';set local lock_timeout='8s';",cases)
        for kind,text in [('callback',callback),('cases',cases)]:self.assertIn(c.sha(text.encode()),source);self.assertIn(relative.replace('/controller-','/'+kind+'-'),source)
        for text in [source,callback,cases]:
            result=subprocess.run(['node','--check','--input-type=module'],input=text,capture_output=True,text=True);self.assertEqual(result.returncode,0,result.stderr)

    def test_default_off_before_context_or_transport(self):
        result=subprocess.run(['node','--input-type=module','-e','import {runCases}from '+json.dumps((HERE/'entry.mjs').as_uri())+';await runCases({});'],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0);self.assertIn('RAW_BATCH_STAGE_DIAG_EXECUTION_DISABLED',result.stderr);self.assertEqual(result.stdout,'')


if __name__=='__main__':unittest.main()
