"""Inert port tests only. No private claims, CLI, SQL or provider reads."""
from pathlib import Path
import copy, importlib.util, json, subprocess, unittest
from unittest.mock import patch
from pglast import ast, parse_sql, parse_plpgsql
from pglast.stream import RawStream

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('availability38_driver_tests',HERE/'driver.py');d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
fixtures=d.s.module('availability38_existing_public_fixtures',HERE/'test_availability.py')

class FakePorts:
 def __init__(self):
  self.paused,self.proof,self.active=fixtures.fixture();self.admitted=json.loads(self.proof['pause_claim_bytes'])['admission'];self.adoption_pins=d.s.sources()
  self.current=self.active;self.files={};self.calls=[];self.dispatched=False;self.unknown=False;self.fail_marker=False;self.drift=False
 def now(self):return fixtures.NOW
 def pins(self):return {'synthetic_driver':'a'*64}
 def admission(self):return copy.deepcopy(self.admitted)
 def snapshot(self):
  self.calls.append('snapshot');value=copy.deepcopy(self.current)
  if self.drift:value['state']['data']['jobs']['sha256']='0'*64
  return value
 def dispatch_absent(self):return not self.dispatched
 def exists(self,path):return path in self.files
 def write(self,path,value):
  d.need(path not in self.files)
  if path==d.RETURNED and self.fail_marker:raise OSError('PRIVATE marker failure')
  self.files[path]=copy.deepcopy(value);self.calls.append('claim'if path==d.CLAIM else'write')
 def read(self,path):return copy.deepcopy(self.files[path])
 def hash(self,path):return d.s.sha(d.canonical(self.files[path]))
 def worker(self):return copy.deepcopy(self.proof['old_worker'][0])
 def environment(self):return {**copy.deepcopy(self.proof['environment'][0]),'current':copy.deepcopy(self.proof['environment_before'])}
 def pause_plan(self):return {'phase':'pause','before':copy.deepcopy(self.active),'admission':copy.deepcopy(self.admitted),'source_pins':self.adoption_pins}
 def pause(self):
  claim=json.loads(self.proof['pause_claim_bytes']);claim['source_pins']=self.adoption_pins;claim['admission']=copy.deepcopy(self.admitted)
  raw=d.canonical(claim);return raw,{'claim_sha256':d.s.sha(raw),'normal_return_marker_observed':True}
 def query(self,sql):
  d.need(d.CLAIM in self.files);self.calls.append('SQL');self.current=copy.deepcopy(self.active)
  for statement in parse_sql(sql):
   if isinstance(statement.stmt,ast.DoStmt):parse_plpgsql(RawStream()(statement.stmt))
  if self.unknown:raise TimeoutError('PRIVATE unknown response')
  return {'phase':'old_flags','marker':self.files[d.CLAIM]['marker']}
 def save(self,phase,value):self.calls.append('saved');return {'phase':phase,**value}

class Tests(unittest.TestCase):
 def setUp(self):
  self.flags=[patch.object(d,'APPLY_ENABLED',True),patch.object(d.f,'RENDER_ENABLED',True)]
  for value in self.flags:value.start();self.addCleanup(value.stop)
 def fixture(self):
  return FakePorts()
 def prepared(self):
  p=self.fixture()
  with patch.object(d.a,'source_pins',return_value=p.adoption_pins):d.prepare(p)
  p.current=copy.deepcopy(p.paused);return p

 def test_both_false_gates_refuse_before_runtime_ports_or_private_inputs(self):
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):
   spec=importlib.util.spec_from_file_location('availability38_driver_import_again',HERE/'driver.py');value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value)
  self.assertIs(value.APPLY_ENABLED,False)
  for flag in ['driver','pure']:
   p=self.fixture()
   with patch.object(d,'APPLY_ENABLED',flag!='driver'),patch.object(d.f,'RENDER_ENABLED',flag!='pure'):
    for fn in [d.prepare,d.apply,d.finish]:
     with self.assertRaises(ValueError):fn(p)
   self.assertEqual(p.calls,[])

 def test_prepare_is_before_pause_and_seals_actual_same_window_environment(self):
  p=self.fixture()
  with patch.object(d.a,'source_pins',return_value=p.adoption_pins):result=d.prepare(p)
  self.assertEqual(result['result'],'prepared_before_pause');self.assertNotIn('SQL',p.calls)
  self.assertEqual(p.files[d.PLAN]['environment_before'],p.proof['environment_before'])
  with patch.object(d.a,'source_pins',return_value=p.adoption_pins):
   with self.assertRaises(ValueError):d.prepare(p)
  p=self.fixture();p.current=copy.deepcopy(p.paused)
  with patch.object(d.a,'source_pins',return_value=p.adoption_pins):
   with self.assertRaises(ValueError):d.prepare(p)

 def test_normal_sql_claim_marker_and_two_preserving_readbacks(self):
  p=self.prepared()
  with patch.object(d.a,'source_pins',return_value=p.adoption_pins):result=d.apply(p)
  self.assertEqual(result['result'],'passed');self.assertTrue(result['normal_return_marker_observed']);self.assertTrue(result['two_equal_preserving_readbacks'])
  self.assertLess(p.calls.index('claim'),p.calls.index('SQL'));self.assertIn(d.RETURNED,p.files)
  with self.assertRaises(ValueError):d.apply(p)
  self.assertEqual(p.calls.count('SQL'),1)

 def test_unknown_response_or_unsaved_return_marker_cannot_earn_pass_or_replay(self):
  for field in ['unknown','fail_marker']:
   p=self.prepared();setattr(p,field,True)
   with patch.object(d.a,'source_pins',return_value=p.adoption_pins):result=d.apply(p)
   self.assertEqual(result['result'],'unconfirmed');self.assertFalse(result['normal_return_marker_observed']);self.assertTrue(result['two_equal_preserving_readbacks'])
   self.assertIn(d.CLAIM,p.files);self.assertNotIn(d.RETURNED,p.files)
   with self.assertRaises(ValueError):d.apply(p)
   with patch.object(d.a,'source_pins',return_value=p.adoption_pins):again=d.finish(p)
   self.assertFalse(again['normal_return_marker_observed']);self.assertEqual(p.calls.count('SQL'),1)

 def test_existing_deployment_claim_or_full_database_drift_refuses_sql(self):
  for field in ['dispatched','drift']:
   p=self.prepared();setattr(p,field,True)
   with patch.object(d.a,'source_pins',return_value=p.adoption_pins):
    with self.assertRaises(ValueError):d.apply(p)
   self.assertNotIn('SQL',p.calls);self.assertNotIn(d.CLAIM,p.files)

 def test_worker_native_projection_requires_current_production_exact_old_identity(self):
  p=self.fixture();now=p.now();health=p.worker()['worker'];instance=health['instances'][0]
  raw={'context':{'project':{'id':d.s.PROJECT,'name':'everyone-presentation-worker-pilot'},'team':{'id':d.s.TEAM,'slug':'muhammed-abdelrahman'},'environment':'production'},'scalingOverridden':False,
   'daemon':{'name':'worker','deploymentId':d.f.OLD_DEPLOYMENT,'status':'ready','config':{'image':{'requested':d.f.OLD_DAEMON,'resolved':d.f.OLD_DAEMON},'instances':{'dub1':1},'resources':{'requests':{'memory':'2Gi'}},'terminationGracePeriodSeconds':300},
    'instances':{'desired':1,'ready':1,'total':1,'items':[{'id':instance['id'],'alive':True,'image':d.f.OLD_DAEMON,'region':'dub1','memoryMiB':2048,'startedAt':instance['started_at_ms'],'lastCheckedAt':instance['last_checked_at_ms'],'stoppedAt':None}]}}}
  self.assertEqual(d.worker_projection(raw,now)['active_production_deployment_id'],d.f.OLD_DEPLOYMENT)
  native_omitted=copy.deepcopy(raw);del native_omitted['daemon']['instances']['items'][0]['stoppedAt']
  self.assertIsNone(d.worker_projection(native_omitted,now)['worker']['instances'][0]['stopped_at_ms'])
  native_stopped=copy.deepcopy(raw);native_stopped['daemon']['instances']['items'][0]['stoppedAt']=int(now.timestamp()*1000)
  with self.assertRaises(ValueError):d.worker_projection(native_stopped,now)
  native_dead=copy.deepcopy(native_omitted);native_dead['daemon']['instances']['items'][0]['alive']=False
  with self.assertRaises(ValueError):d.worker_projection(native_dead,now)
  for change in [('deploymentId','dpl_new'),('status','stopped')]:
   changed=copy.deepcopy(raw);changed['daemon'][change[0]]=change[1]
   with self.assertRaises(ValueError):d.worker_projection(changed,now)

if __name__=='__main__':unittest.main()
