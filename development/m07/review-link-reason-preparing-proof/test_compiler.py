"""Pure new-purpose gates; no SQL/Docker/provider execution."""
from pathlib import Path
import importlib.util,json,re,subprocess,unittest
from unittest.mock import patch
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('reason40_preparing_compiler',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.text=c.compile_source('.local/review-link-reason40-preparing-source/source-only.mjs');cls.proof=(HERE/'proof.mjs').read_text(encoding='utf-8');cls.old=(c.PRIOR/'proof.mjs').read_text(encoding='utf-8')
 def test_old_failure_sources_and_candidate_remain_exact(self):
  r=json.loads(c.load(c.FAILURE));self.assertEqual(r['result'],'failed');self.assertTrue(r['all_owned_resources_absent']);self.assertTrue(r['original_data_catalogue_and_global_roles_unchanged']);self.assertTrue(r['shared_lock_released'])
  self.assertEqual(c.sha(c.load(c.ROOT/c.MIGRATION)),c.MIGRATION_SHA)
  with patch.object(c,'PRIOR_PROOF','0'*64):
   with self.assertRaises(ValueError):c.compile_source('.local/no-write.mjs')
 def test_disabled_entry_refuses_before_target_or_docker(self):
  program=self.text[:self.text.index('if (process.argv[1] &&')]+"\nrunRace('D:/Everyone/Presentation/Everyone-Presentation-Studio').then(()=>process.exitCode=2).catch(error=>{if(error.message!=='REASON40_EXECUTION_DISABLED')throw error;process.stdout.write('DISABLED_BEFORE_TARGET');});"
  r=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module'],input=program.encode(),capture_output=True,timeout=10);self.assertEqual(r.returncode,0,r.stderr.decode());self.assertEqual(r.stdout,b'DISABLED_BEFORE_TARGET')
 def test_new_claim_namespace_and_complete_original_cleanup_remain(self):
  for marker in ['reason40-preparing-compatibility-proof','eps.reason40preparing.run','eps-reason40p-','review-link-reason40-preparing-owned-proof','prior_failed_run','all_preexisting_old_column_rows_preserved','original_data_catalogue_and_global_roles_unchanged','all_owned_resources_absent','shared_lock_released']:
   self.assertIn(marker,self.text)
  self.assertNotIn("'.local/review-link-reason40-proof'",self.text)
  self.assertLess(self.text.index('assert(reason40.EXECUTION_ENABLED'),self.text.index('port.verifyLocalTarget()'))
  self.assertNotIn('where table_name not in',self.text)
 def test_original_reason_mac_replay_boundary_and_race_cases_are_unchanged(self):
  for start,end in [('  const first=await create();','  const access=[];'),('  const races=[];','  const final=await value(')]:
   self.assertEqual(self.proof[self.proof.index(start):self.proof.index(end)],self.old[self.old.index(start):self.old.index(end)])
 def test_normal_preparing_rpc_and_new_actor_cap_qualification_never_rewrite_ready(self):
  self.assertIn("assert.deepEqual(beforeGeneration,{plain_external:1,for_share:0})",self.proof);self.assertIn("assert.deepEqual(afterGeneration,{plain_external:1,for_share:1})",self.proof)
  self.assertIn('public.eps_create_presentation_series(',self.proof);self.assertIn("'presentations.generate'",self.proof);self.assertIn('assert.equal(preparing.latest_ready_version_id,null)',self.proof);self.assertIn('versions:0',self.proof)
  fixture=(HERE/'fixture.sql').read_text();self.assertIn("s.audience_snapshot->>'scope'='external'",fixture);self.assertIn('not exists(select 1 from eps.presentation_series es',fixture)
  self.assertNotRegex(self.proof+fixture,r'(?i)\b(update|insert\s+into)\s+eps\.presentation_(series|versions)\b')
 def test_public_access_is_observed_before_in_rollback_then_denied_after(self):
  self.assertIn('create(setup.retained_series)',self.proof)
  for operation in ['session','grant_asset']:self.assertIn("begin;select pg_temp.reason40_guest('"+operation+"'",self.proof)
  self.assertIn('public_anonymous_session_and_media_accepted_before_with_outer_rollback:true',self.proof);self.assertIn("'REASON40_MEDIA_GUARD_WRONG_ASSET'",self.proof)
 def test_actual_sql_helpers_fixture_visibility_observer_and_javascript_parse(self):
  self.assertEqual(len(parse_sql((HERE/'fixture.sql').read_text())),11)
  temp=re.search(r'const TEMP=`(.*?)`;\nfunction acting',self.proof,re.S)[1];self.assertEqual(len(parse_sql(temp)),5);self.assertEqual(len(parse_plpgsql(temp)),5)
  templates=[re.search(r'observer\.request\(`(.*?)`\)',self.proof,re.S)[1],re.search(r'const visible=async\(\)=>only\(await a\.request\(`(.*?)`\)',self.proof,re.S)[1]]
  program="const templates="+json.dumps(templates)+";const literal=v=>String.fromCharCode(39)+v+String.fromCharCode(39);process.stdout.write(JSON.stringify(templates.map(text=>Function('b','setup','literal','return `'+text+'`')({pid:417},{retained_series:'a4400000-0000-4000-8000-000000000010'},literal))));"
  r=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',program],capture_output=True,timeout=10);self.assertEqual(r.returncode,0,r.stderr.decode())
  for sql in json.loads(r.stdout):parse_sql(sql)
  r=subprocess.run(['C:/Program Files/nodejs/node.exe','--check','--input-type=module'],input=self.text.encode(),capture_output=True,timeout=10);self.assertEqual(r.returncode,0,r.stderr.decode())
if __name__=='__main__':unittest.main()
