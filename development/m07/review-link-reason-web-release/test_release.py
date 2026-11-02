"""Offline source/metadata/fake-port checks; no CLI, ACL, DB or provider use."""
from pathlib import Path
import copy, datetime, importlib.util, io, json, tarfile, tempfile, unittest
from pglast import parse_sql
from types import SimpleNamespace
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('review_link_reason_web_tested',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r);g=r.g
RUN='11111111-1111-4111-8111-111111111111';NOW=datetime.datetime(2026,11,2,10,tzinfo=datetime.timezone.utc)
CREF={'path':'tracking/evidence/m07/synthetic-approved-apply.json','sha256':'c'*64}
CHECKPOINT={'path':'.local/synthetic-approved/after-checkpoint.json','sha256':'d'*64,'history_path':['state','history'],'tables':76,'scope':'after_apply','restore_verified':False}

def snapshot():return {'project':{'fixed':True},'environment':[],'deployment':{'id':g.BASELINE,'state':'READY','meta':{}}}
def fake():
 op=r.Operator.__new__(r.Operator);op.run_id=RUN;op.root=Path('C:/synthetic-main');op.private=Path('C:/synthetic-owned')/RUN;op.plan=op.private/'plan.json';op.build_file=op.private/'build.json';op.returned=op.private/'deploy.returned.json';memory={};calls=[]
 op.exists=lambda p:p in memory;op.read=lambda p:copy.deepcopy(memory[p]);op.file_sha=lambda p:g.digest(memory[p])
 def write(path,value):
  if path in memory:raise ValueError('Exclusive claim already exists')
  memory[path]=copy.deepcopy(value)
 op.write=write;op.pins=lambda:{'source':'fixed'};op.gates=lambda:{'source_commit':'a'*40,'source_sha256':'b'*64,'source_root':'.local/synthetic','canonical':{'ref':CREF,'history':['20261102085405'],'checkpoint':CHECKPOINT}}
 op.observe=lambda:copy.deepcopy(snapshot());op.direct=lambda _identity:copy.deepcopy(snapshot()['deployment']);op.baseline=lambda _value:None;op.verify=lambda _plan:None;op.built=lambda _plan:{'finished_at':'2026-11-02T00:00:00+00:00'}
 op.r=SimpleNamespace(s=SimpleNamespace(production_environment=lambda _rows:None));op.old=SimpleNamespace(NODE=Path('node.exe'),CLI=Path('vc.js'),GLOBAL='normal-existing-store',deployment_url=lambda _value:'https://everyone-presentation-pilot-owned.vercel.app')
 op.run=lambda *args,**kwargs:calls.append((args,kwargs))or'{}';return op,memory,calls

class Tests(unittest.TestCase):
 def test_disabled_refuses_before_constructor_sources_private_files_or_provider(self):
  with patch.object(r,'RELEASE_ENABLED',False):
   with patch.object(r,'legacy',side_effect=AssertionError('Must not load helpers')):
    with self.assertRaises(ValueError):r.Operator(RUN)
   op,_,_=fake();op.pins=lambda:self.fail('Must not inspect when disabled')
   for action in('prepare','build','deploy','readback'):
    with self.assertRaises(ValueError):getattr(op,action)()
 def test_api_has_no_write_or_decrypt_or_other_project_surface(self):
  op,_,calls=fake()
  with patch.object(r,'RELEASE_ENABLED',True):
   for endpoint in('/v9/projects/'+g.PROJECT+'?teamId='+g.TEAM,'/v10/projects/'+g.PROJECT+'/env?teamId='+g.TEAM+'&decrypt=false','/v13/deployments/'+g.ALIAS+'?teamId='+g.TEAM):op.api(endpoint)
   for endpoint in('/v10/projects/'+g.PROJECT+'/env?teamId='+g.TEAM+'&decrypt=true','/v9/projects/prj_other?teamId='+g.TEAM,'/v10/projects/'+g.PROJECT+'/env?teamId='+g.TEAM+'&upsert=false'):
    with self.assertRaises(ValueError):op.api(endpoint)
  self.assertEqual(len(calls),3);self.assertTrue(all(args[0][0][args[0][0].index('--method')+1]=='GET'for args in calls));self.assertFalse(hasattr(op,'configure'));self.assertFalse(hasattr(op,'mutate'))
 def test_prepare_has_new_exclusive_claim_and_two_equal_reads(self):
  op,memory,_=fake();reads=[];op.observe=lambda:reads.append(True)or copy.deepcopy(snapshot())
  with patch.object(r,'RELEASE_ENABLED',True):
   self.assertEqual(op.prepare()['result'],'prepared');self.assertEqual(len(reads),2)
   with self.assertRaises(ValueError):op.prepare()
  self.assertIn(op.private/'prepare.claim.json',memory);self.assertIn(op.plan,memory)
  bad,failed,_=fake();sequence=[snapshot(),{**snapshot(),'project':{'drift':True}}];bad.observe=lambda:sequence.pop(0)
  with patch.object(r,'RELEASE_ENABLED',True):
   with self.assertRaises(ValueError):bad.prepare()
  self.assertIn(bad.private/'prepare.claim.json',failed);self.assertNotIn(bad.plan,failed)
 def test_reused_build_method_operates_only_on_new_fake_run_and_keeps_failed_claim(self):
  base=HERE.parents[2]/'.local/diagnostic-release-unit-tests';base.mkdir(parents=True,exist_ok=True)
  for lose in(False,True):
   with tempfile.TemporaryDirectory(prefix='owned-',dir=base)as temporary:
    owned=Path(temporary).resolve();self.assertTrue(owned.is_relative_to(base.resolve()));op,memory,calls=fake();op.private=owned;op.plan=owned/'plan.json';op.build_file=owned/'build.json';op.r=r.legacy(r.ROOT)
    plan={'run_id':RUN,'prepared_at':r.stamp(),'source_pins':op.pins(),'before':snapshot(),'gates':{'files':[],'public_build_environment':{},'source_commit':'a'*40,'source_sha256':'b'*64}};memory[op.plan]=plan
    op.base=SimpleNamespace(build_commands=lambda _folder:[['synthetic-ci'],['synthetic-build']],quality_output=lambda _folder:{'synthetic_build':True})
    if lose:
     def failed(*_args,**_kwargs):calls.append('build-dispatched');raise ValueError('Synthetic lost build')
     op.run=failed
    with patch.object(r,'RELEASE_ENABLED',True):
     if lose:
      with self.assertRaises(ValueError):op.build()
     else:
      self.assertEqual(op.build()['result'],'passed');self.assertIn('finished_at',r.Operator.built(op,plan));memory[op.private/'build.finished.json']['build_sha256']='f'*64
      with self.assertRaises(ValueError):r.Operator.built(op,plan)
     before=len(calls)
     with self.assertRaises(ValueError):op.build()
     self.assertEqual(len(calls),before)
    self.assertIn(op.private/'build.claim.json',memory)
 def test_prepare_claim_and_source_pins_are_bound_in_every_later_phase(self):
  op,memory,_=fake()
  with patch.object(r,'RELEASE_ENABLED',True):op.prepare()
  plan=memory[op.plan];r.Operator.verify(op,plan);memory[op.private/'prepare.claim.json']['automatic_retry']=True
  with self.assertRaises(ValueError):r.Operator.verify(op,plan)
  memory[op.private/'prepare.claim.json']['automatic_retry']=False;op.pins=lambda:{'source':'drift'}
  with self.assertRaises(ValueError):r.Operator.verify(op,plan)
 def test_unknown_deploy_is_once_only_and_ready_readback_does_not_infer_normal_return(self):
  op,memory,calls=fake();plan={'run_id':RUN,'gates':op.gates(),'before':snapshot()};memory[op.plan]=plan;memory[op.build_file]={'quality_only':True};ref={'path':'tracking/evidence/m07/synthetic-preflight.json','sha256':'c'*64};memory[op.private/'deploy-inputs.json']={'preflight_receipt':ref}
  def unknown(*_args,**_kwargs):calls.append('dispatch');raise ValueError('Synthetic lost return')
  op.run=unknown
  with patch.object(r,'RELEASE_ENABLED',True),patch.object(g,'preflight',create=True):
   self.assertEqual(op.deploy()['result'],'unconfirmed');self.assertEqual(calls,['dispatch'])
   with self.assertRaises(ValueError):op.deploy()
   self.assertEqual(calls,['dispatch']);expected=op.metadata(plan);ready={'id':'dpl_ownedfreshdeployment','state':'READY','url':'everyone-presentation-pilot-owned.vercel.app','meta':expected}
   op.observe=lambda:{**snapshot(),'deployment':copy.deepcopy(ready)};op.direct=lambda _identity:copy.deepcopy(ready)
   self.assertEqual(op.readback()['result'],'observed_ready');self.assertFalse(op.readback()['normal_process_return_observed'])
   memory[op.returned]={'claim_sha256':op.file_sha(op.private/'deploy.claim.json'),'url':'https://'+ready['url'],'normal_process_return_observed':True,'meta':expected};self.assertEqual(op.readback()['result'],'passed')
   ready['meta']['epsSourceCommit']='d'*40;self.assertEqual(op.readback()['result'],'unconfirmed')
 def test_pending40_and41_refuse_before_reading_any_supplied_receipt_or_checkpoint(self):
  with patch.object(g,'CANONICAL',{'schema40':None,'schema41':None}),patch.object(g,'reference',side_effect=AssertionError('No pending approval reads')):
   for key in('schema39','schema40','schema41'):
    with self.assertRaises(ValueError):g.canonical(Path('synthetic'),key,CREF,lambda _file:self.fail('No private read'))
 def test_future_approved_records_bind_proof_apply_and_exact_after_checkpoint_history(self):
  for count in(40,41):
   history=[str(20261028010000+i)for i in range(count-1)]+['20261102085405'];raw=json.dumps({'target':g.TARGET,'state':{'history':history}}).encode();checkpoint={**CHECKPOINT,'sha256':g.sha(raw)};proof_ref={'path':'tracking/evidence/m07/synthetic-owned-proof.json','sha256':'e'*64}
   entry={'ref':CREF,'proof':proof_ref,'checkpoint':checkpoint,'history_path':['history'],'version':history[-1],'count':count}
   apply={'result':'passed','target':g.TARGET,'version':history[-1],'normal_return_marker_observed':True,'two_independent_readbacks_equal':True,'first':{'history':history},'second':{'history':history},'local_proof':proof_ref,'checkpoint':checkpoint}
   proof={'result':'passed','all_owned_resources_absent':True,'original_data_catalogue_and_global_roles_unchanged':True,'shared_lock_released':True};verified=[]
   def reference(_root,ref):return copy.deepcopy(apply if ref==CREF else proof)
   with patch.object(g,'CANONICAL',{'schema'+str(count):entry}),patch.object(g,'reference',side_effect=reference),patch.object(g,'load',return_value=raw):
    admitted=g.canonical(Path('synthetic'),'schema'+str(count),CREF,verified.append);self.assertEqual(admitted['history'],history);self.assertEqual(verified,[Path('synthetic')/checkpoint['path']])
    with self.assertRaises(ValueError):g.canonical(Path('synthetic'),'schema'+str(count),{**CREF,'sha256':'f'*64},verified.append)
    proof['shared_lock_released']=False
    with self.assertRaises(ValueError):g.canonical(Path('synthetic'),'schema'+str(count),CREF,verified.append)
    proof['shared_lock_released']=True;apply['local_proof']={**proof_ref,'sha256':'f'*64}
    with self.assertRaises(ValueError):g.canonical(Path('synthetic'),'schema'+str(count),CREF,verified.append)
    apply['local_proof']=proof_ref
    def bad_acl(_path):raise ValueError('Synthetic private ACL denial')
    with self.assertRaises(ValueError):g.canonical(Path('synthetic'),'schema'+str(count),CREF,bad_acl)
    with patch.object(g,'load',return_value=raw+b' '):
     with self.assertRaises(ValueError):g.canonical(Path('synthetic'),'schema'+str(count),CREF,verified.append)
    wrong=json.dumps({'target':g.TARGET,'state':{'history':history[:-1]}}).encode();checkpoint['sha256']=g.sha(wrong)
    with patch.object(g,'load',return_value=wrong):
     with self.assertRaises(ValueError):g.canonical(Path('synthetic'),'schema'+str(count),CREF,verified.append)
 def test_public_projection_omits_private_plan_environment_and_raw_diagnostics(self):
  value={'result':'unconfirmed','safe_error_code':'REVIEW_LINK_REASON_WEB_UNCONFIRMED','source_pins':{'private':'synthetic-private'},'gates':{'public_build_environment':{'key':'synthetic-private'}},'before':{'private':'synthetic-private'},'raw_stderr':'synthetic-private'}
  self.assertNotIn('synthetic-private',json.dumps(r.public(value)));self.assertEqual(set(r.public(value)),{'result','safe_error_code'})
 def test_fresh_quality_binds_actual_commands_complete_inventory_seals_and_archive(self):
  products=sorted(g.REASON_FILES|{'packages/central/src/presentation.ts'});blobs={p:('synthetic '+p).encode()for p in products}
  files=[{'path':p,'bytes':len(raw),'sha256':g.sha(raw)}for p,raw in sorted(blobs.items())];buffer=io.BytesIO()
  with tarfile.open(fileobj=buffer,mode='w')as tar:
   for row in files:
    member=tarfile.TarInfo(row['path']);member.size=row['bytes'];tar.addfile(member,io.BytesIO(blobs[row['path']]))
  archive=buffer.getvalue();source={'source_commit':'a'*40,'files':files,'archive_sha256':g.sha(archive)}
  inventory=[{'path':'tests/synthetic/'+str(i)+'.ts','mode':'100644','git_blob':'d'*40}for i in range(1001)]
  checks=[{'name':name,'result':'passed','exit_code':0,'signal':None,'timed_out':False,'output_limit_exceeded':False,'spawn_failed':False,'command':['C:/Program Files/nodejs/node.exe','C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js',*command]}for name,command in g.COMMANDS.items()]
  checks[0].update(tests=973,**{'pass':973},fail=0,cancelled=0,skipped=0,todo=0,suite_summaries=6)
  value={'result':'passed','source_head_before':'a'*40,'source_head_after':'a'*40,'source_tree':'b'*40,'reviewed_source_stable':True,'testable_graph_worktree_clean':True,'changed_source_paths':[],'review':{'unresolved_findings':0},'node_version':'v24.18.0','checks':checks,'all_testable_source_files':inventory,'testable_source_file_count':len(inventory),'reviewed_source_seals':files}
  def git(_root,args):
   if args[0]=='rev-parse':return('b'*40+'\n').encode()
   if args[0]=='ls-tree':return ''.join(x['mode']+' blob '+x['git_blob']+'\t'+x['path']+'\0'for x in inventory).encode()
   if args[0]=='diff':return('\n'.join(products)+'\n').encode()
   if args[0]=='show':return blobs[args[1].split(':',1)[1]]
   if args[0]=='archive':return archive
   self.fail('Unexpected Git operation')
  with patch.object(g,'reference',return_value=value),patch.object(g,'git',side_effect=git):
   self.assertEqual(g.quality(Path('synthetic'),source,{})['actual_tests'],973)
   with self.assertRaises(ValueError):g.quality(Path('synthetic'),{**source,'files':[x for x in files if x['path']!='packages/domain/src/review-link-action.ts']},{})
   changes=[lambda v:v.update(source_head_after='f'*40),lambda v:v['checks'][0].update(skipped=1),lambda v:v['checks'][0].update(command=['echo','no-op']),lambda v:v['all_testable_source_files'].append({'path':'forged','mode':'100644','git_blob':'f'*40}),lambda v:v['reviewed_source_seals'].pop()]
   for change in changes:
    bad=copy.deepcopy(value);change(bad)
    with patch.object(g,'reference',return_value=bad):
     with self.assertRaises(ValueError):g.quality(Path('synthetic'),source,{})
 def test_preflight_requires_exact_run_source_history_gates_and_fresh_two_equal_reads(self):
  op,_,_=fake();plan={'run_id':RUN,'gates':op.gates()};current={'history':plan['gates']['canonical']['history'],'gates':{'specs':True,'candidates':True,'support':True,'frames':True,'presentations':True},'native_image_id':g.NATIVE,'english_transcript_version':'1.0','lifecycle':{key:0 for key in('queued','running','waiting_for_input','generic_retry_lifecycle','presentation_retry_lifecycle','pending_outbox','leased_outbox')}}
  value={'schema_version':'1.0','purpose':'review_link_reason_web_canonical_preflight','result':'passed','run_id':RUN,'source_commit':'a'*40,'source_manifest_sha256':'b'*64,'target':g.TARGET,'canonical_receipt':CREF,'recovery_checkpoint_sha256':CHECKPOINT['sha256'],'observed_at':NOW.isoformat(),'first':current,'second':copy.deepcopy(current),'two_independent_readbacks_equal':True,'cloud_mutations':False};built=(NOW-datetime.timedelta(minutes=1)).isoformat()
  with patch.object(g,'reference',return_value=value):
   g.preflight(Path('synthetic'),{},plan,NOW,built)
   changes=[lambda v:v.update(run_id='22222222-2222-4222-8222-222222222222'),lambda v:v.update(source_commit='f'*40),lambda v:v['first']['history'].append('20261102000000'),lambda v:[v[x]['history'].append('20261102000000')for x in('first','second')],lambda v:[v[x]['gates'].update(presentations=False)for x in('first','second')],lambda v:[v[x].update(native_image_id='sha256:'+'0'*64)for x in('first','second')],lambda v:[v[x].update(english_transcript_version='wrong')for x in('first','second')],lambda v:[v[x]['lifecycle'].update(running=1)for x in('first','second')],lambda v:v.update(recovery_checkpoint_sha256='f'*64),lambda v:v.update(canonical_receipt={'path':'wrong','sha256':'f'*64}),lambda v:v.update(observed_at=(NOW-datetime.timedelta(minutes=16)).isoformat()),lambda v:v.update(observed_at=(NOW+datetime.timedelta(minutes=2)).isoformat()),lambda v:v.update(two_independent_readbacks_equal=False),lambda v:v.update(cloud_mutations=True)]
   for change in changes:
    bad=copy.deepcopy(value);change(bad)
    with patch.object(g,'reference',return_value=bad):
     with self.assertRaises(ValueError):g.preflight(Path('synthetic'),{},plan,NOW,built)
   with self.assertRaises(ValueError):g.preflight(Path('synthetic'),{},plan,NOW,(NOW+datetime.timedelta(seconds=1)).isoformat())
 def test_preflight_sql_is_read_only_and_retains_original_protected_lifecycle_predicates(self):
  producer=r.module('review_link_reason_pure_preflight_sql',HERE/'preflight.py');sql=producer.query_sql();statements=parse_sql(sql)
  self.assertEqual([type(x.stmt).__name__ for x in statements],['TransactionStmt','VariableSetStmt','VariableSetStmt','VariableSetStmt','SelectStmt','TransactionStmt'])
  self.assertIn('repeatable read read only;',sql);self.assertTrue(sql.endswith('rollback;'));self.assertEqual(sql.count("id<>'"+producer.PROTECTED+"'"),5)
  self.assertIn("kind not in('presentation_render','presentation_export')and status='failed'and cancel_requested_at is null",sql);self.assertIn("coalesce((stage_attempts->>stage)::integer,0)<3",sql);self.assertIn("error->>'code'is distinct from'JOB_CANCELLED'",sql)
  text=(HERE/'preflight.py').read_text();self.assertNotIn("['git','rev-parse','HEAD']",text);self.assertIn('operator.verify(plan);operator.built(plan)',text);self.assertIn('need(release.RELEASE_ENABLED',text)

if __name__=='__main__':unittest.main()
