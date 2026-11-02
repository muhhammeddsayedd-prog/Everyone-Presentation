"""Pure callback projection and actual rendered-template syntax checks only."""
from pathlib import Path
import importlib.util
import json
import subprocess
import unittest
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
spec = importlib.util.spec_from_file_location('generation_callback_projection', HERE / 'proof_source.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class Tests(unittest.TestCase):
    def test_full_finite_inverse_to_consumed_library_without_replaying_it(self):
        before = (p.OLD / 'proof.mjs').read_text()
        after = p.project_source()
        self.assertNotEqual(before, after)
        self.assertEqual(p.inverse_source(after), before)
        self.assertNotIn('previous.runCases(', after)
        self.assertNotIn('seed.runCases(', after)
        self.assertIn('await install(ctx.bindings.originalLockSource)', after)
        self.assertIn('ctx.report.data_reuse_body_installations.push(record)', after)
        self.assertIn('assertDataReuseEquality(ctx.report.data_reuse_cases)', after)

    def test_exact_five_source_masks_and_no_other_catalogue_exclusion(self):
        before = (p.OLD / 'fixture.sql').read_text()
        after = p.fixture(before)
        parse_sql(after)
        parse_plpgsql(after)
        self.assertEqual(after.count("then array['prosrc']else array[]::text[]end"), 1)
        for signature in ['eps.presentation_lock_sources(uuid,text,text)'] + p.SIGNATURES:
            self.assertIn("'" + signature + "'::regprocedure", after)
        for name in ['tables', 'reason_nonnull_rows', 'ready_versions', 'pins']:
            self.assertEqual(before.count("'" + name + "'"), after.count("'" + name + "'"))
        with self.assertRaises(ValueError):
            p.fixture(before + '\n')

    def test_new_private_observers_parse_and_keep_real_caller_eight_seconds(self):
        source = (HERE / 'cases.sql').read_text()
        self.assertEqual(len(parse_sql(source)), 2)
        self.assertEqual(len(parse_plpgsql(source)), 2)
        self.assertIn("current_user<>'eps_review_owner'or current_setting('statement_timeout')<>'8s'", source)
        self.assertIn('eps.capture_presentation_video_transcripts(p_version)', source)
        self.assertNotIn('security definer', source)
        self.assertNotIn('original_text', source)
        self.assertIn('position(p.filename in v.snapshot::text)', source)
        self.assertIn("'private_filename_sha256'", source)
        self.assertFalse('update eps.media_assets' in (HERE / 'cases.mjs').read_text())

    def test_actual_six_clone_and_four_english_rendered_templates_parse(self):
        code = """import {associationCloneSQL,englishSetup} from './development/m07/presentation-generation-data-proof/cases.mjs';
const id=()=> '00000000-0000-4000-8000-000000000001';
const ctx={id,runId:id(),variant:'candidate',profiles:{control:{workspace:id()}}};
const result=['duplicate','ambiguous','unrelated_malformed','matched_malformed','mismatched_media','absent_media'].map(name=>associationCloneSQL(ctx,id(),name));
for(const name of ['not_captured','not_provided','available','unavailable'])result.push(englishSetup(id,name));
process.stdout.write(JSON.stringify(result));"""
        result = subprocess.run(['C:/Program Files/nodejs/node.exe', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True)
        queries = json.loads(result.stdout)
        self.assertEqual(len(queries), 10)
        for query in queries:
            parse_sql(query)
            parse_plpgsql(query)
        for query in queries[:6]:
            self.assertNotIn('update eps.presentation_versions', query)
            self.assertNotIn('delete from eps.', query)
            self.assertIn("status='queued'and generated_by=", query)
            self.assertIn('savepoint data_reuse_association', query)

    def test_default_entry_refuses_before_missing_context_or_private_reads(self):
        code = """import {runCases} from './development/m07/presentation-generation-data-proof/entry.mjs';
try{await runCases({});throw Error('unexpected');}catch(error){if(error.message!=='GENERATION_DATA_REUSE_EXECUTION_DISABLED')throw error;}
"""
        subprocess.run(['C:/Program Files/nodejs/node.exe', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True)

    def test_failed_real_case_sample_shape_is_retained_before_assert_and_rollback(self):
        code = """import assert from 'node:assert/strict';
import {verifyDataReuseCases} from './development/m07/presentation-generation-data-proof/cases.mjs';
import {acting} from './development/m07/presentation-lock-source-proof/proof.mjs';
const uid='00000000-0000-4000-8000-000000000001',queries=[];
const holder={async request(text){queries.push(text);
 if(text.includes("'over_budget'"))return [{over_budget:true,note_bytes:4194304}];
 if(text.includes("locksource41_measure('snapshot'"))return [{ok:true,contract_hash:'a'.repeat(64)}];
 if(text.includes("locksource41_measure('generate'"))return [{ok:false,code:'57014',duration_ms:8000}];
 if(text.includes("'fingerprint'"))return [{fingerprint:'b'.repeat(64)}];
 if(text.includes('locksource41_review_meta('))return [{can_generate:true,input:{}}];
 return [];}};
const ctx={holder,profiles:{control:{workspace:uid,series:uid},large:{workspace:uid,series:uid}},acting,id:()=>uid,variant:'candidate',runId:uid,baseline:{same:true},value:async()=>({same:true}),report:{data_reuse_cases:{}}};
await assert.rejects(verifyDataReuseCases(ctx),assert.AssertionError);
const evidence=ctx.report.data_reuse_cases.candidate;
assert.equal(evidence.budget[0].rolled_back,true);assert.equal(evidence.generation[0].generation.code,'57014');assert.equal(evidence.generation[0].fixture_changes_rolled_back,true);
assert.equal(queries.at(-1),'rollback;reset role;');process.stdout.write(JSON.stringify(queries));"""
        result = subprocess.run(['C:/Program Files/nodejs/node.exe', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True)
        queries = json.loads(result.stdout)
        self.assertGreater(len(queries), 8)
        for query in queries:
            parse_sql(query)
            parse_plpgsql(query)

    def test_full_compilation_is_fresh_pinned_disabled_and_node_parses_callback(self):
        spec = importlib.util.spec_from_file_location('generation_proof_compiler', HERE / 'compiler.py')
        compiler = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(compiler)
        relative = '.local/presentation-generation-data-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        callback_relative = relative.replace('/controller-', '/callback-')
        source, callback = compiler.compile_source(relative, callback_relative)
        self.assertTrue('GENERATION_DATA_REUSE_EXECUTION_DISABLED' in source)
        self.assertTrue("'eps.generationdata.run'" in source)
        self.assertEqual(source.count('label=eps.generationdata.run='), 2)
        self.assertTrue(callback_relative in source)
        position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
        bindings, _ = json.JSONDecoder().raw_decode(source[position:])
        self.assertEqual(bindings['baseSha'], bindings['candidateSha'])
        self.assertEqual(bindings['baseSource'], bindings['candidateSource'])
        self.assertNotEqual(bindings['originalLockSource'], bindings['baseSource'])
        self.assertEqual(bindings['projectedCallbackSha'], p.sha(callback.encode()))
        self.assertEqual(len(bindings['beforeBodies']), 4)
        for before, after in zip(bindings['beforeBodies'], bindings['afterBodies']):
            self.assertEqual(before['name'], after['name'])
            self.assertNotEqual(before['sha'], after['sha'])
        for text in [source, callback]:
            subprocess.run(['C:/Program Files/nodejs/node.exe', '--check', '--input-type=module'], input=text, capture_output=True, text=True, check=True)


if __name__ == '__main__':
    unittest.main()
