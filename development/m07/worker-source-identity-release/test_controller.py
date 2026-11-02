"""Injected once-only ports; no private files, native, database or provider."""
from pathlib import Path
import copy,importlib.util,json,subprocess,sys,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker_identity_phases',HERE/'controller.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
class State:
 def initial(self,v):assert v['enabled']and v['pin']=='old'
 def render(self,v,phase,marker):return json.dumps([copy.deepcopy(v),phase,marker])
 def transition(self,before,after,phase):
  expected=copy.deepcopy(before)
  if phase=='pin':expected['pin']='new'
  else:expected['enabled']=phase=='resume'
  assert expected==after
class Env:
 def actions(self,before,values):return [{'key':key,'body':{'value':value},'method':'PATCH'}for key,value in values.items()if before[key]!=value]
 def preserved(self,before,after,action):expected={**before,action['key']:action['body']['value']};assert after==expected
 def production(self,value,wanted):assert value==wanted
class Port:
 def __init__(self):
  self.s=State();self.e=Env();self.files={};self.current={'enabled':True,'pin':'old','all76_full_rows_sha':'unchanged'};self.env={'manifest':'old','daemon_source':'old','compatibility':'old'};self.source={'source':'sealed'};self.query_count=0;self.deploy_count=0;self.env_count=0;self.fail_query=False;self.fail_deploy=False
 def bindings(self):return {'environment':{'manifest':'new','daemon_source':'new','compatibility':'new'},'native_digest':'new'}
 def pins(self):return copy.deepcopy(self.source)
 def exists(self,name):return name in self.files
 def write(self,name,value):assert name not in self.files;self.files[name]=copy.deepcopy(value)
 def read(self,name):return copy.deepcopy(self.files[name])
 def hash(self,name):return c.digest(self.files[name])
 def save(self,action,value):return copy.deepcopy(value)
 def admission(self,phase):return {'all_actual_admissions_checked':True}
 def snapshot(self):return copy.deepcopy(self.current)
 def environment(self):return copy.deepcopy(self.env)
 def old_ready(self):return {'instance_id':'old'}
 def old_matches(self,old):assert old==self.old_ready()
 def inventory(self):return ['old']
 def checkpoint(self,before):return {'source_snapshot_sha256':c.digest(before),'restore_verified':False}
 def output(self):return {'daemon':'new-digest'}
 def query(self,sql):
  before,phase,marker=json.loads(sql);assert self.current==before;self.query_count+=1
  if phase=='pin':self.current['pin']='new'
  else:self.current['enabled']=phase=='resume'
  if self.fail_query:raise ValueError('PRIVATE_SQL_EXCEPTION')
  return {'phase':phase,'marker':marker}
 def update_environment(self,action):self.env_count+=1;self.env[action['key']]=action['body']['value'];return {'normal_return_observed':True}
 def deploy(self,marker):
  self.deploy_count+=1
  if self.fail_deploy:raise ValueError('PRIVATE_PROVIDER_EXCEPTION')
  return {'url':'https://synthetic-worker.example.invalid'}
 def ready(self,url,marker):return dict.fromkeys(('new_deployment_ready','old_instances_absent','native_cleanup_confirmed','source_identities_verified'),True)|{'bindings':self.bindings()}
 def reconcile_environment(self,claim):return {'public_values_observed':True}
 def reconcile_deployment(self,claim,returned):return {'deployment_observed':True,'deployment_resubmitted':False}

class Tests(unittest.TestCase):
 def run_phase(self,phase,p):
  with patch.object(c,'EXECUTION_ENABLED',True):return c.operate(phase,p)
 def test_normal_forward_sequence_has_one_claim_and_normal_return_per_phase(self):
  p=Port()
  for phase in c.a.PHASES:self.assertIn(self.run_phase(phase,p)['result'],('prepared','passed','submitted'))
  self.assertEqual(p.query_count,3);self.assertEqual(p.deploy_count,1);self.assertEqual(p.env_count,3);self.assertEqual(p.current,{'enabled':True,'pin':'new','all76_full_rows_sha':'unchanged'})
  for phase in('pause','env','deploy','pin','resume'):self.assertIn(phase+'.claim.json',p.files);self.assertIn(phase+'.normal.json',p.files)
 def test_unknown_committed_SQL_keeps_claim_and_readback_never_repairs_marker(self):
  p=Port();self.run_phase('prepare',p);p.fail_query=True;result=self.run_phase('pause',p);self.assertEqual(result['result'],'unconfirmed');self.assertNotIn('pause.normal.json',p.files)
  self.assertEqual(self.run_phase('pause',p)['result'],'unconfirmed');self.assertEqual(p.query_count,1)
  observed=self.run_phase('readback:pause',p);self.assertTrue(observed['observed_applied']);self.assertFalse(observed['normal_return_observed']);self.assertEqual(observed['result'],'unconfirmed');self.assertNotIn('pause.normal.json',p.files)
 def test_fresh_business_data_or_source_drift_stops_before_pause_claim(self):
  for mode in('data','source'):
   p=Port();self.run_phase('prepare',p)
   if mode=='data':p.current['all76_full_rows_sha']='legitimately_changed'
   else:p.source['source']='changed'
   self.assertEqual(self.run_phase('pause',p)['result'],'unconfirmed');self.assertNotIn('pause.claim.json',p.files);self.assertEqual(p.query_count,0)
 def test_unknown_deployment_never_replays_or_claims_normal_return(self):
  p=Port()
  for phase in('prepare','pause','env'):self.run_phase(phase,p)
  p.fail_deploy=True;result=self.run_phase('deploy',p);self.assertEqual(result['result'],'unconfirmed');self.assertNotIn('deploy.normal.json',p.files)
  self.run_phase('deploy',p);self.assertEqual(p.deploy_count,1);self.assertNotIn('PRIVATE_',str(result))
  observed=self.run_phase('readback:deploy',p);self.assertFalse(observed['normal_return_observed']);self.assertEqual(observed['result'],'unconfirmed')
 def test_disabled_entry_and_unwind_refuse_without_provider_construction(self):
  with self.assertRaises(ValueError):c.operate('prepare',object())
  with patch.object(c,'EXECUTION_ENABLED',True):
   with self.assertRaises(ValueError):c.operate('unwind',object())
  result=subprocess.run([sys.executable,'-X','utf8','-B',str(HERE/'controller.py'),'prepare'],capture_output=True,check=False)
  self.assertEqual(result.returncode,1);self.assertIn(b'DISABLED_OR_UNCONFIRMED',result.stdout);self.assertEqual(result.stderr,b'')
if __name__=='__main__':unittest.main()
