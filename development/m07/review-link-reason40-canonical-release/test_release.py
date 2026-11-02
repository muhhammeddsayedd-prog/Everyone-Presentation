"""Offline tests only. Never invokes CLI, DB, Docker, Auth, or a live entry."""
from pathlib import Path
import copy,importlib.util,json,re,subprocess,sys,tempfile,unittest
from unittest.mock import patch
from pglast import ast,parse_sql,parse_plpgsql

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('test_reason40_release',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
s=r.s

class TestRelease(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.c=s.Context()
 def before(self):
  c=self.c;canonical=copy.deepcopy(c.anchor)
  canonical['processing_config']['frame_extraction_config']['public']['native_image_id']=s.NATIVE
  return {'history':copy.deepcopy(c.history),'canonical':canonical,'intents':{'count':0,'sha256':'a'*64},'functions':{name:{'source_sha256':c.old[name],'identity':{'oid':number,'proowner':42,'proacl':['unchanged'],'prosecdef':True,'proconfig':['search_path=""']}}for number,name in enumerate(c.names,1)},'reason':{'present':False,'shape_valid':False,'historical_nonnull':0},'dependencies':{'old':{'count':100,'sha256':'b'*64},'reason_dependencies_valid':True},'authority':{'roles':'c'*64,'memberships':'d'*64},'history_identity':{'old_rows':'e'*64,'new_entry_valid':False}}
 def test_disabled_entry_before_context_claim_or_transport(self):
  with tempfile.TemporaryDirectory()as directory:
   result=subprocess.run([sys.executable,'-B',str(HERE/'release.py'),'prepare','48e88fe1-987e-4692-82dd-07ead832f0b6'],cwd=directory,capture_output=True,timeout=10)
   self.assertEqual(result.returncode,1);self.assertEqual(list(Path(directory).iterdir()),[]);self.assertNotIn(b'http',result.stdout+result.stderr)
  self.assertFalse(r.READ_ENABLED);self.assertFalse(r.APPLY_ENABLED)
 def test_source_admission_has_no_unrelated_mcp_acceptance_barrier(self):
  operator=r.Release('45862788-22a7-46bb-86db-b3c924df1f06',context=self.c);self.assertFalse(operator.private.exists())
  self.assertEqual(operator.c.admission()['local_proof']['sha256'],s.PROOF_SHA)
  self.assertFalse(operator.private.exists())
 def test_historical_business_aggregate_qualification_is_closed_and_monotonic(self):
  before=self.before()
  for mutate in (lambda v:v['kinds'].update(unknown=1),lambda v:v.update(job_count=-1),lambda v:v['kinds'].update(review_fit=-1),lambda v:v.update(job_count=v['job_count']+1),lambda v:v.update(job_count=0,kinds={})):
   invalid=copy.deepcopy(before);mutate(invalid['canonical']['base']['legacy'])
   with self.assertRaises(ValueError):self.c.check(invalid,False)
 def test_actual_proof_admission_and_exact_source(self):
  admission=self.c.admission();self.assertEqual(admission['local_proof'],{'path':s.PROOF,'sha256':s.PROOF_SHA});self.assertEqual(s.sha(self.c.migration),s.MIGRATION_SHA)
  self.assertEqual(len(self.c.names),4);self.assertEqual(len(self.c.tables),76);self.assertEqual(len(self.c.history),39)
 def test_exact_transition_rejects_unapproved_changes(self):
  before=self.before();after=self.c.expected(before);self.assertTrue(all(self.c.transition(before,after).values()))
  mutations=[lambda v:v['functions'][self.c.names[0]]['identity'].update(oid=999),lambda v:v['functions'][self.c.names[1]]['identity'].update(proacl=[]),lambda v:v['reason'].update(historical_nonnull=1),lambda v:v['dependencies']['old'].update(count=101),lambda v:v['authority'].update(roles='f'*64),lambda v:v['history_identity'].update(old_rows='f'*64),lambda v:v['canonical']['base']['data']['public.projects'].update(count=999)]
  for mutate in mutations:
   invalid=copy.deepcopy(after);mutate(invalid)
   with self.assertRaises(ValueError):self.c.transition(before,invalid)
 def test_generated_snapshot_checkpoint_and_atomic_transaction_parse(self):
  before=self.before();marker='cfb6f9ae-394b-43fc-bb47-acf2d11795f3'
  for sql in(self.c.state_sql(),self.c.checkpoint_sql(),self.c.render(before,marker)):
   statements=parse_sql(sql);self.assertGreater(len(statements),0)
  checkpoint=self.c.checkpoint_sql();self.assertEqual(checkpoint.count("coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text)"),76)
  # Verify the actual AST, including the two chunks that avoid PG's100-arg cap.
  sizes=[]
  def walk(value):
   if isinstance(value,ast.Node):
    if isinstance(value,ast.FuncCall)and value.funcname[-1].sval=='jsonb_build_object':sizes.append(len(value.args or()))
    for key in value.__slots__:walk(getattr(value,key,None))
   elif isinstance(value,(tuple,list)):
    for child in value:walk(child)
  walk(parse_sql(checkpoint));self.assertIn(100,sizes);self.assertIn(52,sizes);self.assertLessEqual(max(sizes),100)
  sql=self.c.render(before,marker);self.assertIn(self.c.migration.decode(),sql);self.assertEqual(sql.count('insert into supabase_migrations.schema_migrations'),1);self.assertEqual(sql.count('commit;'),1);self.assertLess(sql.index('REASON40_POSTIMAGE_CHANGED'),sql.index('commit;'));self.assertGreater(sql.index(marker),sql.index('commit;'))
  for body in re.findall(r'do \$reason40_assert\$(.*?)\$reason40_assert\$;',sql,re.S):self.assertEqual(len(parse_plpgsql('create function pg_temp.offline_check()returns void language plpgsql as $body$'+body+'$body$;')),1)
  self.assertIn("to_jsonb(t)-'reason'",self.c.state_sql());self.assertIn("attname='reason'",self.c.state_sql())
 def test_unknown_dispatch_retains_claim_and_never_infers_normal(self):
  operator=MemoryRelease(self.c,self.before())
  with patch.object(r,'READ_ENABLED',True),patch.object(r,'APPLY_ENABLED',True):
   result=operator.apply();self.assertEqual(result['result'],'unconfirmed');self.assertTrue(result['claim_retained']);self.assertTrue(result['two_independent_readbacks_equal']);self.assertFalse(result['normal_return_marker_observed']);self.assertEqual(operator.dispatches,1)
   with self.assertRaises(ValueError):operator.apply()
   self.assertEqual(operator.dispatches,1)
 def test_source_drift_refuses_before_claim(self):
  operator=MemoryRelease(self.c,self.before());operator.plan_value['source_pins']={'changed':'c'*64}
  with patch.object(r,'READ_ENABLED',True),patch.object(r,'APPLY_ENABLED',True):
   with self.assertRaises(ValueError):operator.apply()
  self.assertFalse(operator.claim.exists());self.assertEqual(operator.dispatches,0)
 def test_safe_public_checkpoint_reference_and_secret_omission(self):
  operator=MemoryRelease(self.c,self.before())
  with patch.object(r,'READ_ENABLED',True),patch.object(r,'APPLY_ENABLED',True):value=operator.apply()
  public=json.dumps(value);self.assertNotIn('PRIVATE-CHECKPOINT-ROW',public);self.assertNotIn('Bearer ',public);self.assertNotIn('application_tables',public)
  ref=value['checkpoint'];self.assertEqual(ref['history_path'],['state','history']);self.assertEqual(ref['tables'],76);self.assertEqual(ref['scope'],'after_apply');self.assertIs(ref['restore_verified'],False)
 def test_actual_checkpoint_old_rows_and_catalogue_delta_are_exact(self):
  operator=MemoryRelease(self.c,self.before());before=operator.checkpoints['before'];after=operator.checkpoints['after'];operator.compare_checkpoints_actual= lambda:r.Release.compare_checkpoints(operator,operator.plan_value['before_checkpoint'],operator.reference)
  self.assertTrue(operator.compare_checkpoints_actual())
  after['application_tables']['audit_events'][0]['principal_id']='changed'
  with self.assertRaises(ValueError):operator.compare_checkpoints_actual()
  after['application_tables']['audit_events']=copy.deepcopy(before['application_tables']['audit_events']);after['application_tables']['audit_events'][0]['reason']=None
  after['catalogue']['unapproved|grant|acl']='extra'
  with self.assertRaises(ValueError):operator.compare_checkpoints_actual()

class MemoryPath:
 def __init__(self):self.present=False
 def exists(self):return self.present
class MemoryRelease(r.Release):
 """All I/O is substituted. The inherited real apply control flow is tested."""
 def __init__(self,c,before):
  self.c=c;self.run='9363361e-8d61-4762-85e0-f3fcdde20dcc';self.plan=MemoryPath();self.claim=MemoryPath();self.returned=MemoryPath();self.dispatches=0
  self.reference={'path':'.local/review-link-reason40-canonical-release/'+self.run+'/after-checkpoint.json','sha256':'d'*64,'history_path':['state','history'],'tables':76,'scope':'after_apply','restore_verified':False}
  self.plan_value={'purpose':r.PURPOSE,'run':self.run,'target':s.TARGET,'version':s.VERSION,'source_pins':c.source_pins(),'admission':c.admission(),'before':before,'before_checkpoint':{**self.reference,'scope':'before_apply'}}
  old={table:[]for table in c.tables};old['audit_events']=[{'id':'fixture','principal_id':'PRIVATE-CHECKPOINT-ROW'}]
  new=copy.deepcopy(old);new['audit_events'][0]['reason']=None
  catalogue={};changed={f'functions|{name}|source_sha256':value for name,value in c.new.items()};changed.update({'columns|eps.audit_events.reason|type':'text','columns|eps.audit_events.reason|not_null':False,'columns|eps.audit_events.reason|acl':None,'columns|eps.audit_events.reason|identity':'','columns|eps.audit_events.reason|generated':'','columns|eps.audit_events.reason|default':None})
  self.checkpoints={'before':{'state':before,'application_tables':old,'catalogue':catalogue},'after':{'state':c.expected(before),'application_tables':new,'catalogue':changed}}
 def admission(self):return self.c.admission()
 def read(self,path):return self.plan_value if path is self.plan else self.claim_value
 def write(self,path,value):
  s.need(not path.exists());path.present=True
  if path is self.claim:self.claim_value=value
 def snapshot(self):return self.plan_value['before']if not self.claim.present or self.dispatches==0 else self.c.expected(self.plan_value['before'])
 def query(self,sql,label):self.dispatches+=1;raise TimeoutError('synthetic unknown')
 def checkpoint(self,phase,expected,installed):return self.reference
 def checkpoint_read(self,reference):return self.checkpoints['before'if reference['scope']=='before_apply'else'after']
 def compare_checkpoints(self,before,after):return True

if __name__=='__main__':unittest.main()
