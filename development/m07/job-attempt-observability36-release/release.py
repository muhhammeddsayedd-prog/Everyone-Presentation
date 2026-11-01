"""Guarded canonical35->36 source operator. Disabled; no actions on import.

Root owns live inspection, exact gate-proof admission and once-only dispatch.
"""
from pathlib import Path
import copy,importlib.util,json,os,re,sys,uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
APPLY_ENABLED=False;RECOVERY_ENABLED=False
TARGET='pyibofyctwnqpvktepse'
PRIVATE=ROOT/'.local/m07-job-attempt36-release';PLAN=PRIVATE/'plan.json';CLAIM=PRIVATE/'apply.claim.json';DISABLE_CLAIM=PRIVATE/'disable.claim.json'
ADMISSION=HERE/'admission.json'
SAFE_ERRORS={'ATTEMPT36_PREFLIGHT_CHANGED','M07_ATTEMPT36_EXACT_REVIEWED35_REQUIRED','ATTEMPT36_POSTCONDITION_FAILED','ATTEMPT36_DISABLE_PREFLIGHT_CHANGED','ATTEMPT36_DISABLE_POSTCONDITION_FAILED'}
PUBLIC_CODES=SAFE_ERRORS|{'SQL_TIMEOUT','CLI_OUTPUT_LIMIT','CLI_SQL_UNCONFIRMED','ATTEMPT36_STATE_UNCONFIRMED','ATTEMPT36_SCHEMA_UNCONFIRMED','ATTEMPT36_CATALOGUE_DELTA_UNCONFIRMED','ATTEMPT36_RELEASE_DESIGN_UNCONFIRMED','ATTEMPT36_RELEASE_UNCONFIRMED'}
class DispatchUnconfirmed(ValueError):
 def __init__(self,code):
  self.safe_code=code if code in PUBLIC_CODES else'ATTEMPT36_RELEASE_UNCONFIRMED';super().__init__('ATTEMPT36_SQL_DISPATCH_UNCONFIRMED')
def safe_failure(error):
 code=error.safe_code if isinstance(error,DispatchUnconfirmed)else str(error)
 return code if code in PUBLIC_CODES else'ATTEMPT36_RELEASE_UNCONFIRMED'
def need(value):
 if not value:raise ValueError('ATTEMPT36_RELEASE_UNCONFIRMED')
def module(name):
 need(name in('state','proposal','schema_gate','catalogue_delta'))
 spec=importlib.util.spec_from_file_location('attempt36_release_'+name,HERE/(name+'.py'));value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
s=module('state');p=module('proposal');g=module('schema_gate');b=p.load_base()
VERSION=s.VERSION;MIGRATION=ROOT/s.MIGRATION
SOURCE=MIGRATION.read_bytes();p.assert_functional_promotion(SOURCE,(ROOT/p.CANDIDATE).read_bytes())
MIGRATION_SHA=s.sha(SOURCE)
def load(path,maximum=8*1024*1024):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_nlink==1 and path.stat().st_size<=maximum);return path.read_bytes()
def admission():
 raw=load(ADMISSION);config=json.loads(raw);need(type(config)is dict and set(config)=={'schema_version','gate_proof'})
 need(config['schema_version']=='1.0');ref=config['gate_proof'];need(type(ref)is dict and set(ref)=={'path','sha256','run_id'})
 need(type(ref['path'])is str and re.fullmatch(r'tracking/evidence/m07/job-attempt-observability36-gate-proof/[A-Za-z0-9._-]+\.json',ref['path'])and re.fullmatch('[a-f0-9]{64}',ref['sha256']))
 need(str(uuid.UUID(ref['run_id']))==ref['run_id']);receipt_raw=load(ROOT/ref['path']);need(s.sha(receipt_raw)==ref['sha256']);value=json.loads(receipt_raw)
 need(value['run_id']==ref['run_id']and value['result']=='passed'and value['checkpoint']=='complete'and value.get('cleanup_unconfirmed')is not True)
 for key in ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes']:need(value[key]is False)
 for key in ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged','original29_full_auth_storage_catalogue_unchanged',
  'original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released']:need(value[key]is True)
 suffix=ref['run_id'].replace('-','');need(value['actual_disposable_database_absence']=={'eps_m07_r33_source_'+suffix:False,'eps_m07_r33_restore_'+suffix:False})
 proof=value['attempt36_gate_sql'];need(proof['result']=='passed')
 for key in ['normal_transition_passed','public_execute_rejected','disabled_only_passed','wrong_body_rejected','unrelated_old_jobs_metadata_rejected','restored_exact_passed','all_atomic_predicates_observed','history36_ephemeral','atomic_postcondition_includes_history36']:need(proof[key]is True)
 need(proof['history36_persisted']is False)
 need(proof['cloud_called']is False and proof['provider_called']is False)
 pins=s.sources();need(proof['query_source_pins']==pins)
 for file,digest in proof['query_source_pins'].items():need(s.sha(load(ROOT/file))==digest)
 for file,digest in value['source_seals'].items():
  need(type(file)is str and not Path(file).is_absolute()and '..'not in Path(file).parts)
  need(s.sha(load(ROOT/file))==digest)
 schema=proof['schema_template'];g.check_schema_after(schema);ports=proof['claim_ports'];need(set(ports)==set(s.PORTS))
 return {'gate_proof':copy.deepcopy(ref),'schema_template':copy.deepcopy(schema),'claim_ports':copy.deepcopy(ports),'query_source_pins':pins,
  'admission_sha256':s.sha(raw),'actual_gate_sql_and_cleanup_passed':True}
def sources():
 pins=s.sources()
 for path in [Path(__file__),HERE/'test_release.py',HERE/'README.md',HERE/'admission.template.json',HERE/'live_observer.py',HERE/'test_live_observer.py',HERE/'LIVE_AUDIT_PLAN.md',ADMISSION]:pins[path.relative_to(ROOT).as_posix()]=s.sha(load(path))
 return dict(sorted(pins.items()))
def private_write(path,raw):
 PRIVATE.mkdir(parents=True,exist_ok=True);guard=b.security()
 with guard.create(path)as stream:guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
def private_json(path):b.security().verify(path);return json.loads(load(path))
def query(sql,label):
 need((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 reader=b.module('attempt36_bounded_cli',ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py')
 path=PRIVATE/(label+'-'+str(uuid.uuid4())+'.sql');private_write(path,sql.encode('utf8'))
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(path),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,stderr=reader.bounded(command,reader.environment())
 if code!=0 or timeout or overflow:
  safe='SQL_TIMEOUT'if timeout else'CLI_OUTPUT_LIMIT'if overflow else'CLI_SQL_UNCONFIRMED'
  for known in sorted(SAFE_ERRORS):
   if known in stderr:safe=known;break
  raise DispatchUnconfirmed(safe)
 payload=json.loads(stdout);rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1 and set(rows[0])=={'attempt36_release'});return rows[0]['attempt36_release']
def read_state(phase='before'):
 return query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';"+s.state_sql(phase)+" as attempt36_release;rollback;",'read-'+phase)
def save(action,value):
 value={**value,'action':action,'target':TARGET,'version':VERSION,'cloud_called':True,'cloud_business_writes':False,'provider_called':False}
 directory=ROOT/'tracking/evidence/m07/job-attempt-observability36-release';directory.mkdir(parents=True,exist_ok=True)
 import datetime
 path=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True,indent=2)+'\n')
 return path.relative_to(ROOT).as_posix()
def _before(value,accepted):s.check_before(value,expected_ports=accepted['claim_ports'])
def render(before,accepted,marker):
 _before(before,accepted);need(str(uuid.UUID(marker))==marker)
 tables=','.join(name if name.startswith('public.')else'eps.'+name for name in b.TABLES)
 post=s.postcondition_sql(before,accepted['schema_template'],migration_version=VERSION)
 return "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';lock table supabase_migrations.schema_migrations in share row exclusive mode;lock table "+tables+" in share mode;\n"+b.old.assertion(s.state_sql('before'),before,'ATTEMPT36_PREFLIGHT_CHANGED')+SOURCE.decode('utf8')+"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values('"+VERSION+"',array[]::text[],'m07_job_attempt_observability');\ndo $attempt36_post$begin if("+post+")is not true then raise exception 'ATTEMPT36_POSTCONDITION_FAILED';end if;end$attempt36_post$;commit;select jsonb_build_object('version','"+VERSION+"','marker','"+marker+"','migration_sha256','"+MIGRATION_SHA+"')as attempt36_release;"
def _installed(value,accepted,enabled='O'):
 need(value['database']==value['operator']==value['session_user']=='postgres'and value['cli_role_safe']is True)
 need(value['history']==b.HISTORY+[b.VERSION,VERSION]and value['summary']==b.SUMMARY)
 need(value['protected_m02']==b.old.PROTECTED_M02 and value['protected_m02_integrity']is True and value['english']=={'flags':['1.0'],'security':True})
 need(value['claim_ports']==accepted['claim_ports']and value['owner_no_public_create']is True and value['review_owner_safe']is True)
 need(set(value['data'])==set(b.TABLES)and value['eps_tables']==sorted(b.EPS_TABLES+['job_stage_attempts']))
 g.check_schema_after(value['schema'],trigger_enabled=enabled)
def verify_readback(current,before,accepted,enabled='O',disabled=False):
 _installed(current,accepted,enabled)
 if disabled:
  expected=s.static_schema(current);expected['schema']=copy.deepcopy(before['schema']);need(expected==s.static_schema(before))
 else:
  expected=copy.deepcopy(current)
  for field in ['history','eps_tables','schema','delta_metadata']:expected[field]=copy.deepcopy(before[field])
  need(s.static_schema(expected)==s.static_schema(before))
 return s.static_schema(current)
def render_disable(before,accepted,marker):
 _installed(before,accepted);need(str(uuid.UUID(marker))==marker)
 tables=','.join([*(name if name.startswith('public.')else'eps.'+name for name in b.TABLES),'eps.job_stage_attempts'])
 predicate=s.disable_postcondition_sql(before,accepted['schema_template'])
 return "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';lock table supabase_migrations.schema_migrations in share row exclusive mode;lock table "+tables+" in share mode;\n"+b.old.assertion(s.state_sql('after'),before,'ATTEMPT36_DISABLE_PREFLIGHT_CHANGED')+"alter table eps.jobs disable trigger capture_job_stage_attempt;do $attempt36_disable$begin if("+predicate+")is not true then raise exception 'ATTEMPT36_DISABLE_POSTCONDITION_FAILED';end if;end$attempt36_disable$;commit;select jsonb_build_object('version','"+VERSION+"','marker','"+marker+"','only_capture_trigger_disabled',true)as attempt36_release;"
def apply_plan(plan,pins,accepted):
 need(APPLY_ENABLED and not CLAIM.exists()and plan['source_pins']==pins and plan['admission']==accepted and plan['target']==TARGET)
 before=plan['before'];_before(before,accepted);need(read_state()==before);marker=str(uuid.uuid4())
 private_write(CLAIM,(json.dumps({'marker':marker,'source_pins':pins,'before':before,'admission':accepted,'dispatch_may_have_occurred':True,'automatic_retry':False},sort_keys=True)+'\n').encode())
 result={'result':'unconfirmed','normal_return_marker_observed':False,'independent_readback_verified':False,'claim_retained':True,'before':before,'source_pins':pins,'admission':accepted}
 try:
  result['last_stage']='claimed_revalidation';need(sources()==pins and admission()==accepted and read_state()==before)
  result['last_stage']='migration_dispatch'
  returned=query(render(before,accepted,marker),'apply');need(returned=={'version':VERSION,'marker':marker,'migration_sha256':MIGRATION_SHA});result['normal_return_marker_observed']=True
 except Exception as error:result['safe_error_code']=safe_failure(error)
 try:
  first,second=read_state('after'),read_state('after');need(first==second);s.check_transition(before,first,migration_version=VERSION)
  result.update(first=first,second=second,static_schema_before=s.static_schema(before),static_schema_after=s.static_schema(first),independent_readback_verified=True)
 except Exception as error:result['readback_error_code']=safe_failure(error)
 if result['normal_return_marker_observed']and result['independent_readback_verified']:result['result']='passed'
 return result
def main():
 need(len(sys.argv)==2 and sys.argv[1]in('inspect','apply','readback','disable-capture','readback-disable'))
 action=sys.argv[1];accepted=admission();pins=sources()
 if action=='inspect':
  need(APPLY_ENABLED and not PLAN.exists()and not CLAIM.exists());first,second=read_state(),read_state();need(first==second);_before(first,accepted)
  plan={'schema_version':'1.0','target':TARGET,'version':VERSION,'before':first,'source_pins':pins,'admission':accepted}
  private_write(PLAN,(json.dumps(plan,sort_keys=True)+'\n').encode());output=save('inspect',{'result':'prepared','plan_created':True,**plan})
 elif action=='apply':
  output=save('apply',apply_plan(private_json(PLAN),pins,accepted))
 elif action=='readback':
  claim=private_json(CLAIM);need(claim['source_pins']==pins and claim['admission']==accepted)
  first,second=read_state('after'),read_state('after');need(s.static_schema(first)==s.static_schema(second));_installed(first,accepted)
  # Business and claim rows may legitimately move after the atomic apply. This
  # records current static installation, not an invented original normal return.
  verify_readback(first,claim['before'],accepted)
  output=save('readback',{'result':'observed_applied','original_dispatch_normal_return_not_inferred':True,'claim_retained':True,'static_schema_after':s.static_schema(first),'source_pins':pins,'admission':accepted})
 elif action=='readback-disable':
  claim=private_json(DISABLE_CLAIM);need(claim['source_pins']==pins and claim['admission']==accepted)
  first,second=read_state('disabled'),read_state('disabled');need(s.static_schema(first)==s.static_schema(second));_installed(first,accepted,enabled='D')
  verify_readback(first,claim['before'],accepted,enabled='D',disabled=True)
  output=save('readback-disable',{'result':'observed_capture_disabled','original_dispatch_normal_return_not_inferred':True,'claim_retained':True,'static_schema_after':s.static_schema(first),'source_pins':pins,'admission':accepted})
 else:
  need(RECOVERY_ENABLED and not DISABLE_CLAIM.exists());before=read_state('after');_installed(before,accepted);need(read_state('after')==before);marker=str(uuid.uuid4())
  private_write(DISABLE_CLAIM,(json.dumps({'source_pins':pins,'admission':accepted,'before':before,'marker':marker,'dispatch_may_have_occurred':True,'automatic_retry':False},sort_keys=True)+'\n').encode())
  result={'result':'unconfirmed','claim_retained':True,'normal_return_marker_observed':False,'source_pins':pins,'admission':accepted}
  try:
   need(sources()==pins and admission()==accepted and read_state('after')==before)
   need(query(render_disable(before,accepted,marker),'disable-capture')=={'version':VERSION,'marker':marker,'only_capture_trigger_disabled':True});result['normal_return_marker_observed']=True
  except Exception as error:result['safe_error_code']=safe_failure(error)
  try:
   first,second=read_state('disabled'),read_state('disabled');need(first==second);s.check_disable_transition(before,first)
   result.update(static_schema_after=s.static_schema(first),independent_readback_verified=True)
  except Exception as error:result['readback_error_code']=safe_failure(error)
  if result['normal_return_marker_observed']and result.get('independent_readback_verified')is True:result['result']='passed_capture_disabled'
  output=save('disable-capture',result)
 print(json.dumps({'result':'receipt_saved','receipt':output,'target':TARGET,'version':VERSION}))
if __name__=='__main__':
 try:main()
 except Exception as error:print(json.dumps({'result':'unconfirmed','safe_error_code':safe_failure(error)}),file=sys.stderr);sys.exit(1)
