"""Finite six-target source/real parser/default-OFF checks; no SQL or Docker."""
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


p=load('English_stage_test_projection',HERE/'projection.py')
c=load('English_stage_test_compiler',HERE/'compiler.py')


def bindings(text):
    start=text.index('bindings:',text.index('await lockProof.runCases('))+len('bindings:')
    return json.JSONDecoder().raw_decode(text[start:])[0]


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.relative='.local/presentation-generation-english-stage-diagnostic-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        cls.controller,cls.callback,cls.cases=c.compile_source(cls.relative)
        cls.old,_,cls.old_cases=p.load('English_stage_test_old_compiler',p.OLD/'compiler.py').compile_source(cls.relative.replace(p.NAMESPACE,p.PREVIOUS_NAMESPACE))

    def test_only_English_bindings_six_target_extension_and_honest_restore_labels(self):
        path=ROOT/'.local/no-write-English-stage-cases.mjs';before,_=p.previous().project_callback(path)
        extended,proof=p.load('English_stage_test_extension',p.EXTENSION).extend_callback(before)
        self.assertTrue(proof['inverse_byte_equal']);self.assertEqual(len(proof['masked_signatures']),6)
        after,_=p.project_callback(path)
        for a,b in reversed(p.CALLBACK_EDITS):after=after.replace(b,a,1)
        self.assertEqual(after,extended)
        a,b=bindings(self.old),bindings(self.controller)
        for key in ['beforeBodies','afterBodies','baseSource','candidateSource','baseSha','candidateSha','diagnosticTemporarySQL','diagnosticTemporaryProof','diagnosticStageMap','stageInstrumentation']:
            self.assertEqual(a[key],b[key],key)
        self.assertEqual(len(b['beforeBodies']),4);self.assertEqual(len(b['afterBodies']),4)
        for key in ['englishBefore','englishAfter']:
            self.assertEqual(len(parse_plpgsql(b[key]['sql'])),1);self.assertNotIn('NOTICE',b[key]['sql'])
        self.assertEqual(b['englishAfter']['sha'],'b763cd502ed70c49f7d9d07106397bd6c774a6c00d87322f7e0954f25f1ac4ad')
        self.assertIn('original4107_and_five_old_bodies_restored=true',self.callback)
        self.assertIn('original_config_and_full_baseline_restored=true',self.callback)
        self.assertIn('assert.deepEqual(actual[item.name].authority,originalBodyIdentity[item.name].authority)',self.callback)

    def test_cases_transport_custody_bounds_one_call_and_once_before_target_unchanged(self):
        self.assertEqual(self.cases,self.old_cases)
        self.assertEqual(self.callback.count('await runDiagnostic('),1)
        self.assertIn("'.local/presentation-generation-english-stage-diagnostic-once'",self.controller)
        self.assertIn("'eps.englishstage.run'",self.controller);self.assertNotIn('label=eps.rawstage.run=',self.controller)
        self.assertLess(self.controller.index('report.dispatch_once_claim_created=true'),self.controller.index('const target = await port.verifyLocalTarget()'))
        self.assertLess(self.cases.index('await custodyAndStrip('),self.cases.index('record.result=projected.result'))
        self.assertIn('await s.finish();const exit=await s.done;',self.cases)
        self.assertIn("set local statement_timeout='8s';set local lock_timeout='8s';",self.cases)
        for kind,text in [('callback',self.callback),('cases',self.cases)]:
            self.assertIn(c.sha(text.encode()),self.controller);self.assertIn(self.relative.replace('/controller-','/'+kind+'-'),self.controller)
        for text in [self.controller,self.callback,self.cases]:
            result=subprocess.run(['node','--check','--input-type=module'],input=text,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)

    def test_exact_default_off_or_unique_arming_and_refusal_before_any_port(self):
        closed=p.project_entry();self.assertEqual((HERE/'entry.mjs').read_text(encoding='utf8'),closed)
        armed=closed.replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;',1)
        p.admit_entry(closed);p.admit_entry(armed)
        for bad in [armed+'\n',armed.replace('assertEnglishBindings(ctx.bindings);','assertEnglishBindings({});',1)]:
            with self.assertRaises(ValueError):p.admit_entry(bad)
        result=subprocess.run(['node','--input-type=module','-e','import{runCases}from '+json.dumps((HERE/'entry.mjs').as_uri())+';await runCases({});'],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0);self.assertIn('ENGLISH_STAGE_DIAG_EXECUTION_DISABLED',result.stderr);self.assertEqual(result.stdout,'')


if __name__=='__main__':unittest.main()
