"""Compiler/inverse/default-OFF checks, in RAM; no actual SQL or resources."""
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


p=load('raw_first_test_projection',HERE/'projection.py')
c=load('raw_first_test_compiler',HERE/'compiler.py')


class Tests(unittest.TestCase):
    def test_fixed_frozen_prefix_callback_inverse_one_call_and_restore(self):
        p.frozen()
        callback,proof=p.project_callback(ROOT/'.local/never-written-raw-first-cases.mjs')
        self.assertTrue(proof['inverse_byte_equal'])
        self.assertEqual(callback.count('await runDiagnostic('),1)
        self.assertIn('original4107_and_four_old_bodies_restored=true',callback)
        self.assertIn('original_config_and_full_baseline_restored=true',callback)
        for text in ['await firstWholeGenerations(', 'await projectionEqualities(', 'await verifyPinAuthority(', 'client_min_messages=notice', 'ctx.bindings.diagnosticTemporarySQL', 'ctx.bindings.stageInstrumentation']:
            self.assertNotIn(text,callback)
        self.assertIn('instrumentation_cost_present:false',callback)
        self.assertEqual((HERE/'entry.mjs').read_text(),p.project_entry())

    def test_compiler_actual_original_measure_normal_four_and_fresh_once(self):
        relative='.local/presentation-generation-raw-companion-first-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        source,callback,cases=c.compile_source(relative)
        position=source.index('bindings:',source.index('await lockProof.runCases('))+len('bindings:')
        args=json.JSONDecoder().raw_decode(source[position:])[0]
        self.assertEqual(args['firstCallTemporarySQL'].encode(),p.TEMP.read_bytes())
        self.assertEqual(args['firstCallTemporarySha'],p.TEMP_SHA)
        self.assertEqual([r['sha']for r in args['afterBodies']],['0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d','f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5'])
        for r in args['afterBodies']:
            self.assertEqual(len(parse_plpgsql(r['sql'])),1)
            self.assertNotIn('EPS_STAGE_V1',r['sql'])
        for key in ['diagnosticTemporarySQL','diagnosticStageMap','stageInstrumentation']:
            self.assertNotIn(key,args)
        for text in [cases,args['firstCallTemporarySQL']]:
            for marker in ['EPS_STAGE_V1','get stacked diagnostics','__owned_private_cancel','custodyStages']:
                self.assertNotIn(marker,text)
        self.assertIn("set local statement_timeout='8s';set local lock_timeout='8s';",cases)
        self.assertIn("'.local/presentation-generation-raw-companion-first-proof-once'",source)
        self.assertIn("'eps.rawfirst.run'",source)
        self.assertLess(source.index('report.dispatch_once_claim_created=true'),source.index('const target = await port.verifyLocalTarget()'))
        for kind,text in [('callback',callback),('cases',cases)]:
            self.assertIn(c.sha(text.encode()),source)
            self.assertIn(relative.replace('/controller-','/'+kind+'-'),source)
        for text in [source,callback,cases]:
            result=subprocess.run(['node','--check','--input-type=module'],input=text,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)

    def test_disabled_before_context_private_paths_or_transport(self):
        result=subprocess.run(['node','--input-type=module','-e','import {runCases}from '+json.dumps((HERE/'entry.mjs').as_uri())+';await runCases({});'],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('RAW_FIRST_EXECUTION_DISABLED',result.stderr)
        self.assertEqual(result.stdout,'')


if __name__=='__main__':unittest.main()
