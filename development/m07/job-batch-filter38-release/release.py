"""Disabled once-claim38 operator. Imports/tests never invoke CLI or read auth."""
from pathlib import Path
import datetime,importlib.util,json,os,sys,uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
APPLY_ENABLED=True
PRIVATE=ROOT/'.local/m07-job-batch-filter38-release';PLAN=PRIVATE/'plan.json';CLAIM=PRIVATE/'apply.claim.json'
ADMISSION=HERE/'admission.json'
spec=importlib.util.spec_from_file_location('batch38_release_state',HERE/'state.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
b=s.b;TARGET=s.TARGET;VERSION=s.VERSION;MIGRATION_SHA=s.MIGRATION_SHA
SAFE_ERRORS={'BATCH38_EXACT_CANONICAL37_REQUIRED','BATCH38_CURRENT_OLD_PORT_REQUIRED','JOB_BATCH_FILTER_BOUNDARY_CHANGED','BATCH38_PREFLIGHT_CHANGED','BATCH38_POSTCONDITION_FAILED'}
PUBLIC_CODES=SAFE_ERRORS|{'SQL_TIMEOUT','CLI_OUTPUT_LIMIT','CLI_SQL_UNCONFIRMED','BATCH38_STATE_UNCONFIRMED','BATCH38_RELEASE_UNCONFIRMED'}

def need(v):
 if not v:raise ValueError('BATCH38_RELEASE_UNCONFIRMED')

def safe_failure(error):return str(error)if str(error)in PUBLIC_CODES else'BATCH38_RELEASE_UNCONFIRMED'
class DispatchUnconfirmed(Exception):pass

def admission():
 raw=s.load(ADMISSION);v=json.loads(raw);expected=json.loads(s.load(HERE/'admission.template.json'));need(v==expected)
 need(v['target']==TARGET and v['version']==VERSION and v['canonical_migration']==s.MIGRATION and v['proved_functional_body_sha256']==s.builder.NEW_BODY_SHA)
 need(v['local_proof']=={'path':s.PROOF,'sha256':s.PROOF_SHA}and v['canonical37_readback']=={'path':s.BASELINE,'sha256':s.BASELINE_SHA})
 s.native_admission_sources();return{**v,'admission_sha256':s.sha(raw),'actual205_job_SQL_and_cleanup_passed':True}

def sources():
 pins=s.native_admission_sources()
 for p in [Path(__file__),HERE/'test_release.py',HERE/'README.md',HERE/'admission.template.json']+([ADMISSION]if ADMISSION.exists()else[]):pins[p.relative_to(ROOT).as_posix()]=s.sha(s.load(p))
 return dict(sorted(pins.items()))

def projection_sources():
 pins=s.projection_sources();pins[Path(__file__).relative_to(ROOT).as_posix()]=s.sha(s.load(Path(__file__)));return dict(sorted(pins.items()))

def private_write(path,raw):
 PRIVATE.mkdir(parents=True,exist_ok=True);guard=b.security()
 with guard.create(path)as stream:guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)

def private_json(path):b.security().verify(path);return json.loads(s.load(path))

def query(sql,label):
 need(label in('read','read-static','apply'));need((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 reader=b.module('batch38_bounded_normal_cli',ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py')
 need(not any(os.environ.get(k)for k in('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD')))
 path=PRIVATE/(label+'-'+str(uuid.uuid4())+'.sql');private_write(path,sql.encode('utf8'))
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(path),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,stderr=reader.bounded(command,reader.environment())
 if code!=0 or timeout or overflow:
  safe='SQL_TIMEOUT'if timeout else'CLI_OUTPUT_LIMIT'if overflow else'CLI_SQL_UNCONFIRMED'
  for known in sorted(SAFE_ERRORS):
   if known in stderr:safe=known;break
  raise DispatchUnconfirmed(safe)
 payload=json.loads(stdout);rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1 and type(rows[0])is dict and set(rows[0])=={'batch38_release'});return rows[0]['batch38_release']

def read_state():return query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';"+s.state_sql()+" as batch38_release;rollback;",'read')

def read_static_state():
 projection_sources()
 value=query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';"+s.static_schema_sql()+" as batch38_release;rollback;",'read-static')
 return s.check_static(value)

def migration_body():
 need(s.load(ROOT/s.MIGRATION)==s.SOURCE);text=s.SOURCE.decode();need(text.count('\nbegin;\n')==1 and text.endswith('commit;\n'))
 body=text.replace('\nbegin;\n','\n',1)[:-len('commit;\n')];need(body+'commit;\n'==text.replace('\nbegin;\n','\n',1));return body

def render(before,marker):
 s.check_before(before);need(type(marker)is str and str(uuid.UUID(marker))==marker)
 tables=','.join(name if name.startswith('public.')else'eps.'+name for name in sorted([*b.TABLES,'job_stage_attempts']))
 return "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';lock table supabase_migrations.schema_migrations in share row exclusive mode;lock table "+tables+" in share mode;\n"+b.old.assertion(s.state_sql(),before,'BATCH38_PREFLIGHT_CHANGED')+migration_body()+"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values('"+VERSION+"',array[]::text[],'m07_job_batch_filter');\n"+b.old.assertion(s.state_sql(),s.expected_after(before),'BATCH38_POSTCONDITION_FAILED')+"commit;select jsonb_build_object('version','"+VERSION+"','marker','"+marker+"','migration_sha256','"+MIGRATION_SHA+"')as batch38_release;"

def apply_plan(plan,pins,accepted):
 need(APPLY_ENABLED and not CLAIM.exists()and plan['source_pins']==pins and plan['admission']==accepted and plan['target']==TARGET and plan['version']==VERSION)
 need(type(plan['plan_id'])is str and str(uuid.UUID(plan['plan_id']))==plan['plan_id'])
 before=plan['before'];s.check_before(before);need(read_state()==before);marker=str(uuid.uuid4())
 private_write(CLAIM,(json.dumps({'plan_id':plan['plan_id'],'marker':marker,'source_pins':pins,'before':before,'admission':accepted,'dispatch_may_have_occurred':True,'automatic_retry':False},sort_keys=True)+'\n').encode())
 result={'result':'unconfirmed','normal_return_marker_observed':False,'independent_readback_verified':False,'claim_retained':True,'before':before,'source_pins':pins,'admission':accepted}
 try:
  result['last_stage']='claimed_revalidation';need(sources()==pins and admission()==accepted and read_state()==before)
  result['last_stage']='migration_dispatch';returned=query(render(before,marker),'apply')
  need(returned=={'version':VERSION,'marker':marker,'migration_sha256':MIGRATION_SHA});result['normal_return_marker_observed']=True
 except Exception as error:result['safe_error_code']=safe_failure(error)
 try:
  first,second=read_state(),read_state();need(first==second);result['preservation']=s.check_transition(before,first)
  result.update(first=first,second=second,static_schema_before=s.static_schema(before),static_schema_after=s.static_schema(first),independent_readback_verified=True)
 except Exception as error:result['readback_error_code']=safe_failure(error)
 if result['normal_return_marker_observed']and result['independent_readback_verified']:result['result']='passed'
 return result

def save(action,value):
 value={**value,'action':action,'target':TARGET,'version':VERSION,'migration_sha256':MIGRATION_SHA,'cloud_called':True,'provider_called':False,'cloud_business_writes':False}
 destination=ROOT/'tracking/evidence/m07/job-batch-filter38-release';destination.mkdir(parents=True,exist_ok=True)
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')
 with(destination/(stamp+'-'+action+'.json')).open('x',encoding='utf8',newline='\n')as stream:json.dump(value,stream,sort_keys=True,indent=2);stream.write('\n')
 return value

def main():
 need(APPLY_ENABLED and len(sys.argv)==2 and sys.argv[1]in('inspect','apply','readback'))
 action=sys.argv[1]
 if action=='readback':
  pins=projection_sources();first,second=read_static_state(),read_static_state();need(first==second)
  return save(action,{'result':'observed_applied','static_schema_after':first,'source_pins':pins,'two_static_reads_equal':True,'normal_return_not_inferred':True,'full_business_hashes_rechecked':False})
 accepted=admission();pins=sources()
 if action=='inspect':
  need(not PLAN.exists()and not CLAIM.exists());before=read_state();s.check_before(before)
  plan={'plan_id':str(uuid.uuid4()),'target':TARGET,'version':VERSION,'source_pins':pins,'admission':accepted,'before':before}
  private_write(PLAN,(json.dumps(plan,sort_keys=True)+'\n').encode());return save(action,{'result':'prepared','plan_id':plan['plan_id'],'before':before,'source_pins':pins,'admission':accepted,'migration_dispatched':False})
 return save(action,apply_plan(private_json(PLAN),pins,accepted))

if __name__=='__main__':
 try:print(json.dumps(main(),sort_keys=True))
 except Exception as error:print(json.dumps({'error':safe_failure(error)}));sys.exit(1)
