"""Owned-only JSON adapter for the actual schema40 worker State; no DB port."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re,sys,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
NEW_NATIVE='sha256:3d4286db01b27b40ec9078e303158e93003a096d5ddad1c9802130238de6dd80'
NATIVE_EXPORT={'path':'tracking/evidence/m07/worker-source-identity-release/2026-11-02T19-09-59-072239Z-native-export.json','sha256':'a05c6dba0e59813afadc42b07a286c0fd43c07852fe4474fc48cf2916b870814'}
ORIGINAL_SYSTEM='7701520506262638626';OWNED_CLAIMS=2
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
m=module('worker40_actual_current_State',HERE.parent/'worker-source-identity-release/state.py');need=m.need;sha=m.sha;load=m.load
OWNED=MAIN/'development/m07/review-link-reason40-main-diagnostics/local.py';OWNED_SHA='69bc50ab625e8d3b084090c2402d3886db98a69409461def04402148127ec08d'
need(sha(load(OWNED))==OWNED_SHA);old=module('worker40_frozen_owned_qualification',OWNED)
def encoded(value):return json.dumps(value,separators=(',',':'),ensure_ascii=False).encode()
class OwnedContext(old.prior.OwnedContext):
 def bind_current(self,before,system,run):
  need(type(system)is str and system.isdecimal()and system!=ORIGINAL_SYSTEM and str(uuid.UUID(run))==run and uuid.UUID(run).version==4);self.system=system;self.run=run
  base=before['canonical']['base'];need(base['database']=='project39'and base['operator']==base['session_user']=='postgres'and base['cli_role_safe']is False and base['protected_m02_integrity']is False)
  self.owned_identity={key:copy.deepcopy(base[key])for key in('database','cli_role_safe','protected_m02_integrity','protected_m02')};self.anchor=self.normalize(before)['canonical']
  # The inherited40 checker normalizes only its history view back to39; actual
  # outer history40, function/role/OID identities remain in the fresh State.
  self.anchor['base']['history']=copy.deepcopy(self.history);return self
def owned_state(initial,system,run):
 need(set(initial)=={'schema40','lifecycle','oauth_count_only'}and initial['schema40']['canonical']['base']['data']['oauth_consent_claims']['count']==OWNED_CLAIMS)
 context=OwnedContext(root=MAIN,source=MAIN).bind_current(initial['schema40'],system,run);state=m.State(NEW_NATIVE,context=context);state.anchor=copy.deepcopy(initial['schema40']);state.initial(initial);return state
def qualify_oauth_count(sql,canonical_count,owned_count=OWNED_CLAIMS):
 old='to_jsonb('+str(canonical_count)+'::bigint)';new='to_jsonb('+str(owned_count)+'::bigint)';need(sql.count(old)==1);changed=sql.replace(old,new,1);need(changed.replace(new,old,1)==sql);return changed
def configuration():
 state=m.State(NEW_NATIVE);count=state.anchor['canonical']['base']['data']['oauth_consent_claims']['count'];need(count==3)
 raw=load(MAIN/NATIVE_EXPORT['path']);need(sha(raw)==NATIVE_EXPORT['sha256']);export=json.loads(raw);need(export['result']=='passed'and export['runtime_digest']==NEW_NATIVE and export['normal_build_process_return_observed']is True)
 # Same actual production queries, with just the known synthetic ledger anchor.
 snapshot=qualify_oauth_count(state.state_sql(),count);checkpoint=qualify_oauth_count(state.checkpoint_sql(),count);comparable=qualify_oauth_count(state.comparable_sql(),count)
 before={'schema40':copy.deepcopy(state.anchor),'lifecycle':dict.fromkeys(m.COUNTERS,0),'oauth_count_only':{'claims_count':count,'full_sha256':state.anchor['canonical']['base']['oauth']['sha256'],'static_sha256':state.anchor['canonical']['base']['oauth_static_sha256'],'reconstructed_anchor_full_sha256':state.anchor['canonical']['base']['oauth']['sha256']}}
 rendered=state.render(before,'pause','00000000-0000-4000-8000-000000000001');blocks=re.findall(r'do \$worker_identity_update\$.*?end\$worker_identity_update\$;\n',rendered,re.S);need(len(blocks)==5)
 paused=copy.deepcopy(before)
 for row in paused['schema40']['canonical']['processing_config'].values():row['public']['enabled']=False
 paused['schema40']['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']=NEW_NATIVE
 resume=re.findall(r'do \$worker_identity_update\$.*?end\$worker_identity_update\$;\n',state.render(paused,'resume','00000000-0000-4000-8000-000000000001'),re.S);need(len(resume)==5)
 def assertion(expression,tag):return 'do $worker_identity$declare observed jsonb;begin '+expression+' into observed;if observed is distinct from __WORKER39_CAPTURED_PREIMAGE_SQL__ then raise exception\''+tag+"';end if;end$worker_identity$;\n"
 cfg={'sql_contract_sha256':state.sql_contract_sha256(),'native_pin_value':NEW_NATIVE,'native_export':NATIVE_EXPORT,'snapshot_sql':snapshot,'checkpoint_sql':"begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='60s';"+checkpoint+'as worker40_checkpoint;rollback;','comparable_sql':comparable,'prefix':state.prefix(),'lifecycle_sql':state.context.c.adoption.lifecycle_sql(),'tables':list(m.CONFIG),'counters':list(m.COUNTERS),'checkpoint_tables':state.context.tables,'pause_updates':blocks,'resume_updates':resume,'precondition_template':assertion(snapshot,'WORKER_IDENTITY_PREIMAGE_CHANGED'),'postcondition_template':assertion(comparable,'WORKER_IDENTITY_POSTIMAGE_CHANGED'),'full_postcondition_template':assertion(snapshot,'WORKER_IDENTITY_POSTIMAGE_CHANGED'),'owned_oauth_count_qualification':{'canonical':count,'owned':OWNED_CLAIMS,'inverse_byte_equal':True}}
 cfg['checkpoint_sha256']=sha(cfg['checkpoint_sql'].encode());cfg['hashes']={key:sha((''.join(value)if type(value)is list else value).encode())for key,value in cfg.items()if type(value)is str or key in('pause_updates','resume_updates')};return cfg
def differing_paths(left,right,path='$',out=None):
 out=[]if out is None else out
 if type(left)is type(right)and type(left)is dict:
  for key in sorted(set(left)|set(right)):
   if key not in left or key not in right:out.append({'path':path+'.'+key,'expected_sha256':sha(encoded(left.get(key))),'actual_sha256':sha(encoded(right.get(key)))})
   else:differing_paths(left[key],right[key],path+'.'+key,out)
 elif left!=right:out.append({'path':path,'expected_sha256':sha(encoded(left)),'actual_sha256':sha(encoded(right))})
 need(len(out)<=100);return out
def dispatch(action,value):
 state=owned_state(value['initial'],value['system'],value['run'])
 if action=='check':
  try:state.check(value['observed'])
  except ValueError:return {'result':'refused','actual_state_checker_refused':True}
  return {'result':'passed'}
 if action=='render':
  before=value['before'];phase=value['phase'];marker=value['marker'];sql=state.render(before,phase,marker);assertions=list(re.finditer(r'do \$worker_identity\$.*?end\$worker_identity\$;\n',sql,re.S));need(len(assertions)==2)
  diagnostic=sql[:assertions[1].start()]+state.state_sql()+'as worker_identity_release;rollback;';need('commit;'not in diagnostic)
  return {'sql':sql,'diagnostic_sql':diagnostic,'expected':state.expected(before,phase),'sql_sha256':sha(sql.encode()),'diagnostic_sha256':sha(diagnostic.encode()),'only_owned_ledger_scalar_and_embedded_preimage_values_qualified':True}
 if action=='diagnose':
  expected=state.expected(value['before'],value['phase']);observed=state.comparable(value['observed']);differences=differing_paths(expected,observed)
  if not differences:state.transition(value['before'],value['observed'],value['phase'])
  return {'result':'passed'if not differences else'differs','difference_count':len(differences),'differences':differences,'normal_commit_nonce_claimed':False}
 need(action=='compare');before=value['before_checkpoint'];after=value['after_checkpoint'];state.checkpoint_check(before);state.checkpoint_check(after);state.transition(before['state'],after['state'],value['phase']);need(before['catalogue']==after['catalogue'])
 for table in state.context.tables:
  first,last=copy.deepcopy(before['application_tables'][table]),copy.deepcopy(after['application_tables'][table])
  if table in m.CONFIG:
   need(len(first)==len(last)==1)
   for rows in(first,last):
    del rows[0]['enabled']
    if table=='frame_extraction_config':del rows[0]['native_image_id']
  need(first==last)
 return {'result':'passed','full76_rows_preserved':True,'full_nonnull_audit_reason_preserved':True,'all_fresh_metadata_OIDs_ACLs_roles_dependencies_preserved':True,'canonical_identity_claimed':False}
if __name__=='__main__':
 try:
  need(len(sys.argv)==2)
  if sys.argv[1]=='configuration':result=configuration()
  else:raw=sys.stdin.buffer.read(32*1024**2+1);need(0<len(raw)<=32*1024**2);result=dispatch(sys.argv[1],json.loads(raw))
  print(json.dumps(result,ensure_ascii=False,separators=(',',':')))
 except Exception:print('{"result":"unconfirmed","code":"OWNED_WORKER40_ADAPTER_REFUSED"}',file=sys.stderr);raise SystemExit(1)
