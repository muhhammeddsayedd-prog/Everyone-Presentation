"""Offline canonical35 release tests. No database, CLI or provider calls."""
import copy, importlib.util, unittest, uuid
from pathlib import Path
from unittest.mock import patch, Mock

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('summary35_release',HERE/'release.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

class ReleaseTests(unittest.TestCase):
 def before(self):
  value={'database':'postgres','operator':'postgres','cli_role_safe':True,'history':r.HISTORY,
   'protected_m02':r.old.PROTECTED_M02,'protected_m02_integrity':True,'drain':{'other_active_jobs':0,'leased_outbox':0},
   'english':{'flags':['1.0'],'security':True},'oauth':{'coordinator_auth_usage':False},
   'catalogue':{'count':100,'sha256':'a'*64},'data':{name:{'count':1,'sha256':'b'*64}for name in r.TABLES},
   'eps_tables':r.EPS_TABLES,'owner_no_public_create':True,'review_owner_safe':True,
   'cast':{'owner':'eps_cast_owner','source_sha256':r.CAST_BODY_SHA,'acl':[{'grantee':'eps_cast_owner','grantor':'eps_cast_owner','privilege':'EXECUTE','grantable':False}]},
   'summary':None,'oauth_static_sha256':'e'*64}
  value['static_schema']=r.static_schema(value);return value
 def test_exact_history_flag_and_permission_admission(self):
  r.check_before(self.before())
  for key,value in [('database','other'),('operator','service_role'),('history',r.HISTORY[:-1]),('owner_no_public_create',False),('summary',{})]:
   state=self.before();state[key]=value
   with self.assertRaises(ValueError):r.check_before(state)
  for value in [None,[],[None],['2.0']]:
   state=self.before();state['english']['flags']=value
   with self.assertRaises(ValueError):r.check_before(state)
 def test_expected_delta_is_only_history_function_and_one_narrow_grant(self):
  before=self.before();after=r.expected_after(before)
  self.assertEqual(after['history'],r.HISTORY+[r.VERSION]);self.assertEqual(after['data'],before['data']);self.assertEqual(after['catalogue'],before['catalogue'])
  self.assertEqual(len(after['cast']['acl']),2);self.assertEqual(after['summary'],r.SUMMARY)
  r.check_after(after,before)
  for key in ['data','catalogue','oauth','protected_m02']:
   changed=copy.deepcopy(after);changed[key]={'changed':True}
   with self.assertRaises(ValueError):r.check_after(changed,before)
 def test_existing_explicit_cast_execute_is_not_duplicated(self):
  before=self.before();before['cast']['acl']=r.expected_after(before)['cast']['acl']
  before['static_schema']=r.static_schema(before)
  self.assertEqual(r.expected_after(before)['cast']['acl'],before['cast']['acl'])
 def test_atomic_source_and_history_render_parse(self):
  from pglast import parse_sql,parse_plpgsql
  sql=r.render(self.before(),str(uuid.uuid4()))
  parse_sql(sql);parse_plpgsql(r.old.assertion(r.state_sql(),self.before(),'SOURCE_TEST'))
  self.assertLess(sql.index('SUMMARY35_PREFLIGHT_CHANGED'),sql.index('create function public.eps_get_workspace_summary'))
  self.assertLess(sql.index('SUMMARY35_POSTCONDITION_FAILED'),sql.index('commit;'))
  self.assertEqual(sql.count('insert into supabase_migrations.schema_migrations'),1)
  self.assertNotIn('update eps.candidate_asset_config',sql);self.assertNotIn('drop ',sql.lower())
  with self.assertRaises(ValueError):r.render(self.before(),"bad-marker")
 def test_unreviewed_count_and_new_grant_do_not_expand_auth_or_rls(self):
  sql=r.state_sql()
  for catalog in ['pg_policy','pg_auth_members','pg_attrdef','pg_rewrite','pg_enum']:self.assertIn(catalog,sql)
  self.assertNotIn('from auth.users',sql.lower());self.assertNotIn('from auth.sessions',sql.lower())
  self.assertIn('to_jsonb(t)',sql);self.assertIn('presentation_video_english_transcripts',sql)
 def test_unknown_dispatch_retains_claim_and_never_repeats_mutation(self):
  before=self.before();pins={'source':'c'*64};plan={'before':before,'source_pins':pins,'target':r.TARGET,'local_proof':{'ok':True}}
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'sources',return_value=pins),patch.object(r,'proof',return_value={'ok':True}),patch.object(r,'read_state',side_effect=[before,before,r.expected_after(before),r.expected_after(before)]),patch.object(r,'claim')as claim,patch.object(r,'query',side_effect=RuntimeError('PRIVATE')),patch.object(r,'save',return_value='synthetic-receipt'):
   value=r.apply_plan(plan,pins);self.assertEqual(value['result'],'unconfirmed');self.assertFalse(value['normal_return_marker_observed']);self.assertTrue(value['independent_readback_verified']);self.assertEqual(claim.call_count,1)
 def test_changed_preflight_after_claim_prevents_dispatch(self):
  before=self.before();pins={'source':'c'*64};plan={'before':before,'source_pins':pins,'target':r.TARGET,'local_proof':{'ok':True}}
  changed=copy.deepcopy(before);changed['data']['candidates']['sha256']='d'*64
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'sources',return_value=pins),patch.object(r,'proof',return_value={'ok':True}),patch.object(r,'read_state',side_effect=[before,changed,changed,changed]),patch.object(r,'claim')as claim,patch.object(r,'query')as query,patch.object(r,'save',return_value='synthetic-receipt'):
   self.assertEqual(r.apply_plan(plan,pins)['result'],'unconfirmed');query.assert_not_called();self.assertEqual(claim.call_count,1)
 def test_all_sources_are_pinned_without_reading_a_private_environment(self):
  pins=r.sources();self.assertEqual(pins[r.MIGRATION.relative_to(r.ROOT).as_posix()],r.MIGRATION_SHA)
  self.assertEqual(len(r.EPS_TABLES),69);self.assertEqual(len(r.TABLES),74)
  self.assertIn('tools/provision_logo_verifier.py',pins);self.assertIn('development/m07/oauth-attempt-trace/inspect-attempt.py',pins)
  self.assertFalse(any('.env'in name or '.local/'in name for name in pins))
 def test_job_drain_and_review_owner_must_not_drift(self):
  for field in ['other_active_jobs','leased_outbox']:
   before=self.before();before['drain'][field]=1
   with self.assertRaises(ValueError):r.check_before(before)
  before=self.before();before['review_owner_safe']=False
  with self.assertRaises(ValueError):r.check_before(before)
 def test_actual_local_proof_requires_cleanup_and_correct_source(self):
  value={'run_id':'ef4cb6c2-3f4a-4869-a71a-d747f1db99ca','result':'passed','checkpoint':'complete',
   **{k:False for k in ['cloud_called','provider_called','canonical_business_writes']},
   **{k:True for k in ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released']},
   'actual_disposable_database_absence':{'eps_m07_r33_source_ef4cb6c23f4a4869a71ad747f1db99ca':False,'eps_m07_r33_restore_ef4cb6c23f4a4869a71ad747f1db99ca':False},
   'summary35_sql':{'result':'passed','actual35_sha256':r.MIGRATION_SHA,'ddl_data_catalogue_rolled_back':True,'history35_inserted':False,'fixture_markers':['SUMMARY35_FIXTURE_ASSERTIONS_PASSED_SYNTHETIC_ONLY']},
   'source_seals':{'tests/db/m07-workspace-summary.sql':r.FIXTURE_SHA}}
  self.assertEqual(r.validate_proof(value)['result'],'passed')
  for key in ['shared_test_lock_released','original_local_database_unchanged']:
   bad=copy.deepcopy(value);bad[key]=False
   with self.assertRaises(ValueError):r.validate_proof(bad)
  bad=copy.deepcopy(value);bad['source_seals']['tests/db/m07-workspace-summary.sql']='0'*64
  with self.assertRaises(ValueError):r.validate_proof(bad)
 def cli_observation(self):
  return {'oid':'17603','name':'cli_login_postgres','can_login':True,'superuser':False,'create_role':False,'create_db':False,'bypassrls':False,
   'current_user':'postgres','session_user':'postgres','observed_at':'2026-11-01T00:40:58.849387+00:00','valid_until':'2026-11-01T00:45:57.875199+00:00'}
 def test_real_five_minute_cli_expiry_refresh_is_the_only_normalized_field(self):
  first=self.cli_observation();second={**first,'observed_at':'2026-11-01T00:41:07.481716+00:00','valid_until':'2026-11-01T00:46:04.444609+00:00'}
  self.assertEqual(r.cli_observation(first),r.cli_observation(second))
  sql=r.catalogue_sql();self.assertIn("r.oid=17603 and r.rolname='cli_login_postgres'",sql)
  self.assertEqual(sql.count("'{rolvaliduntil}'"),1)
  self.assertIn("else to_jsonb(r)-'rolpassword'",sql)
 def test_cli_role_identity_privilege_and_ttl_drift_are_denied(self):
  for patch_value in [{'oid':'17604'},{'name':'other_login'},{'can_login':False},{'superuser':True},{'create_role':True},{'create_db':True},{'bypassrls':True},
   {'valid_until':'2026-11-01T00:40:58+00:00'},{'valid_until':'2026-11-01T00:51:00+00:00'},{'valid_until':'infinity'},{'valid_until':None}]:
   with self.assertRaises(ValueError):r.cli_observation({**self.cli_observation(),**patch_value})
  before=self.before();before['cli_role_safe']=False
  with self.assertRaises(ValueError):r.check_before(before)
  sql=r.state_sql();self.assertIn('isfinite(rolvaliduntil)',sql);self.assertIn("interval '10 minutes'",sql)
  self.assertIn('rolvaliduntil>statement_timestamp()',sql)
 def test_static_gate_allows_business_changes_but_full_apply_still_refuses_them(self):
  before=self.before();after=r.expected_after(before);changed=copy.deepcopy(after)
  changed['data']['jobs']['count']+=1;changed['drain']['other_active_jobs']=1;changed['oauth']['sha256']='new-claims-count'
  for table in ['public.app_capability_grants','public.project_memberships','public.client_memberships','workspaces','candidates','feedback_comments']:
   changed['data'][table]['count']+=1
  self.assertEqual(r.static_schema(changed),after['static_schema'])
  with self.assertRaises(ValueError):r.check_after(changed,before)
  for table in ['public.app_capability_grants','public.project_memberships','public.client_memberships']:
   changed=copy.deepcopy(after);changed['data'][table]['count']+=1
   self.assertEqual(r.static_schema(changed),after['static_schema'])
   with self.assertRaises(ValueError):r.check_after(changed,before)
  for key in ['catalogue','english','cast','summary','protected_m02','history','oauth_static_sha256']:
   changed=copy.deepcopy(after);changed[key]={'changed':True}
   self.assertNotEqual(r.static_schema(changed),after['static_schema'])
  self.assertEqual(len(r.CONTROL_TABLES),10)
  for table in r.CONTROL_TABLES:
   changed=copy.deepcopy(after);changed['data'][table]['sha256']='f'*64
   self.assertNotEqual(r.static_schema(changed),after['static_schema'])
 def test_static_sql_is_metadata_only_and_keeps_only_known_oauth_counter_excluded(self):
  from pglast import parse_sql
  sql=r.static_schema_sql();parse_sql(sql)
  for table in ['eps.candidates','eps.workspaces','eps.feedback_comments','public.app_capability_grants','public.project_memberships','public.client_memberships']:
   self.assertNotIn('from '+table+' t)hashed_rows',sql)
  for table in r.CONTROL_TABLES:self.assertIn('from eps.'+table+' t)hashed_rows',sql)
  self.assertNotIn("status in('queued','running','waiting_for_input')",sql)
  self.assertIn("v-'claims_count'",sql);self.assertIn('oauth_static_sha256',sql)
  self.assertIn('protected_m02_integrity',sql)
  self.assertIn("when q.value->'cli_role_safe'='true'::jsonb",sql)
  with patch.object(r,'query',return_value=None):
   with self.assertRaises(ValueError):r.read_static_state()
 def test_other_role_or_privilege_catalogue_drift_is_still_rejected(self):
  before=self.before();after=r.expected_after(before);changed=copy.deepcopy(after)
  changed['catalogue']['sha256']='f'*64;changed['static_schema']=r.static_schema(changed)
  with self.assertRaises(ValueError):r.check_after(changed,before)
  sql=r.catalogue_sql();self.assertNotIn("-'rolvaliduntil'",sql);self.assertIn('from pg_auth_members m',sql)
 def test_committed_static_receipt_does_not_imply_normal_return(self):
  before=self.before();after=r.expected_after(before);pins={'source':'c'*64};plan={'before':before,'source_pins':pins,'target':r.TARGET,'local_proof':{'ok':True}}
  with patch.object(r,'APPLY_ENABLED',True),patch.object(r,'CLAIM',Mock(exists=lambda:False)),patch.object(r,'sources',return_value=pins),patch.object(r,'proof',return_value={'ok':True}),patch.object(r,'read_state',side_effect=[before,before,after,after]),patch.object(r,'claim'),patch.object(r,'query',side_effect=RuntimeError('PRIVATE')),patch.object(r,'save',return_value='synthetic-receipt')as save:
   result=r.apply_plan(plan,pins);self.assertEqual(result['result'],'unconfirmed')
   receipt=save.call_args.args[1];self.assertEqual(receipt['static_schema_before'],before['static_schema']);self.assertEqual(receipt['static_schema_after'],after['static_schema'])
   self.assertFalse(receipt['normal_return_marker_observed']);self.assertTrue(receipt['independent_readback_verified'])

if __name__=='__main__':unittest.main()
