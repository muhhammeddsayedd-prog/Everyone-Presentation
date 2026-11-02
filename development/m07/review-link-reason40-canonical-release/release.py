"""NEW normal-CLI SQL40 purpose. Every live entry is disabled for source review."""
from pathlib import Path
import datetime,importlib.util,json,os,sys,uuid

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('reason40_canonical_state',HERE/'state.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
READ_ENABLED=False
APPLY_ENABLED=False
PURPOSE='review-link-reason40-canonical-release'

def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def encoded(value):return(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
def rows(stdout):
 payload=json.loads(stdout);value=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 s.need(type(value)is list and len(value)==1 and type(value[0])is dict and set(value[0])=={'reason40_release'});return value[0]['reason40_release']

class Release:
 def __init__(self,run,context=None):
  s.need(str(uuid.UUID(run))==run);self.c=context or s.Context();self.run=run
  self.private=self.c.root/('.local/'+PURPOSE)/run
  self.plan=self.private/'plan.json';self.claim=self.private/'apply.claim.json';self.returned=self.private/'normal-return.json';self.prepared=self.private/'prepare.claim.json'
 def write(self,path,value):
  s.need(path.parent==self.private and not path.exists());self.private.mkdir(parents=True,exist_ok=True);raw=value if type(value)is bytes else encoded(value);s.need(0<len(raw)<=s.MAXIMUM)
  guard=self.c.b.security()
  with guard.create(path)as stream:guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
  guard.verify(path);s.need(s.load(path)==raw)
 def read(self,path):self.c.b.security().verify(path);return json.loads(s.load(path))
 def admission(self):
  value=self.c.admission();reference=self.read(self.private/'query-validation.json')
  s.need(type(reference)is dict and set(reference)=={'path','sha256'})
  relative=Path(reference['path']);s.need(not relative.is_absolute()and'..'not in relative.parts and relative.parts[:4]==('tracking','evidence','m07','reason40-collector-validation'))
  raw=s.load(self.c.source/relative);s.need(s.sha(raw)==reference['sha256']);proof=json.loads(raw)
  s.need(proof['result']=='passed'and proof['all_owned_resources_absent']is True and proof['original_data_catalogue_and_global_roles_unchanged']is True and proof['shared_lock_released']is True and proof['cloud_called']is False and proof['provider_called']is False)
  validation=proof['collector_validation'];s.need(validation['result']=='passed'and all(validation[key]is True for key in('actual_state_checkpoint_and_rendered_transaction','all76_old_column_rows_and_catalogue_preserved','full_role_membership_function_identity_and_dependency_preimages_preserved','actual_negative_preimage_refused_and_rolled_back','normal_commit_nonce_observed','two_equal_before_reads','two_equal_after_reads','before_and_after_full76_checkpoints_checked','only_database_system_run_admission_changed'))and validation['canonical_identity_admission_claimed']is False)
  for name in('state.py','local.py','local-cases.mjs','local-compiler.py'):
   relative_name=(HERE/name).relative_to(self.c.source).as_posix();s.need(proof['source_seals'][relative_name]==s.sha(s.load(HERE/name)))
  s.need(proof['source_seals'][s.MIGRATION]==s.MIGRATION_SHA);value['collector_validation']=reference;return value
 def query(self,sql,label):
  s.need(READ_ENABLED and label in('prepare','inspect','apply','readback','checkpoint'))
  s.need((self.c.root/'supabase/.temp/project-ref').read_text().strip()==s.TARGET)
  s.need(not any(os.environ.get(key)for key in('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD')))
  reader=s.module('reason40_existing_normal_bounded_reader',self.c.root/'development/m07/oauth-attempt-trace/inspect-attempt.py')
  capture=s.module('reason40_existing_checkpoint_capture',self.c.root/'development/m07/completion-worker-rollout39/capture.py')
  path=self.private/(label+'-'+str(uuid.uuid4())+'.sql');self.write(path,sql.encode())
  command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',s.TARGET,'--file',str(path),'--output-format','json','--workdir',str(self.c.root)]
  code,timed_out,overflow,stdout,_=capture.bounded_checkpoint(command,reader.environment(),cwd=self.c.root,timeout=60)
  s.need(code==0 and not timed_out and not overflow);return rows(stdout)
 def snapshot(self):
  return self.query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='60s';"+self.c.state_sql()+"as reason40_release;rollback;",'readback')
 def checkpoint(self,phase,expected,installed):
  s.need(phase in('before_apply','after_apply'))
  sql="begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='60s';"+self.c.checkpoint_sql()+"as reason40_release;rollback;"
  payload=self.query(sql,'checkpoint');self.c.checkpoint_check(payload,installed);s.need(payload['state']==expected)
  document={'schema_version':'1.0','purpose':PURPOSE,'target':s.TARGET,'run':self.run,'phase':phase,'observed_at':now(),**payload}
  path=self.private/('before-checkpoint.json'if phase=='before_apply'else'after-checkpoint.json');self.write(path,document)
  return {'path':path.relative_to(self.c.root).as_posix(),'sha256':s.sha(s.load(path)),'history_path':['state','history'],'tables':76,'scope':phase,'restore_verified':False}
 def checkpoint_read(self,reference):
  relative=Path(reference['path']);s.need(relative==self.private.relative_to(self.c.root)/('before-checkpoint.json'if reference['scope']=='before_apply'else'after-checkpoint.json'))
  path=self.c.root/relative;self.c.b.security().verify(path);raw=s.load(path);s.need(s.sha(raw)==reference['sha256']);return json.loads(raw)
 def compare_checkpoints(self,before,after):
  old=self.checkpoint_read(before);new=self.checkpoint_read(after)
  s.need(old['state']==self.read(self.plan)['before']);self.c.transition(old['state'],new['state'])
  for table in self.c.tables:
   left=old['application_tables'][table];right=new['application_tables'][table]
   if table=='audit_events':
    s.need(all(row.get('reason')is None and'reason'in row for row in right));right=[{key:value for key,value in row.items()if key!='reason'}for row in right]
   s.need(sorted(map(encoded,left))==sorted(map(encoded,right)))
  expected=dict(old['catalogue'])
  for name,value in self.c.new.items():expected[f'functions|{name}|source_sha256']=value
  expected.update({'columns|eps.audit_events.reason|type':'text','columns|eps.audit_events.reason|not_null':False,'columns|eps.audit_events.reason|acl':None,'columns|eps.audit_events.reason|identity':'','columns|eps.audit_events.reason|generated':'','columns|eps.audit_events.reason|default':None})
  s.need(new['catalogue']==expected)
  return True
 def prepare(self):
  s.need(READ_ENABLED and not self.prepared.exists()and not self.plan.exists()and not self.claim.exists());pins=self.c.source_pins();admission=self.admission()
  self.write(self.prepared,{'purpose':PURPOSE,'run':self.run,'source_pins':pins,'admission':admission,'read_dispatch_may_have_occurred':True,'automatic_retry':False})
  first,second=self.snapshot(),self.snapshot();s.need(first==second);self.c.check(first,False)
  checkpoint=self.checkpoint('before_apply',first,False);s.need(self.c.source_pins()==pins and self.admission()==admission)
  value={'purpose':PURPOSE,'run':self.run,'target':s.TARGET,'version':s.VERSION,'source_pins':pins,'admission':admission,'before':first,'before_checkpoint':checkpoint};self.write(self.plan,value)
  return {'result':'prepared','run':self.run,'source_pins':pins,'admission':admission,'before_history':first['history'],'before_checkpoint':checkpoint,'migration_dispatched':False}
 def apply(self):
  s.need(READ_ENABLED and APPLY_ENABLED and not self.claim.exists());plan=self.read(self.plan);pins=self.c.source_pins();admission=self.admission()
  s.need(plan['purpose']==PURPOSE and plan['run']==self.run and plan['target']==s.TARGET and plan['version']==s.VERSION and plan['source_pins']==pins and plan['admission']==admission)
  before=plan['before'];self.c.check(before,False);s.need(self.snapshot()==before);self.checkpoint_read(plan['before_checkpoint'])
  marker=str(uuid.uuid4());self.write(self.claim,{**plan,'marker':marker,'dispatch_may_have_occurred':True,'automatic_retry':False})
  result={'result':'unconfirmed','run':self.run,'normal_return_marker_observed':False,'two_independent_readbacks_equal':False,'claim_retained':True,'source_pins':pins,'admission':admission,'local_proof':admission['local_proof'],'before_checkpoint':plan['before_checkpoint'],'refresh_or_apply_replayed':False}
  try:
   s.need(self.c.source_pins()==pins and self.admission()==admission and self.snapshot()==before)
   returned=self.query(self.c.render(before,marker),'apply');s.need(returned=={'version':s.VERSION,'marker':marker,'migration_sha256':s.MIGRATION_SHA})
   self.write(self.returned,{'claim_sha256':s.sha(s.load(self.claim)),'marker':marker,'normal_return_marker_observed':True});result['normal_return_marker_observed']=True
  except Exception:result['dispatch_error_code']='REASON40_DISPATCH_UNCONFIRMED'
  try:
   first,second=self.snapshot(),self.snapshot();s.need(first==second and self.c.source_pins()==pins);preservation=self.c.transition(before,first)
   checkpoint=self.checkpoint('after_apply',first,True);self.compare_checkpoints(plan['before_checkpoint'],checkpoint)
   s.need(self.c.source_pins()==pins and self.admission()==admission)
   result.update(first=first,second=second,preservation=preservation,checkpoint=checkpoint,two_independent_readbacks_equal=True)
  except Exception:result['readback_error_code']='REASON40_READBACK_OR_CHECKPOINT_UNCONFIRMED'
  if result['normal_return_marker_observed']and result['two_independent_readbacks_equal']:result['result']='passed'
  return result
 def reconcile(self):
  s.need(READ_ENABLED);claim=self.read(self.claim);s.need(claim['source_pins']==self.c.source_pins()and claim['admission']==self.admission())
  first,second=self.snapshot(),self.snapshot();s.need(first==second);preservation=self.c.transition(claim['before'],first)
  # Reconciliation never dispatches SQL40, creates normal-return, or repairs an
  # unknown outcome. A new checkpoint filename cannot silently replace one.
  checkpoint=self.private/'after-checkpoint.json';reference=None
  if checkpoint.exists():
   reference={'path':checkpoint.relative_to(self.c.root).as_posix(),'sha256':s.sha(s.load(checkpoint)),'history_path':['state','history'],'tables':76,'scope':'after_apply','restore_verified':False}
   s.need(self.checkpoint_read(reference)['state']==first);self.compare_checkpoints(claim['before_checkpoint'],reference)
  normal=self.returned.exists()and self.read(self.returned)=={'claim_sha256':s.sha(s.load(self.claim)),'marker':claim['marker'],'normal_return_marker_observed':True}
  s.need(claim['source_pins']==self.c.source_pins()and claim['admission']==self.admission())
  return {'result':'passed'if normal and reference else'observed_applied','run':self.run,'normal_return_marker_observed':normal,'normal_return_not_inferred':True,'claim_retained':True,'two_independent_readbacks_equal':True,'local_proof':claim['admission']['local_proof'],'before_checkpoint':claim['before_checkpoint'],'checkpoint':reference,'preservation':preservation,'first':first,'second':second,'source_pins':claim['source_pins'],'admission':claim['admission']}

def save(action,value,root):
 directory=root/'tracking/evidence/m07'/PURPOSE;directory.mkdir(parents=True,exist_ok=True)
 path=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 document={'schema_version':'1.0','purpose':PURPOSE,'observed_at':now(),'action':action,'target':s.TARGET,'version':s.VERSION,'migration_sha256':s.MIGRATION_SHA,'raw_payloads_logged':False,'private_checkpoint_is_restore_proof':False,**value}
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(document,sort_keys=True,indent=2)+'\n')
 return path.relative_to(root).as_posix()
def main():
 s.need(len(sys.argv)==3 and sys.argv[1]in('prepare','apply','reconcile'))
 # Refuse before Context, private directory creation, claims, or provider calls.
 s.need(READ_ENABLED and(sys.argv[1]!='apply'or APPLY_ENABLED))
 operator=Release(sys.argv[2]);value=getattr(operator,sys.argv[1])();print(json.dumps({'result':value['result'],'receipt':save(sys.argv[1],value,operator.c.source)}))
 if value['result']not in('passed','prepared'):sys.exit(1)
if __name__=='__main__':
 try:main()
 except Exception:print(json.dumps({'result':'unconfirmed','safe_error_code':'REASON40_CANONICAL_UNCONFIRMED'}),file=sys.stderr);sys.exit(1)
