"""Inert transition/query tests with explicitly synthetic catalogue metadata."""
import copy,importlib.util,unittest
from pathlib import Path
from pglast import ast,parse_sql,parse_plpgsql,visitors
HERE=Path(__file__).resolve().parent
def load(name):
 spec=importlib.util.spec_from_file_location('attempt36_test_'+name,HERE/(name+'.py'));value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
s=load('state');g=load('schema_gate');sample=load('test_schema_gate');p=load('proposal');builder=load('build_migration')

def before():
 b=p.load_base();return {'database':'postgres','operator':'postgres','session_user':'postgres','cli_role_safe':True,'history':b.HISTORY+[b.VERSION],
  'protected_m02':b.old.PROTECTED_M02,'protected_m02_integrity':True,'drain':{'other_active_jobs':0,'leased_outbox':0},
  'english':{'flags':['1.0'],'security':True},'oauth':{'sha256':'a'*64,'coordinator_auth_usage':False},'oauth_static_sha256':'b'*64,
  'catalogue':{'count':100,'sha256':'c'*64},'data':{name:{'count':1,'sha256':'d'*64}for name in b.TABLES},'eps_tables':b.EPS_TABLES,
  'owner_no_public_create':True,'review_owner_safe':True,'cast':{'owner':'eps_cast_owner','source_sha256':b.CAST_BODY_SHA,'acl':[]},'summary':b.SUMMARY,
  'schema':copy.deepcopy(g.EMPTY_SCHEMA),'delta_metadata':{'eps_oid':1,'eps_owner_oid':2,'trace_schema_acl':{'count':0,'rows':[]},'jobs_oid':3,'jobs_has_triggers':False,'retained_jobs_triggers':{'count':0,'sha256':'e'*64}},
  'legacy':{'unsupported_metadata_count':0,'job_count':1,'kinds':{'specs_extract':1}},
  'claim_ports':{signature:{'exists':True,'owner':'synthetic-owner','definer':True,'config':['search_path=""'],'body_sha256':'f'*64,'acl':[]}for signature in s.PORTS},'trace_rows':None}
def after(value,version=s.VERSION):
 result=copy.deepcopy(value);result['history']+=([version]if version else[]);result['eps_tables']=sorted(result['eps_tables']+['job_stage_attempts'])
 result['schema']=sample.after_fixture();result['delta_metadata']['jobs_has_triggers']=True
 result['delta_metadata']['trace_schema_acl']={'count':1,'rows':[{'schema':'eps','grantor':'postgres','privilege':'USAGE','grantable':False}]}
 result['trace_rows']={'count':0,'sha256':s.sha(b'')};return result

class CastBoundaries(visitors.Visitor):
 def __init__(self):super().__init__();self.types=set();self.prior_casts=[]
 def visit_TypeName(self,_ancestors,node):self.types.add(tuple(part.sval for part in node.names))
 def visit_RangeSubselect(self,_ancestors,node):
  if node.alias and node.alias.aliasname=='p'and isinstance(node.subquery,ast.SelectStmt):
   targets=node.subquery.targetList
   if len(targets)==1 and targets[0].name=='value'and isinstance(targets[0].val,ast.TypeCast):
    self.prior_casts.append(tuple(part.sval for part in targets[0].val.typeName.names))

class StateTests(unittest.TestCase):
 def test_actual_proof_admission_promotion_and_only_header_diff(self):
  candidate=(s.ROOT/p.CANDIDATE).read_bytes();raw=(s.ROOT/s.MIGRATION).read_bytes();proof=(s.ROOT/p.PROOF).read_bytes()
  self.assertEqual(raw,builder.render(candidate,proof));self.assertTrue(p.assert_functional_promotion(raw,candidate)['functional_bytes_equal'])
  self.assertEqual(len(parse_sql(raw.decode())),20)
  block='do $attempt36_target$'+raw.decode().split('do $attempt36_target$',1)[1].split('end$attempt36_target$;',1)[0]+'end$attempt36_target$;'
  self.assertEqual(len(parse_plpgsql(block)),1)
  self.assertNotIn('owned-local-source-only-v1',raw.decode().split('create role eps_job_trace_owner',1)[0])
 def test_both_actual_queries_parse_and_before_never_names_absent_table_in_from(self):
  for phase in ['before','after','disabled']:
   sql=s.state_sql(phase,local=True);self.assertEqual(len(parse_sql(sql)),1)
   self.assertIn('unsupported_metadata_count',sql);self.assertIn('claim_ports',sql)
   if phase=='before':self.assertNotIn('from eps.job_stage_attempts t',sql)
   else:self.assertIn('from eps.job_stage_attempts t',sql)
 def test_full_cloud_transition_preserves_all74_business_oauth_and_catalogue(self):
  a=before();z=after(a);self.assertTrue(s.check_transition(a,z,migration_version=s.VERSION)['all74_old_table_hashes_unchanged'])
  for field in ['catalogue','data','oauth','english','protected_m02','claim_ports','legacy']:
   bad=copy.deepcopy(z);bad[field]={'changed':True}
   with self.assertRaises((ValueError,KeyError)):s.check_transition(a,bad,migration_version=s.VERSION)
  for field in ['history','eps_tables','trace_rows']:
   bad=copy.deepcopy(z);bad[field]=None
   with self.assertRaises((ValueError,TypeError)):s.check_transition(a,bad,migration_version=s.VERSION)
 def test_cloud_refuses_legacy_job_metadata_clock_permission_and_protected_drift(self):
  a=before();s.check_before(a)
  for field,value in [('cli_role_safe',False),('session_user','unknown'),('summary',None),('protected_m02_integrity',False),('owner_no_public_create',False)]:
   bad=copy.deepcopy(a);bad[field]=value
   with self.assertRaises(ValueError):s.check_before(bad)
  bad=copy.deepcopy(a);bad['legacy']['unsupported_metadata_count']=1
  with self.assertRaises(ValueError):s.check_before(bad)
  bad=copy.deepcopy(a);bad['claim_ports'][s.PORTS[0]]['exists']=False
  with self.assertRaises(ValueError):s.check_before(bad)
  bad=copy.deepcopy(a);bad['claim_ports'][s.PORTS[0]]['body_sha256']='0'*64
  with self.assertRaises(ValueError):s.check_before(bad,expected_ports=a['claim_ports'])
 def test_local_mode_keeps_exact_preservation_without_inventing_cloud_identity_or_flags(self):
  a=before();a.update(database='eps_m07_r33_source_'+'1'*32,session_user='supabase_admin',cli_role_safe=False,protected_m02=None,protected_m02_integrity=False)
  a['english']['flags']=[None];z=after(a,version=None)
  self.assertTrue(s.check_transition(a,z,local=True)['new_schema_gate_passed'])
  with self.assertRaises(ValueError):s.check_transition(a,z,local=False)
 def test_static_scope_allows_normal_business_and_authority_rows_but_binds_ten_config_tables(self):
  a=after(before());static=s.static_schema(a)
  for name in ['jobs','candidates','public.app_capability_grants','public.project_memberships']:
   changed=copy.deepcopy(a);changed['data'][name]['count']+=1;self.assertEqual(s.static_schema(changed),static)
  for name in p.load_base().CONTROL_TABLES:
   changed=copy.deepcopy(a);changed['data'][name]['sha256']='0'*64;self.assertNotEqual(s.static_schema(changed),static)
 def test_shared_atomic_predicates_parse_and_close_proof_guc_seams(self):
  a=before();schema=sample.after_fixture()
  for sql in [s.postcondition_sql(a,schema,migration_version=s.VERSION),s.disable_postcondition_sql(after(a),schema),
   s.postcondition_sql(local=True),s.disable_postcondition_sql(local=True)]:
   self.assertEqual(len(parse_sql('select '+sql+';')),1)
  self.assertIn("current_setting('eps.attempt36_state.expected_before',true)::jsonb",s.postcondition_sql(local=True))
  self.assertIn("current_setting('eps.attempt36_state.expected_installed',true)::jsonb",s.disable_postcondition_sql(local=True))
  with self.assertRaises(ValueError):s.postcondition_sql(local=True,before=a)
  with self.assertRaises(ValueError):s.postcondition_sql(a,schema,migration_version='unexpected')
 def test_disable_preserves_all_state_and_only_user_trigger_mode_changes(self):
  a=after(before());disabled=copy.deepcopy(a)
  next(row for row in disabled['schema']['triggers']if not row['internal'])['enabled']='D'
  self.assertTrue(s.check_disable_transition(a,disabled,local=True)['only_named_user_trigger_disabled'])
  bad=copy.deepcopy(disabled);bad['data']['jobs']['count']+=1
  with self.assertRaises(ValueError):s.check_disable_transition(a,bad)
  bad=copy.deepcopy(disabled);next(row for row in bad['schema']['triggers']if row['internal'])['enabled']='D'
  with self.assertRaises(ValueError):s.check_disable_transition(a,bad)
 def test_atomic_sql_casts_are_known_types_and_prior_alias_remains_jsonb(self):
  # Syntax parsing accepts unknown type names: the actual207 PG run proved
  # ::jsonb+as and ::jsonb+and became jsonbas/jsonband. Inspect actual AST types.
  expected={('jsonb',),('oid',),('pg_catalog','int2'),('pg_catalog','int8'),('pg_catalog','interval'),
   ('pg_catalog','numeric'),('regclass',),('regnamespace',),('regprocedure',),('regrole',),('regtype',),('text',)}
  a=before();schema=sample.after_fixture()
  variants={'local_post':s.postcondition_sql(local=True,migration_version=s.VERSION),'local_disable':s.disable_postcondition_sql(local=True),
   'production_post':s.postcondition_sql(a,schema,migration_version=s.VERSION),'production_disable':s.disable_postcondition_sql(after(a),schema)}
  for label,sql in variants.items():
   visitor=CastBoundaries();visitor(parse_sql('select '+sql+';'))
   self.assertEqual(visitor.types-expected,set(),label)
   self.assertTrue(visitor.prior_casts,label);self.assertEqual(set(visitor.prior_casts),{('jsonb',)},label)

if __name__=='__main__':unittest.main()
