"""Offline adapter/privacy/bounds tests; actual SQL grammar, no provider calls."""
from pathlib import Path
import copy,importlib.util,json,time,types,unittest,uuid
from unittest.mock import Mock
import pglast
from pglast.visitors import Visitor
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v);return v
p=module('completion39_provider_offline_target',HERE/'provider.py');t=module('completion39_provider_core_fixtures',HERE/'test_controller.py')
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.state=p.s.State()
 def adapter(self):
  value=p.Provider.__new__(p.Provider);value.s=self.state;value.e=p.e;value.r=types.SimpleNamespace(cli=lambda args:args,API={},DAEMON_REPO='synthetic_daemon');value.observer=types.SimpleNamespace(ENDPOINT='/v1/observability/events?teamId='+p.TEAM,HEADER='x-vercel-observability-query-reason:cli/daemons-logs');value.run=Mock(return_value=b'{}');value.write=Mock();value.schema_capsule=Mock(return_value={'schema38_capsule_receipt':{'path':'synthetic'},'additive39_migration_sha256':'a'*64});return value
 def test_narrow_api_rejects_foreign_project_methods_and_other_env_creation(self):
  value=self.adapter()
  for method,endpoint,body in [('DELETE','/v10/projects/'+p.PROJECT+'/env?teamId='+p.TEAM,None),('GET','https://arbitrary.invalid',None),('GET','/v1/projects/foreign/env/key?teamId='+p.TEAM,None),('POST','/v10/projects/'+p.PROJECT+'/env?teamId='+p.TEAM,{'key':'OPENAI_API_KEY','value':'PRIVATE'}),('PATCH','/v9/projects/'+p.PROJECT+'/env/id?teamId='+p.TEAM,{'value':'x','type':'plain'})]:
   with self.assertRaises(ValueError):value.api(method,endpoint,body)
  value.run.assert_not_called();value.write.assert_not_called()
 def test_api_only_fixed_project_production_app_create_and_value_patch(self):
  value=self.adapter();value.r.API={};value.r.DAEMON_REPO='daemon'
  value.api('POST','/v10/projects/'+p.PROJECT+'/env?teamId='+p.TEAM,{'key':'APP_ENV','value':'production','type':'plain','target':['production']})
  self.assertEqual(value.run.call_count,1);args=value.run.call_args.args[0];self.assertIn('--input',args);self.assertNotIn('production',args)
  value.api('PATCH','/v9/projects/'+p.PROJECT+'/env/public_id?teamId='+p.TEAM,{'value':'production'});self.assertEqual(value.run.call_count,2)
 def test_environment_mutation_requires_closed_success_and_saved_response_id(self):
  value=self.adapter();action={'method':'POST','key':'APP_ENV','body':{'key':'APP_ENV','value':'production','type':'plain','target':['production']}}
  item={'id':'new_id','key':'APP_ENV','value':'production','type':'plain','target':['production'],'gitBranch':None};value.api=Mock(return_value={'created':item,'failed':[]})
  self.assertEqual(value.update_environment(action),{'normal_return_observed':True,'response_id':'new_id'})
  for response in [{},{'created':item,'failed':[{'error':{'code':'denied'}}]},{'created':{**item,'target':['production','preview']},'failed':[]},{'created':{**item,'value':'wrong'},'failed':[]}]:
   value.api.return_value=response
   with self.assertRaises(ValueError):value.update_environment(action)
 def test_actual76table_checkpoint_and_all_phase_documents_parse_without_sql_execution(self):
  value=self.adapter();self.assertEqual(pglast.__version__,'v7.21');checkpoint=value.checkpoint_sql();parsed=pglast.parse_sql(checkpoint);self.assertGreater(len(parsed),3)
  self.assertIn('repeatable read read only',checkpoint);self.assertIn('eps.project_creation_intents',checkpoint);self.assertNotIn('pg_authid',checkpoint)
  self.assertTrue(all(type(row.stmt).__name__ in ('TransactionStmt','VariableSetStmt','SelectStmt')for row in parsed))
  counts=[]
  class FunctionBounds(Visitor):
   def visit_FuncCall(visitor,ancestors,node):
    if tuple(part.sval for part in node.funcname)==('jsonb_build_object',):counts.append(len(node.args or()))
  FunctionBounds()(parsed)
  self.assertGreaterEqual(len(counts),2);self.assertLessEqual(max(counts),100)
  before=t.Ports(self.state).value
  for phase in('pause','pin','resume','unwind'):
   current=copy.deepcopy(before)
   if phase!='pause':
    for row in current['canonical']['processing_config'].values():row['public']['enabled']=False
   if phase=='resume':current['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']=p.s.NATIVE
   self.assertGreater(len(pglast.parse_sql(self.state.render(current,phase,str(uuid.uuid4())))),5)
 def test_checkpoint_requires_same_transaction_preimage_and_never_logs_rows(self):
  value=self.adapter();before=t.Ports(self.state).value;tables=set(self.state.b.TABLES)|{'job_stage_attempts','project_creation_intents'}
  value.query=Mock(return_value={'state':before,'application_tables':{name:[]for name in tables},'catalogue':{}});value.hash=Mock(return_value='a'*64)
  result=value.checkpoint(before);self.assertEqual(result['tables'],76);self.assertFalse(result['restore_verified']);self.assertFalse(result['managed_auth_and_storage_bytes_included']);self.assertNotIn('application_tables',result);value.write.assert_called_once()
  value.write.reset_mock();value.query.return_value['state']=None
  with self.assertRaises(ValueError):value.checkpoint(before)
  value.write.assert_not_called()
 def healthy(self):
  now=int(time.time()*1000);digest=p.s.DAEMON
  return {'project_id':p.PROJECT,'team_id':p.TEAM,'daemon':'worker','deployment_id':'dpl_SYNTHETIC1234','environment':'production','status':'ready','requested_image':{'digest':digest},'resolved_image':{'digest':digest},'configured_instances':{'dub1':1},'configured_override':None,'memory_mib':2048,'termination_grace_seconds':300,'desired':1,'ready':1,'total':1,'instances':[{'id':'dmni_'+'a'*26,'alive':True,'image':{'digest':digest},'region':'dub1','memory_mib':2048,'stopped_at_ms':None,'started_at_ms':now-10000,'last_checked_at_ms':now}]}
 def test_healthy_requires_exact_project_daemon_digest_resources_and_fresh_instance(self):
  value=self.adapter();good=self.healthy();self.assertEqual(value.healthy(good,'dpl_SYNTHETIC1234',p.s.DAEMON)['digest'],p.s.DAEMON)
  for change in [{'project_id':'foreign'},{'daemon':'other'},{'configured_override':{'dub1':1}},{'memory_mib':1024},{'ready':0}]:
   with self.assertRaises(ValueError):value.healthy({**good,**change},'dpl_SYNTHETIC1234',p.s.DAEMON)
  stale=copy.deepcopy(good);stale['instances'][0]['last_checked_at_ms']-=120000
  with self.assertRaises(ValueError):value.healthy(stale,'dpl_SYNTHETIC1234',p.s.DAEMON)
 def test_actual_availability_guard_allows_only_checked_prefix_and_blocks_any_dispatch(self):
  fake=t.Ports(self.state);flag=t.c.ROLLOUT_ENABLED;t.c.ROLLOUT_ENABLED=True
  try:t.c.operate('prepare',fake,self.state);t.c.operate('pause',fake,self.state)
  finally:t.c.ROLLOUT_ENABLED=flag
  fake.files['forward-availability.json']={'pins':fake.pins(),'plan_sha256':fake.hash('plan.json')};plan=fake.read('plan.json')
  p.Provider.unwind_environment(fake,plan)
  parent={'before':plan['environment'],'actions':plan['environment_actions']};fake.files['env.claim.json']=parent
  action=parent['actions'][0];fake.files['env-0.claim.json']={'pins':fake.pins(),'before':fake.environment(),'action':action};fake.env=t.envs.Tests().apply(fake.env,action)
  p.Provider.unwind_environment(fake,plan)
  changed=next(row for row in fake.env['metadata']if row['id']=='private_id');changed['updatedAt']=99
  with self.assertRaises(ValueError):p.Provider.unwind_environment(fake,plan)
  fake.files['deploy.claim.json']={}
  with self.assertRaises(ValueError):p.Provider.unwind_environment(fake,plan)
 def test_unknown_env_reconciliation_reads_approved_prefix_without_inventing_normal_return(self):
  fake=t.Ports(self.state);plan={'before':fake.environment(),'actions':fake.e.actions(fake.environment())};fake.files['env.claim.json']=plan
  action=plan['actions'][0];fake.files['env-0.claim.json']={'pins':fake.pins(),'before':fake.environment(),'action':action,'parent_claim_sha256':fake.hash('env.claim.json')};fake.env=t.envs.Tests().apply(fake.env,action)
  result=p.Provider.reconcile_environment(fake,plan);self.assertEqual(result['applied_prefix'],1);self.assertEqual(result['normal_per_key_returns_observed'],0);self.assertFalse(result['all_actions_observed']);self.assertFalse(fake.exists('env-0.normal.json'));self.assertFalse(any(row[0]=='env'for row in fake.calls))
 def test_unknown_deploy_reconciliation_is_only_scoped_gets_not_resubmission(self):
  value=self.adapter();marker=str(uuid.uuid4());identifier='dpl_SYNTHETIC5678';metadata=p.meta(marker)
  record={'id':identifier,'project':{'id':p.PROJECT},'team':{'id':p.TEAM},'name':'everyone-presentation-worker-pilot','target':'production','meta':metadata,'readyState':'READY'}
  value.api=Mock(side_effect=[{'deployments':[{'uid':identifier,'meta':metadata}],'pagination':{'next':None}},record,record])
  result=value.reconcile_deployment({'marker':marker},None);self.assertEqual(result['deployment_id'],identifier);self.assertFalse(result['worker_ready_or_startup_claimed']);self.assertFalse(result['deployment_resubmitted']);self.assertTrue(all(call.args[0]=='GET'for call in value.api.call_args_list));value.write.assert_not_called();value.run.assert_not_called()
if __name__=='__main__':unittest.main()
