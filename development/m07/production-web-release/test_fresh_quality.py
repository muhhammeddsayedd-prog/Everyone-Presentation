"""Actual public quality evidence and immutable Git only; no command rerun."""
from pathlib import Path
import copy, importlib.util, json, subprocess, unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('fresh_quality_tests',HERE/'fresh_quality.py');f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
ROOT=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.quality=json.loads(f.r.load(ROOT/f.RAW['path']));cls.source=json.loads(f.r.load(ROOT/'tracking/evidence/m07/production-web-release/source-c5fee9c1-db68-41c5-9386-8c56bab0b418.json'))
 def test_actual_fresh955_and_full_inventory_are_admitted_without_rerunning_commands(self):
  original=subprocess.run;calls=[]
  def git_only(args,**kwargs):self.assertEqual(args[0],'git');calls.append(args);return original(args,**kwargs)
  with patch.object(subprocess,'run',side_effect=git_only):value=f.admit(ROOT,self.source,self.quality)
  self.assertFalse(value['carried_forward']);self.assertFalse(value['additional_quality_commands_run']);self.assertEqual(value['actual_tests'],955);self.assertEqual(value['testable_source_file_count'],1328);self.assertTrue(value['complete_testable_tree_preserved']);self.assertGreater(len(calls),5)
 def test_changed_manifest_tree_reviewed_seals_or_clean_head_fail(self):
  for mutate in[lambda v:v['all_testable_source_files'][0].update(git_blob='0'*40),lambda v:v.update(source_tree='0'*40),lambda v:v['reviewed_source_seals'][0].update(sha256='0'*64),lambda v:v.update(testable_graph_worktree_clean=False),lambda v:v.update(source_head_after='0'*40),lambda v:v['reviewed_source_seals'].pop()]:
   changed=copy.deepcopy(self.quality);mutate(changed)
   with self.assertRaises(ValueError):f.admit(ROOT,self.source,changed)
 def test_skips_failures_noop_commands_and_missing_fourth_gate_fail(self):
  for mutate in[lambda v:next(x for x in v['checks']if x['name']=='test').update(skipped=1),lambda v:v['checks'][0].update(exit_code=1),lambda v:v['checks'][0].update(command=['node','npm','run','noop']),lambda v:v['checks'].pop(),lambda v:v['checks'][0].update(timed_out=True)]:
   changed=copy.deepcopy(self.quality);mutate(changed)
   with self.assertRaises(ValueError):f.admit(ROOT,self.source,changed)
 def test_old_product_snapshot_or_tampered_archive_bytes_fail(self):
  for mutate in[lambda v:v.update(source_commit='c8d0ff3b7800072655ac1abae2f44c9aa5a3f8c0'),lambda v:v.update(archive_sha256='0'*64),lambda v:v['files'][0].update(sha256='0'*64)]:
   changed=copy.deepcopy(self.source);mutate(changed)
   with self.assertRaises(ValueError):f.admit(ROOT,changed,self.quality)
if __name__=='__main__':unittest.main()
