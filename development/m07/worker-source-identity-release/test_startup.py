"""Pure fixed-window response contracts; no normal CLI or provider."""
from pathlib import Path
import copy,importlib.util,json,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker_identity_startup',HERE/'startup.py');o=importlib.util.module_from_spec(spec);spec.loader.exec_module(o)
class Tests(unittest.TestCase):
 def fixture(self):
  start=1700000000000;scope={'deployment':'dpl_'+'a'*20,'instance':{'id':'dmni_'+'0'*26,'started_at_ms':start},'bindings':{**{key:chr(97+i)*64 for i,key in enumerate(o.FIELDS)},'native_digest':'sha256:'+'f'*64,'daemon_digest':'sha256:'+'0'*64}}
  messages=[{'event':'hosted_worker_source_identity',**{key:scope['bindings'][key]for key in o.FIELDS}},{'event':'specs_worker_started','authentication':'narrow_database_login','orchestration':'n8n_required'}]
  rows=[{'projectId':o.PROJECT,'deploymentId':scope['deployment'],'source':'daemon','daemonName':'worker','daemonInstanceId':scope['instance']['id'],'environment':'production','attributes':{},'timestamp':start+10+i*10,'truncated':False,'message':json.dumps(message),'level':'info'}for i,message in enumerate(messages)]
  payload={'events':rows,'pagination':{'hasMore':False,'nextCursor':None},'meta':{'excludedIntervals':[]}}
  def project(text,actual):
   self.assertEqual(actual['instance'],scope['instance']);return {'complete_window':True,'unbound_records':0,'truncated_records':0,'warning_records':0,'excluded_interval_count':0,'has_more':False,'log_records':len(rows),'instance_id':scope['instance']['id'],'events':{'worker_started':1,'worker_unconfirmed':0,'worker_paused':0,'pilot_expired':0},'last_startup_at_ms':start+20}
  return scope,payload,start+600000,project
 def test_complete_current_window_needs_actual_identity_event_without_fixed23(self):
  scope,payload,now,project=self.fixture();result=o.startup(scope,payload,now,project);self.assertEqual(result['log_records'],2);self.assertEqual(result['source_identity_records'],1);self.assertFalse(result['record_identities_synthesized'])
  self.assertEqual(o.request(scope)['select'],o.base().SELECT)
 def test_wrong_or_missing_source_event_is_not_synthesized_from_caller(self):
  for key in o.FIELDS:
   scope,payload,now,project=self.fixture();message=json.loads(payload['events'][0]['message']);message[key]='f'*64;payload['events'][0]['message']=json.dumps(message)
   with self.assertRaises(ValueError):o.startup(scope,payload,now,project)
  scope,payload,now,project=self.fixture();payload['events']=payload['events'][1:]
  with self.assertRaises(ValueError):o.startup(scope,payload,now,project)
 def test_wrong_record_identity_warning_truncation_or_incomplete_page_refuses(self):
  for change in({'projectId':'foreign'},{'deploymentId':'dpl_'+'b'*20},{'daemonInstanceId':'dmni_'+'1'*26},{'truncated':True},{'level':'warn'}):
   scope,payload,now,project=self.fixture();payload['events'][0].update(change)
   with self.assertRaises(ValueError):o.startup(scope,payload,now,project)
  for page in({'hasMore':True,'nextCursor':None},{'hasMore':0,'nextCursor':None},{'hasMore':False,'nextCursor':'next'}):
   scope,payload,now,project=self.fixture();payload['pagination']=page
   with self.assertRaises(ValueError):o.startup(scope,payload,now,project)
 def test_empty_env_requires_exact_production_attributes_and_full_time(self):
  scope,payload,now,project=self.fixture();payload['events'][0]['environment']='';payload['events'][0]['attributes']={'scope.type':'target','scope.value':'production'}
  o.startup(scope,payload,now,project)
  with self.assertRaises(ValueError):o.startup(scope,payload,now-1,project)
  bad=copy.deepcopy(payload);bad['events'][0]['attributes']['scope.value']='preview'
  with self.assertRaises(ValueError):o.startup(scope,bad,now,project)
 def test_observer_live_flag_stays_false(self):self.assertIs(o.OBSERVE_ENABLED,False)
 def test_actual_frozen_Node_projector_accepts_new_event_without_inventing_artifact_binding(self):
  scope,payload,now,_=self.fixture();value=o.startup(scope,payload,now)
  self.assertEqual(value['log_records'],2);self.assertEqual(value['source_identity_records'],1);self.assertFalse(value['record_identities_synthesized'])
if __name__=='__main__':unittest.main()
