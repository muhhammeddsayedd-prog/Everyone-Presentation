"""Pure source/SQL/parser/disabled/ownership compilation checks. No DB tools."""
from pathlib import Path
import importlib.util
import json
import re
import subprocess
import unittest
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location('pool_proof_' + name, HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class Tests(unittest.TestCase):
    def test_measure_is_real_invoker_eight_seconds_without_masking_exception_handler(self):
        source = (HERE / 'measure.sql').read_text()
        self.assertEqual(len(parse_sql(source)), 3)
        self.assertEqual(len(parse_plpgsql(source)), 3)
        self.assertIn("current_user<>'eps_review_owner'", source)
        self.assertIn("current_setting('statement_timeout')<>'8s'", source)
        self.assertIn("current_setting('lock_timeout')<>'8s'", source)
        self.assertFalse('exception when' in source)
        self.assertFalse('security definer' in source)
        self.assertIn('perform eps.presentation_lock_sources(', source)

    def test_twelve_individually_bounded_oracle_statements_are_exact_original_predicates(self):
        oracle = module('oracle')
        source, queries = oracle.build()
        self.assertEqual([relation for relation, _ in queries], oracle.RELATIONS)
        original = oracle.BASE.read_text()
        for _, query in queries:
            self.assertEqual(original.count(query), 1)
            self.assertEqual(source.count(query), 1)
        self.assertEqual(len(parse_sql(source)), 1)
        self.assertEqual(len(parse_plpgsql(source)), 1)
        self.assertNotIn('for share', source)
        self.assertNotIn('for update', source)
        self.assertIn('security invoker', source)

    def test_proven_fixture_prefix_single_source_mask_and_original_config_restore(self):
        callback, proof = module('source').project_source()
        self.assertTrue(proof['only_target_helper_prosrc_masked'])
        self.assertTrue(proof['tail_inverse_byte_equal'])
        self.assertIn('catalogue_prosrc_exclusions:1', callback)
        self.assertIn('original_presentation_configuration_restored=true', callback)
        self.assertIn('from locksource41_proof.config_before b where c.id=b.id', callback)
        self.assertIn('LOCKSOURCE41_CONFIG_RESTORE_UNCONFIRMED', callback)
        identity = re.search(r'const restored=await value\(("(?:[^"\\]|\\.)*")\);', callback)
        self.assertIsNotNone(identity)
        sql = json.loads(identity[1])
        parse_sql(sql)
        self.assertIn(r"E'\r\n'", sql)
        self.assertNotIn(r"E'\\r\\n'", sql)
        self.assertIn('assert.equal(restored.source,ctx.bindings.originalLockSha)', callback)
        self.assertFalse('await verifyDataReuseCases(' in callback)
        self.assertFalse('await changedSourceRaces(' in callback)

    def test_default_entry_refuses_before_private_context_and_no_old_run_is_called(self):
        code = """import assert from 'node:assert/strict';import {runCases}from './development/m07/presentation-lock-source-pool-proof/entry.mjs';await assert.rejects(runCases({}),{message:'POOL_PROOF_EXECUTION_DISABLED'});"""
        subprocess.run(['C:/Program Files/nodejs/node.exe', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True)
        text = (HERE / 'entry.mjs').read_text()
        self.assertLess(text.index('assert(EXECUTION_ENABLED'), text.index('await realpath(privateRoot)'))
        self.assertIn('assert.deepEqual(ctx.bindings.afterBodies,ctx.bindings.beforeBodies)', text)
        self.assertNotIn('previous.runCases', text)
        self.assertIn("'VERBOSITY=verbose'", text)

    def test_compiled_artifact_once_permit_precedes_original_target_or_Docker(self):
        c = module('compiler')
        relative = '.local/presentation-lock-source-pool-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        callback_relative = relative.replace('/controller-', '/callback-')
        controller, callback = c.compile_source(relative, callback_relative)
        self.assertLess(controller.index('await protect(dispatchRoot)'), controller.index('port = await import('))
        self.assertLess(controller.index('report.dispatch_once_claim_created=true'), controller.index("docker(['volume', 'create'"))
        self.assertIn("'.local/presentation-lock-source-pool-proof-once'", controller)
        self.assertIn("'eps.poolproof.run'", controller)
        self.assertEqual(controller.count('label=eps.poolproof.run='), 2)
        self.assertIn('POOL_PROOF_EXECUTION_DISABLED', controller)
        position = controller.index('bindings:', controller.index('await lockProof.runCases(')) + len('bindings:')
        bindings, _ = json.JSONDecoder().raw_decode(controller[position:])
        self.assertEqual(bindings['baseSha'], '1ff8ce429ec61785c1e1037da8de5d2a4b9426789074a64eab0f6f89241c48e4')
        self.assertEqual(bindings['candidateSha'], '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4')
        self.assertEqual(bindings['afterBodies'], bindings['beforeBodies'])
        self.assertEqual(bindings['projectedCallbackSha'], c.sha(callback.encode()))
        self.assertEqual(len(parse_sql(bindings['oracleSql'])), 1)
        self.assertEqual(len(parse_plpgsql(bindings['oracleSql'])), 1)
        for source in [controller, callback]:
            subprocess.run(['C:/Program Files/nodejs/node.exe', '--check', '--input-type=module'], input=source, capture_output=True, text=True, check=True)

    def test_actual_javascript_SQL_templates_render_and_parse(self):
        result = subprocess.run(['C:/Program Files/nodejs/node.exe', str(HERE / 'render_sql.mjs')], cwd=ROOT, capture_output=True, text=True, check=True)
        statements = json.loads(result.stdout)
        self.assertGreater(len(statements), 20)
        for source in statements:
            parse_sql(source)
            parse_plpgsql(source)


if __name__ == '__main__':
    unittest.main()
