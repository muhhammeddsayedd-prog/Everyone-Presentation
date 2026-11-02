"""In-memory claims and frozen function code; no private files or provider."""
from pathlib import Path
import copy,importlib.util,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('env_forward_tests',HERE/'controller.py');entry=importlib.util.module_from_spec(spec);spec.loader.exec_module(entry);f=entry.f
provider,c=f.libraries();fake=f.module('env_forward_original_fake_ports',provider.a.OLD/'test_controller.py')

class Memory:
 def __init__(self):self.files={};self.seals=f.source_pins()
 def exists(self,name):return name in self.files
 def read(self,name):return copy.deepcopy(self.files[name])
 def hash(self,name):return c.digest(self.files[name])
 def check(self):f.need(self.seals==f.source_pins())
 def write(self,name,value):self.check();assert name not in self.files;self.files[name]=copy.deepcopy(value)

def fixture():
 p=fake.Port();wanted=dict(zip(f.KEYS,['a'*64,'b'*64,'c'*64]));p.env={f.KEYS[0]:'0'*64};p.bindings=lambda:{'environment':wanted,'native_digest':'new'}
 actions=[{'key':f.KEYS[0],'body':{'value':wanted[f.KEYS[0]]},'method':'PATCH','id':'existing'}]+[{'key':key,'method':'POST','body':{'key':key,'value':wanted[key],'type':'plain','target':['production']}}for key in f.KEYS[1:]]
 p.e.actions=lambda before,values:copy.deepcopy(actions);c.prepare(p);c.db_phase(p,'pause')
 parent={'pins':p.pins(),'paused':p.snapshot(),'before':p.environment(),'actions':actions,'automatic_replay':False};p.write('env.claim.json',parent)
 for index in(0,1):
  name='env-'+str(index);p.write(name+'.claim.json',{'pins':p.pins(),'before':p.environment(),'action':actions[index],'parent_claim_sha256':p.hash('env.claim.json'),'automatic_replay':False})
  p.env[actions[index]['key']]=actions[index]['body']['value']
  if index==0:p.write(name+'.normal.json',{'claim_sha256':p.hash(name+'.claim.json'),'normal_return_observed':True});p.write(name+'.readback.json',{'claim_sha256':p.hash(name+'.claim.json'),'after':p.environment()})
 p.calls=[];p.fail=False;p.bad_response=False
 def api(method,endpoint,body):
  assert method=='POST'and endpoint=='/v10/projects/'+f.PROJECT+'/env?teamId='+f.TEAM and body==actions[2]['body'];p.calls.append(copy.deepcopy(body));p.env[body['key']]=body['value']
  if p.fail:raise ValueError('PRIVATE_PROVIDER_UNKNOWN')
  return {'created':{'id':'new-compatibility',**body},'failed':[]}if not p.bad_response else{'unexpected_private_shape':True}
 p.api=api
 return p,Memory()

class Tests(unittest.TestCase):
 def bound(self,p):return patch.multiple(f,PRIOR_ENV=p.hash('env.claim.json'),PRIOR_ENV1=p.hash('env-1.claim.json'))
 def test_official_single_created_projector_accepts_and_wrong_empty_or_failed_response_refuses(self):
  action={'key':f.KEYS[2],'body':{'value':'c'*64}};row={'id':'fresh','key':action['key'],'value':'c'*64,'type':'plain','target':['production']}
  self.assertTrue(f.created_response({'created':row,'failed':[]},action)['normal_return_observed'])
  for value in({'envs':[row],'failed':[]},{'created':row,'failed':[{'error':{}}]},{'failed':[]},{'created':{**row,'target':['preview']},'failed':[]}):
   with self.assertRaises(ValueError):f.created_response(value,action)
 def test_actual_frozen_projector_rejects_the_documented_single_created_shape(self):
  p=provider.old.Provider.__new__(provider.old.Provider);action={'key':f.KEYS[2],'method':'POST','body':{'key':f.KEYS[2],'value':'c'*64,'type':'plain','target':['production']}}
  p.bindings=lambda:{'environment':{f.KEYS[2]:'c'*64}};p.environment=lambda:{'metadata':[]};p.api=lambda *args:{'created':{'id':'fresh',**action['body']},'failed':[]}
  with self.assertRaises(ValueError):p.update_environment(action)
 def test_observe_env1_dispatch_only_env2_and_all_future_frozen_phases_keep_full_original_checks(self):
  p,store=fixture();before=copy.deepcopy(p.files)
  with self.bound(p):
   result=f.complete_environment(p,c,store);self.assertTrue(result['env1_as_observed_only']);self.assertFalse(result['env1_normal_return_observed']);self.assertEqual(len(p.calls),1)
   port=f.FuturePort(p,store);functions=f.functions(c,store)
   self.assertIs(functions['db_phase'].__code__,c.db_phase.__code__);self.assertIs(functions['ready'].__code__,c.ready.__code__);self.assertIs(functions['deploy'].__code__,c.deploy.__code__)
   self.assertIsNot(functions['deploy'].__globals__,c.deploy.__globals__);self.assertIs(c.accepted_env,c.deploy.__globals__['accepted_env'])
   functions['deploy'](port);functions['ready'](port,c.accepted_db(port,'pause'));functions['db_phase'](port,'pin');functions['db_phase'](port,'resume')
   self.assertEqual(p.query_count,3);self.assertEqual(p.deploy_count,1);self.assertEqual(p.source,before['plan.json']['pins'])
   for name in f.FuturePort.CLAIMS:self.assertEqual(p.files[name]['env_forward_source_pins'],f.source_pins())
   for name,value in before.items():self.assertEqual(p.files[name],value)
   for name in('env-1.normal.json','env-1.readback.json','env-2.claim.json','env.normal.json'):self.assertNotIn(name,p.files)
   with self.assertRaises(ValueError):f.complete_environment(p,c,store)
   self.assertEqual(len(p.calls),1)
 def test_absent_env1_unrelated_environment_paused_data_or_old_source_drift_stop_before_new_claim(self):
  for mode in('absent','unrelated','data','source'):
   p,store=fixture()
   with self.bound(p):
    if mode=='absent':p.env.pop(f.KEYS[1])
    elif mode=='unrelated':p.env['private_commitment']='changed'
    elif mode=='data':p.current['all76_full_rows_sha']='changed'
    else:p.source['source']='changed'
    with self.assertRaises((ValueError,AssertionError)):f.complete_environment(p,c,store)
    self.assertEqual(store.files,{});self.assertEqual(p.calls,[])
 def test_unknown_remaining_POST_retains_claim_without_normal_and_cannot_resubmit(self):
  for mode in('transport','projector'):
   p,store=fixture();p.fail=mode=='transport';p.bad_response=mode=='projector'
   with self.bound(p):
    with self.assertRaises(ValueError):f.complete_environment(p,c,store)
    self.assertIn('remaining.claim.json',store.files);self.assertNotIn('remaining.normal.json',store.files)
    self.assertEqual('remaining.response.json'in store.files,mode=='projector')
    if mode=='projector':
     self.assertEqual(store.files['remaining.response.json']['response'],{'unexpected_private_shape':True});self.assertEqual(store.files['remaining.response.json']['claim_sha256'],store.hash('remaining.claim.json'))
    with self.assertRaises(ValueError):f.complete_environment(p,c,store)
    self.assertEqual(len(p.calls),1);self.assertNotIn('env-1.normal.json',p.files)
 def test_new_source_drift_or_removed_future_seal_blocks_actual_future_claim_read(self):
  p,store=fixture()
  with self.bound(p):
   f.complete_environment(p,c,store);port=f.FuturePort(p,store);functions=f.functions(c,store);functions['deploy'](port)
   p.files['deploy.claim.json'].pop('env_forward_source_pins')
   with self.assertRaises(KeyError):port.read('deploy.claim.json')
   with patch.object(f,'source_pins',lambda:{'changed':'source'}):
    with self.assertRaises(ValueError):store.check()
 def test_disabled_or_disallowed_actions_refuse_before_any_port(self):
  with self.assertRaises(ValueError):entry.operate('complete-env',object(),object(),object())
  with patch.object(entry,'EXECUTION_ENABLED',True):
   for action in('env','prepare','pause','rollback','unwind'):
    with self.assertRaises(ValueError):entry.operate(action,object(),object(),object())
if __name__=='__main__':unittest.main()
