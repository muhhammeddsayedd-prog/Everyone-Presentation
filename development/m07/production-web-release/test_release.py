"""Deterministic release state/control checks; no provider or private inputs."""
from pathlib import Path
import copy, importlib.util, json, tarfile, unittest
from types import SimpleNamespace
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('production_web_tests',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
s=r.s

def fixture():
 keys={'APP_ENV':'staging','EPS_RELEASE_MODE':'controlled_pilot','EPS_PILOT_EXPIRES_AT':'','APP_BASE_URL':'https://'+s.ALIAS,'CENTRAL_ADAPTER_MODE':'supabase','MCP_AUTH_MODE':'oauth'}
 rows=[{'id':'id_'+key,'key':key,'type':'plain','target':['preview','production'],'createdAt':1,'updatedAt':1,'public_value':value}for key,value in keys.items()]
 rows.append({'id':'private_id','key':'PRIVATE_VERIFIER','type':'sensitive','target':['production'],'createdAt':1,'updatedAt':1})
 return {'project':{'fixed':True},'environment':sorted(rows,key=lambda row:row['id']),'deployment':{'id':s.BASELINE,'state':'READY'}}

class Tests(unittest.TestCase):
 def test_scoped_plan_preserves_preview_and_blank_deadline(self):
  before=fixture();steps=s.environment_steps(before['environment']);self.assertEqual([(x['kind'],x['key'])for x in steps],[('split','APP_ENV'),('create','APP_ENV'),('split','EPS_RELEASE_MODE'),('create','EPS_RELEASE_MODE')])
  for index,step in enumerate(steps):
   after=copy.deepcopy(before)
   if step['kind']=='split':
    row=next(x for x in after['environment']if x['id']==step['id']);row.update(target=['preview'],updatedAt=2)
   else:after['environment'].append({'id':'created'+str(index),'key':step['key'],'type':'plain','target':['production'],'createdAt':2,'updatedAt':2,'public_value':'production'})
   after['environment'].sort(key=lambda x:x['id']);s.transition(before,after,step);before=after
  s.production_environment(before['environment']);self.assertEqual(s.environment_steps(before['environment']),[])
 def test_private_values_are_never_retained_and_scope_duplicates_fail(self):
  raw={'envs':[{'id':'secret','key':'PRIVATE_KEY','value':'DO_NOT_RETAIN','type':'sensitive','target':['production'],'createdAt':1,'updatedAt':1}]}
  self.assertNotIn('DO_NOT_RETAIN',repr(s.environment_rows(raw)))
  raw['envs']*=2
  with self.assertRaises(ValueError):s.environment_rows(raw)
 def test_normal_cli_api_routes_are_bounded_to_web_project(self):
  operator=r.Operator.__new__(r.Operator);operator.old=SimpleNamespace(NODE=Path('node.exe'),CLI=Path('vc.js'),GLOBAL='normal-existing-store');calls=[]
  def run(args,**kwargs):calls.append((args,kwargs));return '{}'
  operator.run=run
  for endpoint in('/v9/projects/'+s.PROJECT+'?teamId='+s.TEAM,'/v10/projects/'+s.PROJECT+'/env?teamId='+s.TEAM+'&decrypt=false','/v13/deployments/'+s.ALIAS+'?teamId='+s.TEAM):self.assertEqual(operator.api(endpoint),{})
  operator.api('/v10/projects/'+s.PROJECT+'/env?teamId='+s.TEAM+'&upsert=false','POST',{'key':'APP_ENV','type':'plain','target':['production'],'value':'production'});self.assertIn('--input',calls[-1][0]);self.assertEqual(json.loads(calls[-1][1]['body'])['value'],'production')
  with self.assertRaises(ValueError):operator.api('/v10/projects/prj_worker/env?teamId='+s.TEAM,'POST',{})
 def test_other_rows_preview_value_project_alias_and_extra_grants_cannot_drift(self):
  before=fixture();step=s.environment_steps(before['environment'])[0]
  after=copy.deepcopy(before);row=next(x for x in after['environment']if x['id']==step['id']);row.update(target=['preview'],updatedAt=2)
  for mutate in[lambda v:v['environment'][-1].update(updatedAt=99),lambda v:next(x for x in v['environment']if x['id']==step['id']).update(public_value='production'),lambda v:v['project'].update(fixed=False),lambda v:v['deployment'].update(id='dpl_unapproved')]:
   changed=copy.deepcopy(after);mutate(changed)
   with self.assertRaises(ValueError):s.transition(before,changed,step)
 def test_disabled_actions_do_not_read_or_call_provider(self):
  for action in('prepare','configure','deploy'):
   p=r.Operator.__new__(r.Operator);p.pins=lambda:self.fail('No source read when disabled')
   with patch.object(r,'RELEASE_ENABLED',False):
    with self.assertRaises(ValueError):getattr(p,action)()
 def test_phase_claims_stop_replay_and_unknown_return_is_not_success(self):
  memory={};calls=[];operator=r.Operator.__new__(r.Operator)
  operator.private=Path('C:/synthetic');operator.write=lambda p,v:memory.__setitem__(p,copy.deepcopy(v));operator.exists=lambda p:p in memory;operator.read=lambda p:copy.deepcopy(memory[p]);operator.file_sha=lambda p:s.digest(memory[p]);operator.verify=lambda plan:None
  before=fixture();step=s.environment_steps(before['environment'])[0];observed=[copy.deepcopy(before)];operator.observe=lambda:copy.deepcopy(observed[0])
  after=copy.deepcopy(before);next(x for x in after['environment']if x['id']==step['id']).update(target=['preview'],updatedAt=2)
  def mutate(_step):calls.append(_step);observed[0]=after;raise ValueError('Synthetic lost response')
  operator.mutate=mutate
  result=operator.phase({'run_id':'test'},0,step,before);self.assertEqual(result['result'],'unconfirmed');self.assertTrue(result['two_readbacks_equal']);self.assertFalse(result['normal_return_observed']);self.assertEqual(len(calls),1)
  with self.assertRaises(ValueError):operator.phase({'run_id':'test'},0,step,before)
  self.assertEqual(len(calls),1)
 def test_archive_rejects_links_traversal_duplicates_and_unknown_paths(self):
  stage=r.module('production_archive_test',HERE/'stage.py');regular=tarfile.TarInfo('allowed.ts');regular.size=1
  self.assertEqual(set(stage.validate_members([regular],['allowed.ts'])),{'allowed.ts'})
  bad=[]
  for name,kind in[('../escape',tarfile.REGTYPE),('allowed.ts',tarfile.SYMTYPE),('unknown.ts',tarfile.REGTYPE)]:
   row=tarfile.TarInfo(name);row.type=kind;bad.append([row])
  bad.append([regular,regular])
  for rows in bad:
   with self.assertRaises(ValueError):stage.validate_members(rows,['allowed.ts'])
 def test_ready_readback_never_infers_missing_normal_deploy_return(self):
  operator=r.Operator.__new__(r.Operator);operator.private=Path('C:/synthetic');operator.plan=operator.private/'plan';operator.build_file=operator.private/'build';operator.configured=operator.private/'configured';operator.returned=operator.private/'returned';claim=operator.private/'deploy.claim.json'
  plan={'run_id':'11111111-1111-4111-8111-111111111111','gates':{'source_commit':'a'*40,'source_sha256':'b'*64,'canonical':{'sha256':'c'*64}}}
  configured=fixture()
  for row in configured['environment']:
   if row['key']in('APP_ENV','EPS_RELEASE_MODE'):row['public_value']='production'
  expected={'epsSourceCommit':'a'*40,'epsSourceManifest':'b'*64,'epsProductionWebRun':plan['run_id'],'epsProductionWebBuild':'d'*64,'epsProductionWebCanonical':'c'*64}
  ready={**copy.deepcopy(configured),'deployment':{'id':'dpl_freshdeployment','state':'READY','url':'everyone-presentation-pilot-owned.vercel.app','meta':expected}}
  memory={operator.plan:plan,operator.configured:{'after':configured},claim:{'claimed':True}};operator.exists=lambda p:p in memory;operator.read=lambda p:memory[p];operator.verify=lambda p:None;operator.built=lambda p:None;operator.observe=lambda:copy.deepcopy(ready);operator.direct=lambda identity:copy.deepcopy(ready['deployment']);operator.file_sha=lambda p:'d'*64
  self.assertEqual(operator.readback()['result'],'observed_ready')
  memory[operator.returned]={'claim_sha256':'d'*64,'url':'https://'+ready['deployment']['url'],'normal_process_return_observed':True,'meta':expected};self.assertEqual(operator.readback()['result'],'passed')
  ready['deployment']['meta']['epsSourceCommit']='e'*40
  with self.assertRaises(ValueError):operator.readback()
 def test_environment_reconciliation_can_observe_a_lost_split_response(self):
  operator=r.Operator.__new__(r.Operator);operator.private=Path('C:/synthetic');operator.plan=operator.private/'plan';before=fixture();after=copy.deepcopy(before);next(x for x in after['environment']if x['key']=='APP_ENV').update(target=['preview'],updatedAt=2)
  operator.read=lambda path:{'before':before};operator.verify=lambda p:None;operator.exists=lambda p:True;operator.observe=lambda:copy.deepcopy(after)
  value=operator.reconcile_environment();self.assertEqual(value['result'],'observed_only');self.assertEqual(value['production_public_values']['APP_ENV'],[]);self.assertFalse(value['desired_configuration_observed']);self.assertTrue(value['normal_return_not_inferred'])
 def test_reviewed_quality_is_carried_forward_from_exact_actual_seals(self):
  quality=r.module('production_quality_test',HERE/'quality.py');root=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio');source=json.loads(r.load(root/'tracking/evidence/m07/production-web-release/source-e70538aa-50f4-43ca-acf9-7f56282b08a9.json'));original=json.loads(r.load(root/quality.ORIGINAL['path']))
  carried=quality.carry(root,source,original);self.assertTrue(carried['carried_forward']);self.assertEqual(carried['original_tests'],949);self.assertFalse(carried['new_test_or_lint_or_typecheck_run'])
  changed=copy.deepcopy(original);changed['reviewed_source_seals'][0]['sha256']='0'*64
  with self.assertRaises(ValueError):quality.carry(root,source,changed)
  changed=copy.deepcopy(original);changed['checks'][0]['timed_out']=True
  with self.assertRaises(ValueError):quality.carry(root,source,changed)

if __name__=='__main__':unittest.main()
