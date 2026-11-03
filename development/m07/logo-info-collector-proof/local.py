"""Owned-only adapter for the SEALED real41 Context; no DB/provider port."""
from pathlib import Path
import copy,importlib.util,json,sys,uuid
HERE=Path(__file__).resolve().parent;MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
s=module('logo41_actual_sealed_state',MAIN/'development/m07/logo-info-canonical-release/state.py')
s.need(s.sha(s.load(MAIN/'development/m07/logo-info-canonical-release/state.py'))=='701d7aeb4b57b45092f91b84abea5f2136c57a79be407a2ba92ec868b1da6a3a')
OLD=MAIN/'development/m07/worker-source-identity-sql-proof/local.py'
s.need(s.sha(s.load(OLD))=='7a57cfb4b03b1c41cbe4f69b58c501fc6f85fd9909c7c51c0576ce30ca145355')
old=module('logo41_frozen_owned_identity_library',OLD)

class Context(s.Context):
 def compatibility_sql(self):
  sql=super().compatibility_sql()
  if 'to_jsonb(3::bigint)'in sql:return old.qualify_oauth_count(sql,3,2)
  s.need(sql.count('to_jsonb(2::bigint)')==1);return sql
 def bind(self,initial,system,run):
  s.need(system.isdecimal()and system!=old.ORIGINAL_SYSTEM and str(uuid.UUID(run))==run and uuid.UUID(run).version==4)
  value=initial['compatibility'];s.need(value['schema40']['canonical']['base']['data']['oauth_consent_claims']['count']==2)
  context=old.OwnedContext(root=MAIN,source=MAIN).bind_current(value['schema40'],system,run)
  compat=old.m.State(s.NATIVE,context=context);compat.anchor=copy.deepcopy(value['schema40']);self.compat=compat;self.system=system;self.run=run
  self.check(initial,False);return self
 def render(self,before,marker):
  canonical=super().render(before,marker);old_guard="current_database()<>'postgres'"
  new_guard="current_database()<>'project39'or(pg_control_system()).system_identifier::text<>"+s.literal(self.system)+"or current_setting('eps.logo41collector.run',true)is distinct from"+s.literal(self.run)
  value=s.replace(canonical,old_guard,new_guard);s.need(s.replace(value,new_guard,old_guard)==canonical);return value

def configuration():
 c=Context();return {'snapshot_sql':c.state_sql(),'checkpoint_sql':c.checkpoint_sql(),'source_pins':c.source_pins(),'history':c.history,'native':s.NATIVE,'migration_sha256':s.MIGRATION_SHA,'owned_qualifications':{'database':'project39','original_system_excluded':old.ORIGINAL_SYSTEM,'synthetic_OAuth_ledger_count':2,'fresh_owned_OIDs_not_canonical_OIDs':True,'protected_M02_and_CLI_identity_absent_only':True,'full_business_and_reason_columns_preserved':True}}

def dispatch(action,value):
 c=Context().bind(value['initial'],value['system'],value['run'])
 if action=='check':c.check(value['observed'],value.get('installed',False));return {'result':'passed'}
 if action=='render':
  before=value['before'];sql=c.render(before,value['marker']);assertions=list(__import__('re').finditer(r'do \$logo41\$declare observed jsonb;.*?end\$logo41\$;\n',sql,__import__('re').S));s.need(len(assertions)==2)
  diagnostic=sql[:assertions[1].start()]+c.state_sql()+'as reason40_release;rollback;';s.need('commit;'not in diagnostic)
  return {'sql':sql,'diagnostic_sql':diagnostic,'expected':c.expected(before),'sql_sha256':s.sha(sql.encode()),'diagnostic_sha256':s.sha(diagnostic.encode())}
 if action=='diagnose':
  expected=c.expected(value['before']);differences=old.differing_paths(expected,value['observed'])
  if not differences:c.transition(value['before'],value['observed'])
  return {'result':'passed'if not differences else'differs','difference_count':len(differences),'differences':differences,'normal_nonce_claimed':False}
 s.need(action=='compare');left=value['before_checkpoint'];right=value['after_checkpoint'];c.checkpoint_check(left,False);c.checkpoint_check(right,True);c.transition(left['state'],right['state'])
 r=module('logo41_actual_full_checkpoint_compare',MAIN/'development/m07/logo-info-canonical-release/release.py')
 class Views:
  plan=object()
  def checkpoint_read(self,reference):return left if reference=='before'else right
  def read(self,path):return {'before':left['state']}
 view=Views();view.c=c;r.Release.compare_checkpoints(view,'before','after')
 return {'result':'passed','all76_full_rows_including_reason_preserved':True,'full_functions_catalogue_roles_dependencies_preserved':True,'production_identity_admission_claimed':False}

if __name__=='__main__':
 try:
  s.need(len(sys.argv)==2)
  if sys.argv[1]=='configuration':result=configuration()
  else:
   raw=sys.stdin.buffer.read(32*1024**2+1);s.need(0<len(raw)<=32*1024**2);result=dispatch(sys.argv[1],json.loads(raw))
  print(json.dumps(result,ensure_ascii=False,separators=(',',':')))
 except Exception:
  # The sealed bridge privately retains bounded stderr before closed projection.
  __import__('traceback').print_exc(file=sys.stderr)
  print('{"result":"unconfirmed","code":"OWNED_LOGO41_ADAPTER_REFUSED"}',file=sys.stderr);sys.exit(1)
