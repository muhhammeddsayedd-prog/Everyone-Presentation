"""Finite probe transformation only. No preparation, SDK, token or provider."""
from pathlib import Path
import importlib.util,json,subprocess,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker_identity_native_source_tests',HERE/'native_probe.py');n=importlib.util.module_from_spec(spec);spec.loader.exec_module(n)
class Tests(unittest.TestCase):
 def fixture(self):
  names=['apps/worker/src/native-identity.mjs','apps/worker/src/native-task-limits.mjs','apps/worker/src/native-sandbox-launch.mjs','apps/worker/src/native-source-seal.ts',*['contracts/json-schema/'+name+'.schema.json'for name in('candidate-extraction','frame-selection','slide-wording','specs-extraction')]];rows=[{'path':name,'sha256':'a'*64,'bytes':1}for name in sorted(names)];ref={'path':'tracking/evidence/m07/worker-source-identity-release/synthetic.json','sha256':'b'*64}
  source={'commit':'c'*40,'tree':'d'*40,'archive':{'path':'.local/synthetic.tar','sha256':'e'*64},'source_sha256':n.sha(n.b.compact(rows)),'files':rows,'native_graph_sha256':'f'*64,'daemon_graph_sha256':'0'*64,'quality':ref};run='00000000-0000-4000-8000-000000000001'
  return {'private':'.local/worker-source-identity-native/'+run,'image':'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:'+'1'*64,'native_ready':ref,'release_data':n.release_data(source,run,ref),'compiler_sha256':'2'*64}
 def test_real_frozen_operator_and_admission_have_exact_inverse_closed_seams(self):
  result=n.compile_sources(n.load(n.b.MAIN/n.BASE_OPERATOR),n.load(n.b.MAIN/n.BASE_ADMISSION),self.fixture());self.assertTrue(result['inverse_byte_equal']);self.assertEqual(len(result['operator_changes']),12);self.assertEqual(len(result['admission_changes']),6)
  source=result['operator'].decode();self.assertIn('if (!false || plan.mode!=="smoke"',source);self.assertIn('worker-separate-source-native-smoke',source);self.assertEqual(source.count('native-probe-dispatch.claim.json'),1)
  self.assertNotIn('completion-native46de-',source);self.assertIn('maximum_http_calls',source);self.assertIn('session_consistency_failed',source)
  for key in('operator','admission','release'):
   checked=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','--check'],input=result[key],capture_output=True,timeout=10);self.assertEqual(checked.returncode,0,checked.stderr[:200])
 def test_old_or_mutated_source_and_path_drift_refused_before_outputs(self):
  scope=self.fixture();base=n.load(n.b.MAIN/n.BASE_OPERATOR);admit=n.load(n.b.MAIN/n.BASE_ADMISSION)
  for value in(base+b'\n',b''):
   with self.assertRaises(ValueError):n.compile_sources(value,admit,scope)
  scope['private']='.local/../foreign'
  with self.assertRaises(ValueError):n.compile_sources(base,admit,scope)
 def test_disabled_preparation_never_opens_input_or_creates_resource(self):
  self.assertFalse(n.PROBE_ENABLED)
  with self.assertRaises(ValueError):n.prepare({},None)
if __name__=='__main__':unittest.main()
