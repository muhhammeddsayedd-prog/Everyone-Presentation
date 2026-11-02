"""Finite source, PostgreSQL AST and compiler checks only; no database calls."""
from pathlib import Path
import importlib.util
import json
import re
import subprocess
import unittest
from pglast import parse_sql, parse_plpgsql, parser

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location('edge_test_' + name, HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def clean(value):
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items() if k not in ['location', 'stmt_location', 'stmt_len']}
    return value


def where(query):
    return clean(json.loads(parser.parse_sql_json(query))['stmts'][0]['stmt']['SelectStmt']['whereClause'])


class Tests(unittest.TestCase):
    def test_real_original_entire_predicate_is_preserved_before_target_PK_guard(self):
        m = module('edge');sql, proof = m.build()
        self.assertEqual(len(parse_sql(sql)), 2);self.assertEqual(len(parse_plpgsql(sql)), 2)
        original = m.load('edge_ast_old', 'development/m07/presentation-lock-source-optimization/candidate.py', '0639ade8dd50a6f3bb2c95f1739dd52e633af9a1e66d1cd92910f1bc87acbdb7').source()
        statement = original[original.index('  perform 1 from eps.media_assets m where '):]
        predicate = statement.split(' where ', 1)[1].split('order by m.id for share nowait;', 1)[0]
        query = sql.split(' select m.id into v_id from eps.media_assets m where ', 1)[1].split(' for share nowait;', 1)[0]
        actual = where('select m.id from eps.media_assets m where ' + query)
        self.assertEqual(actual['BoolExpr']['args'][0], where('select m.id from eps.media_assets m where ' + predicate))
        self.assertEqual(proof['original4107_whole_asset_predicate_sha256'], m.sha(predicate.encode()))
        self.assertNotIn('security definer', sql);self.assertNotIn('set role', sql)
        self.assertEqual(sql.count('for share nowait'), 5)  # old point; new pool/candidate/media/point

    def test_actual_new_post_media_ID_assembly_includes_selected_frame_even_missing_pair(self):
        m = module('edge');sql, proof = m.build()
        self.assertTrue(proof['asset_assembly_lock_byte_equal'])
        self.assertIn('union all select unnest(v_frame_asset_ids)', sql)
        self.assertIn('v_included:=p_asset=any(v_asset_ids);', sql)
        self.assertIn('where (m.id=any(v_asset_ids))and m.id=p_asset', sql)
        self.assertLess(sql.index('perform 1 from eps.candidate_media m'), sql.index('into v_asset_ids'))
        self.assertNotIn('delete from', sql);self.assertNotIn('create or replace function eps.', sql)
        self.assertEqual(sql.count('eps.presentation_scope(p_workspace,true)'), 4)

    def test_finite_projection_replaces_call_not_existing_RC_security_or_restoration(self):
        m = module('source');cases, proof = m.project_cases();before, _ = m.original().project_cases()
        self.assertTrue(proof['inverse_byte_equal']);self.assertNotIn(' await semanticCases(ctx);', cases)
        self.assertEqual(cases.count(' await edgeCounterfactual(ctx);'), 1)
        self.assertNotIn(' await firstAndWarm(ctx);', cases)
        for name in ['crossWorkspaceKeys', 'workspaceFenceRace', 'authorityCases']:
            pattern = r'async function ' + name + r'\(ctx\)\{.*?(?=\n(?:async|export) )'
            self.assertEqual(re.search(pattern, cases, re.S)[0], re.search(pattern, before, re.S)[0])
        callback, _ = m.project_callback(ROOT / '.local/never-executed-cases.mjs')
        for text in ['catalogue_prosrc_exclusions:1', 'original_lock_and_four_preceding_bodies_restored=true', 'original_presentation_configuration_restored=true', 'POOL_PROOF_FINAL_BASELINE_CHANGED']:
            self.assertIn(text, callback)
        subprocess.run(['node', '--check', '--input-type=module'], input=cases, text=True, capture_output=True, check=True)

    def test_default_entry_source_exact_and_refuses_before_context_or_private_reads(self):
        m = module('source');self.assertEqual((HERE / 'entry.mjs').read_text(), m.project_entry())
        code = "import assert from 'node:assert/strict';import{runCases}from './development/m07/presentation-lock-source-edge-rls-proof/entry.mjs';await assert.rejects(runCases({}),{message:'EDGE_RLS_PROOF_EXECUTION_DISABLED'});"
        subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, text=True, capture_output=True, check=True)

    def test_fresh_namespace_three_sealed_artifacts_claim_before_original_target_and_no_bypass(self):
        m = module('compiler');relative = '.local/presentation-lock-source-edge-rls-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        controller, callback, cases = m.compile_source(relative)
        self.assertIn("'.local/presentation-lock-source-edge-rls-proof-once'", controller)
        self.assertEqual(controller.count('label=eps.edgerls.run='), 2)
        self.assertLess(controller.index('await protect(dispatchRoot)'), controller.index('port = await import('))
        position = controller.index('bindings:', controller.index('await lockProof.runCases(')) + len('bindings:')
        args, _ = json.JSONDecoder().raw_decode(controller[position:])
        self.assertEqual(args['projectedCallbackSha'], m.sha(callback.encode()));self.assertEqual(args['projectedCasesSha'], m.sha(cases.encode()))
        self.assertEqual(args['candidateSha'], '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4')
        self.assertEqual(args['beforeBodies'], args['afterBodies']);parse_sql(args['edgeSql']);parse_plpgsql(args['edgeSql'])
        for text in [controller, callback, cases]:
            subprocess.run(['node', '--check', '--input-type=module'], input=text, text=True, capture_output=True, check=True)
        self.assertNotIn('disable row level security', args['edgeSql'].lower());self.assertNotIn('grant ', args['edgeSql'].lower())


if __name__ == '__main__':
    unittest.main()
