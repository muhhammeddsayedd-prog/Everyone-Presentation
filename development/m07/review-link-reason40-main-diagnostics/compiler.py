"""New namespace and private bridge path only; frozen SQL/cases reused."""
from pathlib import Path
import importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];ACL=HERE.parent/'review-link-reason40-acl-collector'
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
projection=module('reason40_main_compile_context',HERE/'context.py');s=projection.base
PINS={'compiler.py':'3ee1c6765f599a32da3d868183b675aa957db1a170518f5a6e0d8308ee9c58e9','local.py':'a8a5536a6c8364cf0ea349b7400c94a002c6f3a38fa6105eed55fe063223e596','context.py':'ffe2b950f185789111346e2cd5120c577169d654be8c949a06dc34cbd99cf9e4','release.py':'61fd7992aa96ab4afc6c3c43fb26a9e60c4abce9263cb15f833634ea6851eabb','cases.mjs':'fae5e6cdaebfd5d684979b24a00128d1ea34a9bdae735ba10879c0b5afd13345'}
FAILURE='tracking/evidence/m07/reason40-collector-validation/2026-11-02T12-39-18.790Z-7c251681.json';FAILURE_SHA='d506fe4530b1a3c89f87958aa412226cd06347365b2009996226b08c559ba693'
def compile_source(relative):
 for name,expected in PINS.items():s.need(s.sha(s.load(ACL/name))==expected)
 raw=s.load(ROOT/FAILURE);s.need(s.sha(raw)==FAILURE_SHA);failure=json.loads(raw);s.need(failure['result']=='failed'and failure['all_owned_resources_absent']is True and failure['original_data_catalogue_and_global_roles_unchanged']is True and failure['shared_lock_released']is True)
 old=module('reason40_main_frozen_acl_compiler',ACL/'compiler.py');source,cfg,library,cases=old.compile_source(relative);original_cfg=json.dumps(cfg,sort_keys=True)
 old_bridge='new URL('+json.dumps((ACL/'local.py').as_uri())+')';new_bridge='new URL('+json.dumps((HERE/'local.py').as_uri())+')';cases=s.replace_once(cases,old_bridge,new_bridge);s.need(s.replace_once(cases,new_bridge,old_bridge)==old.compile_source(relative)[3]);cfg['typed_cases_sha256']=s.sha(cases.encode());cfg['source_pins'][str(library)]=s.sha(cases.encode());cfg['source_pins'][str(ROOT/FAILURE)]=FAILURE_SHA
 for file in sorted(HERE.iterdir()):
  if file.is_file():cfg['source_pins'][str(file)]=s.sha(s.load(file))
 def replace(old,new):
  nonlocal source
  source=s.replace_once(source,old,new)
 replace('const cfg='+original_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';');replace((ACL/'cases.mjs').as_uri(),(HERE/'cases.mjs').as_uri())
 for old,new in[("'.local/reason40-acl-collector-validation'","'.local/reason40-main-store-validation'"),("'eps.reason40acl.run': runId","'eps.reason40main.run': runId"),("'eps.reason40acl.workspace'","'eps.reason40main.workspace'"),("'eps.reason40acl.purpose'","'eps.reason40main.purpose'"),("'reason40-acl-diagnostic-validation'","'reason40-main-store-validation'"),("'eps-r40a-'","'eps-r40m-'"),("'reason40-acl-collector-owned-validation'","'reason40-main-store-owned-validation'")]:replace(old,new)
 replace('new owned PG17 strict reason ACL shape plus bounded diagnostic ROLLBACK before guarded40 COMMIT; no canonical/config/provider/MCP/restore acceptance','new owned PG17 reviewed ACL collector with Main-scoped private diagnostics and unchanged ROLLBACK/COMMIT acceptance; no canonical/config/provider/MCP/restore acceptance')
 replace('report.prior_failed_run={path:', 'report.prior_postimage_failure={path:');replace("report.checkpoint='reason40-acl-config-fixture-qualification';","report.prior_failed_run={path:"+json.dumps(FAILURE)+",sha256:"+json.dumps(FAILURE_SHA)+",cleanup_verified:true};report.checkpoint='reason40-main-store-fixture-qualification';")
 start=source.index('    report.source_seals = {}; for (const [root, file] of ');end=source.index(' {\n      const bytes = await readFile',start);records=json.loads(source[start+len('    report.source_seals = {}; for (const [root, file] of '):end-1]);records.extend([[str(ROOT).replace('\\','/'),file.relative_to(ROOT).as_posix()]for file in sorted(HERE.iterdir())if file.is_file()]);records.append([str(ROOT).replace('\\','/'),FAILURE]);source=source[:start]+'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')'+source[end:]
 return source,cfg,library,cases
if __name__=='__main__':
 relative='.local/reason40-main-store-source/controller-'+str(uuid.uuid4())+'.mjs';source,cfg,library,cases=compile_source(relative);file=ROOT/relative;file.parent.mkdir(parents=True,exist_ok=True);flag=(HERE/'cases.mjs').read_text();enabled=flag.count('export const EXECUTION_ENABLED=true;');disabled=flag.count('export const EXECUTION_ENABLED=false;');s.need(enabled+disabled==1)
 for path,text in((library,cases),(file,source)):
  with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'controller':str(file),'sha256':s.sha(source.encode()),'private_case_library':str(library),'private_case_sha256':s.sha(cases.encode()),'compiled_only':True,'execution_dispatched':False,'execution_enabled':enabled==1,'SQL_or_Docker_executed':False}))
