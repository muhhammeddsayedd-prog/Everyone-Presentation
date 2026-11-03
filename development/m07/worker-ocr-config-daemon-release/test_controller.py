"""Real frozen phase code + new custody adapter through in-memory ports only."""
from pathlib import Path
import copy,importlib.util,json,subprocess,sys,tempfile,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
def module(name,file):
 s=importlib.util.spec_from_file_location(name,file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
c=module('ocr_controller_tests',HERE/'controller.py');p=module('ocr_provider_tests',HERE/'provider.py');envtests=module('ocr_controller_env_fixture',HERE/'test_environment.py');frozen=module('ocr_original_phase_fakes',c.a.GENERIC/'test_controller.py')
class State:
 def initial(self,v):assert v['enabled']is True and v['pin']=='3d'
 def render(self,v,phase,marker):assert phase in('pause','resume')and v['pin']=='3d';return json.dumps([copy.deepcopy(v),phase,marker])
 def transition(self,before,after,phase):wanted={**before,'enabled':phase=='resume'};assert wanted==after and after['pin']=='3d'
class Port(frozen.Port):
 def __init__(self):
  super().__init__();self.s=State();self.e=p.env;self.current={'enabled':True,'pin':'3d','all76_full_rows_sha':'fresh_after_Samsung_and_frame'};self.env,self.wanted=envtests.fixture();self.bad_response=False;self.fail_env=False
 def bindings(self):return{'environment':self.wanted,'native_digest':c.a.BASELINE['native_digest']}
 def query(self,sql):
  before,phase,marker=json.loads(sql);assert before==self.current;self.query_count+=1;self.current['enabled']=phase=='resume'
  if self.fail_query:raise ValueError('UNKNOWN_SQL')
  return{'phase':phase,'marker':marker}
 def api(self,method,url,body):
  assert method=='PATCH';self.env_count+=1;claim=self.files['env.claim.json'];action=next(a for a in claim['actions']if a['body']==body);self.env=envtests.apply(self.env,action)
  if self.fail_env:raise TimeoutError('UNKNOWN_WIRE')
  return{'unrecognized_private_shape':True}if self.bad_response else{'id':action['id'],'key':action['key'],'value':body['value']}
 write=p.Provider.write;read=p.Provider.read;update_environment=p.Provider.update_environment
class Tests(unittest.TestCase):
 def scoped(self):return patch.multiple(p.old.old.Provider,write=frozen.Port.write,read=frozen.Port.read)
 def run_phase(self,action,port):
  with patch.object(c,'EXECUTION_ENABLED',True):return c.operate(action,port)
 def test_complete_frozen_forward_phases_use_twoPATCH_twoSQL_no_native_pin_and_fresh_preimage(self):
  port=Port()
  with self.scoped():
   for action in c.PHASES:self.assertIn(self.run_phase(action,port)['result'],('prepared','passed','submitted'))
   self.assertEqual(port.query_count,2);self.assertEqual(port.env_count,2);self.assertEqual(port.deploy_count,1);self.assertEqual(port.current,{'enabled':True,'pin':'3d','all76_full_rows_sha':'fresh_after_Samsung_and_frame'});self.assertNotIn('pin.claim.json',port.files)
   for i in range(2):self.assertEqual(port.files[f'env-{i}.normal.json']['response_sha256'],port.hash(f'env-{i}.response.json'))
 def test_projection_inverse_changes_only_resume_dependency_and_never_old_module_globals(self):
  phases=c.phases();self.assertIsNot(phases['deploy'].__globals__,c.old.deploy.__globals__)
  for name in('prepare','environment','deploy','ready','accepted_env','accepted_db'):self.assertIs(phases[name].__code__,getattr(c.old,name).__code__)
  self.assertIs(c.old.deploy.__globals__['accepted_env'],c.old.accepted_env)
  with tempfile.TemporaryDirectory()as root:
   file=Path(root)/'controller.py';file.write_bytes((c.a.GENERIC/'controller.py').read_bytes()+b'\n# source drift\n')
   with patch.object(c.a,'GENERIC',Path(root)),self.assertRaises(ValueError):c.phases()
 def test_wrong_response_private_custody_before_projection_and_unknown_transport_never_resubmit(self):
  for mode in('projector','transport'):
   port=Port()
   with self.scoped():
    self.run_phase('prepare',port);self.run_phase('pause',port);port.bad_response=mode=='projector';port.fail_env=mode=='transport'
    self.assertEqual(self.run_phase('env',port)['result'],'unconfirmed');self.assertEqual('env-0.response.json'in port.files,mode=='projector');self.assertNotIn('env-0.normal.json',port.files)
    self.assertEqual(self.run_phase('env',port)['result'],'unconfirmed');self.assertEqual(port.env_count,1)
 def test_response_tamper_or_source_business_drift_refuses_without_mutation_replay(self):
  port=Port()
  with self.scoped():
   for action in('prepare','pause','env'):self.run_phase(action,port)
   port.files['env-0.response.json']['response']['value']='tampered';self.assertEqual(self.run_phase('deploy',port)['result'],'unconfirmed');self.assertEqual(port.deploy_count,0)
  for field in('source','business'):
   port=Port()
   with self.scoped():
    self.run_phase('prepare',port)
    if field=='source':port.source['source']='changed'
    else:port.current['all76_full_rows_sha']='new_current_business'
    self.assertEqual(self.run_phase('pause',port)['result'],'unconfirmed');self.assertNotIn('pause.claim.json',port.files);self.assertEqual(port.query_count,0)
 def test_disabled_pin_rollback_and_AT069_refuse_before_ports(self):
  with self.assertRaises(ValueError):c.operate('prepare',object())
  with patch.object(c,'EXECUTION_ENABLED',True):
   for action in('pin','readback:pin','rollback','unwind','AT069'):
    with self.assertRaises(ValueError):c.operate(action,object())
 def test_actual_disabled_entries_refuse_before_private_input_or_provider_ports(self):
  for file,args in(('controller.py',['prepare']),('registry.py',['copy','daemon'])):
   value=subprocess.run([sys.executable,'-X','utf8','-B',str(HERE/file),*args],capture_output=True,timeout=10)
   self.assertEqual(value.returncode,1);self.assertEqual(value.stderr,b'');self.assertIn(b'DISABLED_OR_UNCONFIRMED',value.stdout)
 def test_actual_immutable6o_ready_resume_anchors_bind_fresh_metadata_to697_not_Cp(self):
  value=p.Provider.__new__(p.Provider);calls=[]
  value.inspect=lambda deployment:calls.append(deployment)or{'synthetic_metadata':True}
  value.healthy=lambda v,deployment,digest:{'deployment':deployment,'digest':digest}
  result=value.old_ready();self.assertEqual(calls,[p.a.BASELINE['deployment_id']]);self.assertEqual(result,{'deployment':p.a.BASELINE['deployment_id'],'digest':p.a.BASELINE['daemon_digest']})
if __name__=='__main__':unittest.main()
