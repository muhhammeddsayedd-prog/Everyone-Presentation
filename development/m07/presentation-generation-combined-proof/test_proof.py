"""Pure compiler/AST/inverse/observer checks; never executes SQL or Docker."""
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
    spec = importlib.util.spec_from_file_location('combined_test_' + name, HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def clean(value):
    if isinstance(value, list):
        return [clean(v) for v in value]
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items() if k not in ['location', 'arg_location', 'stmt_location', 'stmt_len', 'replace']}
    return value


class Tests(unittest.TestCase):
    def test_focused_projection_inverse_preserves_original_predicates_and_two_temp_marker_bodies(self):
        m = module('source');text, proof = m.project_cases()
        self.assertTrue(proof['inverse_byte_equal']);self.assertTrue(proof['all_six_generation_six_association_four_English_budget_expiry_original_predicates_unchanged'])
        sql = (m.OLD / 'cases.sql').read_text();changed = sql.replace('create function pg_temp.', 'create or replace function pg_temp.')
        self.assertEqual(sql.count('create function pg_temp.'), 2)
        self.assertEqual(changed.replace('create or replace function pg_temp.', 'create function pg_temp.'), sql)
        self.assertEqual(clean(json.loads(parser.parse_sql_json(sql))), clean(json.loads(parser.parse_sql_json(changed))))
        self.assertEqual(parse_plpgsql(sql), parse_plpgsql(changed))
        self.assertIn('record.manifest=only(', text);self.assertIn('assert.deepEqual(before.manifest,after.manifest)', text)
        self.assertIn("observePending(contender.request(metric('review',profiles.control)))", text)

    def test_callback_inverse_five_source_mask_first_order_and_missing_frame_fresh(self):
        m = module('source');text, proof = m.project_callback(ROOT / '.local/never-run-combined-cases.mjs')
        self.assertTrue(proof['inverse_byte_equal']);self.assertTrue(proof['same_exact_frozen_fixture_prefix_five_prosrc_mask'])
        self.assertLess(text.index('await firstWholeGenerations(combined)'), text.index('await projectionEqualities(combined)'))
        self.assertLess(text.index('await projectionEqualities(combined)'), text.index('await missingFrameEquality(combined)'))
        self.assertLess(text.index('await missingFrameEquality(combined)'), text.index('await verifyDataReuseCases('))
        self.assertNotIn('await verifyHeld(context)', text);self.assertNotIn('await verifyEdges(context)', text)
        self.assertIn('await changedSourceRaces(context)', text)
        self.assertEqual(text.count('const pending=observePending(contender.request('), 2)
        self.assertIn('original4107_and_all_four_old_bodies_restored=true', text)
        self.assertIn('original_presentation_config_restored=true', text)
        self.assertIn("assert.deepEqual(await value(SNAPSHOT_SQL),baseline,'COMBINED_FINAL_BASELINE_CHANGED')", text)

    def test_manifest_observer_actual_persisted_private_hash_only_and_owned_queued_guard(self):
        sql = (HERE / 'observations.sql').read_text();self.assertEqual(len(parse_sql(sql)), 1);self.assertEqual(len(parse_plpgsql(sql)), 1)
        for text in ["current_user<>'postgres'", "v.status<>'queued'", "v.generated_by<>'a4410000-0000-4000-8000-000000000001'::uuid", "(v.manifest-'created_at')::text", "synthetic-normalized-slide-", 'eps.presentation_hash(v.manifest)=v.manifest_sha256', "eps.presentation_hash(v.snapshot->'asset_inventory')=v.inventory_sha256"]:
            self.assertIn(text, sql)
        returned = sql[sql.index(' return jsonb_build_object('):]
        self.assertNotIn('filename', returned);self.assertNotIn('original_text', returned);self.assertNotIn('english_text', returned);self.assertNotIn('to_jsonb(v)', returned)
        self.assertNotIn('security definer', sql);self.assertNotIn('for update', sql);self.assertNotIn('insert into', sql)

    def test_original_transport_bounds_remain_exact_and_native_tags_are_short(self):
        p = HERE.parent / 'presentation-lock-source-proof/session.mjs';raw = p.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), 'ddb76b4db7bb578c2dfa2896fd59451037679c9a5fc2777a13412765c296e252')
        text = raw.decode();self.assertIn('timeout=45000', text);self.assertIn('count>2*1024**2', text);self.assertIn('stderr.length>128*1024', text)
        tags = ['wf_' + v + m + p for v in ['o', 'c'] for m in ['a', 'm'] for p in ['c', 'l']]
        tags += ['pe_' + v + m + p + op for v in ['o', 'c'] for m in ['a', 'm'] for p in ['c', 'l'] for op in ['r', 's']]
        tags += ['mf_o', 'mf_c']
        self.assertEqual(len(set(tags)), 26);self.assertTrue(all(re.fullmatch('[a-z_]{1,15}', x) for x in tags))

    def test_default_off_entry_exact_and_no_context_or_claim_read(self):
        m = module('source');self.assertEqual((HERE / 'entry.mjs').read_text(), m.project_entry())
        code = "import assert from 'node:assert/strict';import{runCases}from './development/m07/presentation-generation-combined-proof/entry.mjs';await assert.rejects(runCases({}),{message:'COMBINED_PROOF_EXECUTION_DISABLED'});"
        subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True)

    def test_actual_three_artifact_compiler_same280_four_deltas_only_once_and_restore(self):
        m = module('compiler');relative = '.local/presentation-generation-combined-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        controller, callback, cases = m.compile_source(relative)
        self.assertIn("'.local/presentation-generation-combined-proof-once'", controller);self.assertEqual(controller.count('label=eps.combinedproof.run='), 2)
        self.assertLess(controller.index('qualifyRuntimeUUID(randomUUID)'), controller.index('await protect(dispatchRoot)'))
        self.assertLess(controller.index('await protect(dispatchRoot)'), controller.index('port = await import('))
        pos = controller.index('bindings:', controller.index('await lockProof.runCases(')) + len('bindings:')
        args, _ = json.JSONDecoder().raw_decode(controller[pos:])
        self.assertEqual(args['baseSha'], args['candidateSha']);self.assertEqual(args['baseSha'], '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4')
        self.assertEqual(args['baseSource'], args['candidateSource']);self.assertEqual(args['originalLockSha'], '4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7')
        self.assertEqual(len(args['beforeBodies']), 4);self.assertEqual(len(args['afterBodies']), 4)
        self.assertTrue(all(x['sha'] != args['afterBodies'][i]['sha'] for i, x in enumerate(args['beforeBodies'])))
        self.assertEqual(args['projectedCallbackSha'], m.sha(callback.encode()));self.assertEqual(args['projectedCasesSha'], m.sha(cases.encode()))
        for item in args['beforeBodies'] + args['afterBodies']:
            self.assertEqual(m.sha(item['sql'].encode()), item['definition_sha256']);parse_sql(item['sql']);parse_plpgsql(item['sql'])
        parse_sql(args['combinedObservationsSQL']);parse_plpgsql(args['combinedObservationsSQL'])
        for text in [controller, callback, cases]:
            subprocess.run(['node', '--check', '--input-type=module'], input=text, text=True, capture_output=True, check=True)


if __name__ == '__main__':
    unittest.main()
