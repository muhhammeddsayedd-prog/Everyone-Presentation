"""New disabled41 entry over inert sealed normal CLI mechanics, no old mains."""
from pathlib import Path
import ast,datetime,importlib.util,json,sys

HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
s=module('logo41_pure_context',HERE/'state.py')
READ_ENABLED=False
APPLY_ENABLED=False
PURPOSE='logo-info-canonical-release'
PARENT='development/m07/review-link-reason40-canonical-release/release.py'
PARENT_SHA='d36ec9b7365363c15056eaacb22a7c9157d6eaf6e5f7f36e3fc86f2b3774e047'

def projected_class():
 file=s.MAIN/PARENT;raw=s.load(file);s.need(s.sha(raw)==PARENT_SHA)
 old=module('logo41_frozen_normal_transport',file);source=raw.decode();tree=ast.parse(source)
 before=ast.get_source_segment(source,next(node for node in tree.body if isinstance(node,ast.ClassDef)and node.name=='Release'));text=before;edits=[]
 def edit(a,b,count=1):
  nonlocal text
  s.need(text.count(a)==count);text=text.replace(a,b);edits.append((a,b,count))
 # This remains the same normal CLI/bounds/environment path. Preserve apply
 # stdout immediately after bounded transport returns, before row projection.
 a="  s.need(code==0 and not timed_out and not overflow);return rows(stdout)"
 b="""  if label=='apply'and not timed_out and not overflow:
   data=stdout.encode('utf8')if type(stdout)is str else stdout
   self.write(self.private/'apply-response.json',data)
   self.write(self.private/'apply-response-binding.json',{'claim_sha256':s.sha(s.load(self.claim)),'response_sha256':s.sha(data),'exit_code':code})
  s.need(code==0 and not timed_out and not overflow);return rows(stdout)"""
 edit(a,b)
 edit('first,second=self.snapshot(),self.snapshot();s.need(first==second);self.c.check(first,False)','self.worker();first,second=self.snapshot(),self.snapshot();s.need(first==second);self.c.check(first,False)')
 edit("'admission':admission,'before':first", "'admission':admission,'worker':self.last_worker,'before':first")
 edit("'before_history':first['history']", "'before_history':first['history']['versions']")
 edit("s.need(self.c.source_pins()==pins and self.admission()==admission and self.snapshot()==before)\n   returned=", "self.worker();s.need(self.c.source_pins()==pins and self.admission()==admission and self.snapshot()==before)\n   returned=")
 a="{'claim_sha256':s.sha(s.load(self.claim)),'marker':marker,'normal_return_marker_observed':True}"
 edit(a,"{'claim_sha256':s.sha(s.load(self.claim)),'marker':marker,'normal_return_marker_observed':True,'response_sha256':self.response_binding()}")
 a="{'claim_sha256':s.sha(s.load(self.claim)),'marker':claim['marker'],'normal_return_marker_observed':True}"
 edit(a,"{'claim_sha256':s.sha(s.load(self.claim)),'marker':claim['marker'],'normal_return_marker_observed':True,'response_sha256':self.response_binding()}")
 # Inert method globals are independent; no assignment changes the old module.
 inverse=text
 for a,b,count in reversed(edits):s.need(inverse.count(b)==count);inverse=inverse.replace(b,a)
 s.need(inverse==before)
 namespace=dict(vars(old));namespace.update(s=s,PURPOSE=PURPOSE,READ_ENABLED=True,APPLY_ENABLED=True,__name__='logo41_inert_projected_methods')
 exec(compile(text,str(file),'exec'),namespace)
 return namespace['Release'],old,{'class_inverse_byte_equal':True,'finite_edits':len(edits),'parent_sha256':PARENT_SHA}

Base,old,PROJECTION=projected_class()

class Release(Base):
 def enabled(self,apply=False):s.need(READ_ENABLED and(not apply or APPLY_ENABLED))
 def query(self,sql,label):self.enabled(label=='apply');return super().query(sql,label)
 def admission(self):
  value=self.c.admission();value['mechanism_projection']=PROJECTION
  for file in sorted(HERE.iterdir()):
   if file.is_file():value.setdefault('entry_source_seals',{})[file.name]=s.sha(s.load(file))
  reference=self.read(self.private/'query-validation.json')
  s.need(type(reference)is dict and set(reference)=={'path','sha256'})
  relative=Path(reference['path']);s.need(not relative.is_absolute()and'..'not in relative.parts and relative.parts[:4]==('tracking','evidence','m07','logo-info-collector-proof'))
  raw=s.load(self.c.source/relative);validate_collector_proof(raw,reference['sha256'],self.c.source_pins())
  value['collector_validation']=reference;return value
 def response_binding(self):
  value=self.read(self.private/'apply-response-binding.json');self.c.b.security().verify(self.private/'apply-response.json');raw=s.load(self.private/'apply-response.json')
  s.need(value=={'claim_sha256':s.sha(s.load(self.claim)),'response_sha256':s.sha(raw),'exit_code':0})
  claim=self.read(self.claim);s.need(old.rows(raw)=={'version':s.VERSION,'marker':claim['marker'],'migration_sha256':s.MIGRATION_SHA});return s.sha(raw)
 def checkpoint(self,phase,expected,installed):
  reference=super().checkpoint(phase,expected,installed);reference['history_path']=['state','history','versions'];return reference
 def worker(self):
  self.enabled();files={'development/m07/production-web-release/release.py':'62ce229284777f01a81589c61738cfef0feeadc1f68ef0049c883b54fdfed337','development/m07/logo-recovery-web-forward-release/projection.py':'cf1d1f3269f004182d7caf44fc4dcf63b93c635706410d47e76b889aae74db46'}
  for name,digest in files.items():s.need(s.sha(s.load(self.c.root/name))==digest)
  web=module('logo41_existing_GET_only_transport',self.c.root/'development/m07/production-web-release/release.py');projection=module('logo41_existing_worker_projection',self.c.root/'development/m07/logo-recovery-web-forward-release/projection.py')
  projection.worker_anchor();op=web.Operator(self.c.root)
  route='/v13/deployments/'+projection.WORKER['deployment_id']+'?teamId='+projection.WORKER['team_id']
  first=projection.worker_projection(op.api(route));second=projection.worker_projection(op.api(route));s.need(first==second)
  self.last_worker={'identity':first,'two_equal_GET_readbacks':True,'fresh_application_heartbeat_claimed':False};return self.last_worker
 def prepare(self):
  self.enabled();value=super().prepare();value['worker']=self.last_worker;return value
 def apply(self):
  self.enabled(True);value=super().apply();value['worker']=getattr(self,'last_worker',None);return value
 def reconcile(self):self.enabled();return super().reconcile()
 def compare_checkpoints(self,before,after):
  left=self.checkpoint_read(before);right=self.checkpoint_read(after);s.need(left['state']==self.read(self.plan)['before']);self.c.transition(left['state'],right['state'])
  # Full rows for every table, including audit_events.reason; no40 exception.
  for table in self.c.tables:s.need(sorted(map(old.encoded,left['application_tables'][table]))==sorted(map(old.encoded,right['application_tables'][table])))
  expected=dict(left['catalogue']);expected['functions|'+s.SIGNATURE+'|source_sha256']=s.NEW;s.need(right['catalogue']==expected)
  functions=json.loads(json.dumps(left['function_rows']));targets=[row for row in functions if str(row['oid'])==str(left['state']['target']['identity']['oid'])];s.need(len(targets)==1 and targets[0]['prosrc']==self.c.old_body);targets[0]['prosrc']=self.c.candidate.patch_body(self.c.old_body);s.need(functions==right['function_rows'])
  s.need(right['history_rows']==left['history_rows']+[{'version':s.VERSION,'statements':[],'name':'m07_logo_info_operation'}]);return True

def validate_collector_proof(raw,expected_sha,source_pins):
 s.need(s.sha(raw)==expected_sha);proof=json.loads(raw)
 s.need(proof['result']=='passed'and proof['cloud_called']is False and proof['provider_called']is False)
 s.need(all(proof[key]is True for key in('all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')))
 validation=proof['collector_validation']
 s.need(validation['result']=='passed'and validation['production_identity_admission_claimed']is False)
 checks=('actual_state_checkpoint_and_rendered_transaction','all76_full_rows_including_reason_preserved','full_functions_catalogue_roles_dependencies_preserved','actual_negative_preimage_refused_and_rolled_back','diagnostic_rollback_exact','two_equal_before_reads','two_equal_after_reads','before_and_after_full_checkpoints_checked','only_owned_database_identity_qualified')
 s.need(all(validation[key]is True for key in checks))
 marker=validation['normal_commit_nonce'];s.need(str(s.uuid.UUID(marker))==marker and s.uuid.UUID(marker).version==4)
 s.need(validation['normal_commit_return']=={'version':s.VERSION,'marker':marker,'migration_sha256':s.MIGRATION_SHA})
 # The protected reference supplies the actual receipt without editing source
 # registration after its proof. Only literal flag arming is normalized.
 for file,expected in source_pins.items():
  path=Path(file);relative=path.relative_to(s.MAIN).as_posix()if path.is_relative_to(s.MAIN)else path.relative_to(s.SOURCE).as_posix()
  data=s.load(path);s.need(s.sha(data)==expected)
  if path==HERE/'release.py':data=old.disabled_release_bytes(data)
  s.need(proof['source_seals'][relative]==s.sha(data))
 return proof

def save(action,value,root):
 directory=root/'tracking/evidence/m07'/PURPOSE;directory.mkdir(parents=True,exist_ok=True);file=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 document={'schema_version':'1.0','purpose':PURPOSE,'action':action,'target':s.TARGET,'version':s.VERSION,'migration_sha256':s.MIGRATION_SHA,'raw_payloads_logged':False,'private_checkpoint_is_restore_proof':False,**value}
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(document,sort_keys=True,indent=2)+'\n')
 return file.relative_to(root).as_posix()
def main(argv=None):
 args=sys.argv[1:]if argv is None else argv;s.need(len(args)==2 and args[0]in('prepare','apply','reconcile'));s.need(READ_ENABLED and(args[0]!='apply'or APPLY_ENABLED))
 operator=Release(args[1]);operator.enabled(args[0]=='apply');value=getattr(operator,args[0])();print(json.dumps({'result':value['result'],'receipt':save(args[0],value,operator.c.source)}));s.need(value['result']in('passed','prepared'))
if __name__=='__main__':
 try:main()
 except Exception:print('{"result":"unconfirmed","safe_error_code":"LOGO_INFO41_RELEASE_UNCONFIRMED"}',file=sys.stderr);sys.exit(1)
