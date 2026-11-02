"""Synthetic API envelopes only; no provider, auth store or historical read."""
from pathlib import Path
import copy, importlib.util, io, json, unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('production_worker_observer_tests',HERE/'observe.py');o=importlib.util.module_from_spec(spec);spec.loader.exec_module(o)
START=1793579000000
SCOPE={'deployment':'dpl_CompletionWorkerProduction39','instance':{'id':'dmni_01m6cb4s3fygy6yrdyp0qr6zv7','started_at_ms':START},'bindings':o.BINDINGS}

def payload(count=1):
 event={'timestamp':o.iso(START+1),'projectId':o.PROJECT,'deploymentId':SCOPE['deployment'],'source':'daemon','daemonName':'worker','daemonInstanceId':SCOPE['instance']['id'],'environment':'','attributes':{'scope.type':'target','scope.value':'production'},'truncated':False,'level':'info','stream':'stdout','message':json.dumps({'event':'specs_worker_started','authentication':'narrow_database_login','orchestration':'n8n_required'})}
 rows=[event]
 for index in range(count-1):rows.append({**copy.deepcopy(event),'timestamp':o.iso(START+index+2),'message':'platform startup metadata'})
 return {'events':rows,'pagination':{'hasMore':False,'nextCursor':None},'meta':{'excludedIntervals':[]}}

class Tests(unittest.TestCase):
 def test_disabled_entry_reads_no_input_and_has_no_provider_transport(self):
  with patch.object(o,'OBSERVE_ENABLED',False),patch.object(o,'startup',side_effect=AssertionError('No startup while disabled')):
   with self.assertRaises(ValueError):o.main(['observe.py'],io.StringIO('private raw input'))
  self.assertNotIn('post',o.__dict__);self.assertNotIn('api',o.__dict__)
 def test_explicit_select_and_exact_first_ten_minutes_are_dynamic(self):
  body=o.request(SCOPE);self.assertEqual(body['scope'],{'ownerId':o.TEAM,'projectIds':[o.PROJECT]});self.assertEqual(body['limit'],100);self.assertEqual(body['order'],'asc');self.assertEqual(body['select'],o.SELECT)
  self.assertEqual(body['timeRange'],{'start':o.iso(START),'end':o.iso(START+600000)});self.assertIn(SCOPE['deployment'],body['filter']);self.assertIn(SCOPE['instance']['id'],body['filter']);self.assertEqual(len(body['select']),22)
  changed=copy.deepcopy(SCOPE);changed['deployment']='dpl_DifferentProductionDeployment39';changed['instance']['id']='dmni_01m6cc4s3fygy6yrdyp0qr6zv7';self.assertIn(changed['deployment'],o.request(changed)['filter'])
  for mutate in[lambda v:v.update(window={'start':START-1,'end':START+599999}),*[lambda v,key=key:v['bindings'].update({key:'0'*64})for key in o.BINDINGS],lambda v:v.update(deployment=o.OLD_DEPLOYMENT)]:
   bad=copy.deepcopy(SCOPE);mutate(bad)
   with self.assertRaises(ValueError):o.request(bad)
  with self.assertRaises(ValueError):o.startup(SCOPE,payload(),START+599999)
 def test_current_complete_windows_accept_variable_record_counts(self):
  for count in(1,7,23,31):
   value=o.startup(SCOPE,payload(count),START+600000);self.assertEqual(value['log_records'],count);self.assertEqual(value['events']['worker_started'],1);self.assertTrue(value['complete_window']);self.assertEqual(value['caller_checked_bindings'],o.BINDINGS);self.assertFalse(value['artifact_bindings_inferred_from_logs']);self.assertFalse(value['identity_synthesized'])
 def test_required_message_contract_and_all_record_identity_are_strict(self):
  mutations=[lambda e:e.pop('projectId'),lambda e:e.update(projectId='prj_foreign'),lambda e:e.pop('deploymentId'),lambda e:e.update(daemonInstanceId='dmni_01m6cc4s3fygy6yrdyp0qr6zv7'),lambda e:e.pop('daemonName'),lambda e:e.update(source='function'),lambda e:e['attributes'].update(deploymentId='dpl_foreign'),lambda e:e.update(timestamp=o.iso(START-1)),lambda e:e.update(timestamp=o.iso(START+600001)),lambda e:e.update(timestamp=True),lambda e:e.update(truncated=True),lambda e:e.pop('truncated'),lambda e:e.update(level='warning'),lambda e:e.update(message=json.dumps({'event':'specs_worker_started','authentication':'service_role','orchestration':'n8n_required'}))]
  for mutate in mutations:
   bad=payload();mutate(bad['events'][0])
   with self.assertRaises(ValueError):o.startup(SCOPE,bad,START+600000)
 def test_exact_production_attributes_and_no_conflicting_identity(self):
  for mutate in[lambda e:e.update(environment='preview'),lambda e:e['attributes'].update({'scope.value':'preview'}),lambda e:e['attributes'].pop('scope.type'),lambda e:e['attributes'].update(environment='preview')]:
   bad=payload();mutate(bad['events'][0])
   with self.assertRaises(ValueError):o.startup(SCOPE,bad,START+600000)
  direct=payload();direct['events'][0]['environment']='production';self.assertTrue(o.startup(SCOPE,direct,START+600000)['complete_window'])
 def test_missing_page_partial_window_warnings_errors_and_fatal_records_fail(self):
  for mutate in[lambda v:v['pagination'].update(hasMore=True),lambda v:v['pagination'].update(nextCursor='never-print-cursor'),lambda v:v['pagination'].pop('nextCursor'),lambda v:v['pagination'].update(next='never-print-cursor'),lambda v:v['meta'].update(excludedIntervals=[{}]),lambda v:v['meta'].update(errors=[]),lambda v:v.update(warnings=['unprinted']),lambda v:v.update(errors=[]),lambda v:v.update(error={}),lambda v:v.update(truncated=True)]:
   bad=payload();mutate(bad)
   with self.assertRaises(ValueError):o.startup(SCOPE,bad,START+600000)
  for event in('hosted_worker_unconfirmed','hosted_worker_paused','hosted_worker_pilot_expired','native_sandbox_cleanup_unconfirmed','specs_worker_start_failed'):
   bad=payload(2);bad['events'][1]['message']=json.dumps({'event':event})
   with self.assertRaises(ValueError):o.startup(SCOPE,bad,START+600000)
  bad=payload(2);bad['events'][0]['message']='platform only'
  with self.assertRaises(ValueError):o.startup(SCOPE,bad,START+600000)
 def test_no_record_filtering_timestamp_injection_or_synthetic_summary_credit(self):
  bad=payload(2);bad['events'][1]['timestamp']=o.iso(START)
  with self.assertRaises(ValueError):o.startup(SCOPE,bad,START+600000)
  bad=payload();bad['events'][0].pop('timestamp');bad['events'][0]['_time']=o.iso(START+1)
  with self.assertRaises(ValueError):o.startup(SCOPE,bad,START+600000)
  with patch.object(o,'project_runtime',return_value={'complete_window':False}):
   with self.assertRaises(ValueError):o.startup(SCOPE,payload(),START+600000)

if __name__=='__main__':unittest.main()
