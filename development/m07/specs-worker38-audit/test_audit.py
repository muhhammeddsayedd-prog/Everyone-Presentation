"""Pure public fixtures/compiler tests. No SQL execution/provider/private input."""
from pathlib import Path
import copy,importlib.util,json,subprocess,sys,unittest
from unittest.mock import Mock,patch
from pglast import ast,parse_sql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('specs38_audit_tests',HERE/'audit.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
fixture=m.s.module('specs38_public_fixtures',m.PROJECT_HELPER.parent/'test_project.py')
JOB='a9380000-0000-4000-8000-000000000011';WORKSPACE='a9380000-0000-4000-8000-000000000012';PROJECT='a9380000-0000-4000-8000-000000000013';ATTEMPT='a9380000-0000-4000-8000-000000000014';T0='2026-11-01T20:00:00+00:00';T1='2026-11-01T20:00:01+00:00'
def observation():
 snap=fixture.snapshot();proof={}
 for key in 'versions slides pins raw english exports reviewed_media reviewed_frames assets'.split():proof[key]={'count':1,'rows':[{'key':JOB,'version_id':None,'sha256':'a'*64}]}
 for table in ['jobs','job_events','job_stage_attempts','outbox_events','specs_stage_payloads','specs_source_inputs']:proof['historical_'+table]={'count':1,'sha256':'b'*64}
 proof.update(reviewed={'candidate_id':m.REVIEWED,'sha256':'c'*64,'is_reviewed':True},protected_m02='d'*64)
 return {'observed_at':T0,'snapshot':snap,'workspace_valid':True,'workspace_empty':True,'preservation':proof,'job':None}
def row():
 trace={'job_id':JOB,'attempt_id':ATTEMPT,'stage':'extract_specs','attempt':1,'stage_attempt':1,'dispatch_generation':1,'correlation_id':JOB,'input_hash':'e'*64,'workflow_execution_id':'31999','workflow_execution_ref_state':'recorded','claimed_at':T1}
 event={'attempt_id':ATTEMPT,'sequence':1,'stage':'extract_specs','event_type':'succeeded','created_at':T1,'applied':True,'stale':False,'job_status':'running'}
 model={'attempt_id':ATTEMPT,'source_bound':True,'provider':'openai','requested_model':'model-alias','resolved_model':'model-resolved','request_id':'req_synthetic','response_id':'resp_synthetic','correlation_id':JOB,'usage':{'input_tokens':1,'output_tokens':2,'total_tokens':3}}
 return {'id':JOB,'workspace_id':WORKSPACE,'kind':'specs_extract','status':'succeeded','stage':'apply_specs','attempt':1,'correlation_id':JOB,'workflow_execution_id':'31999','created_at':T1,'updated_at':T1,'error_code':None,'cause_code':None,'traces':{'total':1,'rows':[trace]},'events':{'total':1,'rows':[event]},'outbox':{'total':0,'rows':[]},'provider_metadata':[model]}
class Tests(unittest.TestCase):
 def test_disabled_entry_before_any_config_query_or_private_IO(self):
  with patch.object(m,'READ_ENABLED',False),patch.object(m,'config')as config,patch.object(m.a,'query')as query,patch.object(sys,'argv',['audit.py','before']):
   with self.assertRaises(ValueError):m.main()
   config.assert_not_called();query.assert_not_called()
 def test_closed_UUID_and_historical_job_exclusion(self):
  for value in ['not-uuid',JOB+';select 1',None]:
   with self.assertRaises((ValueError,AttributeError,TypeError)):m.identifier(value)
  for value in [m.HISTORICAL,m.PROTECTED]:
   with self.assertRaises(ValueError):m.job_sql(value,WORKSPACE)
 def test_compiler_contains_only_read_statements_and_safe_named_metadata(self):
  for job in [None,JOB]:
   sql=m.sql({'project_id':PROJECT,'workspace_id':WORKSPACE},job);tree=parse_sql(sql)
   self.assertTrue(all(isinstance(node.stmt,(ast.TransactionStmt,ast.VariableSetStmt,ast.SelectStmt))for node in tree));self.assertIn('read only',sql);self.assertTrue(sql.endswith('rollback;'))
   for forbidden in ['j.request_id','order by created_at,id)ordinal,jsonb_build_object(\'attempt_id\'','lease_token','source_text','paragraphs','prepared_text']:self.assertNotIn(forbidden,sql)
   self.assertIn('r.job_id=',sql);self.assertIn('historical_specs_source_inputs',sql)
 def test_post_resume_static_contract_and_before_empty_zero_work_are_distinct(self):
  before=observation();admitted={'resume':{'first':copy.deepcopy(before['snapshot'])}};m.validate(before,admitted,True)
  active=copy.deepcopy(before);active['snapshot']['lifecycle']['running']=1;m.validate(active,admitted)
  with self.assertRaises(ValueError):m.validate(active,admitted,True)
  active=copy.deepcopy(before);active['snapshot']['config']['frame_extraction_config']['public']['native_image_id']=m.s.OLD_IMAGE
  with self.assertRaises(ValueError):m.validate(active,admitted)
  active=copy.deepcopy(before);active['preservation']['versions']['rows'][0]['unexpected']='private'
  with self.assertRaises(ValueError):m.validate(active,admitted)
 def test_protected_history_reviewed_and_every_old_ready_row_are_preserved(self):
  before=observation();after=copy.deepcopy(before);self.assertTrue(m.preserve(before,after))
  after['preservation']['versions']['rows'].append({'key':ATTEMPT,'version_id':None,'sha256':'f'*64});after['preservation']['versions']['count']+=1;self.assertTrue(m.preserve(before,after))
  for key,value in before['preservation'].items():
   bad=copy.deepcopy(before)
   if key=='protected_m02':bad['preservation'][key]='0'*64
   elif key=='reviewed'or key.startswith('historical_'):bad['preservation'][key]['sha256']='0'*64
   else:bad['preservation'][key]['rows'][0]['sha256']='0'*64
   with self.assertRaises(ValueError):m.preserve(before,bad)
 def test_safe_attempt_n8n_model_usage_metadata_and_failed_no_model(self):
  value=row();self.assertEqual(m.job_check(value,JOB,WORKSPACE,T0),value)
  value['status']='failed';value['error_code']='RETRY_EXHAUSTED';value['cause_code']='DEPENDENCY_UNAVAILABLE';value['provider_metadata']=[];m.job_check(value,JOB,WORKSPACE,T0)
  for change in [lambda r:r.update(id=ATTEMPT),lambda r:r.update(workspace_id=ATTEMPT),lambda r:r.update(secret='not accepted'),lambda r:r['provider_metadata'][0].update(request_id='https://invalid'),lambda r:r['provider_metadata'][0]['usage'].update(total_tokens=4),lambda r:r['traces']['rows'][0].update(workflow_execution_id='https://invalid'),lambda r:r['events']['rows'][0].update(attempt_id=JOB),lambda r:r['traces'].update(total=101)]:
   bad=row();change(bad)
   with self.assertRaises(ValueError):m.job_check(bad,JOB,WORKSPACE,T0)
 def test_old_mains_and_old795_checker_are_not_replayed(self):
  source=(HERE/'audit.py').read_text();self.assertNotIn('.check_static(',source);self.assertNotIn('.main(',source);self.assertNotIn('a.apply',source);self.assertIn('a.query(sql(',source)
  self.assertEqual(m.sha(m.s.load(m.OLD_OBSERVER)),m.OLD_SHA)
 def test_future_inputs_remain_null_and_unconfirmed(self):
  value=json.loads((HERE/'inputs.template.json').read_bytes());self.assertTrue(all(v is None for v in value.values()))
  with patch.object(m.s,'load',return_value=json.dumps(value).encode()):
   with self.assertRaises(ValueError):m.config()
if __name__=='__main__':unittest.main()
