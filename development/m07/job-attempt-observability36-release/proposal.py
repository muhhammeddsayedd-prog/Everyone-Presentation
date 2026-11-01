"""Pure release-design helpers. No command, network, DB, write or apply entrypoint."""
from pathlib import Path
import hashlib, importlib.util, json, re

ROOT=Path(__file__).resolve().parents[3]
TARGET='pyibofyctwnqpvktepse'
PROOF='tracking/evidence/m07/job-attempt-observability36-proof/2026-11-01T01-16-10-092Z-7cff5c7d.json'
PROOF_SHA='fc7742e874e0c10f11312f798a991c884515db507377a571a831f8f6586c0b51'
CANDIDATE='development/m07/job-attempt-observability36/candidate.sql'
CANDIDATE_SHA='dc4eec586a3ae0fc9722a70ca6229742971eb21279916c32ab47cea4a802ed3b'
BASE='development/m07/workspace-summary35-release/release.py'
BASE_SHA='33e64f3c9a3d2b5d394a6a7a1468968974ef05765802c03748db70ef3890510f'
ANCHOR=b'\ncreate role eps_job_trace_owner '
MARKERS=['ATTEMPT36_DIRECT_TRIGGER_ASSERTIONS_PASSED_SYNTHETIC_ONLY','ATTEMPT36_REAL_CLAIM_CALLBACK_RETRY_ASSERTIONS_PASSED_SYNTHETIC_ONLY']

def need(value):
 if not value:raise ValueError('ATTEMPT36_RELEASE_DESIGN_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def load_base():
 path=ROOT/BASE;need(path.is_file()and not path.is_symlink()and path.resolve()==path and sha(path.read_bytes())==BASE_SHA)
 spec=importlib.util.spec_from_file_location('attempt36_readback_base35',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
def functional_bytes(raw):
 need(type(raw)is bytes and raw.count(ANCHOR)==1);return raw[raw.index(ANCHOR):]
def assert_functional_promotion(raw,candidate):
 need(sha(candidate)==CANDIDATE_SHA and functional_bytes(raw)==functional_bytes(candidate))
 return {'proved_candidate_sha256':CANDIDATE_SHA,'functional_sha256':sha(functional_bytes(candidate)),'functional_bytes_equal':True}
def validate_proof(raw):
 need(type(raw)is bytes and sha(raw)==PROOF_SHA);value=json.loads(raw)
 need(value['run_id']=='7cff5c7d-8329-4abd-ba27-a6e390a7208d'and value['result']=='passed'and value['checkpoint']=='complete')
 for key in ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes']:need(value[key]is False)
 for key in ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged',
  'original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged',
  'existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released']:need(value[key]is True)
 need(value.get('cleanup_unconfirmed')is not True)
 need(value['actual_disposable_database_absence']=={'eps_m07_r33_source_7cff5c7d83294abdba27a6e390a7208d':False,'eps_m07_r33_restore_7cff5c7d83294abdba27a6e390a7208d':False})
 need(len(value['source_seals'])==185 and value['source_seals'][CANDIDATE]==CANDIDATE_SHA)
 proof=value['attempt36_sql'];need(proof['result']=='passed'and proof['candidate36_sha256']==CANDIDATE_SHA and proof['fixture_markers']==MARKERS)
 for key in ['functional_sql_unchanged','actual_claim_callback_manual_retry','ddl_data_catalogue_rolled_back','trace_role_rolled_back','history34_and35_ephemeral']:need(proof[key]is True)
 for key in ['candidate36_history_inserted','managed_auth_policy_changed','native_executed','cloud_called','provider_called','hosted_acceptance']:need(proof[key]is False)
 need(proof['persistent_history_count']==33)
 return {'receipt':PROOF,'sha256':PROOF_SHA,'run_id':value['run_id'],'passed_local_sql_and_cleanup':True,'hosted_acceptance':False}

def readback_sql(version):
 """Post-install metadata query design only. References the new table; fails on35.
 A future reviewed operator supplies a normal coordinated14-digit36 timestamp.
 It must enforce exact receipt/source/linked-target gates before any dispatch.
 """
 need(type(version)is str and re.fullmatch(r'[0-9]{14}',version)and version>'20261031182038')
 base=load_base();q=base.literal;digest=base.digest_sql
 previous=base.state_sql()
 columns="select jsonb_build_object('position',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'acl',a.attacl,'default_sha256',"+digest("coalesce(pg_get_expr(d.adbin,d.adrelid),'')")+")v from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='eps.job_stage_attempts'::regclass and a.attnum>0 and not a.attisdropped order by a.attnum limit 65"
 constraints="select jsonb_build_object('name',c.conname,'type',c.contype,'validated',c.convalidated,'deferrable',c.condeferrable,'deferred',c.condeferred,'key',c.conkey,'references_jobs',c.confrelid='eps.jobs'::regclass,'reference_key',c.confkey,'definition_sha256',"+digest('pg_get_constraintdef(c.oid)')+")v from pg_constraint c where c.conrelid='eps.job_stage_attempts'::regclass order by c.conname limit 65"
 triggers="select jsonb_build_object('name',t.tgname,'internal',t.tgisinternal,'enabled',t.tgenabled,'type',t.tgtype,'attribute_numbers',t.tgattr::text,'function',t.tgfoid::regprocedure::text,'constraint_name',c.conname,'constraint_on_trace',c.conrelid='eps.job_stage_attempts'::regclass,'definition_sha256',"+digest('pg_get_triggerdef(t.oid)')+")v from pg_trigger t left join pg_constraint c on c.oid=t.tgconstraint where t.tgrelid='eps.jobs'::regclass order by t.tgname limit 65"
 def bounded(query):return "(select jsonb_build_object('rows',coalesce(jsonb_agg(v)filter(where ordinal<=64),'[]'::jsonb),'truncated',count(*)>64)from(select v,row_number()over()ordinal from("+query+")items)numbered)"
 trace="jsonb_build_object('owner',(select pg_get_userbyid(relowner)from pg_class where oid='eps.job_stage_attempts'::regclass),'rls',(select relrowsecurity from pg_class where oid='eps.job_stage_attempts'::regclass),'force_rls',(select relforcerowsecurity from pg_class where oid='eps.job_stage_attempts'::regclass),'table_acl',(select relacl from pg_class where oid='eps.job_stage_attempts'::regclass),'columns',"+bounded(columns)+",'constraints',"+bounded(constraints)+",'jobs_has_triggers',(select relhastriggers from pg_class where oid='eps.jobs'::regclass),'jobs_trigger_inventory',"+bounded(triggers)+",'function',(select jsonb_build_object('owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatility',p.provolatile,'config',p.proconfig,'return_type',format_type(p.prorettype,null),'language',(select lanname from pg_language where oid=p.prolang),'strict',p.proisstrict,'parallel',p.proparallel,'leakproof',p.proleakproof,'acl',p.proacl,'body_sha256',"+digest("replace(p.prosrc,E'\\r\\n',E'\\n')")+")from pg_proc p where p.oid=to_regprocedure('eps.capture_job_stage_attempt()')),'role',(select to_jsonb(r)-'rolpassword'from pg_roles r where rolname='eps_job_trace_owner'),'trace_rows',(select jsonb_build_object('count',count(*),'sha256',"+digest("coalesce(string_agg(h,E'\\n'order by h),'')")+")from(select "+digest('to_jsonb(t)')+"h from eps.job_stage_attempts t)hashed))"
 expected=base.HISTORY+[base.VERSION,version]
 return "begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';with prior35 as("+previous+"as value)select jsonb_build_object('target',"+q(TARGET)+",'expected_history',"+base.json_sql(expected)+",'previous74_and_security',prior35.value,'trace_schema',"+trace+")as attempt36_readback from prior35;rollback;"
