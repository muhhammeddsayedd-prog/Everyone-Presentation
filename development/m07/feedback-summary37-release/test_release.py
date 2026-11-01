"""Inert source, SQL parsing and fake-dispatch tests; never runs a provider/CLI."""
from pathlib import Path
import copy, importlib.util, json, sys, unittest, uuid
from unittest.mock import Mock,patch
from pglast import ast,parse_sql,parse_plpgsql,visitors
from pglast.stream import RawStream

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('feedback37_tests_release',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r);s=r.s

def before():
 value=s.baseline();controls=value.pop('control_plane')
 value.update(session_user='postgres',cli_role_safe=True,drain={'other_active_jobs':0,'leased_outbox':0},legacy={'unsupported_metadata_count':0,'job_count':1,'kinds':{'specs_extract':1}},
  oauth={'sha256':'a'*64,'coordinator_auth_usage':False},trace_rows={'count':5,'sha256':'b'*64},
  data={name:copy.deepcopy(controls.get(name,{'count':1,'sha256':'c'*64}))for name in s.b.TABLES},
  feedback37={'functions':{s.HELPER:None,s.RPC:None},'name_counts':{'feedback_summary':0,'eps_get_feedback_summary':0},
   'guest':{'body_sha256':s.OLD_GUEST_SHA,'metadata_sha256':'d'*64},'review_no_eps_create':True})
 return value
def plan(value,pins,accepted):return {'plan_id':str(uuid.uuid4()),'target':r.TARGET,'version':r.VERSION,'before':value,'source_pins':pins,'admission':accepted}

class TypeNames(visitors.Visitor):
 def __init__(self):super().__init__();self.names=set()
 def visit_TypeName(self,_a,node):self.names.add(tuple(v.sval for v in node.names))

class ReleaseTests(unittest.TestCase):
 def test_disabled_entry_and_apply_do_not_read_inputs_or_dispatch(self):
  self.assertIs(type(r.APPLY_ENABLED),bool)
  with patch.object(r,'APPLY_ENABLED',False),patch.object(r,'admission')as admission,patch.object(r,'query')as query,patch.object(sys,'argv',['release.py','inspect']):
   with self.assertRaises(ValueError):r.main()
  admission.assert_not_called();query.assert_not_called()
  with patch.object(r,'APPLY_ENABLED',False),patch.object(r,'private_write')as write,patch.object(r,'read_state')as read:
   with self.assertRaises(ValueError):r.apply_plan({}, {}, {})
  write.assert_not_called();read.assert_not_called()

 def test_actual_proof_all217_seals_and_complete_cleanup_are_prerequisites(self):
  pins=s.sources();self.assertEqual(pins[s.MIGRATION],s.MIGRATION_SHA);self.assertEqual(pins[s.PROOF],s.PROOF_SHA)
  proof=json.loads(s.load(s.ROOT/s.PROOF));self.assertEqual(len(proof['source_seals']),217)
  self.assertTrue(set(proof['source_seals'])<=set(pins));self.assertEqual(proof['feedback37_sql']['fixture_sha256'],pins['tests/db/m07-feedback-summary.sql'])
  bad=copy.deepcopy(proof);bad['new33_roles_removed']=False
  with patch.object(s,'PROOF_SHA',s.sha(json.dumps(bad).encode())),patch.object(s,'load',side_effect=lambda p,maximum=8*1024*1024:json.dumps(bad).encode()if p==s.ROOT/s.PROOF else p.read_bytes()):
   with self.assertRaises(ValueError):s.sources()

 def test_queries_and_complete_real_transaction_parse_with_all_plpgsql_guards(self):
  for sql in [s.state_sql(),s.state_sql(True),s.static_schema_sql()]:
   tree=parse_sql(sql);self.assertEqual(len(tree),1);names=TypeNames();names(tree)
   self.assertFalse(any('jsonbas'in'.'.join(n)or'jsonband'in'.'.join(n)for n in names.names))
  sql=r.render(before(),str(uuid.uuid4()));nodes=parse_sql(sql)
  self.assertIsInstance(nodes[0].stmt,ast.TransactionStmt);self.assertIsInstance(nodes[-2].stmt,ast.TransactionStmt)
  count=0
  for raw in nodes:
   if isinstance(raw.stmt,(ast.DoStmt,ast.CreateFunctionStmt)):parse_plpgsql(RawStream()(raw.stmt));count+=1
  self.assertGreaterEqual(count,6);self.assertEqual(sql.count('begin isolation level repeatable read;'),1)
  self.assertLess(sql.index('FEEDBACK37_PREFLIGHT_CHANGED'),sql.index('create function eps.feedback_summary'))
  self.assertLess(sql.index('insert into supabase_migrations'),sql.index('FEEDBACK37_POSTCONDITION_FAILED'))
  self.assertLess(sql.index('FEEDBACK37_POSTCONDITION_FAILED'),sql.index('commit;select'))
  self.assertTrue('eps.job_stage_attempts,'in sql.split('do $guard$',1)[0])
  self.assertEqual(r.migration_body()+'commit;\n',s.SOURCE.decode().replace('\nbegin;\n','\n',1))

 def test_normalization_is_only_two_new_function_identities_and_guest_prosrc(self):
  sql=s.catalogue_sql();prior=s.old.module('catalogue_delta').normalized_catalogue_sql(s.b.catalogue_sql())
  self.assertIn("jsonb_set(to_jsonb(p),'{prosrc}',to_jsonb(",sql)
  self.assertIn("to_regprocedure('"+s.HELPER+"')",sql);self.assertIn("to_regprocedure('"+s.RPC+"')",sql)
  self.assertEqual(sql.count("to_regprocedure('"+s.GUEST+"')"),1)
  for table in ['pg_class','pg_type','pg_constraint','pg_trigger','pg_policy','pg_auth_members','pg_default_acl','pg_attrdef','pg_rewrite','pg_enum']:
   self.assertEqual(sql.count('from '+table+' '),prior.count('from '+table+' '))
  self.assertIn("coalesce(p.proacl,acldefault('f',p.proowner))",s.feedback_sql())
  self.assertEqual(s.NEW_GUEST_SHA,'1a4f925db46f580d2d8c6baa682948f28955a41fb26ba86fb563b7189248229b')

 def test_only_history_functions_guest_body_transition_preserves_all_business_trace_and_metadata(self):
  first=before();after=s.expected_after(first);self.assertTrue(all(s.check_transition(first,after).values()))
  for mutate in [lambda v:v['data']['candidates'].update(sha256='0'*64),lambda v:v['trace_rows'].update(count=6),
   lambda v:v['feedback37']['guest'].update(metadata_sha256='0'*64),lambda v:v.update(oauth_static_sha256='0'*64),
   lambda v:v['feedback37']['functions'][s.HELPER]['acl'].append({'grantee':'PUBLIC','grantor':'eps_review_owner','privilege':'EXECUTE','grantable':False}),
   lambda v:v['feedback37'].update(review_no_eps_create=False),lambda v:v['feedback37']['name_counts'].update(feedback_summary=2)]:
   bad=copy.deepcopy(after);mutate(bad)
   with self.assertRaises(ValueError):s.check_transition(first,bad)

 def test_later_static_gate_tolerates_business_and_claim_activity_but_not_config(self):
  value=s.expected_after(before());expected=s.static_schema(value)
  for name in ['jobs','candidates','feedback_comments','public.project_memberships']:value['data'][name]['sha256']='0'*64
  value['trace_rows']['count']=9;value['oauth']['sha256']='1'*64
  self.assertEqual(s.check_static(s.static_schema(value)),expected)
  value['data']['frame_extraction_config']['sha256']='2'*64
  with self.assertRaises(ValueError):s.check_static(s.static_schema(value))
  self.assertNotIn('from eps.jobs t',s.state_sql(True));self.assertNotIn('from eps.job_stage_attempts t',s.state_sql(True))

 def test_unknown_dispatch_observes_commit_without_pass_or_blind_replay(self):
  first=before();after=s.expected_after(first);pins={'synthetic':'a'*64};accepted={'synthetic_only':True}
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'sources',return_value=pins),patch.object(r,'admission',return_value=accepted),\
   patch.object(r,'read_state',side_effect=[first,first,after,after]),patch.object(r,'private_write')as claim,patch.object(r,'query',side_effect=r.DispatchUnconfirmed('SQL_TIMEOUT'))as query:
   result=r.apply_plan(plan(first,pins,accepted),pins,accepted)
  self.assertEqual(result['result'],'unconfirmed');self.assertFalse(result['normal_return_marker_observed']);self.assertTrue(result['independent_readback_verified'])
  self.assertEqual(result['safe_error_code'],'SQL_TIMEOUT');self.assertEqual(claim.call_count,1);self.assertEqual(query.call_count,1)
  claim_value=json.loads(claim.call_args.args[1]);self.assertTrue(claim_value['dispatch_may_have_occurred']);self.assertFalse(claim_value['automatic_retry'])

 def test_changed_preflight_refuses_before_claim_and_changed_claimed_sources_never_dispatch(self):
  first=before();pins={'synthetic':'a'*64};accepted={'synthetic_only':True};bad=copy.deepcopy(first);bad['data']['jobs']['sha256']='0'*64
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'read_state',return_value=bad),patch.object(r,'private_write')as claim:
   with self.assertRaises(ValueError):r.apply_plan(plan(first,pins,accepted),pins,accepted)
  claim.assert_not_called()
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'read_state',side_effect=[first,first]),patch.object(r,'private_write')as claim,patch.object(r,'sources',return_value={}),patch.object(r,'query')as query:
   result=r.apply_plan(plan(first,pins,accepted),pins,accepted)
  self.assertEqual(result['result'],'unconfirmed');self.assertEqual(result['last_stage'],'claimed_revalidation');self.assertEqual(claim.call_count,1);query.assert_not_called()

 def test_private_query_never_exposes_untrusted_diagnostics_and_requires_exact_projection(self):
  self.assertEqual(r.safe_failure(ValueError('Bearer PRIVATE source text')),'FEEDBACK37_RELEASE_UNCONFIRMED')
  with patch.object(r,'query',return_value=s.static_schema(s.expected_after(before()))):self.assertEqual(r.read_static_state()['history'][-1],s.VERSION)
  with patch.object(r,'query',return_value={'not':'installed'}):
   with self.assertRaises(ValueError):r.read_static_state()
  template=json.loads((HERE/'admission.template.json').read_bytes())
  with patch.object(s,'load',side_effect=lambda path,maximum=8*1024*1024:json.dumps(template).encode()if path==r.ADMISSION else path.read_bytes()):
   self.assertTrue(r.admission()['actual_local37_sql_and_cleanup_passed'])

if __name__=='__main__':unittest.main()
