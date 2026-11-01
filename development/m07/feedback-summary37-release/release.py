"""Disabled one-claim canonical37 operator. Imports/tests never call the CLI."""
from pathlib import Path
import datetime, importlib.util, json, os, re, sys, uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
APPLY_ENABLED=True
PRIVATE=ROOT/'.local/m07-feedback-summary37-release';PLAN=PRIVATE/'plan.json';CLAIM=PRIVATE/'apply.claim.json'
ADMISSION=HERE/'admission.json'
spec=importlib.util.spec_from_file_location('feedback37_release_state',HERE/'state.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
b=s.b;TARGET=s.TARGET;VERSION=s.VERSION;MIGRATION_SHA=s.MIGRATION_SHA
SAFE_ERRORS={'M07_FEEDBACK_EXACT36_REQUIRED','M07_FEEDBACK_EXACT_GUEST_PORT_REQUIRED','M07_FEEDBACK_GUEST_METADATA_CHANGED','FEEDBACK37_PREFLIGHT_CHANGED','FEEDBACK37_POSTCONDITION_FAILED'}
PUBLIC_CODES=SAFE_ERRORS|{'SQL_TIMEOUT','CLI_OUTPUT_LIMIT','CLI_SQL_UNCONFIRMED','FEEDBACK37_STATE_UNCONFIRMED','FEEDBACK37_RELEASE_UNCONFIRMED'}

def need(value):
 if not value:raise ValueError('FEEDBACK37_RELEASE_UNCONFIRMED')
def safe_failure(error):return str(error)if str(error)in PUBLIC_CODES else'FEEDBACK37_RELEASE_UNCONFIRMED'
class DispatchUnconfirmed(Exception):pass

def admission():
 raw=s.load(ADMISSION);v=json.loads(raw)
 expected={'schema_version':'1.0','target':TARGET,'version':VERSION,'local_proof':{'path':s.PROOF,'sha256':s.PROOF_SHA},'canonical36_readback':{'path':s.BASELINE,'sha256':s.BASELINE_SHA}}
 need(v==expected);s.sources();return {**v,'admission_sha256':s.sha(raw),'actual_local37_sql_and_cleanup_passed':True}

def sources():
 pins=s.sources()
 for path in [Path(__file__),HERE/'test_release.py',HERE/'README.md',HERE/'admission.template.json']+([ADMISSION]if ADMISSION.exists()else[]):pins[path.relative_to(ROOT).as_posix()]=s.sha(s.load(path))
 return dict(sorted(pins.items()))

def private_write(path,raw):
 PRIVATE.mkdir(parents=True,exist_ok=True);guard=b.security()
 with guard.create(path)as stream:guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
def private_json(path):b.security().verify(path);return json.loads(s.load(path))

def query(sql,label):
 need(label in('read','read-static','apply'))
 need((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 # Only the frozen reader/environment and normal existing CLI login are reused.
 # No old release main/apply function or credential-store API is called.
 reader=b.module('feedback37_bounded_cli',ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py')
 need(not any(os.environ.get(key)for key in('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD')))
 path=PRIVATE/(label+'-'+str(uuid.uuid4())+'.sql');private_write(path,sql.encode('utf8'))
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(path),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,stderr=reader.bounded(command,reader.environment())
 if code!=0 or timeout or overflow:
  safe='SQL_TIMEOUT'if timeout else'CLI_OUTPUT_LIMIT'if overflow else'CLI_SQL_UNCONFIRMED'
  for known in sorted(SAFE_ERRORS):
   if known in stderr:safe=known;break
  raise DispatchUnconfirmed(safe)
 payload=json.loads(stdout);rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1 and type(rows[0])is dict and set(rows[0])=={'feedback37_release'})
 return rows[0]['feedback37_release']

def read_state():
 return query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';"+s.state_sql()+" as feedback37_release;rollback;",'read')
def read_static_state():
 value=query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';"+s.static_schema_sql()+" as feedback37_release;rollback;",'read-static')
 return s.check_static(value)

def migration_body():
 text=s.SOURCE.decode('utf8');need(text.count('\nbegin;\n')==1 and text.endswith('commit;\n'))
 body=text.replace('\nbegin;\n','\n',1)[:-len('commit;\n')]
 need(body+'commit;\n'==text.replace('\nbegin;\n','\n',1));return body

def render(before,marker):
 s.check_before(before);need(type(marker)is str and str(uuid.UUID(marker))==marker)
 tables=','.join(name if name.startswith('public.')else'eps.'+name for name in sorted([*b.TABLES,'job_stage_attempts']))
 return "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';lock table supabase_migrations.schema_migrations in share row exclusive mode;lock table "+tables+" in share mode;\n"+b.old.assertion(s.state_sql(),before,'FEEDBACK37_PREFLIGHT_CHANGED')+migration_body()+"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values('"+VERSION+"',array[]::text[],'m07_feedback_summary');\n"+b.old.assertion(s.state_sql(),s.expected_after(before),'FEEDBACK37_POSTCONDITION_FAILED')+"commit;select jsonb_build_object('version','"+VERSION+"','marker','"+marker+"','migration_sha256','"+MIGRATION_SHA+"')as feedback37_release;"

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
 value={**value,'action':action,'target':TARGET,'version':VERSION,'migration_sha256':MIGRATION_SHA,'cloud_called':True,'cloud_business_writes':False,'provider_called':False}
 directory=ROOT/'tracking/evidence/m07/feedback-summary37-release';directory.mkdir(parents=True,exist_ok=True)
 path=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True,indent=2)+'\n')
 return path.relative_to(ROOT).as_posix()

def main():
 need(len(sys.argv)==2 and sys.argv[1]in('inspect','apply','readback'))
 # Even inspection requires root to finalize the flag and admission first, so
 # their bytes never change between preparation, claim and readback.
 need(APPLY_ENABLED);action=sys.argv[1];accepted=admission();pins=sources()
 if action=='inspect':
  need(not PLAN.exists()and not CLAIM.exists());first,second=read_state(),read_state();need(first==second);s.check_before(first)
  plan={'schema_version':'1.0','plan_id':str(uuid.uuid4()),'target':TARGET,'version':VERSION,'before':first,'source_pins':pins,'admission':accepted}
  private_write(PLAN,(json.dumps(plan,sort_keys=True)+'\n').encode());output=save('inspect',{'result':'prepared','plan_created':True,**plan})
 elif action=='apply':output=save('apply',apply_plan(private_json(PLAN),pins,accepted))
 else:
  claim=private_json(CLAIM);need(claim['source_pins']==pins and claim['admission']==accepted)
  first,second=read_static_state(),read_static_state();need(first==second)
  prior=s.static_schema(claim['before']);prior['history']+=[VERSION];prior['feedback37']['functions']=s.FUNCTIONS;prior['feedback37']['name_counts']={'feedback_summary':1,'eps_get_feedback_summary':1};prior['feedback37']['guest']['body_sha256']=s.NEW_GUEST_SHA
  need(first==prior)
  output=save('readback',{'result':'observed_applied','original_dispatch_normal_return_not_inferred':True,'claim_retained':True,'static_schema_after':first,'source_pins':pins,'admission':accepted})
 print(json.dumps({'result':'receipt_saved','receipt':output,'target':TARGET,'version':VERSION}))

if __name__=='__main__':
 try:main()
 except Exception as error:print(json.dumps({'result':'unconfirmed','safe_error_code':safe_failure(error)}),file=sys.stderr);sys.exit(1)
