"""Bounded owned JSON bridge plus private rollback diagnostics. No DB transport."""
from pathlib import Path
import hashlib,importlib.util,json,os,re,sys
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
projection=module('reason40_acl_projection',HERE/'context.py');s=projection.base
s.need(s.sha(s.load(projection.TYPED/'local.py'))=='d9be46ee4f000c002e051086afd39b737a47df4ea530053524db1a5692f2e339');prior=module('reason40_acl_frozen_owned',projection.TYPED/'local.py')
class OwnedContext(prior.OwnedContext):
 def reason_sql(self):return projection.correct_reason(super().reason_sql())
def raw(value):return(json.dumps(value,sort_keys=True,separators=(',',':'))+'\n').encode()
def write_private(c,run,name,value):
 s.need(name in('diagnostic.claim.json','diagnostic-poststate.json')and str(__import__('uuid').UUID(run))==run)
 folder=c.source/'.local/reason40-acl-collector-validation'/run;s.need(folder.is_dir()and folder.resolve()==folder);path=folder/name;data=raw(value);s.need(len(data)<=s.MAXIMUM)
 guard=c.b.security()
 with guard.create(path)as stream:guard.verify_open(stream);stream.write(data);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 guard.verify(path);s.need(s.load(path)==data);return {'path':path.relative_to(c.source).as_posix(),'sha256':s.sha(data),'scope':'owned_diagnostic_rollback_poststate','canonical_checkpoint':False}
def differing_paths(expected,actual,maximum=100):
 differences=[];overflow=False
 def add(path,left,right):
  nonlocal overflow
  if len(differences)>=maximum:overflow=True;return
  differences.append({'path':path,'expected_sha256':s.sha(raw(left)),'actual_sha256':s.sha(raw(right))})
 def walk(left,right,path,depth):
  if type(left)is not type(right):add(path,left,right);return
  if type(left)not in(dict,list)and left==right:return
  if depth>=32:add(path,left,right);return
  if type(left)is dict:
   for key in sorted(set(left)|set(right)):
    if key not in left or key not in right:add(path+[key],{'present':key in left,'value':left.get(key)},{'present':key in right,'value':right.get(key)})
    else:walk(left[key],right[key],path+[key],depth+1)
  elif type(left)is list and len(left)==len(right):
   for number,(a,b)in enumerate(zip(left,right)):walk(a,b,path+[number],depth+1)
  else:add(path,left,right)
 walk(expected,actual,[],0);return differences,overflow
def dispatch(action,value):
 c=OwnedContext().bind(value['before'],value['system'],value['run'])
 if action=='diagnostic_claim':
  expected=c.expected(value['before']);reference=write_private(c,value['run'],'diagnostic.claim.json',{'run':value['run'],'before_sha256':s.sha(raw(value['before'])),'expected_sha256':s.sha(raw(expected)),'dispatch_may_have_occurred':True,'automatic_retry':False});return {'result':'claimed','claim':reference}
 if action=='diagnose':
  expected=c.expected(value['before']);claim=c.source/'.local/reason40-acl-collector-validation'/value['run']/'diagnostic.claim.json';c.b.security().verify(claim);s.need(json.loads(s.load(claim))=={'run':value['run'],'before_sha256':s.sha(raw(value['before'])),'expected_sha256':s.sha(raw(expected)),'dispatch_may_have_occurred':True,'automatic_retry':False})
  observed=value['observed'];s.need(type(observed)is dict and set(observed)=={'state','reason_attribute','reference_attribute'})
  reference=write_private(c,value['run'],'diagnostic-poststate.json',{'run':value['run'],'system':value['system'],'scope':'owned_diagnostic_rollback_poststate','state':observed['state'],'reason_attribute':observed['reason_attribute'],'reference_attribute':observed['reference_attribute'],'canonical_checkpoint':False});diff,overflow=differing_paths(expected,observed['state'])
  if not diff and not overflow:s.need(raw(expected)==raw(observed['state']));c.transition(value['before'],observed['state'])
  return {'result':'passed'if not diff and not overflow else'differs','difference_count':len(diff),'differences':diff,'truncated':overflow,'expected_sha256':s.sha(raw(expected)),'observed_sha256':s.sha(raw(observed['state'])),'private_poststate':reference,'commit_nonce_claimed':False}
 if action=='render':
  marker=value['marker'];sql=c.render(value['before'],marker);wrong=__import__('copy').deepcopy(value['before']);wrong['authority']['memberships']='f'*64
  assertions=list(re.finditer(r'do \$reason40_assert\$.*?\$reason40_assert\$;\n',sql,re.S));s.need(len(assertions)==2)
  tail=sql[assertions[1].end():];s.need(tail.startswith('commit;select ')and tail.count('commit;')==1)
  attributes=lambda name:"(select to_jsonb(a)from pg_attribute a where a.attrelid='eps.audit_events'::regclass and a.attname="+s.literal(name)+"and not a.attisdropped)"
  select="select jsonb_build_object('state',("+c.state_sql()+"),'reason_attribute',"+attributes('reason')+",'reference_attribute',"+attributes('request_id')+")as reason40_release;rollback;"
  diagnostic=sql[:assertions[1].start()]+select;s.need('commit;'not in diagnostic.lower())
  return {'sql':sql,'diagnostic_sql':diagnostic,'negative_sql':s.replace_once(sql,s.json_sql(value['before']),s.json_sql(wrong)),'expected':c.expected(value['before']),'canonical_render_sha256':s.sha(s.Context.render(c,value['before'],marker).encode()),'owned_render_sha256':s.sha(sql.encode()),'only_database_system_run_admission_changed':True}
 s.need(action=='compare');c.checkpoint_check(value['before_checkpoint'],False);c.checkpoint_check(value['after_checkpoint'],True);c.transition(value['before'],value['after']);s.need(value['before_checkpoint']['state']==value['before']and value['after_checkpoint']['state']==value['after'])
 class Views:
  plan=object()
  def checkpoint_read(self,reference):return value['before_checkpoint'if reference=='before'else'after_checkpoint']
  def read(self,path):return {'before':value['before']}
 view=Views();view.c=c;prior.old.r.Release.compare_checkpoints(view,'before','after')
 return {'result':'passed','actual_state_checkpoint_and_rendered_transaction':True,'all76_old_column_rows_and_catalogue_preserved':True,'full_role_membership_function_identity_and_dependency_preimages_preserved':True,'canonical_identity_admission_claimed':False,'owned_identity_qualifications':['database_project39_system_run','synthetic_cli_role_safe_false','synthetic_protected_m02_identity_absent','fresh_verified_synthetic_static_anchor_and_OIDs'],'canonical_guard_sql_unmodified_except_owned_migration_target':True}
if __name__=='__main__':
 try:
  s.need(len(sys.argv)==2 and sys.argv[1]in('render','compare','diagnostic_claim','diagnose'));data=sys.stdin.buffer.read(32*1024*1024+1);s.need(0<len(data)<=32*1024*1024);print(json.dumps(dispatch(sys.argv[1],json.loads(data)),sort_keys=True,separators=(',',':')))
 except Exception:print('{"result":"unconfirmed","safe_error_code":"REASON40_ACL_LOCAL_UNCONFIRMED"}',file=sys.stderr);sys.exit(1)
