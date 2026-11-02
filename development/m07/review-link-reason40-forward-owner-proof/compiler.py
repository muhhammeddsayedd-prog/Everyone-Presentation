"""New namespace/fixture data projection; same callback layer and sealed controller."""
from pathlib import Path
import hashlib,importlib.util,json,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];PRIOR=HERE.parent/'review-link-reason40-forward-proof'
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
PARENT_SHA='dc3f16d092e02910497d0bbb3638c4c400c8977be6ab2be1931d2a0f5195251d'
if hashlib.sha256((PRIOR/'compiler.py').read_bytes()).hexdigest()!=PARENT_SHA:raise ValueError('FORWARD_OWNER_PARENT_CHANGED')
old=module('forward_owner_frozen_compiler',PRIOR/'compiler.py');s=old.s
FAILED='tracking/evidence/m07/reason40-collector-validation/2026-11-02T15-33-05.149Z-80be12f3.json';FAILED_SHA='5a67bd0720bca71cbfeb7e74616cd58049411e15be3c2266d8c3fe3f6509eab6'
def compile_source(relative):
 s.need(s.sha(s.load(PRIOR/'compiler.py'))==PARENT_SHA);raw=s.load(ROOT/FAILED);s.need(s.sha(raw)==FAILED_SHA);failure=json.loads(raw);s.need(failure['result']=='failed'and all(failure[k]is True for k in('all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')))
 source,cfg,library,cases=old.compile_source(relative);original_cfg=json.dumps(cfg,sort_keys=True);fix=module('forward_owner_fixture_data_fix',HERE/'fixture-correction.py');cfg['forward_fixture_sql']=fix.correct(cfg['forward_fixture_sql'])
 current=s.load(HERE/'cases.mjs');parent=s.load(PRIOR/'cases.mjs');s.need(current.count(b'export const EXECUTION_ENABLED=false;')+current.count(b'export const EXECUTION_ENABLED=true;')==1);s.need(current.replace(b'export const EXECUTION_ENABLED=false;',b'export const EXECUTION_ENABLED=true;')==parent)
 for file in sorted(HERE.iterdir()):
  if file.is_file():cfg['source_pins'][str(file)]=s.sha(s.load(file))
 cfg['source_pins'][str(ROOT/FAILED)]=FAILED_SHA
 def replace(old,new):
  nonlocal source
  source=s.replace_once(source,old,new)
 replace('const cfg='+original_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';');replace((PRIOR/'cases.mjs').as_uri(),(HERE/'cases.mjs').as_uri())
 for old_value,new_value in[("'.local/reason40-forward-validation'","'.local/reason40-forward-owner-validation'"),("'eps.reason40forward.run': runId","'eps.reason40forwardowner.run': runId"),("'eps.reason40forward.workspace'","'eps.reason40forwardowner.workspace'"),("'eps.reason40forward.purpose'","'eps.reason40forwardowner.purpose'"),("'reason40-forward-owned-validation'","'reason40-forward-owner-validation'"),("'eps-r40w-'","'eps-r40u-'"),("'reason40-forward-baseline-owned-validation'","'reason40-forward-owner-context-owned-validation'")]:replace(old_value,new_value)
 replace("report.checkpoint='reason40-forward-before-baseline-fixture-qualification';","report.prior_failed_owner_fixture={path:"+json.dumps(FAILED)+",sha256:"+json.dumps(FAILED_SHA)+",observed_psql_exit:3,inferred_SQLSTATE:'42501',SQLSTATE_captured:false};report.checkpoint='reason40-forward-owner-before-baseline-fixture-qualification';")
 replace('new owned PG17 official0074 and synthetic ledger increment before fresh baseline; unknown ACL/value refusal and unchanged SQL40 guard; no canonical/provider/OAuth/restore acceptance','new owned PG17 corrected initial-admin fixture context; exact0074/ledger and full SQL40 guard unchanged; no canonical/provider/OAuth/restore acceptance')
 start=source.index('    report.source_seals = {}; for (const [root, file] of ');end=source.index(' {\n      const bytes = await readFile',start);records=json.loads(source[start+len('    report.source_seals = {}; for (const [root, file] of '):end-1]);records.extend([[str(ROOT).replace('\\','/'),file.relative_to(ROOT).as_posix()]for file in sorted(HERE.iterdir())if file.is_file()]);records.append([str(ROOT).replace('\\','/'),FAILED]);source=source[:start]+'    report.source_seals = {}; for (const [root, file] of '+json.dumps(records)+')'+source[end:]
 return source,cfg,library,cases
if __name__=='__main__':
 relative='.local/reason40-forward-owner-source/controller-'+str(uuid.uuid4())+'.mjs';source,cfg,library,cases=compile_source(relative);file=ROOT/relative;file.parent.mkdir(parents=True,exist_ok=True);flag=(HERE/'cases.mjs').read_text();enabled=flag.count('export const EXECUTION_ENABLED=true;');disabled=flag.count('export const EXECUTION_ENABLED=false;');s.need(enabled+disabled==1)
 for path,text in((library,cases),(file,source)):
  with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'controller':str(file),'sha256':s.sha(source.encode()),'private_case_library':str(library),'private_case_sha256':s.sha(cases.encode()),'compiled_only':True,'execution_dispatched':False,'execution_enabled':enabled==1,'SQL_Docker_executed':False}))
