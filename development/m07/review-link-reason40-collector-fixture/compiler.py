"""NEW disabled purpose; frozen collector/compiler functions are library-only."""
from pathlib import Path
import importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];PRIOR=HERE.parent/'review-link-reason40-canonical-release'
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
PINS={'state.py':'712762e9b1b886e986111510b9823a88c7490edf689fb68a50a32b4dbba146f2','release.py':'dcd522fd91f8643fd36cdfbd61434dd62614126e1005d3f644f5bfc314748f90','local.py':'483cea4d8d1717f73ca5ebeb48c02a16e1e1d1a2c51b1301dcc6e38169e327a3','local-cases.mjs':'32e0d07b310577c4e969bab76cef1953096ffb90583b25aed83f2d1198d81acd','local-compiler.py':'3e5f68841d20548abe3f7ac2a50bddb7191bfd25a5870b8e5c249cd7b3e1412a'}
FAILURE='tracking/evidence/m07/reason40-collector-validation/2026-11-02T11-16-01.701Z-ec29f8df.json';FAILURE_SHA='bda5f7c4a0e75ea1c2f37795853ecfd790f1b1ed440446acc941423f0b463e6b'
def compile_source(relative):
 import hashlib
 for name,expected in PINS.items():
  if hashlib.sha256((PRIOR/name).read_bytes()).hexdigest()!=expected:raise ValueError('REASON40_FROZEN_COLLECTOR_CHANGED')
 old=module('reason40_frozen_compiler_library',PRIOR/'local-compiler.py');s=old.s
 raw=s.load(ROOT/FAILURE);s.need(s.sha(raw)==FAILURE_SHA);failure=json.loads(raw);s.need(failure['result']=='failed'and failure['all_owned_resources_absent']is True and failure['original_data_catalogue_and_global_roles_unchanged']is True and failure['shared_lock_released']is True)
 source,cfg=old.compile_source(relative);original_cfg=json.dumps(cfg,sort_keys=True);fixture=module('reason40_valid_synthetic_configuration',HERE/'fixture.py');sql,records=fixture.configuration();cfg['config_setup_sql']=sql;cfg['synthetic_config_fixture']=records
 for file in sorted(HERE.iterdir()):
  if file.is_file():cfg['source_pins'][str(file)]=s.sha(s.load(file))
 cfg['source_pins'][str(ROOT/FAILURE)]=FAILURE_SHA
 for item in records.values():cfg['source_pins'][str(ROOT/item['source'])]=item['source_sha256']
 def replace(old,new):
  nonlocal source
  source=s.replace_once(source,old,new)
 replace('const cfg='+original_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';')
 replace((PRIOR/'local-cases.mjs').as_uri(),(HERE/'cases.mjs').as_uri())
 for old,new in[("'.local/reason40-collector-validation'","'.local/reason40-collector-fixture-validation'"),("'eps.reason40collector.run'","'eps.reason40fixture.run'"),("'eps.reason40collector.workspace'","'eps.reason40fixture.workspace'"),("'eps.reason40collector.purpose'","'eps.reason40fixture.purpose'"),("'reason40-actual-collector-validation'","'reason40-valid-config-collector-validation'"),("'eps-r40q-'","'eps-r40f-'"),("'reason40-collector-owned-validation'","'reason40-config-collector-owned-validation'")]:replace(old,new)
 replace('new owned PG17 actual SQL40 collector/checkpoint/rendered transaction validation; explicit synthetic identity qualifications; no canonical/provider/MCP/restore acceptance','new owned PG17 purpose with source-backed valid synthetic config before baseline; frozen actual SQL40 collector/checkpoint/render functions; no canonical/config/provider/MCP/restore acceptance')
 replace("report.checkpoint='reason40-collector-exact-fixture-qualification';","report.prior_failed_run={path:"+json.dumps(FAILURE)+",sha256:"+json.dumps(FAILURE_SHA)+",cleanup_verified:true};report.checkpoint='reason40-valid-config-fixture-qualification';")
 replace("qualification+cfg.config_setup_sql+'commit;'","qualification+\"set local eps.reason40fixture.run=\"+quote(runId)+';'+cfg.config_setup_sql.replace('__REASON40_FIXTURE_SYSTEM_SQL__',quote(identity.system_identifier)).replace('__REASON40_FIXTURE_RUN_SQL__',quote(runId))+'commit;'")
 start=source.index('    report.source_seals = {}; for (const [root, file] of ');end=source.index(' {\n      const bytes = await readFile',start)
 records=json.loads(source[start+len('    report.source_seals = {}; for (const [root, file] of '):end-1]);records.extend([[str(ROOT).replace('\\','/'),file.relative_to(ROOT).as_posix()]for file in sorted(HERE.iterdir())if file.is_file()]);records.append([str(ROOT).replace('\\','/'),FAILURE]);source=source[:start]+'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')'+source[end:]
 return source,cfg
if __name__=='__main__':
 relative='.local/reason40-collector-fixture-source/controller-'+str(uuid.uuid4())+'.mjs';text,cfg=compile_source(relative);file=ROOT/relative;file.parent.mkdir(parents=True,exist_ok=True)
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 flag=(HERE/'cases.mjs').read_text();flag_true=flag.count('export const EXECUTION_ENABLED=true;');flag_false=flag.count('export const EXECUTION_ENABLED=false;')
 if flag_true+flag_false!=1:raise ValueError('REASON40_NEW_FLAG_SOURCE_UNCONFIRMED')
 print(json.dumps({'controller':str(file),'sha256':__import__('hashlib').sha256(text.encode()).hexdigest(),'compiled_only':True,'execution_dispatched':False,'execution_enabled':flag_true==1,'sql_or_Docker_executed':False}))
