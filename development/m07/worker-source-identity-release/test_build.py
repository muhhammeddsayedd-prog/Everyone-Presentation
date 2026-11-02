"""Local source/claim tests only. No stage, archive build or provider action."""
from pathlib import Path
import copy,hashlib,importlib.util,json,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker_identity_build_tests',HERE/'build.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class Fake:
 def __init__(self):self.files={};self.version=1
 def exists(self,name):return name in self.files
 def write(self,name,value):
  if name in self.files:raise ValueError('EXCLUSIVE')
  self.files[name]=copy.deepcopy(value)
 def pins(self):return {'source':self.version}
 def hash(self,name):return b.sha(b.compact(self.files[name]))
class Tests(unittest.TestCase):
 def test_real_quality_receipt_schema_and_exact_git_blob_source_admission(self):
  file=b.MAIN/'tracking/evidence/m07/completion-release/2026-11-02T17-16-36.995Z-199528a8-reason-web-root-quality.json';quality=json.loads(file.read_bytes());raw=(b.MAIN/'package.json').read_bytes()
  source={'files':[{'path':'package.json','sha256':b.sha(raw),'bytes':len(raw)}],'commit':'a'*40,'quality':{'path':file.relative_to(b.MAIN).as_posix(),'sha256':b.sha(file.read_bytes())}}
  result=b.quality_admission(quality,source,lambda _:raw);self.assertEqual(result['test_count'],988);self.assertTrue(result['carried_forward_to_exact_selected_bytes'])
  for mutate in('blob','raw','failed','inventory'):
   bad=copy.deepcopy(quality);read=lambda _:raw
   if mutate=='blob':next(row for row in bad['all_testable_source_files']if row['path']=='package.json')['git_blob']='0'*40
   if mutate=='raw':read=lambda _:raw+b'\n'
   if mutate=='failed':bad['checks'][0]['exit_code']=1
   if mutate=='inventory':bad['all_testable_source_files'].append(copy.deepcopy(bad['all_testable_source_files'][0]))
   with self.subTest(mutate=mutate),self.assertRaises(ValueError):b.quality_admission(bad,source,read)
 def test_unknown_dispatch_keeps_permanent_claim_and_never_fabricates_normal(self):
  p=Fake();calls=[]
  def unknown():calls.append(1);raise TimeoutError('UNKNOWN')
  with self.assertRaises(TimeoutError):b.once(p,'native-export',unknown)
  self.assertIn('native-export.claim.json',p.files);self.assertNotIn('native-export.normal.json',p.files)
  with self.assertRaises(ValueError):b.once(p,'native-export',unknown)
  self.assertEqual(calls,[1])
 def test_source_drift_after_dispatch_refuses_normal_marker(self):
  p=Fake()
  def drift():p.version=2;return {'result':'passed'}
  with self.assertRaises(ValueError):b.once(p,'emit',drift)
  self.assertNotIn('emit.normal.json',p.files)
 def test_normal_return_binds_permanent_claim_hash(self):
  p=Fake();self.assertEqual(b.once(p,'stage',lambda:{'build_run':'owned'}),{'build_run':'owned'});self.assertEqual(p.files['stage.normal.json']['claim_sha256'],p.hash('stage.claim.json'))
 def test_default_off_stops_before_source_or_local_dispatch(self):
  build=b.Build.__new__(b.Build);build.build_run=None;calls=[];build.source_admission=lambda:calls.append('read');build.local=lambda *_:calls.append('dispatch')
  self.assertFalse(b.BUILD_ENABLED)
  for action in(lambda:build.stage(),lambda:build.export('native'),lambda:build.manifest(),lambda:build.prepare_oci('native'),lambda:build.emit()):
   with self.assertRaises(ValueError):action()
  self.assertEqual(calls,[])
if __name__=='__main__':unittest.main()
