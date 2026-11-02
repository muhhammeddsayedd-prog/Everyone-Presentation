"""Finite typed purpose: reuse valid config and frozen test functions exactly."""
from pathlib import Path
import hashlib,importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];VALID=HERE.parent/'review-link-reason40-collector-fixture'
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
typed=module('reason40_compiler_typed_context',HERE/'context.py');s=typed.base
VALID_PINS={'compiler.py':'73c55b90e26181d17db5957e54375c99cdc3451e836e7d99ae0a698316ee8f7d','fixture.py':'7d297022e5fd5f878fab14972facf7c6b1db890d9231ae4d81377d09ed29cfa4','cases.mjs':'ace47f15011c155769b35e696548e2a3146244dcd07bb589360045413ac6a9d1'}
def compile_source(relative):
 for name,expected in VALID_PINS.items():s.need(s.sha(s.load(VALID/name))==expected)
 old=module('reason40_valid_config_compiler_library',VALID/'compiler.py');source,cfg=old.compile_source(relative);original_cfg=json.dumps(cfg,sort_keys=True)
 context=typed.Context();old_state=cfg['state_sql'];old_checkpoint=cfg['checkpoint_sql'];cfg['state_sql']=context.state_sql();cfg['checkpoint_sql']=context.checkpoint_sql()
 s.need(s.replace_once(cfg['state_sql'],typed.NEW,typed.OLD)==old_state and s.replace_once(cfg['checkpoint_sql'],typed.NEW,typed.OLD)==old_checkpoint)
 case_path=ROOT/Path(relative).with_name(Path(relative).stem+'-cases.mjs')
 frozen=s.load(typed.PRIOR/'local-cases.mjs');s.need(s.sha(frozen)=='32e0d07b310577c4e969bab76cef1953096ffb90583b25aed83f2d1198d81acd')
 old_bridge="new URL('./local.py',import.meta.url)";new_bridge='new URL('+json.dumps((HERE/'local.py').as_uri())+')'
 cases=s.replace_once(frozen.decode(),old_bridge,new_bridge);s.need(s.replace_once(cases,new_bridge,old_bridge).encode()==frozen)
 cfg.update(typed_cases_path=str(case_path),typed_cases_sha256=s.sha(cases.encode()),typed_keys=typed.KEYS,old_state_sha256=s.sha(old_state.encode()),new_state_sha256=s.sha(cfg['state_sql'].encode()),old_checkpoint_sha256=s.sha(old_checkpoint.encode()),new_checkpoint_sha256=s.sha(cfg['checkpoint_sql'].encode()))
 cfg['source_pins'][str(case_path)]=s.sha(cases.encode())
 for file in sorted(HERE.iterdir()):
  if file.is_file():cfg['source_pins'][str(file)]=s.sha(s.load(file))
 def replace(old,new):
  nonlocal source
  source=s.replace_once(source,old,new)
 replace('const cfg='+original_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';');replace((VALID/'cases.mjs').as_uri(),(HERE/'cases.mjs').as_uri())
 for old,new in[("'.local/reason40-collector-fixture-validation'","'.local/reason40-typed-collector-validation'"),("'eps.reason40fixture.run': runId","'eps.reason40typed.run': runId"),("'eps.reason40fixture.workspace'","'eps.reason40typed.workspace'"),("'eps.reason40fixture.purpose'","'eps.reason40typed.purpose'"),("'reason40-valid-config-collector-validation'","'reason40-typed-valid-config-validation'"),("'eps-r40f-'","'eps-r40t-'"),("'reason40-config-collector-owned-validation'","'reason40-typed-collector-owned-validation'")]:replace(old,new)
 replace('new owned PG17 purpose with source-backed valid synthetic config before baseline; frozen actual SQL40 collector/checkpoint/render functions; no canonical/config/provider/MCP/restore acceptance','new owned PG17 typed six-key catalogue deletion plus valid synthetic config; frozen actual render/test functions; no canonical/config/provider/MCP/restore acceptance')
 start=source.index('    report.source_seals = {}; for (const [root, file] of ');end=source.index(' {\n      const bytes = await readFile',start);records=json.loads(source[start+len('    report.source_seals = {}; for (const [root, file] of '):end-1]);records.extend([[str(ROOT).replace('\\','/'),file.relative_to(ROOT).as_posix()]for file in sorted(HERE.iterdir())if file.is_file()]);records.append([str(ROOT).replace('\\','/'),case_path.relative_to(ROOT).as_posix()]);source=source[:start]+'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')'+source[end:]
 return source,cfg,case_path,cases
if __name__=='__main__':
 relative='.local/reason40-typed-collector-source/controller-'+str(uuid.uuid4())+'.mjs';text,cfg,library,cases=compile_source(relative);file=ROOT/relative;file.parent.mkdir(parents=True,exist_ok=True)
 flag=(HERE/'cases.mjs').read_text();flag_true=flag.count('export const EXECUTION_ENABLED=true;');flag_false=flag.count('export const EXECUTION_ENABLED=false;');s.need(flag_true+flag_false==1)
 for path,content in((library,cases),(file,text)):
  with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(content)
 print(json.dumps({'controller':str(file),'sha256':s.sha(text.encode()),'private_case_library':str(library),'private_case_sha256':s.sha(cases.encode()),'compiled_only':True,'execution_dispatched':False,'execution_enabled':flag_true==1,'sql_or_Docker_executed':False}))
