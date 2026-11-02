"""Only the failed audit observation gains its existing collector search_path."""
from pathlib import Path
import importlib.util,json,re,uuid
HERE=Path(__file__).resolve().parent;SOURCE=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio');BRIDGE=MAIN/'development/m07/worker-source-identity-sql-bridge-proof'
PLAN='tracking/evidence/m07/worker-source-identity-sql-bridge-proof/disabled-owned-plan.json';PLAN_SHA='b49c926b340a82ba1772bbea328c18fb2346316455de88856cc9c5d0955a5269'
FAILED='tracking/evidence/m07/worker-source-identity-sql-bridge-proof/2026-11-02T20-51-28.204Z-b99606ab.json';FAILED_SHA='fa61026136146eee765c6983a8bf66ac94c33ac6a864a01a5474adf63e39827d'
MISSING='"begin;update eps.audit_events set reason=';CORRECT="\"begin;set local search_path='';update eps.audit_events set reason="

def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def sha(raw):return __import__('hashlib').sha256(raw).hexdigest()
def need(value):
 if not value:raise ValueError('WORKER40_OBSERVATION_PROOF_COMPILATION_REFUSED')
def flag(raw):
 a=b'export const EXECUTION_ENABLED=false;';b=b'export const EXECUTION_ENABLED=true;';need(raw.count(a)+raw.count(b)==1);return raw.replace(b,a)

def compile_source(relative):
 match=re.fullmatch(r'\.local/worker-source-identity-sql-observation-compiled/controller-([a-f0-9-]{36})\.mjs',relative);need(match is not None and str(uuid.UUID(match[1]))==match[1]and uuid.UUID(match[1]).version==4)
 raw=(MAIN/PLAN).read_bytes();need(sha(raw)==PLAN_SHA);plan=json.loads(raw)
 for name in('compiler.py','entry.mjs','bridge.mjs','bridge.test.mjs','test_compiler.py','README.md'):
  raw=(BRIDGE/name).read_bytes();need(sha(flag(raw)if name=='entry.mjs'else raw)==plan['source_seals']['development/m07/worker-source-identity-sql-bridge-proof/'+name])
 raw=(MAIN/FAILED).read_bytes();need(sha(raw)==FAILED_SHA);failure=json.loads(raw);need(failure['result']=='failed'and all(failure[k]is True for k in('all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')));render=[x for x in failure['worker40_bridge_diagnostics']if x['action']=='render'];need(len(render)==1 and render[0]['exit_code']==1 and not render[0]['timed_out']and not render[0]['overflow'])
 raw=(HERE/'entry.mjs').read_bytes();enabled=b'export const EXECUTION_ENABLED=true;'in raw;flag(raw)
 base=module('worker40_sealed_bridge_compiler_library',BRIDGE/'compiler.py');old_relative=relative.replace('worker-source-identity-sql-observation-compiled','worker-source-identity-sql-bridge-compiled');source,_,callback,_=base.compile_source(old_relative);original=source;original_callback=callback;changes=[]
 def replace(before,after):
  nonlocal source;need(source.count(before)==1);source=source.replace(before,after,1);changes.append((before,after))
 begin=source.index('const cfg=')+len('const cfg=');cfg,length=json.JSONDecoder().raw_decode(source[begin:]);old_cfg=json.dumps(cfg,sort_keys=True)
 projection=base.module('worker40_observation_same_concurrency',base.ADMIN.parent/'worker-source-identity-sql-proof/projection.py');concurrency,proof=projection.project(cfg['sql_contract_sha256'],enabled);concurrency_relative=relative.replace('/controller-','/concurrency-');cfg['source_pins'].pop(cfg['concurrency_file']);cfg['concurrency_file']=str(MAIN/concurrency_relative);cfg['concurrency_sha256']=sha(concurrency.encode());cfg['concurrency_projection']=proof;cfg['source_pins'][cfg['concurrency_file']]=cfg['concurrency_sha256']
 oldflag='export const EXECUTION_ENABLED=true;'if'export const EXECUTION_ENABLED=true;'in callback else'export const EXECUTION_ENABLED=false;';newflag='export const EXECUTION_ENABLED='+str(enabled).lower()+';';need(callback.count(oldflag)==1 and callback.count(MISSING)==1);callback=callback.replace(oldflag,newflag,1).replace(MISSING,CORRECT,1);need(callback.replace(CORRECT,MISSING,1).replace(newflag,oldflag,1)==original_callback)
 cfg['source_pins'].pop(cfg['admin_callback_file']);callback_relative=relative.replace('/controller-','/callback-');cfg['admin_callback_file']=str(MAIN/callback_relative);cfg['admin_callback_sha256']=sha(callback.encode());cfg['source_pins'][cfg['admin_callback_file']]=cfg['admin_callback_sha256']
 for file in sorted(HERE.iterdir()):
  if file.is_file():cfg['source_pins'][str(file)]=sha(file.read_bytes())
 cfg['source_pins'][str(MAIN/PLAN)]=PLAN_SHA;cfg['source_pins'][str(MAIN/FAILED)]=FAILED_SHA;replace('const cfg='+old_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';');replace((BRIDGE/'entry.mjs').as_uri(),(HERE/'entry.mjs').as_uri());replace(old_relative,relative)
 # Keep only the protected parent namespace to reuse the sealed diagnostic helper.
 # The runtime UUID, compile-once claim, resources, artifacts and evidence are NEW.
 for before,after in[("'.local/worker-source-identity-sql-bridge-once'","'.local/worker-source-identity-sql-observation-once'"),("'eps.worker40bridge.run'","'eps.worker40observation.run'"),("'eps.worker40bridge.workspace'","'eps.worker40observation.workspace'"),("'eps.worker40bridge.purpose'","'eps.worker40observation.purpose'"),("'worker40-bridge-owned-phase-validation'","'worker40-observation-owned-phase-validation'"),("'eps-w40b-'","'eps-w40o-'"),("'worker40-bridge-independent-phase-validation'","'worker40-observation-independent-phase-validation'"),("'tracking/evidence/m07/worker-source-identity-sql-bridge-proof'","'tracking/evidence/m07/worker-source-identity-sql-observation-proof'")]:replace(before,after)
 replace(json.dumps(old_relative.replace('/controller-','/concurrency-')),json.dumps(concurrency_relative));replace(json.dumps(old_relative.replace('/controller-','/callback-')),json.dumps(callback_relative))
 marker='    report.source_seals = {}; for (const [root, file] of ';start=source.index(marker)+len(marker);end=source.index(' {\n      const bytes = await readFile',start);before=source[start:end-1];records=json.loads(before);records.extend([[str(SOURCE).replace('\\','/'),p.relative_to(SOURCE).as_posix()]for p in sorted(HERE.iterdir())if p.is_file()]);records.extend([[str(MAIN).replace('\\','/'),PLAN],[str(MAIN).replace('\\','/'),FAILED]]);replace(before,json.dumps(records))
 inverse=source
 for before,after in reversed(changes):need(inverse.count(after)==1);inverse=inverse.replace(after,before,1)
 need(inverse==original)
 return source,concurrency,callback,{'compiled_only':True,'execution_dispatched':False,'execution_enabled':enabled,'original_bridge_controller_inverse_byte_equal':True,'callback_only_flag_and_empty_audit_observation_search_path_changed':True,'diagnostic_helper_reused_exact':True,'private_parent_namespace_reused_with_fresh_runtime_UUID_only':True,'production_State_SQL_hashes':cfg['hashes'],'sql_contract_sha256':cfg['sql_contract_sha256'],'native_pin_value':cfg['native_pin_value'],'source_pins':cfg['source_pins'],'failure':{'path':FAILED,'sha256':FAILED_SHA}}

if __name__=='__main__':
 token=str(uuid.uuid4());relative='.local/worker-source-identity-sql-observation-compiled/controller-'+token+'.mjs';source,concurrency,callback,plan=compile_source(relative)
 for prefix,text in[('concurrency',concurrency),('callback',callback),('controller',source)]:
  file=MAIN/relative.replace('/controller-','/'+prefix+'-');file.parent.mkdir(parents=True,exist_ok=True)
  with file.open('x',encoding='utf8',newline='\n')as f:f.write(text)
 print(json.dumps({'controller':str(MAIN/relative),'controller_sha256':sha(source.encode()),'concurrency_sha256':sha(concurrency.encode()),'callback_sha256':sha(callback.encode()),**plan}))
