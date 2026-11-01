"""New project39 normal-CLI operator. Disabled until Root reviews and arms it."""
from pathlib import Path
import datetime, importlib.util, json, os, sys, uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
APPLY_ENABLED=True
GUARD='tracking/evidence/m07/project39-canonical-guard-validation/2026-11-01T23-42-04.415Z-cf89da06.json'
spec=importlib.util.spec_from_file_location('project39_release_state',HERE/'state.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)

class Release:
 def __init__(self,context=None):
  self.c=context or s.Context();self.private=self.c.root/'.local/m07-project39-canonical-release';self.plan=self.private/'plan.json';self.claim=self.private/'apply.claim.json';self.returned=self.private/'normal-return.json'
 def write(self,path,value):
  self.private.mkdir(parents=True,exist_ok=True);guard=self.c.b.security();raw=value if type(value)is bytes else(json.dumps(value,sort_keys=True)+'\n').encode()
  with guard.create(path)as stream:guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 def read(self,path):self.c.b.security().verify(path);return json.loads(s.load(path))
 def check_query_proof(self,proof):
  c=self.c;s.need(proof['result']=='passed'and proof['release39_guard_query_passed']is True and proof['sql_assertions']['assertions']==32 and proof['all_restore_and39_ddl_rolled_back']is True and proof['owned_database_absent']is True and proof['original_data_catalogue_and_global_roles_unchanged']is True and proof['shared_lock_released']is True and proof['source_seals'][s.MIGRATION]==c.migration_sha)
  s.need(proof['canonical_public_usage_preserved']is True and proof['canonical_acl_anchor']==c.canonical_acl_anchor)
  current=c.source_pins();required=set(c.s.projection_sources())|{s.MIGRATION,s.SEQUENTIAL,s.RACE,'development/m07/project-creation39-canonical-release/state.py','development/m07/project-creation39-canonical-release/catalogue.sql','development/m07/project-creation39-canonical-release/validate_local.py','development/m07/specs-diagnostic-worker38-adoption/state.py','development/m07/oauth-attempt-trace/inspect-attempt.py','tools/provision_logo_verifier.py'}
  s.need(all(proof['guard_source_pins'][key]==current[key]for key in required))
 def admission(self):
  c=self.c;ready=json.loads(s.load(c.root/s.READY));backup=json.loads(s.load(c.root/s.BACKUP))
  s.need(GUARD is not None)
  c.b.security().verify(c.root/s.PROJECTION);s.need(s.sha(s.load(c.root/s.PROJECTION))==s.PROJECTION_SHA and s.sha(s.load(c.root/s.DIAGNOSTIC))==s.DIAGNOSTIC_SHA)
  guard_raw=s.load(c.proof_root/GUARD);self.check_query_proof(json.loads(guard_raw))
  s.need(ready['result']=='passed'and ready['state']=='READY'and ready['alias_matches']is True and ready['id']=='dpl_8mFQY4SkHiHmSVo6hR8QPLSdgwaS'and ready['source_commit']=='e494371894d148e335fa5a8bc50b601ac80bd555')
  s.need(backup['result']=='passed'and backup['history_count']==38 and backup['tables']==75 and backup['raw_payloads_logged']is False)
  relative=Path(backup['protected_file']);s.need(not relative.is_absolute()and relative.parts[:2]==('.local','completion-release')and'..'not in relative.parts)
  path=c.root/relative;c.b.security().verify(path);raw=s.load(path);s.need(len(raw)==backup['bytes']and s.sha(raw)==backup['sha256'])
  return {'target':s.TARGET,'version':s.VERSION,'migration_sha256':c.migration_sha,'canonical_acl':c.canonical_acl_anchor,'sequential':{'path':s.SEQUENTIAL,'sha256':s.sha(s.load(c.proof_root/s.SEQUENTIAL))},'race':{'path':s.RACE,'sha256':s.sha(s.load(c.proof_root/s.RACE))},'local_query_validation':{'path':GUARD,'sha256':s.sha(guard_raw)},'compatible_web':{'path':s.READY,'sha256':s.sha(s.load(c.root/s.READY))},'private_backup':{'path':s.BACKUP,'sha256':s.sha(s.load(c.root/s.BACKUP)),'artifact_sha256':backup['sha256'],'restore_verified':False}}
 def query(self,sql,label):
  s.need(label in('inspect','readback','apply')and(self.c.root/'supabase/.temp/project-ref').read_text().strip()==s.TARGET)
  s.need(not any(os.environ.get(key)for key in('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD')))
  reader=s.module('project39_existing_bounded_cli',self.c.root/'development/m07/oauth-attempt-trace/inspect-attempt.py')
  file=self.private/(label+'-'+str(uuid.uuid4())+'.sql');self.write(file,sql.encode())
  args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',s.TARGET,'--file',str(file),'--output-format','json','--workdir',str(self.c.root)]
  code,timeout,overflow,stdout,_=reader.bounded(args,reader.environment());s.need(code==0 and not timeout and not overflow)
  payload=json.loads(stdout);rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
  s.need(type(rows)is list and len(rows)==1 and set(rows[0])=={'project39_release'});return rows[0]['project39_release']
 def read_state(self,installed=False):
  return self.query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';"+self.c.state_sql(installed)+" as project39_release;rollback;",'readback'if installed else'inspect')
 def body(self):
  text=self.c.source.decode().replace('\r\n','\n');s.need(text.count('\nbegin;\n')==1 and text.endswith('commit;\n'))
  return text.replace('\nbegin;\n','\n',1)[:-len('commit;\n')]
 def render(self,before,marker):
  c=self.c;c.check(before);s.need(str(uuid.UUID(marker))==marker)
  tables=sorted([name if name.startswith('public.')else'eps.'+name for name in c.b.TABLES]+['eps.job_stage_attempts'])
  prefix="begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='60s';lock table supabase_migrations.schema_migrations in share row exclusive mode;lock table "+','.join(tables)+" in share mode;\n"
  post="do $project39_after$declare observed jsonb;begin "+c.state_sql(True)+" into observed;if observed is distinct from "+c.b.old.json_sql(c.after(before))+" and observed is distinct from "+c.b.old.json_sql(c.after(before,False))+" then raise exception'PROJECT39_POSTCONDITION_FAILED';end if;end$project39_after$;\n"
  return prefix+c.b.old.assertion(c.state_sql(),before,'PROJECT39_PREFLIGHT_CHANGED')+self.body()+"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values('"+s.VERSION+"',array[]::text[],'m07_project_creation');\n"+post+"commit;select jsonb_build_object('version','"+s.VERSION+"','marker','"+marker+"','migration_sha256','"+c.migration_sha+"')as project39_release;"
 def inspect(self):
  s.need(not self.plan.exists()and not self.claim.exists());admission=self.admission();pins=self.c.source_pins();first,second=self.read_state(),self.read_state();s.need(first==second);self.c.check(first)
  plan={'plan_id':str(uuid.uuid4()),'target':s.TARGET,'version':s.VERSION,'source_pins':pins,'admission':admission,'before':first};self.write(self.plan,plan)
  return {'result':'prepared','plan_id':plan['plan_id'],'source_pins':pins,'admission':admission,'before':first,'migration_dispatched':False}
 def apply(self):
  s.need(APPLY_ENABLED and not self.claim.exists());plan=self.read(self.plan);pins=self.c.source_pins();admission=self.admission()
  s.need(plan['target']==s.TARGET and plan['version']==s.VERSION and plan['source_pins']==pins and plan['admission']==admission);before=plan['before'];self.c.check(before);s.need(self.read_state()==before)
  marker=str(uuid.uuid4());claim={**plan,'marker':marker,'dispatch_may_have_occurred':True,'automatic_retry':False};self.write(self.claim,claim)
  result={'result':'unconfirmed','normal_return_marker_observed':False,'two_independent_readbacks_equal':False,'claim_retained':True,'source_pins':pins,'admission':admission,'before':before}
  try:
   s.need(self.c.source_pins()==pins and self.admission()==admission and self.read_state()==before)
   returned=self.query(self.render(before,marker),'apply');s.need(returned=={'version':s.VERSION,'marker':marker,'migration_sha256':self.c.migration_sha})
   self.write(self.returned,{'claim_sha256':s.sha(s.load(self.claim)),'marker':marker,'normal_return_marker_observed':True});result['normal_return_marker_observed']=True
  except Exception:result['dispatch_error_code']='PROJECT39_DISPATCH_UNCONFIRMED'
  try:
   first,second=self.read_state(True),self.read_state(True);s.need(first==second and self.c.source_pins()==pins);result['preservation']=self.c.transition(before,first);result.update(first=first,second=second,two_independent_readbacks_equal=True)
  except Exception:result['readback_error_code']='PROJECT39_READBACK_UNCONFIRMED'
  if result['normal_return_marker_observed']and result['two_independent_readbacks_equal']:result['result']='passed'
  return result
 def reconcile(self):
  claim=self.read(self.claim);s.need(claim['source_pins']==self.c.source_pins()and claim['admission']==self.admission())
  first,second=self.read_state(True),self.read_state(True);s.need(first==second);preservation=self.c.transition(claim['before'],first)
  normal=False
  if self.returned.exists():normal=self.read(self.returned)=={'claim_sha256':s.sha(s.load(self.claim)),'marker':claim['marker'],'normal_return_marker_observed':True}
  return {'result':'passed'if normal else'observed_applied','claim_retained':True,'normal_return_marker_observed':normal,'normal_return_not_inferred':True,'two_independent_readbacks_equal':True,'preservation':preservation,'first':first,'second':second,'source_pins':claim['source_pins'],'admission':claim['admission']}

def save(action,value):
 directory=ROOT/'tracking/evidence/m07/project-creation39-canonical-release';directory.mkdir(parents=True,exist_ok=True)
 file=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps({'schema_version':'1.0','target':s.TARGET,'version':s.VERSION,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'action':action,'cloud_business_writes':False,'provider_called':False,'raw_cli_or_private_payloads_persisted':False,**value},sort_keys=True,indent=2)+'\n')
 return file.relative_to(ROOT).as_posix()
def main():
 s.need(len(sys.argv)==2 and sys.argv[1]in('inspect','apply','readback'));operator=Release();action=sys.argv[1]
 value=operator.inspect()if action=='inspect'else operator.apply()if action=='apply'else operator.reconcile()
 print(json.dumps({'result':value['result'],'receipt':save(action,value)}))
 if action=='apply'and value['result']!='passed':sys.exit(1)
if __name__=='__main__':
 try:main()
 except Exception:print(json.dumps({'result':'unconfirmed','safe_error_code':'PROJECT39_RELEASE_UNCONFIRMED'}),file=sys.stderr);sys.exit(1)
