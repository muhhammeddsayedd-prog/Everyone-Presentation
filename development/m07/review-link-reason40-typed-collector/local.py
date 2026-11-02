"""New JSON-pipe bridge; frozen owned qualifications and proof methods reused."""
from pathlib import Path
import copy,hashlib,importlib.util,json,sys
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
typed=module('reason40_typed_projection',HERE/'context.py');s=typed.base
file=typed.PRIOR/'local.py';s.need(hashlib.sha256(file.read_bytes()).hexdigest()=='483cea4d8d1717f73ca5ebeb48c02a16e1e1d1a2c51b1301dcc6e38169e327a3')
old=module('reason40_frozen_owned_context_library',file)
class OwnedContext(old.OwnedContext):
 def __init__(self,*args,**kwargs):super().__init__(*args,**kwargs);typed.correct(self)

def dispatch(action,value):
 c=OwnedContext().bind(value['before'],value['system'],value['run'])
 if action=='render':
  marker=value['marker'];sql=c.render(value['before'],marker);wrong=copy.deepcopy(value['before']);wrong['authority']['memberships']='f'*64
  return {'sql':sql,'negative_sql':s.replace_once(sql,s.json_sql(value['before']),s.json_sql(wrong)),'expected':c.expected(value['before']),'canonical_render_sha256':s.sha(s.Context.render(c,value['before'],marker).encode()),'owned_render_sha256':s.sha(sql.encode()),'only_database_system_run_admission_changed':True}
 s.need(action=='compare');c.checkpoint_check(value['before_checkpoint'],False);c.checkpoint_check(value['after_checkpoint'],True);c.transition(value['before'],value['after']);s.need(value['before_checkpoint']['state']==value['before']and value['after_checkpoint']['state']==value['after'])
 class Views:
  plan=object()
  def checkpoint_read(self,reference):return value['before_checkpoint'if reference=='before'else'after_checkpoint']
  def read(self,path):return {'before':value['before']}
 view=Views();view.c=c;old.r.Release.compare_checkpoints(view,'before','after')
 return {'result':'passed','actual_state_checkpoint_and_rendered_transaction':True,'all76_old_column_rows_and_catalogue_preserved':True,'full_role_membership_function_identity_and_dependency_preimages_preserved':True,'canonical_identity_admission_claimed':False,'owned_identity_qualifications':['database_project39_system_run','synthetic_cli_role_safe_false','synthetic_protected_m02_identity_absent','fresh_verified_synthetic_static_anchor_and_OIDs'],'canonical_guard_sql_unmodified_except_owned_migration_target':True}
if __name__=='__main__':
 try:
  s.need(len(sys.argv)==2 and sys.argv[1]in('render','compare'));raw=sys.stdin.buffer.read(32*1024*1024+1);s.need(0<len(raw)<=32*1024*1024);print(json.dumps(dispatch(sys.argv[1],json.loads(raw)),sort_keys=True,separators=(',',':')))
 except Exception:print('{"result":"unconfirmed","safe_error_code":"REASON40_TYPED_LOCAL_UNCONFIRMED"}',file=sys.stderr);sys.exit(1)
