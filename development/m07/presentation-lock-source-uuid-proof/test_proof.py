"""Pure source binding, finite inverse and compiler ordering checks only."""
from pathlib import Path
import importlib.util
import json
import re
import subprocess
import unittest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location('uuid_test_' + name, HERE / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class Tests(unittest.TestCase):
    def test_exact_raw_fixture_active_domains_first_pair_and_canonical_validator_bound(self):
        m = module('fixture');proof = m.build()
        self.assertEqual([proof[x] for x in ['active_slots', 'active_pools', 'active_assignments']], [16, 11, 19])
        self.assertEqual(proof['domain_uuid_pattern'], m.UUID_PATTERN)
        text = (HERE / 'fixture.mjs').read_text()
        self.assertIn('length:16', text);self.assertIn('length:11', text);self.assertIn('length:19', text)
        self.assertIn('((i%16)+1)', text);self.assertIn('((i%11)+1)', text)
        self.assertIn('ATTEMPT_CAP=4096', text);self.assertIn('export const DOMAIN_UUID=/' + m.UUID_PATTERN + '/iu;', text)
        self.assertEqual(len(proof['public_JSON_input_audit']), 9)
        self.assertIn('no UUID input key', proof['public_JSON_input_audit']['generate_version'])

    def test_no_existing_SQL_rows_guards_or_RC_function_changes(self):
        m = module('source');source, proof = m.project_cases();before, _ = m.original().project_cases()
        self.assertTrue(proof['inverse_byte_equal']);self.assertNotIn(' await edgeCounterfactual(ctx);', source);self.assertNotIn(' await crossWorkspaceKeys(ctx);', source)
        for name in ['crossWorkspaceKeys', 'workspaceFenceRace', 'authorityCases']:
            pattern = r'async function ' + name + r'\(ctx\)\{.*?(?=\n(?:async|export) )'
            self.assertEqual(re.search(pattern, source, re.S)[0], re.search(pattern, before, re.S)[0])
        self.assertIn(' await workspaceFenceRace(ctx);\n await authorityCases(ctx);', source)
        self.assertNotIn('await firstAndWarm(ctx);', source)

    def test_controller_qualifies_pure_before_claim_original_DB_or_Docker_and_keeps_restore(self):
        m = module('compiler');relative = '.local/presentation-lock-source-uuid-proof-compiled/controller-00000000-0000-4000-8000-000000000001.mjs'
        controller, callback, cases = m.compile_source(relative)
        self.assertLess(controller.index("assert(lockProof.EXECUTION_ENABLED,'UUID_PROOF_EXECUTION_DISABLED')"), controller.index('qualifyRuntimeUUID(randomUUID)'))
        self.assertLess(controller.index('qualifyRuntimeUUID(randomUUID)'), controller.index('await protect(dispatchRoot)'))
        self.assertLess(controller.index('await protect(dispatchRoot)'), controller.index('port = await import('))
        self.assertEqual(controller.count('label=eps.uuidproof.run='), 2)
        self.assertIn("'.local/presentation-lock-source-uuid-proof-once'", controller)
        pos = controller.index('bindings:', controller.index('await lockProof.runCases(')) + len('bindings:')
        args, _ = json.JSONDecoder().raw_decode(controller[pos:])
        self.assertEqual(args['candidateSha'], '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4');self.assertEqual(args['beforeBodies'], args['afterBodies'])
        self.assertEqual(args['projectedCasesSha'], m.sha(cases.encode()));self.assertEqual(args['projectedCallbackSha'], m.sha(callback.encode()))
        for text in ['original_lock_and_four_preceding_bodies_restored=true', 'original_presentation_configuration_restored=true', 'catalogue_prosrc_exclusions:1']:
            self.assertIn(text, callback)
        for text in [controller, callback, cases]:
            subprocess.run(['node', '--check', '--input-type=module'], input=text, text=True, capture_output=True, check=True)

    def test_default_OFF_is_exact_projection_and_refuses_before_context(self):
        m = module('source');self.assertEqual((HERE / 'entry.mjs').read_text(), m.project_entry())
        code = "import assert from 'node:assert/strict';import{runCases}from './development/m07/presentation-lock-source-uuid-proof/entry.mjs';await assert.rejects(runCases({}),{message:'UUID_PROOF_EXECUTION_DISABLED'});"
        subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, capture_output=True, text=True, check=True)


if __name__ == '__main__':
    unittest.main()
