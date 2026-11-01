"""Bounded local query/validation bridge. No SQL execution, CLI or network IO."""
from pathlib import Path
import hashlib,importlib.util,json,sys
ROOT=Path(__file__).resolve().parents[3]
STATE=ROOT/'development/m07/job-attempt-observability36-release/state.py'
TAG='attempt36_release_gate_capture'
PHASES=['before','after','public_execute','disabled','wrong_body','old_jobs','restored']
def need(value):
 if not value:raise ValueError('ATTEMPT36_GATE_BRIDGE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def state():
 need(STATE.is_file()and not STATE.is_symlink()and STATE.resolve()==STATE and STATE.stat().st_nlink==1)
 spec=importlib.util.spec_from_file_location('attempt36_gate_state',STATE);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def canonical(value):return json.dumps(value,sort_keys=True,separators=(',',':')).encode()
def queries():
 s=state()
 before=s.state_sql('before',local=True);after=s.state_sql('after',local=True)
 def capture(phase):
  query=before if phase=='before'else s.state_sql('disabled'if phase=='disabled'else'after',local=True)
  if phase=='before':o=d='null::boolean'
  else:
   o=s.postcondition_sql(local=True,migration_version=s.VERSION,trigger_enabled='O')
   d=s.disable_postcondition_sql(local=True)
  return "with observed(value)as("+query+")select jsonb_build_object('"+TAG+"','"+phase+"','value',value,'atomic_o',"+o+",'atomic_d',"+d+")from observed;\n"
 post="insert into supabase_migrations.schema_migrations(version,statements,name)values('"+s.VERSION+"',array[]::text[],'m07_job_attempt_observability');\n"+"""do $gate36_template$declare observed jsonb;begin
 observed:=("""+after+""");
 perform set_config('eps.attempt36_state.expected_installed',observed::text,true);
 perform set_config('eps.attempt36_schema_gate.expected',(observed->'schema')::text,true);
 perform set_config('eps.attempt36_schema_gate.mode','owned-local-rollback-v1',true);
 if not exists(select 1 from aclexplode(coalesce(null::aclitem[],acldefault('f',(select proowner from pg_proc where oid=to_regprocedure('eps.capture_job_stage_attempt()')))))a where a.grantee=0 and a.privilege_type='EXECUTE')
 then raise exception 'ATTEMPT36_GATE_NULL_DEFAULT_PUBLIC_REQUIRED';end if;
 end$gate36_template$;
 """+capture('after')
 changes=[('public_execute','grant execute on function eps.capture_job_stage_attempt() to public;'),
  ('disabled','alter table eps.jobs disable trigger capture_job_stage_attempt;'),
  ('wrong_body',"create or replace function eps.capture_job_stage_attempt()returns trigger language plpgsql volatile security definer set search_path=''as $wrong_body$begin return null;end$wrong_body$;"),
  ('old_jobs',"do $stats_guard$begin if(select attstattarget from pg_attribute where attrelid=to_regclass('eps.jobs')and attname='correlation_id')is not distinct from 1000 then raise exception 'ATTEMPT36_GATE_DISTINCT_OLD_METADATA_REQUIRED';end if;end$stats_guard$;alter table eps.jobs alter column correlation_id set statistics 1000;")]
 for phase,change in changes:
  savepoint='gate36_'+phase;post+='savepoint '+savepoint+';\n'+change+'\n'+capture(phase)+'rollback to savepoint '+savepoint+';release savepoint '+savepoint+';\n'
 post+=capture('restored')
 pre="do $gate36_before$declare observed jsonb;begin observed:=("+before+");perform set_config('eps.attempt36_state.expected_before',observed::text,true);end$gate36_before$;\n"+capture('before')
 return {'before':before,'after':after,'before_capture_sql':pre,'after_candidate_sql':post,'phases':PHASES,'source_pins':s.sources()}
def validate(value):
 need(type(value)is dict and list(value)==PHASES);s=state()
 for phase in PHASES:
  row=value[phase];need(type(row)is dict and set(row)=={'value','atomic_o','atomic_d'})
  if phase=='before':need(row['atomic_o']is None and row['atomic_d']is None)
  else:need(type(row['atomic_o'])is bool and type(row['atomic_d'])is bool)
 before=value['before']['value'];after=value['after']['value']
 proof=s.check_transition(before,after,local=True,migration_version=s.VERSION)
 for phase in ['after','restored']:need(value[phase]['atomic_o']is True and value[phase]['atomic_d']is False)
 for phase in ['public_execute','wrong_body','old_jobs']:
  need(value[phase]['atomic_o']is False and value[phase]['atomic_d']is False)
  try:s.check_transition(before,value[phase]['value'],local=True,migration_version=s.VERSION)
  except (ValueError,KeyError,TypeError):pass
  else:need(False)
 # Confirm the deliberately changed seam, rather than credit an unrelated
 # malformed observation as rejection of this particular permission/body test.
 for phase in ['public_execute','wrong_body']:
  actual=value[phase]['value'];need({k:v for k,v in actual.items()if k!='schema'}=={k:v for k,v in after.items()if k!='schema'})
  need({k:v for k,v in actual['schema'].items()if k!='function'}=={k:v for k,v in after['schema'].items()if k!='function'})
  changed='nonowner_acl'if phase=='public_execute'else'source_sha256'
  need({k:v for k,v in actual['schema']['function'].items()if k!=changed}=={k:v for k,v in after['schema']['function'].items()if k!=changed})
  need(actual['schema']['function'][changed]!=after['schema']['function'][changed])
  if phase=='public_execute':
   acl=actual['schema']['function']['nonowner_acl'];need(type(acl)is list and len(acl)==1 and acl[0]['privilege']=='EXECUTE'and acl[0]['grantable']is False)
 old=value['old_jobs']['value'];need({k:v for k,v in old.items()if k!='catalogue'}=={k:v for k,v in after.items()if k!='catalogue'})
 need(old['catalogue']['count']==after['catalogue']['count']and old['catalogue']['sha256']!=after['catalogue']['sha256'])
 need(value['disabled']['atomic_o']is False and value['disabled']['atomic_d']is True)
 s.check_disable_transition(after,value['disabled']['value'],local=True)
 need(value['restored']['value']==after)
 return {'result':'passed','gates':proof,'before_sha256':sha(canonical(before)),'after_sha256':sha(canonical(after)),
  'normal_transition_passed':True,'public_execute_rejected':True,'disabled_only_passed':True,'wrong_body_rejected':True,
  'unrelated_old_jobs_metadata_rejected':True,'restored_exact_passed':True,'all_atomic_predicates_observed':True,
  'null_default_public_execute_equivalent_observed':True,'schema_template':after['schema'],'claim_ports':before['claim_ports'],
  'candidate36_history_inserted':True,'history36_ephemeral':True,'history36_persisted':False,'atomic_postcondition_includes_history36':True,
  'query_source_pins':s.sources(),'local_metadata_only':True,'canonical_business_writes':False,'cloud_called':False,'provider_called':False,'hosted_acceptance':False}
def main():
 need(len(sys.argv)==2 and sys.argv[1]in('queries','validate'))
 raw=sys.stdin.buffer.read(4*1024*1024+1);need(len(raw)<=4*1024*1024)
 if sys.argv[1]=='queries':need(raw==b'');value=queries()
 else:value=validate(json.loads(raw))
 encoded=canonical(value);need(len(encoded)<=4*1024*1024);sys.stdout.buffer.write(encoded+b'\n')
if __name__=='__main__':
 try:main()
 except Exception:
  sys.stderr.write('ATTEMPT36_GATE_BRIDGE_UNCONFIRMED\n');sys.exit(1)
