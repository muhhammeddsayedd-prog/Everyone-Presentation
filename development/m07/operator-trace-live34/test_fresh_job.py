import copy,hashlib,importlib.util,json,unittest
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('fresh_job',HERE/'observe-fresh-job.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
TIME='2026-10-31T18:00:00Z'
def fixture():
 return [{'fresh_operator_job':{'database':'postgres','operator':'postgres','observed_at':TIME,'read_only':True,'exact_history34':True,'english_enabled':True,'candidate_apply_source_attributes_preserved':True,'protected_m02_metadata_preserved':True,'match_count':1,
  'job':{'id':m.JOB,'kind':'candidate_scan','workspace_id':m.WORKSPACE,'status':'succeeded','stage':'apply_candidate','attempt':5,'request_id':None,'workflow_execution_id':'90001','created_at':TIME,'updated_at':TIME},
  'events_total':1,'events_truncated':False,'events':[{'attempt_id':'00000000-0000-4000-8000-000000000001','sequence':1,'stage':'apply_candidate','event_type':'succeeded','created_at':TIME}],
  'outbox':{'total':5,'pending':0,'leased':0,'delivered':5,'dead':0}}}]
class Tests(unittest.TestCase):
 def test_fixed_source_and_actual_release_receipt_pins_validate_without_network(self):
  source=m.source_bytes();self.assertEqual(hashlib.sha256(source).hexdigest(),m.SQL_SHA)
  release=json.loads((m.ROOT/'tracking/evidence/m03/english-release34/2026-10-31T17-54-57-429822Z-enable-readback.json').read_bytes())
  history=hashlib.sha256(json.dumps(release['first']['history']).encode()).hexdigest()
  self.assertIn(history.encode(),source)
 def test_bounded_closed_metadata_is_accepted_without_claiming_n8n_access(self):
  result=m.parse(fixture());self.assertEqual(result['job']['workflow_execution_id'],'90001');self.assertEqual(result['events_total'],1)
  value=fixture();value[0]['fresh_operator_job']['job']['workflow_execution_id']=None
  self.assertIsNone(m.parse(value)['job']['workflow_execution_id'])
 def test_foreign_job_scope_unknown_field_or_stage_and_failed_guard_are_rejected(self):
  for change in [lambda v:v['job'].update(id='00000000-0000-4000-8000-000000000000'),lambda v:v['job'].update(workspace_id='00000000-0000-4000-8000-000000000000'),lambda v:v['job'].update(stage='unsafe'),lambda v:v.update(exact_history34=False),lambda v:v['job'].update(data={'private':'SYNTHETIC_SECRET'}),lambda v:v['job'].update(workflow_execution_id='SYNTHETIC_SECRET')]:
   value=fixture();change(value[0]['fresh_operator_job'])
   with self.assertRaises(ValueError):m.parse(value)
 def test_event_cardinality_truncation_identity_and_outbox_totals_are_enforced(self):
  for change in [lambda v:v.update(events_total=2),lambda v:v.update(events_truncated=True),lambda v:v['events'][0].update(attempt_id='unsafe'),lambda v:v['outbox'].update(total=6),lambda v:v['events'].append(copy.deepcopy(v['events'][0]))]:
   value=fixture();change(value[0]['fresh_operator_job'])
   with self.assertRaises(ValueError):m.parse(value)
 def test_future_metadata_cannot_be_mistaken_for_current_observation(self):
  value=fixture();value[0]['fresh_operator_job']['events'][0]['created_at']='2026-11-01T18:00:00Z'
  with self.assertRaises(ValueError):m.parse(value)
if __name__=='__main__':unittest.main()
