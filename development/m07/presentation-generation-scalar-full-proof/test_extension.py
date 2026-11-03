"""Pure source/parser and actual projected-install fake-port checks; no SQL."""
from pathlib import Path
import importlib.util
import json
import subprocess
import unittest
from pglast import parse_sql

HERE = Path(__file__).resolve().parent
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


e = load('scalar_full_extension_test', HERE / 'extension.py')


def run_install_probe(callback, corrupt_public=False):
    start = callback.index(' const install=async(source,bodies=ctx.bindings.beforeBodies)=>{')
    end = callback.index('\n };', start) + len('\n };')
    install = callback[start:end]
    code = r'''import assert from 'node:assert/strict';
const names=['eps.review_snapshot_data','eps.review_snapshot','public.eps_generate_version','eps.capture_presentation_video_transcripts'];
const scalar='eps.mcp_token_permits_capability',english='eps.capture_presentation_video_english_transcripts',pub='public.eps_validate_own_oauth_session';
const rows=(variant)=>names.map((name,i)=>({name,sha:variant+i,sql:'\n--BODY:'+JSON.stringify({name,source:variant+i})}));
const row=(name,source)=>({name,sha:source,sql:'\n--BODY:'+JSON.stringify({name,source})});
const ctx={bindings:{beforeBodies:rows('old'),afterBodies:rows('new'),englishBefore:row(english,'c68'),englishAfter:row(english,'b763'),scalarBefore:row(scalar,'5eb'),scalarAfter:row(scalar,'845'),publicValidator:{sha:'9fe'}},report:{data_reuse_body_installations:[]}};
const db=Object.fromEntries([...ctx.bindings.beforeBodies,ctx.bindings.englishBefore,ctx.bindings.scalarBefore,{name:pub,sha:'9fe'}].map((r,i)=>[r.name,{source:r.sha,authority:{oid:i+1,owner:'synthetic-owner'}}]));
const originalBodyIdentity=structuredClone(db);let writes=0;
ctx.sql=async sql=>{writes++;for(const line of sql.split('\n'))if(line.startsWith('--BODY:')){const r=JSON.parse(line.slice(7));db[r.name].source=r.source;}if(CORRUPT)db[pub].source='wrong';};
const value=async()=>structuredClone(db);
INSTALL
await install('create function eps.presentation_lock_sources',ctx.bindings.afterBodies);
assert.equal(db[scalar].source,'845','candidate scalar must be selected before expanding the caller array');
assert.equal(db[english].source,'b763');assert.equal(ctx.bindings.afterBodies.length,4);
assert.equal(ctx.report.data_reuse_body_installations[0].expected.length,6);
await install('create function eps.presentation_lock_sources');
assert.equal(db[scalar].source,'5eb');assert.equal(db[english].source,'c68');assert.equal(writes,2);
assert.equal(db[pub].source,'9fe');
'''.replace('INSTALL', install).replace('CORRUPT', 'true' if corrupt_public else 'false')
    return subprocess.run(['C:/Program Files/nodejs/node.exe', '--input-type=module', '-e', code], capture_output=True, text=True)


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.parent = load('scalar_full_old_slide', MAIN / 'development/m07/presentation-generation-slide-batch-full-proof/source.py')
        cls.before, _ = cls.parent.project_callback(MAIN / '.local/no-write-scalar-cases.mjs')
        cls.after, cls.proof = e.extend_callback(cls.before)

    def test_full_callback_inverse_and_seven_mask_only_six_bodies_plus_public_identity(self):
        self.assertEqual(e.inverse_callback(self.after), self.before)
        self.assertIn('catalogue_prosrc_exclusions:7', self.after)
        self.assertNotIn('catalogue_prosrc_exclusions:6', self.after)
        changes = e.edits()
        mask = changes[0][1]
        self.assertEqual(mask.count('::regprocedure'), 7)
        self.assertIn(e.SCALAR_SIGNATURE, mask)
        self.assertNotIn(e.VALIDATOR_SIGNATURE, mask)
        identity = json.loads(changes[1][1])
        self.assertEqual(identity.count('::regprocedure'), 7)
        self.assertIn(e.VALIDATOR_SIGNATURE, identity)
        self.assertEqual(len(parse_sql(identity)), 1)
        for token in ['await firstWholeGenerations(combined);', 'await projectionEqualities(combined);',
                      'await verifyAcquisitionLocks(', 'await verifyAssignmentCases(',
                      'await verifyPinAuthorityCases(', 'await verifyRawAuthorityCases(',
                      'await changedSourceRaces(context);', 'original_presentation_config_restored=true']:
            self.assertEqual(self.after.count(token), self.before.count(token))
            self.assertGreater(self.after.count(token), 0)

    def test_actual_old_install_RED_new_install_GREEN_and_no_reference_identity_regression(self):
        old = run_install_probe(self.before)
        self.assertNotEqual(old.returncode, 0)
        self.assertIn('candidate scalar must be selected', old.stderr)
        new = run_install_probe(self.after)
        self.assertEqual(new.returncode, 0, new.stderr)
        # Reproduce the known trap: choosing scalar after making a local copy
        # makes bodies===afterBodies false, so the old scalar is installed.
        selection = "  const scalar=bodies===ctx.bindings.afterBodies?ctx.bindings.scalarAfter:ctx.bindings.scalarBefore;\n  assert.equal(scalar.name,'eps.mcp_token_permits_capability');\n"
        mutant = self.after.replace(selection, '', 1).replace('bodies=[...bodies,english,scalar];',
            'bodies=[...bodies,english];\n' + selection + '  bodies=[...bodies,scalar];', 1)
        result = run_install_probe(mutant)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('candidate scalar must be selected', result.stderr)

    def test_public_validator_is_never_installed_and_its_full_identity_cannot_change(self):
        bindings = e.scalar_bindings()
        self.assertEqual(bindings['scalarBefore']['sha'], e.BEFORE)
        self.assertEqual(bindings['scalarAfter']['sha'], e.AFTER)
        self.assertEqual(bindings['publicValidator']['sha'], e.VALIDATOR)
        self.assertIn('bodies=[...bodies,english,scalar];', self.after)
        self.assertNotIn('bodies=[...bodies,english,scalar,', self.after)
        self.assertIn("assert.deepEqual(actual['public.eps_validate_own_oauth_session'],originalBodyIdentity['public.eps_validate_own_oauth_session'])", self.after)
        result = run_install_probe(self.after, corrupt_public=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('deepStrictEqual', result.stderr)


if __name__ == '__main__':
    unittest.main()
