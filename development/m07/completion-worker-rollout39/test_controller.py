"""Fake-port sequencing only; no provider/SQL writes or local runtime targets."""
from pathlib import Path
import copy,importlib.util,json,sys,unittest
from unittest.mock import Mock,patch
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v);return v
c=module('completion39_controller_test_target',HERE/'controller.py');pmod=module('completion39_provider_test_target',HERE/'provider.py')
states=module('completion39_controller_state_fixture',HERE/'test_state.py');envs=module('completion39_controller_env_fixture',HERE/'test_environment.py')

class Ports:
 def __init__(self,state):
  self.s=state;self.e=pmod.e;self.value={'canonical':copy.deepcopy(state.anchor),'intent_data':{'count':0,'sha256':'a'*64}};self.env=envs.Tests().fixture();self.files={};self.calls=[];self.reports=[];self.pins_value={'synthetic':'a'*64};self.fail_query=False;self.unknown_committed=False;self.fail_update=False;self.fail_deploy=False;self.bad_ready=False;self.fail_concurrency=False
 def pins(self):return copy.deepcopy(self.pins_value)
 def write(self,name,value):c.need(name not in self.files);self.files[name]=copy.deepcopy(value);self.calls.append(('write',name))
 def read(self,name):return copy.deepcopy(self.files[name])
 def exists(self,name):return name in self.files
 def hash(self,name):return c.s.sha(json.dumps(self.files[name],sort_keys=True).encode())
 def snapshot(self):self.calls.append(('snapshot',None));return copy.deepcopy(self.value)
 def environment(self):return copy.deepcopy(self.env)
 def old_ready(self):return {'instance_id':'old_owned_instance'}
 def old_matches(self,expected):c.need(expected==self.old_ready())
 def inventory(self):return ['old_owned_instance']
 def output(self):return [{'path':'synthetic-output','digest':c.s.DAEMON}]
 def checkpoint(self,before):c.need(before==self.value);return {'synthetic_private_checkpoint':True,'provider_called':False}
 def admission(self,phase):
  if phase in('pause','deploy')and self.fail_concurrency:raise ValueError('unproved')
  return {'synthetic_admission':True}
 def before_pause_availability(self,plan):self.write('forward-availability.json',{'plan':self.hash('plan.json')})
 def unwind_environment(self,plan):c.need(not self.exists('deploy.claim.json'))
 def query(self,sql):
  phase=next(name for name in reversed(self.files)if name.endswith('.claim.json')and self.files[name].get('phase')in c.DB_PHASES);claim=self.files[phase];phase=claim['phase']
  self.calls.append(('sql',phase))
  if self.fail_query and not self.unknown_committed:raise TimeoutError('PRIVATE raw response')
  before=copy.deepcopy(self.value)
  if phase=='pin':self.value['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']=c.s.NATIVE
  else:
   for row in self.value['canonical']['processing_config'].values():row['public']['enabled']=phase in('resume','unwind')
  for table,row in self.value['canonical']['processing_config'].items():row['table_hash']='b'*64;self.value['canonical']['base']['data'][table]={'count':1,'sha256':'b'*64}
  self.s.transition(before,self.value,phase)
  if self.fail_query:raise TimeoutError('PRIVATE ambiguous commit')
  return {'phase':phase,'marker':claim['marker']}
 def update_environment(self,action):
  self.calls.append(('env',action['key']))
  if self.fail_update:raise TimeoutError('PRIVATE raw response')
  self.env=envs.Tests().apply(self.env,action);return {'normal_return_observed':True,'response_id':self.env['ids'][action['key']]}
 def env_proof(self,parent):return pmod.Provider.env_proof(self,parent)
 def deploy(self,marker):
  self.calls.append(('deploy',marker))
  if self.fail_deploy:raise TimeoutError('PRIVATE ambiguous deployment')
  return {'url':'https://everyone-presentation-worker-pilot-synthetic.vercel.app'}
 def ready(self,url,marker):return {'new_deployment_ready':not self.bad_ready,'old_instances_absent':True,'native_cleanup_confirmed':True,'source_sha256':c.s.SOURCE,'native_digest':c.s.NATIVE,'daemon_digest':c.s.DAEMON,'manifest_sha256':c.s.MANIFEST}
 def save(self,action,value):self.reports.append(copy.deepcopy(value));return {'result':value['result'],'action':action}

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.state=c.s.State()
 def setUp(self):
  flag=patch.object(c,'ROLLOUT_ENABLED',True);flag.start();self.addCleanup(flag.stop)
 def run_phase(self,phase,p):return c.operate(phase,p,self.state)['result']
 def paused(self):
  p=Ports(self.state);self.assertEqual(self.run_phase('prepare',p),'prepared');self.assertEqual(self.run_phase('pause',p),'passed');return p
 def test_disabled_refuses_before_provider_construction_or_ports(self):
  with patch.object(c,'ROLLOUT_ENABLED',False),patch.object(sys,'argv',['new.py','pause']):
   with self.assertRaises(ValueError):c.main()
   with self.assertRaises(ValueError):c.operate('prepare',Mock(),Mock())
 def test_full_forward_path_keeps_old_pin_until_new_ready_then_resumes(self):
  p=self.paused();self.assertEqual(self.run_phase('env',p),'passed');self.assertEqual(self.run_phase('deploy',p),'submitted')
  self.assertEqual(p.value['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id'],c.s.OLD_NATIVE)
  self.assertEqual(self.run_phase('ready',p),'passed');self.assertEqual(self.run_phase('pin',p),'passed');self.assertEqual(self.run_phase('resume',p),'passed')
  self.assertTrue(all(v['public']['enabled']for v in p.value['canonical']['processing_config'].values()));self.assertEqual(sum(v[0]=='deploy'for v in p.calls),1)
 def test_no_pause_without_actual_concurrency_and_no_sql_dispatch(self):
  p=Ports(self.state);self.run_phase('prepare',p);p.fail_concurrency=True;self.assertEqual(self.run_phase('pause',p),'unconfirmed');self.assertFalse(any(v[0]=='sql'for v in p.calls));self.assertFalse(p.exists('pause.claim.json'))
 def test_fresh_drift_after_prepare_is_denied_without_pause_claim(self):
  p=Ports(self.state);self.run_phase('prepare',p);p.value['intent_data']['sha256']='c'*64;self.assertEqual(self.run_phase('pause',p),'unconfirmed');self.assertFalse(p.exists('pause.claim.json'))
 def test_unknown_sql_retains_claim_no_normal_return_no_retry_and_readback_gets_only(self):
  p=Ports(self.state);self.run_phase('prepare',p);p.fail_query=True;p.unknown_committed=True;self.assertEqual(self.run_phase('pause',p),'unconfirmed');self.assertTrue(p.exists('pause.claim.json'));self.assertFalse(p.exists('pause.normal.json'))
  before=sum(v[0]=='sql'for v in p.calls);self.assertEqual(self.run_phase('pause',p),'unconfirmed');self.assertEqual(self.run_phase('readback:pause',p),'unconfirmed');self.assertEqual(sum(v[0]=='sql'for v in p.calls),before);self.assertTrue(p.reports[-1]['observed_applied']);self.assertFalse(p.reports[-1]['normal_return_observed']);self.assertNotIn('PRIVATE',json.dumps(p.reports))
 def test_partial_unknown_env_never_resubmits_or_dispatches_deployment(self):
  p=self.paused();p.fail_update=True;self.assertEqual(self.run_phase('env',p),'unconfirmed');self.assertTrue(p.exists('env-0.claim.json'));self.assertFalse(p.exists('env-0.normal.json'))
  before=sum(v[0]=='env'for v in p.calls);self.assertEqual(self.run_phase('env',p),'unconfirmed');self.assertEqual(self.run_phase('deploy',p),'unconfirmed');self.assertEqual(sum(v[0]=='env'for v in p.calls),before);self.assertFalse(any(v[0]=='deploy'for v in p.calls))
 def test_confirmed_pre_dispatch_pause_can_restore_only5flags(self):
  p=self.paused();self.assertEqual(self.run_phase('unwind',p),'passed');self.assertEqual([v for v in p.calls if v[0]=='sql'],[('sql','pause'),('sql','unwind')])
 def test_any_deploy_dispatch_claim_closes_unwind_even_when_return_unknown(self):
  p=self.paused();self.run_phase('env',p);p.fail_deploy=True;self.assertEqual(self.run_phase('deploy',p),'unconfirmed');self.assertTrue(p.exists('deploy.claim.json'));self.assertEqual(self.run_phase('unwind',p),'unconfirmed');self.assertEqual(self.run_phase('deploy',p),'unconfirmed');self.assertEqual(sum(v[0]=='deploy'for v in p.calls),1)
 def test_missing_or_wrong_ready_proof_cannot_pin_or_resume(self):
  p=self.paused();self.run_phase('env',p);self.run_phase('deploy',p);p.bad_ready=True;self.assertEqual(self.run_phase('pin',p),'unconfirmed');self.assertFalse(p.exists('pin.claim.json'));self.assertEqual(self.run_phase('resume',p),'unconfirmed')
 def test_changed_source_pins_cannot_continue_prepared_plan(self):
  p=Ports(self.state);self.run_phase('prepare',p);p.pins_value['unexpected']='b'*64;self.assertEqual(self.run_phase('pause',p),'unconfirmed');self.assertFalse(any(v[0]=='sql'for v in p.calls))
if __name__=='__main__':unittest.main()
