"""Pure source/AST/finite-projection and unchanged-bound checks. No DB tools."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import subprocess
import unittest
from pglast import parse_sql, parse_plpgsql, parser

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location('complete_proof_test_' + name, HERE / (name + '.py'))
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
    tree = json.loads(parser.parse_sql_json(query))['stmts'][0]['stmt']['SelectStmt']
    return clean(tree['fromClause'][0]['RangeSubselect']['subquery']['SelectStmt']['whereClause'])


class Tests(unittest.TestCase):
    def test_all12_complete_original_predicates_have_exact_one_key_domain(self):
        o = module('oracle');sql, metadata = o.build();s = o.s
        self.assertEqual(len(s.RELATIONS), 12)
        self.assertEqual(len(parse_sql(sql)), 4)
        self.assertEqual(len(parse_plpgsql(sql)), 4)
        for relation, query in s.originals().items():
            sliced, predicate = s.sliced(query, relation)
            self.assertIn('(' + predicate + ') and ' + s.point_guard(relation, s.ALIASES.get(relation, '')), sliced)
            base = where(query);actual = where(sliced)['BoolExpr']['args']
            expected = base['BoolExpr']['args'] if 'BoolExpr' in base and base['BoolExpr']['boolop'] == 'AND_EXPR' else [base]
            self.assertEqual(actual[:-1], expected)
            self.assertEqual(metadata['original_statement_sha256'][relation], s.sha(query.encode()))
        self.assertIn("jsonb_array_length(p_keys)<>1", sql)
        self.assertIn("(t.key,t.version)=((p_keys->0->>'key'),(p_keys->0->>'version'))", sql)
        self.assertIn("(f.candidate_media_id,f.asset_id)=((p_keys->0->>'candidate_media_id')::uuid,(p_keys->0->>'asset_id')::uuid)", sql)
        self.assertNotIn('security definer', sql)

    def test_full_pk_universe_has_actual_catalog_shape_count_and_notnull_checks(self):
        o = module('oracle');sql, _ = o.build()
        for relation in o.s.RELATIONS:
            self.assertIn('from ' + relation + ' t;', sql)
            self.assertIn("c.conrelid='" + relation + "'::regclass", sql)
        self.assertEqual(sql.count('count(*)into v_keys,v_rows'), 12)
        self.assertEqual(sql.count("c.contype='p'and c.convalidated"), 12)
        self.assertEqual(sql.count('i.indisvalid and i.indisready'), 12)
        self.assertNotIn('candidate-selected', sql)

    def test_existing_true_scope_guards_are_readonly_and_start_return_even_empty(self):
        o = module('oracle');sql, _ = o.build()
        self.assertIn('eps.presentation_scope(p_workspace,true)', o.AUTH)
        self.assertIn('eps.presentation_scope(p_workspace,true)', o.FINAL_AUTH)
        self.assertLess(sql.index(o.AUTH, sql.index('create function pg_temp.complete41_slice')), sql.index('select w.project_id', sql.index('create function pg_temp.complete41_slice')))
        self.assertLess(sql.index(o.FINAL_AUTH), sql.index("return jsonb_build_object('keys'"))
        audit = module('guard_audit').build()
        self.assertEqual(len(audit['functions']), 8)
        self.assertTrue(all(x['readonly_effect_tokens_absent'] for x in audit['functions'].values()))
        self.assertIn('public.eps_validate_own_oauth_session', audit['functions'])
        self.assertNotIn('for update', sql)
        self.assertNotIn('for share', sql)

    def test_three_broad_tuple_validation_queries_are_full_pool_domain_same_holder_only(self):
        m = module('semantic');sql, proof = m.build()
        self.assertEqual(len(parse_sql(sql)), 4)
        self.assertEqual(len(parse_plpgsql(sql)), 4)
        self.assertIn("transaction_read_only')<>'off'", sql)
        self.assertTrue(proof['all_pool_PKs_not_candidate_IDs'])
        self.assertIn("case p_variant", sql)
        self.assertIn("when 'capture'", sql);self.assertIn("when 'old'", sql);self.assertIn("when 'new'", sql)
        self.assertEqual(sql.count("p.id=(p_keys->0->>'id')::uuid"), 3)
        self.assertIn('select distinct p.id,p.candidate_id,p.selected_candidate_media_id,p.selected_frame_asset_ids', sql)
        self.assertIn('p.id=any(p_pool_ids)', sql)

    def test_projection_only_changes_isolated_semantic_isolation_races_remain_RC(self):
        p = module('source');cases, proof = p.project_cases();before = p.original().project_cases()
        self.assertTrue(proof['inverse_byte_equal']);self.assertTrue(proof['only_semantic_holder_RR'])
        self.assertEqual(cases.count('begin isolation level repeatable read;'), 1)
        for name in ['workspaceFenceRace', 'authorityCases']:
            pattern = r'async function ' + name + r'\(ctx\)\{.*?(?=\n(?:async|export) )'
            self.assertEqual(re.search(pattern, cases, re.S)[0], re.search(pattern, before, re.S)[0])
        self.assertNotIn('await firstAndWarm(ctx);', cases)
        self.assertIn('return semanticTuples(ctx,s,workspace,mustInclude,mustContainFrame)', cases)
        subprocess.run(['node', '--check', '--input-type=module'], input=cases, capture_output=True, text=True, check=True)

    def test_default_entry_refuses_before_claim_context_or_evidence(self):
        p = module('source')
        self.assertEqual(p.normalized_entry((HERE / 'entry.mjs').read_text()), p.project_entry())
        code = "import assert from 'node:assert/strict';import{runCases}from './development/m07/presentation-lock-source-complete-oracle-proof/entry.mjs';await assert.rejects(runCases({}),{message:'COMPLETE_ORACLE_PROOF_EXECUTION_DISABLED'});"
        subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True)

    def test_three_artifact_compilation_once_claim_source_hashes_old_four_and_restore(self):
        c = module('compiler');relative = '.local/presentation-lock-source-complete-oracle-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        controller, callback, cases = c.compile_source(relative)
        self.assertIn("'.local/presentation-lock-source-complete-oracle-proof-once'", controller)
        self.assertIn("'eps.completeoracle.run'", controller)
        self.assertEqual(controller.count('label=eps.completeoracle.run='), 2)
        self.assertLess(controller.index('await protect(dispatchRoot)'), controller.index('port = await import('))
        pos = controller.index('bindings:', controller.index('await lockProof.runCases(')) + len('bindings:')
        args, _ = json.JSONDecoder().raw_decode(controller[pos:])
        self.assertEqual(args['beforeBodies'], args['afterBodies'])
        self.assertEqual(args['candidateSha'], '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4')
        self.assertEqual(args['projectedCasesSha'], c.sha(cases.encode()))
        self.assertEqual(args['projectedCallbackSha'], c.sha(callback.encode()))
        self.assertIn('original_presentation_configuration_restored=true', callback)
        self.assertIn('original_lock_and_four_preceding_bodies_restored=true', callback)
        self.assertIn('catalogue_prosrc_exclusions:1', callback)
        for sql in [args['completeOracleSql'], args['completeSemanticSql']]:
            parse_sql(sql);parse_plpgsql(sql)
        for source in [controller, callback, cases]:
            subprocess.run(['node', '--check', '--input-type=module'], input=source, capture_output=True, text=True, check=True)

    def test_original_transport_expiry_and_command_bounds_unchanged(self):
        transport = (HERE.parent / 'presentation-lock-source-proof/session.mjs').read_bytes()
        self.assertEqual(hashlib.sha256(transport).hexdigest(), 'ddb76b4db7bb578c2dfa2896fd59451037679c9a5fc2777a13412765c296e252')
        text = transport.decode();self.assertIn('timeout=45000', text);self.assertIn('count>2*1024**2', text);self.assertIn('stderr.length>128*1024', text)
        proof = (HERE.parent / 'presentation-lock-source-proof/proof.mjs').read_text();fixture = (HERE.parent / 'presentation-lock-source-proof/fixture.sql').read_text()
        self.assertIn('exp:now+3600', proof);self.assertIn("clock_timestamp()+interval'2hours'", fixture)
        semantic = (HERE / 'semantic.mjs').read_text();self.assertNotIn('ctx.acting(', semantic);self.assertNotIn('set_config', semantic)
        self.assertIn("set role eps_review_owner;", semantic)

    def test_declared_finite_resource_count_is_2021_membership_queries_without_expiry_extension(self):
        path = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/tracking/evidence/m07/presentation-lock-source-oracle-proof/2026-11-02T19-23-47.240Z-140bda15.json')
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), '38f1f3b2919adf1ae4481900ed667196abbe9d4780cb7fb5bb19eb2db44d21ea')
        receipt = json.loads(path.read_text())
        counts = [receipt['pool_helper_proof']['fresh_baseline']['tables'][r]['count'] for r in module('oracle').s.RELATIONS]
        self.assertEqual(sum(counts), 1637)
        self.assertEqual(1637 + 4 * 32 * 3, 2021)
        self.assertGreater(2021 * 8, 3600)
        self.assertIn('exp:now+3600', (HERE.parent / 'presentation-lock-source-proof/proof.mjs').read_text())


if __name__ == '__main__':
    unittest.main()
