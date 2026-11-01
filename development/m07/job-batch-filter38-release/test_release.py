"""Inert public-source/AST/fake-dispatch tests. No SQL/CLI/private/provider IO."""
from pathlib import Path
import copy,importlib.util,json,re,sys,unittest,uuid
from unittest.mock import Mock,patch
from pglast import ast,parse_sql,parse_plpgsql,visitors
from pglast.stream import RawStream

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('batch38_tests_operator',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r);s=r.s

def before():
 v=copy.deepcopy(json.loads(s.load(s.ROOT/s.APPLY37))['first'])
 v['batch38']={'function':None,'name_count':0,'old_port':{'owner':'eps_jobs_owner','body_sha256':s.builder.OLD_BODY_SHA,'metadata_sha256':'f'*64,'defaults':4,'definer':True,'config':['search_path=""']},'owner_safe':True,'owner_no_public_create':True}
 return v

def source_load():
 original=s.load
 return lambda p,maximum=8*1024*1024:s.SOURCE if p==s.ROOT/s.MIGRATION else original(p,maximum)

def plan(v,pins,accepted):return{'plan_id':str(uuid.uuid4()),'target':r.TARGET,'version':r.VERSION,'source_pins':pins,'admission':accepted,'before':v}

class TypeNames(visitors.Visitor):
 def __init__(self):super().__init__();self.names=set()
 def visit_TypeName(self,_a,n):self.names.add(tuple(v.sval for v in n.names))

class Tests(unittest.TestCase):
 def test_builder_is_readonly_and_preserves_entire_proved_suffix_and_RPC_body(self):
  with patch.object(Path,'write_bytes',side_effect=AssertionError('BUILDER_WRITE_FORBIDDEN')),patch.object(Path,'write_text',side_effect=AssertionError('BUILDER_WRITE_FORBIDDEN')):
   rendered=s.builder.render()
  candidate=(s.ROOT/s.builder.CANDIDATE).read_bytes();self.assertEqual(s.builder.functional_suffix(rendered),s.builder.functional_suffix(candidate))
  nodes=parse_sql(rendered.decode());funcs=[n.stmt for n in nodes if isinstance(n.stmt,ast.CreateFunctionStmt)]
  self.assertEqual(len(funcs),1);f=funcs[0];self.assertEqual(len(f.parameters),5);self.assertTrue(all(p.defexpr is None for p in f.parameters));self.assertFalse(f.replace)
  self.assertEqual('.'.join(v.sval for v in f.funcname),'public.eps_list_jobs_by_batch')
  body=next(o.arg[0].sval for o in f.options if o.defname=='as');self.assertEqual(s.sha(body.encode()),'323d6c19b056cd722cb915717d88616eaf28ed52c82c2743327f84690287d3f9')
  self.assertIn('retained_port.prosrc',rendered.decode());self.assertNotIn('create function public.eps_list_jobs(',rendered.decode())

 def test_entire_production_migration_has_no_record_relation_alias_collision(self):
  sys.path.insert(0,str(s.ROOT/'development/m07/job-batch-filter'))
  try:
   from test_candidate import record_alias_collisions
   sql=s.builder.render().decode();self.assertEqual(record_alias_collisions(sql),[])
   old=sql.replace('pg_proc prospective_proc join pg_namespace prospective_namespace','pg_proc retained_port join pg_namespace prospective_namespace').replace('prospective_proc.','retained_port.')
   self.assertIn(('retained_port','pg_proc'),record_alias_collisions(old))
  finally:sys.path.pop(0)

 def test_real_queries_and_complete_transaction_parse_all_PLpgSQL_and_cast_alias_boundaries(self):
  for sql in [s.state_sql(),s.state_sql(True),s.static_schema_sql()]:
   tree=parse_sql(sql);self.assertEqual(len(tree),1);types=TypeNames();types(tree);self.assertFalse(any('jsonbas'in'.'.join(n)or'jsonband'in'.'.join(n)for n in types.names))
  with patch.object(s,'load',side_effect=source_load()):sql=r.render(before(),str(uuid.uuid4()))
  nodes=parse_sql(sql);self.assertIsInstance(nodes[0].stmt,ast.TransactionStmt);self.assertIsInstance(nodes[-2].stmt,ast.TransactionStmt)
  for n in nodes:
   if isinstance(n.stmt,(ast.DoStmt,ast.CreateFunctionStmt)):parse_plpgsql(RawStream()(n.stmt))
  self.assertEqual(sql.count('begin isolation level repeatable read;'),1)
  self.assertLess(sql.index('BATCH38_PREFLIGHT_CHANGED'),sql.index('create function public.eps_list_jobs_by_batch'))
  self.assertLess(sql.index('insert into supabase_migrations'),sql.index('BATCH38_POSTCONDITION_FAILED'))
  self.assertLess(sql.index('BATCH38_POSTCONDITION_FAILED'),sql.index('commit;select'))
  self.assertIn('eps.job_stage_attempts,',sql.split('do $guard$',1)[0])

 def test_native_admission_requires_actual205_job_complete_cleanup_and_all376_sources_before_merge(self):
  with patch.object(s,'load',side_effect=source_load()):pins=s.native_admission_sources()
  p=json.loads(s.load(s.ROOT/s.PROOF));self.assertEqual(len(p['source_seals']),376);self.assertTrue(set(p['source_seals'])<=set(pins))
  bad=copy.deepcopy(p);bad['shared_test_lock_released']=False;original=s.load
  with patch.object(s,'PROOF_SHA',s.sha(json.dumps(bad).encode())),patch.object(s,'load',side_effect=lambda path,maximum=8*1024*1024:json.dumps(bad).encode()if path==s.ROOT/s.PROOF else original(path,maximum)):
   with self.assertRaises(ValueError):s.native_admission_sources()

 def test_catalogue_normalization_excludes_exactly_new5_and_retains_old4_all_other_catalogue_rows(self):
  old=s.prior.catalogue_sql();new=s.catalogue_sql();anchor="and p.oid is distinct from to_regprocedure('"+s.prior.RPC+"')"
  self.assertEqual(new,old.replace(anchor,anchor+"and p.oid is distinct from to_regprocedure('"+s.NEW+"')"))
  self.assertIn('to_jsonb(retained)',s.batch_sql());self.assertIn("coalesce(proc.proacl,acldefault('f',proc.proowner))",s.batch_sql())
  self.assertNotIn(s.OLD,new);self.assertNotIn('from eps.jobs t',s.state_sql(True));self.assertNotIn('from eps.job_stage_attempts t',s.state_sql(True))

 def test_exact_transition_preserves_all74_trace_old4_permissions_OAuth_and_English(self):
  first=before();after=s.expected_after(first);self.assertTrue(all(s.check_transition(first,after).values()))
  mutations=[lambda v:v['data']['jobs'].update(sha256='0'*64),lambda v:v['trace_rows'].update(count=v['trace_rows']['count']+1),
   lambda v:v['batch38']['old_port'].update(metadata_sha256='0'*64),lambda v:v['batch38'].update(owner_no_public_create=False),
   lambda v:v['batch38']['function']['acl'].append({'grantee':'PUBLIC','grantor':'eps_jobs_owner','privilege':'EXECUTE','grantable':False}),
   lambda v:v['batch38'].update(name_count=2),lambda v:v.update(oauth_static_sha256='0'*64),lambda v:v.update(catalogue={'count':1,'sha256':'0'*64})]
  for mutate in mutations:
   bad=copy.deepcopy(after);mutate(bad)
   with self.assertRaises(ValueError):s.check_transition(first,bad)

 def test_batch_metadata_rejects_boolean_integer_substitution_in_closed_SQL_projection(self):
  for key in ['name_count','defaults','variadic','support','rows']:
   installed=s.static_schema(s.expected_after(before()))
   if key=='name_count':installed['batch38'][key]=True
   else:installed['batch38']['function'][key]=False
   with self.assertRaises(ValueError):s.check_static(installed)
  installed=s.static_schema(s.expected_after(before()));installed['batch38']['function']['acl'][0]['grantable']=0
  with self.assertRaises(ValueError):s.check_static(installed)

 def test_live_static_accepts_business_and_claim_activity_but_refuses_control_and_permission_drift(self):
  first=s.expected_after(before());expected=s.static_schema(first)
  for name in ['jobs','candidates','feedback_comments','public.project_memberships']:first['data'][name]['sha256']='0'*64
  first['trace_rows']['count']+=1;first['oauth']['sha256']='1'*64
  self.assertEqual(s.check_static(s.static_schema(first)),expected)
  first['data']['frame_extraction_config']['sha256']='2'*64
  with self.assertRaises(ValueError):s.check_static(s.static_schema(first))

 def test_postmerge_source_split_native_TS_validation_fails_but_readonly_SQL_projection_still_works(self):
  original=s.load;reads=[]
  def changed(path,maximum=8*1024*1024):
   k=path.relative_to(s.ROOT).as_posix();reads.append(k)
   if k=='packages/domain/src/index.ts':return b'legitimate merged core change'
   return s.SOURCE if path==s.ROOT/s.MIGRATION else original(path,maximum)
  installed=s.static_schema(s.expected_after(before()))
  with patch.object(s,'load',side_effect=changed),patch.object(s.prior,'sources',side_effect=AssertionError('OLD_FULL_ADMISSION_FORBIDDEN')):
   with self.assertRaises(ValueError):s.native_admission_sources()
   self.assertIn('packages/domain/src/index.ts',reads);reads.clear()
   with patch.object(r,'sources',side_effect=AssertionError('FULL_SOURCE_FORBIDDEN')),patch.object(r,'admission',side_effect=AssertionError('NATIVE_ADMISSION_FORBIDDEN')),patch.object(r,'query',return_value=installed):
    self.assertEqual(r.read_static_state(),installed)
   self.assertFalse(any(k.endswith('.ts')or k.startswith('contracts/')for k in reads))
   self.assertTrue(all(not k.endswith('.ts')and not k.startswith('contracts/')for k in s.PURE_PINS))

 def test_disabled_entry_refuses_before_private_inputs_or_dispatch(self):
  self.assertIs(type(r.APPLY_ENABLED),bool)
  with patch.object(r,'APPLY_ENABLED',False),patch.object(r,'admission')as a,patch.object(r,'projection_sources')as p,patch.object(r,'query')as q,patch.object(sys,'argv',['release.py','inspect']):
   with self.assertRaises(ValueError):r.main()
  a.assert_not_called();p.assert_not_called();q.assert_not_called()
  with patch.object(r,'APPLY_ENABLED',False),patch.object(r,'private_write')as claim:
   with self.assertRaises(ValueError):r.apply_plan({}, {}, {})
  claim.assert_not_called()

 def test_unknown_dispatch_observes_commit_without_normal_return_credit_or_retry(self):
  first=before();after=s.expected_after(first);pins={'synthetic':'a'*64};accepted={'synthetic':True}
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'sources',return_value=pins),patch.object(r,'admission',return_value=accepted),patch.object(r,'read_state',side_effect=[first,first,after,after]),patch.object(r,'private_write')as claim,patch.object(r,'query',side_effect=r.DispatchUnconfirmed('SQL_TIMEOUT'))as query,patch.object(s,'load',side_effect=source_load()):
   result=r.apply_plan(plan(first,pins,accepted),pins,accepted)
  self.assertEqual(result['result'],'unconfirmed');self.assertFalse(result['normal_return_marker_observed']);self.assertTrue(result['independent_readback_verified']);self.assertEqual(query.call_count,1);self.assertEqual(claim.call_count,1)
  claimed=json.loads(claim.call_args.args[1]);self.assertTrue(claimed['dispatch_may_have_occurred']);self.assertFalse(claimed['automatic_retry'])

 def test_normal_pass_needs_one_claim_marker_and_two_equal_complete_reads(self):
  first=before();after=s.expected_after(first);pins={'synthetic':'a'*64};accepted={'synthetic':True}
  def returned(sql,label):
   self.assertEqual(label,'apply');marker=re.search("jsonb_build_object\\('version','[^']+','marker','([^']+)'",sql).group(1)
   return{'version':r.VERSION,'marker':marker,'migration_sha256':r.MIGRATION_SHA}
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'sources',return_value=pins),patch.object(r,'admission',return_value=accepted),patch.object(r,'read_state',side_effect=[first,first,after,after]),patch.object(r,'private_write')as claim,patch.object(r,'query',side_effect=returned)as query,patch.object(s,'load',side_effect=source_load()):
   result=r.apply_plan(plan(first,pins,accepted),pins,accepted)
  self.assertEqual(result['result'],'passed');self.assertTrue(result['normal_return_marker_observed']);self.assertTrue(result['independent_readback_verified']);self.assertEqual(query.call_count,1);self.assertEqual(claim.call_count,1)

 def test_changed_before_state_refuses_before_claim_and_readback_never_infers_original_return(self):
  first=before();pins={'synthetic':'a'*64};accepted={'synthetic':True};changed=copy.deepcopy(first);changed['data']['jobs']['sha256']='0'*64
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'read_state',return_value=changed),patch.object(r,'private_write')as claim:
   with self.assertRaises(ValueError):r.apply_plan(plan(first,pins,accepted),pins,accepted)
  claim.assert_not_called()
  installed=s.static_schema(s.expected_after(first))
  with patch.object(r,'APPLY_ENABLED',True),patch.object(sys,'argv',['release.py','readback']),patch.object(r,'projection_sources',return_value=pins),patch.object(r,'read_static_state',return_value=installed),patch.object(r,'save',side_effect=lambda a,v:v),patch.object(r,'sources',side_effect=AssertionError('OLD_SOURCE_FORBIDDEN')):
   observed=r.main()
  self.assertEqual(observed['result'],'observed_applied');self.assertTrue(observed['normal_return_not_inferred']);self.assertFalse(observed['full_business_hashes_rechecked'])

 def test_untrusted_failures_are_redacted_and_actual_admission_template_binds_known_receipts(self):
  self.assertEqual(r.safe_failure(ValueError('Bearer PRIVATE token https://private.invalid')),'BATCH38_RELEASE_UNCONFIRMED')
  template=json.loads((HERE/'admission.template.json').read_bytes());self.assertEqual(template['version'],r.VERSION);self.assertEqual(template['local_proof'],{'path':s.PROOF,'sha256':s.PROOF_SHA})
  self.assertEqual(template['proved_functional_body_sha256'],s.builder.NEW_BODY_SHA)

if __name__=='__main__':unittest.main()
