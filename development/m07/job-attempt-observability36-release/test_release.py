"""Offline entrypoint/transaction tests. Every catalogue fixture is synthetic.
No private file, CLI, DB, provider or migration dispatch is performed.
"""
import copy,datetime,importlib.util,io,json,sys,tempfile,unittest,uuid
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import Mock,patch
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
def load(name):
 spec=importlib.util.spec_from_file_location('attempt36_entry_test_'+name,HERE/(name+'.py'));value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
r=load('release');f=load('test_state')
def accepted():return {'schema_template':f.sample.after_fixture(),'claim_ports':f.before()['claim_ports'],'synthetic_test_only':True}

class ReleaseTests(unittest.TestCase):
 def test_explicit_execution_flags_and_real_admission_are_required(self):
  self.assertIs(type(r.APPLY_ENABLED),bool);self.assertIs(type(r.RECOVERY_ENABLED),bool)
  with patch.object(r,'APPLY_ENABLED',False),patch.object(r,'private_write')as claim,patch.object(r,'query')as query:
   with self.assertRaises(ValueError):r.apply_plan({}, {}, accepted())
  claim.assert_not_called();query.assert_not_called()
  with patch.object(r,'load',return_value=b'{"schema_version":"1.0","gate_proof":null}'):
   with self.assertRaises((ValueError,TypeError)):r.admission()
 def test_complete_apply_transaction_parses_and_atomic_failure_is_null_safe(self):
  before=f.before();sql=r.render(before,accepted(),str(uuid.uuid4()));parse_sql(sql)
  for tag in ['$assert_snapshot$','$attempt36_post$']:
   # Actual preflight helper uses an anonymous DO; the fixed postblock is checked below.
   if tag=='$attempt36_post$':
    block='do '+tag+sql.split('do '+tag,1)[1].split('end'+tag+';',1)[0]+'end'+tag+';';parse_plpgsql(block)
  self.assertIn(')is not true then raise exception',sql)
  self.assertLess(sql.index('ATTEMPT36_PREFLIGHT_CHANGED'),sql.index('create role eps_job_trace_owner'))
  self.assertLess(sql.index("insert into supabase_migrations.schema_migrations"),sql.index('ATTEMPT36_POSTCONDITION_FAILED'))
  self.assertLess(sql.index('ATTEMPT36_POSTCONDITION_FAILED'),sql.index('commit;select'))
  self.assertNotIn('drop table',sql.lower());self.assertNotIn('delete from',sql.lower())
 def test_unknown_dispatch_can_observe_commit_without_inventing_normal_return_or_replaying(self):
  before=f.before();after=f.after(before);a=accepted();pins={'synthetic_source':'a'*64};plan={'before':before,'target':r.TARGET,'source_pins':pins,'admission':a}
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'sources',return_value=pins),patch.object(r,'admission',return_value=a),\
   patch.object(r,'read_state',side_effect=[before,before,after,after]),patch.object(r,'private_write')as claim,patch.object(r,'query',side_effect=r.DispatchUnconfirmed('SQL_TIMEOUT'))as query:
   result=r.apply_plan(plan,pins,a)
  self.assertEqual(result['result'],'unconfirmed');self.assertFalse(result['normal_return_marker_observed']);self.assertTrue(result['independent_readback_verified'])
  self.assertEqual(result['safe_error_code'],'SQL_TIMEOUT');self.assertTrue(result['claim_retained']);self.assertEqual(claim.call_count,1);self.assertEqual(query.call_count,1)
 def test_changed_fresh_preflight_refuses_before_claim_and_dispatch(self):
  before=f.before();a=accepted();pins={'synthetic_source':'a'*64};plan={'before':before,'target':r.TARGET,'source_pins':pins,'admission':a};changed=copy.deepcopy(before);changed['data']['jobs']['sha256']='0'*64
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'read_state',return_value=changed),patch.object(r,'private_write')as claim,patch.object(r,'query')as query:
   with self.assertRaises(ValueError):r.apply_plan(plan,pins,a)
  claim.assert_not_called();query.assert_not_called()
 def test_changed_sources_after_permanent_claim_never_dispatch_and_keep_unknown_result(self):
  before=f.before();a=accepted();pins={'synthetic_source':'a'*64};plan={'before':before,'target':r.TARGET,'source_pins':pins,'admission':a}
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'sources',return_value={'changed':'b'*64}),\
   patch.object(r,'read_state',side_effect=[before,before,before]),patch.object(r,'private_write')as claim,patch.object(r,'query')as query:
   result=r.apply_plan(plan,pins,a)
  self.assertEqual(result['result'],'unconfirmed');self.assertEqual(result['last_stage'],'claimed_revalidation');self.assertTrue(result['claim_retained']);self.assertEqual(claim.call_count,1);query.assert_not_called()
 def test_disable_sql_is_one_exact_trigger_change_without_history_or_business_writes(self):
  before=f.after(f.before());before['drain']['other_active_jobs']=1
  sql=r.render_disable(before,accepted(),str(uuid.uuid4()));statements=parse_sql(sql)
  alters=[node.stmt for node in statements if node.stmt.__class__.__name__=='AlterTableStmt']
  self.assertEqual(len(alters),1);self.assertEqual(alters[0].relation.schemaname,'eps');self.assertEqual(alters[0].relation.relname,'jobs')
  self.assertEqual(alters[0].cmds[0].name,'capture_job_stage_attempt');self.assertIn(')is not true then raise exception',sql)
  self.assertNotIn('insert into supabase_migrations',sql);self.assertNotIn('drop ',sql.lower());self.assertNotIn('delete from',sql.lower())
  block='do $attempt36_disable$'+sql.split('do $attempt36_disable$',1)[1].split('end$attempt36_disable$;',1)[0]+'end$attempt36_disable$;';parse_plpgsql(block)
 def test_later_readback_allows_business_and_current_membership_changes_but_not_config(self):
  before=f.before();current=f.after(before);a=accepted()
  for name in ['jobs','candidates','public.project_memberships','public.app_capability_grants']:current['data'][name]['sha256']='0'*64
  current['oauth']['sha256']='1'*64;current['trace_rows']={'count':3,'sha256':'2'*64}
  self.assertEqual(r.verify_readback(current,before,a),r.s.static_schema(current))
  current['data']['frame_extraction_config']['sha256']='3'*64
  with self.assertRaises(ValueError):r.verify_readback(current,before,a)
 def test_disabled_readback_is_separate_and_never_invents_an_original_return(self):
  before=f.after(f.before());current=copy.deepcopy(before);next(row for row in current['schema']['triggers']if not row['internal'])['enabled']='D'
  self.assertEqual(r.verify_readback(current,before,accepted(),enabled='D',disabled=True),r.s.static_schema(current))
  with self.assertRaises(ValueError):r.verify_readback(current,before,accepted())
 def test_sensitive_error_text_never_enters_safe_code(self):
  self.assertEqual(r.safe_failure(RuntimeError('secret diagnostic sentinel')),'ATTEMPT36_RELEASE_UNCONFIRMED')
  self.assertEqual(r.safe_failure(r.DispatchUnconfirmed('secret diagnostic sentinel')),'ATTEMPT36_RELEASE_UNCONFIRMED')
  self.assertEqual(r.safe_failure(ValueError('ATTEMPT36_SCHEMA_UNCONFIRMED')),'ATTEMPT36_SCHEMA_UNCONFIRMED')
 def test_main_readback_observed_installed_keeps_original_return_unknown(self):
  before=f.before();current=f.after(before);a=accepted();pins={'synthetic':'a'*64};claim={'before':before,'admission':a,'source_pins':pins}
  with patch.object(sys,'argv',['release.py','readback']),patch.object(r,'admission',return_value=a),patch.object(r,'sources',return_value=pins),\
   patch.object(r,'private_json',return_value=claim),patch.object(r,'read_state',side_effect=[current,current]),patch.object(r,'save',return_value='synthetic-receipt')as save,redirect_stdout(io.StringIO()):r.main()
  result=save.call_args.args[1];self.assertEqual(result['result'],'observed_applied');self.assertTrue(result['original_dispatch_normal_return_not_inferred'])
 def test_receipts_are_created_exclusively_and_existing_evidence_is_never_overwritten(self):
  instant=datetime.datetime(2026,11,1,1,30,tzinfo=datetime.timezone.utc)
  class FixedDateTime:
   @staticmethod
   def now(_zone):return instant
  with tempfile.TemporaryDirectory(prefix='eps-attempt36-receipt-test-')as directory,patch.object(r,'ROOT',Path(directory).resolve()),patch.object(datetime,'datetime',FixedDateTime):
   path=r.ROOT/r.save('readback',{'result':'synthetic_only'});original=path.read_bytes()
   with self.assertRaises(FileExistsError):r.save('readback',{'result':'must_not_replace'})
   self.assertEqual(path.read_bytes(),original)

if __name__=='__main__':unittest.main()
