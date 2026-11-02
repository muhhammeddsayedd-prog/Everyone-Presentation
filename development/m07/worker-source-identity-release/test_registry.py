"""Registry state machine with fake ports; no CLI, authentication or copy."""
from pathlib import Path
import copy,importlib.util,types,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker_identity_registry_tests',HERE/'registry.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
class Fake:
 def __init__(self):self.files={};self.calls=[];self.unknown=False;self.remote_digest='a';self.build=types.SimpleNamespace(source={'source_sha256':'s'})
 def pins(self):return {'source':'pinned'}
 def exists(self,name):return name in self.files
 def write(self,name,value):
  if name in self.files:raise ValueError('EXCLUSIVE')
  self.files[name]=copy.deepcopy(value)
 def read(self,name):return copy.deepcopy(self.files[name])
 def hash(self,name):return r.sha(r.b.compact(self.files[name]))
 def exported(self,kind):return {'runtime_digest':'sha256:'+'a'*64}
 def prepare(self):self.calls.append('prepare_private_config')
 def metadata(self):self.calls.append('read_metadata');return {'target':'existing'}
 def login(self):
  self.calls.append('normal_cli_login')
  if self.unknown:raise TimeoutError('UNKNOWN')
  return {'login':'normal'}
 def control(self):self.calls.append('read_control')
 def copy(self,kind,value):
  self.calls.append('copy_'+kind)
  if self.unknown:raise TimeoutError('UNKNOWN')
 def remote(self,kind,value):self.calls.append('read_remote');return {'digest':self.remote_digest}
 def ready(self,kind,value):return {'image':{'runtime_digest':value['runtime_digest']}}
class Tests(unittest.TestCase):
 def setUp(self):self.before=r.REGISTRY_ENABLED;r.REGISTRY_ENABLED=True
 def tearDown(self):r.REGISTRY_ENABLED=self.before
 def initialized(self):
  p=Fake();r.operate('prepare','native',p);r.operate('refresh','native',p);return p
 def test_disabled_stops_before_any_port(self):
  r.REGISTRY_ENABLED=False;p=Fake()
  with self.assertRaises(ValueError):r.operate('prepare','native',p)
  self.assertEqual(p.calls,[]);self.assertEqual(p.files,{})
 def test_unknown_refresh_keeps_claim_and_readback_cannot_infer_normal(self):
  p=Fake();r.operate('prepare','native',p);p.unknown=True
  with self.assertRaises(TimeoutError):r.operate('refresh','native',p)
  with self.assertRaises(ValueError):r.operate('refresh','native',p)
  with self.assertRaises(ValueError):r.operate('refresh-readback','native',p)
  self.assertEqual(p.calls.count('normal_cli_login'),1);self.assertNotIn('refresh.normal.json',p.files)
 def test_unknown_copy_readback_observes_without_normal_repair_or_recopy(self):
  p=self.initialized();p.unknown=True
  with self.assertRaises(TimeoutError):r.operate('copy','native',p)
  result=r.operate('readback','native',p);self.assertEqual(result['result'],'unconfirmed');self.assertFalse(result['normal_copy_return_observed']);self.assertEqual(p.calls.count('copy_native'),1)
  with self.assertRaises(ValueError):r.operate('copy','native',p)
  self.assertEqual(p.calls.count('copy_native'),1)
 def test_normal_copy_requires_two_readbacks_and_can_be_read_without_resubmission(self):
  p=self.initialized();result=r.operate('copy','native',p);self.assertEqual(result['result'],'passed');self.assertEqual(p.calls.count('read_remote'),2);self.assertEqual(r.operate('readback','native',p)['result'],'passed');self.assertEqual(p.calls.count('copy_native'),1)
 def test_actual_frozen_body_validation_uses_verified_OCI_constants_without_old_emitter_guard(self):
  transfer=r.module('worker_identity_frozen_body_test',r.b.MAIN/'development/m03/english-oci34/transfer.py');oci=types.SimpleNamespace(INDEX='application/vnd.oci.image.index.v1+json',MANIFEST='application/vnd.oci.image.manifest.v1+json');raw=r.b.compact({'schemaVersion':2,'mediaType':oci.MANIFEST});digest='sha256:'+r.sha(raw)
  helpers=types.SimpleNamespace(check_response=lambda result:result['stdout'],transport=lambda:transfer,remote_manifest=lambda *_:self.fail('old whole-emitter guard must not run'))
  self.assertEqual(r.project_remote({'stdout':raw},digest,helpers,oci),digest)
  self.assertEqual(r.project_remote({'stdout':raw+b'\n'},digest,helpers,oci),digest)
  with self.assertRaises(Exception):r.project_remote({'stdout':raw.replace(b'"schemaVersion":2',b'"schemaVersion":3')},digest,helpers,oci)
if __name__=='__main__':unittest.main()
