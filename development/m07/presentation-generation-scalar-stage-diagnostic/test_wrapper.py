"""Current7 source/PL parser, inverse and OFF checks only; no SQL/resources."""
from pathlib import Path
import importlib.util
import json
import subprocess
import unittest
from pglast import parse_plpgsql

HERE=Path(__file__).resolve().parent


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


p=load('current7_test_projection',HERE/'projection.py')
c=load('current7_test_compiler',HERE/'compiler.py')


def bindings(text):
    start=text.index('bindings:',text.index('await lockProof.runCases('))+len('bindings:')
    return json.JSONDecoder().raw_decode(text[start:])[0]


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.relative='.local/presentation-generation-scalar-stage-diagnostic-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        cls.controller,cls.callback,cls.cases=c.compile_source(cls.relative)
        cls.old,_,cls.old_cases=p.load('current7_parent_compiler_test',p.OLD/'compiler.py').compile_source(cls.relative.replace(p.NAMESPACE,p.PREVIOUS_NAMESPACE))

    def test_current_GEN_slide_block_commutes_with_exact_frozen_notices_and_other_three_bodies(self):
        old,_=p.original().previous().instrumented_bodies();new,proof=p.instrumented_bodies();slide=p.load('current7_slide_test',p.SLIDE)
        self.assertTrue(proof['GEN_slide_block_and_existing_notice_edits_commute_exactly'])
        for a,b in zip(old,new):
            if a['name']!='public.eps_generate_version':self.assertEqual(a,b)
            else:
                self.assertEqual(a['after'].replace(slide.OLD,slide.NEW,1),b['after'])
                self.assertEqual(b['after'].replace(slide.NEW,slide.OLD,1),a['after'])
                self.assertEqual(b['current_candidate_body_sha256'],p.GEN_AFTER);self.assertEqual(b['after_body_sha256'],p.INSTRUMENTED_GEN)
                self.assertEqual(a['after'].count('\n'),b['after'].count('\n'));self.assertEqual(len(parse_plpgsql(b['after'])),1)

    def test_callback_seven_target_inverse_identity_and_original_seven_restore(self):
        file=HERE/'.local/no-write-current7.mjs';before,_=p.original().project_callback(file);after,proof=p.project_callback(file)
        self.assertTrue(proof['inverse_byte_equal']);self.assertIn('catalogue_prosrc_exclusions:7',after)
        self.assertIn('original4107_and_all_six_old_bodies_restored=true',after)
        self.assertIn("assert.deepEqual(actual['public.eps_validate_own_oauth_session'],originalBodyIdentity['public.eps_validate_own_oauth_session'])",after)
        self.assertEqual(before.count('await runDiagnostic('),1);self.assertEqual(after.count('await runDiagnostic('),1)
        self.assertIn('scalar=bodies===ctx.bindings.afterBodies?',after)
        self.assertLess(after.index('scalar=bodies===ctx.bindings.afterBodies?'),after.index('bodies=[...bodies,english,scalar]'))

    def test_generated_cases_context_temp_line_map_and_all_transport_limits_unchanged(self):
        self.assertEqual(self.cases,self.old_cases);a,b=bindings(self.old),bindings(self.controller)
        for key in ['beforeBodies','englishBefore','englishAfter','baseSource','candidateSource','baseSha','candidateSha','diagnosticTemporarySQL','diagnosticTemporaryProof']:
            self.assertEqual(a[key],b[key],key)
        self.assertEqual(a['diagnosticStageMap']['line_stages'],b['diagnosticStageMap']['line_stages'])
        self.assertEqual(b['diagnosticStageMap']['candidate_generate_body_sha256'],p.INSTRUMENTED_GEN)
        for i in[0,1,3]:self.assertEqual(a['afterBodies'][i],b['afterBodies'][i]);self.assertEqual(a['stageInstrumentation'][i],b['stageInstrumentation'][i])
        self.assertEqual(b['stageInstrumentation'][2]['current_candidate_body_sha256'],p.GEN_AFTER)
        self.assertEqual(b['scalarAfter']['sha'],'8455eeb4094d74a11e487627711f237192c9b591fdf61d1b54b9114bedd487ab')
        self.assertIn("set local statement_timeout='8s';set local lock_timeout='8s';",self.cases)
        self.assertLess(self.cases.index('await custodyAndStrip('),self.cases.index('record.result=projected.result'))
        self.assertIn('await s.finish();const exit=await s.done;',self.cases)
        self.assertLess(self.controller.index('report.dispatch_once_claim_created=true'),self.controller.index('const target = await port.verifyLocalTarget()'))
        self.assertIn("'.local/presentation-generation-scalar-stage-diagnostic-once'",self.controller)
        for kind,text in[('callback',self.callback),('cases',self.cases)]:self.assertIn(c.sha(text.encode()),self.controller);self.assertIn(self.relative.replace('/controller-','/'+kind+'-'),self.controller)
        for text in[self.controller,self.callback,self.cases]:
            result=subprocess.run(['node','--check','--input-type=module'],input=text,capture_output=True,text=True);self.assertEqual(result.returncode,0,result.stderr)

    def test_real_entry_exact_raw_F_T_only_OFF_refuses_before_context(self):
        closed=p.project_entry();self.assertEqual((HERE/'entry.mjs').read_bytes().decode(),closed)
        p.admit_entry(closed);p.admit_entry(closed.replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;',1))
        for bad in[closed+'\n',closed.replace('\n','\r\n')]:
            with self.assertRaises(ValueError):p.admit_entry(bad)
        result=subprocess.run(['node','--input-type=module','-e','import{runCases}from '+json.dumps((HERE/'entry.mjs').as_uri())+';await runCases({});'],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0);self.assertIn('SCALAR_CURRENT_STAGE_DIAG_EXECUTION_DISABLED',result.stderr);self.assertEqual(result.stdout,'')

    def test_new_fresh_validator_on_retained_actual_c024_metadata_and_real_new_bindings(self):
        values=bindings(self.controller)
        code='import assert from "node:assert/strict";import{readFile}from "node:fs/promises";import{admitCarry,freshCarry}from '+json.dumps((HERE/'admit.mjs').as_uri())+';'
        code+='const root="D:/Everyone/Presentation/Everyone-Presentation-Studio",r=JSON.parse(await readFile(root+"/tracking/evidence/m07/presentation-generation-scalar-full-proof/2026-11-03T08-29-24.099Z-c024137f.json"));'
        code+='const admitted=await admitCarry(root);const ctx={runId:r.run_id,report:r,baseline:r.combined_generation.fresh_baseline,bindings:'+json.dumps(values)+'};'
        code+='const result=freshCarry(ctx,admitted);assert.equal(result.current_seven_sources_verified,true);assert.equal(result.instrumentation_overhead_present,true);assert.equal(result.changed_scalar_generation_security_or_performance_carried,false);'
        result=subprocess.run(['node','--input-type=module'],input=code,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(result.stdout,'')


if __name__=='__main__':unittest.main()
