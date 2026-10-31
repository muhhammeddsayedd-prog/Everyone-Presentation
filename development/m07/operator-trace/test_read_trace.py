"""Offline synthetic schema/privacy tests; no provider, SQL or database execution."""
from pathlib import Path
import copy,importlib.util,json,tempfile,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('operator_trace_under_test',HERE/'read_trace.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
TIME='2026-10-31T14:00:00+00:00'
def uid(index):return f'10000000-0000-4000-8000-{index:012d}'
def fixture():
 jobs=[]
 for index,(job_id,kind)in enumerate(m.JOBS.items(),1):
  stage={'candidate_scan':'apply_candidate','specs_extract':'apply_specs','presentation_render':'publish_presentation'}[kind]
  jobs.append({'id':job_id,'kind':kind,'workspace_id':m.RENDER_WORKSPACE if kind=='presentation_render'else m.WORKSPACE,'resource_id':uid(index),'requested_by':uid(10),'request_id':uid(11),
   'status':'succeeded','stage':stage,'attempt':3,'created_at':TIME,'updated_at':TIME,'workflow_execution_id':str(31500+index),'error_code':None,
   'events_total':1,'events_truncated':False,'events':[{'attempt_id':uid(index+20),'sequence':1,'stage':stage,'event_type':'succeeded','created_at':TIME}],
   'outbox':{'total':1,'pending':0,'leased':0,'delivered':1,'dead':0,'delivery_attempts':1,'last_created_at':TIME,'last_delivered_at':TIME},
   'audit_total':1,'audit_truncated':False,'audit':[{'id':uid(index+30),'resource_id':job_id,'principal_id':uid(10),'request_id':uid(11),'declared_client':'mcp','created_at':TIME}]})
 return [{'operator_job_trace':{'database':'postgres','operator':'postgres','observed_at':TIME,'read_only':True,'history_count':33,'exact_history33':True,'protected_m02_preserved':True,'jobs':jobs}}]
def value(payload):return payload[0]['operator_job_trace']

class OperatorTraceTests(unittest.TestCase):
 def test_fixed_read_only_sql_and_source_pin(self):self.assertEqual(m.validate_sql((HERE/'job-trace.sql').read_bytes()),(HERE/'job-trace.sql').read_bytes())
 def test_write_or_routing_source_cannot_execute(self):
  source=(HERE/'job-trace.sql').read_bytes()
  for unsafe in [b'insert into eps.jobs values(null);',b'update eps.jobs set status=\'queued\';',b'delete from eps.jobs;',b'grant all on eps.jobs to public;',b'create table forbidden(id int);',b"select set_config('role','postgres',false);",b"select dblink('private','select 1');",b'commit;']:
   with self.subTest(unsafe=unsafe),self.assertRaises(ValueError):m.validate_sql(source.replace(b'rollback;',unsafe+b'rollback;'))
 def test_changed_fixed_target_or_limit_fails_source_pin(self):
  source=(HERE/'job-trace.sql').read_bytes()
  for altered in [source.replace(b'limit 100',b'limit 1000'),source.replace(m.WORKSPACE.encode(),uid(99).encode()),source+b'-- changed\n']:
   with self.assertRaises(ValueError):m.validate_sql(altered)
 def test_dispatch_snapshot_stays_fixed_after_original_changes(self):
  with tempfile.TemporaryDirectory(prefix='eps-operator-synthetic-')as temporary:
   root=Path(temporary).resolve();original=root/'editable.sql';source=(HERE/'job-trace.sql').read_bytes();original.write_bytes(source)
   snapshot=m.snapshot_sql(m.validate_sql(original.read_bytes()),root)
   original.write_text('delete from eps.jobs;',encoding='utf8')
   dispatch=m.verify_snapshot(snapshot,root)
   self.assertNotEqual(dispatch,original);self.assertEqual(dispatch.read_bytes(),source)
 def test_snapshot_refuses_changed_bytes_owner_or_path(self):
  with tempfile.TemporaryDirectory(prefix='eps-operator-synthetic-')as temporary:
   root=Path(temporary).resolve();source=(HERE/'job-trace.sql').read_bytes();snapshot=m.snapshot_sql(source,root);query=Path(snapshot['query_path']);owner=query.parent/'owner.json'
   query.write_text('delete from eps.jobs;',encoding='utf8')
   with self.assertRaises(ValueError):m.verify_snapshot(snapshot,root)
   query.write_bytes(source);owner.write_text('{}',encoding='utf8')
   with self.assertRaises(ValueError):m.verify_snapshot(snapshot,root)
   with self.assertRaises(ValueError):m.verify_snapshot({**snapshot,'query_path':str(root/'other.sql')},root)
 def test_valid_closed_projection_is_copied(self):
  payload=fixture();parsed=m.parse(payload);parsed['jobs'][0]['status']='failed';self.assertEqual(value(payload)['jobs'][0]['status'],'succeeded')
 def test_cli_rows_envelope_is_supported(self):self.assertEqual(m.parse({'rows':fixture(),'warning':'nonpersisted envelope metadata'}),value(fixture()))
 def test_exact_history_role_read_only_and_protected_job_are_required(self):
  for key,bad in [('history_count',32),('history_count',True),('exact_history33',False),('operator','service_role'),('database','other'),('read_only',False),('protected_m02_preserved',False)]:
   payload=fixture();value(payload)[key]=bad
   with self.subTest(key=key),self.assertRaises(ValueError):m.parse(payload)
 def test_missing_duplicate_or_foreign_job_is_not_a_complete_trace(self):
  for jobs in [value(fixture())['jobs'][:2],value(fixture())['jobs']+[value(fixture())['jobs'][0]],value(fixture())['jobs'][:2]+[value(fixture())['jobs'][0]]]:
   payload=fixture();value(payload)['jobs']=jobs
   with self.assertRaises(ValueError):m.parse(payload)
 def test_each_fixed_job_requires_its_independently_observed_workspace(self):
  payload=fixture()
  self.assertEqual(m.parse(payload)['jobs'][2]['workspace_id'],'098d5b48-42a3-475b-b562-735c9eafce80')
  for index in(0,1,2):
   bad=fixture();value(bad)['jobs'][index]['workspace_id']=uid(98)
   with self.assertRaises(m.TraceValidationError)as caught:m.parse(bad)
   self.assertEqual(caught.exception.phase,'job_scope')
  for change in [{'id':uid(99)},{'kind':'candidate_scan'},{'workspace_id':None},{'workspace_id':m.WORKSPACE}]:
   bad=copy.deepcopy(payload);value(bad)['jobs'][2].update(change)
   with self.assertRaises(ValueError):m.parse(bad)
 def test_failed_projection_has_closed_phase_without_partial_data_or_private_errors(self):
  payload=fixture();value(payload)['jobs']=value(payload)['jobs'][:2]
  with self.assertRaises(m.TraceValidationError)as caught:m.parse(payload)
  self.assertEqual(caught.exception.phase,'job_cardinality')
  failure=m.failure_report(caught.exception.phase,True)
  self.assertEqual(failure['result'],'unconfirmed');self.assertEqual(failure['phase'],'job_cardinality')
  self.assertNotIn('metadata',failure);self.assertNotIn('jobs',failure);self.assertFalse(failure['raw_cli_persisted'])
  unknown=m.failure_report('private-error-with-token',True)
  self.assertEqual(unknown['phase'],'response_validation');self.assertNotIn('private-',json.dumps(unknown))
 def test_earlier_collector_and_query_bytes_remain_frozen(self):
  import hashlib
  for name,digest in [('676610be-v1-job-trace.sql','676610be9ed40e8952be87d8e08b402e62848250825878322f1ddf6558adeceb'),('6213f0af-v1-read_trace.py','6213f0afb4a8af8cd4fb3a5962a0511e7303820462bade9fc5a77fff166fc6c1'),('ef36e2e8-v2-job-trace.sql','ef36e2e8a3fc4f73bbaeddfc50a26ceb7dfab1a3e903452c4651c530258c33ad'),('f8e03950-v2-read_trace.py','f8e03950d8c4d7a444cbbdafbbb497d79e7bc0c80a0d765413a05a9915d2ae9b')]:
   self.assertEqual(hashlib.sha256((HERE/'source-history'/name).read_bytes()).hexdigest(),digest)
 def test_payload_hash_token_path_and_unknown_fields_are_rejected_at_every_level(self):
  for key in ['payload','input_hash','lease_token','storage_path','source_text','private_email']:
   for level in ['root','job','event','outbox','audit']:
    payload=fixture();job=value(payload)['jobs'][0]
    target={'root':value(payload),'job':job,'event':job['events'][0],'outbox':job['outbox'],'audit':job['audit'][0]}[level];target[key]='private-sensitive-marker'
    with self.subTest(key=key,level=level),self.assertRaises(ValueError):m.parse(payload)
 def test_unknown_codes_stages_statuses_and_workflow_identifiers_cannot_leave(self):
  for key,bad in [('error_code','private-error-detail'),('stage','private-stage'),('status','private-status'),('workflow_execution_id','private-workflow-token'),('request_id','private@example.invalid'),('resource_id','private-resource')]:
   payload=fixture();value(payload)['jobs'][0][key]=bad
   with self.subTest(key=key),self.assertRaises(ValueError):m.parse(payload)
 def test_unclassified_error_sentinel_is_safe_and_null_workflow_is_not_reconstructed(self):
  payload=fixture();job=value(payload)['jobs'][0];job['error_code']='UNCLASSIFIED_ERROR';job['workflow_execution_id']=None;job['request_id']=None
  self.assertIsNone(m.parse(payload)['jobs'][0]['workflow_execution_id'])
 def test_events_preserve_failed_history_without_inventing_failure_causes(self):
  payload=fixture();job=value(payload)['jobs'][2]
  job['events'].insert(0,{'attempt_id':uid(77),'sequence':1,'stage':'validate_presentation','event_type':'failed','created_at':TIME});job['events_total']=2
  parsed=m.parse(payload)['jobs'][2];self.assertEqual(parsed['status'],'succeeded');self.assertIsNone(parsed['error_code']);self.assertEqual(parsed['events'][0]['event_type'],'failed')
 def test_truncated_arrays_report_exact_total_and_cap(self):
  payload=fixture();job=value(payload)['jobs'][0]
  job['events']=[{**job['events'][0],'sequence':index+1}for index in range(100)];job['events_total']=101;job['events_truncated']=True
  self.assertTrue(m.parse(payload)['jobs'][0]['events_truncated'])
  for change in [{'events_total':100},{'events':job['events'][:-1]},{'events_truncated':False}]:
   bad=copy.deepcopy(payload);value(bad)['jobs'][0].update(change)
   with self.assertRaises(ValueError):m.parse(bad)
 def test_outbox_count_consistency_and_audit_scope_are_enforced(self):
  for change in [{'total':2},{'delivery_attempts':6},{'last_delivered_at':None}]:
   payload=fixture();value(payload)['jobs'][0]['outbox'].update(change)
   with self.assertRaises(ValueError):m.parse(payload)
  for key,bad in [('resource_id',uid(99)),('declared_client','admin'),('principal_id','private-email@example.invalid'),('request_id','Bearer private-token')]:
   payload=fixture();value(payload)['jobs'][0]['audit'][0][key]=bad
   with self.assertRaises(ValueError):m.parse(payload)
 def test_timestamps_duplicates_and_boolean_counts_fail_closed(self):
  for edit in [lambda j:j.update(attempt=True),lambda j:j.update(updated_at='2099-01-01T00:00:00Z'),lambda j:j['events'][0].update(created_at='private-time'),lambda j:j.update(events=j['events']*2,events_total=2),lambda j:j.update(audit=j['audit']*2,audit_total=2)]:
   payload=fixture();edit(value(payload)['jobs'][0])
   with self.assertRaises(ValueError):m.parse(payload)
 def test_duplicate_json_keys_or_oversized_raw_output_are_rejected(self):
  for raw in ['{"token":"private","token":"other"}','x'*(256*1024+1)]:
   with self.assertRaises(ValueError):m.json_payload(raw)
  self.assertEqual(m.parse(m.json_payload(json.dumps(fixture()))),value(fixture()))

if __name__=='__main__':unittest.main()
