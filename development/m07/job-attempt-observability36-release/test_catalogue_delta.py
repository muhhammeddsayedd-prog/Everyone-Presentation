"""Inert catalogue-normalization checks. No database, CLI or provider calls."""
import copy, hashlib, importlib.util, unittest
from pathlib import Path
from pglast import parse_sql

HERE=Path(__file__).resolve().parent
def module(name):
 spec=importlib.util.spec_from_file_location('attempt36_'+name,HERE/(name+'.py'))
 value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
d=module('catalogue_delta');p=module('proposal')

class CatalogueDeltaTests(unittest.TestCase):
 def before(self):
  return {'eps_oid':123,'eps_owner_oid':10,'trace_schema_acl':{'count':0,'rows':[]},
   'jobs_oid':456,'jobs_has_triggers':False,'retained_jobs_triggers':{'count':0,'sha256':'a'*64}}
 def after(self,before):
  after=copy.deepcopy(before);after['jobs_has_triggers']=True
  after['trace_schema_acl']={'count':1,'rows':[{'schema':'eps','grantor':'postgres','privilege':'USAGE','grantable':False}]}
  return after
 def test_exact_pinned_base_projection_and_readonly_sql_parse(self):
  base=p.load_base().catalogue_sql();self.assertEqual(hashlib.sha256(base.encode()).hexdigest(),d.BASE_SQL_SHA)
  actual=d.normalized_catalogue_sql(base);self.assertEqual(len(parse_sql('select '+actual+';')),1)
  self.assertEqual(len(parse_sql('select '+d.delta_metadata_sql()+';')),1)
  self.assertIn("'jobs_oid',to_regclass('eps.jobs')::oid::bigint",d.delta_metadata_sql())
  self.assertIn('select oid::bigint from pg_namespace',d.delta_metadata_sql())
  for changed in [base+' ',base.replace('pg_default_acl','pg_class'),None]:
   with self.assertRaises(ValueError):d.normalized_catalogue_sql(changed)
 def test_missing_target_is_null_safe_and_old_object_scope_is_retained(self):
  sql=d.normalized_catalogue_sql(p.load_base().catalogue_sql())
  self.assertNotIn("'eps.job_stage_attempts'::regclass",sql)
  self.assertNotIn("'eps_job_trace_owner'::regrole",sql)
  for required in ['pg_default_acl','pg_rewrite','pg_enum','pg_auth_members','pg_attrdef',
   "n.nspname in('eps','public','auth','storage','extensions')",'is not true',
   "r.oid=17603 and r.rolname='cli_login_postgres'",'relallfrozen']:
   self.assertIn(required,sql)
  self.assertIn("c.oid=to_regclass('eps.jobs')then to_jsonb(c)-'relhastriggers'",sql)
  self.assertNotIn("c.relname<>'jobs'",sql);self.assertNotIn("n.nspname<>'eps'",sql)
 def test_fk_ri_trigger_exclusion_has_full_constraint_and_relation_identity(self):
  sql=d.normalized_catalogue_sql(p.load_base().catalogue_sql())
  for required in ["t.tgrelid=to_regclass('eps.jobs')",'t.tgisinternal',
   "fk.conname='job_stage_attempts_job_id_fkey'","fk.conrelid=to_regclass('eps.job_stage_attempts')",
   "fk.confrelid=to_regclass('eps.jobs')","fk.contype='f'",'fk.oid=t.tgconstraint',
   "t.tgname='capture_job_stage_attempt'",'not t.tgisinternal','t.tgconstraint=0',
   "t.tgfoid=to_regprocedure('eps.capture_job_stage_attempt()')"]:self.assertIn(required,sql)
  self.assertEqual(sql.count("t.tgrelid=to_regclass('eps.jobs')"),1)
 def test_new_role_memberships_do_not_hide_other_grants_or_grantees(self):
  sql=d.normalized_catalogue_sql(p.load_base().catalogue_sql())
  for required in ["m.roleid=to_regrole('eps_job_trace_owner')","m.member=to_regrole('postgres')",
   "m.grantor in(to_regrole('postgres'),to_regrole('supabase_admin'))"]:self.assertIn(required,sql)
  self.assertIn('from pg_default_acl d',sql)
 def test_exact_expected_delta_with_both_valid_relhastriggers_transitions(self):
  before=self.before();d.validate_delta(before,self.after(before))
  before['jobs_has_triggers']=True;before['retained_jobs_triggers']={'count':2,'sha256':'b'*64}
  d.validate_delta(before,self.after(before))
  before['retained_jobs_triggers']={'count':0,'sha256':'c'*64};d.validate_delta(before,self.after(before))
 def test_metadata_rejects_unrelated_drift_extra_grants_nulls_and_missing_fields(self):
  before=self.before();after=self.after(before)
  for key,value in [('eps_oid',124),('eps_owner_oid',20),('jobs_oid',457),('jobs_has_triggers',False),
   ('retained_jobs_triggers',{'count':1,'sha256':'b'*64}),('trace_schema_acl',{'count':0,'rows':[]})]:
   changed=copy.deepcopy(after);changed[key]=value
   with self.assertRaises(ValueError):d.validate_delta(before,changed)
  for change in [{'privilege':'CREATE'},{'schema':'public'},{'grantor':'service_role'},{'grantable':True}]:
   changed=copy.deepcopy(after);changed['trace_schema_acl']['rows'][0].update(change)
   with self.assertRaises(ValueError):d.validate_delta(before,changed)
  for value in [None,1,'true']:
   changed=copy.deepcopy(before);changed['jobs_has_triggers']=value
   with self.assertRaises(ValueError):d.validate_delta(changed,after)
  for bad in [{**after,'extra':True},{k:v for k,v in after.items()if k!='eps_oid'}]:
   with self.assertRaises(ValueError):d.validate_delta(before,bad)
  changed=copy.deepcopy(before);changed['retained_jobs_triggers']['count']=1
  with self.assertRaises(ValueError):d.validate_delta(changed,self.after(changed))
  changed=copy.deepcopy(before);changed['trace_schema_acl']=after['trace_schema_acl']
  with self.assertRaises(ValueError):d.validate_delta(changed,after)

if __name__=='__main__':unittest.main()
