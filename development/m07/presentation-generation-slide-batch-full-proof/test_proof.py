"""Finite GEN-only source, real byte admission and matrix fake ports; no SQL."""
from pathlib import Path
import importlib.util
import json
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from pglast import parse_plpgsql

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]


def load(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


p=load('slide_full_test_source',HERE/'source.py')
c=load('slide_full_test_compiler',HERE/'compiler.py')


def bindings(source):
    start=source.index('bindings:',source.index('await lockProof.runCases('))+len('bindings:');return json.JSONDecoder().raw_decode(source[start:])[0]


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.relative='.local/presentation-generation-slide-batch-full-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        cls.controller,cls.callback,cls.cases=c.compile_source(cls.relative)
        cls.old,_,cls.old_cases=load('slide_full_test_old_compiler',p.OLD/'compiler.py').compile_source(cls.relative.replace(p.NAMESPACE,p.PREVIOUS_NAMESPACE))

    def test_callback_and_cases_exact_full_predecessor_all_scopes_and_restore_retained(self):
        path=ROOT/'.local/no-write-slide-cases.mjs';before,_=p.original().project_callback(path);after,proof=p.project_callback(path)
        self.assertEqual(after,before);self.assertTrue(proof['callback_byte_equal_for_same_cases_path']);self.assertEqual(self.cases,self.old_cases)
        for token in ['await firstWholeGenerations(combined);','await projectionEqualities(combined);','await verifyAcquisitionLocks(','await missingFrameEquality(combined);','await verifyDataReuseCases(','await verifyAssignmentCases(','await verifyPinAuthorityCases(','await verifyRawAuthorityCases(','await changedSourceRaces(context);','catalogue_prosrc_exclusions:6','original4107_and_all_five_old_bodies_restored=true','original_presentation_config_restored=true']:
            self.assertIn(token,self.callback)
        self.assertLess(self.callback.index('await projectionEqualities(combined);'),self.callback.index('await verifyRawAuthorityCases('))

    def test_compiler_only_GEN_record_changes_four_arrays_English_and_other_targets_exact(self):
        a,b=bindings(self.old),bindings(self.controller)
        for key in ['beforeBodies','englishBefore','englishAfter','baseSource','candidateSource','baseSha','candidateSha']:
            self.assertEqual(a[key],b[key],key)
        self.assertEqual(len(b['afterBodies']),4);candidate=p.load('slide_full_test_candidate',p.CANDIDATE)
        for i,(old,new)in enumerate(zip(a['afterBodies'],b['afterBodies'])):
            if i!=2:self.assertEqual(old,new)
            else:
                self.assertEqual(old['sha'],p.GEN_BEFORE);self.assertEqual(new['sha'],p.GEN_AFTER)
                self.assertEqual(new['sql'].replace(candidate.NEW,candidate.OLD,1),old['sql'])
            self.assertEqual(len(parse_plpgsql(new['sql'])),1);self.assertNotIn('EPS_STAGE_V1',new['sql'])
        self.assertIn("'.local/presentation-generation-slide-batch-full-proof-once'",self.controller);self.assertIn("'eps.slidefull.run'",self.controller)
        self.assertLess(self.controller.index('report.dispatch_once_claim_created=true'),self.controller.index('const target = await port.verifyLocalTarget()'))
        for kind,text in [('callback',self.callback),('cases',self.cases)]:self.assertIn(c.sha(text.encode()),self.controller);self.assertIn(self.relative.replace('/controller-','/'+kind+'-'),self.controller)
        for text in [self.controller,self.callback,self.cases]:
            r=subprocess.run(['node','--check','--input-type=module'],input=text,capture_output=True,text=True);self.assertEqual(r.returncode,0,r.stderr)

    def test_entry_exact_byte_guard_disabled_before_ports_and_actual_file_CRLF_refusal(self):
        closed=p.project_entry();self.assertEqual((HERE/'entry.mjs').read_bytes().decode('utf8'),closed);p.admit_entry(closed)
        armed=closed.replace('export const EXECUTION_ENABLED=false;','export const EXECUTION_ENABLED=true;',1);p.admit_entry(armed)
        with tempfile.TemporaryDirectory(prefix='slide-full-entry-')as name:
            folder=Path(name);entry=folder/'entry.mjs';calls=[]
            def loader(module,file):
                calls.append(module)
                if module=='slide_full_projection':return p
                raise RuntimeError('FROZEN_COMPILER_BOUNDARY_REACHED')
            with patch.object(c,'HERE',folder),patch.object(c,'load',loader):
                for text in [closed,armed]:
                    entry.write_bytes(text.encode());calls.clear()
                    with self.assertRaisesRegex(RuntimeError,'FROZEN_COMPILER_BOUNDARY_REACHED'):c.compile_source(self.relative)
                    self.assertEqual(calls,['slide_full_projection','slide_full_frozen_compiler'])
                for raw in [closed.replace('\n','\r\n').encode(),(closed+'\n').encode()]:
                    entry.write_bytes(raw);calls.clear()
                    with self.assertRaises(ValueError):c.compile_source(self.relative)
                    self.assertEqual(calls,['slide_full_projection'])
        result=subprocess.run(['node','--input-type=module','-e','import{runCases}from '+json.dumps((HERE/'entry.mjs').as_uri())+';await runCases({});'],capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0);self.assertIn('SLIDE_FULL_PROOF_EXECUTION_DISABLED',result.stderr);self.assertEqual(result.stdout,'')

    def test_real_frozen_matrix_first_candidate_failure_records_once_rolls_back_and_stops(self):
        matrix=HERE.parent/'presentation-generation-assignment-proof/matrix.mjs'
        code='import assert from "node:assert/strict";import{firstWholeGenerations}from '+json.dumps(matrix.as_uri())+';'
        code+='const calls=[],report={combined_generation:{}};let dispatched=0,finished=0;const ctx={report,runId:"synthetic",profiles:{large:{workspace:"w",series:"s",meta:{input:{}}}},installVariant:async v=>calls.push(v),acting:()=>"",startFreshGeneration:async tag=>{calls.push(tag);return{pid:1,request:async sql=>{if(sql.includes("locksource41_measure")){dispatched++;return[{ok:false,code:"57014",duration_ms:7999,operation:"generate"}];}return[];},finish:async()=>finished++};}};'
        code+='await assert.rejects(firstWholeGenerations(ctx),/COMBINED_NEW_WHOLE_GENERATION_FAILED/);assert.deepEqual(calls,["candidate","wf_cml"]);assert.equal(dispatched,1);assert.equal(finished,1);assert.equal(report.combined_generation.first_calls.length,1);assert.equal(report.combined_generation.first_calls[0].rolled_back,true);assert.equal(report.combined_generation.actual_first_whole_generation_matrix_completed,undefined);'
        result=subprocess.run(['node','--input-type=module','-e',code],capture_output=True,text=True);self.assertEqual(result.returncode,0,result.stderr)


if __name__=='__main__':unittest.main()
