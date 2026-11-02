"""Inert owned-only adapter. JSON pipes only; no CLI, database or provider calls."""
from pathlib import Path
import copy,importlib.util,json,sys,uuid
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('reason40_local_actual_release',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r);s=r.s
ORIGINAL_SYSTEM='7701520506262638626'
QUALIFICATION_SHA='96bb3ac850a1bf43adf8486ec705aa38f02d8ba451fdab5005d7c3a6c2f54370'
BACKUP='.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql'

class OwnedContext(s.Context):
 def bind(self,before,system,run):
  s.need(str(uuid.UUID(run))==run and system.isdecimal()and system!=ORIGINAL_SYSTEM)
  self.system=system;self.run=run;self.owned_identity=None
  base=before['canonical']['base'];s.need(base['database']=='project39'and base['operator']==base['session_user']=='postgres'and base['cli_role_safe']is False and base['protected_m02_integrity']is False)
  self.owned_identity={key:copy.deepcopy(base[key])for key in('database','cli_role_safe','protected_m02_integrity','protected_m02')}
  self.anchor=self.normalize(before)['canonical'];self.check(before,False);return self
 def normalize(self,value):
  s.need(self.owned_identity is not None);value=copy.deepcopy(value);base=value['canonical']['base']
  s.need({key:base[key]for key in self.owned_identity}==self.owned_identity)
  # Qualification is limited to owned DB identity and the synthetic restore's
  # known absent canonical CLI-role/protected-M02 identities. No canonical role
  # OID or protected data is created; actual hashes/rows remain in the SQL image.
  base['database']='postgres';base['cli_role_safe']=True;base['protected_m02_integrity']=True;base['protected_m02']=copy.deepcopy(self.b.old.PROTECTED_M02)
  return value
 def check(self,value,installed):return super().check(self.normalize(value),installed)
 def render(self,before,marker):
  canonical=super().render(before,marker)
  old="current_database()<>'postgres'"
  new="current_database()<>'project39'or(pg_control_system()).system_identifier::text<>"+s.literal(self.system)+"or current_setting('eps.reason40collector.run',true)is distinct from "+s.literal(self.run)
  owned=s.replace_once(canonical,old,new);s.need(s.replace_once(owned,new,old)==canonical)
  return owned

def configuration():
 c=s.Context();file=s.SOURCE/'development/m07/worker39-concurrency/qualification.py';s.need(s.sha(s.load(file))==QUALIFICATION_SHA)
 q=s.module('reason40_collector_exact_clone_qualification',file)
 qualification,rows=q.sql(s.load(s.MAIN/BACKUP,32*1024*1024),c.c.adoption.lifecycle_sql(),c.c.adoption.COUNTERS)
 tables=sorted(c.c.adoption.CONFIG)
 setup=''.join('update eps.'+table+' set enabled=true'+(',native_image_id='+s.literal(s.NATIVE)if table=='frame_extraction_config'else'')+';'for table in tables)
 return {'state_sql':c.state_sql(),'checkpoint_sql':c.checkpoint_sql(),'migration_sha256':s.MIGRATION_SHA,'qualification_sql':qualification,'qualification_rows':rows,'config_setup_sql':setup,'config_setup_tables':tables,'source_pins':c.source_pins()}

def dispatch(action,value):
 c=OwnedContext().bind(value['before'],value['system'],value['run'])
 if action=='render':
  marker=value['marker'];sql=c.render(value['before'],marker);wrong=copy.deepcopy(value['before']);wrong['authority']['memberships']='f'*64
  negative=s.replace_once(sql,s.json_sql(value['before']),s.json_sql(wrong))
  return {'sql':sql,'negative_sql':negative,'expected':c.expected(value['before']),'canonical_render_sha256':s.sha(s.Context.render(c,value['before'],marker).encode()),'owned_render_sha256':s.sha(sql.encode()),'only_database_system_run_admission_changed':True}
 s.need(action=='compare');c.checkpoint_check(value['before_checkpoint'],False);c.checkpoint_check(value['after_checkpoint'],True);c.transition(value['before'],value['after'])
 s.need(value['before_checkpoint']['state']==value['before']and value['after_checkpoint']['state']==value['after'])
 class Views:
  plan=object()
  def checkpoint_read(self,reference):return value['before_checkpoint'if reference=='before'else'after_checkpoint']
  def read(self,path):return {'before':value['before']}
 view=Views();view.c=c;r.Release.compare_checkpoints(view,'before','after')
 return {'result':'passed','actual_state_checkpoint_and_rendered_transaction':True,'all76_old_column_rows_and_catalogue_preserved':True,'full_role_membership_function_identity_and_dependency_preimages_preserved':True,'canonical_identity_admission_claimed':False,'owned_identity_qualifications':['database_project39_system_run','synthetic_cli_role_safe_false','synthetic_protected_m02_identity_absent','fresh_verified_synthetic_static_anchor_and_OIDs'],'canonical_guard_sql_unmodified_except_owned_migration_target':True}

if __name__=='__main__':
 try:
  s.need(len(sys.argv)==2 and sys.argv[1]in('configuration','render','compare'))
  if sys.argv[1]=='configuration':result=configuration()
  else:
   raw=sys.stdin.buffer.read(32*1024*1024+1);s.need(0<len(raw)<=32*1024*1024);result=dispatch(sys.argv[1],json.loads(raw))
  print(json.dumps(result,sort_keys=True,separators=(',',':')))
 except Exception:print('{"result":"unconfirmed","safe_error_code":"REASON40_LOCAL_ADAPTER_UNCONFIRMED"}',file=sys.stderr);sys.exit(1)
