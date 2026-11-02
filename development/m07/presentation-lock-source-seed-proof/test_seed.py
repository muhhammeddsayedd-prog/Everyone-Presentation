"""Pure finite projection/parser/disabled-entry checks; no SQL/Docker."""
from pathlib import Path
import hashlib,importlib.util,json,re,subprocess,unittest
from unittest.mock import patch
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent;NODE='C:/Program Files/nodejs/node.exe'
spec=importlib.util.spec_from_file_location('seed_forward_compiler',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
def node(source):
 p=subprocess.run([NODE,'--input-type=module','--eval',source],capture_output=True,text=True,timeout=20)
 if p.returncode:raise AssertionError(p.stderr)
 return json.loads(p.stdout)if p.stdout.strip()else None
MODULE=json.dumps((HERE/'entry.mjs').as_uri())
class Tests(unittest.TestCase):
 def test_actual_seed_guard_alias_only_inverse_and_seven_qualified_column_refs(self):
  before=(c.OLD/'scale.sql').read_text();out=node("import{qualifySeed,BEFORE,AFTER}from"+MODULE+";const source="+json.dumps(before)+";const qualified=qualifySeed(source);process.stdout.write(JSON.stringify({qualified,before:BEFORE,after:AFTER}));")
  after=out['qualified'];self.assertEqual(after.replace(out['after'],out['before']),before)
  self.assertEqual(re.findall(r'seed\.([a-z_]+)',out['after']),['candidates','media','frames','assets','ready','slides','pins'])
  self.assertEqual(re.findall(r'<>(\d+)',out['before']),re.findall(r'<>(\d+)',out['after']))
  self.assertEqual(len(parse_sql(after)),3);self.assertEqual(len(parse_plpgsql(after)),1)
  # Actual prior failure: frames is both declared variable and unqualified seed
  # column. The forward guard now resolves the latter through one table alias.
  self.assertIn('frames uuid[]',before);self.assertIn('or frames<>0',out['before']);self.assertNotIn('or frames<>0',out['after'])
 def test_disabled_entry_refuses_before_context_or_transport_and_drift_refuses(self):
  node("import assert from'node:assert/strict';import{runCases,EXECUTION_ENABLED,qualifySeed}from"+MODULE+";assert.equal(EXECUTION_ENABLED,false);let touched=0;await assert.rejects(runCases(new Proxy({},{get(){touched++;throw Error('unreached');}})),/SEED_EXECUTION_DISABLED/);assert.equal(touched,0);assert.throws(()=>qualifySeed('drift'));")
 def test_fresh_purpose_projection_preserves_libraries_and_all_functional_sql(self):
  source=c.compile_source('.local/presentation-lock-source-seed-proof-compiled/controller-11111111-1111-4111-8111-111111111111.mjs')
  self.assertIn('presentation-lock-source-seed-proof/entry.mjs',source);self.assertIn('presentation-lock-source-seed-proof/entry.mjs',source)
  self.assertIn('eps.locksource41seed.run',source);self.assertNotIn("'label=eps.locksource41.run='",source)
  self.assertIn("'--network', 'none'",source);self.assertIn('original_data_catalogue_and_global_roles_unchanged',source)
  self.assertLess(source.index('LOCKSOURCE41_SEED_EXECUTION_DISABLED'),source.index('await original()'))
  r=subprocess.run([NODE,'--input-type=module','--check'],input=source,capture_output=True,text=True,timeout=15);self.assertEqual(r.returncode,0,r.stderr)
  with patch.object(c,'OLD_PROOF_SHA','0'*64):
   with self.assertRaises(ValueError):c.compile_source('.local/unreachable.mjs')
 def test_consumed_sources_and_actual_failure_receipt_remain_exact(self):
  root=HERE.parents[2];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
  self.assertEqual(sha(c.OLD/'compiler.py'),c.OLD_COMPILER_SHA);self.assertEqual(sha(c.OLD/'proof.mjs'),c.OLD_PROOF_SHA)
  self.assertEqual(sha(root/'tracking/evidence/m07/presentation-lock-source-proof/2026-11-02T12-31-05.332Z-99873a5f.json'),'3670111ac9c7cc556bb94b392fa0b1da11fba2a3b541efdf11e84614ca0b2014')
if __name__=='__main__':unittest.main()
