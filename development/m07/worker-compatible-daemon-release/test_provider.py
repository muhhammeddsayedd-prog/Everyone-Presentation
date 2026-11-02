"""Closed dual-source admission with fake build/registry/API ports only."""
from pathlib import Path
import copy,hashlib,importlib.util,json,types,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('compatible_provider_tests',HERE/'provider.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
def ref(name):return{'path':'tracking/evidence/synthetic-'+name+'.json','sha256':'a'*64}
def inputs():
 files=[{'path':'package.json','sha256':'1'*64,'bytes':2}];source=hashlib.sha256(json.dumps(files,separators=(',',':')).encode()).hexdigest()
 return{'run':'00000000-0000-4000-8000-000000000001','build_run':'00000000-0000-4000-8000-000000000002','source':{'commit':'1'*40,'tree':'2'*40,'archive':{'path':'.local/synthetic-source.tar','sha256':'3'*64},'source_sha256':source,'files':files,'native_graph_sha256':p.a.NATIVE_GRAPH,'daemon_graph_sha256':'4'*64,'quality':ref('quality')},'native':{'digest':p.a.NATIVE_DIGEST,'source_sha256':p.a.NATIVE_SOURCE,'export':p.a.NATIVE_EXPORT,'registry_copy':p.a.NATIVE_COPY,'ready':p.a.NATIVE_READY,'manifest_sha256':p.a.NATIVE_MANIFEST,'compatibility_sha256':'5'*64,'graph_sha256':p.a.NATIVE_GRAPH},'daemon':{'digest':'sha256:'+'6'*64,'source_sha256':source,'export':ref('daemon-export'),'registry_copy':ref('daemon-copy'),'ready':ref('daemon-ready')},'native_probe':{'receipt':ref('probe-receipt'),'plan':ref('probe-plan'),'release':ref('probe-release'),'admitted':p.a.NATIVE_ADMITTED},'worker_sql_proof':p.a.WORKER_PROOF}

class Tests(unittest.TestCase):
 def test_exact_retained_native_and_new_daemon_keep_true_bindings_without_input_mutation(self):
  value=inputs();before=copy.deepcopy(value);self.assertIs(p.validate_inputs(value),value);self.assertEqual(value,before)
  port=p.Provider.__new__(p.Provider);port.inputs=value;bindings=port.bindings();self.assertEqual(bindings['native_source_sha256'],p.a.NATIVE_SOURCE);self.assertEqual(bindings['daemon_source_sha256'],value['source']['source_sha256']);self.assertNotEqual(bindings['native_source_sha256'],bindings['daemon_source_sha256']);self.assertEqual(bindings['environment']['EPS_DAEMON_SOURCE_SHA256'],bindings['daemon_source_sha256'])
 def test_wrong_native_source_graph_manifest_digest_refs_or_changed_kind_admission_refuse(self):
  for field in('source_sha256','graph_sha256','manifest_sha256','digest','export','registry_copy','ready'):
   value=inputs();value['native'][field]=ref('foreign')if field in('export','registry_copy','ready')else'sha256:'+'0'*64 if field=='digest'else'0'*64
   with self.assertRaises(ValueError):p.validate_inputs(value)
  for field in('source_sha256','digest'):
   value=inputs();value['daemon'][field]=p.a.NATIVE_SOURCE if field=='source_sha256'else p.s.a.OLD['daemon_digest']
   with self.assertRaises(ValueError):p.validate_inputs(value)
  value=inputs();value['native_probe']['admitted']=ref('foreign');
  with self.assertRaises(ValueError):p.validate_inputs(value)
  value=inputs();value['worker_sql_proof']=ref('old-proof')
  with self.assertRaises(ValueError):p.validate_inputs(value)
 def admission_fixture(self):
  port=p.Provider.__new__(p.Provider);port.inputs=inputs();port.o=types.SimpleNamespace(OBSERVE_ENABLED=True);bindings=port.bindings();events=[]
  class Build:
   def source_admission(self):events.append('source');return{}
   def context(self,kind):assert kind=='daemon';return{key:bindings[key]for key in('daemon_source_sha256','native_source_sha256','native_graph_sha256','daemon_graph_sha256','native_manifest_sha256','native_compatibility_sha256')}
   def accepted_export(self,kind):return{'runtime_digest':port.inputs[kind]['digest'],'source_sha256':port.inputs[kind]['source_sha256']}
  port.build=lambda:Build()
  class RegistryPort:
   def __init__(self,kind):self.kind=kind
   def exists(self,name):return True
   def hash(self,name):return'a'*64
   def pins(self):return{'kind':self.kind}
   def read(self,name):return{'source_pins':self.pins()}if name.endswith('.claim.json')else{'claim_sha256':'a'*64,'normal_return_observed':True,'value':{'normal_copy_return_observed':True,'runtime_digest':port.inputs[self.kind]['digest']}}
  port.registry_ports=lambda kind:RegistryPort(kind);port.r=types.SimpleNamespace(normal=p.a.library('registry.py').normal)
  port.retained_probe=lambda:{'cleanup_confirmed':True,'source_sha256':p.a.NATIVE_SOURCE,'image':p.old.PREFIX+'native@'+p.a.NATIVE_DIGEST}
  proof=json.loads((p.MAIN/p.a.WORKER_PROOF['path']).read_bytes());port.s=types.SimpleNamespace(sql_contract_sha256=lambda:proof['sql_contract_sha256'])
  records={p.a.WORKER_PROOF['path']:proof}
  for kind in('native','daemon'):
   records[port.inputs[kind]['registry_copy']['path']]={'result':'passed','normal_copy_return_observed':True,'runtime_digest':port.inputs[kind]['digest'],'source_sha256':port.inputs[kind]['source_sha256']}
   records[port.inputs[kind]['ready']['path']]={'result':'observed','image':{'runtime_digest':port.inputs[kind]['digest']}}
  helper=types.SimpleNamespace(project_ready=lambda project,images,digest:self.assertEqual(digest,p.a.NATIVE_DIGEST),repository_metadata=lambda *args:None)
  port.l=types.SimpleNamespace(registry=types.SimpleNamespace(helpers=lambda:helper,API={'repository':'native-repo','images':'native-images','daemon_repository':'daemon-repo'},DAEMON_REPO='closed-daemon-repo'))
  port.api=lambda method,endpoint:{'images':[{'manifestDigest':port.inputs['daemon']['digest'],'repositoryId':'closed-daemon-repo','kind':'manifest','status':'ready','architecture':'amd64','platform':'linux'}]}
  return port,records,events
 def test_per_kind_copy_source_admission_preserves_old_native_and_actual_current_proof(self):
  port,records,_=self.admission_fixture()
  with patch.object(p.old,'read_ref',lambda r:copy.deepcopy(records[r['path']])):result=port.admission('prepare')
  self.assertTrue(result['native_reused']);self.assertFalse(result['new_native_probe_claimed']);self.assertEqual(result['current40_worker_SQL'],p.a.WORKER_PROOF)
  records[p.a.NATIVE_COPY['path']]['source_sha256']=port.inputs['source']['source_sha256']
  with patch.object(p.old,'read_ref',lambda r:copy.deepcopy(records[r['path']])):
   with self.assertRaises(ValueError):port.admission('prepare')
 def test_unarmed_observer_stops_admission_before_build_or_provider(self):
  port,_,events=self.admission_fixture();port.o.OBSERVE_ENABLED=False
  with self.assertRaises(ValueError):port.admission('prepare')
  self.assertEqual(events,[])
 def test_plan_purpose_projection_only_keeps_original_guarded_write_and_values(self):
  class Memory(p.Provider):
   def __init__(self):self.files={}
   def _ensure(self):pass
   def _create(self,name,value):assert name not in self.files;self.files[name]=copy.deepcopy(value)
  memory=Memory();value={'purpose':'first_worker_separate_source_identity_release','before':{'all76':'same'}};before=copy.deepcopy(value);memory.write('plan.json',value);self.assertEqual(value,before);self.assertEqual(memory.files['plan.json'],{**value,'purpose':p.a.PURPOSE})
  with self.assertRaises(AssertionError):memory.write('plan.json',value)
 def test_Ready_attribution_projects_only_retained_probe_wording_not_acceptance(self):
  port=p.Provider.__new__(p.Provider);port.inputs=inputs();value={'new_deployment_ready':False,'bindings':port.bindings(),'native_cleanup_basis':'new probe exact absence and deployed source boot global-idle assertion; no new client session inventory claimed'};before=copy.deepcopy(value)
  with patch.object(p.old.Provider,'ready',lambda self,url,marker:copy.deepcopy(value)):actual=port.ready('unused','unused')
  self.assertEqual(value,before);self.assertFalse(actual['new_deployment_ready']);self.assertEqual(actual['bindings'],value['bindings']);self.assertFalse(actual['new_native_probe_claimed']);self.assertEqual(actual['retained_native_probe_ref'],p.a.NATIVE_ADMITTED)
 def test_exact_armed_build_module_and_data_pins_before_inert_constructor_only(self):
  port=p.Provider.__new__(p.Provider);port.inputs=inputs();port.l=types.SimpleNamespace(guard=lambda:None)
  actual=port.build();self.assertEqual(actual.inputs,port.inputs);self.assertEqual(actual.source,port.inputs['source'])
  for name in('BUILD_WRAPPER_SHA','BUILD_ANCHORS_SHA'):
   with patch.object(p.a,name,'0'*64):
    with self.assertRaises(ValueError):port.build()
if __name__=='__main__':unittest.main()
