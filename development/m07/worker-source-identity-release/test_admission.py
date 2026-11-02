"""Public files and pure negatives only; no private, CLI, Docker or SQL."""
from pathlib import Path
import copy,hashlib,importlib.util,json,subprocess,sys,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker_identity_release_admission',HERE/'admission.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  raw=(MAIN/a.APPLY['path']).read_bytes();assert hashlib.sha256(raw).hexdigest()==a.APPLY['sha256'];cls.actual=json.loads(raw)
 def test_actual_accepted40_scope_and_distinct_proofs(self):
  value=a.canonical40(self.actual);self.assertEqual(len(value['history']),40);self.assertNotEqual(value['functional_sql40_proof'],value['collector_validation'])
 def test_missing_nonce_or_unequal_readback_or_wrong_migration_refuses(self):
  for change in({'normal_return_marker_observed':False},{'second':{}},{'migration_sha256':'f'*64},{'version':'39'}):
   with self.assertRaises(ValueError):a.canonical40({**self.actual,**change})
 def test_equal_readbacks_with_rewritten_history_or_other_anchor_values_refuse(self):
  for path in('history','authority'):
   changed=copy.deepcopy(self.actual)
   if path=='history':changed['first']['history'][0]='19000101000000'
   else:changed['first']['authority']['roles']='f'*64
   changed['second']=copy.deepcopy(changed['first'])
   with self.assertRaises(ValueError):a.canonical40(changed)
 def test_no_proof_relabel_or_restore_claim_or_checkpoint_swap(self):
  for field,value in(('local_proof',a.COLLECTOR),('checkpoint',{**a.CHECKPOINT,'sha256':'f'*64}),('private_checkpoint_is_restore_proof',True)):
   with self.assertRaises(ValueError):a.canonical40({**self.actual,field:value})
  changed=copy.deepcopy(self.actual);changed['admission']['collector_validation']=a.FUNCTIONAL
  with self.assertRaises(ValueError):a.canonical40(changed)
 def test_draft_is_honest_no_source_freeze_or_images_or_rollback(self):
  value=a.draft(self.actual);self.assertIsNone(value['final_Main_source']);self.assertIsNone(value['new_native_probe']);self.assertFalse(value['operations_implemented']);self.assertFalse(value['execution_enabled'])
  self.assertEqual(value['phase_order'],list(a.PHASES));self.assertNotIn('unwind',value['phase_order']);self.assertFalse(value['rollback_or_AT069_operation_included'])
 def test_default_entry_refuses_without_any_evidence_input(self):
  result=subprocess.run([sys.executable,'-X','utf8','-B',str(HERE/'admission.py')],capture_output=True,check=False)
  self.assertEqual(result.returncode,1);self.assertEqual(json.loads(result.stdout)['result'],'source_only_disabled');self.assertEqual(result.stderr,b'')

if __name__=='__main__':unittest.main()
