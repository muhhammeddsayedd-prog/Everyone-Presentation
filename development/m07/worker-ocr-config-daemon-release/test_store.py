"""Real synthetic files, actual State without.load, fake guard; no live ACL/ports."""
from pathlib import Path
import copy,hashlib,importlib.util,json,tempfile,types,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
def module(name,p):
 s=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
p=module('ocr_real_store_provider',HERE/'provider.py');states=module('ocr_real_store_state_fixture',HERE/'test_state.py')
class Guard:
 def create(self,p):return p.open('xb')
 def verify(self,p):assert p.is_file()
 def verify_open(self,f):assert f.writable()
class Tests(unittest.TestCase):
 def test_actual_module_loader_handles_owner_claim_response_normal_and_hash_with_State_no_load(self):
  state,_,_,_=states.Tests().fixture();self.assertFalse(hasattr(state,'load'));self.assertIs(p.s,p.old.old.s)
  with tempfile.TemporaryDirectory()as root:
   port=p.Provider.__new__(p.Provider);port.s=state;port.e=p.env;port.private=Path(root)/'owned';port.inputs={'run':'00000000-0000-4000-8000-000000000001'};port.guard=Guard();port.bindings=lambda:{'synthetic_source':'bound'}
   action={'method':'PATCH','key':'EPS_DAEMON_SOURCE_SHA256','id':'synthetic-row','body':{'value':'a'*64}}
   port.write('env-0.claim.json',{'action':action});port.write('env-0.response.json',{'claim_sha256':port.hash('env-0.claim.json'),'response':{'id':action['id'],'key':action['key'],'value':'a'*64}})
   port.write('env-0.normal.json',{'claim_sha256':port.hash('env-0.claim.json'),'normal_return_observed':True});value=port.read('env-0.normal.json')
   self.assertEqual(value['response_sha256'],port.hash('env-0.response.json'));self.assertEqual(port.hash('env-0.claim.json'),hashlib.sha256((port.private/'env-0.claim.json').read_bytes()).hexdigest());self.assertEqual(port.read('owner.json')['owner'],p.a.PURPOSE)
   with self.assertRaises(ValueError):port.write('env-0.claim.json',{'action':action})
   response=json.loads((port.private/'env-0.response.json').read_text());response['response']['value']='PRIVATE_SYNTHETIC_TAMPER';(port.private/'env-0.response.json').write_text(json.dumps(response))
   with self.assertRaises(ValueError):port.read('env-0.normal.json')

class ArtifactTests(unittest.TestCase):
 def fixture(self):
  fixtures=module('ocr_prior_kind_admission_fixture',p.a.COMPATIBLE/'test_provider.py');port,records,events=fixtures.Tests().admission_fixture();port.__class__=p.Provider
  port.inputs.update(run=p.DAEMON_RUN,build_run=p.DAEMON_BUILD);port.inputs['source']['source_sha256']=p.DAEMON_SOURCE;port.inputs['daemon'].update(digest=p.DAEMON_DIGEST,source_sha256=p.DAEMON_SOURCE,registry_copy=copy.deepcopy(p.DAEMON_READBACK),ready=copy.deepcopy(p.DAEMON_READY))
  for ref in(p.DAEMON_READBACK,p.DAEMON_READY):records[ref['path']]=p.old.old.read_ref(ref)
  exported={'runtime_digest':p.DAEMON_DIGEST,'source_sha256':p.DAEMON_SOURCE,'archive':{'index_digest':'sha256:'+'b'*64}}
  class Build:
   def source_admission(self):events.append('source');return{}
   def context(self,kind):return port.bindings()
   def accepted_export(self,kind):return exported if kind=='daemon'else{'runtime_digest':port.inputs[kind]['digest'],'source_sha256':port.inputs[kind]['source_sha256']}
  port.build=lambda:Build();native=port.registry_ports('native')
  class Registry:
   normal=False;hash_value=p.COPY_CLAIM;changed_pins=False;remote_drift=False;ready_drift=False;normal_after=False
   def pins(self):return{'raw_frozen_registry':'fixed'}
   def read(self,name):assert name=='daemon-copy.claim.json';return{'source_pins':self.pins(),'automatic_retry':False,'dispatch_may_have_occurred':True}
   def hash(self,name):return self.hash_value
   def exists(self,name):assert name=='daemon-copy.normal.json';return self.normal
   def exported(self,kind):assert kind=='daemon';return copy.deepcopy(exported)
   def remote(self,kind,value):
    assert kind=='daemon';events.append('remote');return{'index_digest':value['archive']['index_digest'],'runtime_digest':'sha256:'+'0'*64 if self.remote_drift else value['runtime_digest']}
   def ready(self,kind,value):
    assert kind=='daemon';events.append('ready');row=records[p.DAEMON_READY['path']];result={key:copy.deepcopy(row[key])for key in('image','repository_id','project_id','team_id','private_repository')}
    if self.ready_drift:result['image']['runtime_digest']='sha256:'+'0'*64
    if self.normal_after:self.normal=True
    return result
  registry=Registry();port.registry_ports=lambda kind:registry if kind=='daemon'else native
  # Reuse frozen native/SQL/live platform fakes, with exact observed daemon repo.
  port.l.registry.DAEMON_REPO=records[p.DAEMON_READY['path']]['repository_id'];port.api=lambda method,endpoint:{'images':[{'manifestDigest':p.DAEMON_DIGEST,'repositoryId':port.l.registry.DAEMON_REPO,'kind':'manifest','status':'ready','architecture':'amd64','platform':'linux'}]}
  return port,records,events,registry
 def scoped(self,records):return patch.object(p.old.old,'read_ref',lambda ref:copy.deepcopy(records[ref['path']]))
 def test_actual_frozen_admission_retains_native_normal_and_SQL_checks_with_unknown_daemon_copy(self):
  port,records,events,r=self.fixture()
  with self.scoped(records):result=port.admission('prepare')
  evidence=result['daemon_artifact_admission'];self.assertEqual(evidence['original_copy_outcome'],'unknown');self.assertFalse(evidence['normal_copy_return_observed']);self.assertFalse(evidence['copy_replayed']);self.assertEqual(events[:4],['remote','remote','ready','ready']);self.assertIn('source',events);self.assertFalse(r.normal);self.assertTrue(result['native_reused']);self.assertEqual(result['current40_worker_SQL'],p.old.a.WORKER_PROOF)
  records[port.inputs['native']['registry_copy']['path']]['normal_copy_return_observed']=False
  with self.scoped(records),self.assertRaises(ValueError):port.admission('prepare')
 def test_fixed_observation_shape_unknown_copy_and_exact_input_bindings_are_required(self):
  for field,value in(('result','passed'),('normal_copy_return_observed',True),('read_only',False),('two_remote_reads_equal',False),('source_sha256','0'*64)):
   port,records,events,r=self.fixture();records[p.DAEMON_READBACK['path']][field]=value
   with self.scoped(records),self.assertRaises(ValueError):port.observed_daemon_artifact()
   self.assertEqual(events,[])
  for field,value in(('two_current_ready_reads_equal',False),('copy_replayed',True),('original_copy_outcome','completed'),('original_copy_claim_sha256','0'*64)):
   port,records,events,r=self.fixture();records[p.DAEMON_READY['path']][field]=value
   with self.scoped(records),self.assertRaises(ValueError):port.observed_daemon_artifact()
   self.assertEqual(events,[])
  port,records,events,r=self.fixture();port.inputs['daemon']['registry_copy']={'path':'foreign','sha256':'0'*64}
  with self.scoped(records),self.assertRaises(ValueError):port.observed_daemon_artifact()
  self.assertEqual(events,[])
 def test_claim_mismatch_existing_or_late_normal_and_fresh_remote_or_Ready_drift_refuse_without_writes(self):
  for field,value in(('hash_value','0'*64),('normal',True),('normal_after',True),('remote_drift',True),('ready_drift',True)):
   port,records,events,r=self.fixture();setattr(r,field,value)
   with self.scoped(records),self.assertRaises(ValueError):port.observed_daemon_artifact()
 def test_observer_disabled_refuses_before_any_remote_reads(self):
  port,records,events,r=self.fixture();port.o.OBSERVE_ENABLED=False
  with self.scoped(records),self.assertRaises(ValueError):port.admission('prepare')
  self.assertEqual(events,[])
 def test_projection_only_changes_two_daemon_normal_loops_and_binds_actual_raw_source(self):
  actual=p.observed_admission();self.assertIsNot(actual.__globals__,p.old.Provider.admission.__globals__)
  raw=p.s.load(p.a.COMPATIBLE/'provider.py');text=raw.decode().replace('\r\n','\n');text=text[text.index(' def admission(self,phase):'):text.index(' def ready(self,url,marker):')]
  self.assertEqual(text.count("  for kind in('native','daemon'):"),2)
  with patch.object(p.s,'load',lambda file:raw+b'\n# drift'),self.assertRaises(ValueError):p.observed_admission()
 def test_public_phase_receipt_retains_copy_unknown_separately_from_normal_deploy(self):
  port,records,events,r=self.fixture();port.cached_health=[]
  with tempfile.TemporaryDirectory()as root,patch.object(p.a,'MAIN',Path(root)):
   result=port.save('deploy',{'result':'submitted','normal_return_observed':True});saved=json.loads((Path(root)/result['receipt']).read_text())
   self.assertTrue(saved['normal_return_observed']);self.assertEqual(saved['daemon_original_copy_outcome'],'unknown');self.assertFalse(saved['daemon_normal_copy_return_observed']);self.assertFalse(saved['daemon_copy_replayed'])
 def test_fixed_public_receipt_hashes_are_real_and_registry_claim_sources_are_outside_mutable_provider(self):
  for ref in(p.DAEMON_READBACK,p.DAEMON_READY):self.assertIsInstance(p.old.old.read_ref(ref),dict)
  raw=(p.HERE/'registry.py').read_text();self.assertIn("('anchors.py','registry.py','test_registry.py')",raw);self.assertNotIn("'provider.py'",raw)

if __name__=='__main__':unittest.main()
