"""New bounded diagnostic/ACL purpose, with finite projected frozen cases."""
from pathlib import Path
import importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];TYPED=HERE.parent/'review-link-reason40-typed-collector'
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
projection=module('reason40_acl_compiler_projection',HERE/'context.py');s=projection.base
TYPED_PINS={'compiler.py':'fcfb5b65a00a7f81a34235916449516d9084ffa85144d0ddabff10a4216f4bcb','local.py':'d9be46ee4f000c002e051086afd39b737a47df4ea530053524db1a5692f2e339','context.py':'d35aea7b80f1c496ae99f10b2379eb8dbd63bf6bc7609c705dc406280278e188','release.py':'bbac9dc7a111a88492ef4ab492bfec13d1868bf41423119fbe2329156861eddf','cases.mjs':'4994962a1587e4535e007e0b30e1bb57ce7930fb44f7e0a084fb066552967616'}
FAILURE='tracking/evidence/m07/reason40-collector-validation/2026-11-02T11-53-00.629Z-66bca8e3.json';FAILURE_SHA='e7b62380b2438135a299f5a4f503f0a587204b6bf9b69375d178185002176ebd'
DIAGNOSTIC="""  const diagnosticClaim=await bridge('diagnostic_claim',{before,system:ctx.system,run:ctx.runId},ctx.root);assert.equal(diagnosticClaim.result,'claimed');
  ctx.report.diagnostic_rollback={result:'unconfirmed',claim:diagnosticClaim.claim,commit_nonce_claimed:false};
  const diagnosticObserved=await query(rendered.diagnostic_sql);
  const diagnostic=await bridge('diagnose',{before,observed:diagnosticObserved,system:ctx.system,run:ctx.runId},ctx.root);ctx.report.diagnostic_rollback=diagnostic;
  assert.deepEqual(await snapshot(),before);ctx.report.diagnostic_rollback.rolled_back_preimage_exact=true;
  assert.equal(diagnostic.result,'passed','REASON40_DIAGNOSTIC_POSTIMAGE_DIFFERS');assert.equal(diagnostic.difference_count,0);assert.equal(diagnostic.truncated,false);
"""
def compile_source(relative):
 for name,expected in TYPED_PINS.items():s.need(s.sha(s.load(TYPED/name))==expected)
 raw=s.load(ROOT/FAILURE);s.need(s.sha(raw)==FAILURE_SHA);failure=json.loads(raw);s.need(failure['result']=='failed'and failure['all_owned_resources_absent']is True and failure['original_data_catalogue_and_global_roles_unchanged']is True and failure['shared_lock_released']is True)
 old=module('reason40_frozen_typed_compiler_library',TYPED/'compiler.py');source,cfg,library,cases=old.compile_source(relative);original_cfg=json.dumps(cfg,sort_keys=True)
 context=projection.Context();previous_state=cfg['state_sql'];previous_checkpoint=cfg['checkpoint_sql'];cfg['state_sql']=context.state_sql();cfg['checkpoint_sql']=context.checkpoint_sql();s.need(s.replace_once(cfg['state_sql'],projection.NEW,projection.OLD)==previous_state and s.replace_once(cfg['checkpoint_sql'],projection.NEW,projection.OLD)==previous_checkpoint)
 old_bridge='new URL('+json.dumps((TYPED/'local.py').as_uri())+')';new_bridge='new URL('+json.dumps((HERE/'local.py').as_uri())+')'
 cases=s.replace_once(cases,old_bridge,new_bridge);cases=s.replace_once(cases,"['configuration','render','compare']","['configuration','render','compare','diagnostic_claim','diagnose']");cases=s.replace_once(cases,' const returned=await query(rendered.sql);',DIAGNOSTIC+' const returned=await query(rendered.sql);')
 cfg.update(new_state_sha256=s.sha(cfg['state_sql'].encode()),new_checkpoint_sha256=s.sha(cfg['checkpoint_sql'].encode()),typed_cases_sha256=s.sha(cases.encode()),prior_typed_state_sha256=s.sha(previous_state.encode()),prior_typed_checkpoint_sha256=s.sha(previous_checkpoint.encode()))
 cfg['source_pins'][str(library)]=s.sha(cases.encode());cfg['source_pins'][str(ROOT/FAILURE)]=FAILURE_SHA
 for file in sorted(HERE.iterdir()):
  if file.is_file():cfg['source_pins'][str(file)]=s.sha(s.load(file))
 def replace(old,new):
  nonlocal source
  source=s.replace_once(source,old,new)
 replace('const cfg='+original_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';');replace((TYPED/'cases.mjs').as_uri(),(HERE/'cases.mjs').as_uri())
 for old,new in[("'.local/reason40-typed-collector-validation'","'.local/reason40-acl-collector-validation'"),("'eps.reason40typed.run': runId","'eps.reason40acl.run': runId"),("'eps.reason40typed.workspace'","'eps.reason40acl.workspace'"),("'eps.reason40typed.purpose'","'eps.reason40acl.purpose'"),("'reason40-typed-valid-config-validation'","'reason40-acl-diagnostic-validation'"),("'eps-r40t-'","'eps-r40a-'"),("'reason40-typed-collector-owned-validation'","'reason40-acl-collector-owned-validation'")]:replace(old,new)
 replace('new owned PG17 typed six-key catalogue deletion plus valid synthetic config; frozen actual render/test functions; no canonical/config/provider/MCP/restore acceptance','new owned PG17 strict reason ACL shape plus bounded diagnostic ROLLBACK before guarded40 COMMIT; no canonical/config/provider/MCP/restore acceptance')
 replace('report.prior_failed_run={path:', 'report.original_setup_failure={path:')
 replace("report.checkpoint='reason40-valid-config-fixture-qualification';","report.prior_failed_run={path:"+json.dumps(FAILURE)+",sha256:"+json.dumps(FAILURE_SHA)+",cleanup_verified:true};report.checkpoint='reason40-acl-config-fixture-qualification';")
 start=source.index('    report.source_seals = {}; for (const [root, file] of ');end=source.index(' {\n      const bytes = await readFile',start);records=json.loads(source[start+len('    report.source_seals = {}; for (const [root, file] of '):end-1]);records.extend([[str(ROOT).replace('\\','/'),file.relative_to(ROOT).as_posix()]for file in sorted(HERE.iterdir())if file.is_file()]);records.append([str(ROOT).replace('\\','/'),FAILURE]);source=source[:start]+'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')'+source[end:]
 return source,cfg,library,cases
if __name__=='__main__':
 relative='.local/reason40-acl-collector-source/controller-'+str(uuid.uuid4())+'.mjs';source,cfg,library,cases=compile_source(relative);file=ROOT/relative;file.parent.mkdir(parents=True,exist_ok=True)
 flag=(HERE/'cases.mjs').read_text();true_count=flag.count('export const EXECUTION_ENABLED=true;');false_count=flag.count('export const EXECUTION_ENABLED=false;');s.need(true_count+false_count==1)
 for path,text in((library,cases),(file,source)):
  with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'controller':str(file),'sha256':s.sha(source.encode()),'private_case_library':str(library),'private_case_sha256':s.sha(cases.encode()),'compiled_only':True,'execution_dispatched':False,'execution_enabled':true_count==1,'sql_or_Docker_executed':False}))
