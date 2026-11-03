"""Finite-source, SQL parser and fake-entry checks; no database/container calls."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess
import unittest
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


s = load('acquisition_proof_source_tests', HERE / 'source.py')
c = load('acquisition_proof_compiler_tests', HERE / 'compiler.py')


class Tests(unittest.TestCase):
    def test_finite_callback_retains_matrix_sixteen_components_focus_and_restoration(self):
        path = ROOT / '.local/no-write-acquisition-cases.mjs'
        before, _ = s.original().project_callback(path)
        after, proof = s.project_callback(path)
        self.assertTrue(proof['inverse_byte_equal'])
        self.assertTrue(proof['old280_canonical_four_vs_newaa1_current_four'])
        for call in ['await firstWholeGenerations(combined);', 'await projectionEqualities(combined);',
                     'await missingFrameEquality(combined);', 'await verifyDataReuseCases(',
                     'await verifyAssignmentCases(', 'await changedSourceRaces(context);',
                     'assertDataReuseEquality(', 'assertAssignmentEquality(',
                     'await install(ctx.bindings.originalLockSource,ctx.bindings.beforeBodies);']:
            self.assertEqual(before.count(call), after.count(call), call)
        self.assertLess(after.index('await firstWholeGenerations(combined);'), after.index('await projectionEqualities(combined);'))
        self.assertLess(after.index('await projectionEqualities(combined);'), after.index('await verifyAcquisitionLocks('))
        self.assertLess(after.index('await verifyAcquisitionLocks('), after.index('await missingFrameEquality(combined);'))
        self.assertIn("await install(variant==='old'?ctx.bindings.baseSource:ctx.bindings.candidateSource,variant==='old'?ctx.bindings.beforeBodies:ctx.bindings.afterBodies);", after)
        self.assertIn('original_presentation_config_restored=true', after)
        self.assertIn('all_new_whole_generation_8s_and_data_equalities_completed=true', after)

    def test_full_immediate_pool_FK_sql_not_just_constraint_name(self):
        self.assertEqual(len(parse_sql(s.POOL_FK_SQL)), 1)
        for needle in ["conrelid='eps.assignments'::regclass", "confrelid='eps.workspace_candidates'::regclass",
                       'convalidated', 'condeferrable', 'condeferred', "contype='f'", 'conkey=ARRAY[', 'confkey=ARRAY[']:
            self.assertIn(needle, s.POOL_FK_SQL)
        self.assertIn("attname='workspace_id'),(select attnum from pg_attribute where attrelid='eps.assignments'::regclass and attname='workspace_candidate_id')", s.POOL_FK_SQL)
        self.assertIn("attname='workspace_id'),(select attnum from pg_attribute where attrelid='eps.workspace_candidates'::regclass and attname='id')", s.POOL_FK_SQL)

    def test_original_all_twelve_oracle_and_RC_functions_are_exact_subset(self):
        text, proof = s.project_security()
        self.assertEqual((HERE / 'security.mjs').read_bytes(), text.encode())
        self.assertEqual(set(proof['selected_function_bodies_byte_equal']),
                         {'probe', 'heldCohorts', 'crossWorkspaceKeys', 'workspaceFenceRace', 'authorityCases'})
        self.assertNotIn('firstAndWarm(', text)
        self.assertNotIn('semanticCases(', text)
        self.assertNotIn('runPoolCases(', text)
        self.assertNotIn('begin isolation level repeatable read', text)
        self.assertIn("const begin=(ctx,mode='mcp',role='eps_review_owner',extra={})=>'begin;'", text)
        self.assertIn('await prepareOracle(ctx,oracle,record);', text)
        self.assertIn('await readOracle(ctx,oracle,relation,record)', text)
        self.assertIn("{found:true,locked:true,code:'55P03'}", text)
        locks = (HERE / 'locks.mjs').read_text()
        self.assertIn('record.helper=only(await holder.request(measure(', locks)
        self.assertLess(locks.index('record.helper=only'), locks.index('assert.equal(record.helper.ok,true)'))
        for token in ['record.selected_rows,150', 'record.held_rows,150', 'record.held.negatives.length,8',
                      'record.fk_key_share_control', 'record.actual_share_probe',
                      'await crossWorkspaceKeys(ctx)', 'await workspaceFenceRace(ctx)', 'await authorityCases(ctx)']:
            self.assertIn(token, locks)
        self.assertNotIn('set_config', locks)
        self.assertNotIn('security definer', locks)

    def test_three_compiled_seals_new_claims_exact_five_bodies_and_same_limits(self):
        relative = '.local/presentation-generation-lock-acquisition-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        controller, callback, cases = c.compile_source(relative)
        for text in [controller, callback, cases, (HERE / 'security.mjs').read_text(), (HERE / 'locks.mjs').read_text()]:
            result = subprocess.run(['node', '--check', '--input-type=module'], input=text, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        position = controller.index('bindings:', controller.index('await lockProof.runCases(')) + len('bindings:')
        args, _ = json.JSONDecoder().raw_decode(controller[position:])
        self.assertEqual(args['baseSha'], s.HELPER_BEFORE)
        self.assertEqual(args['candidateSha'], s.HELPER_AFTER)
        self.assertEqual([x['sha'] for x in args['beforeBodies']],
                         ['4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7',
                          'f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb',
                          'b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08',
                          'ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187'])
        self.assertEqual([x['sha'] for x in args['afterBodies']],
                         ['0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd',
                          'c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10',
                          'a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40',
                          'afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7'])
        self.assertEqual(len(parse_plpgsql(args['candidateSource'])), 1)
        self.assertEqual(c.sha(args['candidateSource'].encode()), args['acquisitionCandidate']['after_definition_sha256'])
        self.assertIn("'.local/presentation-generation-lock-acquisition-proof-once'", controller)
        self.assertIn("'eps.acqproof.run'", controller)
        self.assertNotIn('label=eps.assignproof.run=', controller)
        self.assertLess(controller.index('report.dispatch_once_claim_created=true'), controller.index('const target = await port.verifyLocalTarget()'))
        for kind, text in [('callback', callback), ('cases', cases)]:
            self.assertIn(hashlib.sha256(text.encode()).hexdigest(), controller)
            self.assertIn(relative.replace('/controller-', '/' + kind + '-'), controller)
        self.assertEqual(cases, s.original().project_cases()[0])
        old_matrix = (s.OLD / 'matrix.mjs').read_text()
        self.assertIn("[{variant:'candidate',mode:'mcp',label:'large'}", old_matrix)
        self.assertIn("set local statement_timeout='8s';set local lock_timeout='8s';", old_matrix)
        self.assertNotIn('GET STACKED DIAGNOSTICS', callback)

    def test_default_off_before_context_or_transport_and_exact_entry_projection(self):
        self.assertEqual((HERE / 'entry.mjs').read_text(), s.project_entry())
        result = subprocess.run(['node', '--input-type=module', '-e',
                                 'import {runCases}from ' + json.dumps((HERE / 'entry.mjs').as_uri()) + ';await runCases({});'],
                                capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('ACQUISITION_PROOF_EXECUTION_DISABLED', result.stderr)
        self.assertEqual(result.stdout, '')
        self.assertIn('export const EXECUTION_ENABLED=false;', (HERE / 'entry.mjs').read_text())


if __name__ == '__main__':
    unittest.main()
