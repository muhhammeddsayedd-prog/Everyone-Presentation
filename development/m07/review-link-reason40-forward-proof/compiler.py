"""Finite additive projection of the passed602 bootstrap; compile only by default."""
from pathlib import Path
import importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];MAIN=HERE.parent/'review-link-reason40-main-diagnostics'
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
projection=module('forward_compile_sealed_context',MAIN/'context.py');s=projection.base
PINS={'compiler.py':'53c3e3366d895ad8ff29feaf4587f32981833142a428ebe7bf31d462debb9feb','local.py':'69bc50ab625e8d3b084090c2402d3886db98a69409461def04402148127ec08d','context.py':'209378698e118b6c5ce0b292f5ed1772c1a9cfd8f40a2000c159fb1c362ffcf6','release.py':'e4ac245e426550a8dc5c83e88bd6783c17c6f599d10686557b1931dca703f160','cases.mjs':'be5c0fcb5aa48f8d1816f0ed9b456aa80081ac34178502028777e3252ca6b982'}
PASSED='tracking/evidence/m07/reason40-collector-validation/2026-11-02T13-27-25.744Z-602f1dd4.json';PASSED_SHA='70f98f8cde94f963851eafc6e1feca4e52d411317e9724ab85ad03c892b98a6a'
PROPOSAL='tracking/evidence/m07/review-link-reason40-main-diagnostics/forward-baseline-proposal-validation.json';PROPOSAL_SHA='b35895aa05c29d5542bbc5adf8a44cef474739e9b4fe78448cee7071ddeb640d'
NEGATIVES=""" const accepted=await bridge('guard_current',{before,observed:before,system:ctx.system,run:ctx.runId},ctx.root);assert.equal(accepted.result,'accepted');
 const negativeCases=[['existing_acl',\"grant select on eps.oauth_consent_claims to anon;\"],['existing_function_value',\"alter function eps.project_dto(uuid) set statement_timeout='1234ms';\"]];
 ctx.report.forward_guard_negatives={baseline_accepted:true,cases:[],owned_current_identity:before.canonical.project39.old_identities,canonical_hardbound_five_scalar_baseline_claimed:false};
 for(const[label,mutation]of negativeCases){
  const changed=await query(\"begin;set local search_path='';set local statement_timeout='60s';\"+mutation+cfg.state_sql+'as reason40_release;rollback;');
  assert.notDeepEqual(changed,before);const denied=await bridge('guard_current',{before,observed:changed,system:ctx.system,run:ctx.runId},ctx.root);assert.equal(denied.result,'refused','FORWARD_UNKNOWN_METADATA_MUST_REFUSE');
  assert.deepEqual(await snapshot(),before);ctx.report.forward_guard_negatives.cases.push({label,actual_mutation_rolled_back:true,actual_guard_refused:true,exact_baseline_after_rollback:true,mutation_sha256:sha(mutation)});
 }
"""
def compile_source(relative):
 for name,pin in PINS.items():s.need(s.sha(s.load(MAIN/name))==pin)
 raw=s.load(ROOT/PASSED);s.need(s.sha(raw)==PASSED_SHA);passed=json.loads(raw);s.need(passed['result']=='passed'and all(passed[k]is True for k in('all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')))
 raw=s.load(ROOT/PROPOSAL);s.need(s.sha(raw)==PROPOSAL_SHA);proposal=json.loads(raw);s.need(proposal['live_enabled']is False and proposal['explicit_historical_identity_equality_since39']is False)
 for path,pin in proposal['source_seals'].items():s.need(s.sha(s.load(ROOT/path))==pin)
 old=module('forward_passed602_compiler_library',MAIN/'compiler.py');source,cfg,library,cases=old.compile_source(relative);original_cfg=json.dumps(cfg,sort_keys=True);old_cases=cases
 fixture=module('forward_owned_fixture_source',HERE/'fixture.py');cfg['forward_fixture_sql']=fixture.build(projection.Context().history);cfg['forward_upstream_sha256']=fixture.UPSTREAM_SHA;cfg['forward_core_sha256']=fixture.CORE_SHA;cfg['forward_dark_source_sha256']=fixture.DARK_SOURCE_SHA
 old_bridge='new URL('+json.dumps((MAIN/'local.py').as_uri())+')';new_bridge='new URL('+json.dumps((HERE/'local.py').as_uri())+')'
 cases=s.replace_once(cases,old_bridge,new_bridge);cases=s.replace_once(cases,"['configuration','render','compare','diagnostic_claim','diagnose']","['configuration','render','compare','diagnostic_claim','diagnose','guard_current']");needle=' const marker=randomUUID(),rendered=await bridge(';cases=s.replace_once(cases,needle,NEGATIVES+needle)
 inverse=s.replace_once(cases,NEGATIVES,'');inverse=s.replace_once(inverse,"['configuration','render','compare','diagnostic_claim','diagnose','guard_current']","['configuration','render','compare','diagnostic_claim','diagnose']");s.need(s.replace_once(inverse,new_bridge,old_bridge)==old_cases)
 cfg['typed_cases_sha256']=s.sha(cases.encode());cfg['source_pins'][str(library)]=s.sha(cases.encode())
 for path in sorted(HERE.rglob('*')):
  if path.is_file():cfg['source_pins'][str(path)]=s.sha(s.load(path))
 for path in(PASSED,PROPOSAL,*proposal['source_seals']):cfg['source_pins'][str(ROOT/path)]=s.sha(s.load(ROOT/path))
 def replace(old,new):
  nonlocal source
  source=s.replace_once(source,old,new)
 replace('const cfg='+original_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';');replace((MAIN/'cases.mjs').as_uri(),(HERE/'cases.mjs').as_uri())
 for old,new in[("'.local/reason40-main-store-validation'","'.local/reason40-forward-validation'"),("'eps.reason40main.run': runId","'eps.reason40forward.run': runId"),("'eps.reason40main.workspace'","'eps.reason40forward.workspace'"),("'eps.reason40main.purpose'","'eps.reason40forward.purpose'"),("'reason40-main-store-validation'","'reason40-forward-owned-validation'"),("'eps-r40m-'","'eps-r40w-'"),("'reason40-main-store-owned-validation'","'reason40-forward-baseline-owned-validation'")]:replace(old,new)
 replace('new owned PG17 reviewed ACL collector with Main-scoped private diagnostics and unchanged ROLLBACK/COMMIT acceptance; no canonical/config/provider/MCP/restore acceptance','new owned PG17 official0074 and synthetic ledger increment before fresh baseline; unknown ACL/value refusal and unchanged SQL40 guard; no canonical/provider/OAuth/restore acceptance')
 replace("case when r.table_name='eps.audit_events'then'(to_jsonb(t)-''reason'')'else'to_jsonb(t)'end","case when r.table_name='eps.audit_events'then'(to_jsonb(t)-''reason'')'when r.table_name='storage.buckets'then'(to_jsonb(t)-''versioning_status'')'else'to_jsonb(t)'end")
 replace("report.checkpoint='reason40-main-store-fixture-qualification';","report.prior_passed_collector={path:"+json.dumps(PASSED)+",sha256:"+json.dumps(PASSED_SHA)+"};report.checkpoint='reason40-forward-before-baseline-fixture-qualification';")
 start=source.index('    report.source_seals = {}; for (const [root, file] of ');end=source.index(' {\n      const bytes = await readFile',start);records=json.loads(source[start+len('    report.source_seals = {}; for (const [root, file] of '):end-1]);records.extend([[str(ROOT).replace('\\','/'),path.relative_to(ROOT).as_posix()]for path in sorted(HERE.rglob('*'))if path.is_file()]);records.extend([[str(ROOT).replace('\\','/'),path]for path in(PASSED,PROPOSAL,*proposal['source_seals'])]);source=source[:start]+'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')'+source[end:]
 return source,cfg,library,cases
if __name__=='__main__':
 relative='.local/reason40-forward-source/controller-'+str(uuid.uuid4())+'.mjs';source,cfg,library,cases=compile_source(relative);file=ROOT/relative;file.parent.mkdir(parents=True,exist_ok=True);flag=(HERE/'cases.mjs').read_text();enabled=flag.count('export const EXECUTION_ENABLED=true;');disabled=flag.count('export const EXECUTION_ENABLED=false;');s.need(enabled+disabled==1)
 for path,text in((library,cases),(file,source)):
  with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'controller':str(file),'sha256':s.sha(source.encode()),'private_case_library':str(library),'private_case_sha256':s.sha(cases.encode()),'compiled_only':True,'execution_dispatched':False,'execution_enabled':enabled==1,'local_SQL_Docker_executed':False}))
