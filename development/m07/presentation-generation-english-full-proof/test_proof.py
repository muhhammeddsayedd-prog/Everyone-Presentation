"""Source composition, refusal and synthetic Node ports only. No SQL/Docker."""
from pathlib import Path
import hashlib
import importlib.util
import json
import subprocess
import unittest
from pglast import parse_plpgsql

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]


def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


s=load('english_full_test_source',HERE/'source.py')
c=load('english_full_test_compiler',HERE/'compiler.py')


def run_node(code):
    return subprocess.run(['node','--input-type=module','-e',code],capture_output=True,text=True)


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.relative='.local/presentation-generation-english-full-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        cls.controller,cls.callback,cls.cases=c.compile_source(cls.relative)
        at=cls.controller.index('bindings:',cls.controller.index('await lockProof.runCases('))+len('bindings:')
        cls.bindings=json.JSONDecoder().raw_decode(cls.controller[at:])[0]

    def test_closed_six_target_mask_actual_identity_and_full_restore(self):
        extension=load('english_full_test_shared_extension',s.EXTENSION)
        before,_=s.original().project_callback(ROOT/'.local/no-write-cases.mjs')
        extended,proof=extension.extend_callback(before)
        self.assertTrue(proof['inverse_byte_equal']);self.assertEqual(len(proof['masked_signatures']),6)
        self.assertEqual(len(set(proof['masked_signatures'])),6)
        for a,b,count in extension.edits():
            self.assertEqual(before.count(a),count);self.assertEqual(extended.count(b),count)
        self.assertIn("const english=bodies===ctx.bindings.afterBodies?ctx.bindings.englishAfter:ctx.bindings.englishBefore;",extended)
        self.assertIn('bodies=[...bodies,english];',extended)
        self.assertIn('assert.deepEqual(actual[item.name].authority,originalBodyIdentity[item.name].authority)',extended)
        self.assertIn('original4107_and_all_five_old_bodies_restored=true',self.callback)
        self.assertIn('catalogue_prosrc_exclusions:6',self.callback)
        self.assertIn('await install(ctx.bindings.originalLockSource,ctx.bindings.beforeBodies)',self.callback)
        with self.assertRaises(ValueError):extension.extend_callback(before.replace('catalogue_prosrc_exclusions:5','catalogue_prosrc_exclusions:7'))

    def test_all_original_scopes_and_existing_six_raw_cases_remain_after_prerequisites(self):
        before,_=s.original().project_callback(ROOT/'.local/no-write-cases.mjs')
        for token in ['await firstWholeGenerations(combined);','await projectionEqualities(combined);',
                      'await verifyAcquisitionLocks(','await missingFrameEquality(combined);',
                      'await verifyDataReuseCases(','await verifyAssignmentCases(','await verifyPinAuthorityCases(',
                      'await changedSourceRaces(context);','assertDataReuseEquality(','assertAssignmentEquality(',
                      'original_presentation_config_restored=true','COMBINED_FINAL_BASELINE_CHANGED']:
            self.assertEqual(before.count(token),self.callback.count(token),token)
        self.assertEqual(self.callback.count('await verifyRawAuthorityCases('),1)
        self.assertLess(self.callback.index('await projectionEqualities(combined);'),self.callback.index('await verifyRawAuthorityCases('))
        pair=s.PAIR.read_text(encoding='utf8')
        self.assertIn("await runCase(ctx,evidence,'valid_one',null,false);await runCase(ctx,evidence,'valid_zero',null,true);",pair)
        self.assertIn("for(const change of ['membership','capability','expiry'])",pair)
        self.assertIn("await runCase(ctx,evidence,'empty_expiry','expiry',true)",pair)
        self.assertEqual(self.cases,s.original().project_cases()[0])

    def test_compiler_keeps_four_arrays_adds_separate_exact_English_and_all_three_hashes(self):
        b=self.bindings
        self.assertEqual(len(b['beforeBodies']),4);self.assertEqual(len(b['afterBodies']),4)
        self.assertEqual(b['afterBodies'][3]['sha'],s.RAW_AFTER)
        for name,expected in [('englishBefore',s.ENGLISH_BEFORE),('englishAfter',s.ENGLISH_AFTER)]:
            self.assertEqual(b[name]['sha'],expected);self.assertEqual(len(parse_plpgsql(b[name]['sql'])),1)
        for item in b['afterBodies']+[b['englishAfter']]:
            self.assertEqual(hashlib.sha256(item['sql'].encode()).hexdigest(),item['definition_sha256'])
            self.assertNotIn('RAISE NOTICE',item['sql']);self.assertNotIn('GET STACKED DIAGNOSTICS',item['sql'])
        for kind,text in [('callback',self.callback),('cases',self.cases)]:
            self.assertIn(hashlib.sha256(text.encode()).hexdigest(),self.controller)
            self.assertIn(self.relative.replace('/controller-','/'+kind+'-'),self.controller)
        self.assertLess(self.controller.index('report.dispatch_once_claim_created=true'),self.controller.index('const target = await port.verifyLocalTarget()'))
        self.assertIn("'.local/presentation-generation-english-full-proof-once'",self.controller)
        self.assertNotIn('label=eps.pinbatch.run=',self.controller)
        for text in [self.controller,self.callback,self.cases]:
            result=subprocess.run(['node','--check','--input-type=module'],input=text,capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)

    def test_real_entry_refuses_before_ports_and_English_admission_rejects_tampering(self):
        self.assertEqual((HERE/'entry.mjs').read_text(encoding='utf8'),s.project_entry())
        self.assertEqual((HERE/'admit.mjs').read_text(encoding='utf8'),s.project_admit())
        closed=s.project_entry();armed=closed.replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;',1)
        s.admit_entry(closed);s.admit_entry(armed)
        for bad in [armed+'\n',armed.replace('assertEnglishBindings(ctx.bindings);','assertEnglishBindings({});',1)]:
            with self.assertRaises(ValueError):s.admit_entry(bad)
        result=run_node('import{runCases}from '+json.dumps((HERE/'entry.mjs').as_uri())+';await runCases({});')
        self.assertNotEqual(result.returncode,0);self.assertIn('ENGLISH_FULL_PROOF_EXECUTION_DISABLED',result.stderr);self.assertEqual(result.stdout,'')
        records={key:self.bindings[key]for key in ['englishBefore','englishAfter']}
        code='import assert from "node:assert/strict";import{assertEnglishBindings}from '+json.dumps((HERE/'admit.mjs').as_uri())+';const original='+json.dumps(records)+';assertEnglishBindings(original);'
        code+='for(const mutate of[b=>{b.englishAfter.sha=b.englishBefore.sha;},b=>{b.englishAfter.sql+="\\n";},b=>{b.englishAfter.name="eps.other";},b=>{b.englishAfter.extra="PRIVATE_CANARY";}]){const b=structuredClone(original);mutate(b);assert.throws(()=>assertEnglishBindings(b));}'
        result=run_node(code);self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(result.stdout,'')

    def test_real_matrix_fake_ports_failstop_on_first_and_no_ninth_or_warmup(self):
        matrix=HERE.parent/'presentation-generation-assignment-proof/matrix.mjs'
        code='import assert from "node:assert/strict";import{firstWholeGenerations}from '+json.dumps(matrix.as_uri())+';'
        code+='const calls=[],report={combined_generation:{}};let dispatched=0,finished=0;const ctx={report,runId:"synthetic",profiles:{large:{workspace:"w",series:"s",meta:{input:{}}}},installVariant:async v=>calls.push(v),acting:()=>"",startFreshGeneration:async tag=>{calls.push(tag);return{pid:1,request:async sql=>{if(sql.includes("locksource41_measure")){dispatched++;return[{ok:false,code:"57014",duration_ms:7999,operation:"generate"}];}return[];},finish:async()=>finished++};}};'
        code+='await assert.rejects(firstWholeGenerations(ctx),/COMBINED_NEW_WHOLE_GENERATION_FAILED/);assert.deepEqual(calls,["candidate","wf_cml"]);assert.equal(dispatched,1);assert.equal(finished,1);assert.equal(report.combined_generation.first_calls.length,1);assert.equal(report.combined_generation.first_calls[0].rolled_back,true);assert.equal(report.combined_generation.actual_first_whole_generation_matrix_completed,undefined);'
        result=run_node(code);self.assertEqual(result.returncode,0,result.stderr)


if __name__=='__main__':unittest.main()
