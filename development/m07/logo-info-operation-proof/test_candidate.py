"""Pure finite-edit/SQL-parser checks. No database/Docker/provider ports."""
from pathlib import Path
import ast,hashlib,importlib.util,re,unittest
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('logo_info_candidate',HERE/'candidate.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
RUN='8a100000-0000-4000-8000-000000000001'

class CandidateTests(unittest.TestCase):
 def test_exact_baseline_and_one_guard_inverse(self):
  old=c.baseline();new=c.patch_body(old)
  self.assertEqual(c.sha(old.encode()),c.BASE_BODY_SHA);self.assertNotEqual(old,new)
  self.assertEqual(new.replace(c.NEW,c.OLD),old)
  self.assertEqual(new.count('object.get_authenticated_info'),1)
  # Every row/authority/status/expiry expression is byte-identical.
  self.assertEqual(old[old.index('return exists'):],new[new.index('return exists'):])
  self.assertNotIn('get_authenticated_info',old)
 def test_foreign_source_or_already_patched_body_refused(self):
  old=c.baseline()
  for body in(old+' ',old.replace("asset.status='ready'","true"),c.patch_body(old),''):
   with self.assertRaises(ValueError):c.patch_body(body)
 def test_exact_function_attributes_and_no_new_public_interface(self):
  statement=parse_sql(c.candidate())[0].stmt
  self.assertEqual(type(statement).__name__,'CreateFunctionStmt');self.assertTrue(statement.replace)
  text=c.candidate();self.assertTrue(text.startswith(c.HEADER));self.assertNotIn('grant ',text.lower());self.assertNotIn('policy ',text.lower())
  self.assertEqual(text.count('security definer'),1);self.assertEqual(text.count("set search_path=''"),1)
  self.assertEqual(len(parse_plpgsql(text)),1)
 def test_proof_both_variants_real_RLS_and_guarded_rollback(self):
  text=c.proof(RUN);statements=parse_sql(text)
  self.assertEqual(type(statements[0].stmt).__name__,'TransactionStmt');self.assertEqual(type(statements[-1].stmt).__name__,'TransactionStmt')
  self.assertTrue(text.rstrip().endswith('rollback;'));self.assertEqual(text.count(c.candidate()),1)
  for marker in('OWNED_CANONICAL40_FIXTURE_REQUIRED','eps-presentation-canonical-pg17-local','baseline-own-open-INFO-denied','own-open-INFO','reader-ready-INFO','same-project-wrong-owner-open-INFO','unrelated-ready-denied','anonymous-ready-denied','expired-open-INFO-denied','revoked-write-open-denied','revoked-read-ready-denied','revoked-membership-ready-denied','cancelled-open-denied','wrong-key','wrong-bucket','sign-denied','spoofed-operation-header-denied','verifier-storage-denied','all function metadata/OID/ACL unchanged','all original policies unchanged'):
   self.assertIn(marker,text)
  self.assertIn('from storage.objects o where o.bucket_id=bucket and o.name=object_key',text)
  self.assertIn('create policy logo_info_test_broad',text);self.assertIn('drop policy logo_info_test_broad',text)
  self.assertNotRegex(text,r'(?im)^\s*(grant|revoke|alter role|alter policy)\b')
  self.assertIn("where id=pg_temp.logo_asset('ready')",text)
  self.assertEqual(len(parse_plpgsql(text)),8)
  self.assertIn("'baseline-verifier-storage-denied'",text)
  self.assertEqual(text.count('helper_wanted=>true'),2)
 def test_render_is_inert_defaultoff_and_closed_run(self):
  self.assertFalse(c.EXECUTION_ENABLED)
  tree=ast.parse((HERE/'candidate.py').read_text())
  self.assertFalse(any(isinstance(n,ast.Import)and any(x.name in('subprocess','socket','requests')for x in n.names)for n in ast.walk(tree)))
  self.assertFalse(any(isinstance(n,ast.Name)and n.id in('exec','eval','Popen')for n in ast.walk(tree)))
  for run in('not-a-run',RUN.upper(),RUN+"';commit;--"):
   with self.assertRaises(ValueError):c.proof(run)
  self.assertNotIn('__RUN__',c.proof(RUN));self.assertNotIn('__CANDIDATE_',c.proof(RUN))

if __name__=='__main__':unittest.main()
